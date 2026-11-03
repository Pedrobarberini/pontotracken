import {escapeHTML as e} from '../../shared/dom.mjs?v=monitoring-1';

const labels={preparing:'Preparando banco',copying:'Copiando documentos',ready:'Pronto para baixar',failed:'Não concluído',cancelled:'Cancelado'};
const bytes=value=>{const unit=value>=1024*1024?'MB':value>=1024?'KB':'B';const divisor=unit==='MB'?1024*1024:unit==='KB'?1024:1;return new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(value/divisor)+' '+unit;};
const when=value=>value?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value)):'—';

export function createBackups({host,api,downloadBackup,toast}){
  if(!host)return {load:async()=>{},reset(){}};
  host.innerHTML=`<section class="history-card registration-card"><div class="card-heading"><div><h2>Backup e recuperação</h2><p>Cópias manuais e criptografadas dos dados e documentos da empresa.</p></div><button type="button" class="button primary" data-backup-new>Gerar backup</button></div><p class="field-hint">A restauração é feita em ambiente separado, usando a chave privada guardada fora do aplicativo. Não há agendamento nem exclusão automática de cópias.</p><div data-backup-note class="backup-note" role="status"></div><div data-backup-progress role="status" aria-live="polite" hidden></div><div data-backup-error class="data-error" role="alert" hidden></div><div data-backup-list></div><div class="admin-pagination"><button type="button" class="button secondary" data-backup-prev disabled>Anterior</button><span data-backup-page></span><button type="button" class="button secondary" data-backup-next disabled>Próxima</button><button type="button" class="button secondary" data-backup-refresh>Atualizar</button></div></section>`;
  const $=selector=>host.querySelector(selector),dialog=document.createElement('dialog');
  dialog.className='confirm-dialog admin-dialog';dialog.setAttribute('aria-label','Backup administrativo');document.body.append(dialog);
  let epoch=0,sequence=0,rows=[],offset=0,nextOffset=null,processing=false,requestId=null,configured=false;
  const report=error=>{$('[data-backup-error]').hidden=false;$('[data-backup-error]').textContent=error.message;};
  const controls=()=>{for(const button of host.querySelectorAll('button'))button.disabled=processing;$('[data-backup-new]').disabled=processing||!configured;$('[data-backup-prev]').disabled=processing||!offset;$('[data-backup-next]').disabled=processing||nextOffset===null;};
  function render(){
    $('[data-backup-list]').innerHTML=rows.length?`<div class="table-scroll"><table class="records-table backup-table"><thead><tr><th>Cópia</th><th>Situação</th><th>Documentos</th><th>Tamanho</th><th>Ações</th></tr></thead><tbody>${rows.map(row=>`<tr><td><strong>${e(when(row.createdAt))}</strong><small class="admin-email">${e(row.id.slice(0,8))} · chave ${e(row.keyId.slice(0,12))}</small>${row.snapshotAt?`<small class="admin-email">Dados de ${e(when(row.snapshotAt))}</small>`:''}</td><td><span class="status ${row.status==='ready'?'':row.status==='failed'?'blocked':'pending'}">${e(labels[row.status]||row.status)}</span>${row.failure?`<small class="admin-email">${e(row.failure)}</small>`:''}</td><td>${row.copiedDocuments} / ${row.documents}</td><td>${e(bytes(row.bytes))}</td><td><div class="admin-row-actions">${row.downloadReady?`<button class="button secondary small" data-backup-download="${e(row.id)}">Baixar cópia</button>`:''}${['preparing','copying'].includes(row.status)?`<button class="button secondary small" data-backup-continue="${e(row.id)}">Continuar</button><button class="text-button" data-backup-cancel="${e(row.id)}">Cancelar</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state">Nenhum backup gerado nesta lista.</div>';
    $('[data-backup-page]').textContent='Página '+(offset/20+1);controls();
  }
  async function load(){
    const generation=epoch,request=++sequence;$('[data-backup-error]').hidden=true;
    try{
      const result=await api('admin-backups',{query:'&offset='+offset});
      if(generation!==epoch||request!==sequence)return;
      rows=result.rows;nextOffset=result.nextOffset;configured=result.configured;
      $('[data-backup-note]').textContent=result.demo?'O demonstrativo não gera backups de contas reais. Use o aplicativo autenticado para criar uma cópia.':!configured?'A chave de recuperação ainda precisa ser configurada pela operação.':`Download em arquivo .tpbackup. Limites desta versão: banco de até ${bytes(result.limits.databaseBytes)} e conteúdo original de até ${bytes(result.limits.sourceBytes)} por cópia. Guarde também uma cópia fora da hospedagem.`;
      render();
    }catch(error){if(generation===epoch&&request===sequence)report(error);}
  }
  async function process(row){
    const generation=epoch;processing=true;controls();const progress=$('[data-backup-progress]');progress.hidden=false;
    try{
      while(generation===epoch&&['preparing','copying'].includes(row.status)){
        progress.textContent=row.status==='preparing'?'Preparando uma cópia consistente do banco…':`Conferindo documentos: ${row.copiedDocuments} de ${row.documents}. Mantenha esta aba aberta para continuar.`;
        const result=await api('admin-backup-advance',{method:'POST',data:{id:row.id,version:row.version}});
        if(generation!==epoch)return;row=result.backup;
      }
      if(generation===epoch)toast(row.status==='ready'?'Backup pronto. Baixe a cópia para guardá-la fora da hospedagem.':row.failure||'Backup não concluído.');
    }catch(error){if(generation===epoch)report(error);}
    finally{if(generation===epoch){processing=false;progress.hidden=true;await load();controls();}}
  }
  function confirm(row=null){
    if(processing)return;requestId=null;const generation=epoch;
    dialog.innerHTML=`<form><h2>${row?'Cancelar backup?':'Gerar backup manual'}</h2><p>${row?'A cópia incompleta será marcada como cancelada. Os dados originais permanecem preservados.':'Será criada uma cópia criptografada do banco e dos documentos vinculados. A chave privada de recuperação não é enviada ao navegador.'}</p><label for="backup-reason">Justificativa</label><textarea id="backup-reason" name="reason" required minlength="10" maxlength="1000" rows="3"></textarea><div data-form-error class="data-error" role="alert" hidden></div><div class="dialog-actions"><button type="button" class="button secondary" data-close>Voltar</button><button class="button primary">${row?'Cancelar cópia':'Gerar backup'}</button></div></form>`;
    const form=dialog.querySelector('form'),error=dialog.querySelector('[data-form-error]');let pending=false;
    dialog.querySelector('[data-close]').onclick=()=>{if(!pending)dialog.close();};dialog.oncancel=event=>{if(pending)event.preventDefault();};
    form.oninput=()=>{requestId=null;error.hidden=true;};
    form.onsubmit=async event=>{
      event.preventDefault();if(pending)return;const reason=form.reason.value.trim();
      if(reason.length<10){error.hidden=false;error.textContent='Informe uma justificativa com pelo menos 10 caracteres.';return;}
      requestId||=crypto.randomUUID();pending=true;for(const element of form.elements)element.disabled=true;
      try{
        const result=await api(row?'admin-backup-cancel':'admin-backup-start',{method:'POST',data:row?{id:row.id,version:row.version,reason}:{reason,requestId}});
        if(generation!==epoch)return;dialog.close();if(row)await load();else await process(result.backup);
      }catch(failure){if(generation===epoch){error.hidden=false;error.textContent=failure.message;}}
      finally{if(generation===epoch){pending=false;for(const element of form.elements)element.disabled=false;}}
    };
    dialog.showModal();dialog.querySelector('textarea').focus();
  }
  $('[data-backup-new]').onclick=()=>confirm();$('[data-backup-refresh]').onclick=load;
  $('[data-backup-prev]').onclick=()=>{offset=Math.max(0,offset-20);load();};
  $('[data-backup-next]').onclick=()=>{if(nextOffset!==null){offset=nextOffset;load();}};
  $('[data-backup-list]').onclick=async event=>{
    const button=event.target.closest('[data-backup-continue],[data-backup-download],[data-backup-cancel]');
    if(!button||processing)return;const row=rows.find(row=>row.id===(button.dataset.backupContinue||button.dataset.backupDownload||button.dataset.backupCancel));if(!row)return;
    if(button.dataset.backupContinue)await process(row);else if(button.dataset.backupCancel)confirm(row);
    else {try{button.disabled=true;button.textContent='Baixando…';await downloadBackup(row.id);}catch(error){report(error);}finally{button.disabled=false;button.textContent='Baixar cópia';}}
  };
  return {load,reset(){epoch++;rows=[];offset=0;nextOffset=null;processing=false;configured=false;requestId=null;dialog.close();$('[data-backup-list]').innerHTML='';$('[data-backup-error]').hidden=true;$('[data-backup-progress]').hidden=true;controls();}};
}
