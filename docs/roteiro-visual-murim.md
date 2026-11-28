# Roteiro visual e evolução — Carbon / Murim

Adaptação original para um aplicativo de saúde com progressão RPG. A referência fornecida pelo proprietário descreve o despertar de um caçador na família Jin, o aprendizado com o Rei de Fogo, o retorno às masmorras, a guerra marcial e a convergência dos mundos. Este roteiro usa esses cinco motivos para orientar a arte, não para reproduzir literalmente a narrativa ou copiar personagens/ilustrações protegidas.

| Capítulo do app (proposto) | Referência temática | Direção de arte e interação |
| --- | --- | --- |
| 1. Despertar | Família Jin de Taiyuan e treinamento | Faixa com nó e tecido, túnica, bastão de treino, visor F. Respiração e postura inicial. |
| 2. Disciplina da chama | Discipulado e cultivo de fogo | Traje marcial, lança imbuída de Qi, detalhes em cobre e brasa. Golpes e transições suaves. |
| 3. Portais e caçadores | Retorno à Terra, masmorras e guildas | Colete, visor, capacete tático, espada de mana. Materiais tecnológicos e luminosidade discreta. |
| 4. Ascensão marcial | Conflito continental | Elmo carmesim, capa de asas, armadura reforçada e lança divina. Qi visível nas armas de cultivo avançado. |
| 5. Convergência | Equilíbrio entre os dois mundos | Veste imortal, espada espiritual, conjuntos mistos. Distinção visual de Qi e mana pelo catálogo. |

Os capítulos são orientação narrativa, não desbloqueios implementados. O guia contém sete reinos principais e faixas de níveis diferentes; o Carbon contém oito reinos de cultivo e sete ranks F–S. Não importar níveis, proporção temporal, morte real ou treinamento extremo da obra para o sistema de saúde. O usuário continua avançando pelas regras atuais de XP/Qi e descanso, independentemente dos capítulos. Não alterar economia, preços, conquistas, inventários ou o backend.

## Encaixes 3D implementados

- Elmo: oclusão do rosto e visor, profundidade dos olhos conforme a família, faixa com nó posterior.
- Armadura: proteção pesada ou tecido conforme família, ombreiras dimensionadas, abas à frente das pernas, detalhes do índice visual.
- Capa: articulação atrás das ombreiras, inclinação que afasta o tecido do tronco, painéis separados conforme a família.
- Arma: origem no centro da mão, orientação para fora do corpo, empunhadura, diferenciação de lança, acabamento e efeitos por trilha e marco. Armas duplas conservam uma peça em cada mão.
- Os 104 IDs, 33 famílias, 10 conjuntos e 4 slots atuais continuam iguais. Não são modelos exclusivos com rigging de Blender; são variantes de geometria procedural.

## Homologação

O teste de geometria verifica os 104 itens individualmente em quatro orientações e duas poses. O teste visual também verifica o ID efetivamente desenhado no canvas quando WebGL está disponível. Ainda é necessário executar os testes, capturar as famílias, revisar combinações de equipamentos e conferir interseções em movimento. Limites de enquadramento não comprovam ausência de colisões entre malhas. Não aprovar a publicação na main sem a homologação.
