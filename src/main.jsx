import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import "./style.css";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key && !url.includes("TWOJ-PROJEKT") ? createClient(url, key) : null;
const AVATARS = ["😎","🐼","🦊","🐱","🐻","🐨","🐯","🐙","👽","🤖","👻","🦄","🐧","🦁","🐲","🍄","⚡","🔥","🐸","🐵","🐰","🐹","🐮","🐷","🐺","🐗","🦝","🦉","🦋","🐢","🐬","🦈","🦖","🦕","🐝","🐞","🦂","🦀","🦐","🐳","🦩","🦚","🦜","🦔","🐿️","🌵","🌻","🌈","🍀","🍉","🍓","🍕","🍩","🎃","👑","💀","👾","💎","🎸","🚀","🛸","⚽","🏀","🎮","🎧","🧸","🧙","🥷","🦸","🧛","🧟","👺","👹","🤡","🥶","🥳","😈","🤠","🤓","🥸","😺","🙈","💩","🫶","🧠"];
const CATEGORIES = ["Mieszane","Filmy i seriale","Gry","Jedzenie","Zwierzęta","Przedmioty","Postacie","Internet / memy","Sport","Muzyka","Marki","Polska","Technologia","Social media","Popularne teraz"];
const SESSION_KEY = "czolko-room-session-v1";
const clearSavedSession = () => { try { localStorage.removeItem(SESSION_KEY); } catch {} };
const getSavedSession = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    const invitedCode = new URLSearchParams(window.location.search).get("room")?.toUpperCase();
    if (!saved || !/^[A-Z0-9]{5,6}$/.test(saved.code) || typeof saved.token !== "string") return null;
    if (invitedCode && invitedCode !== saved.code) return null;
    return saved;
  } catch { return null; }
};

function App() {
  const [screen, setScreen] = useState("home");
  const [restoring, setRestoring] = useState(() => !!getSavedSession());
  const [revealedWord, setRevealedWord] = useState(null);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("nie-wiem-theme") || "amethyst"; } catch { return "amethyst"; }
  });
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(() => { try { return localStorage.getItem("nie-wiem-avatar") || "😎"; } catch { return "😎"; } });
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get("room")?.toUpperCase() || "");
  const [category, setCategory] = useState("Mieszane");
  const [difficulty, setDifficulty] = useState("normal");
  const [targetScore, setTargetScore] = useState(3);
  const [gameMode, setGameMode] = useState("individual");
  const [modifiers, setModifiers] = useState({ double_points: false, chaos: false });
  const [custom, setCustom] = useState("");
  const [room, setRoom] = useState("");
  const [token, setToken] = useState("");
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [winnerCelebration, setWinnerCelebration] = useState(false);
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

  useEffect(() => {
    const saved = getSavedSession();
    if (!saved || !supabase) { setRestoring(false); return; }
    let alive = true;
    const restore = async () => {
      const { data, error } = await supabase.rpc("get_game_state", { p_code: saved.code, p_token: saved.token });
      if (!alive) return;
      if (!error && data?.players?.some(p => p.is_me)) {
        setCode(saved.code);
        setName(saved.name || "");
        setRoom(saved.code);
        setToken(saved.token);
        setState(data);
        previousGameState.current = data;
        setScreen("room");
      } else {
        if (error && /Nie należysz do tego pokoju|Nie znaleziono pokoju/i.test(error.message)) {
          clearSavedSession();
          setNotice("Poprzedni pokój nie jest już dostępny.");
        } else {
          setNotice("Nie udało się teraz przywrócić pokoju. Odśwież stronę, żeby spróbować ponownie.");
        }
      }
      setRestoring(false);
    };
    restore();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!revealedWord) return;
    const timer = setTimeout(() => setRevealedWord(null), 7500);
    const onKey = event => { if (event.key === "Escape") setRevealedWord(null); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(timer); window.removeEventListener("keydown", onKey); };
  }, [revealedWord]);

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
      const notes = type === "win" ? [523, 659, 784, 1047, 1319] : type === "start" ? [392, 523, 659] : type === "point" ? [523, 659, 784] : type === "join" ? [440, 554] : [392];
      notes.forEach((frequency, index) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + index * (type === "win" ? 0.14 : type === "start" ? 0.09 : 0.105);
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, sfxVolume * 0.11), start + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + (type === "win" ? 0.48 : type === "start" ? 0.28 : 0.19));
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(start);
        oscillator.stop(start + (type === "win" ? 0.5 : type === "start" ? 0.3 : 0.2));
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
    if (!winnerCelebration) return;
    const timer = setTimeout(() => setWinnerCelebration(false), 4600);
    return () => clearTimeout(timer);
  }, [winnerCelebration]);

  useEffect(() => {
    if (!state) return;
    const previous = previousGameState.current;
    if (previous?.status === "playing" && state.status === "finished") {
      setWinnerCelebration(true);
      playSfx("win");
    }
    if (previous?.status === "finished" && state.status === "playing") setWinnerCelebration(false);
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
  const teamLeaderboard = ["A","B"].map(team => {
    const members = (state?.players || []).filter(p => p.team === team);
    return { team, name: "Drużyna " + team, members, score: members.reduce((sum,p) => sum + p.score, 0), avatar: members[0]?.avatar || "👥" };
  }).filter(team => team.members.length).sort((a,b) => b.score - a.score || a.team.localeCompare(b.team));
  const myTeam = state?.game_mode === "teams" ? teamLeaderboard.find(t => t.team === me?.team) : null;
  const teamsReady = state?.game_mode !== "teams" || (
    state.players.every(p => p.team === "A" || p.team === "B") &&
    state.players.some(p => p.team === "A") &&
    state.players.some(p => p.team === "B")
  );

  useEffect(() => {
    if (!room || !token || !supabase) return;
    let alive = true;
    const refresh = async () => {
      const { data, error } = await supabase.rpc("get_game_state", { p_code: room, p_token: token });
      if (!alive) return;
      if (error) {
        if (/Nie należysz do tego pokoju|Nie znaleziono pokoju/i.test(error.message)) {
          clearSavedSession();
          previousGameState.current = null;
          setState(null);
          setRoom("");
          setToken("");
          setScreen("home");
          setRevealedWord(null);
          setError("Nie masz już dostępu do tego pokoju — możliwe, że gospodarz Cię usunął.");
        } else {
          setError(error.message);
        }
      } else { setState(data); setError(""); }
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
    try {
      localStorage.setItem("nie-wiem-avatar", avatar);
      localStorage.setItem(SESSION_KEY, JSON.stringify({ code: data.code, token: data.token, name: name.trim() }));
    } catch {}
    previousGameState.current = null;
    setState(null);
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
    const data = await run("create_room", { p_name: name.trim(), p_category: category, p_custom_words: words, p_target_score: targetScore, p_game_mode: gameMode, p_modifiers: { ...modifiers, difficulty } });
    if (data) enter(data);
  };
  const joinRoom = async () => {
    if (!name.trim() || !code.trim()) return setError("Wpisz nick i kod pokoju.");
    const data = await run("join_room", { p_name: name.trim(), p_code: code.trim().toUpperCase() });
    if (data) enter(data);
  };
  const start = async () => {
    playSfx("start");
    const data = await run("start_game", { p_code: room, p_token: token });
    if (data) setNotice(data.restarted ? "Nowa rozgrywka rozpoczęta! Powodzenia!" : "Gra rozpoczęta!");
  };
  const chooseTeam = async selectedTeam => {
    if (busy || me?.team === selectedTeam) return;
    const data = await run("choose_team", { p_code: room, p_token: token, p_team: selectedTeam });
    if (data) {
      setState(prev => prev ? ({ ...prev, players: prev.players.map(p => p.is_me ? { ...p, team: selectedTeam } : p) }) : prev);
      setNotice("Wybrano drużynę " + selectedTeam + ".");
    }
  };
  const kickPlayer = async player => {
    if (busy || !window.confirm("Wyrzucić gracza „" + player.name + "” z pokoju?")) return;
    const data = await run("kick_player", { p_code: room, p_token: token, p_player_id: player.id });
    if (data) {
      setState(prev => prev ? ({ ...prev, players: prev.players.filter(p => p.id !== player.id) }) : prev);
      setNotice("Gracz „" + player.name + "” został usunięty z pokoju.");
    }
  };
const advance = async (correct, skipWord = false) => {
  if (!supabase) {
    setError("Brak połączenia z Supabase.");
    return;
  }

  setBusy(true);
  setError("");
  setNotice("");

  const { data, error } = await supabase.rpc("finish_turn", {
    p_code: room,
    p_token: token,
    p_correct: correct,
    p_skip: skipWord
  });

  setBusy(false);

  if (error) {
    setError(error.message);
    return;
  }

  setNotice(data?.last_chance_used ? "OSTATNIA SZANSA! Możesz spróbować jeszcze raz — kolejka zostaje u Ciebie." : skipWord ? `Hasło pominięte. ${data?.points_deducted ? "-1 pkt" : "bez utraty punktu (masz 0 pkt)"} — dostajesz nowe hasło.` : correct ? `Hasło odgadnięte! +${data?.points_awarded || 1} pkt — dostajesz nowe hasło.` : "Przekazano kolejkę.");

  if (skipWord && typeof data?.skipped_word === "string" && data.skipped_word.trim()) {
    setRevealedWord({ word: data.skipped_word.trim(), pointsDeducted: !!data.points_deducted });
  }
  if (correct) setCelebrate(true);
};
  const leave = () => {
    clearSavedSession();
    previousGameState.current = null;
    setRevealedWord(null);
    setScreen("home"); setRoom(""); setToken(""); setState(null); setError(""); setNotice("");
  };

  return <div className="app-shell">
    <audio ref={audioRef} src="/audio/lobby.mp3" loop preload="auto" />
    {revealedWord && <div className="skipped-reveal-backdrop" role="dialog" aria-modal="true" aria-label="Odkryte pominięte hasło">
      <div className="skipped-reveal-card">
        <span className="skipped-reveal-eyebrow">👀 TO BYŁO TWOJE HASŁO</span>
        <strong>{revealedWord.word}</strong>
        <p>{revealedWord.pointsDeducted ? "Hasło pominięte · −1 punkt" : "Hasło pominięte · 0 punktów straty"}</p>
        <button className="primary" onClick={() => setRevealedWord(null)}>Okej, już wiem! ✕</button>
        <small>To hasło jest już nieaktualne. Nowe nadal pozostaje tajemnicą.</small>
      </div>
    </div>}
    {winnerCelebration && <div className="winner-celebration" role="status" aria-live="polite">
      <div className="winner-rays" aria-hidden="true"></div>
      <div className="winner-confetti" aria-hidden="true">{Array.from({length: 54}, (_, i) => <span key={i} style={{left: `${(i * 29) % 100}%`, animationDelay: `${(i % 12) * 55}ms`, transform: `rotate(${i * 37}deg)`}} />)}</div>
      <div className="winner-card"><div className="winner-crown">♛</div><small>TAK SIĘ ZOSTAJE LEGENDĄ</small><strong>{state?.winner_name || state?.last_player_name || "Zwycięzca"}!</strong><span>🏆 ZWYCIĘSTWO 🏆</span></div>
    </div>}
    {celebrate && <div className="celebration" role="status" aria-live="polite">
      <div className="confetti" aria-hidden="true">{Array.from({length: 22}, (_, i) => <span key={i} style={{left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 45}ms`, transform: `rotate(${i * 29}deg)`}} />)}</div>
      <div className="celebration-card"><span className="celebration-check">✓</span><strong>ODGADNIĘTE!</strong><small>PUNKTY · NOWE HASŁO</small></div>
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
      {restoring && <div className="panel loading restore-status" role="status">Przywracanie Twojego pokoju…</div>}
      {!restoring && screen === "home" && <section className="hero">
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
              <button type="button" className="avatar-picker-toggle" aria-expanded={avatarPickerOpen} onClick={()=>setAvatarPickerOpen(open=>!open)}>
                <span className="avatar-panel-heading"><span>WYBIERZ AWATAR</span><small>{AVATARS.length} DO WYBORU</small></span>
                <span className="avatar-toggle-current">{avatar}</span><span className="avatar-toggle-arrow">{avatarPickerOpen ? "⌃" : "⌄"}</span>
              </button>
              {avatarPickerOpen && <div className="avatar-picker" aria-label="Dostępne awatary">
                {AVATARS.map(item=><button type="button" key={item} aria-label={`Wybierz awatar ${item}`} aria-pressed={avatar===item} className={"avatar-choice"+(avatar===item?" selected":"")} onClick={()=>{setAvatar(item);setAvatarPickerOpen(false);}}>{item}</button>)}
              </div>}
            </aside>
          </div>
          <div className="home-actions">
            <div className="action-card">
              <div className="action-icon">✦</div><h2>Stwórz pokój</h2><p>Ty jesteś gospodarzem. Zaproś ekipę kodem.</p>
              <label>KATEGORIA</label>
              <select value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
              <label>POZIOM TRUDNOŚCI HASEŁ</label>
              <select value={difficulty} onChange={e=>setDifficulty(e.target.value)}>
                <option value="easy">Łatwy</option>
                <option value="normal">Normalny</option>
                <option value="hard">Trudny</option>
              </select>
              <label>TRYB GRY</label>
              <select value={gameMode} onChange={e=>setGameMode(e.target.value)}>
                <option value="individual">Każdy na siebie</option>
                <option value="teams">Drużynowy — 2 ekipy</option>
              </select>
              <label>ILE PUNKTÓW DO ZWYCIĘSTWA?</label>
              <select value={targetScore} onChange={e=>setTargetScore(Number(e.target.value))}>
                {[1,3,5,7,10].map(n=><option key={n} value={n}>{n} {n === 1 ? "punkt" : n < 5 ? "punkty" : "punktów"}</option>)}
              </select>
              <div className="modifier-section">
                <div className="modifier-heading"><span>✦ DODATKOWE MODYFIKACJE</span><small>WYBIERZ DOWOLNĄ LICZBĘ</small></div>
                <div className="modifier-grid">
                  <label className={"modifier-option"+(modifiers.double_points?" selected":"")}><input type="checkbox" checked={modifiers.double_points} onChange={e=>setModifiers(v=>({...v,double_points:e.target.checked}))}/><span className="modifier-icon">✦</span><span><strong>Podwójne punkty</strong><small>Każde poprawne odgadnięcie daje 2 punkty.</small></span></label>
                  <label className={"modifier-option chaos-option"+(modifiers.chaos?" selected":"")}><input type="checkbox" checked={modifiers.chaos} onChange={e=>setModifiers(v=>({...v,chaos:e.target.checked}))}/><span className="modifier-icon">☄</span><span><strong>CHAOS</strong><small>Co 3 tury losuje się specjalne wydarzenie.</small></span></label>
                </div>
                {modifiers.chaos && <div className="chaos-pool"><strong>W PULI CHAOSU:</strong><span>Zakazane pytanie</span><span>Zmiana perspektywy</span><span>Królewski bonus</span><span>Ostatnia szansa</span><span>Błyskawica</span></div>}
              </div>
              <label>WŁASNE HASŁA <small>(opcjonalnie, oddziel przecinkami lub enterem; dostępne na każdym poziomie)</small></label>
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

      {!restoring && screen === "room" && <section className="room-wrap">
        <div className="room-heading"><div><div className="eyebrow">POKÓJ GRY</div><h1>{state?.status === "finished" ? "Mamy zwycięzcę!" : state?.status === "playing" ? "Czas zgadywać." : "Ekipa się zbiera."}</h1></div>
          <div className="room-code"><span>{state?.game_mode === "teams" ? "TRYB DRUŻYNOWY" : "TRYB INDYWIDUALNY"} · {({easy:"ŁATWE",normal:"NORMALNE",hard:"TRUDNE"})[state?.modifiers?.difficulty] || "MIESZANE"} HASŁA · CEL: {state?.target_score || 3} PKT</span><span>KOD DOŁĄCZENIA</span><strong>{room}</strong><button onClick={()=>navigator.clipboard?.writeText(room)}>KOPIUJ KOD</button><button onClick={()=>navigator.clipboard?.writeText(window.location.origin + "/?room=" + encodeURIComponent(room))}>KOPIUJ LINK ↗</button></div>
        </div>
        {error && <div className="alert">{error}</div>}
        {notice && <div className="notice">{notice}</div>}
        {!state ? <div className="panel loading">Ładowanie pokoju...</div> : <>
          <div className="panel players-panel">
            <div className="section-head"><div><span className="eyebrow">UCZESTNICY</span><h2>Gracze <span className="count">{state.players.length}</span></h2></div><span className="status">{state.status === "finished" ? "KONIEC GRY" : state.status === "playing" ? "GRA W TOKU" : "OCZEKIWANIE"}</span></div>
            <div className="players-grid">{state.players.map((p,i)=><div className={"player "+(p.is_me?"is-me":"")+(state.status === "playing" && (p.is_current === true || (state.current_turn != null && Number(p.seat) === Number(state.current_turn))) ? " turn-active":"")} key={p.id}>
              <div className="avatar">{p.avatar || (p.name||"?").slice(0,1).toUpperCase()}</div><div className="player-info"><strong>{p.name} {p.is_me && <small>(TY)</small>}</strong><span>{p.score} pkt · {p.is_active ? "w grze" : "odgadł"}</span>{state.game_mode === "teams" && (p.team ? <small className={"team-tag team-"+p.team}>DRUŻYNA {p.team}</small> : <small className="team-tag team-unassigned">BEZ DRUŻYNY</small>)}</div>
              {state.status === "playing" && (p.is_current === true || (state.current_turn != null && Number(p.seat) === Number(state.current_turn))) && <span className="my-turn-tag">{p.is_me ? "TWOJA KOLEJ" : "TERAZ GRA"}</span>}
              {isHost && !p.is_me && (state.status === "waiting" || state.status === "playing") && <button className="kick-player-button" type="button" disabled={busy || (state.status === "playing" && state.players.length <= 2)} onClick={() => kickPlayer(p)}>Wyrzuć</button>}
              {state.status !== "waiting" && p.is_active && <div className="word">{(state.game_mode === "teams" && p.team === me?.team) || p.is_me ? <><span className="question">?</span><small>{state.game_mode === "teams" ? "WASZE HASŁO" : "TWOJE HASŁO"}</small></> : <><strong>{p.word}</strong><small>{state.game_mode === "teams" ? "HASŁO DRUŻYNY" : "HASŁO GRACZA"}</small></>}</div>}
            </div>)}</div>
            {state.status === "waiting" && state.game_mode === "teams" && <div className="team-choice-panel">
              <div className="eyebrow">WYBIERZ SWOJĄ DRUŻYNĘ</div>
              <p>Każdy wybiera ekipę, do której chce dołączyć. Możesz zmienić wybór do rozpoczęcia gry.</p>
              <div className="team-choice-actions">
                {["A", "B"].map(team => <button key={team} type="button" className={"team-choice-button team-choice-"+team+(me?.team === team ? " selected" : "")} aria-pressed={me?.team === team} disabled={busy} onClick={() => chooseTeam(team)}>
                  <strong>{me?.team === team ? "✓ " : ""}Drużyna {team}</strong>
                  <small>{state.players.filter(p => p.team === team).length} graczy</small>
                </button>)}
              </div>
              {isHost && !teamsReady && <div className="team-choice-warning">Przed startem każdy musi wybrać drużynę, a w obu ekipach musi być co najmniej jedna osoba.</div>}
            </div>}
            {state.status === "waiting" && <div className="lobby-footer"><p>{state.game_mode === "teams" ? "Tryb drużynowy: każda ekipa dostaje jedno wspólne hasło, którego nie widzi." : state.players.length < 3 ? "Najlepiej gra się w 3–8 osób. Możecie zacząć już od 2." : "Ekipa gotowa. Niech rozpocznie się zgadywanie."}</p>{isHost ? <button className="primary" disabled={busy || state.players.length < 2 || !teamsReady} onClick={start}>Rozpocznij grę <span>→</span></button> : <span className="waiting">Czekamy na gospodarza…</span>}</div>}
          </div>
          {state.status === "playing" && <div className="panel turn-panel">
            <div className="eyebrow">AKTUALNA KOLEJKA</div>
            <h2>{state.current_player_name || "Gracz"} {myTurn ? "— Twoja kolej!" : "zadaje pytanie"}</h2>
            {state.active_event && <div className={"chaos-event chaos-"+state.active_event}><span>☄ WYDARZENIE CHAOSU</span><strong>{{forbidden_question:"ZAKAZANE PYTANIE",perspective:"ZMIANA PERSPEKTYWY",kings_bonus:"KRÓLEWSKI BONUS",last_chance:"OSTATNIA SZANSA",lightning:"BŁYSKAWICA",}[state.active_event]}</strong><p>{{forbidden_question:"Przez tę turę nie zaczynaj pytań od «Czy to…».",perspective:"Zadawaj pytania z zupełnie innej perspektywy.",kings_bonus:"Poprawne odgadnięcie daje podwójne punkty.",last_chance:"Jeśli przekażesz kolejkę, dostajesz jeszcze jedną próbę.",lightning:"Następne poprawne odgadnięcie daje podwójne punkty.",}[state.active_event]}</p></div>}
            <p>{myTurn ? <>Zadawaj pytania na głos. {state.game_mode === "teams" ? "Twoja drużyna wspólnie zgaduje jedno hasło, a przeciwnicy widzą je i odpowiadają TAK lub NIE." : "Pozostali gracze widzą Twoje hasło i odpowiadają TAK lub NIE."} Możesz przekazać kolejkę albo spróbować odgadnąć hasło.</> : "Odpowiadaj TAK lub NIE na pytania aktualnego gracza. Twoja kolej nadejdzie później."}</p>{state.game_mode === "teams" && <div className="team-score-strip">{teamLeaderboard.map(team=><span key={team.team} className={"team-progress team-"+team.team}><strong>{team.name}</strong><b>{team.score} / {state.target_score || 3} PKT</b></span>)}</div>}
            {myTurn ? <div className="turn-actions"><button className="primary" onClick={()=>advance(true)} disabled={busy}>{state.game_mode === "teams" ? "Odgadłem! Punkty dla drużyny" : "Odgadłem hasło! Punkty"}</button><button className="secondary" onClick={()=>advance(false)} disabled={busy}>Przekaż kolejkę →</button><button className="secondary skip-word-button" onClick={()=>advance(false, true)} disabled={busy}>Pomiń hasło <span>−1 pkt</span></button></div> : <div className="waiting-box">Teraz pytanie zadaje: <strong>{state.current_player_name}</strong></div>}
          </div>}
          {state.status === "finished" && <div className="panel results-panel">
            <div className="results-heading"><div className="eyebrow">🏆 GRA ZAKOŃCZONA</div><h2>{state.game_mode === "teams" ? "ZWYCIĘSTWO DRUŻYNY!" : (state.target_score || 3) + " PUNKTÓW. JEDEN ZWYCIĘZCA."}</h2><p><strong>{state.winner_name || state.last_player_name}</strong> {state.game_mode === "teams" ? "zdobywa zwycięstwo dla całej ekipy!" : "zdobywa " + (state.target_score || 3) + " pkt i wygrywa grę!"}</p></div>
            <div className={"podium"+(state.game_mode === "teams" ? " team-podium" : "")}>
              {(state.game_mode === "teams" ? teamLeaderboard : leaderboard.slice(0,3)).map((item,i)=><div className={"podium-place place-"+(i+1)} key={state.game_mode === "teams" ? item.team : item.id}>
                <div className="podium-medal">{["🥇","🥈","🥉"][i]}</div>
                <div className="podium-avatar">{state.game_mode === "teams" ? item.avatar : (item.avatar || (item.name||"?").slice(0,1).toUpperCase())}</div>
                <strong>{state.game_mode === "teams" ? item.name : item.name}</strong><span>{item.score} {item.score === 1 ? "punkt" : item.score < 5 ? "punkty" : "punktów"}</span>
                <div className="podium-block"><b>{i+1}</b></div>
              </div>)}
            </div>
            <div className="final-scores"><div className="eyebrow">{state.game_mode === "teams" ? "WYNIKI DRUŻYN" : "KOŃCOWA TABELA WYNIKÓW"}</div>
              {state.game_mode === "teams"
                ? teamLeaderboard.map((team,i)=><div className="score-row" key={team.team}><span className="score-rank">{i+1}.</span><strong>{team.name} · {team.members.map(p=>p.name).join(", ")}</strong><span>{team.score} pkt</span></div>)
                : leaderboard.map((p,i)=><div className="score-row" key={p.id}><span className="score-rank">{i+1}.</span><strong>{p.name}{p.is_me ? " (TY)" : ""}</strong><span>{p.score} pkt</span></div>)}
            </div>
            <div className="replay-actions">
              {isHost ? <button className="primary" onClick={start} disabled={busy}>Zagrajcie ponownie <span>↻</span></button> : <div className="waiting-box">Czekamy, aż gospodarz rozpocznie rewanż…</div>}
              <p className="results-note">Wszyscy zostajecie w tym samym pokoju — kod i skład ekipy się nie zmieniają.</p>
            </div>
          </div>}
          <button className="text-button" onClick={leave}>← Opuść pokój</button>
        </>}
      </section>}
      {!restoring && error && screen === "home" && <div className="alert home-alert">{error}</div>}
      {!restoring && notice && screen === "home" && <div className="notice home-alert">{notice}</div>}
    </main>
    <footer><span>Czółko<span className="brand-dot">.</span> — WERSJA TESTOWA</span><span>GRAJ FAIR. ŚMIEJ SIĘ GŁOŚNO.</span></footer>
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);
