import {escapeHTML as e} from '../../shared/dom.mjs?v=integrity-1';

const countNames=['documents','objects','matched','missing','mismatched','unverified','unreferenced','recent','invalid'];
const emptyCounts=()=>Object.fromEntries(countNames.map(key=>[key,0]));
const reasons={'missing-object':'Arquivo ausente','size':'Tamanho divergente','content-type':'Tipo divergente','hash-metadata':'Hash dos metadados divergente','incomplete-metadata':'Metadados incompletos','invalid-reference':'Referência inválida','read-unavailable':'Leitura indisponível','recent-upload':'Envio recente sem vínculo; conferir novamente','unknown-upload-time':'Data do arquivo indisponível','no-reference':'Arquivo sem vínculo no cadastro; investigar'};
const attention=counts=>counts.missing+counts.mismatched+counts.unverified+counts.unreferenced+counts.recent+counts.invalid;
const date=value=>Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value)):'—';

export function renderDocumentIntegrity(report) {
  if(!report)return '<p class="field-hint">Inicie para conferir documentos e arquivos. Nenhuma conferência foi executada nesta sessão.</p>';
  const counts=report.counts,warning=attention(counts);
  const status=report.complete?(warning?'Conferência concluída com pontos a investigar':'Sem divergências nos metadados'):report.running?'Conferência em andamento':'Conferência parcial';
  return `${report.demo?'<p class="monitor-demo">Conferência simulada. Nenhum banco ou arquivo real foi consultado.</p>':''}
    <p><strong>${e(status)}</strong></p><p class="field-hint">${e(date(report.checkedAt))} · ${report.pages} lotes · ${counts.documents} de ${report.totalDocuments} documentos conferidos · ${counts.objects} arquivos de documentos listados</p>
    <div class="integrity-totals">${[['Metadados compatíveis',counts.matched],['Arquivos ausentes',counts.missing],['Metadados divergentes',counts.mismatched],['Arquivos sem vínculo',counts.unreferenced],['Envios recentes sem vínculo',counts.recent],['Leituras ou referências a revisar',counts.unverified+counts.invalid]].map(([label,value])=>`<div><span>${e(label)}</span><strong>${value}</strong></div>`).join('')}</div>
    ${report.issues.length?`<details class="monitor-checklist"><summary>Ver referências que precisam de análise (${report.issues.length}${report.issuesTruncated?' · lista limitada':''})</summary><div class="table-scroll"><table class="records-table"><thead><tr><th>Referência técnica</th><th>Resultado</th></tr></thead><tbody>${report.issues.map(item=>`<tr><td><code>${e(item.reference)}</code></td><td>${item.reasons.map(reason=>e(reasons[reason]||'Verificar metadados')).join('; ')}</td></tr>`).join('')}</tbody></table></div></details>`:''}
    ${!report.complete?'<p class="field-hint">Resultado parcial. Os itens ainda não conferidos não têm resultado. Continue a conferência ou reinicie.</p>':''}`;
}

export function createDocumentIntegrity({host,api,save,pause=()=>new Promise(resolve=>setTimeout(resolve,250)),pageLimit=200,issueLimit=500}) {
  if(!host?.querySelector)return {setActive(){},reset(){}};
  host.innerHTML='<section class="history-card monitoring-card"><div class="card-heading"><div><h2>Conferência de documentos</h2><p>Compare os cadastros com os metadados dos arquivos privados.</p></div><button class="button primary" type="button" data-integrity-start>Conferir documentos</button></div><div class="monitor-toolbar"><div class="integrity-actions"><button class="button secondary" type="button" data-integrity-resume hidden>Continuar conferência</button><button class="button secondary" type="button" data-integrity-cancel hidden>Interromper</button><button class="button secondary" type="button" data-integrity-export disabled>Baixar relatório</button></div></div><div class="data-error" data-integrity-error role="alert" hidden></div><div data-integrity-results aria-live="polite"></div><p class="field-hint monitor-limits">Inclui documentos ativos e arquivados. Backups ficam fora deste inventário. Compara existência, tamanho, tipo e hash guardado nos metadados; o conteúdo não é baixado nem tem seu hash recalculado. Envios e alterações simultâneos podem produzir avisos temporários: repita a conferência ao final. Nenhum arquivo é corrigido ou excluído automaticamente.</p></section>';
  const $=selector=>host.querySelector(selector);
  let active=false,epoch=0,busy=false,report=null,next=null,restartRequired=false;
  function render() {
    $('[data-integrity-results]').innerHTML=renderDocumentIntegrity(report);
    $('[data-integrity-start]').disabled=busy;
    $('[data-integrity-cancel]').hidden=!busy;
    $('[data-integrity-resume]').hidden=busy||!report||report.complete||!next||restartRequired;
    $('[data-integrity-export]').disabled=!report;
  }
  function interrupt() {epoch++;busy=false;if(report)report.running=false;render();}
  function applyPage(page) {
    if(page.schemaVersion!==1||page.readOnly!==true||page.metadataOnly!==true||!Array.isArray(page.issues)||page.issues.length>10||
      !Number.isSafeInteger(page.totalDocuments)||page.totalDocuments<0||!countNames.every(key=>Number.isSafeInteger(page.counts?.[key])&&page.counts[key]>=0&&page.counts[key]<=10)||
      page.complete!==(page.next===null))throw new Error('Resposta de conferência inválida. Reinicie a verificação.');
    if(!report)report={schemaVersion:1,readOnly:true,metadataOnly:true,demo:page.demo===true,release:page.release,startedAt:page.startedAt,checkedAt:page.checkedAt,
      complete:false,running:true,pages:0,totalDocuments:page.totalDocuments,counts:emptyCounts(),issues:[],issuesTruncated:false,
      coverage:{contentHashRecomputed:false,atomicSnapshot:false,automaticDeletion:false}};
    if(page.revision!==undefined&&report.revision!==undefined&&page.revision!==report.revision)throw new Error('Os documentos mudaram. Reinicie a conferência.');
    report.revision=page.revision;report.pages++;report.checkedAt=page.checkedAt;report.complete=page.complete;
    for(const key of countNames)report.counts[key]+=page.counts[key];
    const available=issueLimit-report.issues.length;
    report.issues.push(...page.issues.slice(0,available));report.issuesTruncated||=page.issues.length>available;
    next=page.next;
  }
  async function run({fresh=false}={}) {
    if(!active||busy)return;
    if(fresh){report=null;next={phase:'documents'};restartRequired=false;}
    if(!next||restartRequired)return;
    busy=true;const generation=++epoch;if(report)report.running=true;$('[data-integrity-error]').hidden=true;render();
    try {
      for(let pages=0;pages<pageLimit&&next;pages++) {
        if(generation!==epoch||!active)return;
        if(document.hidden||host.closest?.('.view')?.hidden){interrupt();return;}
        const query='&'+Object.entries(next).map(([key,value])=>encodeURIComponent(key)+'='+encodeURIComponent(value)).join('&');
        const previous=JSON.stringify(next),page=await api('admin-document-integrity',{query});
        if(generation!==epoch||!active)return;
        if(page.next&&JSON.stringify(page.next)===previous)throw new Error('A página não avançou. Reinicie a conferência.');
        applyPage(page);render();if(next)await pause();
      }
    }catch(error) {
      if(generation!==epoch||!active)return;
      restartRequired=['INTEGRITY_CHANGED','INTEGRITY_EXPIRED'].includes(error.code);
      $('[data-integrity-error]').textContent=error.message;$('[data-integrity-error]').hidden=false;
    }finally{if(generation===epoch){busy=false;if(report)report.running=false;render();}}
  }
  $('[data-integrity-start]').onclick=()=>run({fresh:true});
  $('[data-integrity-resume]').onclick=()=>run();
  $('[data-integrity-cancel]').onclick=interrupt;
  $('[data-integrity-export]').onclick=()=>{if(active&&report)save(JSON.stringify({...report,running:false},null,2)+'\n','application/json','TrackenPessoas-conferencia-documentos-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');};
  render();
  return {setActive(value){active=value;if(!value)interrupt();},reset(){active=false;epoch++;busy=false;report=null;next=null;restartRequired=false;$('[data-integrity-error]').hidden=true;render();}};
}
