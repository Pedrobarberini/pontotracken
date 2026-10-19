import {escapeHTML as e} from '../../shared/dom.mjs?v=account-management-1';
import {findDemandWarnings} from '../../vendor/hr-planning.mjs?v=account-management-1';

const dateLabel=value=>new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
const activeNotices=result=>(result.notices?.rows||[]).filter(row=>row.status==='active');
export const demandNotices=activeNotices;
export function demandWarnings(notices,startOn,endOn) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startOn||'')||!/^\d{4}-\d{2}-\d{2}$/.test(endOn||'')||endOn<startOn)return [];
  return findDemandWarnings(notices,startOn,endOn);
}
export function demandWarningsView(warnings,{compact=false}={}) {
  if(!warnings?.length)return '';
  return `<div class="hr-demand-warning" data-hr-demand-warning><strong>Maior demanda no período</strong><ul>${warnings.map(row=>`<li><span>${e(row.title)}</span><small>${row.dates.map(date=>e(dateLabel(date))).join(' · ')}</small>${!compact&&row.message?`<p>${e(row.message)}</p>`:''}</li>`).join('')}</ul><p class="field-hint">O aviso orienta o planejamento. A solicitação pode seguir para análise do gestor.</p></div>`;
}
export function noticesView(result,month) {
  const notices=activeNotices(result),rows=notices.filter(row=>row.dates.some(date=>date.startsWith(month))),canManage=Boolean(result.capabilities?.canManageNotices||result.notices?.canManage);
  return `<section class="people-card hr-planning-notices" id="hr-planning-notices" aria-labelledby="hr-planning-title"><div class="card-heading"><div><h2 id="hr-planning-title">Avisos de planejamento</h2><p class="field-hint">Datas de maior demanda para planejar férias e ausências. Os avisos não impedem solicitações.</p></div>${canManage?'<button type="button" class="button secondary" id="hr-notice-new">Novo aviso</button>':''}</div>${rows.length?`<div class="hr-notice-list">${rows.map(row=>`<article class="hr-planning-notice" data-hr-notice-id="${e(row.id)}"><div><h3>${e(row.title)}</h3>${row.message?`<p>${e(row.message)}</p>`:''}<div class="hr-notice-dates" aria-label="Datas de maior demanda neste mês">${row.dates.filter(date=>date.startsWith(month)).map(date=>`<span>${e(dateLabel(date))}</span>`).join('')}</div></div>${canManage?`<div class="hr-actions"><button type="button" class="text-button" data-hr-notice-edit="${e(row.id)}">Editar aviso</button><button type="button" class="text-button" data-hr-notice-archive="${e(row.id)}">Arquivar</button></div>`:''}</article>`).join('')}</div>`:'<p class="empty-state">Nenhum aviso de maior demanda para este mês.</p>'}${notices.length>rows.length?'<p class="field-hint">Há avisos em outros meses. Eles também serão verificados ao escolher o período de um pedido.</p>':''}${result.notices?.truncated?'<p class="field-hint">A lista atingiu o limite de 200 avisos ativos. Peça ao RH para revisar e arquivar os avisos encerrados.</p>':''}</section>`;
}
export function calendarDemandView(notices,day) {
  const warnings=demandWarnings(notices,day,day);
  if(!warnings.length)return '';
  return `<span class="hr-calendar-demand" data-demand-date="${e(day)}" title="${e(warnings.map(row=>row.title).join(' · '))}">Maior demanda<small>${e(warnings[0].title)}${warnings.length>1?` + ${warnings.length-1}`:''}</small></span>`;
}
