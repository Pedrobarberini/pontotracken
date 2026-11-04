export function emailNotificationsDemo(action) {
  if(action==='admin-email-process')return {demo:true,queued:0,sent:0,failed:0,disabled:true,enabled:false,configured:false};
  return {demo:true,enabled:false,configured:false,provider:'resend',senderReady:false,eventsPending:0,counts:{pending:2},externalScheduleConfigured:false,rows:[
    {id:'demo-mail-01',label:'Solicitação aguardando análise',recipientName:'Bruno Lima',status:'pending',attempts:0,createdAt:new Date().toISOString(),sentAt:null},
    {id:'demo-mail-02',label:'Documento próximo do vencimento ou vencido',recipientName:'Marina Alves',status:'pending',attempts:0,createdAt:new Date().toISOString(),sentAt:null}
  ]};
}
