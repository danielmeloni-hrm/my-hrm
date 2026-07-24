-- Layout personalizzabile della home (widget dashboard).
-- La colonna contiene un array ordinato di widget:
-- [{ "id": "attivita_assegnate", "size": "md" }, ...]

alter table public.user_preferences
  add column if not exists home_widgets jsonb;

comment on column public.user_preferences.home_widgets is
  'Layout della home per utente: array ordinato di { id, size, color }.';

-- Tema dell'interfaccia scelto dall'utente: light | dark | system.
alter table public.user_preferences
  add column if not exists theme text;

comment on column public.user_preferences.theme is
  'Tema interfaccia: light, dark oppure system.';

-- Colore di sfondo della sidebar scelto dall'utente (esadecimale, es. #0150a0).
alter table public.user_preferences
  add column if not exists sidebar_color text;

comment on column public.user_preferences.sidebar_color is
  'Colore di sfondo della sidebar in formato #rrggbb. NULL = colore predefinito.';

-- Ordine personalizzato delle voci della sidebar: array ordinato di path.
alter table public.user_preferences
  add column if not exists sidebar_order jsonb;

comment on column public.user_preferences.sidebar_order is
  'Ordine delle voci della sidebar scelto dall''utente: array di path.';
