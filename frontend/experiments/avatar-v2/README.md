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


## Revisão dos equipamentos — etapa 2

As 33 famílias mantêm os 104 IDs existentes. Cada peça passa a ter um relevo geométrico individual (cinco marcas que codificam o índice visual do catálogo por slot), acabamento de materiais rígidos/tecido, chanfros discretos e variações dimensionais de lâminas e placas. Acrescentados detalhes específicos de visores, exotrajes, asas, leques e martelos, e superfícies de capas curvas afastadas do corpo. O teste verifica 104 assinaturas geométricas por personagem, coordenadas finitas e os IDs equipados, sem modificar regras ou bônus. Os modelos continuam procedurais: não são 104 esculturas independentes, nem simulação física de tecido. Validação no navegador e clipping visual pendentes; produção permanece com a última versão aprovada.


## Revisão de movimento, aura e qualidade — etapa 3

Animações de ataque recebem apoio de quadril, pernas e manto, mantendo os sete clips e 15 juntas. Capas curvas têm deformação secundária limitada e afastada do corpo; mechas longas acompanham o movimento. Não é simulação física nem garantia de ausência de colisões. A aura usa anéis circulares para Qi e hexagonais para Mana, cores personalizadas, pulsação e quantidade de camadas conforme os tiers reais de Rank F–S e os oito reinos (sem alterar regras). Qualidade automática por largura da tela e preferência de movimento reduzido, além de opção econômica/detalhada; reduz DPR, camadas e atualização de normais no modo econômico. Testes de aura, progressão e qualidade preparados. Acesso às demais telas, promoção do GLB para avatar principal, revisão artística, FPS e bateria físicos continuam pendentes de homologação. Nenhum deploy ou nova dependência nesta etapa.


## Etapa 4 — Integração compacta nas telas principais

Preparado modo compacto econômico, com carregamento dinâmico sob demanda no Início/Painel e na sessão de treino. O combate usa eventos já existentes de séries concluídas e vitória; nenhuma recompensa é recalculada no visualizador. A prévia pode ser pausada/fechada e o avatar anterior permanece visível. O laboratório prepara os componentes Murim e Training em checkout isolado e inclui ambos nos artefatos. Teste autenticado adicional verifica abertura, navegação, ataque e fallback. A versão ainda não substitui automaticamente o avatar oficial; publicação e promoção dependem de homologação e preservação da engrenagem da main. Não há alegação de teste em dispositivo físico.


## Inspeção de capturas e preservação da interface

Inspeção das capturas desktop do artefato Blender 15267916971 (run 46156191078): rostos e roupas são legíveis, mas ainda estilizados e simplificados; boca pouco visível, pose de repouso aberta e botas/mãos pouco naturais. Revisão procedural acrescenta boca curva na superfície facial, polegar/nós dos dedos, botas arredondadas com sola e postura de repouso menos aberta. Sem certificação de colisões. O laboratório agora incorpora a engrenagem da main 5e34423, seus estilos e testes de câmera; o preparo insere o GLB no painel recolhido, preservando o comportamento de produção. Validação da nova revisão pendente. A versão GLB continua opcional até revisão artística e homologação completas.


### Validação de encaixes em movimento (laboratório)

Alinhamento vertical de visores e lentes corrigido pela referência do socket do elmo e a altura dos olhos do modelo procedural. Adicionados testes dos sete clips com um conjunto completo, verificação da estabilidade das matrizes locais dos acessórios e capturas por pose. Não substitui uma análise de interseção entre malhas, especialmente nas armas, cabelo e armadura; a revisão visual continua necessária. Nesta fase não promover para main nem disparar deploy manual. Configuração git.deploymentEnabled desabilita o deploy automático exclusivamente da branch feature/avatar-v2-glb; não alterar produção.


### Encaixe bilateral e ajuste de armadura

As armas duplas usam um socket explícito `slot_arma_esquerda`, espelhado ao socket original, e preservado na exportação Blender. É uma âncora interna, não um quinto slot do inventário. Os testes verificam a hierarquia dos encaixes, a simetria em repouso e a compatibilidade com as peças duplas do catálogo. A armadura do Caçador recebe escala horizontal proporcional ao torso base. O ajuste é aproximado, não uma certificação de ausência de colisões. Alterações restritas ao laboratório, sem deploy.


### Diagnóstico de interseções e desempenho no laboratório

Na rota isolada de testes, a cada janela de pelo menos 250 ms são amostrados vértices de acessórios (armas e tecido) em relação a três volumes elipsoidais aproximados associados a Spine, Hips e Head. Os relatórios JSON por personagem/clip registram contagem de amostras internas, FPS da janela, draw calls, triângulos e contagens de geometrias/texturas do renderizador. Estes indicadores são diagnósticos, não detecção exata de interseção de triângulos, nem medição de VRAM; FPS no Chromium SwiftShader não representa um celular físico. Não reprovar um teste pela mera proximidade aproximada, mas exigir amostras válidas e finitas. Verificar também a política de cabelo oculto para as 26 peças de cabeça. Sem dependências novas e sem deploy.


### Ombreiras articuladas e relatórios persistentes

A execução 46166544187 aprovou os três jobs de laboratório, mas o ZIP Blender recuperado continha apenas PNGs; os anexos JSON não estavam presentes. Agora os relatórios são também escritos explicitamente no diretório de saída do Playwright. Ombreiras de plate/exo ganham deslocamento limitado proporcional à diferença angular entre o braço atual e a pose de referência do GLB; mantêm o socket da armadura e não dependem de um solver de colisão. Testes verificam as famílias e o movimento em ataque. A eficácia visual e as medições dependem da próxima execução. Sem deploy.


### Correção da CI das ombreiras

A execução 46167072184 reprovou as três variantes porque a contagem das ombreiras articuladas permaneceu em zero. A causa provável é a sanitização dos nomes de nós pelo GLTFLoader para os bindings de animação (`UpperArm.L` torna-se `UpperArmL`). O renderer resolve o nome sanitizado pela função PropertyBinding.sanitizeNodeName, com fallback ao nome original; uma armadura pesada sem ambos os vínculos agora produz erro explícito. O teste mantém a exigência de duas ombreiras e verifica os nomes dos braços, sem relaxar o teste de movimento. A correção aguarda nova CI; sem deploy.


### Agrupamento de geometrias estáticas

Baseline Blender da CI 46167504468 (commit fa54aee): 4 relatórios, 28 janelas de pose, cada uma com 303 vértices amostrados de armas e 110 de tecido; nenhuma amostra interna aos três volumes elipsoidais aproximados. Um conjunto por personagem, sem cobertura exaustiva da trajetória. Murim: 124 draw calls e 14.496 triângulos; Caçador: 126 draw calls e 14.120 triângulos. FPS de software entre 18,5 e 61,5; não representa hardware móvel real. Agrupar apenas malhas estáticas irmãs com material idêntico e layout de atributos compatível, transformações incorporadas e sem mudança de triângulos. Excluir capas deformáveis e ombreiras móveis; manter validação dos motivos antes do agrupamento, liberar geometrias substituídas e verificar contagem por item. A redução real de draw calls e a aparência ainda dependem da CI. Sem deploy.


### Cobertura temporal das animações

CI 46168792940 aprovada integralmente (b0d1ce7). Relatórios Blender em desktop/mobile: Murim 96 draw calls (antes 124), Caçador 98 (antes 126); triângulos inalterados, 14.496 e 14.120; 28 poses sem amostras internas aos volumes aproximados. Nesta revisão, dividir cada clip em dez intervalos temporais e registrar uma amostra por intervalo, mantendo as janelas FPS separadas. Exigir todos os dez intervalos por clip/personagem/viewport e persistir os relatórios de trajetória; não declarar colisões eliminadas com base em volumes aproximados. Cobertura prevista: 280 amostras por variante, de um conjunto completo por personagem. Sem alterar main ou deploy.
