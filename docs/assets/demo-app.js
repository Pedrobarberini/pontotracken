import {demoApi,demoDownload} from './demo-api.mjs';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const bootContent = $('#boot').innerHTML;
const state = { session: null, clockOffset: 0, timezone: 'America/Sao_Paulo', view: 'registro', month: '', today: null, preview: null, file: null, auth: null, authModule: null, punchRequest: null };
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icon = name => `<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#${name}"/></svg>`;
const dateObject = date => new Date(`${date}T12:00:00Z`);
const formatDate = date => new Intl.DateTimeFormat('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',timeZone:state.timezone}).format(dateObject(date));
const hours = minutes => `${Math.floor(minutes/60).toString().padStart(2,'0')}h ${(minutes%60).toString().padStart(2,'0')}m`;
const monthLabel = month => new Intl.DateTimeFormat('pt-BR', {month:'long',year:'numeric',timeZone:state.timezone}).format(dateObject(month+'-01'));
function currentParts() {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {year:'numeric',month:'2-digit',day:'2-digit',timeZone:state.timezone}).formatToParts(new Date(Date.now()+state.clockOffset)).map(p=>[p.type,p.value]));
}
function currentMonth() { const p = currentParts(); return `${p.year}-${p.month}`; }
function syncTime(serverTime) { if (serverTime) state.clockOffset = new Date(serverTime).getTime()-Date.now(); }
function toast(message, error = false) {
  clearTimeout(state.toastTimer); const el = $('#toast'); el.textContent = message; el.classList.toggle('error',error); el.hidden=false;
  state.toastTimer = setTimeout(()=>el.hidden=true,error ? 9000 : 6000);
}
async function api(action, options={}) {
  try {const result=await demoApi(action,options);if(result.csrf&&state.session)state.session.csrf=result.csrf;return result;}
  catch(error){if(error.status===401&&state.session?.user){state.session.user=null;showLogin();}throw error;}
}
async function busy(button, work, label='Aguarde…') {
  const html = button.innerHTML; button.disabled=true; button.textContent=label;
  try { return await work(); } finally { button.innerHTML=html; button.disabled=false; }
}
async function bootstrap() {
  $('#boot').innerHTML=bootContent;
  try {
    // Compatibility for an older cached demo page; new pages use app.js.
    await api('demo',{method:'POST',data:{}});
    state.session=await api('session'); state.timezone=state.session.timezone; syncTime(state.session.serverTime);
    $('#boot').hidden=true;
    if (state.session.user) await showApp(); else showLogin();
  } catch (error) { $('#boot').innerHTML=`<p>${esc(error.message)}</p><button class="button secondary" id="retry-boot">Tentar novamente</button>`; $('#retry-boot').onclick=bootstrap; }
}
function showLogin() {
  $('#app').hidden=true; $('#login').hidden=false; $('#boot').hidden=true;
  const ready=state.session.firebaseReady;
  $('#demo-access').hidden=!state.session.demoAllowed;
  $('#setup-note').hidden=ready;
  $('#setup-note').textContent=state.session.demoAllowed ? 'O login da empresa ainda está sendo configurado. Enquanto isso, você pode conhecer o site pela demonstração de apresentação.' : 'O login da empresa ainda não foi configurado. Entre em contato com o responsável pelo site.';
  for(const id of ['email','password','login-submit','reset-password']) $(`#${id}`).disabled=!ready;
}
async function showApp() {
  $('#login').hidden=true; $('#app').hidden=false; $('#login-error').hidden=true;
  const user=state.session.user; const firstName=user.name.split(' ')[0];
  $('#user-name').textContent=user.name; $('#avatar').textContent=firstName.slice(0,1).toUpperCase(); $('#small-avatar').textContent=$('#avatar').textContent;
  $('#user-role').textContent=user.demo ? 'Dados de exemplo' : 'Funcionário';
  $('#demo-banner').hidden=!user.demo; $('#mode-badge').hidden=!user.demo;
  $('#footer-zone').textContent=state.timezone;
  $('.timezone-pill').textContent=state.timezone==='America/Sao_Paulo' ? 'Horário de Brasília' : state.timezone;
  state.month=currentMonth(); $('#history-month').value=state.month; $('#import-year').value=currentParts().year;
  const view=location.hash.replace('#',''); switchView(['registro','espelho','importar'].includes(view) ? view : 'registro', false);
  updateClock(); await loadHome(); if(state.view==='espelho') await loadHistory();
}
async function firebaseAuth() {
  if (state.auth) return [state.auth,state.authModule];
  const [appModule,authModule] = await Promise.all([import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')]);
  const app=appModule.initializeApp(state.session.firebase); state.auth=authModule.getAuth(app); state.authModule=authModule;
  await authModule.setPersistence(state.auth,authModule.inMemoryPersistence);
  return [state.auth,authModule];
}
function authError(error) {
  return ({'auth/invalid-credential':'E-mail ou senha incorretos.','auth/user-disabled':'Sua conta foi desativada. Fale com a empresa.','auth/too-many-requests':'Muitas tentativas. Aguarde alguns minutos.','auth/network-request-failed':'Confira sua conexão e tente novamente.','auth/invalid-email':'Digite um e-mail válido.','auth/unauthorized-domain':'O domínio do site precisa ser autorizado no Firebase.'})[error.code] || error.message || 'Não foi possível entrar.';
}
$('#login-form').addEventListener('submit',async event=>{
  event.preventDefault(); $('#login-error').hidden=true;
  try { await busy($('#login-submit'),async()=>{
    const [auth,mod]=await firebaseAuth(); const credential=await mod.signInWithEmailAndPassword(auth,$('#email').value.trim(),$('#password').value);
    await api('login',{method:'POST',data:{idToken:await credential.user.getIdToken()}});
    $('#password').value=''; state.session=await api('session'); await showApp();
  },'Entrando…'); } catch(error) { $('#login-error').textContent=authError(error); $('#login-error').hidden=false; }
});
$('#demo-login').onclick=async()=>{ try { await busy($('#demo-login'),async()=>{ await api('demo',{method:'POST',data:{}}); state.session=await api('session'); await showApp(); },'Abrindo…'); } catch(error){toast(error.message,true);} };
$('#toggle-password').onclick=()=>{const input=$('#password'); input.type=input.type==='password'?'text':'password'; $('#toggle-password').setAttribute('aria-label',input.type==='password'?'Mostrar senha':'Ocultar senha');};
$('#reset-password').onclick=async()=>{
  if (!$('#email').validity.valid || !$('#email').value) { $('#email').focus(); toast('Informe seu e-mail para recuperar a senha.',true); return; }
  try { await busy($('#reset-password'),async()=>{ const [auth,mod]=await firebaseAuth(); await mod.sendPasswordResetEmail(auth,$('#email').value.trim()); toast('Se o e-mail estiver cadastrado, você receberá as instruções.'); },'Enviando…'); } catch(error){toast(authError(error),true);}
};
async function logout(){
  try { await api('logout',{method:'POST',data:{}}); if (state.auth) await state.authModule.signOut(state.auth); state.preview=null; state.punchRequest=null; $('#preview-panel').hidden=true; state.session=await api('session'); showLogin(); }
  catch(error){toast(error.message,true);}
}
$('#logout').onclick=logout; $('#mobile-logout').onclick=logout;
function switchView(view, load=true) {
  state.view=view; const names={registro:'Meu ponto',espelho:'Espelho de ponto',importar:'Importar planilha'};
  for(const el of $$('.view')) el.hidden=el.id!==`view-${view}`;
  for(const btn of $$('[data-view]')) { const active=btn.dataset.view===view; btn.classList.toggle('active',active); if(active)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current'); }
  $('#breadcrumb-view').textContent=names[view]; history.replaceState(null,'',`#${view}`);
  if(load && view==='espelho') loadHistory(); if(load && view==='registro' && state.session?.user) loadHome();
}
$$('[data-view]').forEach(btn=>btn.onclick=()=>switchView(btn.dataset.view));
$$('[data-open-import]').forEach(btn=>btn.onclick=()=>switchView('importar'));
$$('[data-open-history]').forEach(btn=>btn.onclick=()=>switchView('espelho'));
function updateClock() {
  if (!state.session?.user) return;
  const now=new Date(Date.now()+state.clockOffset);
  const parts=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZone:state.timezone}).formatToParts(now);
  const get=type=>parts.find(p=>p.type===type).value;
  $('#live-clock').innerHTML=`${get('hour')}:${get('minute')}<span>:${get('second')}</span>`;
  $('#today-date').textContent=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:state.timezone}).format(now);
  $('#header-date').textContent=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric',timeZone:state.timezone}).format(now);
  const p=currentParts(); const day=`${p.year}-${p.month}-${p.day}`;
  if(state.loadedDay && state.loadedDay!==day) { state.loadedDay=day; loadHome(); }
}
function renderToday(day) {
  state.today=day; const times=day?.times || []; const count=times.length; const occurrence=day && day.status!=='recorded';
  const active=count%2===1;
  $('#punch-state').textContent=occurrence ? day.label : count===0 ? 'Jornada não iniciada' : active ? 'Jornada em andamento' : 'Saída registrada';
  $('#punch-hint').textContent=occurrence ? 'Confira a ocorrência no seu espelho.' : count===0 ? 'Tudo pronto para começar seu dia.' : active ? 'Lembre de registrar sua saída.' : 'Uma nova entrada inicia outro período.';
  $('#punch span').textContent=active?'Registrar saída':'Registrar entrada'; $('#punch').disabled=Boolean(occurrence || count>=12);
  $('#today-total').textContent=hours(day?.minutes || 0);
  if(occurrence) { $('#today-timeline').innerHTML=`<p class="timeline-empty">${esc(day.label)}${day.source==='import'?'<br>Ocorrência importada da planilha.':''}</p>`; return; }
  const timeline=times.map((time,i)=>`<div class="timeline-item"><span class="timeline-dot"></span><div><span>${i%2===0?'Entrada':'Saída'}</span><strong>${esc(time.slice(0,5))}</strong></div></div>`);
  if (count===0 || active) timeline.push(`<div class="timeline-item"><span class="timeline-dot empty"></span><div><span class="muted">${active?'Saída pendente':'Entrada ainda não registrada'}</span><strong class="muted">—</strong></div></div>`);
  $('#today-timeline').innerHTML=timeline.join('');
}
function recordsTable(rows,{preview=false}={}) {
  if(!rows.length) return `<div class="empty-state">${icon('calendar')}<strong>Nenhum registro por aqui.</strong><span>${preview?'Não há células válidas para importar.':'Registre seu ponto ou importe seu histórico do Excel.'}</span></div>`;
  const header=preview ? ['Data','Marcações / ocorrência','Horas','Importação'] : ['Data','Marcações','Horas','Situação','Origem'];
  const body=rows.map(row=>{
    const weekday=new Intl.DateTimeFormat('pt-BR',{weekday:'short',timeZone:state.timezone}).format(dateObject(row.date)).replace('.','');
    const times=row.times.length ? row.times.map(t=>esc(t.slice(0,5))).join('<span class="time-separator">|</span>') : (preview?esc(row.raw):'—');
    const pending=row.times.length%2===1; const status=`<span class="status ${pending?'pending':esc(row.status)}">${pending?'Em aberto':esc(row.label)}</span>`;
    const source={import:'Planilha',live:'Site',demo:'Exemplo'}[row.source] || 'Planilha';
    return `<tr><td>${esc(formatDate(row.date))}<span class="day-week">${esc(weekday)}</span></td><td class="times">${times}${preview?'':`<span class="mobile-status">${status}</span>`}</td><td class="times">${row.times.length?hours(row.minutes):'—'}</td>${preview ? `<td><span class="status ${row.exists?'existing':''}">${row.exists?'Já existe · preservar':'Novo registro'}</span></td>` : `<td>${status}</td><td><span class="source-label">${source}</span></td>`}</tr>`;
  }).join('');
  return `<div class="table-scroll"><table class="records-table ${preview?'preview-table':'history-table'}"><thead><tr>${header.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
}
async function loadHome() {
  if(!state.session?.user) return;
  $('#data-error').hidden=true; $('#punch').disabled=true;
  try {
    const result=await api('records',{query:`&month=${currentMonth()}`});
    const p=currentParts(); state.loadedDay=`${p.year}-${p.month}-${p.day}`;
    renderToday(result.today); $('#summary-month').textContent=monthLabel(currentMonth());
    $('#stat-days').innerHTML=`${result.summary.days} <small>dias</small>`;
    $('#stat-hours').innerHTML=`${Math.floor(result.summary.minutes/60).toString().padStart(2,'0')}<small>h</small> ${(result.summary.minutes%60).toString().padStart(2,'0')}<small>m</small>`;
    $('#stat-pending').innerHTML=`${result.summary.pending} <small>dias</small>`; $('#stat-medical').innerHTML=`${result.summary.medical} <small>dias</small>`;
    $('#recent-table').innerHTML=recordsTable(result.rows.slice(0,5));
  } catch(error){showDataError(error.message);}
}
function showDataError(message) { $('#data-error span').textContent=message; $('#data-error').hidden=false; }
$('#retry-data').onclick=()=>state.view==='espelho'?loadHistory():loadHome();
$('#punch').onclick=()=>{
  const count=state.today?.times.length || 0; state.nextPunch=count===0?'entry':count%2===1?'exit':'return';
  $('#confirm-title').textContent=count%2===1?'Registrar saída?':'Registrar entrada?'; $('#punch-confirm').showModal();
};
$('#cancel-punch').onclick=()=>$('#punch-confirm').close();
$('#confirm-punch').onclick=async()=>{
  $('#cancel-punch').disabled=true;
  try { await busy($('#confirm-punch'),async()=>{
    if(!state.punchRequest || state.punchRequest.type!==state.nextPunch) state.punchRequest={type:state.nextPunch,requestId:crypto.randomUUID()};
    const result=await api('punch',{method:'POST',data:state.punchRequest}); state.punchRequest=null;
    $('#punch-confirm').close(); renderToday(result.record); toast(`Ponto registrado às ${result.record.times.at(-1).slice(0,5)}.`); await loadHome();
  },'Registrando…'); } catch(error){if(error.status && error.status<500)state.punchRequest=null; $('#punch-confirm').close();toast(error.message,true);await loadHome();}
  finally{$('#cancel-punch').disabled=false;}
};
async function loadHistory() {
  if(!state.session?.user) return; const sequence=(state.historySequence||0)+1; state.historySequence=sequence; $('#data-error').hidden=true;
  $('#history-table').innerHTML='<div class="empty-state">Carregando registros…</div>';
  try { const result=await api('records',{query:`&month=${encodeURIComponent(state.month)}`}); if(sequence!==state.historySequence)return;
    $('#history-table').innerHTML=recordsTable(result.rows); $('#history-summary').textContent=`${result.summary.days} ${result.summary.days===1?'dia':'dias'} com ponto · ${hours(result.summary.minutes)}`;
  }catch(error){if(sequence===state.historySequence){$('#history-table').innerHTML='<div class="empty-state">Não foi possível carregar os registros.</div>';showDataError(error.message);}}
}
function moveMonth(amount) {const [y,m]=state.month.split('-').map(Number);const date=new Date(Date.UTC(y,m-1+amount,1));state.month=date.toISOString().slice(0,7);$('#history-month').value=state.month;loadHistory();}
$('#history-month').onchange=()=>{if(!$('#history-month').value)return;state.month=$('#history-month').value;loadHistory();};
$('#prev-month').onclick=()=>moveMonth(-1); $('#next-month').onclick=()=>moveMonth(1);
$('#export').onclick=()=>download(`api?action=export&month=${encodeURIComponent(state.month)}`);
$('#template').onclick=()=>download('api?action=template');
async function download(url){try{await demoDownload(url);}catch(error){toast(error.message,true);}}
function invalidatePreview(){state.preview=null;$('#preview-panel').hidden=true;}
function setFile(file) {
  invalidatePreview(); state.file=null;
  if(!file){$('#file-label').textContent='Clique para selecionar sua planilha';$('#preview-button').disabled=true;return;}
  if(!/\.(xlsx|xls|csv)$/i.test(file.name)){toast('Selecione um arquivo XLSX, XLS ou CSV.',true);$('#preview-button').disabled=true;return;}
  if(file.size>5*1024*1024){toast('O arquivo deve ter no máximo 5 MB.',true);$('#preview-button').disabled=true;return;}
  state.file=file;$('#file-label').textContent=file.name;$('#preview-button').disabled=false;
}
$('#file-input').onchange=()=>setFile($('#file-input').files[0]); $('#import-year').oninput=invalidatePreview;
$('#dropzone').ondragover=event=>{event.preventDefault();$('#dropzone').classList.add('dragover');};
$('#dropzone').ondragleave=()=>$('#dropzone').classList.remove('dragover');
$('#dropzone').ondrop=event=>{event.preventDefault();$('#dropzone').classList.remove('dragover');setFile(event.dataTransfer.files[0]);};
$('#import-form').onsubmit=async event=>{
  event.preventDefault(); if(!state.file)return;
  invalidatePreview(); try {await busy($('#preview-button'),async()=>{
    const data=new FormData();data.append('file',state.file);data.append('year',$('#import-year').value);
    const result=await api('import-preview',{method:'POST',data});state.preview=result;
    const existing=result.rows.filter(r=>r.exists).length;const newRows=result.rows.length-existing;
    $('#preview-summary').textContent=`${newRows} novos registros · ${existing} existentes serão preservados · ${result.filename}`;
    $('#preview-table').innerHTML=recordsTable(result.rows,{preview:true});$('#commit-button').disabled=newRows===0;
    $('#import-warnings').hidden=!result.warnings.length;
    $('#import-warnings').innerHTML=result.warnings.length ? `<details open><summary>${result.warnings.length} ${result.warnings.length===1?'célula não será importada':'células não serão importadas'}. Confira os avisos.</summary><ul>${result.warnings.map(w=>`<li><strong>${esc(w.cell)}</strong> (${esc(w.value)}): ${esc(w.message)}</li>`).join('')}</ul></details>` : '';
    $('#preview-panel').hidden=false;$('#preview-panel').scrollIntoView({behavior:'smooth',block:'start'});
  },'Lendo planilha…');}catch(error){toast(error.message,true);}
};
$('#commit-button').onclick=async()=>{
  if(!state.preview)return;
  try {await busy($('#commit-button'),async()=>{const newRows=state.preview.rows.filter(row=>!row.exists);const focusRow=newRows.filter(row=>row.times.length).at(-1) || newRows.at(-1);
    const result=await api('import-commit',{method:'POST',data:{id:state.preview.id}});
    if(focusRow){state.month=focusRow.date.slice(0,7);$('#history-month').value=state.month;}
    invalidatePreview();toast(`${result.saved} registros importados. ${result.skipped} existentes preservados.`);await loadHome();switchView('espelho');
  },'Salvando…');}catch(error){toast(error.message,true);}
};
document.addEventListener('visibilitychange',()=>{if(!document.hidden && state.session?.user){loadHome();if(state.view==='espelho')loadHistory();}});
setInterval(updateClock,1000);
bootstrap();
