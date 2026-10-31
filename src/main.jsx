import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import "./style.css";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key && !url.includes("TWOJ-PROJEKT") ? createClient(url, key) : null;
const CATEGORIES = ["Mieszane", "Filmy i seriale", "Gry", "Jedzenie", "Zwierzęta", "Przedmioty", "Postacie", "Internet / memy"];

function App() {
  const [screen, setScreen] = useState("home");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("Mieszane");
  const [custom, setCustom] = useState("");
  const [room, setRoom] = useState("");
  const [token, setToken] = useState("");
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const me = state?.players?.find(p => p.is_me);
  const myTurn = state?.current_player_is_me === true;
  const isHost = state?.is_host;

  useEffect(() => {
    if (!room || !token || !supabase) return;
    let alive = true;
    const refresh = async () => {
      const { data, error } = await supabase.rpc("get_game_state", { p_code: room, p_token: token });
      if (!alive) return;
      if (error) setError(error.message);
      else { setState(data); setError(""); }
    };
    refresh();
    const timer = setInterval(refresh, 1800);
    return () => { alive = false; clearInterval(timer); };
  }, [room, token]);

  const run = async (fn, args) => {
    if (!supabase) { setError("Najpierw skonfiguruj Supabase — instrukcja jest w README."); return null; }
    setBusy(true); setError(""); setNotice("");
    const { data, error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setError(error.message); return null; }
    return data;
  };

  const enter = (data) => {
    setRoom(data.code); setToken(data.token); setScreen("room");
    setCode(data.code);
  };

  const createRoom = async () => {
    if (!name.trim()) return setError("Wpisz swój nick.");
    const words = custom.split(/[\n,;]/).map(x => x.trim()).filter(Boolean);
    const data = await run("create_room", { p_name: name.trim(), p_category: category, p_custom_words: words });
    if (data) enter(data);
  };
  const joinRoom = async () => {
    if (!name.trim() || !code.trim()) return setError("Wpisz nick i kod pokoju.");
    const data = await run("join_room", { p_name: name.trim(), p_code: code.trim().toUpperCase() });
    if (data) enter(data);
  };
  const start = async () => {
    const data = await run("start_game", { p_code: room, p_token: token });
    if (data) setNotice("Gra rozpoczęta!");
  };
  const advance = async (correct) => {
    const data = await run("finish_turn", { p_code: room, p_token: token, p_correct: correct });
    if (data) setNotice(correct ? "Hasło odgadnięte! +1 punkt i dostajesz nowe hasło." : "Przekazano kolejkę.");
  };
  const leave = () => {
    setScreen("home"); setRoom(""); setToken(""); setState(null); setError(""); setNotice("");
  };

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={leave}><span className="brand-mark">?</span><span>NIE WIEM<span className="brand-dot">.</span></span></button>
      <span className="top-tag">GRA TOWARZYSKA</span>
    </header>
    <main>
      {screen === "home" && <section className="hero">
        <div className="eyebrow"><span className="pulse"></span> IMPREZOWA GRA MULTIPLAYER</div>
        <h1>Wiesz wszystko.<br/><em>Oprócz swojego hasła.</em></h1>
        <p className="intro">Dołącz do znajomych, zobacz ich hasła i spróbuj odkryć, kim lub czym jesteś.</p>
        <div className="panel home-panel">
          <label>TWÓJ NICK</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="np. Wiktor" maxLength={18}/>
          <div className="home-actions">
            <div className="action-card">
              <div className="action-icon">✦</div><h2>Stwórz pokój</h2><p>Ty jesteś gospodarzem. Zaproś ekipę kodem.</p>
              <label>KATEGORIA</label>
              <select value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
              <label>WŁASNE HASŁA <small>(opcjonalnie, oddziel przecinkami lub enterem)</small></label>
              <textarea value={custom} onChange={e=>setCustom(e.target.value)} placeholder="np. wasz nauczyciel&#10;śmieszny tekst z grupy" rows="3"/>
              <button className="primary" disabled={busy} onClick={createRoom}>{busy ? "Chwila..." : "Utwórz pokój"} <span>→</span></button>
            </div>
            <div className="action-card join-card">
              <div className="action-icon">↗</div><h2>Dołącz do gry</h2><p>Masz kod od znajomego? Wbijaj.</p>
              <label>KOD POKOJU</label>
              <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="np. K7P9Q" maxLength={6}/>
              <button className="secondary" disabled={busy} onClick={joinRoom}>Dołącz do pokoju <span>→</span></button>
            </div>
          </div>
        </div>
        <div className="how"><span>01 / UTWÓRZ POKÓJ</span><span>02 / ZAPROŚ ZNAJOMYCH</span><span>03 / ZADAWAJ PYTANIA</span></div>
      </section>}

      {screen === "room" && <section className="room-wrap">
        <div className="room-heading"><div><div className="eyebrow">POKÓJ GRY</div><h1>{state?.status === "finished" ? "Koniec gry." : state?.status === "playing" ? "Czas zgadywać." : "Ekipa się zbiera."}</h1></div>
          <div className="room-code"><span>KOD DOŁĄCZENIA</span><strong>{room}</strong><button onClick={()=>navigator.clipboard?.writeText(room)}>KOPIUJ</button></div>
        </div>
        {error && <div className="alert">{error}</div>}
        {notice && <div className="notice">{notice}</div>}
        {!state ? <div className="panel loading">Ładowanie pokoju...</div> : <>
          <div className="panel players-panel">
            <div className="section-head"><div><span className="eyebrow">UCZESTNICY</span><h2>Gracze <span className="count">{state.players.length}</span></h2></div><span className="status">{state.status === "finished" ? "KONIEC GRY" : state.status === "playing" ? "GRA W TOKU" : "OCZEKIWANIE"}</span></div>
            <div className="players-grid">{state.players.map((p,i)=><div className={"player "+(p.is_me?"is-me":"")} key={p.id}>
              <div className="avatar">{(p.name||"?").slice(0,1).toUpperCase()}</div><div className="player-info"><strong>{p.name} {p.is_me && <small>(TY)</small>}</strong><span>{p.score} pkt · {p.is_active ? "w grze" : "odgadł"}</span></div>
              {state.status !== "waiting" && p.is_active && <div className="word">{p.is_me ? <><span className="question">?</span><small>TWOJE HASŁO</small></> : <><strong>{p.word}</strong><small>HASŁO GRACZA</small></>}</div>}
            </div>)}</div>
            {state.status === "waiting" && <div className="lobby-footer"><p>{state.players.length < 3 ? "Najlepiej gra się w 3–8 osób. Możecie zacząć już od 2." : "Ekipa gotowa. Niech rozpocznie się zgadywanie."}</p>{isHost ? <button className="primary" disabled={busy || state.players.length < 2} onClick={start}>Rozpocznij grę <span>→</span></button> : <span className="waiting">Czekamy na gospodarza…</span>}</div>}
          </div>
          {state.status === "playing" && <div className="panel turn-panel">
            <div className="eyebrow">AKTUALNA KOLEJKA</div>
            <h2>{state.current_player_name || "Gracz"} {myTurn ? "— Twoja kolej!" : "zadaje pytanie"}</h2>
            <p>{myTurn ? "Zadawaj pytania na głos. Pozostali gracze widzą Twoje hasło i odpowiadają TAK lub NIE. Możesz przekazać kolejkę albo spróbować odgadnąć hasło." : "Odpowiadaj TAK lub NIE na pytania aktualnego gracza. Twoja kolej nadejdzie później."}</p>
            {myTurn ? <div className="turn-actions"><button className="primary" onClick={()=>advance(true)} disabled={busy}>Odgadłem hasło! +1 pkt</button><button className="secondary" onClick={()=>advance(false)} disabled={busy}>Przekaż kolejkę →</button></div> : <div className="waiting-box">Teraz pytanie zadaje: <strong>{state.current_player_name}</strong></div>}
          </div>}
          {state.status === "finished" && <div className="panel turn-panel"><div className="eyebrow">GRA ZAKOŃCZONA</div><h2>{state.last_player_name ? `${state.last_player_name} nie odgadł hasła` : "Wszyscy odgadli hasła!"}</h2><p>Gratulacje dla zwycięzców! Wyniki są widoczne na liście graczy.</p></div>}
          <button className="text-button" onClick={leave}>← Opuść pokój</button>
        </>}
      </section>}
      {error && screen === "home" && <div className="alert home-alert">{error}</div>}
    </main>
    <footer><span>NIE WIEM<span className="brand-dot">.</span> — WERSJA TESTOWA</span><span>GRAJ FAIR. ŚMIEJ SIĘ GŁOŚNO.</span></footer>
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);
