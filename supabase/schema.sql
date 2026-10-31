-- NIE WIEM MVP — uruchom cały plik w Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_token uuid not null,
  category text not null default 'Mieszane',
  custom_words text[] not null default '{}',
  status text not null default 'waiting' check (status in ('waiting','playing')),
  current_turn integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  token uuid not null unique,
  word text,
  score integer not null default 0,
  seat integer not null,
  joined_at timestamptz not null default now(),
  unique(room_id, seat)
);

create table if not exists public.words (
  id bigint generated always as identity primary key,
  category text not null,
  word text not null
);
create unique index if not exists words_category_word_idx on public.words(category, word);

insert into public.words(category,word) values
('Mieszane','Shrek'),('Mieszane','Żaba'),('Mieszane','Mikrofalówka'),('Mieszane','Minecraft'),('Mieszane','Lew'),('Mieszane','Pizza'),('Mieszane','Harry Potter'),('Mieszane','Rower'),('Mieszane','Dinozaur'),('Mieszane','Kaktus'),('Mieszane','Batman'),('Mieszane','Lody'),('Mieszane','Skarpetka'),('Mieszane','Kaczka'),('Mieszane','Głośnik'),
('Filmy i seriale','Shrek'),('Filmy i seriale','Wednesday'),('Filmy i seriale','Titanic'),('Filmy i seriale','Kevin sam w domu'),('Filmy i seriale','Stranger Things'),('Filmy i seriale','Spider-Man'),('Filmy i seriale','Barbie'),('Filmy i seriale','Król Lew'),
('Gry','Minecraft'),('Gry','The Sims'),('Gry','GTA'),('Gry','Fortnite'),('Gry','League of Legends'),('Gry','The Witcher'),('Gry','Among Us'),('Gry','Mario'),
('Jedzenie','Pizza'),('Jedzenie','Pierogi'),('Jedzenie','Sushi'),('Jedzenie','Kebab'),('Jedzenie','Naleśniki'),('Jedzenie','Arbuz'),('Jedzenie','Żurek'),('Jedzenie','Tost'),
('Zwierzęta','Kapibara'),('Zwierzęta','Pingwin'),('Zwierzęta','Żyrafa'),('Zwierzęta','Ośmiornica'),('Zwierzęta','Jeż'),('Zwierzęta','Flaming'),('Zwierzęta','Wombat'),
('Przedmioty','Parasol'),('Przedmioty','Pilot do telewizora'),('Przedmioty','Lustro'),('Przedmioty','Zszywacz'),('Przedmioty','Poduszka'),('Przedmioty','Latarka'),('Przedmioty','Wieszak'),
('Postacie','Batman'),('Postacie','Hermiona Granger'),('Postacie','Mario'),('Postacie','Darth Vader'),('Postacie','Kubuś Puchatek'),('Postacie','Wednesday Addams'),
('Internet / memy','Skibidi Toilet'),('Internet / memy','Gigachad'),('Internet / memy','Grumpy Cat'),('Internet / memy','Distracted Boyfriend'),('Internet / memy','Among Us')
on conflict(category,word) do nothing;

-- Dane gry są dostępne wyłącznie przez funkcje RPC poniżej.
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.words enable row level security;
revoke all on public.rooms, public.players, public.words from anon, authenticated;

create or replace function public.create_room(p_name text, p_category text, p_custom_words text[] default '{}')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_code text; v_token uuid := gen_random_uuid(); v_room uuid;
begin
  if length(trim(coalesce(p_name,''))) < 1 or length(p_name)>18 then raise exception 'Podaj nick (1–18 znaków).'; end if;
  loop
    v_code := upper(substr(encode(gen_random_bytes(5),'hex'),1,5));
    exit when not exists(select 1 from rooms where code=v_code);
  end loop;
  insert into rooms(code,host_token,category,custom_words) values(v_code,v_token,coalesce(p_category,'Mieszane'),coalesce(p_custom_words,'{}')) returning id into v_room;
  insert into players(room_id,name,token,seat) values(v_room,trim(p_name),v_token,1);
  return jsonb_build_object('code',v_code,'token',v_token);
end $$;

create or replace function public.join_room(p_name text, p_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_room uuid; v_token uuid := gen_random_uuid(); v_seat integer;
begin
  if length(trim(coalesce(p_name,''))) < 1 or length(p_name)>18 then raise exception 'Podaj nick (1–18 znaków).'; end if;
  select id into v_room from rooms where code=upper(trim(p_code)) and status='waiting';
  if v_room is null then raise exception 'Nie znaleziono pokoju albo gra już trwa.'; end if;
  select coalesce(max(seat),0)+1 into v_seat from players where room_id=v_room;
  if v_seat > 12 then raise exception 'Pokój jest pełny (maksymalnie 12 osób).'; end if;
  insert into players(room_id,name,token,seat) values(v_room,trim(p_name),v_token,v_seat);
  return jsonb_build_object('code',upper(trim(p_code)),'token',v_token);
end $$;

create or replace function public.start_game(p_code text,p_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_room rooms%rowtype; v_count integer; v_words text[];
begin
  select * into v_room from rooms where code=upper(trim(p_code)) for update;
  if not found then raise exception 'Nie znaleziono pokoju.'; end if;
  if v_room.host_token <> p_token then raise exception 'Tylko gospodarz może rozpocząć grę.'; end if;
  if v_room.status <> 'waiting' then raise exception 'Gra już trwa.'; end if;
  select count(*) into v_count from players where room_id=v_room.id;
  if v_count < 2 then raise exception 'Potrzeba co najmniej 2 graczy.'; end if;
  select array_agg(word order by random()) into v_words from (
    select distinct word from (
      select word from words where category=v_room.category or v_room.category='Mieszane'
      union all select unnest(v_room.custom_words)
    ) s
  ) q;
  if coalesce(array_length(v_words,1),0) < v_count then raise exception 'Za mało różnych haseł. Dodaj własne słowa lub wybierz inną kategorię.'; end if;
  with ordered as (select id,row_number() over(order by seat) rn from players where room_id=v_room.id)
  update players p set word=v_words[o.rn],score=0 from ordered o where p.id=o.id;
  update rooms set status='playing',current_turn=1 where id=v_room.id;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.get_game_state(p_code text,p_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_room rooms%rowtype; v_me players%rowtype; v_current players%rowtype; v_players jsonb;
begin
  select * into v_room from rooms where code=upper(trim(p_code));
  if not found then raise exception 'Nie znaleziono pokoju.'; end if;
  select * into v_me from players where room_id=v_room.id and token=p_token;
  if not found then raise exception 'Nie należysz do tego pokoju.'; end if;
  select * into v_current from players where room_id=v_room.id and seat=v_room.current_turn;
  select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'score',p.score,'seat',p.seat,'is_me',p.token=p_token,'word',case when p.token=p_token then null else p.word end) order by p.seat)
    into v_players from players p where p.room_id=v_room.id;
  return jsonb_build_object('code',v_room.code,'status',v_room.status,'category',v_room.category,
    'is_host',v_room.host_token=p_token,'players',coalesce(v_players,'[]'::jsonb),
    'current_player_name',v_current.name,'current_player_is_me',v_current.token=p_token);
end $$;

create or replace function public.finish_turn(p_code text,p_token uuid,p_correct boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_room rooms%rowtype; v_current players%rowtype; v_next integer; v_total integer;
begin
  select * into v_room from rooms where code=upper(trim(p_code)) for update;
  if not found or v_room.status<>'playing' then raise exception 'Gra nie jest aktywna.'; end if;
  select * into v_current from players where room_id=v_room.id and seat=v_room.current_turn;
  if v_current.token <> p_token then raise exception 'To nie Twoja tura.'; end if;
  if p_correct then update players set score=score+1 where id=v_current.id; end if;
  select count(*) into v_total from players where room_id=v_room.id;
  v_next := case when v_room.current_turn >= v_total then 1 else v_room.current_turn+1 end;
  update rooms set current_turn=v_next where id=v_room.id;
  return jsonb_build_object('ok',true);
end $$;

grant execute on function public.create_room(text,text,text[]) to anon, authenticated;
grant execute on function public.join_room(text,text) to anon, authenticated;
grant execute on function public.start_game(text,uuid) to anon, authenticated;
grant execute on function public.get_game_state(text,uuid) to anon, authenticated;
grant execute on function public.finish_turn(text,uuid,boolean) to anon, authenticated;
