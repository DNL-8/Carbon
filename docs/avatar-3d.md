# Avatar 3D — estado atual

Atualização: 28/11/2026. Revisão GLB `c36846f` aprovada no laboratório, incorporada à main em `e55aec8`. Este guia descreve o código integrado, não uma confirmação de deploy.

## Experiência do jogador

| Local | Controle |
| --- | --- |
| Arsenal | Engrenagem → Abrir laboratório GLB; controles de rotação em 45°, zoom do rosto, ocultar elmo, restaurar, qualidade gráfica e animações. |
| Início/Painel e treino | Exibir Avatar V2; modo compacto econômico, com animações relacionadas ao treino. |
| Configurações | Murim, Caçador ou Automático; cabelo, rosto, pele, cor de cabelo, energia e equipamentos dos dois mundos. |

A aparência versionada `c2` usa o campo avatar existente do perfil (até 24 caracteres), com salvamento explícito e validação do servidor. As preferências locais são fallback/migração inicial. Os presets de equipamento reutilizam os conjuntos salvos no servidor; não há duplicação do inventário ou troca automática. A prévia não concede bônus, não compra peças e não altera XP/Qi. O editor é web; não há editor 3D nativo Android.

## Implementação

- Dois modelos originais procedurais estilizados, não fotorrealistas: Murim e Caçador, com rig, 15 ossos e cinco malhas deformáveis. Blender é ferramenta de autoria/exportação em CI, não dependência do navegador.
- Three.js 0.186.0, React Three Fiber 9.8.2, GLTFLoader, SkeletonUtils e BufferGeometryUtils. Carregamento dinâmico sem SSR; renderização sob demanda, pausa e respeito a movimento reduzido.
- Sete clips: `idle`, `attack`, `victory`, `rest`, `guard`, `dodge`, `channel`. Capas, cabelos e ombreiras têm movimentos secundários procedurais limitados; não há solver físico completo.
- Quatro slots de inventário: `elmo`, `armadura`, `capa`, `arma`. Cinco sockets internos (incluindo `slot_arma_esquerda` para armas duplas); 33 famílias e 104 variantes geométricas. Os materiais incluem mapas PBR incorporados nos GLB.
- Avatar WebGL procedural anterior e SVG como alternativa continuam no app. Em caso de falha GLB ou perda de contexto, o componente apresenta uma mensagem e preserva a alternativa.

| Arquivo | Responsabilidade |
| --- | --- |
| `frontend/components/avatar-glb-preview.tsx` | Visualizador e acessórios |
| `frontend/components/arsenal.tsx` | Catálogo, prévia e engrenagem |
| `frontend/components/murim.tsx`, `training.tsx` | Visualização compacta |
| `frontend/lib/avatar-preferences.ts`, `equipment-art.ts` | Preferências e famílias visuais |
| `frontend/public/assets/avatar-v2/*.glb` | Modelos integrados |
| `frontend/experiments/avatar-v2/` | Geradores, exportação e testes isolados |

## Desempenho e orçamento

| Modelo | Tamanho integrado |
| --- | ---: |
| Murim | 733.532 bytes |
| Caçador | 741.412 bytes |
| Total | 1.474.944 bytes |

Cada GLB deve respeitar 1.500.000 bytes e 18.000 triângulos. Agrupamento das malhas estáticas por material preserva triângulos e exclui partes animadas. A comparação histórica Blender registrou 124 → 96 draw calls (Murim) e 126 → 98 (Caçador), com o conjunto específico testado antes dos últimos refinamentos. Não extrapolar para todos os equipamentos ou para FPS físico.

## Validação e publicação

- [CI de laboratório 46173361553](https://github.com/DNL-8/Carbon/actions/runs/46173361553): quatro jobs aprovados (rígido, skinned, Blender e Arsenal autenticado). [Transferência 46174356809](https://github.com/DNL-8/Carbon/actions/runs/46174356809): hashes verificados; modelos e visualizador integrados sem alteração de dependências ou regras RPG.
- A revisão anterior de trajetórias analisou 840 intervalos e 200.760 observações de vértices, sem pontos internos nos proxies amostrados. Não certifica colisões exatas nem todas as combinações. Veja [relatório](HOMOLOGACAO-AVATAR-V2.md).
- Revisão visual completa, desempenho/bateria em aparelho físico e homologação da produção continuam pendentes. Veja [checklist](CHECKLIST-AVATAR-V2.md).
- Alterações futuras no laboratório devem preservar orçamento, acessibilidade, IDs, sockets, inventário e fallback. Não executar `prepare.mjs` na main integrada. Não acionar deploy ou criar release sem autorização; o bloqueio de deploy automático está versionado.

A evolução histórica do WebGL procedural para GLB pode ser consultada no histórico Git e no checklist. Não é necessária infraestrutura Unreal/Unity ou renderização remota.
