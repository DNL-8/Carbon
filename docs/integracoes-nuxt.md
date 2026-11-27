# Integrações Murim (Nuxt / Neon)

## Strava
- Configure `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` e `STRAVA_SESSION_SECRET` (segredo aleatório exclusivo com pelo menos 32 caracteres) no servidor. Nunca use valores do cliente.
- Cadastre o domínio de callback do projeto no Strava: `murim-iota.vercel.app`. A URL usada pelo aplicativo é `https://murim-iota.vercel.app/api/strava/callback`.
- Entre no Murim e abra Relatórios → Sincronização. Autorize a conexão; escolha o período e sincronize.
- Estado OAuth expira em 10 minutos e está vinculado à sessão Better Auth. Tokens ficam em cookie criptografado HttpOnly/Secure. Não são retornados ao navegador como JSON. Desconexão remove o vínculo local; atividades importadas permanecem.
- Até 150 atividades por sincronização. Duplicatas por fonte/ID não geram novo XP. Zonas não inferidas sem amostras.

## Health Connect Android
- A versão adaptada usa Google ID token verificado pelo Better Auth. O Android precisa estar cadastrado no projeto OAuth Google (package com.dnl8.fitnessrpg e SHA-1 do certificado de assinatura). O client ID web é obtido do servidor, sem segredo.
- O app usa o domínio de produção Murim. A autenticação antiga Firebase não é convertida automaticamente: entre novamente com Google.
- Autorize as permissões de leitura no Android, sincronize e confira Relatórios → Sincronização.
- O aplicativo envia sessões e métricas diárias em lotes de até 25. Leituras isoladas de frequência cardíaca não se tornam treinos. A gravação é isolada por sessão autenticada.
- Não houve migração automática dos dados existentes no Firebase. Nenhum registro antigo é apagado.
- Compilação automatizada não substitui a validação OAuth com conta real, APK assinado e dispositivo físico.

## Google e Resend

- Google Web OAuth: origem https://murim-iota.vercel.app; callback https://murim-iota.vercel.app/api/auth/callback/google.
- `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` ficam nas variáveis de servidor. O endpoint mobile retorna somente o ID público.
- `RESEND_API_KEY` e `AUTH_EMAIL_FROM` são necessários para verificação de e-mail e recuperação de senha. Testes CI usam e-mail simulado.

## Oráculo Gemini

- Configure `GEMINI_API_KEY` e `GEMINI_MODEL` com um modelo disponível para a conta.
- O endpoint /api/oracle/ask exige sessão verificada, valida a pergunta e só envia o resumo de recuperação e carga mediante consentimento. O resumo usa os últimos 28 dias e omite identificadores e medições brutas.
- O histórico da interface fica nesta sessão; não há persistência de conversas confirmada.
- Teste resposta real depois de publicar; não confundir build aprovado com integração habilitada.

## Estado da publicação

O código das integrações está na main. Configuração OAuth, deploy da revisão e teste com conta real/aparelho físico ainda precisam ser confirmados. Não divulgar tokens em logs ou prints.
