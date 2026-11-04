import {escapeHTML as e} from '../../shared/dom.mjs?v=hr-operations-1';
import {homologationPlan,homologationCSV} from './homologation-plan.mjs?v=hr-operations-1';
import {createDocumentIntegrity} from './document-integrity-controller.mjs?v=hr-operations-1';
const styles={ok:'monitor-ok',info:'monitor-info',warning:'monitor-warning',error:'monitor-error',not_checked:'monitor-warning'};
const labels={ok:'Disponível',info:'Informativo',warning:'Atenção',error:'Verificar',not_checked:'Não verificado'};
const requestLabels={valid:'Verificado nesta solicitação',missing:'Sem atestação nesta solicitação',invalid:'Atestação inválida nesta solicitação',unavailable:'Verificação temporariamente indisponível',skipped:'Não aplicada nesta solicitação'};
const when=value=>Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value)):'—';
const duration=value=>Number.isFinite(value)&&value>=0?`${Math.round(value)} ms`:'—';
function download(contents,type,filename) {
  const url=URL.createObjectURL(new Blob([contents],{type})),link=document.createElement('a');
  link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function renderMonitoring(snapshot,roundTripMs) {
  const all=[...snapshot.checks,...snapshot.controls],warnings=all.filter(item=>['warning','error','not_checked'].includes(item.status)).length;
  const heading=snapshot.demo?'Exemplo de monitoramento':snapshot.status==='ok'?'Serviços disponíveis':snapshot.status==='error'?'Verifique a operação':'Há pontos de atenção';
  return `${snapshot.demo?'<p class="monitor-demo" role="status">Dados simulados. Este painel do demonstrativo não consulta a infraestrutura real.</p>':''}
    <div class="monitor-summary"><div><span>Situação</span><strong>${e(heading)}</strong></div><div><span>Pontos de atenção</span><strong>${warnings}</strong></div><div><span>Resposta desta consulta</span><strong>${e(duration(roundTripMs))}</strong></div></div>
    <p class="field-hint">Verificado em ${e(when(snapshot.checkedAt))} · Versão ${e(snapshot.release)} · Horário de Brasília</p>
    <div class="monitor-grid">${snapshot.checks.map(item=>`<article class="monitor-card ${styles[item.status]||'monitor-info'}"><div class="monitor-card-heading"><h3>${e(item.label)}</h3><span class="monitor-state">${e(snapshot.demo?'Simulado':labels[item.status]||'Não verificado')}</span></div><p>${e(item.detail)}</p><small>${e(duration(item.durationMs))}</small>${item.id==='backup'&&item.lastReadyAt?`<p class="field-hint">Última cópia pronta: ${e(when(item.lastReadyAt))}</p>`:''}</article>`).join('')}</div>
    <h3 class="monitor-controls-title">Proteções e configurações</h3><div class="monitor-control-list">${snapshot.controls.map(item=>`<article class="monitor-control ${styles[item.status]||'monitor-info'}"><strong>${e(item.label)}</strong><span>${e(item.detail)}</span>${item.requestStatus?`<small>${e(requestLabels[item.requestStatus]||'Não verificado')}</small>`:''}</article>`).join('')}</div>`;
}

export function createMonitoring({host,api,setTimer=setInterval,clearTimer=clearInterval,save=download,clock=()=>performance.now()}) {
  if(!host)return {load:async()=>{},setActive(){},reset(){}};
  host.innerHTML=`<section class="history-card monitoring-card"><div class="card-heading"><div><h2>Saúde do sistema</h2><p>Disponibilidade, configurações e pontos que precisam de atenção.</p></div><button class="button primary" type="button" data-monitor-refresh>Atualizar diagnóstico</button></div><div class="monitor-toolbar"><label><input type="checkbox" data-monitor-auto> Atualizar a cada 60 segundos enquanto este painel estiver aberto</label><button class="button secondary" type="button" data-monitor-export disabled>Baixar diagnóstico</button></div><div class="data-error" data-monitor-error role="alert" hidden></div><div data-monitor-results aria-live="polite"><p class="field-hint">Atualize para consultar os serviços.</p></div><p class="field-hint monitor-limits">As verificações são de leitura e configuração. Não gravam registros, não geram backups e não equivalem a um teste completo de todos os fluxos. Alertas aparecem neste painel; não há monitor externo 24 horas configurado.</p></section><section class="history-card monitoring-card"><div class="card-heading"><div><h2>Homologação funcional</h2><p>Roteiro para a equipe conferir o funcionamento e registrar seus resultados.</p></div><button class="button secondary" type="button" data-monitor-checklist>Baixar roteiro CSV</button></div><p class="field-hint">Use dados fictícios. Casos com gravação e contas de teste precisam de uma base separada antes de executar no aplicativo autenticado. O demonstrativo é temporário e não valida o login Firebase.</p><details class="monitor-checklist"><summary>Ver os ${homologationPlan.length} casos de validação</summary><ol>${homologationPlan.map(item=>`<li><strong>${e(item.id)} · ${e(item.area)}</strong><p>${e(item.steps)}</p><small>Esperado: ${e(item.expected)} Ambiente: ${e(item.environment)}.</small></li>`).join('')}</ol></details><p class="field-hint">Situação: aguardando execução e aprovação da equipe. Os testes técnicos são registrados separadamente.</p></section>`;
  const integrityHost=typeof document.createElement==='function'?document.createElement('div'):null;
  if(integrityHost)host.append(integrityHost);
  const integrity=createDocumentIntegrity({host:integrityHost,api,save});
  const $=selector=>host.querySelector(selector);
  let epoch=0,active=false,busy=false,timer=null,snapshot=null;
  function schedule(){if(timer!==null)clearTimer(timer);timer=null;if(active&&$('[data-monitor-auto]').checked)timer=setTimer(()=>{if(!document.hidden&&!host.hidden&&!host.closest?.('.view')?.hidden)load();},60000);}
  async function load() {
    if(busy||!active)return;
    busy=true;const generation=epoch,start=clock();$('[data-monitor-refresh]').disabled=true;$('[data-monitor-error]').hidden=true;
    try {
      const result=await api('admin-monitoring');
      if(generation!==epoch||!active)return;
      snapshot=result;$('[data-monitor-results]').innerHTML=renderMonitoring(result,clock()-start);$('[data-monitor-export]').disabled=false;
    }catch(error){if(generation===epoch&&active){snapshot=null;$('[data-monitor-export]').disabled=true;$('[data-monitor-error]').textContent=error.message;$('[data-monitor-error]').hidden=false;}}
    finally{if(generation===epoch){busy=false;$('[data-monitor-refresh]').disabled=false;}}
  }
  $('[data-monitor-refresh]').onclick=load;
  $('[data-monitor-auto]').onchange=schedule;
  $('[data-monitor-export]').onclick=()=>{if(snapshot&&active)save(JSON.stringify(snapshot,null,2)+'\n','application/json','TrackenPessoas-diagnostico-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');};
  $('[data-monitor-checklist]').onclick=()=>{if(active)save(homologationCSV(),'text/csv;charset=utf-8','TrackenPessoas-roteiro-homologacao.csv');};
  return {load,setActive(value){active=value;epoch++;busy=false;integrity.setActive(value);$('[data-monitor-refresh]').disabled=false;schedule();},reset(){active=false;epoch++;busy=false;snapshot=null;integrity.reset();if(timer!==null)clearTimer(timer);timer=null;$('[data-monitor-auto]').checked=false;$('[data-monitor-export]').disabled=true;$('[data-monitor-error]').hidden=true;$('[data-monitor-results]').innerHTML='';}};
}
