import {noticeInput,archiveNoticeInput} from '../vendor/hr-planning.mjs?v=demand-notices-1';

const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};

/** Company notices in synthetic memory only, independent of real employees and storage. */
export function createPlanningNoticeDemo({now,today}) {
  const notices=new Map();
  const period=today().slice(0,7);
  notices.set('demo-demand-closing',{
    id:'demo-demand-closing',title:'Cobertura no fechamento do mês',
    message:'Dias de maior demanda para a equipe. Você pode solicitar o período; a gestão avaliará a cobertura.',
    dates:[period+'-20',period+'-23'],status:'active',version:1,
    createdBy:'demo-marina',createdAt:now(),updatedAt:now()
  });
  const active=()=>[...notices.values()].filter(row=>row.status==='active').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id)).map(row=>structuredClone(row));
  const requireManager=context=>{if(!context.privileged)fail('Ação reservada ao RH e ADMIN.',403);};
  const list=(context,status='active')=>{
    if(!['active','archived'].includes(status))fail('Situação de aviso inválida.');
    if(status==='archived')requireManager(context);
    return {rows:[...notices.values()].filter(row=>row.status===status).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id)).map(row=>structuredClone(row)),truncated:false,canManage:context.privileged};
  };
  async function save(context,data,mutate) {
    requireManager(context);
    const input=noticeInput(data);
    return mutate(context,'hr-notice-save',data,()=>{
      const before=input.id?notices.get(input.id):null;
      if(input.id&&!before)fail('Aviso não encontrado.',404);
      if(before&&(before.version!==input.version||before.status!=='active'))fail('O aviso mudou. Atualize os dados.',409);
      if(!before&&(input.version!==0||active().length>=200))fail('Não é possível criar mais avisos ativos ou a versão inicial mudou.',409);
      const row={id:before?.id||crypto.randomUUID(),title:input.title,message:input.message,dates:input.dates,
        status:'active',version:(before?.version||0)+1,createdBy:before?.createdBy||context.actor.uid,
        createdAt:before?.createdAt||now(),updatedAt:now()};
      notices.set(row.id,row);
      return {record:structuredClone(row)};
    });
  }
  async function archive(context,data,mutate) {
    requireManager(context);
    const input=archiveNoticeInput(data);
    return mutate(context,'hr-notice-archive',data,()=>{
      const row=notices.get(input.id);
      if(!row)fail('Aviso não encontrado.',404);
      if(row.version!==input.version||row.status!=='active')fail('O aviso mudou. Atualize os dados.',409);
      Object.assign(row,{status:'archived',version:row.version+1,updatedAt:now()});
      return {record:structuredClone(row)};
    });
  }
  return {active,list,save,archive};
}
