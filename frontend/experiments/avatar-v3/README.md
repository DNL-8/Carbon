# Avatar V3 — anatomia e rosto PC

Laboratório exclusivo da branch feature/avatar-v3-high-poly. Avatar V2 e produção intactos. Sem deploy ou release. Pipeline em avatar-v3-ci.yml substitui avatar-v3-anatomy.yml.

## Fluxo
Matrix Murim/Caçador, fail-fast e concurrency; caches de pacotes APT, pip, npm e Bun (instalação APT ainda necessária). Geração procedural Blender, validação independente Trimesh/NumPy, compressão glTF Transform Meshoptimizer, capturas Blender e teste Chromium desktop do GLB comprimido. Artefatos por sete dias; sem binários no Git. Não alterar branch protection. Não adicionar dependências ao aplicativo.

## Executar localmente
Blender instalado com exportador GLB e NumPy:
```powershell
blender -b --factory-startup --python-exit-code 1 --python frontend/experiments/avatar-v3/anatomy.py -- avatar-v3-output murim generate
python -m pip install numpy==2.3.5 trimesh==4.11.1
python frontend/experiments/avatar-v3/validate_mesh.py avatar-v3-output/murim/murim-desktop.glb --report avatar-v3-output/murim/validation-report.json
blender -b --factory-startup --python-exit-code 1 --python frontend/experiments/avatar-v3/anatomy.py -- avatar-v3-output murim render
```

## Orçamentos e limitações
Escultura inicial >=300 mil triângulos, candidato PC 100–200 mil, GLB <=20 MB. Meta posterior de 1–5 milhões para fonte artística, perfil Alta <=100 mil e futura versão mobile <=50 mil. Não reduzir a versão Ultra para 50 mil. A decimação não equivale a retopologia ou baking. Validação verifica índices, finitude, degeneração, orientação, volume, fechamento e orçamento; não certifica auto-interseções ou qualidade artística. Teste Chromium verifica decodificação, triângulos, altura e capturas, não comparação pixel-a-pixel nem FPS físico. Custo adicional zero é meta, não garantia de cobrança; monitorar armazenamento e cache do GitHub.

- [x] Pipeline implementado.
- [x] CI anatômica aprovada em fa2ea38: 150.000 triângulos desktop por personagem, fontes de 2.435.944 e 2.723.400 triângulos, zero erros geométricos.
- [ ] Revisão visual das capturas e aprovação da fase facial.
- [x] Protótipos de olhos, íris, pupilas, pálpebras, sobrancelhas, lábios e morph targets Blink/Focus/Smile implementados.
- [ ] Confirmar CI facial, nomes de morph targets após Meshoptimizer e capturas faciais no Chromium.
- [ ] Anatomia artística, retopologia, rig, materiais, expressões e equipamentos.
- [ ] Drei, pós-processamento, HDRI, texturas WebP/KTX2 quando houver ativos apropriados.
- [ ] Testes de regressão visual com baselines aprovados e PC físico.

Não executar prepare.mjs do V2 na main. Nenhuma alteração de inventário, progresso, API ou banco.

## Fase 2: rosto
A anatomia recebe recessos orbitais e proporções de mandíbula diferenciadas; o GLB recebe malhas faciais fechadas e três morph targets iniciais. O teste desktop verifica nomes e acionamento após compressão, com capturas de rosto neutro e expressões. Os morphs são deformações locais simples, não rig facial completo ou anatomia ocular certificada. A escultura .blend contém a base facial fundida; os detalhes são gerados de forma reproduzível no GLB. Ainda não há cabelo, UV, texturas ou aprovação artística.
