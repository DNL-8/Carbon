# Itens do Arsenal do Carbon

Planejar a melhoria dos itens do Arsenal do Carbon com inspiração em *Logando no Murim*, usando a premissa de um caçador que entra num mundo de artes marciais como referência temática. [Edição oficial na Tapas](https://tapas.io/series/log-in-murim)

## Em escopo

- Revisar as 52 peças na primeira versão, com propostas originais para o catálogo e para o mascote no Figma.
- Revisar a progressão do equipamento, incluindo bônus, preços e requisitos de desbloqueio.

## O que existe hoje

O catálogo tem 52 peças, quatro slots e dez conjuntos. O Arsenal já permite visualizar uma troca no mascote e calcular os bônus antes de equipar. Preços, requisitos e bônus afetam compras e recompensas. Preservar os IDs mantém inventários e conjuntos salvos reconhecíveis, e mudanças no catálogo devem passar pela verificação de paridade entre TypeScript e FastAPI.

## Primeira versão

A primeira versão cobre as 52 peças e as relações de progressão entre os conjuntos. O Figma deve mostrar como as peças mudam de silhueta no mascote e como o catálogo comunica custo, requisito e benefício.

## Trilhas de desbloqueio

As duas trilhas são distintas. Equipamentos de Caçador exigem o rank da trilha de Caçador. Equipamentos marciais exigem o reino de cultivo. O catálogo atual tem 24 peças ligadas ao rank, 26 ligadas ao reino e duas peças iniciais. A distribuição final faz parte da revisão das 52 peças.

## Aquisição

Marcos selecionados de rank ou cultivo entregam peças como recompensa. As demais peças seguem disponíveis para compra com moedas após o desbloqueio. A lista de marcos e peças será definida na revisão do catálogo. O inventário usa IDs por jogador. O servidor deve validar a elegibilidade e garantir uma única entrega por item, inclusive se houver repetição ou duas solicitações ao mesmo tempo.

O progresso já atingido na data da atualização conta para as recompensas. Uma conta que já possui a peça conserva seu item e não recebe uma duplicata.

O jogador resgata a recompensa no Arsenal. A ação aparece para uma peça elegível que ainda não está no inventário. O resgate põe a peça no inventário sem cobrança. Equipar continua sendo uma ação separada, e a prévia pode ser usada antes do resgate.

## Balanceamento

Os conjuntos serão especializados em XP, moedas ou dano contra chefes. A revisão deve manter escolhas úteis entre conjuntos, evitar um conjunto que domine os três objetivos e calibrar o ritmo de aquisição para a rotina normal, com espaço para descanso e recuperação.

## Direção visual

As 52 peças fazem parte de famílias visuais com variantes. Cada família reaproveita encaixes e animações nos quatro slots do mascote. As variantes usam silhueta, materiais e acabamentos para diferenciar as peças, com arte original inspirada em caçadores e artes marciais. O Figma deve mostrar as famílias, suas variantes e exemplos de equipamento em conjunto no mascote.

## Questões em aberto

Nenhuma decisão de escopo em aberto. A seleção dos marcos, valores e peças específicas será detalhada na revisão do catálogo.
