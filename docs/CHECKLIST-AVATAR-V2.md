# Checklist — Carbon Avatar V2

Atualizado em 28/11/2026. Branch de integração: `feature/avatar-v2-glb`. O aplicativo é destinado a dois usuários. Manter a economia, IDs, progressão, segurança e fallback existentes. Não publicar release v1.0.0.

## 1. Base e infraestrutura
- [x] CI da main aprovada no commit d4cb103 (FastAPI, Next.js e Android).
- [x] Isolar o laboratório da produção.
- [x] Instalar Three.js 0.186.0, React Three Fiber 9.8.2 e tipos no runner.
- [x] Gerar lockfile e instalar com frozen lockfile no runner.
- [x] Gerar os dois GLB originais procedurais.
- [x] Validar estrutura, quatro sockets e quatro clips nos GLB.
- [x] Aprovar lint, TypeScript e build do laboratório no runner 46150219107.
- [ ] Incorporar arquivos GLB e lockfile validados ao repositório de produção.

## 2. Modelagem e identidade
- [x] Artes conceituais Murim e Caçador.
- [x] Protótipos articulados com materiais separados e silhuetas distintas.
- [x] Curvas de ataque distintas no gerador.
- [ ] Modelagem artística final fiel às referências (Blender ou equivalente).
- [x] Rig deformável inicial com pesos de vértices validado tecnicamente no Blender.
- [ ] Refinar naturalidade das articulações, pesos e silhuetas em poses extremas.
- [ ] Materiais, cabelo, rosto e vestimentas de qualidade final.
- [ ] Efeitos diferenciados de Qi e Mana e evolução visual por rank/reino.

## 3. Equipamentos e aparência
- [x] Preservar os 104 IDs e quatro slots existentes.
- [x] Implementar encaixes experimentais das 33 famílias nos dois personagens.
- [x] Implementar prévia de rotação, zoom, ocultar elmo e cores do perfil.
- [x] Corrigir fixture para uma peça por slot.
- [x] Testar 104 peças e dez conjuntos no Murim (desktop/mobile; execução chegou à etapa seguinte).
- [x] Revalidar 104 peças e dez conjuntos também no Caçador (desktop/mobile), CI 46150418021.
- [ ] Conferir armas duplas, poses extremas, elmos e clipping visual.
- [ ] Personalização completa de cabelo/rosto no GLB; paridade com avatar anterior.
- [ ] Validar persistência por conta, conjuntos independentes e ausência de alterações involuntárias de bônus.

## 4. Animações, desempenho e acessibilidade
- [x] Clips de repouso, ataque, vitória e descanso definidos nos GLB.
- [x] Teste de movimento reduzido aprovado em desktop/mobile.
- [x] Confirmar avanço real do tempo da animação, pausa e repetição (CI 46150418021).
- [ ] Validar retomada após ocultar a aba e perda de contexto WebGL.
- [ ] Medir FPS, memória, bateria e tempo de carregamento em aparelhos reais.
- [ ] Validar teclado, leitor de tela, contraste e alvos de toque no laboratório.
- [ ] Revisar capturas e fidelidade visual em desktop e mobile.

## 5. Integração e entrega
- [x] Visualizador experimental preparado com carregamento sob demanda.
- [x] Avatar anterior preservado como alternativa.
- [x] Aprovar integralmente a CI isolada GLB (46150418021, 4/4).
- [ ] Incorporar correção de acessibilidade e demais mudanças recentes da main.
- [ ] Integrar ativos e dependências validadas; executar CI completa e testes autenticados de Arsenal.
- [ ] Revisar os resultados e capturas.
- [ ] Publicar integração validada na main sem release.
- [ ] Conferir Vercel, autenticação, inventário e fallback em produção.

## Evidências
- [CI principal aprovada](https://github.com/DNL-8/Carbon/actions/runs/46149660148)
- [CI GLB aprovada](https://github.com/DNL-8/Carbon/actions/runs/46150966430): 4/4 testes do renderizador rígido; não inclui skinning.
- [Laboratório e novas execuções](https://github.com/DNL-8/Carbon/actions?query=branch%3Afeature%2Favatar-v2-glb)

**Limitações:** protótipos rígidos não equivalem a modelos artísticos finais. Os testes de atributos do canvas não certificam qualidade estética ou ausência de colisões. A integração não está em produção. As cinco skills externas solicitadas não estão disponíveis neste ambiente; Playwright convencional é utilizado pela CI.

## 6. Laboratório Blender — rig deformável

- [x] Preparar gerador de cinco superfícies contínuas com pesos normalizados e 15 juntas, preservando os sockets e as peças rígidas.
- [x] Preparar teste de deformação real no Blender e exportação GLB + arquivo .blend em runner descartável.
- [x] Gerar e validar ambos os GLB com skin (15 juntas, cinco malhas e 304 vértices com influência mista por personagem; runner 46150966375).
- [x] Instalar e executar Blender 5.0.1 no runner.
- [x] Confirmar importação no Blender, deformação e roundtrip de sockets/clips/skin (runner 46151298428).
- [ ] Revisar a aparência e a orientação dos encaixes após exportação.
- [ ] Refinar artisticamente as malhas e pesos antes de integrar ao visualizador.

Os protótipos rígidos aprovados continuam como referência. O laboratório Blender é separado e não modifica o código ou ativos da main. A CI 46150418021 aprovou os quatro testes do visualizador rígido; a aprovação não se estende ao novo rig.

Runner Blender 46150966375: os modelos ponderados passaram na validação estrutural; Blender 5.0.1 iniciou, mas a importação falhou por NumPy ausente no Python interno. Instalado python3-numpy da distribuição, isolado o Python do setup-python e acrescentado preflight. Teste de deformação agora exige que vértices de influência mista se movam e que parte da malha permaneça imóvel. A nova execução ainda precisa ser validada.

## 7. Integração técnica do skinning no navegador

- [x] Preparar clonagem do esqueleto com SkeletonUtils, evitando compartilhamento de juntas entre avatares.
- [x] Preparar CI comparativa dos GLB rígidos e dos GLB ponderados originais, com verificação de cinco malhas skinned e ligação dos ossos à própria instância do personagem.
- [x] Aprovar os testes de catálogo, conjuntos, câmera e animações nos modelos ponderados (CI 46151382324, variantes rígida e skinned).
- [x] Configurar terceira variante de CI para executar o Blender e testar seus GLB reexportados no navegador, sem reutilizar os GLB ponderados de entrada.
- [ ] Confirmar aprovação da variante Blender em desktop e mobile.

As duas variantes são somente experimentais. O pipeline de Blender e a matriz de navegador são independentes; nenhum resultado publica modelos automaticamente em produção.

### Evidência Blender aprovada

[Runner 46151298428](https://github.com/DNL-8/Carbon/actions/runs/46151298428): os dois modelos foram importados no Blender 5.0.1, testados e reexportados. Cada um manteve 15 ossos, cinco malhas deformáveis, quatro sockets e quatro animações; 111 vértices do braço se moveram, incluindo 63 com pesos mistos. Cada GLB reexportado manteve 304 vértices com pesos mistos no total. Os .blend foram salvos. Esta validação é técnica, não artística.

- [x] Preparar capturas de conjuntos equipados de frente, perfil e costas para ambos os personagens.
- [ ] Revisar as capturas geradas na nova CI e corrigir clipping/encaixes.

### Validação adicional de exportação

Inspeção dos arquivos reais do artefato Blender 15266265163: GLB Murim 266104 bytes e Caçador 266964 bytes. A comparação das matrizes globais de repouso confirmou a conservação dos quatro sockets, cabeça e mão esquerda (diferenças inferiores a 0,0001). Nomes de materiais preservados. Acrescentada verificação automatizada de roundtrip de matrizes dos quatro sockets, cabeça, ambas as mãos e materiais. A próxima CI deve confirmar a nova asserção. Não equivale a validação de colisão nas poses animadas.

## 8. Refinamento visual inicial

Inspeção direta das quatro capturas de navegador da variante skinned (artefato 15266057622): as formas base ainda são simples, com descontinuidade visual na cintura, ombros pouco naturais e pouca distinção dos personagens sem armadura. O elmo testado também encobria olhos e intersectava o rosto. Revisão: vestimenta base permanente sem bônus (manto curto, lapelas e faixa de Murim; painel tático, alças e bolsos de Caçador), conexão do quadril, ombros arredondados, extensão da malha ponderada e casco aberto com proteção lateral. Os slots e IDs continuam inalterados.

- [x] Inspecionar capturas reais anteriores (Murim e Caçador).
- [x] Implementar revisão de geometria da vestimenta base e elmos.
- [ ] Validar nova versão em todas as variantes e revisar capturas sem equipamento e com conjuntos completos.
- [ ] Refinar rosto, cabelo, tecidos, materiais e poses até atingir a referência artística. O modelo continua procedural e low-poly.
