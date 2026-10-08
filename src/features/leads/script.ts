/** Roteiro de ligação DPlay — material de apoio, não precisa ser lido ao pé da letra. */
export type ScriptSection = { title: string; guidance: string; lines: string[] };

export const CALL_SCRIPT: ScriptSection[] = [
  {
    title: "Apresentação — quem você é e de onde veio o contato",
    guidance:
      "Comece explicando quem é você e como chegou até aquele cliente. Se for uma indicação, mencione o nome de quem indicou. Se o cliente veio do Instagram, diga onde você viu ele interagir com a DPlay. Isso cria contexto imediato e quebra a frieza do primeiro contato.",
    lines: [
      "Alô, [nome do gestor]?",
      "Bom dia! Aqui é [seu nome], da DPlay Solutions. A gente desenvolve soluções digitais para empresas, como sistemas, automações e sites. Você consegue falar comigo por uns 3 minutos?",
      "Encontramos o contato da empresa por [informar a fonte real: site, Instagram, indicação ou outra]. Entrei em contato porque acredito que pode fazer sentido conversar sobre como vocês lidam hoje com [problema observado, se houver].",
    ],
  },
  {
    title: "Início da conversa",
    guidance:
      "Explique brevemente o que a DPlay faz e descubra se o gestor já conhece a empresa. Evite listar todos os serviços: a apresentação deve abrir espaço para ouvir a realidade do potencial cliente.",
    lines: [
      "Você já conhece a DPlay?",
      "[Se sim] Que bom! Conheceu a gente por onde?",
      "[Se não] A DPlay trabalha com desenvolvimento de sistemas personalizados, automações e soluções digitais para empresas. Nosso primeiro passo é entender o problema e a rotina da operação antes de pensar no que precisa ser desenvolvido.",
    ],
  },
  {
    title: "Identificação da necessidade",
    guidance:
      "Faça perguntas abertas para identificar tarefas manuais, retrabalho e dificuldades de controle. Escolha as perguntas conforme a resposta do gestor, sem transformar a ligação em um questionário.",
    lines: [
      "Eu queria bater esse papo com você para entender melhor como é a funcionalidade da sua empresa hoje.",
      "Me explica um pouco como vocês trabalham hoje e o que você acha que te dá mais dor de cabeça no dia a dia?",
    ],
  },
  {
    title: "Conexão entre a necessidade e a DPlay",
    guidance:
      "Resuma o problema com as palavras do gestor antes de falar de uma possível solução. Não prometa um sistema ou uma automação específica sem conhecer melhor o processo.",
    lines: [
      "Então, pelo que entendi, hoje vocês têm dificuldade com [problema citado], e isso acaba gerando [impacto citado].",
      "É esse o principal ponto que vocês gostariam de melhorar?",
    ],
  },
  {
    title: "Convite para a reunião de diagnóstico",
    guidance:
      "Se houver uma necessidade compatível com a atuação da DPlay, proponha uma reunião para aprofundar o diagnóstico. Ofereça duas opções de horário para facilitar a decisão.",
    lines: [
      "Acho que vale conversarmos com mais calma para entender como esse processo funciona e avaliar o que faria sentido para vocês. Podemos marcar uma reunião de cerca de 30 minutos? Tenho [dia e horário] ou [dia e horário]. Qual é melhor?",
    ],
  },
  {
    title: "Encerramento e registro no CRM",
    guidance:
      "Antes de encerrar, confirme o que ficou combinado. Depois da ligação, registre no CRM a necessidade identificada, o resultado do contato, a próxima ação e sua data.",
    lines: [
      "Combinado, [nome]. Vou te enviar a confirmação da nossa reunião para [dia], às [horário]. Obrigado pelo seu tempo!",
    ],
  },
];
