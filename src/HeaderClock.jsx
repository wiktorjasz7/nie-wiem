import React, { useEffect, useState } from "react";
import "./clock.css";

const formatTime = () => new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

export default function HeaderClock() {
  const [time, setTime] = useState(formatTime);
  useEffect(() => {
    const interval = window.setInterval(() => setTime(formatTime()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return <div className="header-clock" role="timer" aria-label={"Aktualna godzina: " + time} title="Twój lokalny czas">
    <span className="header-clock-led" aria-hidden="true" />
    <span className="header-clock-digits">{time}</span>
  </div>;
}
