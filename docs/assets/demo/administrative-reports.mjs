const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const date=value=>{const parsed=new Date(value+'T12:00:00Z');if(!/^20\d{2}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)fail('Data inválida.');return value;};
const labels={pending:'Pendente',approved:'Aprovada',rejected:'Não aprovada',cancelled:'Cancelada',active:'Ativo',archived:'Arquivado',published:'Publicada',draft:'Rascunho',self:'Autoavaliação',manager:'Avaliação do gestor'};
export async function administrativeDemoReport(action,{query='',peopleDemo,hrDemo,developmentDemo}) {
  const context=await peopleDemo.request('people-context');if(!['admin','hr'].includes(context.role))fail('Relatórios restritos ao RH e ADMIN.',403);
  const snapshot=await hrDemo.reportSnapshot(),people=snapshot.people.filter(person=>person.status!=='deleted');
  if(action==='hr-report-directory')return {people:people.map(({uid,name})=>({uid,name}))};
  const params=new URLSearchParams(query),today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),from=date(params.get('from')||today.slice(0,4)+'-01-01'),to=date(params.get('to')||today),uid=params.get('uid')||'';
  const days=(Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000+1;if(days<1||days>366)fail('Período de até 366 dias.');
  const selected=people.filter(person=>!uid||person.uid===uid);if(uid&&!selected.length)fail('Colaborador não encontrado.',404);
  const visible=new Set(selected.map(person=>person.uid)),vacations=snapshot.absences.filter(row=>visible.has(row.uid)&&row.type==='vacation'&&row.startOn<=to&&row.endOn>=from),documents=[];
  for(const person of selected)for(const archived of [false,true]) {
    let offset=0;
    do {const page=await peopleDemo.request('people-documents',{query:'&uid='+encodeURIComponent(person.uid)+'&archived='+(archived?'1':'0')+'&offset='+offset});
      documents.push(...page.rows.filter(row=>row.createdAt.slice(0,10)>=from&&row.createdAt.slice(0,10)<=to||row.expiresOn&&row.expiresOn>=from&&row.expiresOn<=to).map(row=>({...row,personName:person.name})));offset=page.nextOffset;
    }while(Number.isInteger(offset));
  }
  const reviews=(await developmentDemo.reportReviews()).filter(row=>visible.has(row.uid)&&row.cycle.startOn<=to&&row.cycle.endOn>=from),processes=snapshot.processes.filter(row=>visible.has(row.uid)&&((row.createdAt.slice(0,10)>=from&&row.createdAt.slice(0,10)<=to)||(row.closedAt&&row.closedAt.slice(0,10)>=from&&row.closedAt.slice(0,10)<=to)));
  const counts=[['Pessoas no escopo atual',selected.length],['Férias pendentes no período',vacations.filter(row=>row.status==='pending').length],['Férias aprovadas no período',vacations.filter(row=>row.status==='approved').length],['Dias aprovados nas solicitações listadas',vacations.filter(row=>row.status==='approved').reduce((sum,row)=>sum+row.days,0)],['Documentos listados',documents.length],['Documentos listados vencidos',documents.filter(row=>row.status==='active'&&row.expiresOn&&row.expiresOn<today).length],['Avaliações publicadas',reviews.filter(row=>row.status==='published').length],['Processos abertos',processes.filter(row=>row.status==='open').length]];
  const section=(id,title,columns,rows)=>({id,title,columns,rows});
  return {schemaVersion:1,demo:true,generatedAt:new Date().toISOString(),from,to,filterLabel:uid?selected[0].name:'Todas as pessoas',scope:context.role,counts,notes:['Dados fictícios do demonstrativo, alterados em memória e descartados ao recarregar.','Férias que intersectam o período, com duração integral da solicitação. Documentos criados ou com vencimento no intervalo.','Avaliações por ciclos que intersectam o intervalo; notas somente quando publicadas; comentários e conteúdo de anexos não integram o arquivo.','Indicadores referem-se aos dados listados. Registros de ponto não integram a exportação.'],
    sections:[section('vacations','Férias',['Colaborador','Início','Fim','Dias corridos','Situação','Solicitada em'],vacations.map(row=>[row.personName,row.startOn,row.endOn,row.days,labels[row.status],row.createdAt.slice(0,10)])),
      section('documents','Documentos',['Colaborador','Título','Categoria','Tipo','Bytes','Situação','Vencimento','Cadastro'],documents.map(row=>[row.personName,row.title,row.category,row.contentType,row.bytes,labels[row.status],row.expiresOn||'',row.createdAt.slice(0,10)])),
      section('reviews','Avaliações',['Colaborador','Ciclo','Tipo','Avaliador','Nota publicada','Situação','Atualização'],reviews.map(row=>[row.personName,row.cycle.title,labels[row.kind],row.reviewerName,row.status==='published'?row.rating:null,labels[row.status],row.updatedAt.slice(0,10)])),
      section('indicators','Indicadores',['Indicador','Quantidade'],counts)]};
}
