import {escapeHTML as e} from '../../shared/dom.mjs?v=hr-operations-1';
const labels={pending:'Na fila',sending:'Em entrega',sent:'Enviado',failed:'Tentar novamente',needs_review:'Revisar entrega',cancelled:'Cancelado',skipped:'Ignorado por acesso ou prazo'};
const when=value=>value?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'—';
export function createEmailNotifications({host,api}) {
  if(!host?.querySelector)return {load:async()=>{},reset(){}};
  host.innerHTML='<section class="people-card"><div class="card-heading"><div><h2>Notificações por e-mail</h2><p>Pendências, vencimentos e aprovações com fila de entrega.</p></div><button class="button secondary" data-email-refresh>Atualizar</button></div><div data-email-summary aria-live="polite"></div><div class="hr-actions"><button class="button primary" data-email-process>Preparar e processar notificações</button></div><p class="field-hint">Com o envio desativado, esta ação apenas prepara a fila. Quando a integração estiver habilitada no backend, também processará entregas. Remetente e credencial são configurados na hospedagem.</p><p class="data-error" data-email-error role="alert" hidden></p><div data-email-rows></div></section>';
  const $=selector=>host.querySelector(selector);let epoch=0,identity=0,busy=false;
  async function load(){const generation=++epoch;$('[data-email-error]').hidden=true;
    try{const data=await api('admin-email-notifications');if(generation!==epoch)return;
      $('[data-email-summary]').innerHTML=`${data.demo?'<p class="field-hint">Demonstração: fila fictícia, sem entregas reais.</p>':''}<p class="monitor-demo"><strong>${data.enabled&&data.configured?'Integração habilitada':'Envio desativado ou aguardando configuração'}</strong><br>${data.configured?'Provedor e remetente configurados.':'Integração preparada. Configure remetente verificado e Secret do provedor no backend para habilitar.'}</p><div class="integrity-totals">${[['Eventos a preparar',data.eventsPending],['Na fila',(data.counts.pending||0)+(data.counts.sending||0)],['Enviados',data.counts.sent||0],['Revisar',(data.counts.failed||0)+(data.counts.needs_review||0)]].map(([label,count])=>`<div><span>${e(label)}</span><strong>${Number(count)}</strong></div>`).join('')}</div><p class="field-hint">Lembretes podem ser preparados manualmente. Agendamento externo ainda precisa ser configurado. Os e-mails levam somente um aviso genérico e o link para o aplicativo, sem anexos ou justificativas.</p>`;
      $('[data-email-rows]').innerHTML=data.rows.length?`<div class="table-scroll"><table class="records-table"><thead><tr><th>Destinatário</th><th>Aviso</th><th>Entrega</th><th>Criação</th><th>Enviado em</th></tr></thead><tbody>${data.rows.map(row=>`<tr><td>${e(row.recipientName)}</td><td>${e(row.label)}</td><td>${e(labels[row.status]||'Verificar')}<small>${row.attempts} tentativa(s)</small></td><td>${e(when(row.createdAt))}</td><td>${e(when(row.sentAt))}</td></tr>`).join('')}</tbody></table></div><p class="field-hint">Últimas 50 notificações. As contagens incluem toda a fila.</p>`:'<p class="empty-state">Nenhuma notificação preparada.</p>';
    }catch(error){if(generation===epoch){$('[data-email-error]').textContent=error.message;$('[data-email-error]').hidden=false;}}
  }
  $('[data-email-refresh]').onclick=load;
  $('[data-email-process]').onclick=async()=>{if(busy)return;busy=true;const owner=identity;$('[data-email-process]').disabled=true;
    try{await api('admin-email-process',{method:'POST',data:{}});if(owner===identity)await load();}
    catch(error){if(owner===identity){$('[data-email-error]').textContent=error.message;$('[data-email-error]').hidden=false;}}
    finally{if(owner===identity){busy=false;$('[data-email-process]').disabled=false;}}
  };
  return {load,reset(){identity++;epoch++;busy=false;$('[data-email-summary]').innerHTML='';$('[data-email-rows]').innerHTML='';$('[data-email-error]').hidden=true;$('[data-email-process]').disabled=false;}};
}
