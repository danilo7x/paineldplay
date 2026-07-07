# Fase 2 — Gestão de Equipe, RLS staff/admin e Perfil

## Objetivo
Permitir que o admin gerencie colaboradores (convidar, listar, promover, desativar) e que cada usuário edite o próprio perfil. Consolidar o modelo de papéis (`admin` / `staff`) e as políticas RLS que serão usadas pelas próximas fases.

## Escopo

### 1. Banco (migração única)
- Adicionar valor `staff` ao enum `app_role` (já existe `admin`).
- Adicionar em `profiles`: `ativo boolean not null default true`.
- Trigger `handle_new_user` já cria profile; adicionar trigger que insere role `staff` por padrão em `user_roles` no signup (exceto quando já for admin criado pela edge function de setup).
- Função `is_staff_or_admin(uuid)` (security definer) para uso em RLS de outras tabelas nas próximas fases.
- Política extra em `user_roles`: admin pode INSERT/UPDATE/DELETE (via `has_role(auth.uid(),'admin')`).
- Política extra em `profiles`: admin pode UPDATE `ativo` de qualquer perfil (já coberto pela policy atual, mas confirmar).

### 2. Edge Function `invite-user` (admin-only)
- POST `{ email, nome, cargo, role: 'staff'|'admin' }`.
- Valida caller via JWT + `has_role(admin)`.
- Usa `supabaseAdmin.auth.admin.inviteUserByEmail` (envia email de convite) ou cria com senha temporária (opção: gerar link mágico).
- Após criar, faz upsert em `profiles` (nome, cargo) e insert em `user_roles` (role escolhido).

### 3. Edge Function `set-user-status` (admin-only)
- POST `{ user_id, ativo }` — atualiza `profiles.ativo`.
- POST `{ user_id, role }` alternativo para trocar papel.

### 4. Frontend — Rotas novas
- `/_authenticated/equipe` (só admin): lista de colaboradores em tabela — avatar, nome, email, cargo, papel (badge), status ativo/inativo, ações (editar papel, ativar/desativar, reenviar convite). Botão "Convidar colaborador" abre dialog com nome/email/cargo/papel.
- `/_authenticated/perfil`: formulário do próprio usuário — avatar (upload para bucket `avatars`), nome, cargo, telefone, bio, email (readonly). Botão salvar chama update em `profiles`.
- Guarda de admin: hook `useIsAdmin()` já disponível no shell; criar componente `<AdminOnly>` que redireciona para `/dashboard` se não for admin.
- Sidebar: mostrar item "Equipe" só para admin; "Meu perfil" para todos.

### 5. Storage
- Criar bucket público `avatars` com policies: usuário autenticado faz upload/update do próprio arquivo (`{user_id}/avatar.*`), leitura pública.

### 6. Server functions (TanStack)
- `listTeam` (`requireSupabaseAuth` + admin check) — retorna profiles + roles + status.
- `updateOwnProfile` — atualiza campos do próprio profile.
- `uploadAvatar` — fluxo client-side direto ao Storage (não precisa server fn).

## Detalhes técnicos
- `user_roles`: usar `unique(user_id, role)` (já existe). Trocar role = delete + insert em transação (RPC `set_user_role(_uid, _role)`).
- Convite via `inviteUserByEmail` requer SMTP configurado no projeto. Se não estiver, cai no fluxo de senha temporária mostrada uma vez ao admin.
- Não desabilitar o próprio admin (validação no server).
- Reutilizar componentes shadcn: `Table`, `Dialog`, `Badge`, `Switch`, `DropdownMenu`, `Avatar`, `Input`, `Textarea`.

## Fora de escopo (fases futuras)
- Projetos, clientes, faturamento, financeiro, notas, arquivos, Yada. Só criamos a função `is_staff_or_admin` para preparar RLS dessas tabelas depois.

## Entrega
Ao final: admin consegue convidar um novo colaborador, vê a lista da equipe, altera papel/ativação; qualquer usuário edita o próprio perfil com avatar.
