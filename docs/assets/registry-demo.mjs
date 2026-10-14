/* Isolated, in-memory demonstration. These fixtures never configure a real REP-P. */
const fields={employerLegalName:250,employerAddress:500,softwareOwner:250,technicalResponsible:180,legalResponsible:180,inpiRegistration:80};
const allowed=['version','reason','employerCnpj','certificateDeclared',...Object.keys(fields)];
const secret=/-----BEGIN [A-Z0-9 ]+-----|["']?(?:private_key|privateKey|client_secret|password|senha)["']?\s*[:=]/i;
const fixtureUsers=[{uid:'presentation',name:'Visitante',email:'visitante@exemplo.test',status:'active',role:'admin'},{uid:'ana',name:'Ana Costa',email:'ana@exemplo.test',status:'active',role:'employee'},{uid:'bruno',name:'Bruno Lima',email:'bruno@exemplo.test',status:'active',role:'employee'},{uid:'carla',name:'Carla Sousa',email:'carla@exemplo.test',status:'pending',role:'employee'}];
const fail=(message,status=400)=>{const error=new Error(message);error.status=status;throw error;};
const text=(value,max)=>{if(value===undefined)return '';if(typeof value!=='string'||value.trim().length>max||secret.test(value)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))fail('Confira os dados declarados. Não envie certificados, chaves privadas ou senhas.');return value.trim();};
function cnpj(value){
  const input=text(value,30).toUpperCase();if(!input)return '';
  if(!/^(?:[A-Z0-9]{12}\d{2}|[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}\/[A-Z0-9]{4}-\d{2})$/.test(input))fail('Informe um CNPJ válido, numérico ou alfanumérico.');
  const normalized=input.replace(/[.\/-]/g,'');if(/^(.)\1{13}$/.test(normalized))fail('Informe um CNPJ válido.');
  const digit=base=>{let sum=0,weight=2;for(let i=base.length-1;i>=0;i--){sum+=(base.charCodeAt(i)-48)*weight;weight=weight===9?2:weight+1;}const remainder=sum%11;return String(remainder<2?0:11-remainder);};
  const first=digit(normalized.slice(0,12));if(normalized.slice(-2)!==first+digit(normalized.slice(0,12)+first))fail('Os dígitos verificadores do CNPJ não conferem.');return normalized;
}
const pendingGaps=configuration=>[
  ...(!configuration.employerCnpj||!configuration.employerLegalName||!configuration.employerAddress?[{code:'employer_identity',label:'Completar CNPJ, razão social e endereço do empregador.'}]:[]),
  ...(!configuration.softwareOwner||!configuration.technicalResponsible||!configuration.legalResponsible?[{code:'responsible_identity',label:'Identificar o titular do software e os responsáveis técnico e legal.'}]:[]),
  {code:'employer_validation',label:'Validar a identificação e a representação do empregador; dígitos válidos não comprovam cadastro ou vínculo.'},
  {code:'certificate_signature',label:'Validar o certificado ICP-Brasil e implementar as assinaturas; a declaração de existência não equivale a verificação.'},
  {code:'inpi_validation',label:'Comprovar e validar o registro do programa no INPI e a documentação aplicável.'},
  {code:'collector_projection',label:'Adequar o coletor e as projeções derivadas: os eventos atuais são preservados após as validações operacionais existentes.'},
  {code:'employee_identity',label:'Implantar a identificação exigida dos trabalhadores, sem criar dados fictícios.'},
  {code:'official_outputs',label:'Implementar e validar NSR, comprovantes assinados e arquivos AFD/AEJ.'},
  {code:'technical_validation',label:'Concluir a validação técnica e documental do REP-P antes de qualquer utilização oficial.'}
];
export function createRegistryDemo({clock=()=>new Date()}={}){
  let configuration={employerCnpj:'',...Object.fromEntries(Object.keys(fields).map(key=>[key,''])),certificateDeclared:false,version:0,status:'pending',certificateVerified:false};
  const versions=[],events=[],audits=[],snapshots=new Set(),requests=new Set();let baseline=new Map();
  const now=()=>new Date(clock()).toISOString(),read=()=>structuredClone({configuration,gaps:pendingGaps(configuration),officialMode:false});
  const push=(kind,uid,date,payload,id=crypto.randomUUID())=>events.push({kind,id,uid,date,createdAt:now(),payload:{...structuredClone(payload),official:false}});
  function seed(days){if(!baseline.size)baseline=new Map([...days].map(([date,row])=>[date,structuredClone(row)]));}
  function ensureBaseline(uid,date){const key=uid+':'+date,row=baseline.get(date);if(row&&!snapshots.has(key)){snapshots.add(key);push('historical_snapshot',uid,date,{source:'legacy_observed_state',state:row,observedAt:now()});}}
  const audit=(action,actor,target,before,after,reason,date=null)=>audits.unshift({id:crypto.randomUUID(),action,actor_name:actor.name,actor_email:actor.email,target_name:target.name,target_email:target.email,date,reason,before:structuredClone(before),after:structuredClone(after),created_at:now()});
  function simulate(action,{data={},query='',dateNow=()=>now().slice(0,10),days=new Map(),users=fixtureUsers,actorUid='presentation'}={}){
    if(!['admin-registry','admin-registry-save','admin-record-provenance','record-provenance'].includes(action))return null;
    const actor=users.find(user=>user.uid===actorUid);if(!actor||actor.status!=='active')fail('Conta demonstrativa indisponível.',403);
    if(action.startsWith('admin-')&&actor.role!=='admin')fail('Acesso restrito ao administrador.',403);
    if(action==='admin-registry')return read();
    if(action==='admin-registry-save'){
      if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!allowed.includes(key)))fail('A configuração contém campos não permitidos. Não envie chaves privadas ou senhas.');
      if(!Number.isSafeInteger(data.version)||data.version<0)fail('Versão inválida. Atualize os dados.');
      const reason=text(data.reason,1000);if(reason.length<10)fail('Informe uma justificativa de 10 a 1.000 caracteres.');
      if(data.certificateDeclared!==undefined&&typeof data.certificateDeclared!=='boolean')fail('A declaração do certificado deve ser verdadeira ou falsa.');
      if(data.version!==configuration.version)fail('A configuração mudou. Atualize os dados.',409);
      const declared={employerCnpj:cnpj(data.employerCnpj),...Object.fromEntries(Object.entries(fields).map(([key,max])=>[key,text(data[key],max)])),certificateDeclared:data.certificateDeclared===true};
      const before=structuredClone(configuration);configuration={...declared,version:configuration.version+1,status:'pending',certificateVerified:false};versions.push(structuredClone(configuration));audit('registry:configure',actor,actor,before,configuration,reason);return read();
    }
    const params=new URLSearchParams(query.replace(/^&/,'')),uid=params.get('uid')||actorUid;
    if(uid.length>128)fail('Funcionário inválido.');if(action==='record-provenance'&&uid!==actorUid)fail('Você só pode consultar os próprios registros.',403);
    const user=users.find(person=>person.uid===uid);if(!user)fail('Funcionário não encontrado.',404);
    const date=params.get('date')||'',month=params.get('month')||dateNow().slice(0,7),offset=Number(params.get('offset')||0);
    if(date&&(!/^20\d{2}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date))fail('Data inválida.');
    if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)||!Number.isSafeInteger(offset)||offset<0||offset>10000)fail('Filtro inválido.');
    if(date)ensureBaseline(uid,date);else for(const day of baseline.keys())if(day.startsWith(month+'-'))ensureBaseline(uid,day);
    const selected=events.filter(event=>event.uid===uid&&(date?event.date===date:event.date.startsWith(month+'-'))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
    return structuredClone({user:{uid:user.uid,name:user.name,email:user.email},events:selected.slice(offset,offset+50).map(({uid,...event})=>event),nextOffset:selected.length>offset+50?offset+50:null,officialMode:false});
  }
  simulate.seed=seed;
  simulate.observePunch=async({uid='presentation',record,type,requestId})=>{
    const key=uid+':'+requestId;if(requests.has(key))return;requests.add(key);ensureBaseline(uid,record.date);
    const id=crypto.randomUUID(),time=record.times.at(-1),occurredAt=new Date(record.date+'T'+time+'-03:00').toISOString();
    const payload={id,uid,date:record.date,time,occurredAt,timezone:'America/Sao_Paulo',collector:'web',requestId,markType:type,configurationVersion:configuration.version||null};
    const canonical=JSON.stringify(Object.fromEntries(Object.keys(payload).sort().map(key=>[key,payload[key]])));
    const contentHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    push('original_event',uid,record.date,{...payload,contentHash,hashAlgorithm:'SHA-256',signed:false},id);
  };
  simulate.observeImport=({uid='presentation',rows,filename})=>{for(const row of rows){const key=uid+':'+row.date;if(snapshots.has(key))continue;snapshots.add(key);push('historical_snapshot',uid,row.date,{source:'import_baseline',state:row,filename,observedAt:now()});}};
  simulate.observeCorrection=({uid,date,before,after,reason,actorUid='presentation',users=fixtureUsers})=>{ensureBaseline(uid,date);const actor=users.find(user=>user.uid===actorUid),target=users.find(user=>user.uid===uid);if(!actor||!target)return;push('treatment',uid,date,{actorUid,reason,before,after,changedAt:now()});audit('record:correct',actor,target,before,after,reason,date);};
  simulate.audit=()=>structuredClone(audits);simulate.versions=()=>structuredClone(versions);
  return simulate;
}
export const registryDemo=createRegistryDemo();
