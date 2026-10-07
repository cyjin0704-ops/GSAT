import { useEffect, useRef, useState } from "react";
import { formatSeconds, stopwatchElapsedSeconds } from "../utils/exam";

export default function Timer({ sections, session, onTimerChange, onExpire }) {
  const timer = session.timer;
  const [customMinutes, setCustomMinutes] = useState(Math.ceil(timer.remaining / 60));
  const warnedRef = useRef(new Set(timer.warnings || []));
  const currentSection = sections.find((section) => section.id === timer.sectionId) || sections[0];
  const timerKind = session.mode === "practice" && timer.kind === "stopwatch" ? "stopwatch" : "countdown";

  useEffect(() => {
    if (!timer.running) return;
    if (timerKind === "stopwatch") {
      const tick = () => onTimerChange({ elapsed: stopwatchElapsedSeconds(timer) });
      tick();
      const id = window.setInterval(tick, 500);
      return () => window.clearInterval(id);
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
      const warningMark = remaining <= 60 ? 60 : remaining <= 300 ? 300 : null;
      if (warningMark && !warnedRef.current.has(warningMark)) {
        warnedRef.current.add(warningMark);
        onTimerChange({ remaining, warnings: [...warnedRef.current] });
      } else onTimerChange({ remaining });
      if (remaining <= 0) onExpire();
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [timer.running, timer.endAt, timer.startedAt, timerKind]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    if (timer.running) {
      if (session.mode === "real") return;
      if (timerKind === "stopwatch") onTimerChange({ running: false, elapsed: stopwatchElapsedSeconds(timer), startedAt: null });
      else onTimerChange({ running: false, endAt: null });
    } else if (timerKind === "stopwatch") {
      onTimerChange({ running: true, elapsed: timer.elapsed || 0, startedAt: Date.now() - (timer.elapsed || 0) * 1000, endAt: null });
    } else onTimerChange({ running: true, endAt: Date.now() + timer.remaining * 1000 });
  };
  const reset = () => {
    if (session.mode === "real" && session.status === "running" && !window.confirm("실전 시험 타이머를 초기화할까요?")) return;
    if (timerKind === "stopwatch") {
      onTimerChange({ running: false, elapsed: 0, startedAt: null, endAt: null, warnings: [] });
      return;
    }
    const remaining = currentSection.minutes * 60;
    warnedRef.current.clear(); onTimerChange({ running: false, remaining, endAt: null, warnings: [] });
  };
  const applyCustom = () => {
    if (session.mode !== "practice") return;
    const remaining = Math.max(1, Number(customMinutes) || 1) * 60;
    onTimerChange({ running: false, remaining, endAt: null, warnings: [] });
  };
  const changeTimerKind = (kind) => {
    if (session.mode !== "practice" || kind === timerKind) return;
    warnedRef.current.clear();
    onTimerChange({
      kind,
      running: false,
      remaining: kind === "countdown" ? currentSection.minutes * 60 : timer.remaining,
      elapsed: 0,
      startedAt: null,
      endAt: null,
      warnings: [],
    });
    if (kind === "countdown") setCustomMinutes(currentSection.minutes);
  };

  const displaySeconds = timerKind === "stopwatch" ? stopwatchElapsedSeconds(timer) : timer.remaining;
  const urgent = timerKind === "countdown" && timer.remaining <= 60;
  const warning = timerKind === "countdown" && timer.remaining <= 300;
  return <div className={`timer ${urgent ? "urgent" : warning ? "warning" : ""}`}>
    <div className="timer-meta"><span className={`mode-pill ${session.mode}`}>{session.mode === "real" ? "실전 모드" : "연습 모드"}</span><b>{currentSection.name}</b></div>
    {session.mode === "practice" && <div className="timer-kind-toggle" aria-label="타이머 방식">
      <button className={timerKind === "countdown" ? "active" : ""} onClick={() => changeTimerKind("countdown")}>카운트다운</button>
      <button className={timerKind === "stopwatch" ? "active" : ""} onClick={() => changeTimerKind("stopwatch")}>스톱워치</button>
    </div>}
    <div className="timer-display"><span>{formatSeconds(displaySeconds)}</span></div>
    {warning && timer.remaining > 0 && <p className="timer-warning">{urgent ? "1분 이내" : "5분 이내"} 남았습니다.</p>}
    {session.mode === "practice" && timerKind === "countdown" && <div className="custom-timer"><input type="number" min="1" max="180" value={customMinutes} onChange={(e) => setCustomMinutes(e.target.value)} /><span>분</span><button onClick={applyCustom}>적용</button></div>}
    <div className="timer-buttons"><button className={`timer-btn ${timer.running ? "stop-btn" : "start-btn"}`} onClick={toggle}>{timer.running ? (session.mode === "real" ? "진행 중" : "일시정지") : "시작"}</button><button className="timer-btn reset-btn" onClick={reset}>리셋</button></div>
  </div>;
}
