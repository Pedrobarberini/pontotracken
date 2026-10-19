const roles = { employee: 'Colaborador', manager: 'Gestor', hr: 'RH', admin: 'ADMIN' };
const eventTypes = new Set(['orientation','feedback','improvement','conversation','training','warning','medical','movement','milestone']);
const categories = new Set(['identity','contract','certificate','medical','proof','other']);
const professionalFields = ['employeeNumber','jobTitle','department','hireDate','workMode','location'];
const contacts = ['phone','emergencyContact'];
export const demoActors = [
  {uid:'presentation',label:'ADMIN · Visitante'}, {uid:'bruno',label:'Gestor · Bruno'},
  {uid:'demo-marina',label:'RH · Marina'}, {uid:'ana',label:'Colaborador · Ana'}
];
const fail = (message,status=400) => {throw Object.assign(new Error(message),{status});};
const text = (value,min,max,label) => {
  if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)fail(label);
  return value.trim();
};
const dateValue = value => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;

/** In-memory presentation data. This module never contacts Firebase, D1 or R2. */
export function createPeopleDemo({clock=()=>new Date()}={}) {
  let actorUid='presentation';
  const now=()=>new Date(clock()).toISOString();
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(clock()));
  const relative=days=>{const date=new Date(today()+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);};
  const profiles=new Map([
    {uid:'presentation',name:'Visitante',email:'visitante@exemplo.test',role:'admin',jobTitle:'Administrador',department:'Gestão',managerUid:null},
    {uid:'bruno',name:'Bruno Lima',email:'bruno@exemplo.test',role:'manager',jobTitle:'Líder de suporte',department:'Suporte',managerUid:'presentation'},
    {uid:'ana',name:'Ana Costa',email:'ana@exemplo.test',role:'employee',jobTitle:'Analista de suporte',department:'Suporte',managerUid:'bruno'},
    {uid:'demo-marina',name:'Marina Alves',email:'marina@exemplo.test',role:'hr',jobTitle:'Analista de pessoas',department:'Pessoas',managerUid:'presentation'},
    {uid:'carla',name:'Carla Sousa',email:'carla@exemplo.test',role:'employee',jobTitle:'',department:'Operações',managerUid:'bruno'},
    {uid:'demo-rafael',name:'Rafael Melo',email:'rafael@exemplo.test',role:'employee',jobTitle:'Analista financeiro',department:'Financeiro',managerUid:'presentation'}
  ].map((profile,index)=>[profile.uid,{status:profile.uid==='carla'?'pending':'active',roleVersion:0,employeeNumber:profile.uid==='carla'?'':`PT-${String(index+1).padStart(3,'0')}`,hireDate:'2025-06-02',workMode:'remote',location:'São Paulo',phone:'(11) 90000-0000',emergencyContact:'Contato fictício · (11) 90000-0001',version:0,updatedAt:now(),...profile}]));
  const events=new Map(),documents=new Map(),files=new Map(),mutations=new Map();
  const actor=()=>profiles.get(actorUid);
  const privileged=()=>['admin','hr'].includes(actor().role);
  const inScope=uid=>privileged() || uid===actorUid || actor().role==='manager'&&profiles.get(uid)?.managerUid===actorUid;
  const target=uid=>{if(!profiles.has(uid)||!inScope(uid))fail('Ficha não encontrada.',404);return profiles.get(uid);};
  const canRead=item=>inScope(item.uid)&&(item.visibility==='shared'||privileged());
  const canCreate=uid=>privileged()||actor().role==='manager'&&uid!==actorUid&&profiles.get(uid)?.managerUid===actorUid;
  const capabilities=uid=>({canManagePeople:actor().role!=='employee',canAssignRoles:actor().role==='admin',canEditProfessional:privileged(),canEditContacts:privileged()||uid===actorUid,canReadRestricted:privileged(),canCreateEvent:canCreate(uid)});
  const profileDTO=profile=>{const result={...profile,managerName:profiles.get(profile.managerUid)?.name||null};if(!privileged()&&profile.uid!==actorUid){delete result.phone;delete result.emergencyContact;}return result;};
  const docDTO=doc=>({...doc});
  const eventDTO=event=>({...event,acknowledgementRequired:event.acknowledgementMode!=='none',acknowledgementStatus:event.acknowledgedAt?'confirmed':event.acknowledgementMode==='app'?'pending':event.acknowledgementMode==='proof'?[...documents.values()].some(doc=>doc.eventId===event.id&&doc.category==='proof'&&doc.status==='active')?'attached':'pending':'not_required',documents:[...documents.values()].filter(doc=>doc.eventId===event.id&&doc.status==='active'&&canRead(doc)).map(docDTO)});
  function seedEvent(id,uid,type,title,content,{visibility='shared',acknowledgementMode='none',occurredOn=relative(-2)}={}) {
    events.set(id,{id,uid,type,title,content,occurredOn,visibility,acknowledgementMode,status:'active',version:1,createdBy:'bruno',createdByName:'Bruno Lima',createdAt:now(),acknowledgedAt:null,archiveReason:null});
  }
  function seedDocument(id,uid,title,expiresOn,visibility='shared') {
    const blob=new Blob(['%PDF-1.4\nDocumento fictício de demonstração.\n%%EOF'],{type:'application/pdf'});
    documents.set(id,{id,uid,eventId:null,title,category:visibility==='hr'?'medical':'certificate',filename:'documento-demonstrativo.pdf',contentType:'application/pdf',bytes:blob.size,sha256:'demo-only',issuedOn:relative(-90),expiresOn,visibility,status:'active',version:1,uploadedBy:'demo-marina',uploadedByName:'Marina Alves',createdAt:now(),archiveReason:null});files.set(id,blob);
  }
  seedEvent('demo-event-welcome','ana','orientation','Boas-vindas à equipe','Orientações de atendimento, canais de comunicação e rotina da equipe.',{acknowledgementMode:'app'});
  seedEvent('demo-event-training','ana','training','Capacitação de atendimento','Participação no treinamento do fluxo de chamados e boas práticas.',{acknowledgementMode:'proof',occurredOn:relative(-10)});
  seedEvent('demo-event-medical','ana','medical','Documento de saúde','Registro fictício reservado ao RH e ADMIN.',{visibility:'hr'});
  seedEvent('demo-event-bruno','bruno','feedback','Acompanhamento da equipe','Revisão das prioridades e plano de acompanhamento das próximas entregas.');
  seedDocument('demo-document-expired','ana','Certificação de atendimento',relative(-4));
  seedDocument('demo-document-expiring','ana','Treinamento de produto',relative(12));
  seedDocument('demo-document-private','ana','Arquivo de saúde demonstrativo',null,'hr');
  function paginate(rows,params) {
    const offset=Number(params.get('offset')||0);
    if(!Number.isInteger(offset)||offset<0)fail('Página inválida.');
    const page=rows.slice(offset,offset+50);return {rows:page,truncated:offset+50<rows.length,nextOffset:offset+50<rows.length?offset+50:null};
  }
  function accessItem(map,id) {const item=map.get(id);if(!item||!canRead(item))fail('Registro não encontrado.',404);return item;}
  function validateVersion(item,version) {if(Number(version)!==item.version)fail('Este registro mudou. Recarregue a ficha antes de tentar novamente.',409);}
  async function idempotent(action,data,work) {
    const id=data instanceof FormData?data.get('requestId'):data.requestId;
    if(!/^[A-Za-z0-9_-]{16,64}$/.test(id||''))fail('Identificador de envio inválido.');
    const values=data instanceof FormData?[...data].map(([key,value])=>[key,value instanceof Blob?{name:value.name,size:value.size,type:value.type}:value]):Object.entries(data);
    const signature=JSON.stringify(values.sort(([a],[b])=>a.localeCompare(b))),key=`${actorUid}:${action}:${id}`;
    if(mutations.has(key)){const cached=mutations.get(key);if(cached.signature!==signature)fail('Este envio já foi usado com outros dados.',409);return structuredClone(cached.result);}
    const result=await work();mutations.set(key,{signature,result:structuredClone(result)});return result;
  }
  async function request(action,{data={},query=''}={}) {
    if(!action.startsWith('people-'))return null;
    const params=new URLSearchParams(query.replace(/^&/,'')),uid=params.get('uid')||data.uid||actorUid;
    if(action==='people-context')return {uid:actorUid,role:actor().role,...capabilities(actorUid),managers:[...profiles.values()].filter(p=>p.status==='active'&&['manager','admin'].includes(p.role)).map(p=>({uid:p.uid,name:p.name,email:p.email}))};
    if(action==='people-list') {
      if(actor().role==='employee')fail('Acesso restrito à gestão.',403);
      const term=(params.get('q')||'').toLowerCase(),department=params.get('department')||'',incomplete=params.get('incomplete')||'',status=params.get('status')||'';
      if(!['','0','1'].includes(incomplete)||!['','pending','active','blocked'].includes(status))fail('Filtro de colaboradores inválido.');
      const scoped=[...profiles.values()].filter(p=>inScope(p.uid));
      const filtered=scoped.filter(p=>(!department||p.department===department)&&(!status||p.status===status)&&(incomplete!=='1'||professionalFields.some(field=>!p[field]))&&[p.name,p.email,p.jobTitle].join(' ').toLowerCase().includes(term));
      const page=paginate(filtered.map(profileDTO),params);return {people:page.rows,nextOffset:page.nextOffset,departments:[...new Set(scoped.map(p=>p.department).filter(Boolean))].sort()};
    }
    if(action==='people-profile')return {profile:profileDTO(target(uid)),capabilities:capabilities(uid)};
    if(action==='people-timeline'||action==='people-documents') {
      target(uid);const map=action==='people-timeline'?events:documents;
      const id=params.get('id')||'';
      if(id.length>64)fail('Identificador inválido.');
      const paging=id?new URLSearchParams():params;
      return paginate([...map.values()].filter(item=>item.uid===uid&&canRead(item)&&(!id||item.id===id)&&(item.status===(params.get('archived')==='1'?'archived':'active'))&&(!params.get('type')||item.type===params.get('type'))).sort((a,b)=>(b.occurredOn||b.createdAt).localeCompare(a.occurredOn||a.createdAt)).map(item=>action==='people-timeline'?eventDTO(item):docDTO(item)),paging);
    }
    if(action==='people-profile-save') {
      const profile=target(uid),permission=capabilities(uid);validateVersion(profile,data.version);text(data.reason,10,1000,'Descreva o motivo da atualização.');const updates={};
      for(const field of [...professionalFields,...contacts])if(Object.hasOwn(data,field)){if(!(professionalFields.includes(field)?permission.canEditProfessional:permission.canEditContacts))fail('Você não pode alterar este campo.',403);const value=text(data[field],0,field==='emergencyContact'?240:180,'Campo inválido.');if(field==='hireDate'&&(!dateValue(value)||value>today()))fail('Data de admissão inválida.');if(field==='workMode'&&!['','remote','hybrid','onsite'].includes(value))fail('Modalidade inválida.');updates[field]=value;}
      Object.assign(profile,updates);profile.version++;profile.updatedAt=now();return {profile:profileDTO(profile),capabilities:capabilities(uid)};
    }
    if(action==='people-role-save') {
      if(actor().role!=='admin')fail('Acesso restrito ao ADMIN.',403);
      const profile=target(uid);validateVersion(profile,data.profileVersion);if(Number(data.roleVersion)!==profile.roleVersion)fail('Permissões alteradas. Recarregue a ficha.',409);text(data.reason,10,1000,'Informe a justificativa.');
      if(profile.role==='admin'&&data.role!=='admin'||profile.role!=='admin'&&!['employee','manager','hr'].includes(data.role))fail('Perfil inválido.');
      const managerUid=data.managerUid||null,manager=profiles.get(managerUid);if(managerUid&&(managerUid===uid||manager?.status!=='active'||!['manager','admin'].includes(manager.role)))fail('Gestor inválido.');
      for(let next=managerUid,seen=new Set([uid]);next;next=profiles.get(next)?.managerUid){if(seen.has(next))fail('O vínculo de gestão criaria um ciclo.');seen.add(next);}
      profile.role=data.role;profile.roleVersion++;profile.managerUid=managerUid;profile.version++;profile.updatedAt=now();return {profile:profileDTO(profile),capabilities:capabilities(uid)};
    }
    if(action==='people-event-create')return idempotent(action,data,async()=>{
      target(uid);if(!canCreate(uid))fail('Você não pode registrar neste colaborador.',403);
      if(!eventTypes.has(data.type))fail('Tipo de registro inválido.');const visibility=data.type==='medical'?'hr':data.visibility;
      if(!['shared','hr'].includes(visibility)||visibility==='hr'&&!privileged())fail('Visibilidade não autorizada.',403);
      if(!dateValue(data.occurredOn)||!data.occurredOn||data.occurredOn>today())fail('Data inválida.');
      const mode=data.acknowledgementMode||'none';if(!['none','app','proof'].includes(mode)||visibility==='hr'&&mode!=='none')fail('Ciência não disponível para este registro.');
      const id=crypto.randomUUID();seedEvent(id,uid,data.type,text(data.title,3,180,'Título inválido.'),text(data.content,10,5000,'Descrição inválida.'),{visibility,acknowledgementMode:mode,occurredOn:data.occurredOn});Object.assign(events.get(id),{createdBy:actorUid,createdByName:actor().name});return {record:eventDTO(events.get(id))};
    });
    if(action==='people-file-upload')return idempotent(action,data,async()=>{
      if(!(data instanceof FormData))fail('Envie um formulário com arquivo.');const targetUid=data.get('uid');target(targetUid);if(!canCreate(targetUid)&&targetUid!==actorUid)fail('Você não pode anexar nesta ficha.',403);
      const file=data.get('file'),category=data.get('category')||'other';if(!categories.has(category))fail('Categoria inválida.');
      const visibility=category==='medical'?'hr':data.get('visibility');if(!['shared','hr'].includes(visibility)||visibility==='hr'&&!privileged())fail('Visibilidade não autorizada.',403);
      if(!(file instanceof Blob)||!file.size||file.size>5*1024*1024)fail('Envie um arquivo de até 5 MB.');
      let filename=String(file.name||'').replace(/[\\/\x00-\x1f]/g,'_');if(!/\.(pdf|png|jpe?g)$/i.test(filename)||!['application/pdf','image/png','image/jpeg'].includes(file.type))fail('Envie PDF, PNG ou JPG.');
      const bytes=new Uint8Array(await file.arrayBuffer());const pdf=bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70,png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;if(!(file.type==='application/pdf'?pdf:file.type==='image/png'?png:jpeg))fail('O conteúdo não corresponde ao formato informado.');filename=filename.replace(/\.[^.]+$/,file.type==='application/pdf'?'.pdf':file.type==='image/png'?'.png':'.jpg');
      const issuedOn=data.get('issuedOn')||null,expiresOn=data.get('expiresOn')||null;if(!dateValue(issuedOn)||!dateValue(expiresOn)||issuedOn>today()||issuedOn&&expiresOn&&expiresOn<issuedOn)fail('Datas do documento inválidas.');
      const eventId=data.get('eventId')||null;if(category==='proof'&&!eventId)fail('Vincule o comprovante a um registro.');if(eventId){const event=accessItem(events,eventId);if(event.uid!==targetUid||event.status!=='active'||event.visibility!==visibility)fail('Vínculo de documento inválido.');}
      const id=crypto.randomUUID(),record={id,uid:targetUid,eventId,title:text(data.get('title'),3,180,'Título inválido.'),category,filename,contentType:file.type,bytes:file.size,sha256:'demo-only',issuedOn,expiresOn,visibility,status:'active',version:1,uploadedBy:actorUid,uploadedByName:actor().name,createdAt:now(),archiveReason:null};documents.set(id,record);files.set(id,file);return {record:docDTO(record)};
    });
    if(action==='people-event-acknowledge')return idempotent(action,data,async()=>{const event=accessItem(events,data.id);if(event.uid!==actorUid||event.visibility!=='shared'||event.status!=='active'||event.acknowledgementMode!=='app')fail('Esta ciência pertence ao colaborador do registro.',403);validateVersion(event,data.version);if(event.acknowledgedAt)return {record:eventDTO(event)};event.acknowledgedAt=now();return {record:eventDTO(event)};});
    if(action==='people-event-archive'||action==='people-document-archive')return idempotent(action,data,async()=>{const item=accessItem(action==='people-event-archive'?events:documents,data.id);if(!canCreate(item.uid)&&!(action==='people-document-archive'&&item.uid===actorUid&&item.uploadedBy===actorUid))fail('Você não pode arquivar este item.',403);if(action==='people-event-archive'&&!privileged()&&item.createdBy!==actorUid)fail('Somente o autor, RH ou ADMIN pode arquivar este registro.',403);validateVersion(item,data.version);if(item.status!=='active')fail('Item já arquivado.',409);item.archiveReason=text(data.reason,10,1000,'Informe o motivo do arquivamento.');item.status='archived';item.archivedAt=now();item.archivedBy=actorUid;item.version++;return {record:action==='people-event-archive'?eventDTO(item):docDTO(item)};});
    if(action==='people-dashboard') {
      if(actor().role==='employee')fail('Acesso restrito à gestão.',403);
      const scoped=[...profiles.values()].filter(p=>inScope(p.uid)),pending=[...events.values()].filter(item=>canRead(item)&&item.status==='active'&&(item.acknowledgementMode==='app'&&!item.acknowledgedAt||item.acknowledgementMode==='proof'&&![...documents.values()].some(doc=>doc.eventId===item.id&&doc.category==='proof'&&doc.status==='active'))),validDocuments=[...documents.values()].filter(item=>canRead(item)&&item.status==='active'&&item.expiresOn);
      const list=items=>({count:items.length,rows:items.slice(0,50).map(item=>({id:item.id,uid:item.uid,personName:profiles.get(item.uid).name,title:item.title,date:item.expiresOn||item.occurredOn,acknowledgementMode:item.acknowledgementMode||null}))});
      return {scope:actor().role,people:scoped.length,activePeople:scoped.filter(p=>p.status==='active').length,incompleteProfiles:scoped.filter(p=>professionalFields.some(field=>!p[field])).length,pendingAcknowledgements:list(pending),expiredDocuments:list(validDocuments.filter(doc=>doc.expiresOn<today())),expiringDocuments:list(validDocuments.filter(doc=>doc.expiresOn>=today()&&doc.expiresOn<=relative(30)))};
    }
    fail('Ação da ficha indisponível.',404);
  }
  function download(id) {const document=accessItem(documents,id);return {blob:files.get(id),filename:document.filename};}
  async function downloadTerm(id) {
    const requestedActor=actorUid,event=accessItem(events,id),profile=target(event.uid);
    const {generateTermPdf}=await import('../vendor/people-term-pdf.mjs?v=demand-notices-1');
    const bytes=await generateTermPdf({employee:{name:profile.name,employeeNumber:profile.employeeNumber,jobTitle:profile.jobTitle,department:profile.department},event:{id:event.id,type:event.type,title:event.title,content:event.content,occurredOn:event.occurredOn,createdByName:event.createdByName,createdAt:event.createdAt,version:event.version,status:event.status,archivedAt:event.archivedAt,archiveReason:event.archiveReason},generatedAt:now(),demonstration:true});
    if(actorUid!==requestedActor)fail('A sessão demonstrativa mudou. Gere o termo novamente.',403);
    accessItem(events,id);
    return {blob:new Blob([bytes],{type:'application/pdf'}),filename:`termo-ciencia-${event.id}-v${event.version}.pdf`};
  }
  function select(uid) {if(!demoActors.some(item=>item.uid===uid))fail('Perfil demonstrativo inválido.');actorUid=uid;return sessionUser();}
  function sessionUser() {const profile=actor();return {uid:actorUid,name:profile.name,email:profile.email,demo:true,role:profile.role==='admin'?'admin':'employee'};}
  return {request,download,downloadTerm,select,sessionUser};
}
export const peopleDemo=createPeopleDemo();
