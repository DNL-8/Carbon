# Avatar 3D — primeira implementação

- Renderização WebGL de geometria low-poly procedural, com profundidade, iluminação por face, articulações locais e rotação completa por clique/toque.
- Mantém os quatro slots e utiliza as 33 famílias, cores e IDs existentes no catálogo de 104 itens. As peças são variantes geométricas por família, não 104 modelos artísticos independentes.
- Mantém o SVG anterior como fallback de hardware, perda de contexto ou falha na inicialização. Nenhuma mudança na economia, API ou persistência.
- Respeita pausa e movimento reduzido; limita resolução e frequência de renderização, não desenha quando fora da área visível.
- Homologação pendente: executar typecheck, build e Playwright, verificar capturas de todas as famílias, combinações de peças, oclusão em rotação completa e dispositivos reais. Não publicar na main antes de validar.
- Nenhuma dependência nova; escolha de WebGL nativo para não alterar manifest e lockfile sem instalação verificável. Considerar Three.js caso a evolução exija modelos GLB, skinning ou física avançada.
