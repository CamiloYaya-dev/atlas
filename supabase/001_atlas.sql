-- ATLAS V3 · Ejecutar una vez en Supabase SQL Editor.
-- PROTECCIÓN: tablas aisladas por workspace, funciones autorizadas y guardado con control de versión.
create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','editor','viewer')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 160),
  description text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_projects_workspace on public.projects(workspace_id);
create table if not exists public.project_documents (
  project_id uuid primary key references public.projects(id) on delete cascade,
  document jsonb not null check (jsonb_typeof(document)='object'),
  version bigint not null default 1 check (version >= 1),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists public.workspace_invites (
  token uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role text not null check (role in ('admin','editor','viewer')),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_members_user on public.workspace_members(user_id);

-- Funciones de verificación ejecutadas como propietario para evitar recursión RLS.
create or replace function public.atlas_is_member(p_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.workspace_members m where m.workspace_id=p_workspace and m.user_id=(select auth.uid()));
$$;
create or replace function public.atlas_can_edit(p_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.workspace_members m where m.workspace_id=p_workspace and m.user_id=(select auth.uid()) and m.role in ('owner','admin','editor'));
$$;
create or replace function public.atlas_is_admin(p_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.workspace_members m where m.workspace_id=p_workspace and m.user_id=(select auth.uid()) and m.role in ('owner','admin'));
$$;
create or replace function public.atlas_project_workspace(p_project uuid)
returns uuid language sql stable security definer set search_path = '' as $$
 select workspace_id from public.projects where id=p_project;
$$;

create or replace function public.atlas_seed_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.workspace_members(workspace_id,user_id,role) values(new.id,new.created_by,'owner');
 return new;
end;$$;
drop trigger if exists trg_atlas_seed_owner on public.workspaces;
create trigger trg_atlas_seed_owner after insert on public.workspaces for each row execute function public.atlas_seed_owner();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_documents enable row level security;
alter table public.workspace_invites enable row level security;

create policy atlas_workspaces_read on public.workspaces for select to authenticated using (public.atlas_is_member(id));
-- Creación solo a través de RPC, no se permite insertar directamente en tablas de espacios.
create policy atlas_members_read on public.workspace_members for select to authenticated using (public.atlas_is_member(workspace_id));
create policy atlas_projects_read on public.projects for select to authenticated using (public.atlas_is_member(workspace_id));
create policy atlas_projects_create on public.projects for insert to authenticated with check (public.atlas_can_edit(workspace_id));
create policy atlas_projects_update on public.projects for update to authenticated using (public.atlas_is_admin(workspace_id)) with check (public.atlas_is_admin(workspace_id));
create policy atlas_docs_read on public.project_documents for select to authenticated using (public.atlas_is_member(public.atlas_project_workspace(project_id)));
create policy atlas_docs_create on public.project_documents for insert to authenticated with check (public.atlas_can_edit(public.atlas_project_workspace(project_id)));
-- Las actualizaciones de documentos solo se realizan por atlas_save_document (versión atómica).
create policy atlas_invites_read on public.workspace_invites for select to authenticated using (public.atlas_is_admin(workspace_id));

create or replace function public.atlas_create_workspace(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 if (select auth.uid()) is null then raise exception 'Debes iniciar sesión'; end if;
 if length(trim(p_name)) not between 2 and 120 then raise exception 'Nombre inválido'; end if;
 insert into public.workspaces(name,created_by) values(trim(p_name),(select auth.uid())) returning id into v_id;
 return v_id;
end;$$;

create or replace function public.atlas_save_document(p_project uuid, p_document jsonb, p_expected_version bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_new bigint;
begin
 if not public.atlas_can_edit(public.atlas_project_workspace(p_project)) then raise exception 'No tienes permisos para editar'; end if;
 if jsonb_typeof(p_document) <> 'object' or p_document->>'schema' <> '1' then raise exception 'Documento inválido'; end if;
 -- Bloqueo optimista contra sobrescritura de modificaciones concurrentes.
 update public.project_documents set document=p_document, version=version+1,updated_by=(select auth.uid()),updated_at=now()
 where project_id=p_project and version=p_expected_version returning version into v_new;
 if v_new is null then raise exception 'ATLAS_VERSION_CONFLICT'; end if;
 return v_new;
end;$$;

create or replace function public.atlas_create_invite(p_workspace uuid,p_role text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_token uuid;
begin
 if not public.atlas_is_admin(p_workspace) then raise exception 'Solo administradores pueden invitar'; end if;
 if p_role not in ('admin','editor','viewer') then raise exception 'Rol inválido'; end if;
 insert into public.workspace_invites(workspace_id,role,created_by) values(p_workspace,p_role,(select auth.uid())) returning token into v_token;
 return v_token;
end;$$;

create or replace function public.atlas_redeem_invite(p_token uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_inv public.workspace_invites%rowtype;
begin
 if (select auth.uid()) is null then raise exception 'Inicia sesión para aceptar la invitación'; end if;
 select * into v_inv from public.workspace_invites where token=p_token for update;
 if not found or v_inv.expires_at < now() or v_inv.accepted_by is not null then raise exception 'Invitación inválida o utilizada'; end if;
 insert into public.workspace_members(workspace_id,user_id,role) values(v_inv.workspace_id,(select auth.uid()),v_inv.role)
 on conflict(workspace_id,user_id) do nothing;
 update public.workspace_invites set accepted_by=(select auth.uid()) where token=p_token;
end;$$;

revoke all on function public.atlas_is_member(uuid) from public;
revoke all on function public.atlas_can_edit(uuid) from public;
revoke all on function public.atlas_is_admin(uuid) from public;
revoke all on function public.atlas_project_workspace(uuid) from public;
revoke all on function public.atlas_create_workspace(text) from public;
revoke all on function public.atlas_save_document(uuid,jsonb,bigint) from public;
revoke all on function public.atlas_create_invite(uuid,text) from public;
revoke all on function public.atlas_redeem_invite(uuid) from public;
grant execute on function public.atlas_is_member(uuid) to authenticated;
grant execute on function public.atlas_can_edit(uuid) to authenticated;
grant execute on function public.atlas_is_admin(uuid) to authenticated;
grant execute on function public.atlas_project_workspace(uuid) to authenticated;
grant execute on function public.atlas_create_workspace(text) to authenticated;
grant execute on function public.atlas_save_document(uuid,jsonb,bigint) to authenticated;
grant execute on function public.atlas_create_invite(uuid,text) to authenticated;
grant execute on function public.atlas_redeem_invite(uuid) to authenticated;

-- Nota: completar hardening de producción antes de registro público:
-- rate limiting, monitoreo, cuotas server-side, auditoría y revisión del modelo JSON.
