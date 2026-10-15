import { $, $$, escapeHTML as e } from '../../shared/dom.mjs?v=phases34-1';
import { roleNames } from './presentation.mjs?v=phases34-1';
import { profileView, listView, eventDialog, documentDialog, confirmationDialog } from './views.mjs?v=phases34-1';

export function createPeople({ state, api, download, busy, toast, currentParts, switchView }) {
  let context = null, profile = null, capabilities = {}, selectedUid = '', tab = 'history';
  let rows = [], nextOffset = null, filter = '', archived = false, focusedId = '', people = [], departments = [], listOffset = null, search = '', department = '', incomplete = false;
  let generation = 0, identityEpoch = 0, initializing = null;
  const dateNow = () => { const parts = currentParts(); return `${parts.year}-${parts.month}-${parts.day}`; };
  const dialog = document.createElement('dialog');
  dialog.className = 'confirm-dialog people-dialog';
  dialog.setAttribute('aria-labelledby', 'people-dialog-title');
  dialog.id = 'people-dialog';
  document.body.append(dialog);
  const profileRoot = () => $('#people-profile-content');
  const fail = (root, message) => { root.setAttribute('aria-busy', 'false'); root.innerHTML = `<p class="data-error" role="alert">${e(message)}</p><button class="button secondary" data-people-retry>Tentar novamente</button>`; root.querySelector('[data-people-retry]').onclick = () => open(state.view); };
  const current = (token, view) => token === generation && state.view === view && Boolean(state.session?.user);
  function loading(root, label, tabs = '') {
    root.setAttribute('aria-busy', 'true');
    root.innerHTML = `${tabs}<div class="empty-state" role="status">${e(label)}</div>`;
  }
  function bindTabs() {
    $$('[data-people-tab]').forEach(button=>button.onclick=()=>{tab=button.dataset.peopleTab;focusedId='';run(loadProfile);});
  }
  async function initialize() {
    if (!initializing) {
      const epoch = identityEpoch;
      const pending = api('people-context').then(result => {
        if (epoch !== identityEpoch || !state.session?.user) return null;
        context = result;
        state.peopleContext = context;
        $('#people-nav').hidden = !context.canManagePeople;
        $('#user-role').textContent = `${state.session.user.demo ? 'Demo · ' : ''}${roleNames[context.role] || 'Colaborador'}`;
        $('#management-nav').hidden = !context.canManagePeople;
        return context;
      }).finally(() => { if (initializing === pending) initializing = null; });
      initializing = pending;
    }
    return initializing;
  }
  function reset() {
    generation++; identityEpoch++; initializing = null;
    context = null; profile = null; capabilities = {}; selectedUid = ''; rows = []; tab = 'history';
    people = []; departments = []; nextOffset = listOffset = null; filter = search = department = focusedId = ''; archived = incomplete = false;
    state.peopleContext = null;
    $('#people-nav').hidden = true; $('#management-nav').hidden = true;
    dialog.close(); dialog.innerHTML = '';
    for (const id of ['people-profile-content','people-list-content','people-dashboard-content']) { const root = $(`#${id}`); root.replaceChildren(); root.setAttribute('aria-busy', 'false'); }
  }
  async function open(view) {
    const token = ++generation;
    try {
      if (!context) await initialize();
      if (!context || !current(token, view)) return;
      if (view === 'ficha') { selectedUid = state.session.user.uid; focusedId = ''; await loadProfile(); }
      if (view === 'pessoas') await loadList();
      if (view === 'gestao') await loadDashboard();
    } catch (error) { if (current(token, view)) fail($(view === 'pessoas' ? '#people-list-content' : view === 'gestao' ? '#people-dashboard-content' : '#people-profile-content'), error.message); }
  }
  async function selectPerson(uid, { targetTab = 'history', id = '' } = {}) {
    selectedUid = uid; tab = targetTab; focusedId = id; filter = ''; archived = false;
    switchView('ficha', false);
    window.scrollTo({top:0,behavior:'instant'});
    await loadProfile();
  }
  async function loadList(append = false) {
    const token = ++generation;
    const root = $('#people-list-content'), previousPeople = append ? [...people] : [];
    const query = `&q=${encodeURIComponent(search)}&department=${encodeURIComponent(department)}&incomplete=${incomplete ? 1 : 0}&offset=${append ? listOffset || 0 : 0}`;
    loading(root, 'Carregando colaboradores…');
    try {
      const result = await api('people-list', {query});
      if (!current(token, 'pessoas')) return;
      people = [...previousPeople, ...result.people];
      departments = result.departments; listOffset = result.nextOffset;
      root.innerHTML = listView({people,departments,query:search,department,incomplete,nextOffset:listOffset});
      root.setAttribute('aria-busy', 'false');
    $('#people-list-filter').onsubmit = event => { event.preventDefault(); search = $('#people-search').value.trim(); department = $('#people-department-filter').value; incomplete = $('#people-incomplete-filter').checked; run(loadList); };
    $('#people-incomplete-filter').onchange = event => { incomplete = event.target.checked; search = $('#people-search').value.trim(); department = $('#people-department-filter').value; run(loadList); };
    $$('[data-person]').forEach(button => button.onclick = () => selectPerson(button.dataset.person));
    $('[data-people-list-more]')?.addEventListener('click', () => run(() => loadList(true)));
    } catch (error) { if (current(token, 'pessoas')) fail(root, error.message); }
  }
  async function loadProfile(append = false) {
    const token = ++generation;
    const uid = selectedUid || state.session.user.uid, requestedTab = tab, requestedFilter = filter, requestedArchived = archived, requestedId = focusedId;
    const offset = append ? nextOffset || 0 : 0, previousRows = append ? [...rows] : [], root = profileRoot();
    const tabs = `<div class="people-tabs" role="tablist" aria-label="Ficha do colaborador">${[['history','Histórico'],['data','Dados'],['documents','Documentos']].map(([value,label])=>`<button role="tab" aria-selected="${requestedTab===value}" data-people-tab="${value}">${label}</button>`).join('')}</div>`;
    loading(root, 'Carregando ficha…', tabs);
    bindTabs();
    try {
      const [result, page] = await Promise.all([
        api('people-profile', {query:`&uid=${encodeURIComponent(uid)}`}),
        requestedTab === 'data' ? null : api(requestedTab === 'documents' ? 'people-documents' : 'people-timeline', {query:`&uid=${encodeURIComponent(uid)}&type=${encodeURIComponent(requestedFilter)}&archived=${requestedArchived ? 1 : 0}&offset=${offset}${requestedId ? `&id=${encodeURIComponent(requestedId)}` : ''}`})
      ]);
      if (!current(token, 'ficha')) return;
      profile = result.profile; capabilities = result.capabilities;
      rows = page ? [...previousRows,...page.rows] : []; nextOffset = page?.nextOffset ?? null;
      root.innerHTML = profileView(profile,capabilities,requestedTab,rows,{isSelf:uid===state.session.user.uid,actorUid:state.session.user.uid,today:dateNow(),filter:requestedFilter,archived:requestedArchived,focusedId:requestedId,nextOffset});
      root.setAttribute('aria-busy', 'false');
      bindProfile();
      if (requestedId) {
        const item = $$('[data-people-item]').find(element => element.dataset.peopleItem === requestedId);
        item?.focus({preventScroll:true});
        item?.scrollIntoView({block:'center',behavior:'instant'});
      }
    } catch (error) { if (current(token, 'ficha')) fail(root, error.message); }
  }
  function bindProfile() {
    $('[data-people-back]')?.addEventListener('click',()=>switchView('pessoas'));
    bindTabs();
    $('#people-event-filter')?.addEventListener('change',event=>{filter=event.target.value;focusedId='';run(loadProfile);});
    $('#people-archived')?.addEventListener('change',event=>{archived=event.target.checked;focusedId='';run(loadProfile);});
    $('[data-people-clear-focus]')?.addEventListener('click',()=>{focusedId='';run(loadProfile);});
    $('[data-people-more]')?.addEventListener('click',()=>run(()=>loadProfile(true)));
    $('[data-new-event]')?.addEventListener('click',openEvent);
    $('[data-new-document]')?.addEventListener('click',()=>openDocument());
    $$('[data-file]').forEach(button=>button.onclick=()=>download(`api?action=people-file-download&id=${encodeURIComponent(button.dataset.file)}`));
    $$('[data-event-term]').forEach(button=>button.onclick=()=>run(()=>busy(button,()=>download(`api?action=people-event-term&id=${encodeURIComponent(button.dataset.eventTerm)}`))));
    $$('[data-ack]').forEach(button=>button.onclick=()=>confirmAcknowledgement(button.dataset.ack));
    $$('[data-proof]').forEach(button=>button.onclick=()=>openDocument(button.dataset.proof));
    $$('[data-archive-event]').forEach(button=>button.onclick=()=>archiveItem('event',button.dataset.archiveEvent));
    $$('[data-archive-document]').forEach(button=>button.onclick=()=>archiveItem('document',button.dataset.archiveDocument));
    $('#people-profile-form')?.addEventListener('submit',saveProfile);
    if ($('#people-role-form')) {
      $('#people-managerUid').innerHTML = '<option value="">Sem gestor definido</option>' + (context.managers || []).filter(person=>person.uid!==profile.uid).map(person=>`<option value="${e(person.uid)}" ${person.uid===profile.managerUid ? 'selected' : ''}>${e(person.name)}</option>`).join('');
      $('#people-role-form').onsubmit = saveRole;
    }
  }
  async function saveProfile(event) {
    event.preventDefault();
    await formWork(event.target, '#people-profile-error', async()=>{
      const fields = Object.fromEntries(new FormData(event.target));
      await api('people-profile-save',{method:'POST',data:{...fields,uid:profile.uid,version:profile.version,reason:$('#people-profile-reason').value}});
      toast('Dados da ficha atualizados.'); await loadProfile();
    });
  }
  async function saveRole(event) {
    event.preventDefault();
    await formWork(event.target,'#people-role-error',async()=>{
      await api('people-role-save',{method:'POST',data:{uid:profile.uid,role:$('#people-role').value,roleVersion:profile.roleVersion,managerUid:$('#people-managerUid').value || null,profileVersion:profile.version,reason:$('#people-role-reason').value}});
      context = await api('people-context'); state.peopleContext=context;
      toast('Vínculos e permissões atualizados.'); await loadProfile();
    });
  }
  function openDialog(markup) {
    dialog.innerHTML=markup;
    dialog.querySelectorAll('[data-people-close]').forEach(button=>button.onclick=()=>dialog.close());
    dialog.showModal();
  }
  function enforceRestricted(typeId,visibilityId,ackId) {
    const type=$(typeId), visibility=$(visibilityId), ack=ackId ? $(ackId) : null;
    const update=()=>{
      const medical=type.value==='medical';
      if (medical) {visibility.value='hr';if(ack)ack.value='none';}
      visibility.disabled=medical;
      if(ack)ack.disabled=visibility.value==='hr';
      if(visibility.value==='hr'&&ack)ack.value='none';
    };
    type.addEventListener('change',update);visibility.addEventListener('change',update);update();
  }
  function openEvent() {
    openDialog(eventDialog(dateNow(),capabilities.canReadRestricted));
    if (!capabilities.canReadRestricted) $('#people-event-type option[value="medical"]')?.remove();
    enforceRestricted('#people-event-type','#people-event-visibility','#people-event-ack');
    $('#people-event-form').onsubmit=event=>{event.preventDefault();formWork(event.target,'#people-dialog-error',async()=>{
      const file=$('#people-event-file').files[0], mode=$('#people-event-ack').value;
      if(mode==='proof'&&!file)throw new Error('Selecione um comprovante para este registro.');
      validateFile(file);
      const data={...Object.fromEntries(new FormData(event.target)),uid:profile.uid,visibility:$('#people-event-visibility').value,acknowledgementMode:mode,requestId:crypto.randomUUID()};
      const result=await api('people-event-create',{method:'POST',data});
      let attachmentError='';
      if(file){const form=new FormData();Object.entries({uid:profile.uid,title:data.title,category:mode==='proof'?'proof':data.type==='medical'?'medical':'other',visibility:data.visibility,eventId:result.event?.id||result.record?.id||result.id,requestId:crypto.randomUUID()}).forEach(([key,value])=>form.set(key,value));form.set('file',file);try{await api('people-file-upload',{method:'POST',data:form});}catch(error){attachmentError=error.message;}}
      dialog.close();await loadProfile();toast(attachmentError?`Registro salvo. O anexo não foi enviado: ${attachmentError} Use Anexar comprovante para tentar novamente.`:'Registro adicionado à ficha.',Boolean(attachmentError));
    });};
  }
  function openDocument(eventId='') {
    openDialog(documentDialog(dateNow(),capabilities.canReadRestricted,eventId));
    if (eventId) $('#people-document-visibility').value = rows.find(row=>row.id===eventId)?.visibility || 'shared';
    if(!capabilities.canReadRestricted)$('#people-document-category option[value="medical"]')?.remove();
    if(!eventId)$('#people-document-category option[value="proof"]')?.remove();
    enforceRestricted('#people-document-category','#people-document-visibility');
    $('#people-document-form').onsubmit=event=>{event.preventDefault();formWork(event.target,'#people-dialog-error',async()=>{
      const form=new FormData(event.target);validateFile(form.get('file'));
      form.set('uid',profile.uid);form.set('visibility',$('#people-document-visibility').value);form.set('category',eventId?'proof':$('#people-document-category').value);form.set('requestId',crypto.randomUUID());if(eventId)form.set('eventId',eventId);
      await api('people-file-upload',{method:'POST',data:form});dialog.close();toast('Documento anexado à ficha.');await loadProfile();
    });};
  }
  function confirmAcknowledgement(id) {
    const row=rows.find(item=>item.id===id);
    openDialog(confirmationDialog('Confirmar ciência',row.title,{checkbox:true}));
    $('#people-confirm-form').onsubmit=event=>{event.preventDefault();formWork(event.target,'#people-dialog-error',async()=>{await api('people-event-acknowledge',{method:'POST',data:{id,version:row.version,requestId:crypto.randomUUID()}});dialog.close();toast('Sua ciência foi registrada.');await loadProfile();});};
  }
  function archiveItem(kind,id) {
    const row=rows.find(item=>item.id===id);
    openDialog(confirmationDialog(kind==='event'?'Arquivar registro':'Arquivar documento','O item ficará preservado e poderá ser consultado no filtro de arquivados.',{reason:true}));
    $('#people-confirm-form').onsubmit=event=>{event.preventDefault();formWork(event.target,'#people-dialog-error',async()=>{await api(kind==='event'?'people-event-archive':'people-document-archive',{method:'POST',data:{id,version:row.version,reason:$('#people-confirm-reason').value,requestId:crypto.randomUUID()}});dialog.close();toast('Item arquivado.');await loadProfile();});};
  }
  async function loadDashboard() {
    const token = ++generation, root = $('#people-dashboard-content');
    loading(root, 'Carregando indicadores…');
    try {
    const result=await api('people-dashboard');
    if (!current(token, 'gestao')) return;
    const counts={pendingAcknowledgements:result.pendingAcknowledgements?.count || 0,expiredDocuments:result.expiredDocuments?.count || 0,expiringDocuments:result.expiringDocuments?.count || 0,incompleteProfiles:Number(result.incompleteProfiles || 0)};
    const labels=[['pendingAcknowledgements','Ciências e comprovantes'],['expiredDocuments','Documentos vencidos'],['expiringDocuments','Vencem em até 30 dias'],['incompleteProfiles','Cadastros incompletos']];
    const items=['pendingAcknowledgements','expiredDocuments','expiringDocuments'].flatMap(kind=>(result[kind]?.rows || []).map(item=>({...item,kind})));
    $('#people-dashboard-content').innerHTML=`<div class="page-heading"><div><span class="eyebrow muted">GESTÃO DE PESSOAS</span><h1>Início da gestão<span>.</span></h1><p>O que precisa de atenção na sua equipe hoje.</p></div><button class="button secondary" id="people-dashboard-refresh">Atualizar</button></div><p class="people-scope">${Number(result.activePeople || 0)} colaboradores ativos · ${Number(result.people || 0)} fichas no seu escopo</p><div class="people-dashboard-stats">${labels.map(([key,label])=>key==='incompleteProfiles'?`<button class="people-stat" data-incomplete-profiles><span>${label}</span><strong>${Number(counts[key]||0)}</strong><small>Abrir cadastros pendentes.</small></button>`:`<button class="people-stat" data-dashboard-filter="${key}"><span>${label}</span><strong>${Number(counts[key]||0)}</strong></button>`).join('')}</div><section class="history-card"><div class="card-heading"><h2>Pendências da equipe</h2><span class="muted"><span id="people-dashboard-count">${items.length} ${items.length===1?'item exibido':'itens exibidos'}</span></span></div><div id="people-dashboard-items">${dashboardItems(items)}</div></section><p class="footnote">Os itens respeitam os vínculos da equipe e as permissões do seu perfil. A lista é atualizada quando esta tela é aberta.</p>`;
    const bindItems=()=>$$('[data-pending-person]').forEach(button=>button.onclick=()=>run(()=>selectPerson(button.dataset.pendingPerson,{targetTab:button.dataset.pendingTab,id:button.dataset.pendingId})));bindItems();
    $('[data-incomplete-profiles]').onclick=()=>{incomplete=true;search=department='';switchView('pessoas',false);window.scrollTo({top:0,behavior:'instant'});run(loadList);};
    $('#people-dashboard-refresh').onclick=()=>run(loadDashboard);
    $$('[data-dashboard-filter]').forEach(button=>button.onclick=()=>{$$('[data-dashboard-filter]').forEach(item=>item.classList.toggle('active',item===button));const selected=items.filter(item=>item.kind===button.dataset.dashboardFilter);$('#people-dashboard-items').innerHTML=dashboardItems(selected);$('#people-dashboard-count').textContent=`${selected.length} ${selected.length===1?'item exibido':'itens exibidos'}`;bindItems();});
    root.setAttribute('aria-busy', 'false');
    } catch (error) { if (current(token, 'gestao')) fail(root, error.message); }
  }
  function dashboardItems(items){return items.length?`<div class="people-pending-list">${items.map(item=>`<button data-pending-person="${e(item.uid)}" data-pending-tab="${item.kind==='pendingAcknowledgements'?'history':'documents'}" data-pending-id="${e(item.id||item.eventId||item.fileId||'')}"><span><strong>${e(item.personName||item.name||item.employeeName||'Colaborador')}</strong><small>${e(item.title||item.label||'Cadastro incompleto')}</small></span><span class="status ${item.kind==='expiredDocuments'?'blocked':'pending'}">${e(item.detail||item.kindLabel||(item.acknowledgementMode==='proof'?'Comprovante pendente':null)||({pendingAcknowledgements:'Ciência pendente',expiredDocuments:'Vencido',expiringDocuments:'Vence em até 30 dias'}[item.kind])||'Revisar ficha')}</span></button>`).join('')}</div>`:'<div class="empty-state">Nenhuma pendência neste grupo.</div>';}
  function validateFile(file){if(!file)return;if(file.size>5*1024*1024)throw new Error('O arquivo deve ter no máximo 5 MB.');if(!/\.(pdf|png|jpe?g)$/i.test(file.name))throw new Error('Envie um arquivo PDF, PNG ou JPG.');}
  async function formWork(form,errorSelector,work){const error=$(errorSelector);error.hidden=true;try{await busy(form.querySelector('button[type="submit"]'),work);}catch(cause){error.textContent=cause.message;error.hidden=false;}}
  async function run(work){try{await work();}catch(error){toast(error.message,true);}}
  return {initialize,reset,open,selectPerson};
}
