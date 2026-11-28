# Avatar V3 — anatomia PC / fase 1

Branch experimental `feature/avatar-v3-high-poly`. V2 permanece publicado e intocado. Sem integração, deploy ou release. Blender gratuito no runner descartável. Sem novas dependências do app.

O gerador `anatomy.py` cria duas bases originais de escultura em argila, em A-pose, sem cabelo ou vestimenta final. Murim mais esguio/atlético, Caçador mais robusto. Volumes anatômicos fundidos por voxel remesh e suavizados; inclui tórax, abdômen, costas, braços, pernas, mãos com dedos, base craniana e planos faciais. É blockout procedural, não escultura artística manual premium. Não contém rig, UVs, texturas PBR, expressões, equipamentos ou integração web. A decimação produz um candidato geométrico de PC, não retopologia adequada à animação.

## Executar localmente

Com Blender instalado, na raiz do repositório:

```powershell
blender -b --factory-startup --python-exit-code 1 --python frontend/experiments/avatar-v3/anatomy.py -- avatar-v3-output
```

A CI gera os .blend, GLBs isolados, capturas frontal/3/4/costas e relatórios JSON. Critérios: escultura com pelo menos 300 mil triângulos, candidato desktop entre 100 e 200 mil, zero arestas não manifold, altura entre 1,75 e 2 m, GLB até 20 MB. Metas iniciais, não resultados medidos. Refinar proporções e topologia após revisão visual. A meta artística de 1–5 milhões de polígonos não é garantida pelo blockout; densidade por si só não comprova qualidade.

## Checklist

- [x] Gerador de duas bases e pipeline Blender implementados.
- [ ] CI aprovada e métricas reais verificadas.
- [ ] Revisão visual das silhuetas, mãos, pés e proporções.
- [ ] Refinamento anatômico artístico e topologia para rig.
- [ ] Fase 2: rostos, expressões e cabelos.
- [ ] Fases posteriores: vestimentas, equipamentos, rig, animações, energia, renderização e homologação PC.

Não executar o preparador V2 na main. Nenhuma alteração de inventário, progresso, API ou banco. A meta de 60 FPS depende de medição em PC real; render offline não mede FPS no navegador.
