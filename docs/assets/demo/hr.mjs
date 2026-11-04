import {vacationAccrual,addCalendarMonths} from '../vendor/vacation-accrual.mjs?v=hr-operations-1';
import {findDemandWarnings} from '../vendor/hr-planning.mjs?v=hr-operations-1';
import {createPlanningNoticeDemo} from './planning-notices.mjs?v=hr-operations-1';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const text=(value,min,max)=>{if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)fail('Preencha os campos e descreva o motivo (mínimo 10 caracteres).');return value.trim();};
const date=value=>{if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)fail('Data inválida.');return value;};
const range=(start,end,max=366)=>{date(start);date(end);const days=Math.round((Date.parse(end+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000)+1;if(days<1||days>max)fail('Período inválido.');return days;};
const overlap=(a,b)=>a.startOn<=b.endOn&&a.endOn>=b.startOn;
const validVersion=(row,version)=>{if(row.version!==version)fail('O registro mudou. Atualize os dados.',409);};
/** Synthetic memory only; no Firebase, database, attachments or network. */
export function createHrDemo({peopleDemo,blockAccount=null,clock=()=>new Date()}={}) {
  const absences=new Map(),balances=new Map(),processes=new Map(),operations=new Map(),rules=new Map();
  const now=()=>new Date(clock()).toISOString(),today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(clock()));
  const month=()=>today().slice(0,7),year=()=>today().slice(0,4),day=n=>month()+'-'+String(n).padStart(2,'0');
  const planning=createPlanningNoticeDemo({now,today});
  balances.set('demo-hr-balance-ana',{id:'demo-hr-balance-ana',uid:'ana',periodStart:year()+'-01-01',periodEnd:year()+'-12-31',grantedDays:30,version:1});
  rules.set('bruno',{uid:'bruno',anchor_on:(Number(year())-1)+'-01-01',cycle_months:12,days_per_cycle:30,adjustment_days:0,enabled:1,version:1});
  balances.set('demo-auto-bruno',{id:'demo-auto-bruno',uid:'bruno',periodStart:year()+'-01-01',periodEnd:'2099-12-31',grantedDays:30,source:'automatic',accrualCycles:1,ruleVersion:1,version:1});
  absences.set('demo-hr-approved',{id:'demo-hr-approved',uid:'ana',type:'day_off',startOn:day(5),endOn:day(5),days:1,balanceId:null,status:'approved',reason:'Compromisso pessoal planejado.',requestedBy:'ana',reviewedBy:'bruno',reviewReason:'Cobertura da equipe organizada.',version:2,createdAt:now(),updatedAt:now()});
  absences.set('demo-hr-pending',{id:'demo-hr-pending',uid:'ana',type:'vacation',startOn:day(20),endOn:day(24),days:5,balanceId:'demo-hr-balance-ana',status:'pending',reason:'Planejamento de descanso pessoal.',requestedBy:'ana',reviewedBy:null,reviewReason:null,version:1,createdAt:now(),updatedAt:now()});
  processes.set('demo-hr-onboarding',{id:'demo-hr-onboarding',uid:'carla',type:'onboarding',status:'open',version:1,createdBy:'demo-marina',createdAt:now(),closedBy:null,closedAt:null,closeReason:null,steps:[{id:'demo-hr-step-check',title:'Conferir cadastro profissional',ownerUid:'demo-marina',dueOn:day(15),status:'open',version:1,completedBy:null,completedAt:null},{id:'demo-hr-step-team',title:'Apresentar canais e rotina da equipe',ownerUid:'bruno',dueOn:day(18),status:'open',version:1,completedBy:null,completedAt:null}]});
  async function scope() {const context=await peopleDemo.request('people-context'),actor=peopleDemo.sessionUser(),people=context.role==='employee'?[(await peopleDemo.request('people-profile',{query:'&uid='+encodeURIComponent(actor.uid)})).profile]:(await peopleDemo.request('people-list')).people;return {actor,role:context.role,privileged:['admin','hr'].includes(context.role),people};}
  const target=(context,uid)=>{const person=context.people.find(p=>p.uid===uid);if(!person)fail('Colaborador fora do seu acesso.',403);return person;};
  const own=(context,uid)=>context.actor.uid===uid;
  const managed=(context,uid)=>context.privileged||context.role==='manager'&&target(context,uid).managerUid===context.actor.uid;
  const privileged=context=>{if(!context.privileged)fail('Ação reservada ao RH e ADMIN.',403);};
  const item=(context,map,id)=>{const row=map.get(id);if(!row)fail('Registro não encontrado.',404);target(context,row.uid);return row;};
  async function mutate(context,action,data,work) {
    if(!/^[A-Za-z0-9_-]{16,64}$/.test(data.requestId||''))fail('Identificador inválido.');
    const key=context.actor.uid+':'+action+':'+data.requestId,signature=JSON.stringify(Object.fromEntries(Object.entries(data).sort(([a],[b])=>a.localeCompare(b))));
    const previous=operations.get(key);if(previous){if(previous.signature!==signature)fail('Identificador já usado com outros dados.',409);return structuredClone(previous.result);}
    const result=await work();operations.set(key,{signature,result:structuredClone(result)});return result;
  }
  function owner(context,uid,ownerUid) {const person=target(context,ownerUid),employee=target(context,uid);if(person.status!=='active'||!(ownerUid===uid||ownerUid===context.actor.uid||person.role==='hr'||employee.managerUid===ownerUid&&person.role==='manager'))fail('Escolha um responsável ativo da equipe ou RH.',409);}

  const autoBalance=uid=>[...balances.values()].find(row=>row.uid===uid&&row.source==='automatic');
  const ruleDTO=(context,row)=>({uid:row.uid,personName:target(context,row.uid).name,anchorOn:row.anchor_on,cycleMonths:row.cycle_months,daysPerCycle:row.days_per_cycle,adjustmentDays:row.adjustment_days,enabled:row.enabled===1,version:row.version,balanceId:autoBalance(row.uid)?.id||null,...vacationAccrual(row,today())});
  function syncVacation(context,uid){target(context,uid);const rule=rules.get(uid);if(!rule?.enabled)return {uid,synced:false};const calc=vacationAccrual(rule,today());if(!calc.completedCycles)return {uid,synced:false};
    if([...balances.values()].some(row=>row.uid===uid&&row.source!=='automatic'&&row.periodEnd>=calc.availableFrom))fail('Saldo manual e automático se sobrepõem.',409);
    let pool=autoBalance(uid);if(pool&&pool.grantedDays===calc.totalDays&&pool.ruleVersion===rule.version)return {uid,synced:false};
    if(!pool){pool={id:crypto.randomUUID(),uid,periodStart:calc.availableFrom,periodEnd:'2099-12-31',source:'automatic',version:0};balances.set(pool.id,pool);}
    Object.assign(pool,{grantedDays:calc.totalDays,accrualCycles:calc.completedCycles,ruleVersion:rule.version,version:pool.version+1});return {uid,synced:true};
  }
  async function request(action,{data={},query=''}={}) {
    if(!action.startsWith('hr-'))return null;
    const context=await scope(),params=new URLSearchParams(query.replace(/^&/,'')),personName=uid=>context.people.find(p=>p.uid===uid)?.name||'';
    const notices=planning.active();
    const dto=row=>({...structuredClone(row),personName:personName(row.uid),...(row.startOn&&row.endOn?{demandWarnings:findDemandWarnings(notices,row.startOn,row.endOn)}:{})});
    if(action==='hr-notices')return planning.list(context,params.get('status')||'active');
    if(action==='hr-notice-save')return planning.save(context,data,mutate);
    if(action==='hr-notice-archive')return planning.archive(context,data,mutate);
    if(action==='hr-state') {
      const selectedMonth=params.get('month')||month();if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(selectedMonth))fail('Mês inválido.');
      const uid=params.get('uid')||'',offset=Number(params.get('offset')||0);if(uid)target(context,uid);if(!Number.isInteger(offset)||offset<0||offset>10000)fail('Página inválida.');
      const first=selectedMonth+'-01',last=new Date(Date.UTC(Number(selectedMonth.slice(0,4)),Number(selectedMonth.slice(5,7)),0,12)).toISOString().slice(0,10),read=row=>context.people.some(p=>p.uid===row.uid)&&(!uid||uid===row.uid);
      const a=[...absences.values()].filter(row=>read(row)&&row.startOn<=last&&row.endOn>=first).sort((a,b)=>b.startOn.localeCompare(a.startOn)),p=[...processes.values()].filter(read).sort((a,b)=>a.status.localeCompare(b.status)||b.createdAt.localeCompare(a.createdAt));
      const page=rows=>({rows:rows.slice(offset,offset+50).map(dto),truncated:rows.length>offset+50,nextOffset:rows.length>offset+50?offset+50:null});
      const b=[...balances.values()].filter(row=>read(row)&&row.periodStart<=last&&row.periodEnd>=first).map(row=>{const linked=[...absences.values()].filter(a=>a.balanceId===row.id),reservedDays=linked.filter(a=>a.status==='approved').reduce((sum,a)=>sum+a.days,0),pendingDays=linked.filter(a=>a.status==='pending').reduce((sum,a)=>sum+a.days,0);return {...dto(row),reservedDays,pendingDays,availableDays:row.grantedDays-reservedDays};});
      const calendar=a.filter(row=>row.status==='approved').map(row=>({id:row.id,uid:row.uid,personName:personName(row.uid),type:row.type,startOn:row.startOn,endOn:row.endOn,days:row.days}));
      return {scope:context.role,capabilities:{role:context.role,canRequest:true,canManageBalances:context.privileged,canConfigureVacation:context.role==='admin',canCloseOffboarding:context.role==='admin',canManageProcesses:context.privileged,canManageNotices:context.privileged,canReview:context.role!=='employee'},notices:planning.list(context),people:context.people.map(({uid,name,status,department,managerUid,role})=>({uid,name,status,department,managerUid,role})),peopleTruncated:false,absences:page(a),balances:b,balancesTruncated:false,vacationAutomation:{rules:[...rules.values()].filter(read).map(row=>ruleDTO(context,row)),truncated:false,needsSync:[...rules.values()].filter(row=>read(row)&&row.enabled&&vacationAccrual(row,today()).completedCycles>0).filter(row=>{const pool=[...balances.values()].find(b=>b.uid===row.uid&&b.source==='automatic');return !pool||pool.grantedDays!==vacationAccrual(row,today()).totalDays||pool.ruleVersion!==row.version;}).map(row=>row.uid)},processes:page(p),calendar:{month:selectedMonth,rows:calendar.slice(0,200),truncated:calendar.length>200}};
    }

    if(action==='hr-vacation-sync'){const uids=data.uids??[data.uid||context.actor.uid];if(!Array.isArray(uids)||!uids.length||uids.length>3)fail('Lote inválido.');for(const uid of uids)target(context,uid);return {rows:uids.map(uid=>syncVacation(context,uid))};}
    if(action==='hr-vacation-rule-save'){
      if(context.role!=='admin')fail('Somente ADMIN configura a aquisição.',403);target(context,data.uid);
      return mutate(context,action,data,()=>{const previous=rules.get(data.uid);if((previous?.version||0)!==data.version)fail('A regra mudou.',409);date(data.anchorOn);text(data.reason,10,1000);
        if(!Number.isInteger(data.cycleMonths)||data.cycleMonths<1||data.cycleMonths>36||!Number.isInteger(data.daysPerCycle)||data.daysPerCycle<1||data.daysPerCycle>90||typeof data.enabled!=='boolean')fail('Regra inválida.');
        if(autoBalance(data.uid)&&previous&&(data.anchorOn!==previous.anchor_on||data.cycleMonths!==previous.cycle_months||data.daysPerCycle!==previous.days_per_cycle))fail('Preserve a base da regra já utilizada.',409);
        if(data.enabled&&[...balances.values()].some(row=>row.uid===data.uid&&row.source!=='automatic'&&row.periodEnd>=addCalendarMonths(data.anchorOn,data.cycleMonths)))fail('Existe saldo manual a partir da primeira aquisição.',409);
        const row={uid:data.uid,anchor_on:data.anchorOn,cycle_months:data.cycleMonths,days_per_cycle:data.daysPerCycle,adjustment_days:previous?.adjustment_days||0,enabled:data.enabled?1:0,version:(previous?.version||0)+1};rules.set(row.uid,row);return {rule:ruleDTO(context,row)};});
    }
    if(action==='hr-vacation-adjust'){privileged(context);target(context,data.uid);return mutate(context,action,data,()=>{const row=rules.get(data.uid);if(!row)fail('Regra não encontrada.',404);validVersion(row,data.version);text(data.reason,10,1000);if(!Number.isInteger(data.adjustmentDays)||Math.abs(data.adjustmentDays)>3650)fail('Ajuste inválido.');const after={...row,adjustment_days:data.adjustmentDays};vacationAccrual(after,today());const pool=autoBalance(data.uid),used=[...absences.values()].filter(a=>a.balanceId===pool?.id&&a.status==='approved').reduce((sum,a)=>sum+a.days,0),delta=data.adjustmentDays-row.adjustment_days;if(pool&&pool.grantedDays+delta<used)fail('Preserve os dias já aprovados.',409);row.adjustment_days=data.adjustmentDays;row.version++;if(pool){pool.grantedDays+=delta;pool.ruleVersion=row.version;pool.version++;}return {rule:ruleDTO(context,row)};});}
    if(action==='hr-absence-request') {
      if(data.uid&&data.uid!==context.actor.uid)fail('Solicite apenas para sua conta.',403);target(context,context.actor.uid);if(data.type==='vacation')syncVacation(context,context.actor.uid);
      return mutate(context,action,data,()=>{if(!['vacation','day_off','other'].includes(data.type))fail('Tipo inválido.');const days=range(data.startOn,data.endOn),reason=text(data.reason,10,1000),balance=data.type==='vacation'?[...balances.values()].find(b=>b.uid===context.actor.uid&&b.periodStart<=data.startOn&&b.periodEnd>=data.endOn):null;if(data.type==='vacation'&&(!balance||balance.grantedDays<days))fail('Peça ao RH um saldo manual que cubra o período.',409);if([...absences.values()].some(a=>a.uid===context.actor.uid&&['pending','approved'].includes(a.status)&&overlap(a,data)))fail('Já existe ausência neste período.',409);const row={id:crypto.randomUUID(),uid:context.actor.uid,type:data.type,startOn:data.startOn,endOn:data.endOn,days,balanceId:balance?.id||null,status:'pending',reason,requestedBy:context.actor.uid,reviewedBy:null,reviewReason:null,version:1,createdAt:now(),updatedAt:now()};absences.set(row.id,row);return {record:dto(row)};});
    }
    if(action==='hr-absence-decide'||action==='hr-absence-cancel') {
      const row=item(context,absences,data.id);if(action==='hr-absence-decide'&&(!managed(context,row.uid)||own(context,row.uid)))fail('Outra pessoa autorizada deve decidir.',403);if(action==='hr-absence-cancel'&&!(own(context,row.uid)&&row.status!=='approved'||!own(context,row.uid)&&managed(context,row.uid)))fail('Peça o cancelamento à gestão.',403);
      return mutate(context,action,data,()=>{validVersion(row,data.version);const reason=text(data.reason,10,1000);if(action==='hr-absence-decide'){if(row.status!=='pending'||!['approved','rejected'].includes(data.decision))fail('Solicitação indisponível.',409);if(data.decision==='approved'&&row.type==='vacation'){const balance=balances.get(row.balanceId),reserved=[...absences.values()].filter(a=>a.balanceId===row.balanceId&&a.status==='approved').reduce((s,a)=>s+a.days,0);if(!balance||reserved+row.days>balance.grantedDays)fail('Saldo disponível insuficiente.',409);}row.status=data.decision;}else{if(!['pending','approved'].includes(row.status))fail('Solicitação indisponível.',409);row.status='cancelled';}row.reviewedBy=context.actor.uid;row.reviewReason=reason;row.version++;row.updatedAt=now();return {record:dto(row)};});
    }
    if(action==='hr-balance-save') {
      privileged(context);target(context,data.uid);
      return mutate(context,action,data,()=>{range(data.periodStart,data.periodEnd,1096);text(data.reason,10,1000);const grantedDays=Number(data.grantedDays);if(!Number.isInteger(grantedDays)||grantedDays<0||grantedDays>366)fail('Saldo inválido.');let row;if(data.id){row=item(context,balances,data.id);validVersion(row,data.version);if(row.uid!==data.uid||row.periodStart!==data.periodStart||row.periodEnd!==data.periodEnd)fail('O período não pode mudar.',409);const reserved=[...absences.values()].filter(a=>a.balanceId===row.id&&a.status==='approved').reduce((s,a)=>s+a.days,0);if(grantedDays<reserved)fail('Saldo menor que os dias reservados.',409);row.grantedDays=grantedDays;row.version++;}else{if(data.version!==0||[...balances.values()].some(b=>b.uid===data.uid&&b.periodStart<=data.periodEnd&&b.periodEnd>=data.periodStart))fail('Período sobreposto.',409);row={id:crypto.randomUUID(),uid:data.uid,periodStart:data.periodStart,periodEnd:data.periodEnd,grantedDays,version:1};balances.set(row.id,row);}return {record:dto(row)};});
    }
    if(action==='hr-process-create') {
      privileged(context);target(context,data.uid);
      return mutate(context,action,data,()=>{text(data.reason,10,1000);if(!['onboarding','offboarding'].includes(data.type)||!Array.isArray(data.steps)||data.steps.length<1||data.steps.length>20)fail('Processo inválido.');if([...processes.values()].some(p=>p.uid===data.uid&&p.type===data.type&&p.status==='open'))fail('Já existe um processo aberto deste tipo.',409);const steps=data.steps.map(s=>{owner(context,data.uid,s.ownerUid);date(s.dueOn);return {id:crypto.randomUUID(),title:text(s.title,3,180),ownerUid:s.ownerUid,dueOn:s.dueOn,status:'open',version:1,completedBy:null,completedAt:null};});const row={id:crypto.randomUUID(),uid:data.uid,type:data.type,steps,status:'open',version:1,createdBy:context.actor.uid,createdAt:now(),closedBy:null,closedAt:null,closeReason:null};processes.set(row.id,row);return {record:dto(row)};});
    }
    if(action==='hr-step-save') {
      const row=item(context,processes,data.id),step=row.steps.find(s=>s.id===data.stepId);if(!step)fail('Etapa não encontrada.',404);if(!(managed(context,row.uid)||own(context,row.uid))||!context.privileged&&step.ownerUid!==context.actor.uid)fail('Etapa fora da sua responsabilidade.',403);if((data.ownerUid!==undefined||data.dueOn!==undefined)&&!context.privileged)fail('Reatribuição reservada ao RH.',403);
      return mutate(context,action,data,()=>{validVersion(row,data.version);validVersion(step,data.stepVersion);text(data.reason,10,1000);if(row.status!=='open'||!['open','completed'].includes(data.status))fail('Etapa indisponível.',409);const ownerUid=data.ownerUid??step.ownerUid,dueOn=data.dueOn??step.dueOn;owner(context,row.uid,ownerUid);date(dueOn);Object.assign(step,{ownerUid,dueOn,status:data.status,version:step.version+1,completedBy:data.status==='completed'?context.actor.uid:null,completedAt:data.status==='completed'?now():null});row.version++;return {record:dto(row)};});
    }
    if(action==='hr-process-close') {
      const row=item(context,processes,data.id);privileged(context);
      if(row.type==='offboarding'&&(context.role!=='admin'||row.uid===context.actor.uid||target(context,row.uid).role==='admin'))fail('Conta protegida ou conclusão reservada ao ADMIN.',403);
      if(row.type==='offboarding'&&data.revokeAccess!==true)fail('Confirme o bloqueio de acesso.');
      return mutate(context,action,data,async()=>{validVersion(row,data.version);const reason=text(data.reason,10,1000);if(row.status!=='open'||row.steps.some(s=>s.status!=='completed'))fail('Conclua todas as etapas antes de encerrar.',409);if(row.type==='offboarding'){if(blockAccount)await blockAccount(row.uid);else peopleDemo.synchronizeAccount({uid:row.uid,status:'blocked'});const rule=rules.get(row.uid);if(rule){rule.enabled=0;rule.version++;}}Object.assign(row,{status:'closed',accessRevoked:row.type==='offboarding',version:row.version+1,closedBy:context.actor.uid,closedAt:now(),closeReason:reason});return {record:dto(row)};});
    }
    fail('Ação indisponível.',404);
  }
  return {request,async reportSnapshot(){const context=await scope();privileged(context);const visible=row=>structuredClone({...row,personName:target(context,row.uid).name});return {people:context.people,absences:[...absences.values()].map(visible),processes:[...processes.values()].map(visible)};}};
}
