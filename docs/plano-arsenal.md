# Arsenal V2 — catálogo, progressão e implementação

A expansão dos itens do Arsenal do Carbon foi implementada na branch main com inspiração em *Logando no Murim*, usando a premissa de um caçador que entra num mundo de artes marciais como referência temática. [Edição oficial na Tapas](https://tapas.io/series/log-in-murim)

## Escopo entregue

- Expansão de 52 para 104 peças, 26 em cada slot, preservando os IDs antigos e os dez conjuntos.
- Progressão, bônus, preços, resgate, prévia, catálogo e encaixes SVG do mascote.
- Commit funcional publicado: [cbee77b](https://github.com/DNL-8/Carbon/commit/cbee77bf5ea24532ccc445bcd68c76aee034e60e). A validação completa segue [CI](ci.md) e [homologação](homologacao.md).

## O que existe hoje

O catálogo expandido tem 104 peças, quatro slots e dez conjuntos. O Arsenal já permite visualizar uma troca no mascote e calcular os bônus antes de equipar. Preços, requisitos e bônus afetam compras e recompensas. Preservar os IDs mantém inventários e conjuntos salvos reconhecíveis, e mudanças no catálogo devem passar pela verificação de paridade entre TypeScript e FastAPI.

## Referência visual

[Arquivo Figma de conceitos V1/V2](https://www.figma.com/design/bV9gn518ngX5MZiSXepmak) e [expansão de 52 peças](https://www.figma.com/design/bV9gn518ngX5MZiSXepmak?node-id=3-314). Os conceitos são referências vetoriais; não são capturas da interface em execução.

## Trilhas de desbloqueio

As duas trilhas são distintas. Equipamentos de Caçador exigem o rank da trilha de Caçador. Equipamentos marciais exigem o reino de cultivo. O catálogo expandido tem 51 peças ligadas ao rank, 51 ligadas ao reino e duas peças iniciais.

## Aquisição

Marcos selecionados de rank ou cultivo entregam peças como recompensa. As demais peças seguem disponíveis para compra com moedas após o desbloqueio. São 15 recompensas, 87 compras e dois itens iniciais. O contrato de aquisição existente (`buy`) é reutilizado; o servidor determina o modo pelo catálogo, e a interface distingue resgatar de comprar. Nenhuma moeda é debitada em resgates. O inventário usa IDs por jogador. O servidor valida a elegibilidade e serializa a aquisição por proprietário com bloqueio de progresso; a repetição retorna o ID já possuído. Os testes de concorrência verificam o comportamento com duas solicitações.

O progresso já atingido na data da atualização conta para as recompensas. Uma conta que já possui a peça conserva seu item e não recebe uma duplicata.

O jogador resgata a recompensa no Arsenal. A ação aparece para uma peça elegível que ainda não está no inventário. O resgate põe a peça no inventário sem cobrança. Equipar continua sendo uma ação separada, e a prévia pode ser usada antes do resgate.

### Marcos de recompensa

| Trilha | Estágio | ID |
|---|---:|---|
| rank_cacador | 1 | `elmo_visor_rank_f` |
| rank_cacador | 2 | `armadura_colete_rank_e` |
| rank_cacador | 3 | `capa_estandarte_rank_d` |
| rank_cacador | 4 | `arma_katana_rank_c` |
| rank_cacador | 5 | `elmo_sabio_abissal` |
| rank_cacador | 6 | `armadura_monarca` |
| rank_cacador | 7 | `arma_presas_monarca` |
| reino_murim | 1 | `elmo_faixa_taiyuan` |
| reino_murim | 2 | `armadura_traje_2_classe` |
| reino_murim | 3 | `arma_lanca_1_classe` |
| reino_murim | 4 | `elmo_presa_carmesim` |
| reino_murim | 5 | `capa_asa_carmesim` |
| reino_murim | 6 | `arma_lanca_rei_fogo` |
| reino_murim | 7 | `armadura_celestial_vida_morte` |
| reino_murim | 8 | `arma_espada_invisivel` |

## Balanceamento

Os conjuntos são especializados em XP, moedas ou dano contra chefes. O bônus do conjunto é +4% com duas peças e +10% com quatro peças (substitui, não acumula com o anterior), além dos bônus individuais. A pontuação de poder recebe 18 ou 45 pontos pela sinergia, respectivamente.

| Conjunto | ID preservado | Especialidade |
| --- | --- | --- |
| Viajante | `viajante` | XP |
| Pátio de Jade | `familia_jin` | XP |
| Vanguarda | `associacao_cacadores` | Moedas |
| Guarda de Aço | `guarda_aco` | Chefes |
| Rota Âmbar | `manto_mercador` | Moedas |
| Arquivo Astral | `sabio_abissal` | XP |
| Presa Rubra | `presa_carmesim` | Chefes |
| Forja Solar | `seita_rei_fogo` | Chefes |
| Sentinela do Eclipse | `monarca_eternidade` | Moedas |
| Horizonte de Jade | `espada_invisivel` | XP |

Preços por estágio (moedas): 25, 90, 160, 260, 400, 600, 850, 1.100; recompensas e itens iniciais custam zero. O catálogo é a fonte de verdade para valores individuais.

## Direção visual

As 104 peças fazem parte de famílias visuais com variantes. Cada família reaproveita encaixes e animações nos quatro slots do mascote. As variantes usam silhueta, materiais e acabamentos para diferenciar as peças, com arte original inspirada em caçadores e artes marciais. O Figma documenta estudos de famílias, variantes e exemplos equipados; o código contém a implementação SVG.

## Estado e pendências

Implementação publicada na main. A revisão Avatar V2 `c36846f` passou na [CI 46173361553](https://github.com/DNL-8/Carbon/actions/runs/46173361553), foi transferida e integrada em `e55aec8`. O catálogo, IDs, preços, bônus e regras permanecem inalterados. A prévia GLB opcional mantém o avatar anterior e utiliza os quatro slots do inventário, cinco sockets internos e sete animações. Consulte [Avatar 3D](avatar-3d.md) e [homologação](HOMOLOGACAO-AVATAR-V2.md). Revisão visual integral, dispositivos físicos e produção ainda pendentes; deploy automático configurado como desativado.


### Biblioteca visual V2

104 IDs mapeados para 33 silhuetas SVG originais, com cores do catálogo, detalhes por variante, marcador de trilha e acabamento de raridade. Miniaturas decorativas no catálogo e slots reutilizam a mesma biblioteca sem dependências externas. O mascote utiliza as mesmas 33 famílias com encaixes próprios para cabeça, tronco, costas e arma, mantendo o pivô de golpe, os olhos, a animação de respiração e o controle de movimento reduzido. As formas de arte são estudos vetoriais implementados; validação de capturas ainda pendente.

### Interface do catálogo

Paginação de 24 peças, busca sem distinção de acentos, filtro por trilha/slot/raridade/conjunto/disponibilidade, ordenação por preço e atributo, resgates em destaque, e comparação em pontos percentuais em relação ao equipamento ativo. O catálogo mostra requisitos e saldo insuficiente; prévia permanece independente de aquisição.

### Simulação econômica (cenários, não metas de saúde)

Base: sessões completas com 120 ou 220 XP base, moedas calculadas por 28% do XP base + 25 pelo chefe, missão diária de treino (+30 XP/+25 moedas), missão semanal de três sessões (+60 XP/+40 moedas). Sem bônus de equipamentos, recordes, passos, pesagem ou volume. Calendário fixo com 2–3 dias livres por semana; nenhuma penalidade por descanso. Compra opcional de uma alternativa por marco, mais as 15 recompensas gratuitas retroativas. O desbloqueio Murim usa somente o piso por XP, sem somar Qi de atividade. Valores de 28 dias e resultados de cenário:

| Sessões/semana | XP base | Moedas em 28 dias | Dia das 15 recompensas | Maior espera de compra (dias) |
|---:|---:|---:|---:|---:|
| 4 | 120 | 1504 | 409 | 1 |
| 5 | 120 | 1840 | 333 | 1 |
| 4 | 220 | 1952 | 255 | 1 |
| 5 | 220 | 2400 | 207 | 1 |

Coleção completa: 87 compras por 29.335 moedas, mais 15 resgates e 2 iniciais. A coleção completa é opcional; não representa objetivo de treinamento. O modelo testa acessibilidade de alternativas, não prevê a velocidade real individual. A CI executa o script e testes de concorrência em PostgreSQL descartável. A simulação foi executada e aprovada na CI inicial; não substitui homologação visual, testes reais ou validação de toda a coleção em uso.

## Mapa técnico

| Área | Arquivo |
| --- | --- |
| Catálogo web | `src/utils/equipmentCatalog.ts` |
| Catálogo API | `backend/app/data/equipment.json` |
| Regras | `src/utils/rpgLogic.ts`, `backend/app/equipment.py`, `backend/app/arsenal.py` |
| Interface | `frontend/components/arsenal.tsx`, `frontend/lib/rpg-api.ts` |
| Arte | `frontend/lib/equipment-art.ts`, `frontend/components/equipment-art.tsx`, `frontend/components/avatar-equipment-layer.tsx`, `frontend/components/warrior-avatar.tsx`, `frontend/components/avatar-glb-preview.tsx`, `frontend/public/assets/avatar-v2/` |
| Testes | `scripts/check-fastapi-equipment.mjs`, `scripts/check-equipment-art.mjs`, `scripts/check-arsenal-economy.mjs`, `backend/tests/test_arsenal_postgres.py`, `backend/tests/test_equipment.py`, `frontend/tests/flow.spec.ts` |

O contrato HTTP de aquisição permanece `POST /api/arsenal` com `action: "buy"` ou `"equip"`. O campo `acquisition` diferencia `starter`, `reward` e `purchase`. Nenhum novo endpoint de resgate, serviço externo ou revisão Alembic foi introduzido.
