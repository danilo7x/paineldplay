/** Matriz de objeções DPlay — material de apoio para ligação, diagnóstico e proposta. */
export type ObjectionStage = "qualificacao" | "proposta" | "ambos";

export type Objection = { titulo: string; etapa: ObjectionStage; resposta: string };

export const OBJECTION_STAGE_META: Record<ObjectionStage, { label: string; dot: string }> = {
  qualificacao: { label: "Qualificação", dot: "bg-yellow-400" },
  proposta: { label: "Proposta", dot: "bg-red-500" },
  ambos: { label: "Ambos", dot: "bg-orange-400" },
};

export const OBJECTIONS: Objection[] = [
  {
    titulo: "Sem tempo",
    etapa: "qualificacao",
    resposta:
      "Extrair qual o melhor momento para conversar e deixar agendado, com dia e horário. Frisar que a reunião de diagnóstico é online e objetiva, então o gestor não precisa se deslocar nem preparar nada.",
  },
  {
    titulo: "Desinteresse no serviço / “não preciso de site ou sistema”",
    etapa: "qualificacao",
    resposta:
      "Agregar valor ao benefício, e não à tecnologia: mais vendas, menos retrabalho, tempo da equipe de volta. Citar o case mais próximo do setor dele (FYND: aumento de 40 mil reais em 35 dias no faturamento com e-commerce; Decore Piscinas: 100% de controle automático de estoque) ou uma dor visível que foi observada antes do contato, como vender só pelo Instagram/WhatsApp, controlar leads em planilha ou responder tudo manualmente.",
  },
  {
    titulo: "Solicita que envie por e-mail ou WhatsApp",
    etapa: "qualificacao",
    resposta:
      "Explicar que a solução depende do negócio dele, então uma apresentação genérica não mostra o que realmente faz sentido; por isso a conversa vale a pena e dura só 10 minutinhos. Se ele ainda insistir, combinar de mandar a apresentação por WhatsApp e/ou anotar o e-mail, e deixar marcado um momento para continuar a conversa.",
  },
  {
    titulo: "“Já tenho site, sistema ou ferramenta e funciona”",
    etapa: "ambos",
    resposta:
      "Não confrontar o que existe. Perguntar o que ainda é feito à mão, o que ele refaz toda semana e o que não conversa entre os sistemas. Posicionar a DPlay como evolução e integração, e não como substituição, e sugerir começar por uma entrada menor (uma automação ou um site) sem perder a possibilidade de expandir depois.",
  },
  {
    titulo: "Já tem agência, freelancer ou TI interno",
    etapa: "ambos",
    resposta:
      "Perguntar o que ele espera dessa parceria e o que ficou sem resolver. Explicar que a DPlay complementa: integra com o que já existe, assume o que o time não consegue absorver e mantém acompanhamento mensal contínuo. Reforçar a proximidade, com contato direto com os sócios e com quem desenvolve.",
  },
  {
    titulo: "Outras prioridades no momento",
    etapa: "ambos",
    resposta:
      "Identificar quais são as prioridades do gestor ainda no diagnóstico, qualificar e verificar se de fato ele está no tempo de compra. Se estiver, gerar senso de urgência mostrando o custo de manter o processo manual (vendas perdidas, horas da equipe, leads esquecidos) e cenários positivos futuros. Se não estiver, deixar a data de retomada registrada no CRM.",
  },
  {
    titulo: "“Meu negócio é pequeno / ainda não é hora de investir em tecnologia”",
    etapa: "qualificacao",
    resposta:
      "Mostrar que a DPlay estrutura uma entrada de menor investimento e cresce junto com o negócio, sem exigir que ele compre tudo de uma vez. Perguntar onde hoje ele perde tempo ou vendas, para que a solução inicial seja a que mais pesa.",
  },
  {
    titulo: "Não vê a importância de chamar os sócios ou decisores",
    etapa: "qualificacao",
    resposta:
      "Explicar que o diagnóstico só funciona com quem decide e quem opera na mesma conversa, porque a solução é desenhada em cima da rotina real. Isso evita uma nova reunião, dúvidas pendentes e requisitos descobertos no meio da produção, que geram retrabalho.",
  },
  {
    titulo: "Prefere reunião presencial / desconfia do atendimento online",
    etapa: "qualificacao",
    resposta:
      "Explicar que o diagnóstico online permite mostrar telas, fluxos e exemplos em tempo real, e que o acompanhamento segue o mesmo padrão ao longo do projeto: validações pelo WhatsApp e reuniões nos marcos de entrega, com acesso direto aos sócios.",
  },
  {
    titulo: "Não confia em empresa nova ou pequena",
    etapa: "ambos",
    resposta:
      "Apresentar a lista de clientes (Humanniza, RE/MAX España, FYND, Decore, Z&A, Produtiva Júnior) e os cases com resultado. Citar que a DPlay já cuida da cibersegurança de mais de 25 sistemas e sites. Reforçar que o cliente acompanha tudo de perto: o trabalho é validado por etapas e o contrato é formalizado com assinatura digital.",
  },
  {
    titulo: "“Um sistema pronto resolve e é mais barato”",
    etapa: "ambos",
    resposta:
      "Reconhecer que ferramentas prontas atendem muita gente. Perguntar o que ele precisou adaptar na rotina para a ferramenta funcionar e o que ficou de fora. Explicar que na DPlay é o sistema que se adapta ao negócio: campos, etapas, relatórios e integrações são desenhados em cima do processo dele. Quando ele só precisa do básico, sugerir uma entrada simples e evoluir depois.",
  },
  {
    titulo: "“Personalizado deve ser caro e demorado”",
    etapa: "proposta",
    resposta:
      "Desmontar com a lógica da entrada menor: começar pela parte que mais pesa (site, automação ou um CRM enxuto) e crescer em módulos. Mostrar que o cliente vê o resultado cedo, porque a demanda inicial é entregue para validação antes de seguir. Citar prazos de projetos parecidos, se houver.",
  },
  {
    titulo: "“Não sei bem o que preciso”",
    etapa: "qualificacao",
    resposta:
      "Tirar o peso das costas dele: o diagnóstico existe justamente para isso. A DPlay mapeia a operação, identifica o que é manual e levanta os requisitos junto com ele. Ele não precisa chegar com a solução pronta, só com a dor.",
  },
  {
    titulo: "Achou a proposta muito genérica e quer mais especificidade",
    etapa: "proposta",
    resposta:
      "Explicar a importância das etapas iniciais, de diagnóstico e construção da demanda inicial, e que certos detalhes serão definidos com mais assertividade junto com a equipe de execução, sempre com validação do cliente antes da entrega. Retomar o que ele disse no diagnóstico e reescrever o escopo com as palavras e as dores dele. Perguntar o que falta enxergar na proposta e ajustar naquele ponto.",
  },
  {
    titulo: "“E se meu processo mudar? O sistema vai ficar engessado”",
    etapa: "proposta",
    resposta:
      "Explicar que a solução é personalizável e evolui com o negócio: a manutenção mensal e o acompanhamento contínuo servem para ajustar o que foi entregue (novos campos, etapas, automações, integrações) quando a rotina mudar. Reforçar que a solução pode nascer modular, para crescer sem refazer tudo.",
  },
  {
    titulo: "“Tenho receio de ficar dependente de vocês”",
    etapa: "proposta",
    resposta:
      "Ser transparente. Explicar o modelo de entrega (todo material entregue e pronto para utilização do cliente) e deixar claro o que pertence ao cliente, como domínio, conteúdo e dados, conforme o contrato. Alinhar a política de propriedade e acessos com os sócios antes de responder.",
  },
  {
    titulo: "“Minha equipe não vai usar / resiste a mudanças”",
    etapa: "ambos",
    resposta:
      "Reforçar que a solução é construída com a participação do cliente e no jeito de trabalhar da equipe dele, o que reduz a curva de adoção. Propor envolver quem opera o dia a dia no diagnóstico e nas validações, mostrar que a automação tira tarefa manual em vez de criar trabalho e lembrar do apoio na implementação.",
  },
  {
    titulo: "“Preciso que funcione com o que já uso”",
    etapa: "proposta",
    resposta:
      "Destacar a integração: a DPlay conecta diferentes sistemas e soluções. Levantar no diagnóstico quais ferramentas existem (WhatsApp, planilhas, ERP, plataformas de pagamento e frete) e o que precisa conversar entre elas, e incluir essas integrações no escopo para nada ficar solto.",
  },
  {
    titulo: "“Como vou saber se vai ficar do jeito que imaginei?”",
    etapa: "proposta",
    resposta:
      "Explicar o fluxo: a demanda inicial é construída e entregue para validação, os ajustes são feitos junto com o cliente e só então vem a entrega final. O cliente acompanha por WhatsApp e reuniões nos marcos do projeto. Combinar desde o início o que é correção, o que é pequeno ajuste e o que é nova demanda.",
  },
  {
    titulo: "“Já controlo meus leads na planilha / CRM é complicado”",
    etapa: "ambos",
    resposta:
      "Partir da planilha dele: mostrar que o CRM personalizável reproduz o funil que ele já usa, com histórico, lembretes e próxima ação, sem a curva de aprendizado de uma ferramenta pronta. Perguntar quantos contatos ou oportunidades já se perderam por falta de registro ou de acompanhamento.",
  },
  {
    titulo: "“Tenho receio de a IA errar com meus clientes”",
    etapa: "ambos",
    resposta:
      "Explicar que agentes e fluxos automatizados são configurados com as regras e o tom do negócio e testados na validação antes de entrar no ar. Definir no diagnóstico quais atendimentos a automação resolve sozinha e quais passam para uma pessoa.",
  },
  {
    titulo: "Valor elevado",
    etapa: "proposta",
    resposta:
      "Procurar entender por que não faz sentido e buscar meios de contornar. Dependendo da resposta, facilitar com mais parcelas ou diluir a implantação nas mensalidades. Antes de abaixar o valor, perguntar qual seria o ideal para ele e buscar um intermédio, ou priorizar uma solução inicial menor em vez de dar desconto. Se a objeção for valor percebido, perguntar o que não fez sentido e agregar valor naquele ponto, com base na realidade dele. Usar gatilhos e ser flexível.",
  },
  {
    titulo: "“Achei mais barato com freelancer, Wix ou outra empresa”",
    etapa: "proposta",
    resposta:
      "Não disputar por preço. Perguntar o que a outra proposta inclui e comparar com o escopo da DPlay: diagnóstico, personalização, integração, segurança (SSL, SEO otimizado, cibersegurança), suporte e acompanhamento mensal. Mostrar o risco do mais barato: um site que não vende, um sistema que não conversa com o resto ou ficar sem ninguém para dar suporte. Reforçar com cases.",
  },
  {
    titulo: "“Não entendo a mensalidade / por que pagar manutenção”",
    etapa: "proposta",
    resposta:
      "Explicar que a manutenção mensal cobre o acompanhamento contínuo de tudo que foi entregue: suporte, pequenos ajustes e evolução da solução conforme o negócio muda. Mostrar que sem esse acompanhamento a solução envelhece e corrigir depois sai mais caro.",
  },
  {
    titulo: "“Só pago depois de ver funcionando”",
    etapa: "proposta",
    resposta:
      "Explicar que a demanda inicial é construída e entregue para validação antes da entrega final, então ele acompanha o resultado ao longo do projeto. Se a política permitir, propor condições de pagamento alinhadas aos marcos de entrega.",
  },
  {
    titulo: "Tem receio de não gerar resultado",
    etapa: "proposta",
    resposta:
      "Mostrar resultados em empresas nas quais já trabalhamos (FYND: aumento de 40% no faturamento com e-commerce; Decore: 100% de controle automático de estoque). Traduzir a solução para a métrica dele, como horas poupadas, leads respondidos ou vendas recuperadas, e combinar no diagnóstico qual indicador será acompanhado. Se ainda houver receio, sugerir começar por uma entrega menor para comprovar valor antes de expandir.",
  },
  {
    titulo: "“E se aparecerem custos extras?”",
    etapa: "proposta",
    resposta:
      "Deixar escopo, entregas e o que está fora dele registrados na proposta e no contrato. Explicar a diferença entre correção, pequeno ajuste e nova demanda: ideias novas viram um módulo à parte, com valor combinado antes de começar.",
  },
  {
    titulo: "“E a segurança dos meus dados?”",
    etapa: "ambos",
    resposta:
      "Citar a frente de cibersegurança da DPlay (mais de 25 sistemas e sites sob cuidado), o SSL certificado nos sites e a segurança empresarial nos ERPs. Levantar no diagnóstico quais dados sensíveis o sistema vai tratar (clientes, saúde, financeiro) e como serão protegidos. Não prometer conformidade jurídica sem validar antes.",
  },
  {
    titulo: "Receio de atraso no prazo",
    etapa: "proposta",
    resposta:
      "Apresentar o cronograma por etapas (diagnóstico, demanda inicial, validação e entrega) com marcos claros e citar prazos de projetos semelhantes. Combinar a coleta de materiais (logotipo, fotos, produtos e informações da empresa) logo após a assinatura, porque material atrasado é um dos maiores riscos de prazo.",
  },
  {
    titulo: "“A quem recorro se algo der errado?”",
    etapa: "proposta",
    resposta:
      "Explicar que o cliente tem contato direto com os sócios e com quem desenvolve, com validações pelo WhatsApp e reuniões nos marcos do projeto. Depois da entrega, o suporte e o acompanhamento mensal continuam. Deixar claro qual é o canal de suporte.",
  },
  {
    titulo: "Receio de a DPlay sumir ou trocar a equipe",
    etapa: "proposta",
    resposta:
      "Mostrar a estrutura: os dois sócios acompanham de perto, o contrato é assinado digitalmente com escopo e responsabilidades definidos e a manutenção mensal formaliza a continuidade do relacionamento depois da entrega.",
  },
  {
    titulo: "“Preciso pensar” / “vou falar com meu sócio e retorno”",
    etapa: "proposta",
    resposta:
      "Descobrir o que falta para decidir (preço, escopo, prazo ou confiança) e quem mais participa da decisão. Marcar na hora data e horário de retorno e oferecer uma reunião curta com o sócio, para a DPlay mesma responder as dúvidas. Registrar a próxima ação no CRM.",
  },
  {
    titulo: "Pede a proposta por mensagem e só olha o preço",
    etapa: "proposta",
    resposta:
      "Sempre que possível, apresentar a proposta em reunião: primeiro o diagnóstico, depois a solução e os diferenciais, e só então o valor. Se precisar enviar antes, mandar junto um resumo do que ele disse no diagnóstico e deixar o retorno já agendado.",
  },
  {
    titulo: "Sumiu depois de receber a proposta",
    etapa: "proposta",
    resposta:
      "Retomar com valor e não só perguntando se ele viu a proposta: um case parecido, uma ideia nova para o caso dele ou uma condição facilitada. Definir número de tentativas, intervalos entre elas e um critério de encerramento, e registrar cada contato no CRM.",
  },
  {
    titulo: "“Agora não é o momento”",
    etapa: "ambos",
    resposta:
      "Entender o que mudaria depois e se existe uma data real. Propor começar por uma etapa menor agora (diagnóstico, site ou automação) para não perder o ritmo, ou deixar a data de retomada marcada e registrada no CRM.",
  },
];
