create table if not exists meals (
  id bigint primary key,
  date text not null,
  meal_type text not null,
  description text not null,
  meal_time text,
  nutrients jsonb,
  created_at timestamptz default now()
);

alter table meals enable row level security;

create policy "Public access"
  on meals for all
  using (true)
  with check (true);
