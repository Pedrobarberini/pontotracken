# PontoTracken

Interface de controle de jornada, com cadastro e login Firebase, importação de Excel e gestão da equipe. Inclui fichas individuais, histórico, documentos privados, confirmação de leitura e perfis de Colaborador, Gestor, RH e ADMIN.

As fases 3 e 4 incluem férias e ausências com saldo manual e análise, calendário, checklists de admissão/desligamento, conversas 1:1, ciclos de avaliação, PDI e indicadores operacionais. Os períodos encerrados fora da escala são apurados como extras; ocorrências aprovadas permanecem separadas. Treinamentos e controle de ativos não fazem parte desta entrega.

A demonstração usa dados fictícios em memória e reinicia ao atualizar. Na área autenticada, os registros persistem no backend. A preparação jurídica permanece isolada e desativada.

Acesse: https://pedrobarberini.github.io/pontotracken/

GitHub Pages publica somente os arquivos públicos gerados em docs. As regras de acesso e os registros permanecem no backend Cloudflare Workers + D1; os documentos ficam no R2 privado, com download autorizado pela API. Credenciais privadas, banco de dados e módulos reservados para evolução futura não fazem parte desta publicação.

A identidade Firebase persiste neste navegador até sair da conta. O backend verifica identidade e permissões a cada recuperação de sessão. Novas contas aguardam aprovação da empresa. A configuração pública do Firebase é necessária ao SDK web e pode ser inspecionada no navegador; ela não concede acesso aos dados da aplicação.
