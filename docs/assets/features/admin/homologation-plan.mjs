export const homologationPlan=Object.freeze([
  {id:'H01',area:'Acesso',environment:'Contas de teste',steps:'Entrar por senha e Google; recarregar a página; sair da conta.',expected:'Sessão recuperada no mesmo navegador; logout encerra o acesso.'},
  {id:'H02',area:'Aprovação',environment:'Base de homologação',steps:'Criar uma conta de teste e aprovar pelo ADMIN.',expected:'Conta pendente não acessa dados; aprovação libera apenas o perfil autorizado.'},
  {id:'H03',area:'Permissões',environment:'Demo e contas de teste',steps:'Comparar os perfis Colaborador, Gestor, RH e ADMIN.',expected:'Cada perfil vê somente as ações e informações permitidas.'},
  {id:'H04',area:'Cadastros',environment:'Demo',steps:'Preparar um pré-cadastro, revisar campos e vincular uma conta de teste.',expected:'Campos e vínculo corretos, sem duplicidade nem substituição indevida.'},
  {id:'H05',area:'Ficha e documentos',environment:'Demo e base de homologação',steps:'Alterar ficha fictícia, anexar PDF de teste e conferir leitura e histórico.',expected:'Arquivo privado, autorização por titular e histórico preservados.'},
  {id:'H06',area:'Férias e ausências',environment:'Demo',steps:'Solicitar período com aviso de maior demanda e analisar como gestor.',expected:'Alerta nas datas coincidentes; pedido permanece disponível para análise.'},
  {id:'H07',area:'Admissão e desligamento',environment:'Demo',steps:'Avançar etapas de um processo fictício e revisar suas pendências.',expected:'Estado, responsáveis e histórico coerentes com cada ação.'},
  {id:'H08',area:'Desenvolvimento',environment:'Demo',steps:'Criar ciclo e meta de teste, registrar acompanhamento e revisar indicadores.',expected:'Dados e visibilidade consistentes entre os perfis autorizados.'},
  {id:'H09',area:'Administração',environment:'Demo',steps:'Conceder e remover ADMIN de conta fictícia; bloquear e excluir um acesso de teste.',expected:'Confirmações e auditoria presentes; próprio e último ADMIN protegidos.'},
  {id:'H10',area:'Backup e recuperação',environment:'Laboratório local',steps:'Gerar e restaurar uma cópia sintética; conferir integridade e arquivos.',expected:'Recuperação isolada aprovada, sem sobrescrever a aplicação publicada.'},
  {id:'H11',area:'Monitoramento',environment:'Demo e aplicativo',steps:'Abrir o painel, atualizar e baixar diagnóstico; comparar demo com ambiente real.',expected:'Estados explícitos, tempos de resposta e relatório sem credenciais ou dados de pessoas.'},
  {id:'H12',area:'Interface',environment:'Demo e aplicativo',steps:'Navegar em desktop e celular; testar teclado, mensagens e erro de conexão.',expected:'Conteúdo legível, ações acessíveis e possibilidade de tentar novamente.'}
]);

const csvCell=value=>'"'+String(value??'').replaceAll('"','""')+'"';
export function homologationCSV() {
  const rows=[['Caso','Área','Ambiente','Passos','Resultado esperado','Resultado obtido','Situação','Responsável','Data','Observações'],
    ...homologationPlan.map(item=>[item.id,item.area,item.environment,item.steps,item.expected,'','Não executado','','',''])];
  return '\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n';
}
