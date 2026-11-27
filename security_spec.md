# Especificação de segurança — Fitness RPG & Saúde

## Invariantes da versão Nuxt

1. Rotas privadas exigem Better Auth com e-mail verificado; ausência de sessão retorna 401 e e-mail não verificado retorna 403.
2. O proprietário é derivado da sessão, não de um campo recebido do cliente. Consultas, atualização e exclusão filtram por usuário.
3. Schemas Zod delimitam tipos, formatos, datas, IDs, cargas, séries e tamanho das entradas.
4. XP, moedas, HP, recordes e compras seguem regras no servidor; não há endpoint de concessão arbitrária nem SQL livre.
5. Conclusões e importações são deduplicadas de acordo com as chaves do schema; repetir requisições não deve duplicar saldo.
6. Extrato e histórico preservam os registros; excluir treino personalizado não deve apagar conclusões anteriores.
7. OAuth Strava valida state, expiração, sessão e origem de operações de escrita. Tokens e segredos não aparecem em JSON da central.
8. Compartilhamento de métricas de saúde com Gemini exige opt-in; dados ausentes não são inventados.
9. Backup criptografado, chave privada externa, restauração apenas em ambiente isolado.

## Matriz adversarial a manter/ampliar

| Cenário | Resultado esperado |
| --- | --- |
| Rota privada sem sessão ou com e-mail não verificado | 401/403 |
| Conta B tenta consultar ou alterar ID de A | Nenhum dado de A revelado ou alterado |
| UUID inválido ou tentativa de path traversal | Rejeitado |
| Série fora dos limites ou corpo malformado | Rejeitado sem recompensa |
| Reenvio de conclusão ou atividade já importada | Sem XP/moedas duplicados |
| Compra sem saldo ou sem requisito | Sem débito/equipamento indevido |
| Resgate de missão indisponível | Sem recompensa |
| Exclusão de pesagem de outra conta | Registro original preservado |
| Fonte externa enviada pela rota de importação manual | Rejeitada |
| Callback Strava com state vencido ou de outra conta | Rejeitado |
| Oráculo com pergunta vazia, longa ou identidade forjada | Rejeitado |
| Central API aponta para caminho externo ou auth arbitrário | Rejeitado pela allowlist |

A matriz é critério de aceite, não declaração de cobertura total. `web/tests/`, `scripts/check-nuxt.mjs` e a CI cobrem partes desses cenários. Acrescente testes de regressão quando corrigir falhas.

## Legado mantido

As regras Firestore anteriores seguem em `firestore.rules`, com schemas em `firebase-blueprint.json` e testes em `tests/firestoreRules.test.ts` enquanto o build Next.js ainda fizer parte da CI. A especificação detalhada anterior está no histórico Git; não deve ser usada para descrever a arquitetura ativa.
