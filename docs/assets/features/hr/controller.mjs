import {$,$$,escapeHTML as e} from '../../shared/dom.mjs?v=admin-roles-1';
import {absencesView,lifecycleView,dialogForm,reasonField,options,typeNames,dateLabel} from './views.mjs?v=admin-roles-1';
import {bindPlanningNotices,bindRequestDemandWarnings} from './planning-controller.mjs?v=admin-roles-1';
import {demandNotices,demandWarnings,demandWarningsView} from './planning-views.mjs?v=admin-roles-1';

export function createHR({state,api,busy,toast}) {
  let generation=0,identity=0,view='',result=null;
  let filters={month:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date()),uid:'',offset:0};
  const dialog=document.createElement('dialog');dialog.className='confirm-dialog people-dialog hr-dialog';dialog.setAttribute('aria-labelledby','hr-dialog-title');document.body.append(dialog);
  const root=()=>$(view==='ciclo'?'#hr-lifecycle-content':'#hr-absences-content');
  const active=(token,requestedView)=>token===generation&&requestedView===state.view&&Boolean(state.session?.user);
  function reset(){generation++;identity++;result=null;view='';filters.uid='';filters.offset=0;dialog.close();dialog.replaceChildren();for(const selector of ['#hr-lifecycle-content','#hr-absences-content']){const element=$(selector);element?.replaceChildren();element?.setAttribute('aria-busy','false');}}
  async function open(nextView){view=nextView;filters.offset=0;await load();}
  async function load() {
    const token=++generation,requestedView=view,element=root();if(!element)return;
    element.setAttribute('aria-busy','true');element.innerHTML='<div class="empty-state" role="status">Carregando planejamento…</div>';
    try {const data=await api('hr-state',{query:`&view=${requestedView}&month=${encodeURIComponent(filters.month)}&uid=${encodeURIComponent(filters.uid)}&offset=${filters.offset}`});if(!active(token,requestedView))return;result=data;element.innerHTML=requestedView==='ciclo'?lifecycleView(data,filters,state.session.user.uid):absencesView(data,filters,state.session.user.uid);element.setAttribute('aria-busy','false');bind();}
    catch(error){if(!active(token,requestedView))return;element.setAttribute('aria-busy','false');element.innerHTML=`<p class="data-error" role="alert">${e(error.message)}</p><button class="button secondary" data-hr-retry>Tentar novamente</button>`;element.querySelector('[data-hr-retry]').onclick=load;}
  }
  const run=work=>Promise.resolve().then(work).catch(error=>toast(error.message,true));
  function bind(){
    $('#hr-filter').onsubmit=event=>{event.preventDefault();filters.month=$('#hr-month').value;filters.uid=$('#hr-person').value;filters.offset=0;run(load);};
    $('[data-hr-more]')?.addEventListener('click',()=>{filters.offset=(view==='ciclo'?result.processes:result.absences).nextOffset;run(load);});
    $('[data-hr-first]')?.addEventListener('click',()=>{filters.offset=0;run(load);});
    $('[data-hr-request]')?.addEventListener('click',requestDialog);
    if(view==='ausencias')bindPlanningNotices({element:root(),result,dialog,show,reasonField});
    $('[data-hr-balance-new]')?.addEventListener('click',()=>balanceDialog());
    $$('[data-hr-balance]').forEach(button=>button.onclick=()=>balanceDialog(result.balances.find(row=>row.id===button.dataset.hrBalance)));
    $$('[data-hr-decide]').forEach(button=>button.onclick=()=>decisionDialog(button.dataset.hrDecide));
    $$('[data-hr-cancel]').forEach(button=>button.onclick=()=>cancelDialog(button.dataset.hrCancel));
    $('[data-hr-process-new]')?.addEventListener('click',processDialog);
    $$('[data-hr-step]').forEach(button=>button.onclick=()=>stepDialog(button.dataset.process,button.dataset.hrStep));
    $$('[data-hr-step-edit]').forEach(button=>button.onclick=()=>stepDialog(button.dataset.process,button.dataset.hrStepEdit,true));
    $$('[data-hr-process-close]').forEach(button=>button.onclick=()=>closeProcessDialog(button.dataset.hrProcessClose));
  }
  function show(title,content,action,payload,success) {
    const epoch=identity,requestedView=view;dialog.innerHTML=dialogForm(title,content);dialog.querySelector('[data-hr-dialog-close]').onclick=()=>dialog.close();dialog.showModal();let previousSignature='',requestId='';
    $('#hr-dialog-form').onsubmit=async event=>{event.preventDefault();const button=event.submitter||dialog.querySelector('[type="submit"]'),errorBox=$('#hr-dialog-error');errorBox.hidden=true;
      try {const data=payload(new FormData(event.target)),signature=JSON.stringify(data);if(signature!==previousSignature){previousSignature=signature;requestId=crypto.randomUUID();}data.requestId=requestId;await busy(button,()=>api(action,{method:'POST',data}));if(epoch!==identity||state.view!==requestedView)return;
        if(action==='hr-absence-request'){filters.month=data.startOn.slice(0,7);filters.uid=state.session.user.uid;filters.offset=0;}
        if(action==='hr-process-create'){filters.uid=data.uid;filters.offset=0;}
        if(action==='hr-balance-save'){filters.uid=data.uid;filters.offset=0;if(filters.month<data.periodStart.slice(0,7)||filters.month>data.periodEnd.slice(0,7))filters.month=data.periodStart.slice(0,7);}
        if(action==='hr-notice-save'){filters.offset=0;if(!data.dates.some(date=>date.startsWith(filters.month)))filters.month=data.dates[0].slice(0,7);}
        dialog.close();toast(success||'Registro atualizado.');await load();}
      catch(error){if(epoch!==identity)return;errorBox.textContent=error.message;errorBox.hidden=false;}
    };
  }
  function requestDialog(){show('Solicitar férias ou ausência',`<p class="field-hint">Pedido para sua conta. Dias corridos incluindo o início e o fim. Não informe diagnóstico ou dados de saúde.</p><label for="hr-type">Tipo</label><select id="hr-type" name="type">${Object.entries(typeNames).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select><div class="people-form-grid"><div><label for="hr-start">Início</label><input id="hr-start" name="startOn" type="date" required></div><div><label for="hr-end">Fim</label><input id="hr-end" name="endOn" type="date" required></div></div><div id="hr-request-demand-warnings" aria-live="polite" hidden></div>${reasonField}`,'hr-absence-request',form=>Object.fromEntries(form),'Solicitação enviada para análise.');bindRequestDemandWarnings(dialog,result);}
  function decisionDialog(id){const row=result.absences.rows.find(r=>r.id===id),warnings=row.demandWarnings??demandWarnings(demandNotices(result),row.startOn,row.endOn);show('Analisar solicitação',`<p>${e(row.personName)} · ${e(typeNames[row.type])}<br>${dateLabel(row.startOn)} a ${dateLabel(row.endOn)} · ${row.days} dias corridos</p><div id="hr-decision-demand-warnings">${demandWarningsView(warnings)}</div><label for="hr-decision">Decisão</label><select id="hr-decision" name="decision"><option value="approved">Aprovar</option><option value="rejected">Não aprovar</option></select>${reasonField}`,'hr-absence-decide',form=>({id,version:row.version,...Object.fromEntries(form)}),'Decisão registrada.');}
  function cancelDialog(id){const row=result.absences.rows.find(r=>r.id===id);show('Cancelar ausência',`<p>${e(row.personName)} · ${dateLabel(row.startOn)} a ${dateLabel(row.endOn)}. O histórico será preservado.</p>${reasonField}`,'hr-absence-cancel',form=>({id,version:row.version,...Object.fromEntries(form)}),'Ausência cancelada.');}
  function balanceDialog(row){const year=filters.month.slice(0,4);show(row?'Ajustar saldo manual':'Adicionar saldo manual',`<p class="field-hint">Informe o saldo operacional em dias corridos. O período de um saldo existente é fixo.</p><label for="hr-balance-person">Colaborador</label><select id="hr-balance-person" name="uid" ${row?'disabled':''} required>${options(result.people,row?.uid||filters.uid)}</select><div class="people-form-grid"><div><label for="hr-period-start">Período: início</label><input id="hr-period-start" name="periodStart" type="date" value="${e(row?.periodStart||year+'-01-01')}" ${row?'readonly':''} required></div><div><label for="hr-period-end">Período: fim</label><input id="hr-period-end" name="periodEnd" type="date" value="${e(row?.periodEnd||year+'-12-31')}" ${row?'readonly':''} required></div></div><label for="hr-granted">Dias concedidos</label><input id="hr-granted" name="grantedDays" type="number" min="0" max="366" step="1" value="${row?.grantedDays??30}" required>${reasonField}`,'hr-balance-save',form=>({...Object.fromEntries(form),uid:row?.uid||form.get('uid'),grantedDays:Number(form.get('grantedDays')),id:row?.id||null,version:row?.version||0}),'Saldo atualizado.');}
  function eligibleOwners(uid){const target=result.people.find(p=>p.uid===uid);return result.people.filter(p=>p.status==='active'&&(p.uid===uid||p.uid===state.session.user.uid||p.role==='hr'||p.uid===target?.managerUid&&p.role==='manager'));}
  function processDialog(){
    const content=`<label for="hr-process-person">Colaborador</label><select id="hr-process-person" name="uid" required>${options(result.people,filters.uid)}</select><label for="hr-process-type">Tipo</label><select id="hr-process-type" name="type"><option value="onboarding">Admissão</option><option value="offboarding">Desligamento</option></select><p class="field-hint">Defina de 1 a 20 etapas. Cada etapa tem responsável e prazo. Nenhuma etapa altera permissões automaticamente.</p><div id="hr-steps-editor"></div><button type="button" class="text-button" id="hr-add-step">+ Adicionar etapa</button>${reasonField}`;
    show('Novo processo operacional',content,'hr-process-create',form=>{const steps=[...dialog.querySelectorAll('[data-step-editor]')].map(element=>({title:element.querySelector('[name="step-title"]').value,ownerUid:element.querySelector('[name="step-owner"]').value,dueOn:element.querySelector('[name="step-due"]').value}));return {uid:form.get('uid'),type:form.get('type'),reason:form.get('reason'),steps};},'Processo criado.');
    let count=0;const add=()=>{if(count>=20)return;count++;const element=document.createElement('fieldset');element.dataset.stepEditor='';element.innerHTML=`<legend>Etapa ${count}</legend><label>Título<input name="step-title" minlength="3" maxlength="180" required></label><div class="people-form-grid"><label>Responsável<select name="step-owner" required>${options(eligibleOwners($('#hr-process-person').value),state.session.user.uid)}</select></label><label>Prazo<input name="step-due" type="date" required></label></div><button type="button" class="text-button" data-remove-step>Remover etapa</button>`;element.querySelector('[data-remove-step]').onclick=()=>{element.remove();count--;};$('#hr-steps-editor').append(element);};
    $('#hr-add-step').onclick=add;$('#hr-process-person').onchange=()=>dialog.querySelectorAll('[name="step-owner"]').forEach(select=>{select.innerHTML=options(eligibleOwners($('#hr-process-person').value),state.session.user.uid);});add();
  }
  function stepDialog(processId,stepId,edit=false){const row=result.processes.rows.find(r=>r.id===processId),step=row.steps.find(s=>s.id===stepId);show(edit?'Responsável e prazo':step.status==='completed'?'Reabrir etapa':'Concluir etapa',`<p><strong>${e(step.title)}</strong></p>${edit?`<label for="hr-step-owner">Responsável</label><select id="hr-step-owner" name="ownerUid" required>${options(eligibleOwners(row.uid),step.ownerUid)}</select><label for="hr-step-due">Prazo</label><input id="hr-step-due" name="dueOn" type="date" value="${e(step.dueOn)}" required>`:''}${reasonField}`,'hr-step-save',form=>({id:processId,stepId,version:row.version,stepVersion:step.version,status:edit?step.status:step.status==='completed'?'open':'completed',...Object.fromEntries(form)}),'Etapa atualizada.');}
  function closeProcessDialog(id){const row=result.processes.rows.find(r=>r.id===id);show('Encerrar processo',`<p>As etapas de ${e(row.personName)} estão concluídas. O encerramento preserva o histórico e mantém o acesso da conta.</p>${reasonField}`,'hr-process-close',form=>({id,version:row.version,...Object.fromEntries(form)}),'Processo encerrado.');}
  return {open,reset};
}
