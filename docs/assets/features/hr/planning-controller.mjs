import {escapeHTML as e} from '../../shared/dom.mjs?v=account-management-1';
import {demandNotices,demandWarnings,demandWarningsView} from './planning-views.mjs?v=account-management-1';

const dateLabel=value=>new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const date=new Date(value+'T12:00:00Z');return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===value;}
export function bindRequestDemandWarnings(dialog,result) {
  const start=dialog.querySelector('#hr-start'),end=dialog.querySelector('#hr-end'),target=dialog.querySelector('#hr-request-demand-warnings'),notices=demandNotices(result);
  const update=()=>{const warnings=demandWarnings(notices,start.value,end.value);target.innerHTML=demandWarningsView(warnings);target.hidden=warnings.length===0;};
  for(const input of [start,end]){input.addEventListener('input',update);input.addEventListener('change',update);}update();
}
export function bindPlanningNotices({element,result,dialog,show,reasonField}) {
  const rows=demandNotices(result),canManage=Boolean(result.capabilities?.canManageNotices||result.notices?.canManage);
  if(!canManage)return;
  function editor(row) {
    const dates=new Set(row?.dates||[]);
    show(row?'Editar aviso de planejamento':'Novo aviso de planejamento',`<p class="field-hint">Selecione os dias específicos de maior demanda. O pedido continua permitido e será analisado pelo gestor.</p><label for="hr-notice-title">Título do aviso</label><input id="hr-notice-title" name="title" minlength="3" maxlength="120" value="${e(row?.title||'')}" required><label for="hr-notice-message">Orientação para a equipe</label><textarea id="hr-notice-message" name="message" maxlength="1000" rows="3" placeholder="Descreva a necessidade de cobertura da equipe">${e(row?.message||'')}</textarea><fieldset class="hr-notice-date-editor"><legend>Dias de maior demanda</legend><label for="hr-notice-date">Adicionar um dia específico</label><div class="hr-notice-date-add"><input id="hr-notice-date" type="date" aria-describedby="hr-notice-date-hint hr-notice-date-error"><button class="button secondary" type="button" id="hr-notice-add-date">Adicionar dia</button></div><p id="hr-notice-date-hint" class="field-hint">De 1 a 60 datas. Remova apenas os dias que deixarem de exigir atenção.</p><p id="hr-notice-date-error" class="form-message" role="alert" hidden></p><div id="hr-notice-dates" class="hr-notice-date-chips" aria-label="Dias selecionados"></div><p id="hr-notice-date-count" class="field-hint" aria-live="polite"></p></fieldset>${reasonField}`,'hr-notice-save',form=>{
      if(!dates.size)throw new Error('Adicione pelo menos um dia ao aviso.');
      return {id:row?.id||null,version:row?.version||0,title:form.get('title'),message:form.get('message'),dates:[...dates].sort(),reason:form.get('reason')};
    },'Aviso de planejamento salvo.');
    const input=dialog.querySelector('#hr-notice-date'),target=dialog.querySelector('#hr-notice-dates'),error=dialog.querySelector('#hr-notice-date-error'),count=dialog.querySelector('#hr-notice-date-count');
    const render=()=>{target.innerHTML=[...dates].sort().map(date=>`<span class="hr-notice-date-chip">${e(dateLabel(date))}<button type="button" class="text-button" data-hr-notice-remove-date="${e(date)}" aria-label="Remover ${e(dateLabel(date))}">×</button></span>`).join('');count.textContent=`${dates.size} de 60 datas selecionadas`;target.querySelectorAll('[data-hr-notice-remove-date]').forEach(button=>button.onclick=()=>{dates.delete(button.dataset.hrNoticeRemoveDate);error.hidden=true;render();input.focus?.();});};
    const add=()=>{let message='';if(!validDate(input.value))message='Escolha uma data válida.';else if(dates.has(input.value))message='Esse dia já está selecionado.';else if(dates.size>=60)message='O limite é de 60 datas por aviso.';if(message){error.textContent=message;error.hidden=false;return;}dates.add(input.value);input.value='';error.hidden=true;render();input.focus?.();};
    dialog.querySelector('#hr-notice-add-date').onclick=add;input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();add();}});render();
  }
  function archive(row) {show('Arquivar aviso de planejamento',`<p><strong>${e(row.title)}</strong></p><p class="field-hint">O aviso deixará de aparecer como maior demanda nos novos pedidos e no calendário. O histórico será preservado.</p>${reasonField}`,'hr-notice-archive',form=>({id:row.id,version:row.version,reason:form.get('reason')}),'Aviso arquivado.');}
  element.querySelector('#hr-notice-new')?.addEventListener('click',()=>editor());
  element.querySelectorAll('[data-hr-notice-edit]').forEach(button=>button.onclick=()=>{const row=rows.find(item=>item.id===button.dataset.hrNoticeEdit);if(row)editor(row);});
  element.querySelectorAll('[data-hr-notice-archive]').forEach(button=>button.onclick=()=>{const row=rows.find(item=>item.id===button.dataset.hrNoticeArchive);if(row)archive(row);});
}
