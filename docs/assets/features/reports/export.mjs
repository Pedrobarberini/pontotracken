export function administrativeWorkbook(report,XLSX) {
  if(!XLSX?.utils?.aoa_to_sheet)throw new Error('A biblioteca de Excel ainda não está pronta. Tente novamente.');
  const book=XLSX.utils.book_new(),context=[['Tracken Pessoas','Relatório administrativo'],['Modo',report.demo?'Demonstrativo':'Aplicativo'],['Gerado em',report.generatedAt],['De',report.from],['Até',report.to],['Colaborador',report.filterLabel],[],['Critérios'],...report.notes.map(note=>[note])];
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(context),'Contexto');
  for(const section of report.sections){const rows=[section.columns,...section.rows.map(row=>row.map(value=>typeof value==='string'?String(value):value))],sheet=XLSX.utils.aoa_to_sheet(rows);
    // Explicit string cells remain literal even when text starts with a formula character.
    for(const cell of Object.values(sheet)){if(cell&&typeof cell==='object'&&cell.t==='s')delete cell.f;}
    sheet['!cols']=section.columns.map((_,index)=>({wch:Math.min(55,Math.max(16,...rows.map(row=>String(row[index]??'').length).slice(0,100)))}));
    XLSX.utils.book_append_sheet(book,sheet,section.title.slice(0,31));}
  return XLSX.write(book,{bookType:'xlsx',type:'array',compression:true});
}
export function saveReport(contents,type,filename){const url=URL.createObjectURL(new Blob([contents],{type})),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
