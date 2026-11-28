# Avatar 3D — primeira implementação

- Renderização WebGL de geometria low-poly procedural, com profundidade, iluminação por face, articulações locais e rotação completa por clique/toque.
- Mantém os quatro slots e utiliza as 33 famílias, cores e IDs existentes no catálogo de 104 itens. As peças são variantes geométricas por família, não 104 modelos artísticos independentes.
- Mantém o SVG anterior como fallback de hardware, perda de contexto ou falha na inicialização. Nenhuma mudança na economia, API ou persistência.
- Respeita pausa e movimento reduzido; limita resolução e frequência de renderização, não desenha quando fora da área visível.
- Homologação: o build, typecheck e os testes de prévias individuais passaram em ae4475b; a CI completa ainda falhou no simulador do Oráculo. Revisar capturas, oclusões em rotação e dispositivos reais. Testes de conjuntos completos e verificação explícita de WebGL quando disponível adicionados na revisão seguinte; revalidar no CI.
- Otimização: cancela o loop de animation frames fora da tela, com aba oculta ou após renderização estática em pausa/movimento reduzido; retoma por visibilidade, mudança de configuração ou props. Calcula cor por triângulo, não por vértice. Não implica medição de bateria ou FPS em aparelho real.
- Nenhuma dependência nova; escolha de WebGL nativo para não alterar manifest e lockfile sem instalação verificável. Considerar Three.js caso a evolução exija modelos GLB, skinning ou física avançada.

## Personalização do personagem

A engrenagem no cabeçalho e no Arsenal abre as opções Murim, Caçador e Automático. A escolha muda a identidade do modelo 3D e acompanha o personagem na sessão de treino. A opção Equipamentos dos dois mundos libera a visualização e escolha de ambas as trilhas no catálogo; desativada, filtra para a trilha escolhida e itens iniciais, sem desequipar peças nem bloquear conjuntos salvos. O servidor continua autorizando aquisições e equipamentos possuídos. Preferências cosméticas são guardadas localmente por conta neste navegador, sem migração ou sincronização entre dispositivos. O fallback SVG mantém a camada de equipamentos. Testes de desktop e mobile verificam seleção, filtros, recarga e preservação do inventário; execução pendente.

## Aparências e conjuntos por personagem

A engrenagem permite editar cabelo, rosto, tom de pele, cor do cabelo e energia separadamente para Murim e Caçador, com prévia. O campo avatar existente (até 24 caracteres) guarda a codificação versionada c2, validada no servidor; não há novo schema nem mudança de OpenAPI. O primeiro salvamento importa a escolha antiga do navegador quando não existe uma preferência no perfil. A sincronização utiliza o perfil autenticado, com salvamento explícito; o último salvamento prevalece em edição concorrente. O formulário normal preserva o código salvo quando omite o campo. Os elmos fechados ocultam rosto/cabelo. As duas ações de conjunto no Arsenal reutilizam os conjuntos salvos do servidor: salvam peças atualmente equipadas, podem ser aplicadas explicitamente e não alteram XP/Qi ou propriedade; para substituir um conjunto, exclua o preset antigo e salve o atual. Não há troca automática de equipamento nem inventário duplicado. A personalização está implementada na web; Android nativo não ganhou editor. Testes adicionados, aguardando CI.
