# PontoTracken

Interface de controle de jornada, com cadastro e login Firebase, importação de Excel e gestão da equipe. Inclui fichas individuais, histórico, documentos privados, confirmação de leitura e perfis de Colaborador, Gestor, RH e ADMIN.

Pendências abrem o documento ou registro exato; cadastros incompletos podem ser filtrados. Termos em PDF são gerados sob demanda, sem confirmar leitura ou assinatura automaticamente. Os anexos recebem inspeção local de formato no backend, que não substitui um serviço de antivírus.

Acesse: https://pedrobarberini.github.io/pontotracken/

GitHub Pages publica somente os arquivos públicos gerados em docs. As regras de acesso e os registros permanecem no backend Cloudflare Workers + D1; os documentos ficam no R2 privado, com download autorizado pela API. Credenciais privadas, banco de dados e módulos reservados para evolução futura não fazem parte desta publicação.

A identidade Firebase persiste neste navegador até sair da conta. O backend verifica identidade e permissões a cada recuperação de sessão. Novas contas aguardam aprovação da empresa. A configuração pública do Firebase é necessária ao SDK web e pode ser inspecionada no navegador; ela não concede acesso aos dados da aplicação.
