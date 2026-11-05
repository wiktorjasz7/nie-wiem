-- Isolated from CZÓŁKO / IMPOSTOR. Guest UUIDs are per-tab bearer credentials.
create schema if not exists hangman_private;
revoke all on schema hangman_private from public;
grant usage on schema hangman_private to anon, authenticated;
create table hangman_private.rooms (
 code text primary key, host uuid not null, status text not null default 'waiting',
 word text not null default '', category text not null default 'Mieszane', setter uuid,
 guessed text[] not null default '{}', mistakes int not null default 0,
 round int not null default 0, revision bigint not null default 0,
 created_at timestamptz not null default now()
);
create table hangman_private.players (
 token uuid primary key, code text not null references hangman_private.rooms on delete cascade,
 name text not null, joined_at timestamptz not null default now()
);
create index on hangman_private.players(code);
alter table hangman_private.rooms enable row level security;
alter table hangman_private.players enable row level security;
revoke all on all tables in schema hangman_private from public, anon, authenticated;

-- The only privileged entry point validates the guest credential on EVERY room action.
-- No Supabase Auth dependency: matches the existing invitation-only guest-room model.
create function hangman_private.action(p_action text, p_token uuid, p_code text default '', p_name text default '', p_value text default '', p_category text default 'Mieszane', p_round int default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r hangman_private.rooms; v_code text := upper(trim(p_code)); v_word text;
 v_letter text; v_mask text; v_players jsonb; v_next uuid; v_setter uuid;
begin
 if p_token is null then raise exception 'Brak sesji gracza.'; end if;
 if p_action in ('create','join') then
  if length(trim(p_name)) not between 1 and 24 then raise exception 'Nick musi mieć 1–24 znaki.'; end if;
  if exists(select 1 from hangman_private.players where token=p_token) then raise exception 'Ta sesja jest już w pokoju.'; end if;
  if p_action='create' then
   loop
    v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    insert into hangman_private.rooms(code,host) values(v_code,p_token) on conflict do nothing;
    exit when found;
   end loop;
  end if;
  select * into r from hangman_private.rooms where code=v_code for update;
  if not found then raise exception 'Nie znaleziono pokoju.'; end if;
  if (select count(*) from hangman_private.players where code=v_code)>=12 then raise exception 'Pokój jest pełny (12 osób).'; end if;
  insert into hangman_private.players(token,code,name) values(p_token,v_code,trim(p_name));
  update hangman_private.rooms set revision=revision+1 where code=v_code;
 else
  select * into r from hangman_private.rooms where code=v_code for update;
  if not found then raise exception 'Nie znaleziono pokoju.'; end if;
  if not exists(select 1 from hangman_private.players where code=v_code and token=p_token) then raise exception 'Nie należysz do tego pokoju.'; end if;
  if p_action='start' then
   if r.host<>p_token then raise exception 'Tylko gospodarz rozpoczyna rundę.'; end if;
   if r.status='playing' or r.round<>p_round then raise exception 'Stan rundy się zmienił. Odśwież pokój.'; end if;
   if length(trim(p_value))>0 then
    v_word := upper(regexp_replace(trim(p_value),'\s+',' ','g'));
    if length(v_word) not between 2 and 40 or v_word !~ '^[A-ZĄĆĘŁŃÓŚŹŻ -]+$' or v_word !~ '[A-ZĄĆĘŁŃÓŚŹŻ]' then raise exception 'Hasło: 2–40 znaków, polskie litery, spacje i myślniki.'; end if;
    if (select count(*) from hangman_private.players where code=v_code)<2 then raise exception 'Własne hasło wymaga co najmniej 2 graczy.'; end if;
    v_setter := p_token;
   else
    select upper(w.word) into v_word from public.words w
     where (p_category='Mieszane' or w.category=p_category)
     and length(w.word) between 2 and 40 and upper(w.word) ~ '^[A-ZĄĆĘŁŃÓŚŹŻ -]+$'
     and upper(w.word)<>r.word order by random() limit 1;
    if v_word is null then raise exception 'Brak haseł w tej kategorii. Wybierz Mieszane.'; end if;
   end if;
   update hangman_private.rooms set word=v_word, category=case when v_setter is null then p_category else 'Własne hasło' end,
    setter=v_setter, guessed='{}', mistakes=0, status='playing', round=round+1, revision=revision+1 where code=v_code;
  elsif p_action='guess' then
   if r.status<>'playing' or r.round<>p_round then raise exception 'Ta runda już się zakończyła lub zmieniła.'; end if;
   if r.setter=p_token then raise exception 'Autor hasła kibicuje pozostałym.'; end if;
   v_letter := upper(p_value);
   if v_letter !~ '^[A-ZĄĆĘŁŃÓŚŹŻ]$' then raise exception 'Wybierz jedną literę.'; end if;
   if not v_letter=any(r.guessed) then
    r.guessed := array_append(r.guessed,v_letter);
    if position(v_letter in r.word)=0 then r.mistakes:=r.mistakes+1; end if;
    if r.mistakes>=7 then r.status:='lost';
    elsif not exists(select 1 from regexp_split_to_table(r.word,'') c where c ~ '[A-ZĄĆĘŁŃÓŚŹŻ]' and not c=any(r.guessed)) then r.status:='won'; end if;
    update hangman_private.rooms set guessed=r.guessed,mistakes=r.mistakes,status=r.status,revision=revision+1 where code=v_code;
   end if;
  elsif p_action='reset' then
   if r.host<>p_token then raise exception 'Tylko gospodarz resetuje pokój.'; end if;
   if r.round<>p_round then raise exception 'Stan rundy się zmienił.'; end if;
   update hangman_private.rooms set status='waiting',word='',setter=null,guessed='{}',mistakes=0,revision=revision+1 where code=v_code;
  elsif p_action='leave' then
   delete from hangman_private.players where code=v_code and token=p_token;
   select token into v_next from hangman_private.players where code=v_code order by joined_at,token limit 1;
   if v_next is null then delete from hangman_private.rooms where code=v_code;
   else update hangman_private.rooms set host=case when host=p_token then v_next else host end,revision=revision+1 where code=v_code; end if;
   return jsonb_build_object('left',true);
  elsif p_action<>'state' then raise exception 'Nieznana akcja.';
  end if;
 end if;
 select * into r from hangman_private.rooms where code=v_code;
 select string_agg(case when c ~ '[A-ZĄĆĘŁŃÓŚŹŻ]' and not c=any(r.guessed) and r.status not in ('won','lost') then '_' else c end,'' order by n)
 into v_mask from regexp_split_to_table(r.word,'') with ordinality as chars(c,n);
 select jsonb_agg(jsonb_build_object('name',name,'is_me',token=p_token,'is_host',token=r.host) order by joined_at,token)
 into v_players from hangman_private.players where code=v_code;
 return jsonb_build_object('code',r.code,'status',r.status,'category',r.category,'mask',coalesce(v_mask,''),
  'guessed',r.guessed,'mistakes',r.mistakes,'limit',7,'round',r.round,'revision',r.revision,
  'is_host',r.host=p_token,'is_setter',coalesce(r.setter=p_token,false),'players',v_players);
end;
$$;
revoke all on function hangman_private.action(text,uuid,text,text,text,text,int) from public;
grant execute on function hangman_private.action(text,uuid,text,text,text,text,int) to anon, authenticated;
create function public.hg_action(p_action text, p_token uuid, p_code text default '', p_name text default '', p_value text default '', p_category text default 'Mieszane', p_round int default 0)
returns jsonb language sql security invoker set search_path='' as $$
 select hangman_private.action(p_action,p_token,p_code,p_name,p_value,p_category,p_round);
$$;
revoke all on function public.hg_action(text,uuid,text,text,text,text,int) from public;
grant execute on function public.hg_action(text,uuid,text,text,text,text,int) to anon, authenticated;
