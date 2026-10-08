# CRM DPlay

PROMPT PARA A LOVABLE — CRM DPlay Solutions

Cole este prompt inteiro no chat da Lovable. Se ficar muito grande de uma vez, use as FASES no final para enviar em partes (recomendado). Onde estiver escrito [ANEXAR], anexe o arquivo/imagem correspondente na mesma mensagem da Lovable.

1. OBJETIVO E IDENTIDADE

Quero construir do zero um CRM / painel interno para a minha empresa, a DPlay Solutions. Já tive uma versão anterior, mas ficou visualmente pesada e com funcionalidades quebradas. Quero refazer com um visual limpo, leve, moderno e escuro, no estilo das imagens de referência que estou anexando [ANEXAR as 2 imagens de dashboard].

Este é um sistema interno e privado, só para funcionários e administradores — não é site público e não tem página inicial nenhuma. A rota raiz (/) é a própria tela de login. Ao abrir a URL, o usuário já cai direto no login (sem home, sem landing, sem botão "entrar" que leva a outra tela, sem página de marketing). Depois de logar, vai direto para o painel. Se tentar acessar qualquer rota sem estar logado, é redirecionado para o login. Nada de globo 3D nem animações pesadas.

Stack: React + Vite + TypeScript + Tailwind + shadcn/ui + Supabase (auth, banco Postgres com RLS, storage e edge functions). Sem Firebase, sem three.js, sem framer-motion pesado.

2. IDENTIDADE VISUAL

Logo: vou anexar [ANEXAR a logo — globo azul]. Use como favicon, no login e no topo do menu lateral.

Paleta — tom azul escuro misturado com preto (como na imagem que enviei): o fundo é praticamente preto com fundo azulado, bem escuro, e o azul aparece só nos destaques, gráficos e detalhes.

Fundo geral: quase preto com leve tom de azul (algo como #05070E a #070A12)

Cards / painéis: azul-petróleo bem escuro, levemente acima do fundo (#0B0F1A), com bordas sutis e cantos arredondados

Azul principal / destaque (botões, links, seleção): #057EF3

Azul profundo (gradientes, hover): #0157C6

Azul-céu (acento claro / linhas de gráfico): #31B7FF

Texto: branco/cinza-claro no primário, cinza médio no secundário

Verde para valores positivos/receita, vermelho para negativos/despesa

Estilo: minimalista e escuro, muito respiro (espaçamento generoso), tipografia limpa (Inter ou similar), sombras suaves, gráficos com linhas finas e gradientes sutis de azul sobre o fundo preto-azulado. Evite excesso de brilho/glow, gradientes carregados e animações. O alvo é o visual da imagem de referência: base preta puxada pro azul escuro, arejado, com cards bem organizados e gráficos em azul elegantes.

Tudo em português (pt-BR).

3. LOGIN E CONTAS

A tela de login é a página raiz do site (/). Não existe página inicial antes dela. Login somente entrada (e-mail + senha), sem cadastro/registro e sem "criar conta". Fundo preto-azulado escuro com a logo centralizada, seguindo a paleta acima. Vou anexar depois a referência exata que quero pra tela de login [ANEXAR referência de login quando disponível].

Dois logins de administrador (os dois sócios). Admin tem acesso total.

Os funcionários não se cadastram — eu (admin) crio as credenciais dele por dentro do painel, na área de Equipe. Ao criar, defino nome, e-mail, cargo/função e senha inicial.

Papéis: admin e staff. Guardar papéis numa tabela separada user_roles (nunca no perfil do usuário, por segurança do RLS).

Precisa de uma forma de criar o primeiro admin (edge function de setup inicial protegida).

4. CONTROLE DE ACESSO (REGRAS DE PERMISSÃO) — MUITO IMPORTANTE

Estas regras devem ser aplicadas via RLS no Supabase, não só escondendo no front:

Admins (os 2 sócios): enxergam tudo — todo o faturamento, todas as despesas, todos os projetos, todos os funcionários, arquivos pessoais dos sócios e os projetos pessoais dos funcionários.

Funcionário (staff):

Só vê os projetos em que foi adicionado como membro.

No projeto, vê descrição, etapas/progresso, notas e credenciais somente daquele projeto.

Faturamento: só vê o faturamento dos projetos em que participou (por projeto e/ou o total somado dos projetos dele). Nunca vê o faturamento geral da empresa, nem despesas gerais, nem projetos de que não participa.

Não acessa a área de Equipe nem o Financeiro geral (Administração).

Credenciais de cliente/projeto (logins, senhas, acessos) só aparecem para admins e para os funcionários membros daquele projeto.

5. MÓDULOS / SEÇÕES DO PAINEL

Menu lateral (sidebar) escuro e enxuto, com a logo no topo, nome do usuário e botão de sair embaixo. As seções são:

5.1. Dashboard (visão geral)

Cards de indicadores no topo (KPIs), no estilo das referências: receita do mês, nº de projetos ativos, nº de vendas, ticket médio, etc.

Gráfico de evolução de receita ao longo do tempo (linha/área azul).

Para admin: números globais da empresa.

Para staff: só os números dos projetos dele.

5.2. Faturamento / Vendas

Cadastro de venda, contendo: cliente (nome, e-mail, telefone/contato), projeto vinculado, valor, data, status (pendente/pago/cancelado) e observações.

Cada venda é amarrada a um projeto, e é isso que define quem vê o quê.

Lista/tabela de vendas com filtros por período, cliente e projeto.

Admin vê todas. Staff vê só as dos projetos dele.

5.3. Projetos (núcleo do CRM)

Cada projeto tem sua própria página com abas/seções:

Dados do projeto: nome, cliente, descrição, status (ex.: em desenvolvimento, em manutenção, concluído), responsáveis (membros).

Membros: admin adiciona/remove funcionários. Só membros e admins acessam o projeto.

Progresso passo a passo (linha do tempo): o funcionário registra atualizações em ordem ("terminei a tela X", "integrei a API Y"), com data, autor e status de cada etapa. Isso alimenta um indicador visual de evolução (% concluído / timeline / checklist) que eu e os outros membros acompanhamos.

Notas do projeto: espaço de anotações vinculado ao projeto (livre, tipo bloco de notas, com autor e data).

Credenciais do projeto: logins/senhas/acessos daquele cliente/projeto, visíveis só a admins e membros.

Faturamento do projeto: total faturado e vendas ligadas a ele.

5.4. Analytics

Gráficos e indicadores de acompanhamento:

Evolução do faturamento (por mês).

Desempenho por funcionário (o que cada um progrediu — nº de etapas concluídas, projetos ativos, contribuição).

Distribuição de receita por projeto/cliente (donut/pizza como nas referências).

Status dos projetos.

Admin vê tudo; staff vê só o recorte dos projetos dele.

5.5. Financeiro (Administração) — SÓ ADMINS

Visão completa de receitas (puxadas das vendas) e despesas.

Cadastro de despesas/gastos: descrição, categoria, valor, data, projeto (opcional). É daqui que a Yada vai puxar "quais os gastos desse mês".

Resumo: receita total, despesa total, lucro/saldo, por período.

Invisível para staff.

5.6. Equipe — SÓ ADMINS

Listar, criar, editar e desativar funcionários.

Ao criar funcionário: nome, e-mail, cargo/função, senha inicial (gera a credencial de acesso). Usar edge function com service role para criar o usuário no auth + perfil + papel staff.

Ver em quais projetos cada funcionário está.

5.7. Meus Arquivos / Projetos Pessoais

Dois espaços de armazenamento (usar Supabase Storage + tabela de metadados):

Cofre dos sócios: arquivos e projetos pessoais que só os 2 admins veem e enviam.

Projetos pessoais dos funcionários: cada funcionário envia os projetos pessoais dele; ele vê os dele e o admin também vê. Um funcionário não vê os do outro.

Suporte a upload de arquivos, título, descrição e data.

5.8. Notas (espaço geral)

Bloco de notas pessoal/integrado, separado das notas de projeto. Cada usuário tem as suas; admin pode ter notas gerais.

5.9. Avisos

Admin publica avisos/comunicados internos; funcionários visualizam e o sistema marca como lido (quem leu / quem não leu).

5.10. Yada — Assistente (PLACEHOLDER, ainda não ativa)

Criar a área/seção no painel para a assistente pessoal chamada Yada, com uma interface de chat pronta, mas ainda sem estar funcional/conectada (deixar preparada para integração futura).

Deixar claro no visual que é a Yada. A ideia futura: eu pergunto coisas como "quanto de receita eu tive esse mês?", "quais os gastos desse mês?" e ela responde consultando o financeiro. Por ora, só a interface e um aviso de "em breve".

5.11. Perfil

Cada usuário edita nome, foto/avatar, contato. Admin pode editar todos.

5.12. Controle de atividade / Logins

Log de atividades: registrar ações relevantes (novas vendas, novos projetos, mudança de status, novo membro, etc.) com autor e data.

Sessões/dispositivos: registrar logins (dispositivo, navegador, SO, IP, último acesso) e permitir ver o histórico de acessos. Alerta de novo login. (Fazer isso dentro do Supabase, sem Firebase.)

6. MODELO DE DADOS SUGERIDO (Supabase)

Crie as tabelas com RLS habilitado seguindo as regras da seção 4:

user_roles (user_id, role: 'admin' | 'staff')

profiles (id → auth.users, nome, email, cargo, telefone, avatar_url, bio)

projects (id, nome, cliente, descrição, status, created_by, timestamps)

project_members (project_id, staff_id) — define acesso

project_steps (id, project_id, autor, título, descrição, status, ordem, created_at) — progresso passo a passo

project_notes (id, project_id, autor, conteúdo, created_at) — notas do projeto

project_credentials (id, project_id, nome_do_acesso, login, senha, url, notas) — visível só a admins + membros

sales (id, project_id, cliente_nome, cliente_email, cliente_contato, valor, status, data, observações) — faturamento amarrado ao projeto

expenses (id, descrição, categoria, valor, data, project_id opcional, created_by) — despesas (só admin)

staff_members / vínculo com auth (funcionários)

personal_files (id, owner_id, tipo_dono: 'admin' | 'staff', título, descrição, file_url, created_at) — arquivos/projetos pessoais com regras da 5.7

notes (id, user_id, conteúdo, created_at) — notas gerais

notices (id, título, mensagem, autor, created_at) + notice_reads (notice_id, user_id, read_at)

activity_logs (id, ação, tipo_entidade, entidade_id, autor, created_at)

user_sessions (id, user_id, device_name, device_type, browser, os, ip, last_active_at, is_current)

Storage buckets: avatars, personal-files (privados, com policies de acesso conforme os papéis).

Edge functions: setup-first-admin, create-staff-user (service role), delete-auth-user. Notificações e alerta de login dentro do Supabase (realtime/tabela), sem FCM.

7. O QUE NÃO QUERO (remover em relação à versão antiga)

Sem página inicial / landing / hero / seção de marketing. A rota / é o login, ponto final.

Sem botão "entrar" que leva a outra tela — o login já é a primeira coisa que aparece.

Sem globo 3D (three.js) e sem fundo de montanhas.

Sem Firebase / FCM (push). Notificações só internas via Supabase.

Sem animações pesadas. Priorizar leveza e performance.

8. FASES (envie nesta ordem se preferir construir aos poucos)

Base: projeto limpo, sem página inicial (rota / = login), paleta preto-azulada, tela de login (só entrada), Supabase auth, papéis admin/staff, criação do 1º admin, redirecionamento de rotas protegidas para o login, layout do painel com sidebar e Dashboard vazio.

Equipe + acesso: criação de funcionários pelo admin, RLS de admin/staff, perfil.

Projetos: projetos, membros, progresso passo a passo, notas de projeto, credenciais de projeto.

Faturamento: vendas amarradas a projeto + visibilidade por projeto (RLS de staff).

Financeiro (admin): despesas, resumo receita/despesa/lucro, KPIs do Dashboard e Analytics.

Arquivos pessoais + notas gerais + avisos.

Controle de atividade/logins + sessões.

Yada: área da assistente (interface pronta, sem estar ativa).

Comece pela Fase 1 e me mostre o resultado antes de seguir.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://paineldplay.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e6903907-71c9-478f-9809-cc391fb3ed92).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Fluxo de contribuição

Alterações feitas fora da Lovable (por exemplo, via Claude Code) são enviadas em uma branch separada e entram no projeto por Pull Request. Depois do merge na branch conectada, a Lovable sincroniza as mudanças automaticamente. Evite reescrever o histórico (force push, rebase ou amend em commits já publicados).
