import {createAdmin} from './admin.js?v=journey-2';
import {createJourney} from './journey.js?v=journey-2';
import {exchangeFirebaseLogin,restoreFirebaseLogin} from './persistent-login.mjs?v=auth-1';
import {apiBase,demoHref} from './connection.js?v=journey-2';
const isDemo=document.body.dataset.mode==='demo';
const demoClient=isDemo?await import('./demo-api.mjs?v=journey-2'):null;
const externalAPI=Boolean(apiBase&&new URL(apiBase).origin!==location.origin);
let apiSessionToken=null;
const apiURL=path=>new URL(path,apiBase||document.baseURI).href;
function apiOptions(options={}){
  const headers={...options.headers};
  if(externalAPI){headers['X-Ponto-Client']='web';if(apiSessionToken)headers.Authorization=`Bearer ${apiSessionToken}`;}
  return {...options,headers,credentials:externalAPI?'omit':'same-origin',...(externalAPI?{redirect:'error'}:{})};
}
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const bootContent = $('#boot').innerHTML;
const state = { session: null, clockOffset: 0, timezone: 'America/Sao_Paulo', view: 'registro', month: '', historyStatus: '', today: null, preview: null, file: null, auth: null, authModule: null, authPromise: null, restorePromise: null, signingOut: false, authMode: 'login', authenticating: false, punchRequest: null };
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
async function api(action, {method='GET',data=null,query='',retried=false}={}) {
  if(demoClient){
    const result=await demoClient.demoApi(action,{method,data,query});
    if(result.csrf&&state.session)state.session.csrf=result.csrf;
    syncTime(result.serverTime);return result;
  }
  const requestCsrf=state.session?.csrf;
  const options = {method,credentials:'same-origin',headers:{}};
  if (method !== 'GET') options.headers['X-CSRF-Token'] = state.session.csrf;
  if (data instanceof FormData) options.body=data;
  else if (data !== null) { options.headers['Content-Type']='application/json'; options.body=JSON.stringify(data); }
  const response = await fetch(apiURL(`api.php?action=${encodeURIComponent(action)}${query}`),apiOptions(options));
  let result; try { result = await response.json(); } catch { throw new Error('O servidor não respondeu corretamente. Tente novamente.'); }
  if (!response.ok) {
    let error = new Error(result.error || 'Não foi possível concluir a ação.'); error.status=response.status; error.code=result.code;
    if(response.status===401&&state.session?.user&&!['login','session','logout'].includes(action)){
      try{if(!retried&&!state.signingOut&&(state.session.csrf!==requestCsrf||await restoreSession()))return api(action,{method,data,query,retried:true});}
      catch(restoreError){error=restoreError;}
      apiSessionToken=null; state.session.user=null; showLogin();
    }
    throw error;
  }
  if (result.csrf && state.session) state.session.csrf=result.csrf;
  if(action==='login'&&externalAPI&&result.sessionToken)apiSessionToken=result.sessionToken;
  syncTime(result.serverTime); return result;
}
async function busy(button, work, label='Aguarde…') {
  const html = button.innerHTML; button.disabled=true; button.textContent=label;
  try { return await work(); } finally { button.innerHTML=html; button.disabled=false; }
}
async function bootstrap() {
  $('#boot').innerHTML=bootContent;
  try {
    if(isDemo){
      await api('demo',{method:'POST'});
      for(const button of [$('#logout'),$('#mobile-logout')]){button.setAttribute('aria-label','Voltar ao login');button.title='Voltar ao login';}
      $('.sidebar-note strong').textContent='Modo de demonstração.';
      $('.sidebar-note p').textContent='Explore com dados de exemplo. Ao atualizar, as marcações de teste são descartadas.';
      $('#punch-confirm > p').textContent='Esta é uma marcação de teste e será descartada ao atualizar a página.';
    }
    state.session=await api('session'); state.timezone=state.session.timezone; syncTime(state.session.serverTime);
    if(!isDemo&&state.session.firebaseReady){
      const [auth]=await firebaseAuth();
      if(state.session.user&&auth.currentUser?.uid!==state.session.user.uid){
        await api('logout',{method:'POST',data:{}}); apiSessionToken=null; state.session=await api('session');
      }
      if(!state.session.user)await restoreSession();
    }
    $('#boot').hidden=true;
    if (state.session.user) await showApp(); else showLogin();
  } catch (error) {
    if([401,403].includes(error.status)||error.code?.startsWith('auth/')){
      showLogin(); $('#login-error').textContent=authError(error); $('#login-error').hidden=false;
    }else{
      $('#app').hidden=true; $('#login').hidden=true; $('#boot').hidden=false;
      $('#boot').innerHTML=`<p>${esc(error.message)}</p><button class="button secondary" id="retry-boot">Tentar novamente</button>`; $('#retry-boot').onclick=bootstrap;
    }
  }
}
function showLogin() {
  journey.reset();
  admin.reset();
  $('#app').hidden=true; $('#login').hidden=false; $('#boot').hidden=true;
  const ready=state.session.firebaseReady;
  $('#demo-access').hidden=!state.session.demoAllowed;
  $('#setup-note').hidden=ready;
  $('#setup-note').textContent=state.session.demoAllowed ? 'O login da empresa está sendo configurado. Você pode abrir a demonstração com dados de teste.' : 'O login da empresa ainda não foi configurado. Entre em contato com o responsável pelo site.';
  for(const id of ['email','password','login-submit','reset-password','google-login','register-toggle']) $(`#${id}`).disabled=!ready;
  $('#confirm-password').disabled=!ready||state.authMode!=='register';
}
async function showApp() {
  $('#login').hidden=true; $('#app').hidden=false; $('#login-error').hidden=true;
  const user=state.session.user; const firstName=user.name.split(' ')[0];
  $('#user-name').textContent=user.name; $('#avatar').textContent=firstName.slice(0,1).toUpperCase(); $('#small-avatar').textContent=$('#avatar').textContent;
  $('#user-role').textContent=user.demo ? 'Dados de exemplo' : user.role==='admin'?'Administrador':'Funcionário';
  $('#admin-nav').hidden=user.role!=='admin';
  $('#demo-banner').hidden=!user.demo; $('#mode-badge').hidden=!user.demo;
  $('#footer-zone').textContent=state.timezone;
  $('.timezone-pill').textContent=state.timezone==='America/Sao_Paulo' ? 'Horário de Brasília' : state.timezone;
  state.month=currentMonth(); $('#history-month').value=state.month; $('#import-year').value=currentParts().year;
  const view=location.hash.replace('#',''); switchView(['registro','espelho','importar','jornada',...(user.role==='admin'?['admin']:[])].includes(view) ? view : 'registro', false);
  updateClock(); await loadHome(); await journey.open(); if(state.view==='espelho') await loadHistory(); if(state.view==='admin'){await admin.open();await journey.openAdmin();}
}
async function firebaseAuth() {
  if (state.auth) return [state.auth,state.authModule];
  if(!state.authPromise) state.authPromise=(async()=>{
    const [appModule,authModule] = await Promise.all([import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')]);
    const app=appModule.getApps()[0]||appModule.initializeApp(state.session.firebase),auth=authModule.getAuth(app);
    auth.languageCode='pt-BR';
    await auth.authStateReady();
    await authModule.setPersistence(auth,authModule.browserLocalPersistence);
    state.auth=auth; state.authModule=authModule; return [auth,authModule];
  })().catch(error=>{state.authPromise=null;throw error;});
  return state.authPromise;
}
function loginExchange(){
  return {exchange:idToken=>api('login',{method:'POST',data:{idToken}}),signOut:()=>state.authModule.signOut(state.auth)};
}
async function restoreSession(){
  if(state.signingOut)return false;
  if(!state.restorePromise)state.restorePromise=(async()=>{
    const [auth]=await firebaseAuth();
    if(!await restoreFirebaseLogin(auth,loginExchange()))return false;
    state.session=await api('session');
    return Boolean(state.session.user);
  })().finally(()=>{state.restorePromise=null;});
  return state.restorePromise;
}
function authError(error) {
  return ({'auth/invalid-credential':'E-mail ou senha incorretos.','auth/user-disabled':'Sua conta foi desativada. Fale com a empresa.','auth/too-many-requests':'Muitas tentativas. Aguarde alguns minutos.','auth/network-request-failed':'Confira sua conexão e tente novamente.','auth/invalid-email':'Digite um e-mail válido.','auth/unauthorized-domain':'O domínio do site precisa ser autorizado no Firebase.','auth/email-already-in-use':'Este e-mail já tem uma conta. Entre com sua senha ou use o Google.','auth/weak-password':'Use uma senha mais forte, com pelo menos 6 caracteres e de acordo com as regras da empresa.','auth/password-does-not-meet-requirements':'A senha não atende às regras de segurança da empresa.','auth/popup-blocked':'Permita a abertura de janelas para este site e tente entrar com Google novamente.','auth/popup-closed-by-user':'O login com Google foi cancelado. Você pode tentar novamente.','auth/cancelled-popup-request':'Já existe uma janela de login aberta. Conclua o acesso nela.','auth/operation-not-allowed':'Este método de login precisa ser ativado no Firebase.','auth/account-exists-with-different-credential':'Este e-mail já usa outro método de acesso. Entre com o método que você usou no cadastro.'})[error.code] || error.message || 'Não foi possível concluir o acesso.';
}
function clearAuthMessages(){ $('#login-error').hidden=true; $('#auth-message').hidden=true; }
function setAuthMode(mode,clearMessages=true){
  state.authMode=mode; const register=mode==='register';
  if(clearMessages) clearAuthMessages();
  $('#auth-eyebrow').textContent=register?'PRIMEIRO ACESSO':'BEM-VINDO';
  $('#auth-title').textContent=register?'Crie sua conta':'Entre na sua conta';
  $('#auth-description').textContent=register?'Cadastre seu e-mail para solicitar acesso ao ponto.':'Use seu e-mail ou entre com sua conta Google.';
  $('#confirm-password-field').hidden=!register; $('#confirm-password').disabled=!register||!state.session.firebaseReady; $('#confirm-password').required=register;
  $('#register-note').hidden=!register; $('#reset-password').hidden=register;
  $('#password').autocomplete=register?'new-password':'current-password';
  if(register) $('#password').minLength=6; else $('#password').removeAttribute('minlength');
  $('#password').value=''; $('#password').type='password'; $('#confirm-password').value=''; $('#confirm-password').setCustomValidity('');
  $('#toggle-password').setAttribute('aria-label','Mostrar senha');
  $('#login-submit').textContent=register?'Criar conta':'Entrar';
  $('#auth-switch-label').textContent=register?'Já tem uma conta?':'Primeiro acesso?';
  $('#register-toggle').textContent=register?'Entrar na minha conta':'Criar conta';
}
async function authenticationWork(button,work,label){
  if(state.authenticating)return;
  state.authenticating=true; clearAuthMessages();
  const controls=['login-submit','google-login','register-toggle','reset-password'];
  controls.forEach(id=>$(`#${id}`).disabled=true);
  try{return await busy(button,work,label);}
  finally{state.authenticating=false; controls.forEach(id=>$(`#${id}`).disabled=!state.session.firebaseReady);$('#login-submit').textContent=state.authMode==='register'?'Criar conta':'Entrar';}
}
async function finishLogin(credential,created=false){
  try{
    await exchangeFirebaseLogin(credential.user,loginExchange());
  }catch(error){
    if(error.code!=='ACCOUNT_PENDING_APPROVAL')throw error;
    $('#email').value=credential.user.email||$('#email').value;
    setAuthMode('login',false);
    $('#auth-message').textContent=created?'Conta criada! Aguarde a autorização da empresa para registrar seu ponto.':'Sua conta foi identificada. Aguarde a autorização da empresa para registrar seu ponto.';
    $('#auth-message').hidden=false; return;
  }
  $('#password').value=''; $('#confirm-password').value=''; state.session=await api('session'); await showApp();
}
$('#login-form').addEventListener('submit',async event=>{
  event.preventDefault(); const register=state.authMode==='register';
  if(register&&$('#password').value!==$('#confirm-password').value){$('#confirm-password').setCustomValidity('As senhas precisam ser iguais.');$('#confirm-password').reportValidity();return;}
  const email=$('#email').value.trim(),password=$('#password').value;
  try { await authenticationWork($('#login-submit'),async()=>{
    const [auth,mod]=await firebaseAuth();
    const credential=await (register?mod.createUserWithEmailAndPassword(auth,email,password):mod.signInWithEmailAndPassword(auth,email,password));
    await finishLogin(credential,register);
  },register?'Criando conta…':'Entrando…'); } catch(error) { $('#login-error').textContent=authError(error); $('#login-error').hidden=false; }
});
$('#register-toggle').onclick=()=>{if(state.authenticating)return;setAuthMode(state.authMode==='register'?'login':'register');$('#email').focus();};
$('#confirm-password').addEventListener('input',()=>$('#confirm-password').setCustomValidity(''));
$('#password').addEventListener('input',()=>$('#confirm-password').setCustomValidity(''));
$('#google-login').onclick=async()=>{
  try {await authenticationWork($('#google-login'),async()=>{
    const [auth,mod]=await firebaseAuth(),provider=new mod.GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    await finishLogin(await mod.signInWithPopup(auth,provider));
  },'Abrindo Google…');}catch(error){$('#login-error').textContent=authError(error);$('#login-error').hidden=false;}
};
$('#demo-login').onclick=()=>{location.href=demoHref;};
$('#toggle-password').onclick=()=>{const input=$('#password'); input.type=input.type==='password'?'text':'password'; $('#toggle-password').setAttribute('aria-label',input.type==='password'?'Mostrar senha':'Ocultar senha');};
$('#reset-password').onclick=async()=>{
  if (!$('#email').validity.valid || !$('#email').value) { $('#email').focus(); toast('Informe seu e-mail para recuperar a senha.',true); return; }
  try { await authenticationWork($('#reset-password'),async()=>{ const [auth,mod]=await firebaseAuth(); await mod.sendPasswordResetEmail(auth,$('#email').value.trim()); toast('Se o e-mail estiver cadastrado, você receberá as instruções.'); },'Enviando…'); } catch(error){toast(authError(error),true);}
};
async function logout(){
  if(isDemo){location.href=new URL('./',document.baseURI).href;return;}
  if(state.signingOut)return;
  state.signingOut=true;
  try{
    await state.restorePromise?.catch(()=>{});
    // Always clear the saved Firebase identity, even if the API is unavailable.
    try{await api('logout',{method:'POST',data:{}});}catch(error){if(error.status!==401)toast(error.message,true);}
    if(state.auth)await state.authModule.signOut(state.auth);
    apiSessionToken=null; admin.reset(); state.preview=null; state.punchRequest=null; state.session.user=null;
    $('#preview-panel').hidden=true; state.session=await api('session').catch(()=>state.session); setAuthMode('login'); showLogin();
  }catch(error){toast(authError(error),true);}
  finally{state.signingOut=false;}
}
$('#logout').onclick=logout; $('#mobile-logout').onclick=logout;
function switchView(view, load=true) {
  if(view==='admin'&&state.session?.user?.role!=='admin')view='registro';
  state.view=view; const names={registro:'Meu ponto',espelho:'Espelho de ponto',importar:'Importar planilha',jornada:'Status e horas extras',admin:'Administração'};
  for(const el of $$('.view')) el.hidden=el.id!==`view-${view}`;
  for(const btn of $$('[data-view]')) { const active=btn.dataset.view===view; btn.classList.toggle('active',active); if(active)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current'); }
  $('#breadcrumb-view').textContent=names[view]; history.replaceState(null,'',`#${view}`);
  if(load)window.scrollTo({top:0,behavior:'instant'});
  if(load && view==='espelho') loadHistory(); if(load && view==='registro' && state.session?.user) loadHome(); if(load && view==='jornada')journey.open(); if(load && view==='admin'){admin.open();journey.openAdmin();}
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
function recordsTable(rows,{preview=false,filtered=false}={}) {
  if(!rows.length) return `<div class="empty-state">${icon('calendar')}<strong>${filtered?'Nenhum registro nesta situação.':'Nenhum registro por aqui.'}</strong><span>${filtered?'Escolha outra situação ou outro mês para consultar.':preview?'Não há células válidas para importar.':'Registre seu ponto ou importe seu histórico do Excel.'}</span></div>`;
  const header=preview ? ['Data','Marcações / ocorrência','Horas','Importação'] : ['Data','Marcações','Horas','Situação','Origem'];
  const body=rows.map(row=>{
    const weekday=new Intl.DateTimeFormat('pt-BR',{weekday:'short',timeZone:state.timezone}).format(dateObject(row.date)).replace('.','');
    const times=row.times.length ? row.times.map(t=>esc(t.slice(0,5))).join('<span class="time-separator">|</span>') : (preview?esc(row.raw):'—');
    const pending=row.times.length%2===1; const status=`<span class="status ${pending?'pending':esc(row.status)}">${pending?'Em aberto':esc(row.label)}</span>`;
    const source={import:'Planilha',live:'Site',demo:'Exemplo',admin:'Ajuste ADMIN'}[row.source] || 'Planilha';
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
  $('#history-summary').textContent='';
  try { const result=await api('records',{query:historyQuery()}); if(sequence!==state.historySequence)return;
    $('#history-table').innerHTML=recordsTable(result.rows,{filtered:Boolean(state.historyStatus)}); $('#history-summary').textContent=`${result.rows.length} ${result.rows.length===1?'dia':'dias'} · ${hours(result.summary.minutes)}`;
  }catch(error){if(sequence===state.historySequence){$('#history-table').innerHTML='<div class="empty-state">Não foi possível carregar os registros.</div>';showDataError(error.message);}}
}
function historyQuery(){return `&month=${encodeURIComponent(state.month)}${state.historyStatus?`&status=${encodeURIComponent(state.historyStatus)}`:''}`;}
function moveMonth(amount) {const [y,m]=state.month.split('-').map(Number);const date=new Date(Date.UTC(y,m-1+amount,1));state.month=date.toISOString().slice(0,7);$('#history-month').value=state.month;loadHistory();}
$('#history-month').onchange=()=>{if(!$('#history-month').value)return;state.month=$('#history-month').value;loadHistory();};
const historyStatusSelect=$('#history-status');
if(historyStatusSelect)historyStatusSelect.onchange=()=>{state.historyStatus=historyStatusSelect.value;loadHistory();};
$('#prev-month').onclick=()=>moveMonth(-1); $('#next-month').onclick=()=>moveMonth(1);
$('#export').onclick=()=>download(`api.php?action=export${historyQuery()}`);
$('#template').onclick=()=>download('api.php?action=template');
async function download(url) {
  if(demoClient){try{await demoClient.demoDownload(url);}catch(error){toast(error.message,true);}return;}
  try { const response=await fetch(apiURL(url),apiOptions()); if(!response.ok){const result=await response.json();throw new Error(result.error || 'Não foi possível baixar o arquivo.');}
    const blob=await response.blob();const href=URL.createObjectURL(blob); const link=document.createElement('a');link.href=href;
    link.download=response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'ponto.csv';link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
  }catch(error){toast(error.message,true);}
}
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
const admin=createAdmin({api,busy,toast,formatDate,hours,currentMonth,currentParts,onCorrection:()=>loadHome()});
const journey=createJourney({api,busy,toast,hours,currentMonth,currentParts,getUser:()=>state.session?.user});
bootstrap();
