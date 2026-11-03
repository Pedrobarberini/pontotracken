export function monitoringDemoSnapshot() {
  return {schemaVersion:1,demo:true,readOnly:true,release:'demonstration',checkedAt:new Date().toISOString(),durationMs:12,status:'ok',
    checks:[
      {id:'database',label:'Banco de dados',status:'info',detail:'Exemplo de consulta disponível. Nenhum banco real foi consultado.',durationMs:4},
      {id:'files',label:'Arquivos privados',status:'info',detail:'Exemplo de armazenamento disponível. Nenhum arquivo real foi lido.',durationMs:5},
      {id:'identity',label:'Validação do login',status:'info',detail:'Exemplo de serviço de login. O demonstrativo não autentica no Firebase.',durationMs:3},
      {id:'backup',label:'Backup manual',status:'info',detail:'Exemplo de cópia pronta. O demonstrativo não gera backups reais.',durationMs:2,configured:false,lastReadyAt:null,manual:true}
    ],controls:[
      {id:'app-check',label:'App Check',status:'info',detail:'Exemplo de observação. Nenhuma atestação real foi solicitada.',mode:'off',requestStatus:'skipped'},
      {id:'rate-limits',label:'Limites da API',status:'info',detail:'Exemplo de limites habilitados. O demonstrativo não consulta a API real.'},
      {id:'document-inspection',label:'Proteção de anexos',status:'info',detail:'Exemplo de inspeção de formato. Antivírus externo permanece como evolução futura.'}
    ],coverage:{database:'simulated',files:'simulated',identity:'simulated',businessApproval:'pending',externalAlerts:false}};
}
