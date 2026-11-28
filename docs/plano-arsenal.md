# Itens do Arsenal do Carbon

Planejar a melhoria dos itens do Arsenal do Carbon com inspiração em *Logando no Murim*, usando a premissa de um caçador que entra num mundo de artes marciais como referência temática. [Edição oficial na Tapas](https://tapas.io/series/log-in-murim)

## Em escopo

- Revisar as 104 peças na primeira versão, com propostas originais para o catálogo e para o mascote no Figma.
- Revisar a progressão do equipamento, incluindo bônus, preços e requisitos de desbloqueio.

## O que existe hoje

O catálogo expandido tem 104 peças, quatro slots e dez conjuntos. O Arsenal já permite visualizar uma troca no mascote e calcular os bônus antes de equipar. Preços, requisitos e bônus afetam compras e recompensas. Preservar os IDs mantém inventários e conjuntos salvos reconhecíveis, e mudanças no catálogo devem passar pela verificação de paridade entre TypeScript e FastAPI.

## Primeira versão

A primeira versão cobre as 104 peças e as relações de progressão entre os conjuntos. O Figma deve mostrar como as peças mudam de silhueta no mascote e como o catálogo comunica custo, requisito e benefício.

## Trilhas de desbloqueio

As duas trilhas são distintas. Equipamentos de Caçador exigem o rank da trilha de Caçador. Equipamentos marciais exigem o reino de cultivo. O catálogo expandido tem 51 peças ligadas ao rank, 51 ligadas ao reino e duas peças iniciais.

## Aquisição

Marcos selecionados de rank ou cultivo entregam peças como recompensa. As demais peças seguem disponíveis para compra com moedas após o desbloqueio. São 15 recompensas, 87 compras e dois itens iniciais. O contrato de aquisição existente (`buy`) é reutilizado; o servidor determina o modo pelo catálogo, e a interface distingue resgatar de comprar. Nenhuma moeda é debitada em resgates. O inventário usa IDs por jogador. O servidor deve validar a elegibilidade e garantir uma única entrega por item, inclusive se houver repetição ou duas solicitações ao mesmo tempo.

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

Os conjuntos serão especializados em XP, moedas ou dano contra chefes. A revisão deve manter escolhas úteis entre conjuntos, evitar um conjunto que domine os três objetivos e calibrar o ritmo de aquisição para a rotina normal, com espaço para descanso e recuperação.

## Direção visual

As 104 peças fazem parte de famílias visuais com variantes. Cada família reaproveita encaixes e animações nos quatro slots do mascote. As variantes usam silhueta, materiais e acabamentos para diferenciar as peças, com arte original inspirada em caçadores e artes marciais. O Figma deve mostrar as famílias, suas variantes e exemplos de equipamento em conjunto no mascote.

## Questões em aberto

Nenhuma decisão de escopo em aberto. Os marcos e preços foram definidos; a simulação econômica e os testes completos ainda são necessários.
