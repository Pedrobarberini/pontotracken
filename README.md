# PontoTracken

Interface pública para controle de ponto, com cadastro e login Firebase, importação de Excel e painel ADMIN.

Acesse: https://pedrobarberini.github.io/pontotracken/

GitHub Pages publica a pasta `docs` da branch `main`. Os registros e as permissões continuam no backend Cloudflare Workers + D1. Este repositório contém somente arquivos públicos da interface. Não contém banco de dados, credenciais privadas ou registros de funcionários.

O Firebase mantém o login neste navegador até sair da conta. Ao reabrir ou recarregar, o backend verifica a identidade e as permissões antes de emitir uma nova sessão. O token da API fica apenas na memória da página. Novas contas aguardam a aprovação da empresa.
