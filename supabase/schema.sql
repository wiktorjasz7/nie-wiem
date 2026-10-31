-- NIE WIEM MVP — uruchom cały plik w Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_token uuid not null,
  category text not null default 'Mieszane',
  custom_words text[] not null default '{}',
  status text not null default 'waiting' check (status in ('waiting','playing','finished')),
  current_turn integer not null default 1,
  winner_name text,
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
  is_active boolean not null default true,
  avatar text not null default '😎',
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

-- Rozszerzone, rozpoznawalne hasła do nowych i istniejących kategorii.
insert into public.words(category,word) values
('Filmy i seriale','Squid Game'),
('Filmy i seriale','The Last of Us'),
('Filmy i seriale','Dom z papieru'),
('Filmy i seriale','Breaking Bad'),
('Filmy i seriale','Gra o tron'),
('Filmy i seriale','Władca Pierścieni'),
('Filmy i seriale','Avengers'),
('Filmy i seriale','Deadpool'),
('Filmy i seriale','Minionki'),
('Filmy i seriale','Kung Fu Panda'),
('Filmy i seriale','Toy Story'),
('Filmy i seriale','Auta'),
('Filmy i seriale','SpongeBob'),
('Filmy i seriale','Euforia'),
('Filmy i seriale','Czarnobyl'),
('Filmy i seriale','Bridgertonowie'),
('Filmy i seriale','Ród smoka'),
('Filmy i seriale','Minecraft: Film'),
('Gry','Roblox'),
('Gry','Brawl Stars'),
('Gry','Valorant'),
('Gry','Counter-Strike 2'),
('Gry','Overwatch'),
('Gry','Rocket League'),
('Gry','EA Sports FC'),
('Gry','Red Dead Redemption'),
('Gry','Cyberpunk 2077'),
('Gry','Five Nights at Freddy’s'),
('Gry','Pokémon'),
('Gry','Fall Guys'),
('Gry','Clash Royale'),
('Gry','Clash of Clans'),
('Gry','God of War'),
('Gry','Genshin Impact'),
('Gry','Call of Duty'),
('Gry','Subnautica'),
('Gry','Euro Truck Simulator'),
('Jedzenie','Burger'),
('Jedzenie','Frytki'),
('Jedzenie','Hot dog'),
('Jedzenie','Ramen'),
('Jedzenie','Pierogi ruskie'),
('Jedzenie','Gołąbki'),
('Jedzenie','Pączek'),
('Jedzenie','Zapiekanka'),
('Jedzenie','Schabowy'),
('Jedzenie','Kisiel'),
('Jedzenie','Bigos'),
('Jedzenie','Ogórek kiszony'),
('Jedzenie','Czekolada'),
('Jedzenie','Popcorn'),
('Jedzenie','Gofr'),
('Jedzenie','Ketchup'),
('Jedzenie','Nutella'),
('Jedzenie','Makaron'),
('Jedzenie','Rosół'),
('Jedzenie','Sałatka'),
('Zwierzęta','Pies'),
('Zwierzęta','Kot'),
('Zwierzęta','Koń'),
('Zwierzęta','Delfin'),
('Zwierzęta','Rekin'),
('Zwierzęta','Orzeł'),
('Zwierzęta','Wilk'),
('Zwierzęta','Lis'),
('Zwierzęta','Niedźwiedź'),
('Zwierzęta','Żółw'),
('Zwierzęta','Królik'),
('Zwierzęta','Chomik'),
('Zwierzęta','Papuga'),
('Zwierzęta','Słoń'),
('Zwierzęta','Małpa'),
('Zwierzęta','Kura'),
('Zwierzęta','Krowa'),
('Zwierzęta','Alpaka'),
('Zwierzęta','Bóbr'),
('Zwierzęta','Szop pracz'),
('Przedmioty','Telefon'),
('Przedmioty','Laptop'),
('Przedmioty','Słuchawki'),
('Przedmioty','Telewizor'),
('Przedmioty','Ładowarka'),
('Przedmioty','Klucze'),
('Przedmioty','Portfel'),
('Przedmioty','Plecak'),
('Przedmioty','Okulary'),
('Przedmioty','Butelka'),
('Przedmioty','Kubek'),
('Przedmioty','Szczoteczka do zębów'),
('Przedmioty','Konsola'),
('Przedmioty','Klawiatura'),
('Przedmioty','Myszka komputerowa'),
('Przedmioty','Zegar'),
('Przedmioty','Odkurzacz'),
('Przedmioty','Koc'),
('Przedmioty','Ręcznik'),
('Przedmioty','Drukarka'),
('Postacie','Spider-Man'),
('Postacie','Iron Man'),
('Postacie','Joker'),
('Postacie','Elsa'),
('Postacie','Mickey Mouse'),
('Postacie','Homer Simpson'),
('Postacie','Walter White'),
('Postacie','Dumbledore'),
('Postacie','Yoda'),
('Postacie','Pikachu'),
('Postacie','Sonic'),
('Postacie','Peppa Pig'),
('Postacie','Dora'),
('Postacie','Gru'),
('Postacie','Jack Sparrow'),
('Postacie','Hulk'),
('Postacie','Stitch'),
('Postacie','Wednesday Addams'),
('Postacie','Barbie'),
('Internet / memy','Sigma'),
('Internet / memy','Rizz'),
('Internet / memy','NPC'),
('Internet / memy','Baby Yoda'),
('Internet / memy','Doge'),
('Internet / memy','Pepe the Frog'),
('Internet / memy','Trollface'),
('Internet / memy','Rickroll'),
('Internet / memy','MrBeast'),
('Internet / memy','IShowSpeed'),
('Internet / memy','Kai Cenat'),
('Internet / memy','Polish cow'),
('Internet / memy','Ohio'),
('Internet / memy','Brainrot'),
('Internet / memy','Mewing'),
('Internet / memy','Fanum tax'),
('Internet / memy','Grimace Shake'),
('Internet / memy','Minecraft parkour'),
('Sport','Robert Lewandowski'),
('Sport','Lionel Messi'),
('Sport','Cristiano Ronaldo'),
('Sport','Kylian Mbappé'),
('Sport','Lamine Yamal'),
('Sport','FC Barcelona'),
('Sport','Real Madryt'),
('Sport','Reprezentacja Polski'),
('Sport','Robert Kubica'),
('Sport','Iga Świątek'),
('Sport','Wimbledon'),
('Sport','Liga Mistrzów'),
('Sport','Mundial'),
('Sport','VAR'),
('Sport','Rzut karny'),
('Sport','Bramkarz'),
('Sport','Koszykówka'),
('Sport','Siatkówka'),
('Sport','Formuła 1'),
('Muzyka','Taylor Swift'),
('Muzyka','The Weeknd'),
('Muzyka','Billie Eilish'),
('Muzyka','Dawid Podsiadło'),
('Muzyka','Sanah'),
('Muzyka','Quebonafide'),
('Muzyka','Taco Hemingway'),
('Muzyka','Mata'),
('Muzyka','Sobel'),
('Muzyka','Bedoes'),
('Muzyka','Kendrick Lamar'),
('Muzyka','Drake'),
('Muzyka','Travis Scott'),
('Muzyka','Lady Gaga'),
('Muzyka','Ariana Grande'),
('Muzyka','Radiohead'),
('Muzyka','Deftones'),
('Muzyka','Spotify'),
('Muzyka','Eurowizja'),
('Marki','Nike'),
('Marki','Adidas'),
('Marki','Apple'),
('Marki','Samsung'),
('Marki','IKEA'),
('Marki','McDonald’s'),
('Marki','KFC'),
('Marki','Żabka'),
('Marki','Lidl'),
('Marki','Biedronka'),
('Marki','Coca-Cola'),
('Marki','Pepsi'),
('Marki','LEGO'),
('Marki','Netflix'),
('Marki','Spotify'),
('Marki','YouTube'),
('Marki','TikTok'),
('Marki','PlayStation'),
('Marki','Xbox'),
('Marki','Nintendo'),
('Polska','Warszawa'),
('Polska','Kraków'),
('Polska','Łódź'),
('Polska','Gdańsk'),
('Polska','Zakopane'),
('Polska','Morskie Oko'),
('Polska','Pałac Kultury'),
('Polska','Żabka'),
('Polska','BLIK'),
('Polska','Paczkomat'),
('Polska','InPost'),
('Polska','Orlen'),
('Polska','Wawel'),
('Polska','Syrenka warszawska'),
('Polska','Tatry'),
('Polska','Bałtyk'),
('Polska','Oscypek'),
('Polska','Mikołaj Kopernik'),
('Technologia','iPhone'),
('Technologia','Android'),
('Technologia','Windows'),
('Technologia','PlayStation 5'),
('Technologia','Xbox'),
('Technologia','Nintendo Switch'),
('Technologia','ChatGPT'),
('Technologia','Sztuczna inteligencja'),
('Technologia','Bluetooth'),
('Technologia','Wi-Fi'),
('Technologia','YouTube'),
('Technologia','Netflix'),
('Technologia','Google Maps'),
('Technologia','AirPods'),
('Technologia','TikTok'),
('Technologia','Instagram'),
('Technologia','USB'),
('Technologia','Drukarka 3D'),
('Technologia','Robot'),
('Technologia','Dron'),
('Social media','TikTok'),
('Social media','Instagram'),
('Social media','Snapchat'),
('Social media','YouTube'),
('Social media','Twitch'),
('Social media','Discord'),
('Social media','Facebook'),
('Social media','X'),
('Social media','BeReal'),
('Social media','Pinterest'),
('Social media','Messenger'),
('Social media','WhatsApp'),
('Social media','Spotify'),
('Social media','Reddit'),
('Social media','Influencer'),
('Social media','Streamer'),
('Social media','Vlog'),
('Social media','Selfie'),
('Social media','Relacja'),
('Social media','Hashtag'),
('Popularne teraz','ChatGPT'),
('Popularne teraz','AI'),
('Popularne teraz','Roblox'),
('Popularne teraz','Brawl Stars'),
('Popularne teraz','Wednesday'),
('Popularne teraz','Squid Game'),
('Popularne teraz','Minecraft'),
('Popularne teraz','TikTok'),
('Popularne teraz','MrBeast'),
('Popularne teraz','IShowSpeed'),
('Popularne teraz','Lamine Yamal'),
('Popularne teraz','Taylor Swift'),
('Popularne teraz','Labubu'),
('Popularne teraz','Dubai chocolate'),
('Popularne teraz','Matcha'),
('Popularne teraz','Coldplay'),
('Popularne teraz','GTA 6'),
('Popularne teraz','Skibidi Toilet'),
('Popularne teraz','Spotify Wrapped'),
('Popularne teraz','Eurowizja')
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

create or replace function public.set_player_avatar(p_code text,p_token uuid,p_avatar text)
returns jsonb language plpgsql security definer set search_path=public as $
declare v_player_id uuid;
begin
  select p.id into v_player_id from public.players p join public.rooms r on r.id=p.room_id
  where r.code=upper(trim(p_code)) and p.token=p_token;
  if v_player_id is null then raise exception 'Nie należysz do tego pokoju.'; end if;
  update public.players set avatar=case when p_avatar in ('😎','🐼','🦊','🐱','🐻','🐨','🐯','🐙','👽','🤖','👻','🦄','🐧','🦁','🐲','🍄','⚡','🔥','🐸','🐵','🐰','🐹','🐮','🐷','🐺','🐗','🦝','🦉','🦋','🐢','🐬','🦈','🦖','🦕','🐝','🐞','🦂','🦀','🦐','🐳','🦩','🦚','🦜','🦔','🐿️','🌵','🌻','🌈','🍀','🍉','🍓','🍕','🍩','🎃','👑','💀','👾','💎','🎸','🚀','🛸','⚽','🏀','🎮','🎧','🧸','🧙','🥷','🦸','🧛','🧟','👺','👹','🤡','🥶','🥳','😈','🤠','🤓','🥸','😺','🙈','💩','🫶','🧠') then p_avatar else '😎' end
  where id=v_player_id;
  return jsonb_build_object('ok',true);
end $;

create or replace function public.start_game(p_code text,p_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_room rooms%rowtype;
  v_count integer;
  v_words text[];
begin
  select * into v_room from rooms where code=upper(trim(p_code)) for update;
  if not found then raise exception 'Nie znaleziono pokoju.'; end if;
  if v_room.host_token <> p_token then raise exception 'Tylko gospodarz może rozpocząć lub zrestartować grę.'; end if;
  if v_room.status not in ('waiting','finished') then raise exception 'Gra już trwa.'; end if;
  select count(*) into v_count from players where room_id=v_room.id;
  if v_count < 2 then raise exception 'Potrzeba co najmniej 2 graczy.'; end if;
  select array_agg(word order by random()) into v_words from (
    select distinct word from (
      select word from words where category=v_room.category or v_room.category='Mieszane'
      union all select unnest(v_room.custom_words)
    ) s
  ) q;
  if coalesce(array_length(v_words,1),0) < v_count then
    raise exception 'Za mało różnych haseł. Dodaj własne słowa lub wybierz inną kategorię.';
  end if;
  with ordered as (select id,row_number() over(order by seat) rn from players where room_id=v_room.id)
  update players p set word=v_words[o.rn],score=0,is_active=true from ordered o where p.id=o.id;
  update rooms set status='playing',
    current_turn=(select min(seat) from players where room_id=v_room.id),
    winner_name=null
  where id=v_room.id;
  return jsonb_build_object('ok',true,'restarted',v_room.status='finished');
end $$;

create or replace function public.get_game_state(p_code text,p_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_room rooms%rowtype;
  v_me players%rowtype;
  v_current players%rowtype;
  v_players jsonb;
begin
  select * into v_room from rooms where code=upper(trim(p_code));
  if not found then raise exception 'Nie znaleziono pokoju.'; end if;
  select * into v_me from players where room_id=v_room.id and token=p_token;
  if not found then raise exception 'Nie należysz do tego pokoju.'; end if;
  select * into v_current from players where room_id=v_room.id and seat=v_room.current_turn and is_active;
  select jsonb_agg(jsonb_build_object(
    'id',p.id,'name',p.name,'avatar',p.avatar,'score',p.score,'seat',p.seat,
    'is_me',p.token=p_token,'is_active',p.is_active,
    'word',case when p.token=p_token then null else p.word end
  ) order by p.seat) into v_players
  from players p where p.room_id=v_room.id;
  return jsonb_build_object(
    'code',v_room.code,'status',v_room.status,'category',v_room.category,
    'is_host',v_room.host_token=p_token,'players',coalesce(v_players,'[]'::jsonb),
    'current_player_name',v_current.name,
    'current_player_is_me',coalesce(v_current.token=p_token,false),
    'last_player_name',v_room.winner_name,'winner_name',v_room.winner_name
  );
end $$;

create or replace function public.finish_turn(p_code text,p_token uuid,p_correct boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_room rooms%rowtype;
  v_current players%rowtype;
  v_next players%rowtype;
  v_new_word text;
  v_new_score integer;
begin
  select * into v_room from rooms where code=upper(trim(p_code)) for update;
  if not found or v_room.status <> 'playing' then raise exception 'Gra nie jest aktywna.'; end if;
  select * into v_current from players
  where room_id=v_room.id and seat=v_room.current_turn and is_active for update;
  if not found or v_current.token <> p_token then raise exception 'To nie Twoja kolej.'; end if;

  if p_correct then
    v_new_score := v_current.score + 1;
    update players set score=v_new_score where id=v_current.id;
    if v_new_score >= 3 then
      update rooms set status='finished',winner_name=v_current.name where id=v_room.id;
      return jsonb_build_object('ok',true,'finished',true,'winner_name',v_current.name);
    end if;

    select q.word into v_new_word from (
      select distinct s.word from (
        select word from words where category=v_room.category or v_room.category='Mieszane'
        union all select unnest(v_room.custom_words)
      ) s
    ) q
    where q.word <> v_current.word and not exists (
      select 1 from players p where p.room_id=v_room.id and p.id <> v_current.id and p.word=q.word
    ) order by random() limit 1;

    if v_new_word is null then
      select q.word into v_new_word from (
        select distinct s.word from (
          select word from words where category=v_room.category or v_room.category='Mieszane'
          union all select unnest(v_room.custom_words)
        ) s
      ) q where q.word <> v_current.word order by random() limit 1;
    end if;
    if v_new_word is null then raise exception 'Brak kolejnego hasła. Dodaj więcej haseł do kategorii.'; end if;
    update players set word=v_new_word,is_active=true where id=v_current.id;
  end if;

  select * into v_next from players
  where room_id=v_room.id and is_active and seat > v_current.seat order by seat limit 1;
  if v_next.id is null then
    select * into v_next from players where room_id=v_room.id and is_active order by seat limit 1;
  end if;
  update rooms set current_turn=v_next.seat where id=v_room.id;
  return jsonb_build_object('ok',true,'finished',false,'new_word_assigned',p_correct);
end $$;

grant execute on function public.create_room(text,text,text[]) to anon, authenticated;
grant execute on function public.join_room(text,text) to anon, authenticated;
grant execute on function public.set_player_avatar(text,uuid,text) to anon, authenticated;
grant execute on function public.start_game(text,uuid) to anon, authenticated;
grant execute on function public.get_game_state(text,uuid) to anon, authenticated;
grant execute on function public.finish_turn(text,uuid,boolean) to anon, authenticated;
