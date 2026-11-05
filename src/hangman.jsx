import React, { useCallback, useEffect, useRef, useState } from 'react';
import HeaderClock from './HeaderClock.jsx';
import './hangman.css';

const SESSION = 'kminka-hangman-v1';
const ALPHABET = Array.from('AĄBCĆDEĘFGHIJKLŁMNŃOÓPQRSŚTUVWXYZŹŻ');
const invitation = () => new URLSearchParams(location.search).get('wisielec')?.toUpperCase() || '';
function savedSession() {
  try {
    if (invitation()) return null;
    const saved = JSON.parse(sessionStorage.getItem(SESSION) || 'null');
    return saved && /^[A-F0-9]{8}$/.test(saved.code) && typeof saved.token === 'string' ? saved : null;
  } catch { return null; }
}

export default function HangmanApp({ supabase, onBack, categories }) {
  const [saved] = useState(savedSession);
  const [credentials, setCredentials] = useState(saved);
  const [state, setState] = useState(null);
  const [name, setName] = useState(saved?.name || '');
  const [code, setCode] = useState(invitation);
  const [category, setCategory] = useState('Mieszane');
  const [mode, setMode] = useState('random');
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [syncError, setSyncError] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);
  const accept = useCallback(data => setState(old => !old || old.code !== data.code || data.revision >= old.revision ? data : old), []);

  useEffect(() => {
    try { document.documentElement.dataset.theme = localStorage.getItem('nie-wiem-theme') || 'amethyst'; } catch {}
  }, []);

  useEffect(() => {
    if (!credentials || !supabase) return;
    let live = true;
    let timer;
    const refresh = async () => {
      try {
        const { data, error: err } = await supabase.rpc('hg_action', { p_action:'state', p_token:credentials.token, p_code:credentials.code });
        if (!live) return;
        if (err) throw err;
        accept(data);
        setSyncError(false);
      } catch (err) {
        if (!live) return;
        if (/Nie należysz|Nie znaleziono/.test(err.message)) {
          setCredentials(null); setState(null);
          try { sessionStorage.removeItem(SESSION); } catch {}
          setError('Ten pokój nie jest już dostępny. Utwórz nowy lub dołącz ponownie.');
        } else setSyncError(true);
      } finally { if (live) timer = setTimeout(refresh, 1200); }
    };
    refresh();
    // Each polling request completes before the next begins, including after reconnect.
    return () => { live = false; clearTimeout(timer); };
  }, [credentials, supabase, accept]);

  const action = useCallback(async (kind, extra = {}) => {
    if (lock.current) return;
    if (!supabase) { setError('Brak połączenia z grą. Spróbuj później.'); return; }
    lock.current = true; setBusy(true); setError(''); setNotice('');
    const currentGeneration = generation.current;
    try {
      const token = credentials?.token || crypto.randomUUID();
      const { data, error: err } = await supabase.rpc('hg_action', {
        p_action:kind, p_token:token, p_code:credentials?.code || code.trim().toUpperCase(),
        p_name:name.trim(), p_round:state?.round || 0, ...extra
      });
      if (err) throw err;
      if (currentGeneration !== generation.current) return;
      if (kind === 'leave') {
        generation.current++;
        setCredentials(null); setState(null);
        try { sessionStorage.removeItem(SESSION); } catch {}
      } else {
        if (kind === 'create' || kind === 'join') {
          const session = { token, code:data.code, name:name.trim() };
          setCredentials(session);
          try { sessionStorage.setItem(SESSION, JSON.stringify(session)); } catch {}
          const url = new URL(location.href); url.searchParams.delete('wisielec');
          history.replaceState(null, '', url.pathname + url.search);
        }
        accept(data);
        if (kind === 'start') setWord('');
      }
    } catch (err) { setError(err.message || 'Nie udało się połączyć. Spróbuj ponownie.'); }
    finally { lock.current = false; setBusy(false); }
  }, [supabase, credentials, code, name, state?.round, accept]);

  const canGuess = state?.status === 'playing' && !state.is_setter && !syncError;
  useEffect(() => {
    const onKey = event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
      const letter = event.key.toUpperCase();
      if (canGuess && !busy && ALPHABET.includes(letter) && !state.guessed.includes(letter)) {
        event.preventDefault(); action('guess', { p_value:letter });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canGuess, busy, state, action]);

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(location.origin + location.pathname + '?wisielec=' + state.code);
      setNotice('Link do pokoju skopiowany!');
    } catch { setNotice('Kod pokoju: ' + state.code + '. Wpisz go na ekranie Wisielca.'); }
  }

  const setup = state && <div className="hg-setup">
    <label htmlFor="hg-mode">WYBÓR HASŁA</label>
    <select id="hg-mode" value={mode} onChange={e=>setMode(e.target.value)} disabled={busy}>
      <option value="random">Losowanie — zgadujemy wszyscy</option><option value="custom">Własne — gospodarz kibicuje</option>
    </select>
    {mode === 'random' ? <><label htmlFor="hg-category">KATEGORIA</label><select id="hg-category" value={category} onChange={e=>setCategory(e.target.value)} disabled={busy}>{categories.map(c=><option key={c}>{c}</option>)}</select></> : <>
      <label htmlFor="hg-word">TAJNE HASŁO</label><input id="hg-word" type="password" autoComplete="off" maxLength={40} value={word} onChange={e=>setWord(e.target.value)} placeholder="2–40 znaków" disabled={busy}/>
      <p>Polskie litery, spacje i myślniki. Autor hasła nie zgaduje. Potrzeba co najmniej 2 osób.</p>
    </>}
    <button className="primary" disabled={busy || (mode === 'custom' && (!word.trim() || state.players.length < 2))} onClick={()=>action('start',{p_value:mode === 'custom' ? word : '',p_category:category})}>{state?.status === 'waiting' ? 'Rozpocznij rundę' : 'Rewanż — nowe hasło'} →</button>
  </div>;

  return <div className="app-shell hg-shell">
    <header className="topbar imp-header"><div className="brand"><span className="brand-mark">✦</span><span>WISIELEC<span className="brand-dot">.</span></span></div><div className="imp-header-right"><button className="hub-nav-link" onClick={onBack}>← Gry</button><HeaderClock/></div></header>
    <main className="hg-main">
      {!credentials ? <>
        <section className="imp-hero"><div className="eyebrow"><span className="pulse"/>03 / LITERA PO LITERZE</div><h1>Jedno hasło. <em>Cała ekipa.</em></h1><p className="intro">Odkrywajcie litery i rozwiążcie hasło przed siódmą pomyłką.</p><div className="imp-how"><span>WSPÓLNA GRA</span><span>POLSKIE LITERY</span><span>7 POMYŁEK</span></div></section>
        <section className="panel hg-entry"><label htmlFor="hg-name">TWÓJ NICK</label><input id="hg-name" maxLength={24} value={name} onChange={e=>setName(e.target.value)} placeholder="Jak Cię wołać?" disabled={busy}/>
          <div className="hg-entry-grid"><div><h2>Nowa ekipa?</h2><p>Stwórz pokój i wyślij znajomym link. Losowe hasło możesz też zgadywać solo.</p><button className="primary" disabled={busy || !name.trim()} onClick={()=>action('create')}>Stwórz pokój →</button></div>
          <form onSubmit={e=>{e.preventDefault();action('join');}}><h2>Masz zaproszenie?</h2><label htmlFor="hg-code">KOD POKOJU</label><input id="hg-code" maxLength={8} value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g,''))} placeholder="Np. A1B2C3D4" disabled={busy}/><button className="secondary" disabled={busy || !name.trim() || code.length !== 8}>Dołącz do pokoju →</button></form></div>
        </section>
      </> : !state ? <div className="loading">{syncError ? 'Brak połączenia. Ponawiam próbę…' : 'Przywracanie pokoju…'}<button className="text-button" onClick={()=>{setCredentials(null);try{sessionStorage.removeItem(SESSION);}catch{}}}>Wróć do dołączania</button></div> : <>
        <section className="imp-room-heading"><div><div className="eyebrow">WISIELEC / RUNDA {state.round || 1}</div><h1>{state.status === 'waiting' ? 'Zbierzcie ekipę.' : 'Każda litera ma znaczenie.'}</h1><p>Jeden wspólny wynik. Wszyscy mogą wybierać litery.</p></div><div className="imp-code-card"><span>KOD POKOJU</span><strong>{state.code}</strong><button onClick={copyInvite}>Kopiuj zaproszenie ↗</button></div></section>
        {syncError && <div className="alert" role="status">Utracono połączenie. Ponawiam synchronizację…</div>}
        <section className="panel imp-players-panel"><div className="eyebrow">EKIPA · {state.players.length}/12</div><div className="hg-players">{state.players.map((p,i)=><span key={i}>{p.is_host ? '👑 ' : '✦ '}{p.name}{p.is_me ? ' (Ty)' : ''}</span>)}</div></section>
        {state.status === 'waiting' ? <section className="panel hg-board"><h2>Gotowi na zgadywanie?</h2><p>Za każdą błędną literę wspólny licznik rośnie. Powtórzona litera nic nie kosztuje. Spacje i myślniki są od razu widoczne.</p>{state.is_host ? setup : <div className="waiting-box">Gospodarz wybiera hasło i rozpoczyna rundę.</div>}</section> : <section className="panel hg-board">
          <div className="eyebrow">{state.category}</div>
          <div className="hg-meter" role="img" aria-label={`Pomyłki: ${state.mistakes} z ${state.limit}`}>{Array.from({length:state.limit},(_,i)=><span className={i<state.mistakes ? 'used' : ''} key={i}>{i<state.mistakes ? '×' : '✦'}</span>)}</div>
          <p className="hg-count">Pomyłki <strong>{state.mistakes} / {state.limit}</strong></p>
          <div className="hg-word" aria-label="Hasło">{state.mask.split(' ').map((part,i)=><span className="hg-word-part" key={i}>{Array.from(part).map((c,j)=><span className={'hg-tile'+(c === '_' ? ' hidden' : '')} key={j} aria-label={c === '_' ? 'Ukryta litera' : c}>{c === '_' ? '·' : c}</span>)}</span>)}</div>
          <div aria-live="polite" className="hg-outcome">{state.status === 'won' ? <><h2>✦ Hasło odgadnięte!</h2><p>Wygrywacie razem. Dobra robota, ekipo!</p></> : state.status === 'lost' ? <><h2>Koniec prób. Jeszcze raz?</h2><p>Hasło zostało odsłonięte. Następna runda należy do Was.</p></> : <p>{state.is_setter ? 'Znasz hasło — teraz kibicuj ekipie!' : 'Wybierz literę na ekranie lub klawiaturze.'}</p>}</div>
          <div className="hg-keyboard" aria-label="Wybierz literę">{ALPHABET.map(l=>{
            const used=state.guessed.includes(l); const hit=used && state.mask.includes(l);
            return <button key={l} className={used ? hit ? 'hit' : 'miss' : ''} disabled={!canGuess || busy || used} onClick={()=>action('guess',{p_value:l})} aria-label={l+(used ? hit ? ' — trafiona' : ' — błędna' : '')}>{l}</button>;
          })}</div>
          {state.status !== 'playing' && (state.is_host ? setup : <div className="waiting-box">Czekamy na rewanż od gospodarza.</div>)}
          {state.is_host && <button className="text-button" disabled={busy} onClick={()=>{if(state.status !== 'playing' || confirm('Przerwać rundę i wrócić do wyboru hasła?'))action('reset');}}>↻ Wróć do poczekalni</button>}
        </section>}
        <button className="text-button" disabled={busy} onClick={()=>action('leave')}>← Opuść pokój</button>
      </>}
      {busy && <p className="hg-pending" role="status">Zapisywanie…</p>}
      {error && <div className="alert" role="alert">{error}</div>}{notice && <div className="notice" role="status">{notice}</div>}
    </main><footer><span>KMINKA · WISIELEC</span><span>GRAJ FAIR. ŚMIEJ SIĘ GŁOŚNO.</span></footer>
  </div>;
}
