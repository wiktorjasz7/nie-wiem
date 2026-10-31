import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import "./style.css";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key && !url.includes("TWOJ-PROJEKT") ? createClient(url, key) : null;
const AVATARS = ["😎","🐼","🦊","🐱","🐻","🐨","🐯","🐙","👽","🤖","👻","🦄","🐧","🦁","🐲","🍄","⚡","🔥","🐸","🐵","🐰","🐹","🐮","🐷","🐺","🐗","🦝","🦉","🦋","🐢","🐬","🦈","🦖","🦕","🐝","🐞","🦂","🦀","🦐","🐳","🦩","🦚","🦜","🦔","🐿️","🌵","🌻","🌈","🍀","🍉","🍓","🍕","🍩","🎃","👑","💀","👾","💎","🎸","🚀","🛸","⚽","🏀","🎮","🎧","🧸","🧙","🥷","🦸","🧛","🧟","👺","👹","🤡","🥶","🥳","😈","🤠","🤓","🥸","😺","🙈","💩","🫶","🧠"];
const CATEGORIES = ["Mieszane","Filmy i seriale","Gry","Jedzenie","Zwierzęta","Przedmioty","Postacie","Internet / memy","Sport","Muzyka","Marki","Polska","Technologia","Social media","Popularne teraz"];

function App() {
  const [screen, setScreen] = useState("home");
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("nie-wiem-theme") || "amethyst"; } catch { return "amethyst"; }
  });
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(() => { try { return localStorage.getItem("nie-wiem-avatar") || "😎"; } catch { return "😎"; } });
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get("room")?.toUpperCase() || "");
  const [category, setCategory] = useState("Mieszane");
  const [custom, setCustom] = useState("");
  const [room, setRoom] = useState("");
  const [token, setToken] = useState("");
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicSaved, setMusicSaved] = useState(() => {
    try { return localStorage.getItem("nie-wiem-music") === "on"; } catch { return false; }
  });
  const [musicVolume, setMusicVolume] = useState(() => {
    try { return Number(localStorage.getItem("nie-wiem-music-volume") ?? 0.25); } catch { return 0.25; }
  });
  const [sfxVolume, setSfxVolume] = useState(() => {
    try { return Number(localStorage.getItem("nie-wiem-sfx-volume") ?? 0.5); } catch { return 0.5; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("nie-wiem-theme", theme); } catch {}
  }, [theme]);

  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const previousGameState = useRef(null);

  const toggleMusic = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (musicEnabled) {
      audio.pause();
      setMusicEnabled(false);
      setMusicSaved(false);
      try { localStorage.setItem("nie-wiem-music", "off"); } catch {}
      return;
    }
    audio.volume = musicVolume;
    try {
      await audio.play();
      setMusicEnabled(true);
      setMusicSaved(true);
      try { localStorage.setItem("nie-wiem-music", "on"); } catch {}
    } catch {
      setError("Nie udało się odtworzyć muzyki. Sprawdź, czy plik public/audio/lobby.mp3 jest już w repozytorium.");
    }
  };

  const playSfx = (type) => {
    if (sfxVolume <= 0 || typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const notes = type === "point" ? [523, 659, 784] : type === "join" ? [440, 554] : [392];
      notes.forEach((frequency, index) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + index * 0.105;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, sfxVolume * 0.11), start + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.19);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.2);
      });
    } catch {}
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = musicVolume;
    try { localStorage.setItem("nie-wiem-music-volume", String(musicVolume)); } catch {}
  }, [musicVolume]);

  useEffect(() => {
    try { localStorage.setItem("nie-wiem-sfx-volume", String(sfxVolume)); } catch {}
  }, [sfxVolume]);

  useEffect(() => {
    if (celebrate) playSfx("point");
  }, [celebrate]);

  useEffect(() => {
    if (!celebrate) return;
    const timer = setTimeout(() => setCelebrate(false), 1750);
    return () => clearTimeout(timer);
  }, [celebrate]);

  useEffect(() => {
    if (!state) return;
    const previous = previousGameState.current;
    if (previous) {
      if (state.players.length > previous.players.length) playSfx("join");
      if (
        state.status === "playing" &&
        previous.current_player_name &&
        state.current_player_name &&
        previous.current_player_name !== state.current_player_name
      ) playSfx("turn");
    }
    previousGameState.current = state;
  }, [state]);

  const me = state?.players?.find(p => p.is_me);
  const myTurn = state?.current_player_is_me === true;
  const isHost = state?.is_host;
  const leaderboard = [...(state?.players || [])].sort((a,b) => b.score - a.score || a.seat - b.seat);

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

  const enter = async (data) => {
    try { localStorage.setItem("nie-wiem-avatar", avatar); } catch {}
    const { error: avatarError } = await supabase.rpc("set_player_avatar", { p_code: data.code, p_token: data.token, p_avatar: avatar });
    if (avatarError) setError(avatarError.message);
    setCode(data.code);
    setRoom(data.code);
    setToken(data.token);
    setScreen("room");
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
    if (data) setNotice(data.restarted ? "Nowa rozgrywka rozpoczęta! Powodzenia!" : "Gra rozpoczęta!");
  };
const advance = async (correct) => {
  if (!supabase) {
    setError("Brak połączenia z Supabase.");
    return;
  }

  setBusy(true);
  setError("");
  setNotice("");

  const { error } = await supabase.rpc("finish_turn", {
    p_code: room,
    p_token: token,
    p_correct: correct
  });

  setBusy(false);

  if (error) {
    setError(error.message);
    return;
  }

  setNotice(
    correct
      ? "Hasło odgadnięte! +1 punkt i dostajesz nowe hasło."
      : "Przekazano kolejkę."
  );

  if (correct) setCelebrate(true);
};
  const leave = () => {
    setScreen("home"); setRoom(""); setToken(""); setState(null); setError(""); setNotice("");
  };

  return <div className="app-shell">
    <audio ref={audioRef} src="/audio/lobby.mp3" loop preload="auto" />
    {celebrate && <div className="celebration" role="status" aria-live="polite">
      <div className="confetti" aria-hidden="true">{Array.from({length: 22}, (_, i) => <span key={i} style={{left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 45}ms`, transform: `rotate(${i * 29}deg)`}} />)}</div>
      <div className="celebration-card"><span className="celebration-check">✓</span><strong>ODGADNIĘTE!</strong><small>+1 PUNKT · NOWE HASŁO</small></div>
    </div>}
    <header className="topbar">
      <button className="brand" onClick={leave}><span className="brand-mark">?</span><span>CZÓŁKO<span className="brand-dot">.</span></span></button>
      <div className="topbar-tools">
        <label className="theme-picker">KOLORY
          <select className="theme-select" aria-label="Motyw kolorystyczny" value={theme} onChange={e=>setTheme(e.target.value)}>
            <option value="amethyst">💜 Amethyst</option>
            <option value="ocean">🌊 Ocean</option>
            <option value="forest">🌲 Forest</option>
            <option value="rose">🌹 Rose</option>
            <option value="sunset">🔥 Sunset</option>
            <option value="midnight">🖤 Midnight</option>
            <option value="cherry">🍒 Cherry</option>
            <option value="gold">✨ Gold</option>
            <option value="mint">🍃 Mint</option>
            <option value="ice">🧊 Ice</option>
            <option value="neon">💚 Neon</option>
            <option value="coral">🪸 Coral</option>
            <option value="berry">🫐 Berry</option>
            <option value="teal">🩵 Teal</option>
            <option value="blue">💠 Electric Blue</option>
            <option value="crimson">❤️ Crimson</option>
          </select>
        </label>
        <div className="audio-controls">
          <button className="audio-toggle" onClick={toggleMusic}>
            {musicEnabled ? "♫ Muzyka: ON" : musicSaved ? "♫ Wznów muzykę" : "♫ Włącz muzykę"}
          </button>
          <label className="audio-slider">MUZYKA
            <input aria-label="Głośność muzyki" type="range" min="0" max="1" step="0.01" value={musicVolume} onChange={e=>setMusicVolume(Number(e.target.value))}/>
          </label>
          <label className="audio-slider">EFEKTY
            <input aria-label="Głośność efektów dźwiękowych" type="range" min="0" max="1" step="0.01" value={sfxVolume} onChange={e=>setSfxVolume(Number(e.target.value))}/>
          </label>
        </div>
        <span className="top-tag">GRA TOWARZYSKA</span>
      </div>
    </header>
    <main>
      {screen === "home" && <section className="hero">
        <div className="eyebrow"><span className="pulse"></span> IMPREZOWA GRA MULTIPLAYER</div>
        <h1>Wiesz wszystko.<br/><em>Oprócz swojego hasła.</em></h1>
        <p className="intro">Dołącz do znajomych, zobacz ich hasła i spróbuj odkryć, kim lub czym jesteś.</p>
        <div className="panel home-panel">
          <div className="profile-setup">
            <div className="profile-name">
              <label>TWÓJ NICK</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="np. Wiktor" maxLength={18}/>
              <div className="profile-preview"><span className="profile-preview-avatar">{avatar}</span><span><small>TWÓJ PROFIL</small><strong>{name.trim() || "Gracz"}</strong></span></div>
            </div>
            <aside className="avatar-side-panel">
              <div className="avatar-panel-heading"><span>WYBIERZ AWATAR</span><small>{AVATARS.length} DO WYBORU</small></div>
              <select className="avatar-select" aria-label="Wybierz awatar" value={avatar} onChange={e=>setAvatar(e.target.value)}>{AVATARS.map(item => <option key={item} value={item}>{item} {item === "😎" ? "Klasyk" : "Awatar"}</option>)}</select>
            </aside>
          </div>
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
              {new URLSearchParams(window.location.search).has("room") && <p className="invite-hint">Masz zaproszenie! Kod pokoju został uzupełniony automatycznie.</p>}
              <button className="secondary" disabled={busy} onClick={joinRoom}>Dołącz do pokoju <span>→</span></button>
            </div>
          </div>
        </div>
        <div className="how"><span>01 / UTWÓRZ POKÓJ</span><span>02 / ZAPROŚ ZNAJOMYCH</span><span>03 / ZADAWAJ PYTANIA</span></div>
      </section>}

      {screen === "room" && <section className="room-wrap">
        <div className="room-heading"><div><div className="eyebrow">POKÓJ GRY</div><h1>{state?.status === "finished" ? "Mamy zwycięzcę!" : state?.status === "playing" ? "Czas zgadywać." : "Ekipa się zbiera."}</h1></div>
          <div className="room-code"><span>KOD DOŁĄCZENIA</span><strong>{room}</strong><button onClick={()=>navigator.clipboard?.writeText(room)}>KOPIUJ KOD</button><button onClick={()=>navigator.clipboard?.writeText(window.location.origin + "/?room=" + encodeURIComponent(room))}>KOPIUJ LINK ↗</button></div>
        </div>
        {error && <div className="alert">{error}</div>}
        {notice && <div className="notice">{notice}</div>}
        {!state ? <div className="panel loading">Ładowanie pokoju...</div> : <>
          <div className="panel players-panel">
            <div className="section-head"><div><span className="eyebrow">UCZESTNICY</span><h2>Gracze <span className="count">{state.players.length}</span></h2></div><span className="status">{state.status === "finished" ? "KONIEC GRY" : state.status === "playing" ? "GRA W TOKU" : "OCZEKIWANIE"}</span></div>
            <div className="players-grid">{state.players.map((p,i)=><div className={"player "+(p.is_me?"is-me":"")+(state.status === "playing" && p.name === state.current_player_name ? " is-current":"")} key={p.id}>
              <div className="avatar">{p.avatar || (p.name||"?").slice(0,1).toUpperCase()}</div><div className="player-info"><strong>{p.name} {p.is_me && <small>(TY)</small>}</strong><span>{p.score} pkt · {p.is_active ? "w grze" : "odgadł"}</span></div>
              {p.is_me && myTurn && <span className="my-turn-tag">TWOJA KOLEJ</span>}
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
          {state.status === "finished" && <div className="panel results-panel">
            <div className="results-heading"><div className="eyebrow">🏆 GRA ZAKOŃCZONA</div><h2>TRZY HASŁA. JEDEN ZWYCIĘZCA.</h2><p><strong>{state.winner_name || state.last_player_name}</strong> zdobywa 3 punkty i wygrywa grę!</p></div>
            <div className="podium">
              {leaderboard.slice(0,3).map((p,i)=><div className={"podium-place place-"+(i+1)} key={p.id}>
                <div className="podium-medal">{["🥇","🥈","🥉"][i]}</div>
                <div className="podium-avatar">{p.avatar || (p.name||"?").slice(0,1).toUpperCase()}</div>
                <strong>{p.name}</strong><span>{p.score} {p.score === 1 ? "punkt" : p.score < 5 ? "punkty" : "punktów"}</span>
                <div className="podium-block"><b>{i+1}</b></div>
              </div>)}
            </div>
            <div className="final-scores"><div className="eyebrow">KOŃCOWA TABELA WYNIKÓW</div>
              {leaderboard.map((p,i)=><div className="score-row" key={p.id}><span className="score-rank">{i+1}.</span><strong>{p.name}{p.is_me ? " (TY)" : ""}</strong><span>{p.score} pkt</span></div>)}
            </div>
            <div className="replay-actions">
              {isHost ? <button className="primary" onClick={start} disabled={busy}>Zagrajcie ponownie <span>↻</span></button> : <div className="waiting-box">Czekamy, aż gospodarz rozpocznie rewanż…</div>}
              <p className="results-note">Wszyscy zostajecie w tym samym pokoju — kod i skład ekipy się nie zmieniają.</p>
            </div>
          </div>}
          <button className="text-button" onClick={leave}>← Opuść pokój</button>
        </>}
      </section>}
      {error && screen === "home" && <div className="alert home-alert">{error}</div>}
    </main>
    <footer><span>Czółko<span className="brand-dot">.</span> — WERSJA TESTOWA</span><span>GRAJ FAIR. ŚMIEJ SIĘ GŁOŚNO.</span></footer>
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);
