-- Сколько топпингов можно выбрать из группы; NULL = без ограничения.
alter table public.topping_groups
  add column if not exists max_selections integer;

alter table public.topping_groups
  drop constraint if exists topping_groups_max_selections_check;

alter table public.topping_groups
  add constraint topping_groups_max_selections_check
  check (max_selections is null or max_selections >= 1);

comment on column public.topping_groups.max_selections is
  'Максимум позиций, которые клиент может выбрать из группы; NULL — без лимита.';
