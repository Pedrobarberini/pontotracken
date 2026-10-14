# PontoTracken

Interface de controle de jornada, com cadastro e login Firebase, importação de Excel e gestão da equipe.

Acesse: https://pedrobarberini.github.io/pontotracken/

GitHub Pages publica somente os arquivos públicos gerados em docs. As regras de acesso e os registros permanecem no backend Cloudflare Workers + D1. Credenciais privadas, banco de dados e módulos reservados para evolução futura não fazem parte desta publicação.

A identidade Firebase persiste neste navegador até sair da conta. O backend verifica identidade e permissões a cada recuperação de sessão. Novas contas aguardam aprovação da empresa. A configuração pública do Firebase é necessária ao SDK web e pode ser inspecionada no navegador; ela não concede acesso aos dados da aplicação.
