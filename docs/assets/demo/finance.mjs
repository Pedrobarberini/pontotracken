import {overtimeInput,rateInput,paymentInput,overtimeCalculation,filters,reason,dueDate} from '../vendor/finance-policy.mjs?v=payments-2';
import {overtimeDTO,paymentDTO,rateDTO,minutesOf} from '../vendor/finance-presenter.mjs?v=payments-2';

/** Fictitious, volatile records only. No Firebase, database or payment provider. */
export function createFinanceDemo({peopleDemo,clock=()=>new Date()}){
  const rates=new Map(),overtime=new Map(),payments=new Map(),allocations=new Map(),receipts=new Map(),audit=[];
  const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
  const directory=()=>peopleDemo.financeDirectory(),actor=()=>directory().find(person=>person.uid===peopleDemo.sessionUser().uid),privileged=()=>['admin','hr'].includes(actor().role);
  const target=uid=>{const row=directory().find(person=>person.uid===uid);if(!row||row.status==='deleted')fail('Pessoa não encontrada.',404);return row;};
  const scoped=uid=>privileged()||uid===actor().uid||actor().role==='manager'&&target(uid).managerUid===actor().uid;
  const requireFinance=()=>{if(!privileged())fail('Acesso restrito ao RH ou ADMIN.',403);};
  const allowedApprovers=uid=>directory().filter(person=>person.status==='active'&&person.uid!==uid&&(['admin','hr'].includes(person.role)||person.role==='manager'&&target(uid).managerUid===person.uid));
  const rule=(uid,date)=>[...rates.values()].filter(row=>row.uid===uid&&row.effective_on<=date).sort((a,b)=>b.effective_on.localeCompare(a.effective_on))[0]||null;
  const personName=uid=>target(uid).name;
  const hydrate=row=>({...row,person_name:personName(row.uid),approver_name:row.approver_uid?personName(row.approver_uid):'',payment_id:allocations.get(row.id)||null});
  const getOvertime=id=>{const row=overtime.get(id);if(!row||!scoped(row.uid))fail('Hora extra não encontrada.',404);return row;};
  const getPayment=id=>{requireFinance();const row=payments.get(id);if(!row)fail('Pagamento não encontrado.',404);return row;};
  const version=(row,input)=>{if((row?.version||0)!==input.version)fail('O registro mudou. Atualize a tela.',409);};
  const time=()=>new Date(clock()).toISOString();
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(clock()));
  const rateSeed=(uid,monthly)=>rates.set(uid+':2020-01-01',{uid,effective_on:'2020-01-01',remuneration_cents:monthly,divisor_hundredths:22000,premium_bps:5000,version:1});
  rateSeed('ana',300000);rateSeed('bruno',400000);
  const seedDate=new Date(Date.parse(today()+'T12:00:00Z')-86400000).toISOString().slice(0,10);
  overtime.set('demo-finance-overtime',{id:'demo-finance-overtime',uid:'ana',work_date:seedDate,start_at:seedDate+'T20:00:00.000Z',end_at:seedDate+'T21:00:00.000Z',reason:'Atendimento adicional demonstrativo para concluir a revisão de chamados e acompanhar a entrega solicitada pela liderança da equipe de suporte.',approver_uid:'bruno',status:'pending',version:1,finance_managed:1,amount_cents:null,created_at:time()});
  function paginate(rows,input){return {rows:rows.slice(input.offset,input.offset+50),nextOffset:rows.length>input.offset+50?input.offset+50:null};}
  function eligible(row,uid,period){return row.uid===uid&&row.work_date.slice(0,7)===period&&row.status==='approved'&&row.finance_managed===1&&row.amount_cents!==null&&!allocations.has(row.id);}
  return async function request(action,{data={},query=''}={}){
    if(!action.startsWith('finance-'))return null;
    if(actor().status!=='active')fail('Esta conta não está ativa.',403);
    const params=new URLSearchParams(query.replace(/^&/,''));
    if(action==='finance-context')return {uid:actor().uid,role:actor().role,canManagePayments:privileged(),people:directory().filter(person=>['active','blocked'].includes(person.status)&&scoped(person.uid)).map(({uid,name,status})=>({uid,name,status})),timezone:'America/Sao_Paulo'};
    if(action==='finance-overtime-approvers'){const uid=params.get('uid')||actor().uid;if(uid!==actor().uid&&!privileged())fail('Você só pode registrar suas próprias horas.',403);target(uid);return {people:allowedApprovers(uid).map(({uid,name})=>({uid,name}))};}
    if(action==='finance-people'){requireFinance();const input=filters(params),last=input.period+'-31',rows=directory().filter(person=>['active','blocked'].includes(person.status)&&(!input.uid||person.uid===input.uid)).sort((a,b)=>a.name.localeCompare(b.name)).map(person=>({...person,suggestedDueOn:person.paymentDay?dueDate(input.period,person.paymentDay):null,rate:rateDTO(rule(person.uid,last))}));return paginate(rows,input);}
    if(action==='finance-overtime'){const input=filters(params),rows=[...overtime.values()].filter(row=>scoped(row.uid)&&row.work_date.slice(0,7)===input.period&&(!input.uid||row.uid===input.uid)).sort((a,b)=>b.start_at.localeCompare(a.start_at));return {...paginate(rows.map(row=>overtimeDTO(hydrate(row),actor())),input),totals:{approved_minutes:rows.filter(row=>row.status==='approved').reduce((sum,row)=>sum+minutesOf(row),0),pending:rows.filter(row=>row.status==='pending').length,missing_price:rows.filter(row=>row.status==='approved'&&row.amount_cents===null).length,approved_cents:rows.filter(row=>row.status==='approved').reduce((sum,row)=>sum+(row.amount_cents||0),0)}};}
    if(action==='finance-payments'){requireFinance();const input=filters(params),rows=[...payments.values()].filter(row=>row.period===input.period&&(!input.uid||input.uid===row.uid)).sort((a,b)=>b.due_on.localeCompare(a.due_on));return {...paginate(rows.map(row=>paymentDTO({...row,person_name:personName(row.uid)})),input),totals:{count:rows.length,planned_cents:rows.filter(row=>row.status==='planned').reduce((sum,row)=>sum+row.total_cents,0),paid_cents:rows.filter(row=>row.status==='paid').reduce((sum,row)=>sum+row.total_cents,0)}};}
    if(action==='finance-payment-available'){requireFinance();const input=filters(params);target(input.uid);const rows=[...overtime.values()].filter(row=>eligible(row,input.uid,input.period)).map(row=>({id:row.id,date:row.work_date,startAt:row.start_at,endAt:row.end_at,amountCents:row.amount_cents}));return {rows:rows.slice(0,100),truncated:rows.length>100};}
    if(action==='finance-audit'){requireFinance();const input=filters(params);return {rows:audit.filter(row=>row.created_at.startsWith(input.period)&&(!input.uid||row.target_uid===input.uid)).slice(-100).reverse()};}
    if(!/^[A-Za-z0-9-]{16,64}$/.test(data.requestId||''))fail('Identificador de envio inválido.');
    const receiptKey=actor().uid+':'+action+':'+data.requestId,signature=JSON.stringify(data);if(receipts.has(receiptKey)){const saved=receipts.get(receiptKey);if(saved.signature!==signature)fail('Este envio já foi utilizado com outros dados.',409);return structuredClone(saved.result);}
    let result,changedUid,resource;
    if(action==='finance-rate-save'){
      requireFinance();const input=rateInput(data);target(input.uid);const key=input.uid+':'+input.effectiveOn,before=rates.get(key);version(before,input);const row={uid:input.uid,effective_on:input.effectiveOn,remuneration_cents:input.remunerationCents,divisor_hundredths:input.divisorHundredths,premium_bps:input.premiumBps,version:input.version+1};rates.set(key,row);result={rate:rateDTO(row)};changedUid=input.uid;resource=key;
    }else if(action==='finance-overtime-save'){
      const input=overtimeInput(data),person=target(input.uid);if(input.uid!==actor().uid&&!privileged())fail('Você não pode registrar horas para esta pessoa.',403);if(person.status!=='active')fail('Conta sem acesso ativo.',409);if(!allowedApprovers(input.uid).some(person=>person.uid===input.approverUid))fail('Responsável inválido.',403);
      const before=input.id?getOvertime(input.id):null;version(before,input);if(before&&(before.uid!==input.uid||before.status!=='pending'||allocations.has(before.id)))fail('Esta ocorrência não pode ser alterada.',409);
      if([...overtime.values()].some(row=>row.uid===input.uid&&row.id!==input.id&&['pending','running','approved'].includes(row.status)&&row.start_at<input.endAt&&(row.end_at||'9999')>input.startAt))fail('Já existe uma ocorrência nesse período.',409);
      const row={id:before?.id||crypto.randomUUID(),uid:input.uid,work_date:input.date,start_at:input.startAt,end_at:input.endAt,reason:input.justification,approver_uid:input.approverUid,status:'pending',version:input.version+1,finance_managed:1,amount_cents:null,created_at:before?.created_at||time()};overtime.set(row.id,row);result={record:overtimeDTO(hydrate(row),actor())};changedUid=row.uid;resource=row.id;
    }else if(['finance-overtime-decision','finance-overtime-price','finance-overtime-cancel'].includes(action)){
      const before=getOvertime(data.id);version(before,data);const row={...before};if(action==='finance-overtime-decision'){
        if(row.approver_uid!==actor().uid||row.uid===actor().uid||!allowedApprovers(row.uid).some(person=>person.uid===actor().uid))fail('Somente o responsável indicado pode decidir.',403);if(row.status!=='pending'||!['approved','rejected'].includes(data.decision))fail('Ocorrência indisponível.',409);
        reason(data.reason);row.status=data.decision;row.reviewed_by=actor().uid;row.review_reason=data.reason;const base=row.status==='approved'?rule(row.uid,row.work_date):null;row.amount_cents=base?overtimeCalculation(base,minutesOf(row)).amountCents:null;
      }else if(action==='finance-overtime-price'){
        requireFinance();reason(data.reason);if(row.status!=='approved'||row.amount_cents!==null||allocations.has(row.id))fail('Cálculo indisponível.',409);const base=rule(row.uid,row.work_date);if(!base)fail('Configure uma base vigente na data da ocorrência.',409);row.amount_cents=overtimeCalculation(base,minutesOf(row)).amountCents;
      }else{reason(data.reason);if(!privileged()&&row.uid!==actor().uid||row.status==='approved'&&!privileged())fail('Você não pode cancelar.',403);if(!['pending','approved'].includes(row.status)||allocations.has(row.id))fail('Ocorrência indisponível para cancelamento.',409);row.status='cancelled';}
      row.version++;overtime.set(row.id,row);result={record:overtimeDTO(hydrate(row),actor())};changedUid=row.uid;resource=row.id;
    }else if(action==='finance-payment-save'){
      requireFinance();const input=paymentInput(data);target(input.uid);const before=input.id?getPayment(input.id):null;version(before,input);if(before&&(before.status!=='planned'||before.uid!==input.uid||before.period!==input.period||input.overtimeIds.length))fail('Somente lançamentos previstos podem ser editados, preservando os vínculos.',409);
      const selected=input.overtimeIds.map(id=>overtime.get(id));if(selected.some(row=>!row||!eligible(row,input.uid,input.period)))fail('Há horas indisponíveis ou já vinculadas.',409);const extra=before?.overtime_cents||selected.reduce((sum,row)=>sum+row.amount_cents,0),total=input.baseCents+extra;if(total<=0)fail('Informe um total maior que zero.');
      const row={id:before?.id||crypto.randomUUID(),uid:input.uid,period:input.period,due_on:input.dueOn,description:input.description,base_cents:input.baseCents,overtime_cents:extra,total_cents:total,status:'planned',paid_on:null,version:input.version+1,created_at:before?.created_at||time(),updated_at:time()};payments.set(row.id,row);for(const extra of selected)allocations.set(extra.id,row.id);result={record:paymentDTO({...row,person_name:personName(row.uid)})};changedUid=row.uid;resource=row.id;
    }else if(action==='finance-payment-transition'){
      const before=getPayment(data.id);version(before,data);reason(data.reason);if(!(before.status==='planned'&&['paid','cancelled'].includes(data.status)||before.status==='paid'&&data.status==='planned'))fail('Transição indisponível.',409);if(data.status==='paid'&&(!/^\d{4}-\d{2}-\d{2}$/.test(data.paidOn)||data.paidOn>today()))fail('Data de pagamento inválida.');const row={...before,status:data.status,paid_on:data.status==='paid'?data.paidOn:null,version:before.version+1,updated_at:time()};payments.set(row.id,row);if(row.status==='cancelled')for(const [key,value] of allocations)if(value===row.id)allocations.delete(key);result={record:paymentDTO({...row,person_name:personName(row.uid)})};changedUid=row.uid;resource=row.id;
    }else fail('Operação financeira desconhecida.',404);
    audit.push({id:crypto.randomUUID(),action:action.replace('finance-','finance:'),resource_id:resource,target_uid:changedUid,person_name:personName(changedUid),actor_name:actor().name,reason:data.reason||data.justification,created_at:time()});receipts.set(receiptKey,{signature,result:structuredClone(result)});return structuredClone(result);
  };
}
