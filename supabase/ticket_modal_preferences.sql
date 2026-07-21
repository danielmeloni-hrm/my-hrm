-- ------------------------------------------------------------------
-- Personalizzazione del popup di dettaglio ticket, per utente
-- ------------------------------------------------------------------

create table if not exists public.ticket_modal_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- Sezioni visibili: ["badge_cliente", "storia", "avanzamento", ...]
  sezioni jsonb not null default '[]'::jsonb,

  -- Campi della scheda dettagli: ["stato", "priorita", ...]
  campi jsonb not null default '[]'::jsonb,

  updated_at timestamptz not null default now()
);

comment on table public.ticket_modal_preferences is
  'Quali sezioni e campi mostrare nel popup di dettaglio ticket, per utente.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ticket_modal_preferences_set_updated_at
  on public.ticket_modal_preferences;

create trigger ticket_modal_preferences_set_updated_at
  before update on public.ticket_modal_preferences
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------------
-- Row Level Security: ognuno vede e scrive solo le proprie preferenze
-- ------------------------------------------------------------------

alter table public.ticket_modal_preferences enable row level security;

drop policy if exists "ticket_modal_preferences_select"
  on public.ticket_modal_preferences;
create policy "ticket_modal_preferences_select"
  on public.ticket_modal_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "ticket_modal_preferences_insert"
  on public.ticket_modal_preferences;
create policy "ticket_modal_preferences_insert"
  on public.ticket_modal_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "ticket_modal_preferences_update"
  on public.ticket_modal_preferences;
create policy "ticket_modal_preferences_update"
  on public.ticket_modal_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
