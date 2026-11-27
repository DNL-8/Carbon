import type { WorkoutTemplate } from '../types/fitness.ts';

export const INITIAL_WORKOUTS: readonly WorkoutTemplate[] = [
  {
    id: 'w-despertar-guerreiro-a',
    name: 'Despertar do Guerreiro — Treino A',
    description:
      'Foco: Pernas e empurrar · Equipamentos: Barra 150 cm, Barra 50 cm e Anilhas 5 kg. Trilha inicial Rank F para construir base de força e estabilidade.',
    type: 'forca',
    difficulty: 'Iniciante',
    durationMinutes: 40,
    baseXp: 120,
    rank: 'F',
    exercises: [
      {
        id: 'ex-dg-a-1',
        name: 'Agachamento goblet',
        prescription: '3 séries x 12 repetições',
        restSeconds: 60,
        muscleGroups: ['Quadríceps', 'Glúteos', 'Core'],
        executionTip:
          'Segure a barra curta verticalmente ou a anilha junto ao peito, desça com joelhos alinhados aos pés e suba empurrando o chão.',
        equipment: 'Barra 50 cm + 2 anilhas de 5 kg',
        loadKg: 10,
        loadNote: 'Sugestão leve (5–10 kg) segurando junto ao peito · Editável',
        unilateral: false,
      },
      {
        id: 'ex-dg-a-2',
        name: 'Flexão inclinada',
        prescription: '3 séries x 8-10 repetições',
        restSeconds: 60,
        muscleGroups: ['Peitoral', 'Tríceps', 'Ombros'],
        executionTip:
          'Apoie as mãos em banco, mesa firme ou parede; mantenha cotovelos a ~45° e tronco alinhado da cabeça aos tornozelos.',
        equipment: 'Peso corporal',
        loadKg: 0,
        loadNote: 'Peso corporal com apoio inclinado para progressão segura',
        unilateral: false,
      },
      {
        id: 'ex-dg-a-3',
        name: 'Desenvolvimento em pé',
        prescription: '3 séries x 8 repetições',
        restSeconds: 60,
        muscleGroups: ['Ombros', 'Tríceps', 'Core'],
        executionTip:
          'Trave abdômen e glúteos para não arquear a lombar; empurre a barra acima da cabeça alinhando orelhas e braços no topo.',
        equipment: 'Barra 150 cm + anilhas de 5 kg',
        loadKg: 10,
        loadNote: 'Carga inicial leve (5–10 kg) · Ajuste conforme conforto nos ombros',
        unilateral: false,
      },
      {
        id: 'ex-dg-a-4',
        name: 'Afundo alternado',
        prescription: '3 séries x 8 por perna',
        restSeconds: 60,
        muscleGroups: ['Quadríceps', 'Glúteos'],
        executionTip:
          'Dê um passo controlado à frente ou atrás até ambos os joelhos formarem ~90° e empurre pelo calcanhar da perna da frente.',
        equipment: 'Barra 50 cm + anilha de 5 kg',
        loadKg: 5,
        loadNote: 'Carga leve (5–10 kg) ou apenas peso corporal · 8 reps por perna',
        unilateral: true,
      },
      {
        id: 'ex-dg-a-5',
        name: 'Prancha',
        prescription: '3 séries x 20-30 s',
        restSeconds: 45,
        muscleGroups: ['Core', 'Ombros'],
        executionTip:
          'Apoie os antebraços abaixo dos ombros, contraia abdômen e glúteos mantendo coluna neutra e respiração contínua.',
        equipment: 'Peso corporal',
        loadKg: 0,
        loadNote: 'Isometria controlada · Foque na estabilidade lombar',
        unilateral: false,
      },
    ],
  },
  {
    id: 'w-despertar-guerreiro-b',
    name: 'Despertar do Guerreiro — Treino B',
    description:
      'Foco: Puxar e posterior · Equipamentos: Barra 150 cm, Barra 50 cm e Anilhas 5 kg. Trilha inicial Rank F para fortalecer costas, posteriores e glúteos.',
    type: 'forca',
    difficulty: 'Iniciante',
    durationMinutes: 40,
    baseXp: 120,
    rank: 'F',
    exercises: [
      {
        id: 'ex-dg-b-1',
        name: 'Levantamento terra romeno',
        prescription: '3 séries x 10 repetições',
        restSeconds: 75,
        muscleGroups: ['Posteriores', 'Glúteos', 'Lombar'],
        executionTip:
          'Com joelhos levemente flexionados, empurre o quadril para trás deslizando a barra rente às coxas até alongar os posteriores.',
        equipment: 'Barra 150 cm + 2 anilhas de 5 kg',
        loadKg: 10,
        loadNote: 'Carga inicial leve (5–10 kg) com coluna neutra e peito aberto',
        unilateral: false,
      },
      {
        id: 'ex-dg-b-2',
        name: 'Remada curvada',
        prescription: '3 séries x 10 repetições',
        restSeconds: 60,
        muscleGroups: ['Costas', 'Bíceps', 'Core'],
        executionTip:
          'Incline o tronco a ~45° com abdômen firme e puxe a barra em direção ao umbigo aproximando as escápulas sem dar tranco.',
        equipment: 'Barra 150 cm + 2 anilhas de 5 kg',
        loadKg: 10,
        loadNote: 'Carga inicial leve (5–10 kg) · Controle a descida',
        unilateral: false,
      },
      {
        id: 'ex-dg-b-3',
        name: 'Ponte de glúteos',
        prescription: '3 séries x 15 repetições',
        restSeconds: 60,
        muscleGroups: ['Glúteos', 'Posteriores'],
        executionTip:
          'Deitado com joelhos flexionados, empurre os calcanhares no chão elevando o quadril até alinhar ombros, quadril e joelhos.',
        equipment: 'Anilha de 5 kg ou Barra 50 cm',
        loadKg: 5,
        loadNote: 'Sugestão de 5–10 kg apoiada no quadril · Pause 1s no topo',
        unilateral: false,
      },
      {
        id: 'ex-dg-b-4',
        name: 'Rosca direta',
        prescription: '3 séries x 10 repetições',
        restSeconds: 45,
        muscleGroups: ['Bíceps', 'Antebraços'],
        executionTip:
          'Fixe os cotovelos junto ao tronco e flexione os braços controladamente evitando balançar a lombar na subida.',
        equipment: 'Barra 150 cm ou Barra 50 cm + anilha 5 kg',
        loadKg: 5,
        loadNote: 'Carga leve (5–10 kg) · Amplitude completa sem impulso',
        unilateral: false,
      },
      {
        id: 'ex-dg-b-5',
        name: 'Superman',
        prescription: '3 séries x 12 repetições',
        restSeconds: 45,
        muscleGroups: ['Lombar', 'Glúteos', 'Ombros'],
        executionTip:
          'Deitado de bruços, eleve suavemente braços e pernas contraindo glúteos e costas por 1s sem estender demais o pescoço.',
        equipment: 'Peso corporal',
        loadKg: 0,
        loadNote: 'Peso corporal no solo · Movimento lento e controlado',
        unilateral: false,
      },
    ],
  },
  {
    id: 'w-cardio-iniciante',
    name: 'Cardio Iniciante: Trilha do Explorador',
    description:
      'Desperte seu sistema cardiovascular com movimentos dinâmicos de baixo impacto para ganhar fôlego e queimar calorias.',
    type: 'cardio',
    difficulty: 'Iniciante',
    durationMinutes: 20,
    baseXp: 110,
    rank: 'E',
    exercises: [
      {
        id: 'ex-ci-1',
        name: 'Marcha Estacionária com Elevação de Joelhos',
        prescription: '3 séries x 45 segundos',
        restSeconds: 30,
        muscleGroups: ['Quadríceps', 'Core', 'Cardiovascular'],
        executionTip:
          'Mantenha o tronco ereto, contraia o abdômen e coordene o balanço natural dos braços.',
      },
      {
        id: 'ex-ci-2',
        name: 'Polichinelo Controlado (Step Jack)',
        prescription: '3 séries x 40 segundos',
        restSeconds: 30,
        muscleGroups: ['Ombros', 'Panturrilhas', 'Cardiovascular'],
        executionTip:
          'Aterrisse suavemente na ponta dos pés e mantenha os ombros longe das orelhas.',
      },
      {
        id: 'ex-ci-3',
        name: 'Deslocamento Lateral com Toque no Joelho',
        prescription: '3 séries x 45 segundos',
        restSeconds: 30,
        muscleGroups: ['Glúteos', 'Adutores', 'Cardiovascular'],
        executionTip:
          'Dê dois passos largos para cada lado mantendo os joelhos levemente flexionados.',
      },
      {
        id: 'ex-ci-4',
        name: 'Corrida Leve no Lugar (Trote)',
        prescription: '3 séries x 60 segundos',
        restSeconds: 40,
        muscleGroups: ['Pernas', 'Panturrilhas', 'Cardiovascular'],
        executionTip:
          'Mantenha uma respiração ritmada pelo nariz e boca sem tensionar o pescoço.',
      },
    ],
  },
  {
    id: 'w-forca-iniciante',
    name: 'Força Iniciante: Forja do Escudeiro',
    description:
      'Construa base muscular sólida dominando os padrões fundamentais de empurrar, agachar e estabilizar.',
    type: 'forca',
    difficulty: 'Iniciante',
    durationMinutes: 25,
    baseXp: 125,
    rank: 'E',
    exercises: [
      {
        id: 'ex-fi-1',
        name: 'Agachamento Livre Peso Corporal',
        prescription: '3 séries x 12 repetições',
        restSeconds: 45,
        muscleGroups: ['Quadríceps', 'Glúteos', 'Posteriores'],
        executionTip:
          'Empurre o quadril para trás como se fosse sentar em uma cadeira, mantendo os calcanhares firmes no chão.',
      },
      {
        id: 'ex-fi-2',
        name: 'Flexão de Braços Inclinada ou com Joelhos',
        prescription: '3 séries x 10 repetições',
        restSeconds: 45,
        muscleGroups: ['Peitoral', 'Tríceps', 'Deltoide Anterior'],
        executionTip:
          'Mantenha o corpo alinhado da cabeça ao quadril e desça o peito controladamente.',
      },
      {
        id: 'ex-fi-3',
        name: 'Ponte de Glúteos no Solo',
        prescription: '3 séries x 15 repetições',
        restSeconds: 40,
        muscleGroups: ['Glúteos', 'Posteriores de Coxa', 'Lombar'],
        executionTip:
          'Contraia fortemente os glúteos no topo do movimento por 1 segundo sem hiperestender a lombar.',
      },
      {
        id: 'ex-fi-4',
        name: 'Remada Curvada Isométrica / Superman',
        prescription: '3 séries x 12 repetições',
        restSeconds: 45,
        muscleGroups: ['Dorsais', 'Trapézio', 'Eretores da Espinha'],
        executionTip:
          'Puxe os cotovelos para trás fechando as escápulas e olhe para o chão para alinhar a cervical.',
      },
    ],
  },
  {
    id: 'w-hiit-intermediario',
    name: 'HIIT Intermediário: Fúria do Relâmpago',
    description:
      'Rajadas curtas de alta intensidade para acelerar o metabolismo e elevar sua capacidade anaeróbica ao limite.',
    type: 'hiit',
    difficulty: 'Intermediário',
    durationMinutes: 25,
    baseXp: 165,
    rank: 'C',
    exercises: [
      {
        id: 'ex-hi-1',
        name: 'Burpee Sem Flexão (Sprawl Explosivo)',
        prescription: '4 séries x 35 segundos',
        restSeconds: 25,
        muscleGroups: ['Corpo Inteiro', 'Core', 'Cardiovascular'],
        executionTip:
          'Estenda as pernas para trás em prancha firme, sem deixar o quadril cair, e salte com energia.',
      },
      {
        id: 'ex-hi-2',
        name: 'Escalador Rápido (Mountain Climber)',
        prescription: '4 séries x 40 segundos',
        restSeconds: 20,
        muscleGroups: ['Abdômen', 'Ombros', 'Flexores de Quadril'],
        executionTip:
          'Mantenha as mãos exatamente abaixo dos ombros e traga os joelhos em direção ao peito em ritmo veloz.',
      },
      {
        id: 'ex-hi-3',
        name: 'Agachamento com Salto',
        prescription: '4 séries x 12 repetições',
        restSeconds: 30,
        muscleGroups: ['Quadríceps', 'Glúteos', 'Panturrilhas'],
        executionTip:
          'Amorteça cada queda flexionando imediatamente os joelhos para proteger as articulações.',
      },
      {
        id: 'ex-hi-4',
        name: 'Corrida Alta (High Knees)',
        prescription: '4 séries x 35 segundos',
        restSeconds: 25,
        muscleGroups: ['Core', 'Quadríceps', 'Cardiovascular'],
        executionTip:
          'Eleve os joelhos até a linha do quadril mantendo a postura firme e olhar à frente.',
      },
    ],
  },
  {
    id: 'w-abdomen',
    name: 'Abdômen: Muralha de Aço',
    description:
      'Fortaleça o núcleo do seu herói para estabilidade total, postura blindada e resistência central.',
    type: 'core',
    difficulty: 'Intermediário',
    durationMinutes: 20,
    baseXp: 135,
    rank: 'D',
    exercises: [
      {
        id: 'ex-ab-1',
        name: 'Prancha Isométrica Frontal',
        prescription: '3 séries x 45 segundos',
        restSeconds: 30,
        muscleGroups: ['Transverso do Abdômen', 'Reto Abdominal', 'Ombros'],
        executionTip:
          'Empurre os antebraços contra o chão, contraia glúteos e abdômen como se esperasse um impacto.',
      },
      {
        id: 'ex-ab-2',
        name: 'Abdominal Bicicleta Controlado',
        prescription: '3 séries x 20 repetições (10/lado)',
        restSeconds: 35,
        muscleGroups: ['Oblíquos', 'Reto Abdominal'],
        executionTip:
          'Gire o tronco levando o ombro em direção ao joelho oposto sem puxar o pescoço com as mãos.',
      },
      {
        id: 'ex-ab-3',
        name: 'Elevação de Pernas Deitado',
        prescription: '3 séries x 12 repetições',
        restSeconds: 40,
        muscleGroups: ['Infra-abdominal', 'Flexores de Quadril'],
        executionTip:
          'Mantenha a lombar colada no colchonete durante toda a descida das pernas.',
      },
      {
        id: 'ex-ab-4',
        name: 'Prancha Lateral Alternada',
        prescription: '3 séries x 30 segundos por lado',
        restSeconds: 30,
        muscleGroups: ['Oblíquos', 'Quadrado Lombar', 'Glúteo Médio'],
        executionTip:
          'Mantenha o quadril elevado formando uma linha reta dos pés até a cabeça.',
      },
    ],
  },
  {
    id: 'w-pernas',
    name: 'Pernas: Passos do Titã',
    description:
      'Desenvolva potência, equilíbrio e força nos membros inferiores para sustentar qualquer missão.',
    type: 'forca',
    difficulty: 'Intermediário',
    durationMinutes: 35,
    baseXp: 180,
    rank: 'C',
    exercises: [
      {
        id: 'ex-pe-1',
        name: 'Afundo Alternado (Lunge)',
        prescription: '4 séries x 10 repetições por perna',
        restSeconds: 50,
        muscleGroups: ['Quadríceps', 'Glúteos', 'Posteriores'],
        executionTip:
          'Dê um passo firme e desça até ambos os joelhos formarem ângulos próximos a 90 graus.',
      },
      {
        id: 'ex-pe-2',
        name: 'Agachamento Sumô com Pausa',
        prescription: '4 séries x 14 repetições',
        restSeconds: 50,
        muscleGroups: ['Adutores', 'Glúteos', 'Quadríceps'],
        executionTip:
          'Afaste bem os pés com pontas levemente para fora e segure 2 segundos no ponto mais baixo.',
      },
      {
        id: 'ex-pe-3',
        name: 'Agachamento Búlgaro (Pé Elevado)',
        prescription: '3 séries x 10 repetições por perna',
        restSeconds: 60,
        muscleGroups: ['Quadríceps', 'Glúteo Máximo', 'Estabilizadores'],
        executionTip:
          'Concentre 80% do peso na perna da frente e mantenha o tronco levemente inclinado à frente.',
      },
      {
        id: 'ex-pe-4',
        name: 'Elevação de Panturrilha Unilateral',
        prescription: '4 séries x 15 repetições por perna',
        restSeconds: 30,
        muscleGroups: ['Gastrocnêmio', 'Sóleo'],
        executionTip:
          'Suba o máximo possível na ponta dos pés e desça lentamente em 3 segundos.',
      },
    ],
  },
  {
    id: 'w-bracos-ombros',
    name: 'Braços e Ombros: Punhos de Trovão',
    description:
      'Esculpa força superior e resistência muscular com foco em peitoral, ombros, bíceps e tríceps.',
    type: 'forca',
    difficulty: 'Intermediário',
    durationMinutes: 30,
    baseXp: 170,
    rank: 'C',
    exercises: [
      {
        id: 'ex-bo-1',
        name: 'Flexão de Braços Tradicional',
        prescription: '4 séries x 12 repetições',
        restSeconds: 50,
        muscleGroups: ['Peitoral', 'Tríceps', 'Ombros'],
        executionTip:
          'Posicione os cotovelos a cerca de 45 graus do tronco para proteger os ombros e maximizar a força.',
      },
      {
        id: 'ex-bo-2',
        name: 'Flexão Pike (Foco em Ombros)',
        prescription: '3 séries x 10 repetições',
        restSeconds: 50,
        muscleGroups: ['Deltoides', 'Tríceps', 'Trapézio Superior'],
        executionTip:
          'Eleve o quadril formando um V invertido e leve o topo da cabeça em direção ao chão entre as mãos.',
      },
      {
        id: 'ex-bo-3',
        name: 'Mergulho no Banco ou Cadeira (Tríceps)',
        prescription: '3 séries x 14 repetições',
        restSeconds: 45,
        muscleGroups: ['Tríceps Braquial', 'Deltoide Anterior'],
        executionTip:
          'Mantenha as costas próximas à borda do apoio e evite deixar os ombros subirem.',
      },
      {
        id: 'ex-bo-4',
        name: 'Prancha Toca-Ombros (Shoulder Taps)',
        prescription: '3 séries x 20 toques alternados',
        restSeconds: 40,
        muscleGroups: ['Ombros', 'Core', 'Serrátil'],
        executionTip:
          'Afaste levemente os pés para evitar que o quadril balance ao tirar uma das mãos do solo.',
      },
    ],
  },
  {
    id: 'w-mobilidade',
    name: 'Mobilidade: Ritual de Restauração',
    description:
      'Recupere a amplitude articular, alivie tensões acumuladas e previna lesões com fluidez e controle.',
    type: 'mobilidade',
    difficulty: 'Iniciante',
    durationMinutes: 15,
    baseXp: 95,
    rank: 'E',
    exercises: [
      {
        id: 'ex-mo-1',
        name: 'Gato-Camelo (Mobilidade Torácica e Lombar)',
        prescription: '3 séries x 10 ciclos lentos',
        restSeconds: 20,
        muscleGroups: ['Coluna Vertebral', 'Core', 'Ombros'],
        executionTip:
          'Inspire arqueando suavemente a coluna e expire arredondando as costas vértebra por vértebra.',
      },
      {
        id: 'ex-mo-2',
        name: 'Maior Alongamento do Mundo',
        prescription: '3 séries x 6 repetições por lado',
        restSeconds: 25,
        muscleGroups: ['Quadril', 'Coluna Torácica', 'Posteriores'],
        executionTip:
          'Avance um pé ao lado da mão, desça o cotovelo ao solo e depois gire o braço abrindo o peito para o teto.',
      },
      {
        id: 'ex-mo-3',
        name: 'Agachamento Profundo com Rotação',
        prescription: '3 séries x 30 segundos',
        restSeconds: 25,
        muscleGroups: ['Tornozelos', 'Quadril', 'Torácica'],
        executionTip:
          'Use os cotovelos para empurrar suavemente os joelhos para fora enquanto respira fundo.',
      },
      {
        id: 'ex-mo-4',
        name: 'Postura da Criança com Alcance Lateral',
        prescription: '2 séries x 30 segundos por lado',
        restSeconds: 20,
        muscleGroups: ['Dorsais', 'Ombros', 'Lombar'],
        executionTip:
          'Sente sobre os calcanhares e caminhe com as mãos para a diagonal sentindo o alongamento lateral.',
      },
    ],
  },
  {
    id: 'w-corpo-inteiro',
    name: 'Corpo Inteiro: Ascensão do Soberano',
    description:
      'Uma masmorra completa de alta exigência que testa força, fôlego e determinação de todo o corpo.',
    type: 'corpo_inteiro',
    difficulty: 'Avançado',
    durationMinutes: 40,
    baseXp: 240,
    rank: 'S',
    exercises: [
      {
        id: 'ex-ci-adv-1',
        name: 'Burpee Completo com Salto Vertical',
        prescription: '4 séries x 12 repetições',
        restSeconds: 45,
        muscleGroups: ['Corpo Inteiro', 'Peitoral', 'Quadríceps'],
        executionTip:
          'Toque o peito no solo com controle, suba em bloco único e salte estendendo os braços acima da cabeça.',
      },
      {
        id: 'ex-ci-adv-2',
        name: 'Flexão Arqueiro (Archer Push-Up)',
        prescription: '4 séries x 8 repetições (4/lado)',
        restSeconds: 60,
        muscleGroups: ['Peitoral', 'Tríceps', 'Ombros', 'Core'],
        executionTip:
          'Mantenha um braço estendido lateralmente enquanto o outro realiza o trabalho principal de flexão.',
      },
      {
        id: 'ex-ci-adv-3',
        name: 'Agachamento Pistol Assistido ou Salto Lunge',
        prescription: '4 séries x 12 repetições alternadas',
        restSeconds: 50,
        muscleGroups: ['Quadríceps', 'Glúteos', 'Equilíbrio'],
        executionTip:
          'Mantenha o tronco vertical e controle a descida sem deixar o joelho colapsar para dentro.',
      },
      {
        id: 'ex-ci-adv-4',
        name: 'Prancha Comando (Sobe e Desce)',
        prescription: '4 séries x 12 repetições',
        restSeconds: 45,
        muscleGroups: ['Core', 'Tríceps', 'Ombros'],
        executionTip:
          'Alterne o braço que inicia a subida a cada série mantendo o quadril o mais estável possível.',
      },
      {
        id: 'ex-ci-adv-5',
        name: 'Sprint Estacionário Final (All-Out)',
        prescription: '4 séries x 30 segundos',
        restSeconds: 30,
        muscleGroups: ['Cardiovascular', 'Pernas', 'Core'],
        executionTip:
          'Dê sua velocidade máxima nos últimos 30 segundos mantendo a técnica limpa.',
      },
    ],
  },
  {
    id: 'w-calistenia-upper-a',
    name: 'Calistenia Híbrida — Dia A: Superior',
    description:
      'Empurrar, puxar e estabilizar o core combinando paralelas de parede com cargas progressivas em barra e anilhas.',
    type: 'forca',
    difficulty: 'Intermediário',
    durationMinutes: 45,
    baseXp: 220,
    rank: 'B',
    exercises: [
      {
        id: 'ex-ch-a-1',
        name: 'Paralelas (Dips)',
        prescription: '4 séries x 6-12 repetições',
        restSeconds: 90,
        muscleGroups: ['Peito', 'Tríceps', 'Ombros'],
        executionTip:
          'Peso corporal (adicione anilhas na mochila para progredir). Desça com controle até os ombros alinharem com os cotovelos.',
        equipment: 'Paralelas de parede',
        loadKg: 0,
        loadNote: 'Peso corporal (adicione anilhas na mochila para progredir)',
        unilateral: false,
      },
      {
        id: 'ex-ch-a-2',
        name: 'Remada Curvada',
        prescription: '4 séries x 10-12 repetições',
        restSeconds: 90,
        muscleGroups: ['Costas', 'Bíceps', 'Core'],
        executionTip:
          'Carga das anilhas (somar peso da barra). Mantenha a coluna neutra e puxe a barra em direção ao abdômen fechando as escápulas.',
        equipment: 'Barra 150cm + 4 anilhas de 5kg',
        loadKg: 20,
        loadNote: 'Carga das anilhas (somar peso da barra)',
        unilateral: false,
      },
      {
        id: 'ex-ch-a-3',
        name: 'Flexão de Braço (Declinada ou Padrão)',
        prescription: '3 séries x 10-15 repetições',
        restSeconds: 60,
        muscleGroups: ['Peito', 'Ombros', 'Tríceps'],
        executionTip:
          'Eleve os pés para aumentar a dificuldade. Mantenha glúteos e abdômen firmes em linha reta.',
        equipment: 'Peso corporal',
        loadKg: 0,
        loadNote: 'Eleve os pés para aumentar a dificuldade',
        unilateral: false,
      },
      {
        id: 'ex-ch-a-4',
        name: 'Desenvolvimento Militar (Overhead Press)',
        prescription: '3 séries x 8-12 repetições',
        restSeconds: 90,
        muscleGroups: ['Ombros', 'Tríceps', 'Core'],
        executionTip:
          'Carga das anilhas (somar peso da barra). Trave o abdômen para não hiperestender a lombar ao empurrar acima da cabeça.',
        equipment: 'Barra 150cm + 2 anilhas de 5kg',
        loadKg: 10,
        loadNote: 'Carga das anilhas (somar peso da barra)',
        unilateral: false,
      },
      {
        id: 'ex-ch-a-5',
        name: 'Remada Unilateral (Serrote)',
        prescription: '3 séries x 10-12 repetições',
        restSeconds: 60,
        muscleGroups: ['Costas', 'Bíceps'],
        executionTip:
          '10kg a 15kg em anilhas. Evite girar o tronco; puxe o cotovelo próximo ao corpo com pausa breve no topo.',
        equipment: 'Barra 30cm + 2 a 3 anilhas de 5kg',
        loadKg: 15,
        loadNote: '10kg a 15kg em anilhas',
        unilateral: true,
      },
      {
        id: 'ex-ch-a-6',
        name: 'Rosca Direta + Tríceps Testa (Bi-set)',
        prescription: '3 séries x 10-12 cada',
        restSeconds: 60,
        muscleGroups: ['Bíceps', 'Tríceps'],
        executionTip:
          'Executar um exercício imediatamente após o outro, mantendo os cotovelos fixos durante toda a amplitude.',
        equipment: 'Barra 150cm + 2 anilhas de 5kg',
        loadKg: 10,
        loadNote: 'Executar um exercício imediatamente após o outro',
        unilateral: false,
      },
      {
        id: 'ex-ch-a-7',
        name: 'Elevação de Pernas / L-Sit Hold',
        prescription: '3 séries x 10-15 repetições',
        restSeconds: 60,
        muscleGroups: ['Core'],
        executionTip:
          '10-15 reps ou isometria de 15-30s. Empurre os ombros para baixo nas paralelas evitando balançar o tronco.',
        equipment: 'Paralelas de parede',
        loadKg: 0,
        loadNote: '10-15 reps ou isometria de 15-30s',
        unilateral: false,
      },
    ],
  },
  {
    id: 'w-calistenia-lower-b',
    name: 'Calistenia Híbrida — Dia B: Inferior',
    description:
      'Força de pernas, cadeia posterior, estabilidade unilateral e core anti-rotação com barras e anilhas.',
    type: 'forca',
    difficulty: 'Intermediário',
    durationMinutes: 40,
    baseXp: 220,
    rank: 'B',
    exercises: [
      {
        id: 'ex-ch-b-1',
        name: 'Agachamento Búlgaro',
        prescription: '4 séries x 8-12 repetições',
        restSeconds: 90,
        muscleGroups: ['Quadríceps', 'Glúteos'],
        executionTip:
          '10kg a 20kg em anilhas segurando à frente (Goblet) ou ao lado. Desça controlando o alinhamento do joelho.',
        equipment: 'Barra 30cm + 2 a 4 anilhas de 5kg',
        loadKg: 15,
        loadNote: '10kg a 20kg em anilhas segurando à frente (Goblet) ou ao lado',
        unilateral: true,
      },
      {
        id: 'ex-ch-b-2',
        name: 'Levantamento Terra Romeno (Stiff)',
        prescription: '4 séries x 10-15 repetições',
        restSeconds: 90,
        muscleGroups: ['Posteriores', 'Glúteos', 'Core'],
        executionTip:
          'Carga das anilhas (somar peso da barra). Empurre o quadril para trás mantendo a barra rente às coxas e coluna firme.',
        equipment: 'Barra 150cm + 4 anilhas de 5kg',
        loadKg: 20,
        loadNote: 'Carga das anilhas (somar peso da barra)',
        unilateral: false,
      },
      {
        id: 'ex-ch-b-3',
        name: 'Agachamento Frontal (Front Squat)',
        prescription: '3 séries x 10-15 repetições',
        restSeconds: 90,
        muscleGroups: ['Quadríceps', 'Glúteos', 'Core'],
        executionTip:
          'Barra apoiada nos deltoides anteriores. Mantenha os cotovelos apontados para frente e o tronco vertical.',
        equipment: 'Barra 150cm + 4 anilhas de 5kg',
        loadKg: 20,
        loadNote: 'Barra apoiada nos deltoides anteriores',
        unilateral: false,
      },
      {
        id: 'ex-ch-b-4',
        name: 'Elevação Pélvica Unilateral',
        prescription: '3 séries x 12-15 repetições',
        restSeconds: 60,
        muscleGroups: ['Glúteos', 'Posteriores'],
        executionTip:
          'Anilhas apoiadas diretamente no quadril. Estenda totalmente o quadril segurando 1s no topo sem arquear a lombar.',
        equipment: '1 ou 2 anilhas de 5kg',
        loadKg: 10,
        loadNote: 'Anilhas apoiadas diretamente no quadril',
        unilateral: true,
      },
      {
        id: 'ex-ch-b-5',
        name: 'Panturrilha em Pé Unilateral',
        prescription: '4 séries x 15-20 repetições',
        restSeconds: 45,
        muscleGroups: ['Panturrilhas'],
        executionTip:
          'Usar degrau para maior amplitude. Pause 1s em alongamento máximo no fundo antes de subir.',
        equipment: 'Barra 30cm + 2 anilhas de 5kg',
        loadKg: 10,
        loadNote: 'Usar degrau para maior amplitude',
        unilateral: true,
      },
      {
        id: 'ex-ch-b-6',
        name: 'Prancha Abdominal com Toque no Ombro',
        prescription: '3 séries x 40-60s',
        restSeconds: 45,
        muscleGroups: ['Core'],
        executionTip:
          'Manter o quadril estável durante a troca de mãos; afaste levemente os pés para maior base.',
        equipment: 'Peso corporal',
        loadKg: 0,
        loadNote: 'Manter o quadril estável durante a troca de mãos',
        unilateral: false,
      },
    ],
  },
];
