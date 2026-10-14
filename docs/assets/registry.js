const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const instant=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'Não informado':new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'medium',timeZone:'America/Sao_Paulo'}).format(date);};
const editable=['employerCnpj','employerLegalName','employerAddress','softwareOwner','technicalResponsible','legalResponsible','inpiRegistration','certificateDeclared'];
const pendingFallback=[{code:'official_release',label:'Validação técnica e liberação do uso oficial'},{code:'protected_signature',label:'Configuração protegida e verificação da assinatura'}];
const stateLabels={recorded:'Marcações',weekend:'Fim de semana',medical:'Atestado',not_applicable:'Não se aplica'};
function stateText(state){
  if(!state)return 'Sem registro';
  let times=state.times;if(typeof times==='string'){try{times=JSON.parse(times);}catch{times=[];}}
  return Array.isArray(times)&&times.length?times.join(' | '):stateLabels[state.status]||'Sem marcações';
}
export function renderRegistryReadiness(result={}){
  const gaps=Array.isArray(result.gaps)&&result.gaps.length?result.gaps:pendingFallback;
  return `<div class="readiness-note registry-readiness"><strong>Liberação oficial pendente</strong><p>Este cadastro prepara a implantação. Salvar dados não habilita o uso como registrador oficial nem comprova requisitos de REP-P.</p></div><ul class="registry-checklist">${gaps.map(gap=>`<li><span>${esc(gap.label)}</span><span class="status pending">Pendente</span></li>`).join('')}</ul>`;
}
export function renderProvenance(events=[]){
  const groups=[
    {kind:'original_event',title:'Batidas aceitas pelo coletor operacional atual',copy:'Somente batidas aceitas pelas regras atuais ficam nesta seção. Tentativas barradas por sequência, intervalo de 30 segundos, limite de 12 marcações ou ocorrência no dia não entram nesta estrutura. A adequação e a assinatura REP-P continuam pendentes.',empty:'Nenhuma batida aceita pelo coletor operacional atual neste dia.'},
    {kind:'historical_snapshot',title:'Snapshots históricos',copy:'Retratos de registros anteriores ou importados. Não equivalem a batidas originais de um REP-P.',empty:'Nenhum snapshot histórico disponível neste dia.'},
    {kind:'treatment',title:'Tratamentos e ajustes',copy:'Alterações administrativas com justificativa, mantendo os eventos de coleta e os snapshots em suas próprias seções.',empty:'Nenhum tratamento registrado neste dia.'}
  ];
  return groups.map(group=>{
    const rows=events.filter(event=>event.kind===group.kind);
    return `<section class="history-card provenance-section" data-provenance-kind="${group.kind}"><div class="card-heading"><h3>${group.title}</h3><span class="field-hint">${rows.length} ${rows.length===1?'evento':'eventos'}</span></div><p class="field-hint">${group.copy}</p>${rows.length?rows.map(event=>{
      const payload=event.payload||{};
      if(group.kind==='original_event')return `<article class="provenance-event"><strong>${esc({entry:'Entrada',exit:'Saída',return:'Retorno'}[payload.markType]||'Marcação')} · ${esc(payload.time||'Horário não informado')}</strong><dl class="overtime-details"><dt>Coletada em</dt><dd>${esc(instant(payload.occurredAt||event.createdAt))} · Horário de Brasília</dd><dt>Coletor</dt><dd>${esc(payload.collector==='web'?'Aplicativo web':payload.collector||'Não informado')}</dd><dt>Versão do cadastro preparatório</dt><dd>${esc(payload.configurationVersion??'Não informada')}</dd>${payload.contentHash?`<dt>Hash do evento</dt><dd><code>${esc(payload.contentHash)}</code><span class="field-hint">Hash técnico de conteúdo; não representa assinatura digital ou conformidade oficial.</span></dd>`:''}</dl></article>`;
      if(group.kind==='historical_snapshot')return `<article class="provenance-event"><strong>${payload.source==='import_baseline'?'Histórico importado de planilha':'Retrato observado de registro anterior'}</strong><dl class="overtime-details"><dt>Estado preservado</dt><dd>${esc(stateText(payload.state))}</dd><dt>Observado em</dt><dd>${esc(instant(payload.observedAt||event.createdAt))}</dd>${payload.filename?`<dt>Arquivo de origem</dt><dd>${esc(payload.filename)}</dd>`:''}<dt>Classificação</dt><dd>Snapshot histórico, sem numeração oficial de REP-P.</dd></dl></article>`;
      return `<article class="provenance-event"><strong>Ajuste administrativo · ${esc(instant(payload.changedAt||event.createdAt))}</strong><div class="admin-comparison"><div><span>Antes do tratamento</span><strong>${esc(stateText(payload.before))}</strong></div><div><span>Depois do tratamento</span><strong>${esc(stateText(payload.after))}</strong></div></div><p class="admin-reason">${esc(payload.reason||'Justificativa não informada.')}</p><p class="field-hint">A identificação do responsável é preservada na auditoria administrativa.</p></article>`;
    }).join(''):`<p class="empty-state">${group.empty}</p>`}</section>`;
  }).join('');
}
export function createRegistry({api,busy,toast,formatDate}){
  const view=document.querySelector('#view-admin'),tabs=view?.querySelector('.admin-tabs');
  if(!view||!tabs)return {open:async()=>{},reset(){},openProvenance:async()=>{},resetProvenance(){}};
  const button=document.createElement('button');button.type='button';button.dataset.adminTab='registry';button.setAttribute('aria-pressed','false');button.textContent='Implantação oficial';tabs.append(button);
  const panel=document.createElement('section');panel.id='admin-panel-registry';panel.className='admin-panel';panel.hidden=true;view.append(panel);
  panel.innerHTML=`<section class="history-card journey-card registry-card"><h2>Preparação da implantação oficial</h2><p class="field-hint">Dados declarados da empresa, do titular do programa e dos responsáveis. A validação técnica e documental permanece pendente.</p><div id="registry-readiness"></div><form id="registry-form">
    <h3>Empregador</h3><div class="admin-form-grid"><div><label for="registry-employer-name">Razão social</label><input id="registry-employer-name" name="employerLegalName" maxlength="250" autocomplete="organization"></div><div><label for="registry-employer-cnpj">CNPJ</label><input id="registry-employer-cnpj" name="employerCnpj" type="text" maxlength="18" autocapitalize="characters" spellcheck="false" placeholder="Exemplo: 12.ABC.345/01DE-35"><p class="field-hint">Numérico ou alfanumérico. Pode ficar em branco enquanto o CNPJ estiver pendente.</p></div></div><label for="registry-employer-address">Endereço do empregador</label><textarea id="registry-employer-address" name="employerAddress" maxlength="500" rows="3" autocomplete="street-address"></textarea>
    <h3>Titular do programa e responsáveis</h3><label for="registry-software-owner">Titular / desenvolvedor do programa</label><input id="registry-software-owner" name="softwareOwner" maxlength="250"><div class="admin-form-grid"><div><label for="registry-technical-responsible">Responsável técnico</label><input id="registry-technical-responsible" name="technicalResponsible" maxlength="180"></div><div><label for="registry-legal-responsible">Responsável legal</label><input id="registry-legal-responsible" name="legalResponsible" maxlength="180"></div></div><label for="registry-inpi">Registro do programa no INPI (opcional)</label><input id="registry-inpi" name="inpiRegistration" maxlength="80"><p class="field-hint">Informar um número não verifica o registro nem substitui sua documentação.</p>
    <h3>Assinatura em configuração protegida</h3><label for="registry-certificate-declared">Declaração sobre certificado</label><select id="registry-certificate-declared" name="certificateDeclared"><option value="false">Ainda não declarado neste cadastro</option><option value="true">A empresa declara possuir certificado digital</option></select><p class="field-hint">A declaração não verifica o certificado. A configuração protegida e a validação da assinatura permanecem pendentes. Este formulário não recebe certificados, chaves privadas ou senhas.</p>
    <label for="registry-reason">Justificativa da atualização</label><textarea id="registry-reason" name="reason" required minlength="10" maxlength="1000" rows="3" placeholder="Descreva os dados preenchidos ou revisados"></textarea><p id="registry-version" class="field-hint"></p><div id="registry-error" class="data-error" role="alert" hidden></div><div class="dialog-actions"><button id="registry-reload" type="button" class="button secondary">Recarregar dados salvos</button><button id="registry-save" class="button primary" disabled>Salvar dados preparatórios</button></div><p id="registry-feedback" class="field-hint" role="status"></p>
  </form></section>`;
  const dialog=document.createElement('dialog');dialog.id='admin-provenance-dialog';dialog.className='confirm-dialog admin-dialog provenance-dialog';dialog.setAttribute('aria-labelledby','admin-provenance-title');
  dialog.innerHTML=`<h2 id="admin-provenance-title">Origem dos registros</h2><p id="admin-provenance-person"></p><div class="readiness-note"><strong>Uso oficial pendente</strong><p>A coleta atual ainda não constitui um REP-P liberado. Históricos e tratamentos ficam identificados separadamente.</p></div><div id="admin-provenance-error" class="data-error" role="alert" hidden></div><div id="admin-provenance-content"></div><div class="dialog-actions"><button id="admin-provenance-more" type="button" class="button secondary" hidden>Carregar mais eventos</button><button id="admin-provenance-close" type="button" class="button primary">Fechar</button></div>`;view.append(dialog);
  const $=id=>document.getElementById(id),form=$('registry-form');
  let version=0,loaded=false,epoch=0,loadSequence=0,provenanceEpoch=0,selectedDay=null,events=[],nextOffset=null;
  function fail(error,id='registry-error'){$(id).textContent=error.message;$(id).hidden=false;}
  function fill(result){
    const configuration=result.configuration||{};version=Number(configuration.version)||0;
    for(const key of editable)form.elements.namedItem(key).value=key==='certificateDeclared'?String(configuration[key]===true):configuration[key]||'';
    $('registry-readiness').innerHTML=renderRegistryReadiness(result);$('registry-version').textContent=`Versão ${version} dos dados preparatórios. Liberação oficial pendente.`;loaded=true;$('registry-save').disabled=false;
  }
  async function load(){
    const generation=epoch,sequence=++loadSequence;$('registry-error').hidden=true;$('registry-save').disabled=true;$('registry-feedback').textContent='Carregando dados preparatórios…';
    try{const result=await api('admin-registry');if(generation!==epoch||sequence!==loadSequence)return;fill(result);$('registry-feedback').textContent='Dados declarados não verificam certificado, assinatura ou registro no INPI.';}
    catch(error){if(generation===epoch&&sequence===loadSequence){fail(error);$('registry-feedback').textContent='Não foi possível carregar os dados. Tente recarregar.';}}
  }
  form.onsubmit=async event=>{
    event.preventDefault();if(!loaded)return;const generation=epoch;$('registry-error').hidden=true;
    const data=Object.fromEntries(editable.map(key=>[key,key==='certificateDeclared'?form.elements.namedItem(key).value==='true':form.elements.namedItem(key).value]));data.version=version;data.reason=$('registry-reason').value;
    $('registry-reload').disabled=true;
    try{const result=await busy($('registry-save'),()=>api('admin-registry-save',{method:'POST',data}),'Salvando…');if(generation!==epoch)return;fill(result);$('registry-reason').value='';$('registry-feedback').textContent='Dados preparatórios salvos. A liberação oficial continua pendente.';toast('Dados preparatórios salvos.');}
    catch(error){if(generation===epoch){fail(error);$('registry-feedback').textContent=error.status===409?'Outra atualização foi salva. Recarregue os dados antes de tentar novamente.':'Nenhuma liberação oficial foi realizada.';}}
    finally{if(generation===epoch)$('registry-reload').disabled=false;}
  };
  $('registry-reload').onclick=load;
  async function loadProvenance(append=false){
    if(!selectedDay||append&&nextOffset==null)return;const generation=provenanceEpoch,selection={...selectedDay};$('admin-provenance-error').hidden=true;$('admin-provenance-more').disabled=true;if(!append)$('admin-provenance-more').hidden=true;
    if(!append)$('admin-provenance-content').innerHTML='<p class="empty-state">Consultando a origem dos registros…</p>';
    try{
      const result=await api('admin-record-provenance',{query:`&uid=${encodeURIComponent(selection.uid)}&date=${encodeURIComponent(selection.date)}&offset=${append?nextOffset:0}`});if(generation!==provenanceEpoch)return;
      const incoming=Array.isArray(result.events)?result.events:[],merged=append?[...events,...incoming]:incoming;events=[...new Map(merged.map(event=>[event.kind+':'+event.id,event])).values()];nextOffset=Number.isSafeInteger(result.nextOffset)&&result.nextOffset>=0?result.nextOffset:null;
      $('admin-provenance-content').innerHTML=renderProvenance(events);$('admin-provenance-more').hidden=nextOffset==null;$('admin-provenance-more').disabled=false;
    }catch(error){if(generation===provenanceEpoch){fail(error,'admin-provenance-error');if(!append)$('admin-provenance-content').innerHTML='';$('admin-provenance-more').disabled=false;}}
  }
  $('admin-provenance-more').onclick=()=>loadProvenance(true);$('admin-provenance-close').onclick=()=>dialog.close();
  function resetProvenance(){provenanceEpoch++;selectedDay=null;events=[];nextOffset=null;dialog.close();$('admin-provenance-content').innerHTML='';$('admin-provenance-person').textContent='';$('admin-provenance-error').hidden=true;$('admin-provenance-more').hidden=true;}
  return {async open(){if(!loaded)await load();},async openProvenance(person,date){provenanceEpoch++;selectedDay={uid:person.uid,date};events=[];nextOffset=null;$('admin-provenance-title').textContent='Origem dos registros · '+formatDate(date);$('admin-provenance-person').textContent=person.name;dialog.showModal();await loadProvenance();},resetProvenance,reset(){epoch++;loaded=false;version=0;form.reset();$('registry-save').disabled=true;$('registry-readiness').innerHTML=renderRegistryReadiness();$('registry-version').textContent='';$('registry-feedback').textContent='';$('registry-error').hidden=true;resetProvenance();}};
}
