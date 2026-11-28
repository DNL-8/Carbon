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
- [ ] Rig deformável (skinning), pesos de vértices e articulações naturais.
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
- [Última CI GLB examinada](https://github.com/DNL-8/Carbon/actions/runs/46150219107): geração, lint, typecheck e build passaram; 2 testes de movimento reduzido passaram; 2 falharam na medição de tempo da animação após os testes do Murim.
- [Laboratório e novas execuções](https://github.com/DNL-8/Carbon/actions?query=branch%3Afeature%2Favatar-v2-glb)

**Limitações:** protótipos rígidos não equivalem a modelos artísticos finais. Os testes de atributos do canvas não certificam qualidade estética ou ausência de colisões. A integração não está em produção. As cinco skills externas solicitadas não estão disponíveis neste ambiente; Playwright convencional é utilizado pela CI.

## 6. Laboratório Blender — rig deformável

- [x] Preparar gerador de cinco superfícies contínuas com pesos normalizados e 15 juntas, preservando os sockets e as peças rígidas.
- [x] Preparar teste de deformação real no Blender e exportação GLB + arquivo .blend em runner descartável.
- [ ] Confirmar execução do Blender, deformação e roundtrip de sockets/clips/skin.
- [ ] Revisar a aparência e a orientação dos encaixes após exportação.
- [ ] Refinar artisticamente as malhas e pesos antes de integrar ao visualizador.

Os protótipos rígidos aprovados continuam como referência. O laboratório Blender é separado e não modifica o código ou ativos da main. A CI 46150418021 aprovou os quatro testes do visualizador rígido; a aprovação não se estende ao novo rig.
