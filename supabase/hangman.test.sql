-- Transaction rolls back all QA rooms. Run against the installed hangman.sql.
begin;
set local role anon;
do $$
declare h uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); s jsonb; c text; l text;
begin
 s:=public.hg_action('create',h,p_name=>'QA host'); c:=s->>'code';
 s:=public.hg_action('join',g,c,'QA guest');
 assert jsonb_array_length(s->'players')=2, 'join';
 begin perform public.hg_action('state',outsider,c); raise exception 'FAILED outsider access'; exception when others then if sqlerrm='FAILED outsider access' then raise; end if; end;
 begin perform public.hg_action('start',g,c,p_value=>'ŻÓŁĆ'); raise exception 'FAILED nonhost start'; exception when others then if sqlerrm='FAILED nonhost start' then raise; end if; end;
 s:=public.hg_action('start',h,c,p_value=>'ŻÓŁĆ ŻÓŁĆ',p_round=>0);
 assert s->>'mask'='____ ____', 'hidden secret';
 assert not s ? 'word' and not s ? 'token', 'no secret leak';
 begin perform public.hg_action('guess',h,c,p_value=>'Ż',p_round=>1); raise exception 'FAILED setter guess'; exception when others then if sqlerrm='FAILED setter guess' then raise; end if; end;
 s:=public.hg_action('guess',g,c,p_value=>'X',p_round=>1);
 s:=public.hg_action('guess',g,c,p_value=>'X',p_round=>1);
 assert (s->>'mistakes')::int=1, 'duplicate is free';
 foreach l in array array['Ż','Ó','Ł','Ć'] loop s:=public.hg_action('guess',g,c,p_value=>l,p_round=>1); end loop;
 assert s->>'status'='won' and s->>'mask'='ŻÓŁĆ ŻÓŁĆ', 'Polish win and repeated letters';
 s:=public.hg_action('start',h,c,p_value=>'AB',p_round=>1);
 begin perform public.hg_action('guess',g,c,p_value=>'A',p_round=>1); raise exception 'FAILED stale round'; exception when others then if sqlerrm='FAILED stale round' then raise; end if; end;
 foreach l in array array['C','D','E','F','G','H','I'] loop s:=public.hg_action('guess',g,c,p_value=>l,p_round=>2); end loop;
 assert s->>'status'='lost' and s->>'mask'='AB' and (s->>'mistakes')::int=7, 'loss reveal';
 s:=public.hg_action('reset',h,c,p_round=>2);
 assert s->>'status'='waiting' and s->>'mask'='', 'reset';
 s:=public.hg_action('start',h,c,p_round=>2);
 assert s->>'status'='playing' and s->>'is_setter'='false' and s->>'mask' like '%_%', 'random start';
 perform public.hg_action('leave',h,c);
 s:=public.hg_action('state',g,c);
 assert (s->>'is_host')::bool, 'host transfer';
 perform public.hg_action('leave',g,c);
 begin perform public.hg_action('state',g,c); raise exception 'FAILED empty room cleanup'; exception when others then if sqlerrm='FAILED empty room cleanup' then raise; end if; end;
end $$;
rollback;
