# Laboratório Avatar V2 — integração experimental

Branch isolada, sem alterar o deploy de produção. Os GLB são gerados pelo script original anexado nesta conversa (malhas rígidas, juntas articuladas, quatro clips e quatro sockets). Não equivalem a modelos artísticos finais com skinning. O visualizador mantém o avatar WebGL oficial intacto e acrescenta uma área opcional no Arsenal. Usa as cores e as 33 famílias do catálogo atual para adaptar as peças aos sockets, incluindo as duas trilhas; são protótipos procedurais, não 104 malhas artísticas independentes. A aparência usa cores do perfil e ocultação de cabelo/elmo; cabelo/rosto detalhados ainda exigem novas malhas. Os ajustes são visuais e não escrevem no servidor.

## Preparar em checkout isolado (frontend)

1. Instalar dependências existentes: `bun install --frozen-lockfile`.
2. `bun add --exact three@0.186.0 @react-three/fiber@9.8.2`
3. `bun add -d --exact @types/three@0.186.0`
4. Em venv Python separada: `python -m pip install numpy==2.3.5 trimesh==4.11.1 scipy networkx==3.5`.
5. `python experiments/avatar-v2/generate_models.py`
6. `python experiments/avatar-v2/validate_models.py`
7. `node experiments/avatar-v2/prepare.mjs`
8. `bun run lint`, `bun run typecheck`, `bun run build`.
9. Validar desktop/mobile com Playwright e fixtures existentes, incluindo troca de personagem, 104 peças, animações, visibilidade, câmera e fallback. Não promover antes de aprovação.

O workflow de laboratório gera o lockfile e os ativos num runner descartável, faz lint/typecheck/build e exporta os arquivos preparados como artefato. Ele não usa credenciais de produção e não faz push/merge. A branch guarda fontes e template, não o lockfile ainda não validado. O preparo aplica o patch apenas ao Arsenal esperado; em caso de alteração concorrente, recusa em vez de sobrescrever. Para reverter localmente use checkout limpo da branch. A main permanece independente. Não usar dados reais.

## Revisão do laboratório

O primeiro runner instalou Three.js/R3F e produziu o lockfile, mas a geração GLB parou em `ModuleNotFoundError: networkx`. Incluída dependência explícita; ataques agora usam curvas distintas para Murim e Caçador. O resultado do build e do navegador ainda precisa ser conferido.

## Homologação isolada

Os dois arquivos GLB foram gerados e passaram na verificação estrutural do runner 46149806949. Corrigidos os dois diagnósticos de dependências de hooks. O workflow agora prepara uma rota descartável de teste (não incluída no artefato de integração), testa 104 peças e dez conjuntos por personagem em desktop e mobile, câmera, ocultação de elmo, repetição de comandos de animação e preferência de movimento reduzido. As verificações inspecionam a ligação efetiva dos objetos no canvas, não garantem ausência de clipping ou fidelidade artística. Capturas e validação visual continuam necessárias. Não há testes com dados reais.

Runner 46150018360: geração GLB, lint, typecheck e build aprovados; movimento reduzido aprovado em desktop/mobile. A homologação de conjuntos falhou porque a fixture solicitava todas as variantes de um conjunto (mais de quatro peças), embora o rig aceite uma por slot. Revisão seleciona uma peça por slot e preserva a variante escolhida. Adicionada verificação de avanço real do tempo da animação e retomada após ocultar a aba. Revalidar no próximo runner.

## Comparação de rigs no navegador

A matriz de CI usa três fontes independentes de GLB: `rigid` (protótipo anterior), `skinned` (gerador de pesos) e `blender` (importação, deformação e reexportação real pelo Blender). A variável `AVATAR_LAB_RIG` seleciona os ativos antes do build de laboratório. Cada variante testa o catálogo de 104 peças e dez conjuntos em ambos os personagens em desktop/mobile. Capturas de frente, perfil e costas são destinadas à inspeção humana. A aprovação da variante rígida não aprova as demais; nenhum artefato é publicado automaticamente na main.


## Revisão artística — etapa 1

Refinamento procedural inicial: normais suaves nas superfícies orgânicas, rosto com 13 anéis de 32 segmentos e mandíbula distinta por personagem, pálpebras inferiores, mechas curvas e cabelo base mais detalhado. Murim recebe costuras e acabamento de lapelas; Caçador recebe fivelas, abas dos bolsos e detalhes do peitoral. Os cinco meshes ponderados usam 24 segmentos e mais anéis de transição nos cotovelos/joelhos. Preservados materiais nomeados, sockets, IDs, 15 juntas, sete clips e a personalização existente. Adicionadas capturas de rosto de frente/perfil e validação de orçamento de 18 mil triângulos e 1,5 MB por GLB. A main permanece com o modelo anterior aprovado. Não equivale a escultura final, textura PBR pintada ou verificação visual de colisões; CI e revisão das capturas pendentes.
