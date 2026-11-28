# Avatar 3D — primeira implementação

- Renderização WebGL de geometria low-poly procedural, com profundidade, iluminação por face, articulações locais e rotação completa por clique/toque.
- Mantém os quatro slots e utiliza as 33 famílias, cores e IDs existentes no catálogo de 104 itens. As peças são variantes geométricas por família, não 104 modelos artísticos independentes.
- Mantém o SVG anterior como fallback de hardware, perda de contexto ou falha na inicialização. Nenhuma mudança na economia, API ou persistência.
- Respeita pausa e movimento reduzido; limita resolução e frequência de renderização, não desenha quando fora da área visível.
- Homologação: o build, typecheck e os testes de prévias individuais passaram em ae4475b; a CI completa ainda falhou no simulador do Oráculo. Revisar capturas, oclusões em rotação e dispositivos reais. Testes de conjuntos completos e verificação explícita de WebGL quando disponível adicionados na revisão seguinte; revalidar no CI.
- Otimização: cancela o loop de animation frames fora da tela, com aba oculta ou após renderização estática em pausa/movimento reduzido; retoma por visibilidade, mudança de configuração ou props. Calcula cor por triângulo, não por vértice. Não implica medição de bateria ou FPS em aparelho real.
- Nenhuma dependência nova; escolha de WebGL nativo para não alterar manifest e lockfile sem instalação verificável. Considerar Three.js caso a evolução exija modelos GLB, skinning ou física avançada.
