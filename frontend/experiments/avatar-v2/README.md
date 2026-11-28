# Laboratório Avatar V2 — integração experimental

Branch isolada, sem alterar o deploy de produção. Os GLB são gerados pelo script original anexado nesta conversa (malhas rígidas, juntas articuladas, quatro clips e quatro sockets). Não equivalem a modelos artísticos finais com skinning. O visualizador mantém o avatar WebGL oficial intacto e acrescenta uma área opcional no Arsenal. Usa as cores e as 33 famílias do catálogo atual para adaptar as peças aos sockets, incluindo as duas trilhas; são protótipos procedurais, não 104 malhas artísticas independentes. A aparência usa cores do perfil e ocultação de cabelo/elmo; cabelo/rosto detalhados ainda exigem novas malhas. Os ajustes são visuais e não escrevem no servidor.

## Preparar em checkout isolado (frontend)

1. Instalar dependências existentes: `bun install --frozen-lockfile`.
2. `bun add --exact three@0.186.0 @react-three/fiber@9.8.2`
3. `bun add -d --exact @types/three@0.186.0`
4. Em venv Python separada: `python -m pip install numpy==2.3.5 trimesh==4.11.1 scipy`.
5. `python experiments/avatar-v2/generate_models.py`
6. `python experiments/avatar-v2/validate_models.py`
7. `node experiments/avatar-v2/prepare.mjs`
8. `bun run lint`, `bun run typecheck`, `bun run build`.
9. Validar desktop/mobile com Playwright e fixtures existentes, incluindo troca de personagem, 104 peças, animações, visibilidade, câmera e fallback. Não promover antes de aprovação.

O workflow de laboratório gera o lockfile e os ativos num runner descartável, faz lint/typecheck/build e exporta os arquivos preparados como artefato. Ele não usa credenciais de produção e não faz push/merge. A branch guarda fontes e template, não o lockfile ainda não validado. O preparo aplica o patch apenas ao Arsenal esperado; em caso de alteração concorrente, recusa em vez de sobrescrever. Para reverter localmente use checkout limpo da branch. A main permanece independente. Não usar dados reais.
