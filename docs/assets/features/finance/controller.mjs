import {e,money,personOptions,peopleTable,overtimeTable,paymentsTable,totals} from './presentation.mjs?v=payments-2';
import {rateForm,overtimeForm,paymentForm,operationForm,availableOptions} from './forms.mjs?v=payments-2';

/** All financial writes go through authenticated, versioned server operations. */
export function createFinance({host,api,state,toast,currentParts}) {
  if(!host)return {open:async()=>{},reset(){}};
  let context=null,tab='overtime',period='',uid='',offset=0,nextOffset=null,rows=[],epoch=0,sequence=0,dialogSequence=0,pending=false,submission=null;
  const today=()=>{const p=currentParts();return `${p.year}-${p.month}-${p.day}`;};
  const dialog=document.createElement('dialog');dialog.className='confirm-dialog finance-dialog';dialog.setAttribute('aria-label','Operação de pagamentos e horas extras');document.body.append(dialog);
  const $=selector=>host.querySelector(selector);
  const current=token=>token===epoch&&state.view==='pagamentos'&&Boolean(state.session?.user);
  const report=error=>{const root=$('[data-finance-error]');if(root){root.textContent=error.message;root.hidden=false;}};
  function shell(){
    host.innerHTML=`<div class="page-heading"><div><span class="eyebrow muted">PESSOAS E VALORES</span><h1>${context.canManagePayments?'Pagamentos':'Horas extras'}<span>.</span></h1><p>${context.canManagePayments?'Bases por colaborador, ocorrências aprovadas e lançamentos organizados.':'Registre o período adicional e acompanhe a análise do responsável.'}</p></div></div><div class="people-tabs" role="tablist" aria-label="Gestão de pagamentos">${(context.canManagePayments?[['people','Pessoas'],['overtime','Horas extras'],['payments','Pagamentos'],['audit','Histórico']]:[['overtime','Horas extras']]).map(([value,label])=>`<button role="tab" data-finance-tab="${value}" aria-selected="${tab===value}">${label}</button>`).join('')}</div><form data-finance-filter class="people-toolbar"><label>Competência<input name="period" type="month" value="${period}" required></label><label class="grow">Colaborador<select name="uid">${personOptions(context.people,uid)}</select></label><button class="button secondary">Filtrar</button></form>${context.peopleTruncated?'<p class="field-hint">O seletor mostra até 1.000 pessoas. Refine o cadastro antes de ampliar o uso.</p>':''}<div class="finance-toolbar"><p class="field-hint" data-finance-hint></p><button type="button" class="button primary" data-finance-new hidden></button></div><p class="data-error" data-finance-error role="alert" hidden></p><div data-finance-totals></div><section class="history-card finance-table" data-finance-list aria-live="polite"></section><div class="admin-pagination"><button type="button" class="button secondary" data-finance-prev>Anterior</button><span data-finance-page></span><button type="button" class="button secondary" data-finance-next>Próxima</button></div>`;
    $('[data-finance-filter]').onsubmit=event=>{event.preventDefault();const data=new FormData(event.target);period=data.get('period');uid=data.get('uid');offset=0;load();};
    host.querySelectorAll('[data-finance-tab]').forEach(button=>button.onclick=()=>{if(pending)return;tab=button.dataset.financeTab;offset=0;shell();load();});
    $('[data-finance-prev]').onclick=()=>{offset=Math.max(0,offset-50);load();};$('[data-finance-next]').onclick=()=>{if(nextOffset!==null){offset=nextOffset;load();}};
    $('[data-finance-new]').onclick=()=>tab==='payments'?editPayment():editOvertime();
    $('[data-finance-list]').onclick=event=>{const button=event.target.closest('[data-finance-action]');if(!button||pending)return;const row=rows.find(item=>(item.id||item.uid)===button.dataset.id);if(!row)return;const action=button.dataset.financeAction;if(action==='rate')editRate(row);else if(action==='edit-overtime')editOvertime(row);else if(action==='edit-payment')editPayment(row);else confirm(action,row);};
  }
  async function load(){
    const token=epoch,request=++sequence;if(!current(token))return;
    const list=$('[data-finance-list]');list.setAttribute('aria-busy','true');list.innerHTML='<div class="empty-state">Carregando registros…</div>';$('[data-finance-error]').hidden=true;
    const button=$('[data-finance-new]');button.hidden=!['overtime','payments'].includes(tab);button.textContent=tab==='payments'?'+ Novo pagamento':'+ Registrar hora extra';
    $('[data-finance-hint]').textContent={people:'Contato, contrato e dia fixo são atualizados na ficha do colaborador.',overtime:'Somente ocorrências aprovadas pelo responsável indicado podem entrar nos pagamentos.',payments:'Valores previstos e baixas manuais, sem transferência bancária.',audit:'Histórico privado das operações financeiras, limitado aos 100 registros mais recentes no mês.'}[tab];
    try{
      const query=`&period=${encodeURIComponent(period)}&uid=${encodeURIComponent(uid)}&offset=${offset}`;
      const result=await api({people:'finance-people',overtime:'finance-overtime',payments:'finance-payments',audit:'finance-audit'}[tab],{query});
      if(!current(token)||request!==sequence)return;rows=result.rows;nextOffset=result.nextOffset??null;
      list.innerHTML=tab==='people'?peopleTable(rows):tab==='overtime'?overtimeTable(rows):tab==='payments'?paymentsTable(rows):auditTable(rows);
      $('[data-finance-totals]').innerHTML=['overtime','payments'].includes(tab)?totals(tab,result.totals):'';
      $('[data-finance-prev]').disabled=offset===0;$('[data-finance-next]').disabled=nextOffset===null;$('[data-finance-page]').textContent=tab==='audit'?'Últimas operações':`Página ${offset/50+1}`;
    }catch(error){if(current(token)&&request===sequence){report(error);list.innerHTML='<div class="empty-state">Use Filtrar para tentar novamente.</div>';}}finally{if(current(token)&&request===sequence)list.setAttribute('aria-busy','false');}
  }
  function auditTable(items){return items.length?`<div class="table-scroll"><table class="records-table"><thead><tr><th>Data</th><th>Pessoa</th><th>Operação</th><th>Responsável e motivo</th></tr></thead><tbody>${items.map(item=>`<tr><td>${e(new Date(item.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))}</td><td>${e(item.person_name)}</td><td>${e(auditLabels[item.action]||'Atualização financeira')}</td><td>${e(item.actor_name)}<small>${e(item.reason)}</small></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state">Nenhuma operação neste mês.</div>';}
  function close(){if(!pending){dialogSequence++;dialog.close();submission=null;}}
  dialog.oncancel=event=>{if(pending)event.preventDefault();else dialogSequence++;};
  function show(title,content,action,makeBody,afterRender=()=>{}){
    const token=epoch,dialogToken=++dialogSequence;submission=null;
    dialog.innerHTML=`<form><h2>${e(title)}</h2>${content}<p data-form-error class="data-error" role="alert" hidden></p><div class="dialog-actions"><button type="button" data-cancel class="button secondary">Cancelar</button><button class="button primary" data-save>Confirmar</button></div></form>`;
    const form=dialog.querySelector('form'),errorRoot=dialog.querySelector('[data-form-error]'),save=dialog.querySelector('[data-save]');let loading=false;
    const active=()=>token===epoch&&dialogToken===dialogSequence&&Boolean(state.session?.user);
    const error=error=>{if(active()){errorRoot.textContent=error.message;errorRoot.hidden=false;}};
    const setLoading=value=>{if(active()){loading=value;save.disabled=value;}};
    form.oninput=()=>{submission=null;errorRoot.hidden=true;};dialog.querySelector('[data-cancel]').onclick=close;
    form.onsubmit=async event=>{
      event.preventDefault();if(pending||loading)return;errorRoot.hidden=true;
      let body;try{body=makeBody(new FormData(form));}catch(failure){error(failure);return;}
      const signature=JSON.stringify(body);if(!submission||submission.signature!==signature)submission={signature,requestId:crypto.randomUUID()};
      pending=true;const disabled=new Set([...form.elements].filter(item=>item.disabled));for(const item of form.elements)item.disabled=true;save.textContent='Salvando…';
      try{await api(action,{method:'POST',data:{...body,requestId:submission.requestId}});if(!active())return;dialog.close();dialogSequence++;toast('Operação registrada com sucesso.');await load();}
      catch(failure){error(failure);}finally{if(token===epoch){pending=false;for(const item of form.elements)item.disabled=disabled.has(item);save.textContent='Confirmar';}}
    };
    dialog.showModal();afterRender({form,active,error,setLoading});
  }
  function editRate(person){const original=person.rate;show('Base de cálculo de horas extras',rateForm(person,period),'finance-rate-save',form=>({...Object.fromEntries(form),uid:person.uid,version:original?.effectiveOn===form.get('effectiveOn')?original.version:0}));}
  function editOvertime(row=null){
    const selected=row?.uid||uid||context.uid,people=context.people.filter(item=>item.status==='active'||item.uid===row?.uid);
    show(row?'Atualizar hora extra':'Registrar hora extra',overtimeForm({row,context,people,today:today(),uid:selected}),'finance-overtime-save',form=>({...Object.fromEntries(form),uid:row?.uid||(!context.canManagePayments?context.uid:form.get('uid')),version:row?.version||0,...(row?{id:row.id}:{})}),({form,active,error,setLoading})=>{
      const person=form.querySelector('[data-finance-person]'),approvers=form.querySelector('[data-finance-approver]'),justification=form.querySelector('[data-finance-justification]'),counter=form.querySelector('[data-finance-counter]');let request=0;
      const count=()=>counter.textContent=`${justification.value.trim().length} / mínimo de 100 caracteres`;justification.addEventListener('input',count);count();
      async function refresh(){const seq=++request;approvers.innerHTML='<option value="">Carregando responsáveis…</option>';setLoading(true);try{const result=person.value?await api('finance-overtime-approvers',{query:'&uid='+encodeURIComponent(person.value)}):{people:[]};if(!active()||seq!==request)return;approvers.innerHTML=personOptions(result.people,row?.approverUid,'Selecione o responsável');if(!result.people.length)approvers.innerHTML='<option value="">Sem responsável elegível; solicite ao RH um vínculo</option>';}catch(failure){if(active()&&seq===request)error(failure);}finally{if(active()&&seq===request)setLoading(false);}}
      person.onchange=refresh;refresh();
    });
  }
  function editPayment(row=null){
    const selected=row?.uid||uid||'';
    show(row?'Editar pagamento previsto':'Novo pagamento',paymentForm({row,people:context.people,uid:selected,period}),'finance-payment-save',form=>({...Object.fromEntries([...form].filter(([key])=>key!=='overtimeIds')),uid:row?.uid||form.get('uid'),version:row?.version||0,...(row?{id:row.id}:{}),overtimeIds:form.getAll('overtimeIds')}),({form,active,error,setLoading})=>{
      const person=form.querySelector('[data-finance-person]'),available=form.querySelector('[data-finance-available]'),base=form.elements.baseAmount,due=form.elements.dueOn,summary=form.querySelector('[data-finance-total]');let request=0;
      function total(){const extra=row?row.overtimeCents:[...form.querySelectorAll('[name="overtimeIds"]:checked')].reduce((sum,item)=>sum+Number(item.dataset.cents),0);summary.textContent='Total do lançamento: '+money(Math.round(Number(base.value||0)*100)+extra);}
      form.addEventListener('input',total);total();if(row)return;
      async function refresh(){const seq=++request;available.textContent='Carregando horas extras e base…';base.value='0.00';due.value='';total();setLoading(true);try{
        if(!person.value){available.textContent='Selecione uma pessoa.';return;}
        const query=`&uid=${encodeURIComponent(person.value)}&period=${period}`,[extra,records]=await Promise.all([api('finance-payment-available',{query}),api('finance-people',{query})]);
        if(!active()||seq!==request)return;const profile=records.rows[0];due.value=profile?.suggestedDueOn||'';base.value=decimalAmount(profile?.rate?.remunerationCents??0);available.innerHTML=(extra.rows.length?availableOptions(extra.rows):'<p class="field-hint">Nenhuma hora aprovada, calculada e disponível nesta competência.</p>')+(extra.truncated?'<p class="field-hint">Exibindo as primeiras 100 ocorrências. Selecione até 50 por pagamento.</p>':'');total();
      }catch(failure){if(active()&&seq===request){available.textContent='Não foi possível carregar as ocorrências. Selecione novamente.';error(failure);}}finally{if(active()&&seq===request)setLoading(false);}}
      person.onchange=refresh;refresh();
    });
  }
  function confirm(action,row){
    const titles={approve:'Aprovar hora extra',reject:'Rejeitar hora extra',price:'Calcular hora extra','cancel-overtime':'Cancelar hora extra',paid:'Registrar pagamento','cancel-payment':'Cancelar pagamento','reopen-payment':'Reabrir pagamento'};
    const endpoint=['approve','reject'].includes(action)?'finance-overtime-decision':action==='price'?'finance-overtime-price':action==='cancel-overtime'?'finance-overtime-cancel':'finance-payment-transition';
    show(titles[action],operationForm(action,row,today()),endpoint,form=>({id:row.id,version:row.version,...Object.fromEntries(form),...(['approve','reject'].includes(action)?{decision:action==='approve'?'approved':'rejected'}:endpoint==='finance-payment-transition'?{status:{paid:'paid','cancel-payment':'cancelled','reopen-payment':'planned'}[action]}:{})}));
  }
  return {async open(){const token=epoch;try{const result=await api('finance-context');if(!current(token))return;context=result;period=period||today().slice(0,7);if(!context.canManagePayments)tab='overtime';shell();await load();}catch(error){if(current(token))host.innerHTML=`<p class="data-error" role="alert">${e(error.message)}</p>`;}},reset(){epoch++;sequence++;dialogSequence++;pending=false;context=null;rows=[];uid='';period='';tab='overtime';offset=0;submission=null;dialog.close();host.innerHTML='';}};
}
const decimalAmount=value=>(value/100).toFixed(2);

const auditLabels={'finance:rate-save':'Base de cálculo atualizada','finance:overtime-save':'Hora extra registrada/atualizada','finance:overtime-approved':'Hora extra aprovada','finance:overtime-rejected':'Hora extra rejeitada','finance:overtime-decision':'Hora extra analisada','finance:overtime-price':'Valor da hora extra calculado','finance:overtime-cancel':'Hora extra cancelada','finance:payment-save':'Pagamento previsto atualizado','finance:payment-paid':'Pagamento registrado','finance:payment-planned':'Pagamento reaberto','finance:payment-cancelled':'Pagamento cancelado','finance:payment-transition':'Situação do pagamento atualizada'};
