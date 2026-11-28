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
- [x] Incorporar arquivos GLB e lockfile validados ao repositório de produção.

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
- [x] Incorporar correção de acessibilidade e demais mudanças recentes da main.
- [x] Integrar ativos e dependências validadas; testes autenticados de Arsenal aprovados no laboratório (46154383597). CI da main após integração pendente.
- [ ] Revisar os resultados e capturas.
- [x] Publicar integração validada na main sem release.
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
- [x] Confirmar aprovação da variante Blender em desktop e mobile (CI 46151600841; três variantes aprovadas antes da revisão artística).

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

## 9. Personalização e movimentos avançados

- [x] Refinar malha do rosto, olhos, sobrancelhas e nariz do gerador.
- [x] Implementar quatro penteados em ambos os estilos, três proporções de rosto, cores de pele/cabelo/energia e ocultação de cabelo por elmos. As variantes extras de cabelo são construídas no Three.js; os .blend incluem o cabelo base.
- [x] Implementar sete clips (idle, attack, victory, rest, guard, dodge, channel), incluindo defesa, esquiva e canalização de Qi/mana com curvas específicas.
- [x] Incluir testes de seleção de aparência e execução dos novos clips nos dois personagens.
- [ ] Confirmar CI desta revisão e capturas finais; os novos clips e personalização ainda não foram homologados.
- [ ] Revisão artística manual, clipping de combinações extremas, desempenho em hardware físico e integração autenticada na main.

A CI do Blender 46151721448 aprovou a revisão das vestimentas. Os testes das três variantes no commit ce580fb passaram (46151600841). As novas formas ainda são modelos low-poly procedurais, não escultura artística final. As opções não concedem bônus nem alteram o inventário.

## 10. Qualidade e recuperação

- [x] Preparar suspensão de renderização ao final de movimentos não cíclicos e quando pausado/aba oculta.
- [x] Implementar mensagem e tentativa explícita de recuperação em perda de contexto WebGL.
- [x] Adicionar alvos de toque de 44px, rótulos de rotação visíveis e teste axe/teclado.
- [x] Preparar teste de pausa real e evento de perda de contexto simulado, com retomada do visualizador.
- [ ] Confirmar aprovação dos novos testes e medir desempenho em dispositivo físico; evento sintético não comprova recuperação de perda de GPU real.
- [ ] Consolidar artefatos validados e lockfile no frontend definitivo. Não promover automaticamente nem alterar a main antes da revisão da CI e capturas.

### Correção da homologação dos novos movimentos

A CI Blender 46151888853 aprovou os dois modelos e os sete clips. A CI de navegador 46151888788 e 46151940801 falhou na sintaxe do fixture de teste, devido à expansão de um padrão de substituição no trecho de personalização. Reconstruído o trecho sem expressão regular e removida a duplicação, preservando os testes de equipamento, animação, teclado, acessibilidade e perda de contexto. Nova execução necessária para confirmar aprovação.

## 11. Homologação autenticada antes da entrega

- [x] Preparar etapa dependente da aprovação das três variantes, reutilizando o artefato Blender da mesma execução.
- [x] Preparar teste de Arsenal autenticado com PostgreSQL descartável e identidades simuladas, verificando abertura sob demanda, troca de personagem, prévia de arma, preservação de posse/equipamento e persistência de estilo após recarregar.
- [x] Preparar lint, TypeScript, build, auditoria de dependências e suíte web completa sem rota temporária de laboratório.
- [ ] Aprovar integração e revisar capturas. Somente após sucesso o runner disponibiliza o pacote de integração com GLBs, lockfile, componentes e teste autenticado. Não há escrita automática na main.

A geração e exportação Blender permanecem aprovadas para sete clips; o pipeline 46152071266 passou TypeScript e está em execução. A nova etapa não utiliza dados nem credenciais de produção.

### Correção de acessibilidade dos controles de aparência

CI 46152196486 e 46152071266: nas três variantes, os testes de movimento reduzido e de pausa/teclado/axe/recuperação passaram em desktop e mobile (4/6 por variante, 12/18 no total). A suíte de catálogo chegou aos campos de aparência, mas esperou pelo rótulo exato `Cabelo` até atingir 180 s. A etapa autenticada foi corretamente bloqueada. Corrigida a associação dos cinco campos com `htmlFor`/`id`, nome acessível explícito e busca por combobox; acrescentada verificação antecipada dos cinco controles e limite de 10 s por ação. Nenhum teste foi excluído. A próxima CI precisa confirmar a correção e completar a homologação.


## Publicação do código-fonte na main

O código-fonte do laboratório, os geradores, testes, documentação e correção do botão Restaurar foram incorporados à main por solicitação do proprietário. A CI principal anterior está aprovada. A execução de integração 46152969894 aprovou as três variantes isoladas e 18/20 testes autenticados; os dois erros de acessibilidade foram corrigidos em 115da01. A execução 46154383597 revalida a correção. Os GLB compilados, o lockfile preparado e a ativação do visualizador no Arsenal ainda não estão incluídos na main. O avatar anterior permanece oficial. Nenhuma release foi criada.


## Entrega do Avatar V2 na main

Os GLB reexportados pelo Blender, manifest e lockfile, visualizador, integração no Arsenal e testes autenticados foram incorporados à main. A transferência 46154648698 verificou SHA-256 dos seis arquivos do artefato `avatar-v2-prepared-blender` da execução 46154383597. As três variantes passaram nos testes isolados e a etapa de integração autenticada, incluindo lint, typecheck, build, auditoria de dependências e 20 testes Playwright, foi aprovada. O visualizador é opcional, carregado sob demanda no Arsenal pelo botão “Abrir laboratório GLB”; o avatar anterior continua disponível. Não houve alteração de banco ou regras RPG, nem release. A CI e o deploy da main após a integração precisam ser confirmados. A revisão artística, colisões e desempenho físico continuam pendentes.
