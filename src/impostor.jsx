import React, { useEffect, useRef, useState } from "react";
import "./impostor.css";
import HeaderClock from "./HeaderClock.jsx";

const SESSION_KEY = "impostor-room-session-v1";
const getInvitation = () => new URLSearchParams(window.location.search).get("impostor")?.toUpperCase() || "";
const readSession = () => {
  try {
    if (getInvitation()) return null;
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (!saved || !/^[A-F0-9]{6}$/.test(saved.code) || typeof saved.token !== "string") return null;
    return saved;
  } catch { return null; }
};
const initialAvatar = () => {
  try { return localStorage.getItem("nie-wiem-avatar") || "😎"; } catch { return "😎"; }
};

export default function ImpostorApp({ supabase, onBack, categories, avatars }) {
  const [screen, setScreen] = useState("home");
  const [restoring, setRestoring] = useState(() => !!readSession());
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(initialAvatar);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [joinCode, setJoinCode] = useState(getInvitation);
  const [category, setCategory] = useState("Mieszane");
  const [difficulty, setDifficulty] = useState("normal");
  const [hintsEnabled, setHintsEnabled] = useState(false);
  const [room, setRoom] = useState("");
  const [token, setToken] = useState("");
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reveal, setReveal] = useState(false);
  const [guessOpen, setGuessOpen] = useState(false);
  const [guess, setGuess] = useState("");
  const wasPlaying = useRef(false);

  useEffect(() => {
    const saved = readSession();
    if (!saved || !supabase) { setRestoring(false); return; }
    let alive = true;
    supabase.rpc("imp_get_state", { p_code: saved.code, p_token: saved.token }).then(({ data, error: err }) => {
      if (!alive) return;
      if (!err && data?.players?.some(p => p.is_me)) {
        setRoom(saved.code);
        setToken(saved.token);
        setName(saved.name || "");
        setState(data);
        setScreen("room");
      } else {
        try { sessionStorage.removeItem(SESSION_KEY); } catch {}
        setNotice("Nie udało się przywrócić poprzedniego pokoju.");
      }
      setRestoring(false);
    });
    return () => { alive = false; };
  }, [supabase]);

  useEffect(() => {
    if (!room || !token || !supabase) return;
    let live = true;
    const refresh = async () => {
      const { data, error: err } = await supabase.rpc("imp_get_state", { p_code: room, p_token: token });
      if (!live) return;
      if (!err) {
        setState(data);
        setError("");
      } else if (/Nie należysz|Nie znaleziono pokoju/i.test(err.message)) {
        try { sessionStorage.removeItem(SESSION_KEY); } catch {}
        setRoom("");
        setToken("");
        setState(null);
        setScreen("home");
        setError("Nie masz już dostępu do tego pokoju.");
      }
    };
    refresh();
    const timer = setInterval(refresh, 1750);
    return () => { live = false; clearInterval(timer); };
  }, [room, token, supabase]);

  useEffect(() => {
    if (state?.status === "waiting") wasPlaying.current = false;
    if (state?.status === "clues" && state.round_number === 1 && !wasPlaying.current) {
      wasPlaying.current = true;
      setReveal(false);
      setGuessOpen(false);
      setGuess("");
    }
    if (state?.status === "finished") {
      setReveal(false);
      setGuessOpen(false);
    }
  }, [state?.status, state?.round_number]);

  const rpc = async (fn, args, shouldRefresh = true) => {
    if (!supabase) { setError("Brak połączenia z Supabase."); return null; }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data, error: err } = await supabase.rpc(fn, args);
      if (err) { setError(err.message); return null; }
      if (shouldRefresh && room && token) {
        const response = await supabase.rpc("imp_get_state", { p_code: room, p_token: token });
        if (!response.error) setState(response.data);
      }
      return data;
    } catch {
      setError("Nie udało się połączyć z grą. Spróbuj ponownie.");
      return null;
    } finally { setBusy(false); }
  };

  const enter = async (data) => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code: data.code, token: data.token, name: name.trim() }));
      localStorage.setItem("nie-wiem-avatar", avatar);
    } catch {}
    if (getInvitation()) {
      const url = new URL(window.location.href);
      url.searchParams.delete("impostor");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    setRoom(data.code);
    setToken(data.token);
    setJoinCode(data.code);
    setScreen("room");
    setReveal(false);
    setNotice("");
  };

  const createRoom = async () => {
    if (!name.trim()) { setError("Wpisz nick."); return; }
    const data = await rpc("imp_create_room", { p_name: name.trim(), p_category: category, p_difficulty: difficulty, p_avatar: avatar, p_hints: hintsEnabled }, false);
    if (data) await enter(data);
  };

  const joinRoom = async () => {
    if (!name.trim() || !joinCode.trim()) { setError("Wpisz nick i kod pokoju."); return; }
    const data = await rpc("imp_join_room", { p_name: name.trim(), p_code: joinCode.trim().toUpperCase(), p_avatar: avatar }, false);
    if (data) await enter(data);
  };

  const leave = async () => {
    if (state?.status === "waiting" && room && token && supabase) {
      await supabase.rpc("imp_leave", { p_code: room, p_token: token });
    } else if (state?.status !== "finished" && !window.confirm("Gra jeszcze trwa. Wyjście może przerwać zabawę pozostałym graczom. Na pewno wyjść?")) {
      return;
    }
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    setRoom("");
    setToken("");
    setState(null);
    setScreen("home");
    setReveal(false);
    setGuess("");
    setError("");
    setNotice("");
    wasPlaying.current = false;
  };

  const copyInvite = async (mode) => {
    const invite = window.location.origin + window.location.pathname + "?impostor=" + encodeURIComponent(room);
    try {
      await navigator.clipboard.writeText(mode === "code" ? room : invite);
      setNotice(mode === "code" ? "Skopiowano kod pokoju." : "Skopiowano link zaproszenia.");
    } catch { setNotice(mode === "code" ? "Kod: " + room : invite); }
  };

  const giveClue = () => rpc("imp_finish_clue", { p_code: room, p_token: token });
  const roundVote = (continued) => rpc("imp_vote_round", { p_code: room, p_token: token, p_continue: continued });
  const suspectVote = (id) => rpc("imp_vote_suspect", { p_code: room, p_token: token, p_suspect_id: id });
  const makeGuess = async (event) => {
    event.preventDefault();
    if (!guess.trim()) { setError("Wpisz swoje przypuszczenie."); return; }
    const result = await rpc("imp_guess_word", { p_code: room, p_token: token, p_guess: guess.trim() });
    if (result) {
      setGuessOpen(false);
      setGuess("");
      setNotice(result.correct ? "Trafione! Impostor zgadł hasło i wygrywa." :
        result.final_guess ? "Ostatnia próba nieudana — wygrywają pozostali gracze." :
        "To nie było właściwe hasło. Próba została wykorzystana — nadal możesz wygrać przez blef.");
    }
  };

  const declineFinalGuess = async () => {
    const result = await rpc("imp_decline_last_guess", { p_code: room, p_token: token });
    if (result) {
      setGuess("");
      setGuessOpen(false);
      setNotice("Impostor rezygnuje z ostatniej próby. Wygrywają pozostali gracze.");
    }
  };

  const changeHints = (enabled) => rpc("imp_set_hints", { p_code: room, p_token: token, p_enabled: enabled });

  const kick = async (person) => {
    if (!window.confirm("Usunąć gracza " + person.name + " z poczekalni?")) return;
    await rpc("imp_kick", { p_code: room, p_token: token, p_player_id: person.id });
  };

  const players = state?.players || [];
  const me = players.find(p => p.is_me);
  const current = players.find(p => p.is_current);
  const voting = state?.status === "round_vote" || state?.status === "identify";
  const myVoteDone = state?.status === "round_vote" ? state.my_round_vote != null : state?.status === "identify" ? state.my_suspect_id != null : false;

  return <div className="app-shell imp-shell">
    <header className="topbar imp-header">
      <button className="brand" onClick={() => screen === "room" ? leave() : onBack()}>
        <span className="brand-mark imp-brand-mark">◈</span>
        <span>IMPOSTOR<span className="brand-dot">.</span></span>
      </button>
      <div className="imp-header-right">
        <HeaderClock />
        <span className="imp-header-label">KTOŚ TU BLEFUJE.</span>
        <button className="imp-header-nav" onClick={() => screen === "room" ? leave() : onBack()}>{screen === "room" ? "← Opuść" : "← Wszystkie gry"}</button>
      </div>
    </header>

    <main className="imp-main">
      {restoring ? <div className="panel loading">Przywracanie pokoju…</div> : <>
      {screen === "home" && <section className="imp-home">
        <div className="imp-hero">
          <div className="eyebrow"><span className="pulse" /> NOWA GRA · BLEF · DEDUKCJA</div>
          <h1>Jeden nie zna <em>hasła.</em></h1>
          <p className="intro">Wszyscy znają sekret. Prawie wszyscy. Podawajcie skojarzenia, wypatrujcie impostora i nie dajcie mu odgadnąć hasła.</p>
          <div className="imp-how"><span>01 / TAJNE ROLE</span><span>02 / SKOJARZENIA</span><span>03 / GŁOSOWANIE</span></div>
        </div>
        <div className="panel imp-profile-bar">
          <div className="imp-profile-bar-fields">
            <div><label>TWÓJ NICK</label><input maxLength={18} placeholder="Wpisz swój nick" value={name} onChange={e=>setName(e.target.value)}/></div>
            <div><label>TWÓJ AWATAR</label>
              <button type="button" className="imp-avatar-trigger" onClick={()=>setAvatarOpen(v=>!v)} aria-expanded={avatarOpen}>
                <span className="imp-avatar-current">{avatar}</span><span>{avatarOpen ? "Zwiń awatary" : "Wybierz awatar"}</span><span>⌄</span>
              </button>
            </div>
          </div>
          {avatarOpen && <div className="imp-avatar-grid">
            {avatars.map(a=><button key={a} type="button" className={a===avatar?"active":""} aria-label={"Awatar "+a} aria-pressed={a===avatar} onClick={()=>{setAvatar(a);setAvatarOpen(false);}}>{a}</button>)}
          </div>}
        </div>
        <div className="imp-home-grid">
          <section className="panel imp-form-panel">
            <div className="action-icon imp-action-icon">✦</div>
            <h2>Stwórz pokój</h2>
            <p>Ty prowadzisz rozgrywkę. Potrzeba co najmniej 3 osób.</p>
            <label>KATEGORIA HASEŁ</label>
            <select value={category} onChange={e=>setCategory(e.target.value)}>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <label>POZIOM TRUDNOŚCI</label>
            <select value={difficulty} onChange={e=>setDifficulty(e.target.value)}>
              <option value="easy">Łatwy</option><option value="normal">Normalny</option><option value="hard">Trudny</option>
            </select>
            <label className="imp-hints-setting">
              <input type="checkbox" checked={hintsEnabled} onChange={e=>setHintsEnabled(e.target.checked)} />
              <span><strong>Podpowiedzi dla impostora</strong><small>Impostor zobaczy jedno słowo będące skojarzeniem z tajnym hasłem.</small></span>
            </label>
            <button className="primary imp-full" onClick={createRoom} disabled={busy}>{busy?"Tworzenie…":"Utwórz pokój →"}</button>
          </section>
          <section className="panel imp-form-panel imp-join-panel">
            <div className="action-icon">↗</div>
            <h2>Dołącz do ekipy</h2>
            <p>Dostałeś link albo kod? Wejdź pod własnym nickiem. Rola zostanie wylosowana po starcie.</p>
            <label>KOD POKOJU</label>
            <input maxLength={6} placeholder="np. A1B2C3" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())}/>
            {getInvitation() && <div className="imp-invite-tip">Kod z zaproszenia został wpisany automatycznie.</div>}
            <button className="secondary imp-full" onClick={joinRoom} disabled={busy}>{busy?"Dołączanie…":"Dołącz do pokoju →"}</button>
            <div className="imp-rule-note"><span>◈</span> Jeden impostor · wspólne hasło · głosowanie po okrążeniu · szansa na odgadnięcie</div>
          </section>
        </div>
      </section>}

      {screen === "room" && <section className="imp-room">
        <div className="imp-room-heading">
          <div><div className="eyebrow">◈ POKÓJ IMPOSTORA</div>
            <h1>{state?.status === "waiting"?"Zbierzcie ekipę.":state?.status==="finished"?"Maski opadły.":state?.status==="last_guess"?"Ostatnia szansa.":"Komu ufasz?"}</h1>
            <p>{state?.category || "Mieszane"} · {({easy:"łatwe",normal:"normalne",hard:"trudne"})[state?.difficulty] || "normalne"} hasła</p>
          </div>
          <div className="imp-code-card">
            <span>KOD POKOJU</span><strong>{room}</strong>
            <div><button onClick={()=>copyInvite("code")}>Kopiuj kod</button><button onClick={()=>copyInvite("link")}>Kopiuj link ↗</button></div>
          </div>
        </div>

        {error && <div className="alert">{error}</div>}
        {notice && <div className="notice">{notice}</div>}
        {!state ? <div className="panel loading">Ładowanie pokoju…</div> : <>
          <section className="panel imp-players-panel">
            <div className="imp-section-head"><div><div className="eyebrow">UCZESTNICY</div><h2>Ekipa <span>{players.length}/12</span></h2></div><span className="status">{state.status==="waiting"?"POCZEKALNIA":state.status==="finished"?"KONIEC GRY":"W TRAKCIE"}</span></div>
            <div className="imp-players-grid">
              {players.map(p=><div className={"imp-player"+(p.is_me?" is-me":"")+(p.is_current?" is-current":"")} key={p.id}>
                <div className="imp-player-avatar">{p.avatar}</div>
                <div className="imp-player-main"><strong>{p.name} {p.is_me && <small>(TY)</small>}</strong>
                  <span>{p.is_current?"TERAZ MÓWI":voting?(p.has_voted?"✓ GŁOS ODDANY":"CZEKA NA GŁOS"):"GRACZ"}</span>
                </div>
                {state.is_host && state.status==="waiting" && !p.is_me && <button className="imp-kick" disabled={busy} onClick={()=>kick(p)}>Wyrzuć</button>}
              </div>)}
            </div>
            {state.status==="waiting" && <div className="imp-lobby-hints">
              <div><strong>✦ Podpowiedzi dla impostora</strong>
                <small>{state.hints_enabled ? "Włączone · jedno skojarzenie do hasła" : "Wyłączone · impostor nie otrzyma wskazówek"}</small>
              </div>
              {state.is_host && <label className="imp-hints-switch">
                <input type="checkbox" checked={!!state.hints_enabled} disabled={busy}
                  onChange={e=>changeHints(e.target.checked)} aria-label="Podpowiedzi dla impostora"/>
                <span>{state.hints_enabled ? "WŁ." : "WYŁ."}</span>
              </label>}
            </div>}
            {state.status==="waiting" && <div className="imp-lobby-foot">
              <p>{players.length<3?"Potrzeba jeszcze "+(3-players.length)+" graczy.":"Wszyscy gotowi? Losujemy role i zaczynamy!"}</p>
              {state.is_host ? <button className="primary" disabled={busy || players.length<3} onClick={()=>rpc("imp_start",{p_code:room,p_token:token})}>Losuj role i zacznij →</button> : <span className="waiting">Czekamy na gospodarza…</span>}
            </div>}
          </section>

          {state.status!=="waiting" && state.status!=="finished" && state.status!=="last_guess" && <section className={"imp-role-card"+(reveal && state.role==="impostor"?" is-impostor":"")}>
            {!reveal ? <div className="imp-role-hidden">
              <span className="imp-role-icon">⌑</span>
              <div><span>TAJNA KARTA</span><strong>Twoja rola jest ukryta</strong><p>Odkryj ją tak, żeby inni nie zobaczyli ekranu.</p></div>
              <button className="secondary" onClick={()=>setReveal(true)}>Pokaż moją rolę</button>
            </div> : <>
              <div className="imp-role-revealed"><div className="eyebrow">TWOJA TAJNA ROLA</div>
                <h2>{state.role==="impostor"?"JESTEŚ IMPOSTOREM":"ZNASZ HASŁO"}</h2>
                {state.role==="impostor"?<><p>Nie znasz hasła. Słuchaj skojarzeń i blefuj.</p>
                  {state.impostor_hint && <div className="imp-hint-card">
                    <span>✦ TWOJA PODPOWIEDŹ</span>
                    <strong className="imp-association-word">{state.impostor_hint}</strong>
                  </div>}
                </>:<><div className="imp-secret-word">{state.secret_word}</div><p>Podaj skojarzenie, ale nie zdradzaj hasła wprost.</p></>}
                <button className="imp-hide-role" onClick={()=>{setReveal(false);setGuessOpen(false);}}>Ukryj kartę ↑</button>
              </div>
              {state.role==="impostor" && <div className="imp-guess-area">
                {state.can_guess ? <>
                  <p>Możesz w dowolnym momencie spróbować zgadnąć hasło. <strong>Masz jedną próbę.</strong> Drobne literówki i brak polskich znaków są akceptowane.</p>
                  {!guessOpen ? <button className="secondary" onClick={()=>setGuessOpen(true)}>✦ Spróbuj odgadnąć hasło</button> :
                    <form onSubmit={makeGuess} className="imp-guess-form">
                      <input autoFocus maxLength={80} value={guess} onChange={e=>setGuess(e.target.value)} placeholder="Wpisz tajne hasło…" aria-label="Przypuszczalne hasło"/>
                      <div><button type="button" className="secondary" onClick={()=>setGuessOpen(false)}>Anuluj</button><button type="submit" className="primary" disabled={busy || !guess.trim()}>Zgaduję!</button></div>
                    </form>}
                </> : <p>Twoja próba odgadnięcia hasła została już wykorzystana. Nadal możesz wygrać przez blef.</p>}
              </div>}
            </>}
          </section>}

          {state.status==="clues" && <section className="panel imp-stage">
            <div className="eyebrow">RUNDA {state.round_number} · SKOJARZENIA</div>
            <h2>{current?.is_me?"Teraz Twoje słowo!":(current?.name || "Gracz")+" podaje skojarzenie"}</h2>
            <div className="imp-stage-progress"><div style={{width:(state.clues_given/Math.max(1,players.length)*100)+"%"}} /></div>
            <p>{state.clues_given} z {players.length} skojarzeń w tej rundzie. Powiedz na głos <strong>jedno słowo</strong> związane z hasłem. Nie wpisujesz go do gry.</p>
            {current?.is_me ? <button className="primary" disabled={busy} onClick={giveClue}>Powiedziałem słowo — dalej →</button> :
              <div className="waiting-box">Czekamy na: <strong>{current?.name}</strong></div>}
          </section>}

          {state.status==="round_vote" && <section className="panel imp-stage imp-vote-stage">
            <div className="eyebrow">RUNDA {state.round_number} ZAKOŃCZONA</div>
            <h2>Co robimy dalej?</h2>
            <p>Wszyscy powiedzieli skojarzenia. Każdy decyduje, czy gramy kolejne okrążenie, czy już głosujemy na impostora. Większość wybiera zakończenie, remis oznacza dalszą grę.</p>
            <div className="imp-vote-count">Oddane głosy: <strong>{state.votes_cast} / {players.length}</strong></div>
            {myVoteDone ? <div className="waiting-box">Twój głos zapisany. Czekamy na pozostałych…</div> :
              <div className="imp-choice-actions">
                <button className="secondary" disabled={busy} onClick={()=>roundVote(true)}>↻ Jeszcze jedna runda słów</button>
                <button className="primary" disabled={busy} onClick={()=>roundVote(false)}>✓ Koniec — szukamy impostora</button>
              </div>}
          </section>}

          {state.status==="identify" && <section className="panel imp-stage imp-identity-stage">
            <div className="eyebrow">GŁOSOWANIE · {state.vote_round>1?"DOGRYWKA "+state.vote_round:"FAZA FINAŁOWA"}</div>
            <h2>Kto jest impostorem?</h2>
            <p>{state.vote_round>1?"Był remis! Głosujcie ponownie.":"Wybierz osobę, która Twoim zdaniem nie zna hasła."} Nie możesz głosować na siebie.</p>
            <div className="imp-vote-count">Oddane głosy: <strong>{state.votes_cast} / {players.length}</strong></div>
            {myVoteDone ? <div className="waiting-box">Zagłosowano. Czekamy na pozostałych…</div> :
              <div className="imp-suspect-grid">
                {players.filter(p=>!p.is_me).map(p=><button type="button" key={p.id} className="imp-suspect" disabled={busy} onClick={()=>suspectVote(p.id)}><span>{p.avatar}</span><strong>{p.name}</strong><small>Wskaż gracza</small></button>)}
              </div>}
          </section>}

          {state.status==="last_guess" && <section className="panel imp-stage imp-final-guess">
            <div className="eyebrow">◈ OSTATNIA SZANSA IMPOSTORA</div>
            <div className="imp-final-guess-icon" aria-hidden="true">⌑</div>
            <h2>{state.role==="impostor" ? "Zdemaskowano Cię. Znasz hasło?" : "Impostor został zdemaskowany!"}</h2>
            <p>{state.role==="impostor"
              ? "Gracze wskazali Cię poprawnie, ale możesz jeszcze wygrać. Odgadnij tajne hasło lub zrezygnuj z próby. Drobne literówki i brak polskich znaków są akceptowane."
              : "Wskazaliście "+(state.impostor_name||"impostora")+". Teraz ma jeszcze jedną szansę odgadnąć hasło. Jeśli się pomyli lub zrezygnuje, wygrywacie."}</p>
            {state.role==="impostor" && state.impostor_hint && <div className="imp-hint-card imp-final-hint">
              <span>✦ TWOJA PODPOWIEDŹ</span>
              <strong className="imp-association-word">{state.impostor_hint}</strong>
            </div>}
            {state.role==="impostor" ?
              <form onSubmit={makeGuess} className="imp-guess-form imp-final-guess-form">
                <input maxLength={80} autoComplete="off" value={guess} onChange={e=>setGuess(e.target.value)}
                  placeholder="Jak brzmi tajne hasło?" aria-label="Ostatnia próba odgadnięcia hasła"/>
                <div>
                  <button type="submit" className="primary" disabled={busy || !guess.trim()}>✦ Zgaduję hasło</button>
                  <button type="button" className="secondary" disabled={busy} onClick={declineFinalGuess}>Rezygnuję</button>
                </div>
              </form> :
              <div className="waiting-box">Czekamy na decyzję impostora: <strong>{state.impostor_name || "impostor"}</strong></div>}
          </section>}

          {state.status==="finished" && <section className={"panel imp-results"+(state.winner==="impostor"?" imp-winner":"")}>
            <div className="eyebrow">◈ KONIEC ROZGRYWKI</div>
            <span className="imp-trophy">{state.winner==="crew"?"🏆":"◈"}</span>
            <h2>{state.winner==="crew"?"GRACZE WYGRYWAJĄ!":"IMPOSTOR WYGRYWA!"}</h2>
            <p>{state.reason==="guessed"?"Impostor odgadł hasło w trakcie gry." :
              state.reason==="last_guess_correct"?"Impostor został wykryty, ale odgadł hasło w ostatniej chwili!" :
              state.reason==="caught"?"Ekipa poprawnie wskazała impostora, który nie odgadł hasła." :
              "Impostor uniknął wykrycia."}</p>
            <div className="imp-reveal-grid">
              <div><span>TAJNE HASŁO</span><strong>{state.secret_word}</strong></div>
              <div><span>IMPOSTOR</span><strong>{state.impostor_name}</strong></div>
              {state.selected_name && <div><span>WYBRANY GRACZ</span><strong>{state.selected_name}</strong></div>}
            </div>
            {state.is_host ? <button className="primary" disabled={busy} onClick={()=>rpc("imp_start",{p_code:room,p_token:token})}>Zagrajmy jeszcze raz ↻</button> : <div className="waiting-box">Czekamy na gospodarza, żeby rozpocząć rewanż.</div>}
          </section>}
          <button className="text-button imp-leave" onClick={leave}>← Opuść pokój</button>
        </>}
      </section>}
      {error && screen==="home" && <div className="alert home-alert">{error}</div>}
      {notice && screen==="home" && <div className="notice home-alert">{notice}</div>}
      </>}
    </main>
    <footer><span>IMPOSTOR<span className="brand-dot">.</span> — GRA DLA EKIPY</span><span>NIE UFAJ NIKOMU.</span></footer>
  </div>;
}
