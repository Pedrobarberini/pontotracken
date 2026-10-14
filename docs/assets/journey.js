import {calendarBadge} from './calendar-ui.mjs?v=calendar-1';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const activityNames={available:'Disponível',lunch:'Almoço',break:'Pausa rápida',meeting:'Reunião',external:'Externo',offline:'Offline'};
const statusNames={running:'Em andamento',pending:'Aguardando análise',approved:'Aprovada',rejected:'Recusada'};
const when=value=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value));
export function createJourney({api,busy,toast,hours,currentMonth,currentParts,getUser}){
  const host=document.querySelector('#journey-tools'),teamHost=document.querySelector('#team-panel');
  if(!host||!teamHost)return {open:async()=>{},openAdmin:async()=>{},reset(){}};
  const $=id=>document.getElementById(id),today=()=>{const p=currentParts();return `${p.year}-${p.month}-${p.day}`;};
  let active=null,ownRows=[],approvers=[],people=[],requests=[],teamOffset=0,teamNext=null,reviewOffset=0,reviewNext=null,epoch=0,mineSequence=0,heartbeat=null,refresh=null,selected=null,decision=null,closingRecord=null,assigningRecord=null,serverOffset=0,enabled=false,pendingHeartbeat=false;
  const mutationKeys=new Map();
  host.innerHTML=`<div class="journey-status-grid"><section class="history-card journey-card"><h2>Meu status</h2><p class="muted">Informe sua atividade atual para a equipe.</p><label for="activity-select">Atividade</label><select id="activity-select">${Object.entries(activityNames).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><p id="activity-feedback" class="field-hint" role="status"></p></section><section class="history-card journey-card"><h2>Minha jornada prevista</h2><div id="my-schedule" class="journey-schedule"></div><p class="field-hint">O ADMIN configura os horários e a vigência de cada jornada.</p></section></div>
    <section class="history-card journey-card"><div class="card-heading"><div><h2>Horas extras</h2><p>Informe o pedido, o trabalho realizado e quem deve analisar.</p></div><label class="sr-only" for="overtime-month">Mês das horas extras</label><input id="overtime-month" type="month"></div><div id="journey-error" class="data-error" role="alert" hidden></div>
    <div id="overtime-running" class="overtime-running" hidden><div><span class="eyebrow muted">CRONÔMETRO EM ANDAMENTO</span><strong id="overtime-clock" class="overtime-clock">00:00:00</strong><span id="overtime-running-info"></span></div><button id="overtime-stop" class="button primary">Encerrar período</button></div>
    <form id="overtime-form">
      <div class="journey-form-grid"><div><label for="overtime-mode">Como registrar</label><select id="overtime-mode"><option value="timer">Cronometrar agora</option><option value="manual">Período já realizado</option></select></div><div><label for="overtime-requester">Quem solicitou</label><input id="overtime-requester" required minlength="2" maxlength="180" placeholder="Nome de quem solicitou o trabalho"></div></div>
      <label for="overtime-approver">Responsável pela aprovação</label><select id="overtime-approver" required><option value="">Carregando responsáveis…</option></select><p id="overtime-eligibility" class="field-hint" role="status">Consultando os ADMINs disponíveis.</p>
      <div id="overtime-period" class="journey-form-grid" hidden><div><label for="overtime-date">Dia de início</label><input id="overtime-date" type="date"></div><div><label for="overtime-start">Início</label><input id="overtime-start" type="time"></div><div><label for="overtime-end">Término</label><input id="overtime-end" type="time"></div></div><p id="overtime-overnight" class="field-hint" hidden>Se o término for anterior ao início, o período termina no dia seguinte.</p>
      <label for="overtime-requested-work">O que foi solicitado</label><textarea id="overtime-requested-work" rows="3" required minlength="15" maxlength="2000" placeholder="Descreva o trabalho que precisava ser realizado"></textarea>
      <div id="overtime-performed-field" hidden><label for="overtime-performed-work">O que foi realizado</label><textarea id="overtime-performed-work" rows="3" minlength="15" maxlength="2000" placeholder="Descreva a entrega e o resultado do período"></textarea></div>
      <label for="overtime-reason">Por que foi fora do horário</label><textarea id="overtime-reason" rows="3" required minlength="15" maxlength="1000" placeholder="Explique por que o trabalho precisou ocorrer fora da jornada"></textarea>
      <div class="journey-submit"><p class="field-hint">O responsável escolhido analisa a ocorrência após o encerramento. As marcações de ponto permanecem separadas.</p><button id="overtime-save" class="button primary" type="submit" disabled>Iniciar cronômetro</button></div>
    </form></section><section class="history-card journey-card"><h2>Minhas ocorrências</h2><div id="my-overtime-list"></div></section>
    <dialog id="overtime-stop-dialog" class="confirm-dialog admin-dialog" aria-labelledby="overtime-stop-title"><form id="overtime-stop-form"><h2 id="overtime-stop-title">Encerrar hora extra</h2><p id="overtime-stop-summary"></p><label for="stop-performed-work">O que foi realizado</label><textarea id="stop-performed-work" rows="4" required minlength="15" maxlength="2000" placeholder="Informe o trabalho concluído e o resultado"></textarea><p class="field-hint">O encerramento usa o horário do servidor e envia o período ao responsável escolhido.</p><div id="stop-error" class="data-error" role="alert" hidden></div><div class="dialog-actions"><button id="stop-cancel" type="button" class="button secondary">Continuar cronômetro</button><button id="stop-save" class="button primary">Encerrar e enviar</button></div></form></dialog>
    <dialog id="overtime-assign-dialog" class="confirm-dialog admin-dialog" aria-labelledby="overtime-assign-title"><form id="overtime-assign-form"><h2 id="overtime-assign-title">Trocar responsável</h2><p id="overtime-assign-person"></p><label for="assign-approver">Novo responsável pela aprovação</label><select id="assign-approver" required></select><p id="assign-hint" class="field-hint"></p><div id="assign-error" class="data-error" role="alert" hidden></div><div class="dialog-actions"><button id="assign-cancel" type="button" class="button secondary">Cancelar</button><button id="assign-save" class="button primary">Salvar responsável</button></div></form></dialog>`;
  teamHost.innerHTML=`<section class="history-card journey-card"><div class="card-heading"><div><h2>Jornada da equipe</h2><p id="team-updated">Consulta de jornada e atividade atual.</p></div></div><form id="team-filter" class="admin-toolbar"><div class="admin-field grow"><label for="team-search">Buscar colaborador</label><input id="team-search" type="search" maxlength="180" placeholder="Nome ou e-mail"></div><div class="admin-field"><label for="team-month">Mês dos indicadores</label><input id="team-month" type="month" required></div><button class="button secondary" type="submit">Atualizar</button></form><div id="team-error" class="data-error" role="alert" hidden></div><div id="team-metrics" class="team-metrics"></div><div id="team-list"></div><div class="admin-pagination"><button id="team-prev" class="button secondary" disabled>Anterior</button><span id="team-page"></span><button id="team-next" class="button secondary" disabled>Próxima</button></div><p class="field-hint">Indicadores desta página. Atrasos e excesso de horas usam a jornada vigente. Dias em aberto não somam excesso de horas. Feriados e dias fora da escala ficam separados da jornada normal. Os indicadores de horas especiais podem coincidir e não calculam adicionais de pagamento. Online indica conexão recente com o aplicativo, sem medir produtividade.</p></section>
    <section class="history-card journey-card"><div class="card-heading"><h2>Análise de horas extras</h2><label class="sr-only" for="review-status">Situação da análise</label><select id="review-status"><option value="">Todas as situações</option>${Object.entries(statusNames).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div><div id="review-list"></div><div class="admin-pagination"><button id="review-prev" class="button secondary" disabled>Anterior</button><span id="review-page"></span><button id="review-next" class="button secondary" disabled>Próxima</button></div></section>
    <dialog id="schedule-dialog" class="confirm-dialog admin-dialog" aria-labelledby="schedule-title"><form id="schedule-form"><h2 id="schedule-title">Configurar jornada</h2><p id="schedule-person"></p><div class="journey-form-grid"><div><label for="schedule-date">Vigência a partir de</label><input id="schedule-date" type="date" required></div><div><label for="schedule-start">Entrada prevista</label><input id="schedule-start" type="time" required></div><div><label for="schedule-end">Saída prevista</label><input id="schedule-end" type="time" required></div></div><div class="journey-form-grid"><div><label for="schedule-break">Intervalo em minutos</label><input id="schedule-break" type="number" min="0" max="1439" required></div><div><label for="schedule-tolerance">Tolerância de atraso em minutos</label><input id="schedule-tolerance" type="number" min="0" max="60" required></div></div><fieldset class="schedule-weekdays"><legend>Dias de trabalho</legend>${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((d,i)=>`<label><input type="checkbox" name="weekday" value="${i}">${d}</label>`).join('')}</fieldset><p class="field-hint">A nova vigência preserva os horários das jornadas anteriores. Para indicadores históricos, informe a data inicial correspondente.</p><label for="schedule-reason">Justificativa</label><textarea id="schedule-reason" rows="2" minlength="10" maxlength="1000" required></textarea><div class="dialog-actions"><button type="button" id="schedule-cancel" class="button secondary">Cancelar</button><button id="schedule-save" class="button primary">Salvar jornada</button></div></form></dialog>
    <dialog id="review-dialog" class="confirm-dialog admin-dialog" aria-labelledby="review-title"><form id="review-form"><h2 id="review-title">Analisar ocorrência</h2><p id="review-person"></p><div id="review-summary"></div><label for="review-decision">Decisão</label><select id="review-decision"><option value="approved">Aprovar</option><option value="rejected">Recusar</option></select><label for="review-reason">Justificativa da decisão</label><textarea id="review-reason" rows="3" required minlength="10" maxlength="1000"></textarea><div id="review-error" class="data-error" role="alert" hidden></div><div class="dialog-actions"><button id="review-cancel" type="button" class="button secondary">Cancelar</button><button id="review-save" class="button primary">Confirmar análise</button></div></form></dialog>`;
  function fail(error,id='journey-error'){if(!enabled)return;$(id).textContent=error.message;$(id).hidden=false;}
  function scheduleText(s){return s?`${s.start_time} a ${s.end_time} · ${hours(s.expected_minutes)} de jornada · ${s.break_minutes} min de intervalo`:'Jornada ainda não configurada.';}
  function tick(){if(active&&enabled){const elapsed=Math.max(0,Math.floor((Date.now()+serverOffset-Date.parse(active.start_at))/1000));$('overtime-clock').textContent=[Math.floor(elapsed/3600),Math.floor(elapsed%3600/60),elapsed%60].map(n=>String(n).padStart(2,'0')).join(':');}}
  const legacy=row=>row.requested_work==null;
  const approverLabel=row=>row.approver_uid?(row.approver_name||row.approver_email||'ADMIN designado'):'Não definido no registro anterior.';
  function details(row){
    const missing='Não informado no registro anterior.';
    return `${legacy(row)?'<p><span class="status pending">Registro anterior</span></p>':''}<dl class="overtime-details">
      <dt>Quem solicitou</dt><dd>${esc(row.requested_by||missing)}</dd>
      <dt>Responsável pela aprovação</dt><dd>${esc(approverLabel(row))}${row.approver_email?` <span class="field-hint">${esc(row.approver_email)}</span>`:''}</dd>
      <dt>O que foi solicitado</dt><dd>${esc(row.requested_work||missing)}</dd>
      <dt>O que foi realizado</dt><dd>${esc(row.performed_work||(legacy(row)?missing:row.status==='running'?'Será informado ao encerrar o cronômetro.':'Não informado.'))}</dd>
      <dt>Por que foi fora do horário</dt><dd>${esc(row.reason||missing)}</dd>
    </dl>`;
  }
  function occurrence(row,admin=false){
    let actions='';
    if(!admin&&row.can_reassign===true)actions+=`<button class="button secondary small" data-assign-id="${esc(row.id)}">Trocar responsável</button>`;
    if(admin&&row.can_review===true)actions+=`<button class="button secondary small" data-review-id="${esc(row.id)}">Analisar</button>`;
    else if(admin&&row.status==='pending')actions+=`<p class="field-hint">${row.uid===getUser()?.uid?'Sua ocorrência precisa da análise de outro ADMIN.':row.approver_uid?'Análise reservada ao responsável designado.':'A análise depende de outro ADMIN disponível.'}</p>`;
    return `<article class="overtime-item"><div class="overtime-item-heading"><strong>${admin?esc(row.name)+' · ':''}${esc(when(row.start_at))}${row.end_at?' até '+esc(when(row.end_at)):' em andamento'}</strong><span class="status ${row.status==='pending'?'pending':row.status==='rejected'?'blocked':''}">${statusNames[row.status]}</span></div>${details(row)}<p class="field-hint">Duração ${hours(row.minutes)}</p>${row.review_reason?`<p><strong>Justificativa da decisão</strong><br>${esc(row.review_reason)}</p>${row.reviewed_at?`<p class="field-hint">Analisada em ${esc(when(row.reviewed_at))}</p>`:''}`:''}${actions}</article>`;
  }
  function fillApprovers(select,selected=''){
    select.innerHTML='<option value="">Escolha o responsável</option>'+approvers.map(person=>`<option value="${esc(person.uid)}">${esc(person.name||person.email||person.uid)}${person.email?' · '+esc(person.email):''}</option>`).join('');
    select.value=approvers.some(person=>person.uid===selected)?selected:'';
    select.disabled=approvers.length===0;
  }
  async function mutate(action,data){
    const key=action+':'+(data.id||'new'),signature=JSON.stringify(data);
    let pending=mutationKeys.get(key);
    if(!pending||pending.signature!==signature){pending={signature,id:crypto.randomUUID()};mutationKeys.set(key,pending);}
    const result=await api(action,{method:'POST',data:{...data,requestId:pending.id}});
    mutationKeys.delete(key);return result;
  }
  async function mine(){
    const generation=epoch,sequence=++mineSequence;
    try{
      const result=await api('journey',{query:'&month='+$('overtime-month').value});
      if(generation!==epoch||sequence!==mineSequence||!enabled)return;
      serverOffset=Date.parse(result.serverTime)-Date.now();ownRows=result.rows;
      approvers=(result.approvers||[]).filter(person=>person.uid!==getUser()?.uid);
      fillApprovers($('overtime-approver'),$('overtime-approver').value);
      active=ownRows.find(row=>row.status==='running')||null;
      $('activity-select').value=result.presence?.activity||'available';$('my-schedule').textContent=scheduleText(result.schedule);
      $('my-overtime-list').innerHTML=ownRows.length?ownRows.map(row=>occurrence(row)).join(''):'<div class="empty-state">Nenhuma ocorrência neste mês.</div>';
      if(result.truncated)$('my-overtime-list').insertAdjacentHTML('beforeend','<p class="field-hint">Exibindo as 100 ocorrências mais recentes.</p>');
      $('overtime-running').hidden=!active;
      $('overtime-running-info').textContent=active?`Iniciado em ${when(active.start_at)} · Solicitado por ${active.requested_by} · Aprovação: ${approverLabel(active)}`:'';
      mode();tick();
    }catch(error){if(generation===epoch&&sequence===mineSequence)fail(error);}
  }
  async function beat(activity){if(!enabled||pendingHeartbeat)return;pendingHeartbeat=true;const generation=epoch;try{const result=await api('presence',{method:'POST',data:activity?{activity}:{}});if(generation!==epoch||!enabled)return;$('activity-feedback').textContent=`Status informado: ${activityNames[result.activity]}.`;if(activity)$('activity-select').value=result.activity;}catch(error){if(activity)fail(error);}finally{pendingHeartbeat=false;}}
  function mode(){
    const manual=$('overtime-mode').value==='manual';$('overtime-period').hidden=!manual;$('overtime-overnight').hidden=!manual;
    for(const id of ['overtime-date','overtime-start','overtime-end'])$(id).required=manual;
    $('overtime-performed-field').hidden=!manual;$('overtime-performed-work').required=manual;$('overtime-performed-work').disabled=!manual;
    $('overtime-eligibility').textContent=approvers.length?'Escolha um ADMIN diferente de você. Só o responsável designado poderá analisar esta ocorrência.':'Nenhum ADMIN elegível está disponível. Um responsável com acesso administrativo ativo precisa ser configurado antes do envio.';
    $('overtime-save').textContent=manual?'Registrar período':'Iniciar cronômetro';$('overtime-save').disabled=!approvers.length||(!manual&&Boolean(active));
  }
  async function team(){const generation=epoch;try{const result=await api('admin-team',{query:`&month=${$('team-month').value}&q=${encodeURIComponent($('team-search').value)}&offset=${teamOffset}`});if(generation!==epoch||!enabled)return;people=result.users;teamNext=result.nextOffset;$('team-updated').textContent=`Atualizado às ${new Intl.DateTimeFormat('pt-BR',{timeStyle:'medium',timeZone:'America/Sao_Paulo'}).format(new Date(result.serverTime))}. Atualização a cada 30 segundos.`;
    const sums=people.reduce((a,p)=>({late:a.late+p.metrics.lateMinutes,extra:a.extra+p.metrics.extraMinutes,approved:a.approved+(p.overtime.find(r=>r.status==='approved')?.minutes||0),holiday:a.holiday+(p.metrics.holidayWorkedMinutes||0),offSchedule:a.offSchedule+(p.metrics.offScheduleWorkedMinutes||0),weekend:a.weekend+(p.metrics.weekendOffScheduleWorkedMinutes||0)}),{late:0,extra:0,approved:0,holiday:0,offSchedule:0,weekend:0});
    $('team-metrics').innerHTML=[['Colaboradores online',String(people.filter(p=>p.online).length)],['Atrasos no mês',hours(sums.late)],['Acima da jornada',hours(sums.extra)],['Horas extras aprovadas',hours(sums.approved)],['Trabalhadas em feriados',hours(sums.holiday)],['Trabalhadas fora da escala',hours(sums.offSchedule)],['FDS fora da escala',hours(sums.weekend)]].map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('');
    $('team-list').innerHTML=people.length?`<div class="table-scroll"><table class="records-table team-table"><thead><tr><th>Colaborador</th><th>Atividade / conexão</th><th>Ponto de hoje</th><th>Horas no mês</th><th>Atraso</th><th>Acima da jornada</th><th>Jornada</th></tr></thead><tbody>${people.map(p=>`<tr><td><strong>${esc(p.name)}</strong><span class="admin-email">${esc(p.email)}</span>${p.status!=='active'?`<span class="field-hint">${p.status==='pending'?'Acesso pendente':'Acesso bloqueado'}</span>`:''}</td><td><strong>${esc(p.activityLabel)}</strong><span class="presence-state ${p.online?'connected':''}">${p.online?'Online':'Sem conexão recente'}</span>${p.lastSeen?`<small class="admin-email">Último contato ${esc(when(p.lastSeen))}</small>`:''}</td><td>${p.today?esc(p.today.times.join(' | ')||'Sem marcação'):'Sem marcação'}${calendarBadge(p.today?{...p.todayContext,...p.today}:p.todayContext)}${p.today?.incomplete?'<span class="status pending">Em aberto</span>':''}</td><td>${hours(p.metrics.minutes)}${p.metrics.incomplete?`<span class="admin-email">${p.metrics.incomplete} ${p.metrics.incomplete===1?'dia':'dias'} em aberto</span>`:''}</td><td>${p.metrics.scheduledDays?hours(p.metrics.lateMinutes):'—'}</td><td>${p.metrics.scheduledDays?hours(p.metrics.extraMinutes):'—'}</td><td><span class="admin-email">${p.schedule?esc(p.schedule.start_time+' a '+p.schedule.end_time):'Não configurada'}</span><button class="text-button" data-schedule-uid="${esc(p.uid)}">Configurar</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state">Nenhum colaborador encontrado.</div>';$('team-prev').disabled=teamOffset===0;$('team-next').disabled=teamNext===null;$('team-page').textContent=`Página ${teamOffset/50+1}`;
  }catch(error){fail(error,'team-error');}}
  async function reviews(){const generation=epoch;try{const result=await api('admin-overtime',{query:`&month=${$('team-month').value}&status=${$('review-status').value}&offset=${reviewOffset}`});if(generation!==epoch||!enabled)return;requests=result.rows;reviewNext=result.nextOffset;$('review-list').innerHTML=requests.length?requests.map(r=>occurrence(r,true)).join(''):'<div class="empty-state">Nenhuma ocorrência para analisar neste período.</div>';$('review-prev').disabled=reviewOffset===0;$('review-next').disabled=reviewNext===null;$('review-page').textContent=`Página ${reviewOffset/50+1}`;}catch(error){fail(error,'team-error');}}
  function editSchedule(uid){selected=people.find(p=>p.uid===uid);if(!selected)return;$('schedule-form').reset();$('schedule-person').textContent=selected.name;$('schedule-date').value=today();$('schedule-date').max=today();const s=selected.schedule;$('schedule-start').value=s?.start_time||'09:00';$('schedule-end').value=s?.end_time||'16:00';$('schedule-break').value=s?.break_minutes||0;$('schedule-tolerance').value=s?.tolerance_minutes||0;for(const input of $('schedule-form').querySelectorAll('[name=weekday]'))input.checked=(s?JSON.parse(s.weekdays):[1,2,3,4,5]).includes(Number(input.value));$('schedule-dialog').showModal();}
  $('activity-select').onchange=()=>beat($('activity-select').value);$('overtime-mode').onchange=mode;$('overtime-month').onchange=mine;
  $('overtime-form').onsubmit=async event=>{
    event.preventDefault();$('journey-error').hidden=true;
    if(!approvers.length){fail(new Error('Não há ADMIN elegível para analisar a ocorrência.'));mode();return;}
    const manual=$('overtime-mode').value==='manual';
    const data={reason:$('overtime-reason').value,requestedBy:$('overtime-requester').value,requestedWork:$('overtime-requested-work').value,approverUid:$('overtime-approver').value};
    if(manual)Object.assign(data,{date:$('overtime-date').value,start:$('overtime-start').value,end:$('overtime-end').value,performedWork:$('overtime-performed-work').value});
    try{
      await busy($('overtime-save'),()=>mutate(manual?'overtime-register':'overtime-start',data));
      if(manual)$('overtime-month').value=data.date.slice(0,7);
      $('overtime-form').reset();$('overtime-date').value=today();
      toast(manual?'Ocorrência enviada ao responsável escolhido.':'Cronômetro iniciado. Informe a entrega ao encerrar.');await mine();
    }catch(error){fail(error);mode();}
  };
  async function stopRecord(row,performedWork,button){
    const data={id:row.id,version:row.version};if(!legacy(row))data.performedWork=performedWork;
    await busy(button,()=>mutate('overtime-stop',data));
    $('overtime-stop-dialog').close();closingRecord=null;
    $('overtime-month').value=row.work_date.slice(0,7);
    toast('Período encerrado e enviado para análise.');await mine();
  }
  $('overtime-stop').onclick=async()=>{
    if(!active)return;
    if(legacy(active)){try{await stopRecord(active,undefined,$('overtime-stop'));}catch(error){fail(error);}return;}
    closingRecord={...active};$('overtime-stop-form').reset();$('stop-error').hidden=true;
    $('overtime-stop-summary').textContent=`Solicitado: ${active.requested_work} · Aprovação: ${approverLabel(active)}`;
    $('overtime-stop-dialog').showModal();
  };
  $('stop-cancel').onclick=()=>{$('overtime-stop-dialog').close();closingRecord=null;};
  $('overtime-stop-form').onsubmit=async event=>{event.preventDefault();if(!closingRecord)return;$('stop-error').hidden=true;try{await stopRecord(closingRecord,$('stop-performed-work').value,$('stop-save'));}catch(error){fail(error,'stop-error');}};
  function assignmentMode(){$('assign-save').disabled=!approvers.length||!$('assign-approver').value||$('assign-approver').value===assigningRecord?.approver_uid;}
  $('my-overtime-list').onclick=event=>{
    const button=event.target.closest('[data-assign-id]');if(!button)return;
    assigningRecord=ownRows.find(row=>row.id===button.dataset.assignId&&row.can_reassign===true);if(!assigningRecord)return;
    $('overtime-assign-form').reset();$('assign-error').hidden=true;
    $('overtime-assign-person').textContent=`${when(assigningRecord.start_at)} · Responsável atual: ${approverLabel(assigningRecord)}`;
    fillApprovers($('assign-approver'),assigningRecord.approver_uid);
    $('assign-hint').textContent=approvers.length?'O novo responsável passa a analisar esta ocorrência e precisa ser um ADMIN diferente de você.':'Não há outro ADMIN elegível. Peça a configuração de um responsável antes de trocar.';
    assignmentMode();$('overtime-assign-dialog').showModal();
  };
  $('assign-approver').onchange=assignmentMode;
  $('assign-cancel').onclick=()=>{$('overtime-assign-dialog').close();assigningRecord=null;};
  $('overtime-assign-form').onsubmit=async event=>{
    event.preventDefault();if(!assigningRecord)return;$('assign-error').hidden=true;
    try{await busy($('assign-save'),()=>mutate('overtime-assign',{id:assigningRecord.id,version:assigningRecord.version,approverUid:$('assign-approver').value}));$('overtime-assign-dialog').close();assigningRecord=null;toast('Responsável atualizado.');await mine();}
    catch(error){fail(error,'assign-error');assignmentMode();}
  };
  $('team-filter').onsubmit=event=>{event.preventDefault();teamOffset=reviewOffset=0;$('team-error').hidden=true;team();reviews();};$('team-list').onclick=event=>{const button=event.target.closest('[data-schedule-uid]');if(button)editSchedule(button.dataset.scheduleUid);};
  $('team-prev').onclick=()=>{teamOffset=Math.max(0,teamOffset-50);team();};$('team-next').onclick=()=>{if(teamNext!==null){teamOffset=teamNext;team();}};
  $('review-status').onchange=()=>{reviewOffset=0;reviews();};$('review-prev').onclick=()=>{reviewOffset=Math.max(0,reviewOffset-50);reviews();};$('review-next').onclick=()=>{if(reviewNext!==null){reviewOffset=reviewNext;reviews();}};
  $('schedule-cancel').onclick=()=>$('schedule-dialog').close();$('review-cancel').onclick=()=>$('review-dialog').close();
  $('schedule-form').onsubmit=async event=>{event.preventDefault();if(!selected)return;const date=$('schedule-date').value,previous=selected.schedules.find(s=>s.effective_date===date);try{await busy($('schedule-save'),()=>api('admin-schedule',{method:'POST',data:{uid:selected.uid,version:previous?.version||0,effectiveDate:date,start:$('schedule-start').value,end:$('schedule-end').value,breakMinutes:Number($('schedule-break').value),toleranceMinutes:Number($('schedule-tolerance').value),weekdays:[...$('schedule-form').querySelectorAll('[name=weekday]:checked')].map(input=>Number(input.value)),reason:$('schedule-reason').value}}));$('schedule-dialog').close();toast('Jornada configurada.');await team();await mine();}catch(error){toast(error.message,true);}};
  $('review-list').onclick=event=>{const button=event.target.closest('[data-review-id]');if(!button)return;decision=requests.find(row=>row.id===button.dataset.reviewId&&row.can_review===true);if(!decision)return;$('review-form').reset();$('review-error').hidden=true;$('review-person').textContent=`${decision.name} · ${when(decision.start_at)} · ${hours(decision.minutes)}`;$('review-summary').innerHTML=details(decision);$('review-dialog').showModal();};
  $('review-form').onsubmit=async event=>{event.preventDefault();if(!decision)return;$('review-error').hidden=true;try{await busy($('review-save'),()=>mutate('admin-overtime-review',{id:decision.id,version:decision.version,status:$('review-decision').value,reason:$('review-reason').value}));$('review-dialog').close();decision=null;toast('Análise registrada.');await reviews();await team();await mine();}catch(error){fail(error,'review-error');}};
  const teamVisible=()=>enabled&&getUser()?.role==='admin'&&!$('view-admin').hidden&&!teamHost.hidden;
  async function openAdmin(){if(!teamVisible())return;if(!$('team-month').value)$('team-month').value=currentMonth();$('team-error').hidden=true;await Promise.all([team(),reviews()]);}
  document.addEventListener('ponto:admin-tab',event=>{if(event.detail?.tab==='team')openAdmin();});
  const clock=setInterval(tick,1000);document.addEventListener('visibilitychange',()=>{if(enabled&&!document.hidden){beat();mine();if(teamVisible())openAdmin();}});
  return {async open(){enabled=true;if(!$('overtime-month').value)$('overtime-month').value=currentMonth();$('overtime-date').value=today();$('overtime-date').max=today();await mine();await beat();if(!heartbeat)heartbeat=setInterval(()=>{if(!document.hidden)beat();},60000);if(!refresh)refresh=setInterval(()=>{if(!document.hidden&&teamVisible())openAdmin();},30000);},openAdmin,reset(){enabled=false;epoch++;active=null;ownRows=[];approvers=[];people=[];requests=[];selected=decision=closingRecord=assigningRecord=null;mutationKeys.clear();clearInterval(heartbeat);clearInterval(refresh);heartbeat=refresh=null;teamOffset=reviewOffset=0;for(const id of ['schedule-dialog','review-dialog','overtime-stop-dialog','overtime-assign-dialog'])$(id).close();for(const id of ['overtime-form','overtime-stop-form','overtime-assign-form','review-form'])$(id).reset();for(const id of ['team-list','review-list','my-overtime-list','team-metrics','review-summary'])$(id).innerHTML='';for(const id of ['journey-error','team-error','stop-error','assign-error','review-error'])$(id).hidden=true;fillApprovers($('overtime-approver'));mode();}};
}
