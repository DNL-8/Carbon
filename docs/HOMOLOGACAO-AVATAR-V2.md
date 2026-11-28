# Homologação Avatar V2 — laboratório

Data: 28/11/2026. Código homologado: `b1404d6060a7fdc8bcd286b050cac43c31c4ae39`. [CI 46169985364](https://github.com/DNL-8/Carbon/actions/runs/46169985364): quatro jobs aprovados (rigid, skinned, Blender e integração autenticada do Arsenal).

## Resultados confirmados

Foram lidos 12 relatórios JSON de trajetórias dos artefatos 15273048827 (Blender), 15273607026 (rigid), 15272583686 (skinned). Em cada variante: dois personagens × dois perfis de navegador × sete clips × dez intervalos.

| Variante | Trajetórias | Intervalos | Amostras de arma | Amostras de capa | Pontos internos aos proxies |
|---|---:|---:|---:|---:|---:|
| Rigid | 28 | 280 | 36120 | 30800 | 0 |
| Skinned | 28 | 280 | 36120 | 30800 | 0 |
| Blender | 28 | 280 | 36120 | 30800 | 0 |
| Total | 84 | 840 | 108360 | 92400 | 0 |

Cada intervalo contém 129 vértices amostrados de arma e 110 de capa. Não são vértices únicos: são observações ao longo do tempo. Nenhuma amostra interna aos três volumes aproximados (Spine, Hips, Head).

## Desempenho

Comparação Blender entre CI 46167504468 (fa54aee) e 46168792940 (b0d1ce7): Murim 124 → 96 draw calls (-22,6%), Caçador 126 → 98 (-22,2%), preservando 14496 e 14120 triângulos respectivamente no conjunto testado.

## Checklist

- [x] Encaixes, visores e armas duplas.
- [x] Ombreiras articuladas.
- [x] Agrupamento estático por material sem redução de triângulos.
- [x] Diagnóstico de trajetórias nas três variantes.
- [x] Relatórios JSON preservados e analisados.
- [x] Integração autenticada aprovada.
- [ ] Revisão visual dos conjuntos e acessórios representativos durante toda a animação.
- [ ] Teste de desempenho, bateria e estabilidade em dispositivo físico.
- [ ] Avaliação de colisões entre malhas completas e outras combinações de equipamentos, se necessária.
- [ ] Integração futura na main somente mediante autorização; sem deploy nesta fase.

A verificação de proximidade usa amostragem e proxies elipsoidais; não comprova ausência de colisões em todas as malhas, combinações ou instantes. O FPS SwiftShader não é representativo de hardware físico. O candidato aprovado está no artefato 15273309009. Não executar prepare.mjs na main integrada. Nenhum deploy solicitado. Branch de produção preservada em 0c19c4d6333c8e08fe5bc63efdbd4a2e2f022209.
