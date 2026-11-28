# Migração controlada do banco legado

O schema anterior (users, game_stats, workout_logs etc.) não corresponde ao baseline Alembic. O procedimento abaixo é preparatório, não executa a transferência. O banco de destino efetivamente configurado precisa ser identificado pelo responsável antes de qualquer ação.

## Pré-voo somente leitura

Em backend/, com uv sync --locked, configure MURIM_PREFLIGHT_DATABASE_URL por meio de uma conexão direta privada para uma cópia isolada e execute:

```powershell
uv run python -m scripts.legacy_preflight
```

O diagnóstico usa transação READ ONLY, snapshot repetível, timeout, contagens agregadas, nomes de tabelas e colunas ausentes. Não imprime conteúdo de registros, tokens ou DSN. Não publica o resultado em logs públicos. Um retorno 0 significa diagnóstico executado, não autorização de migração nem compatibilidade comprovada. O relatório não verifica tipos, índices ou restrições em detalhe; Alembic e validação dos contratos ainda são obrigatórios.

## Mapeamento a validar

| Origem | Destino | Condição |
| --- | --- | --- |
| users | auth_user | Preservar ID por usuário aprovado e validar exatamente dois vínculos Google sub; nunca associar por e-mail automaticamente. |
| accounts, sessions, verifications | autenticação nova | Não transportar tokens, senhas ou sessões antigas; exigir novo login. Preservar origem protegida pelo período de retenção. |
| hero_profiles, game_stats | fitness_hero_profile, fitness_progress | Resolver divergências de XP, moedas e HP, obter classe/objetivo/experiência ausentes; não inventar valores. |
| workouts, workout_logs | fitness_custom_workout, fitness_completion | Validar JSON de exercícios, séries realizadas, IDs, snapshots, recompensas e datas. |
| exercise_prs | fitness_exercise_record | Agrupar registros por exercício sem perder os recordes; reconciliar volume e 1RM. |
| equipment, user_equipment, loadout_presets | fitness_arsenal | Validar IDs e slots contra o catálogo atual; resolver conflitos entre fontes de posse. |
| daily_vows, achievements | fitness_daily_vow, fitness_achievement | Preservar resolução e reivindicação de recompensas sem reemitir XP. |
| progress_ledger | fitness_progress_ledger | Reconciliar tipos, saldos e ordem temporal; não recalcular nem conceder XP pelo importador normal. |
| health_activities, daily_health_metrics | fitness_health_activity, fitness_health_metric | Verificar fonte, data, unidades, ausências e identificadores; não inventar horários, calorias ou medidas. |
| weight_logs | fitness_weight_check_in | Resolver duplicatas por dia, preservar valor e arquivar anotações não representadas. |
| chat_messages e campos sem equivalente | arquivo privado | Definir exportação/retenção autorizada; não descartar silenciosamente. |

Timestamps sem fuso exigem confirmação da interpretação antiga. Campos obrigatórios ausentes, usuários não mapeados, IDs duplicados ou saldos incompatíveis impedem a migração automática.

## Execução futura e critérios de aceite

1. Identificar origem, destino e as duas contas autorizadas em ambiente privado. Inventariar registros na cópia.
2. Fazer backup criptografado e restaurar em banco isolado; conferir contagens e integridade.
3. Criar schema novo em banco realmente vazio com Alembic, sem alterar a origem. Nunca executar bootstrap sobre o schema legado nem usar stamp para ocultar divergências.
4. Implementar e testar transformações versionadas sobre fixtures sintéticas representativas. Migrar somente após obter os mapeamentos faltantes e autorização específica.
5. Comparar contagens por conta, saldos XP/moedas, histórico, propriedade dos registros e rejeições justificadas. Rodar Alembic check, testes de contrato e login das duas contas. Manter origem intacta para rollback.
6. Trocar a configuração de destino apenas depois da homologação e autorização de publicação. Não apagar as tabelas antigas neste procedimento.

A inspeção do catálogo confirmou que o projeto Neon murim possui PostgreSQL 18 e schema legado nas branches consultadas. Não foi estabelecido que ele é o banco usado pelo deployment atual. Nenhum dado real foi modificado.

## Compatibilidade do Arsenal V2

O catálogo atual contém 104 IDs, incluindo os 52 anteriores à expansão. Valide IDs históricos com o mapa de migração de `backend/app/equipment.py` e `src/utils/rpgLogic.ts` antes de importar posse ou conjuntos. Preserve os saldos originais e registros de compra; não recalcule gastos históricos com os preços novos nem resgate itens em nome do usuário durante uma migração. Recompensas de marcos são elegíveis a partir do progresso reconhecido pelo servidor e não duplicam itens possuídos. A expansão não exige uma revisão Alembic específica; o procedimento legado continua não executado. Consulte [Arsenal V2](plano-arsenal.md).
