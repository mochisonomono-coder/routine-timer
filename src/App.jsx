import { useState, useEffect, useRef } from "react";

// ── ストレージ（localStorage） ──────────────────────────────
const STORAGE_KEYS = { routines: "rt_routines", logs: "rt_logs", comments: "rt_comments" };
function load(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ── デフォルトルーティン ────────────────────────────────────
const DEFAULT_ROUTINES = [
  { id: "r1", name: "深呼吸・瞑想", duration: 300, icon: "🧘" },
  { id: "r2", name: "ストレッチ", duration: 600, icon: "🤸" },
  { id: "r3", name: "日記・メモ", duration: 420, icon: "📝" },
  { id: "r4", name: "水を飲む", duration: 60, icon: "💧" },
  { id: "r5", name: "読書", duration: 900, icon: "📚" },
];

function fmt(sec) {
  const m = Math.floor(Math.max(0, sec) / 60).toString().padStart(2, "0");
  const s = (Math.max(0, sec) % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function dateLabel(d) {
  return new Date(d).toLocaleDateString("ja-JP", { month: "short", day: "numeric", weekday: "short" });
}

// ── Web Audio: 終了音 ───────────────────────────────────────
function playFinishSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.start(t); osc.stop(t + 0.5);
    });
  } catch {}
}

// ── 通知 ───────────────────────────────────────────────────
let notifPermission = typeof Notification !== "undefined" ? Notification.permission : "denied";
async function requestNotifPermission() {
  if (!("Notification" in window)) return;
  notifPermission = await Notification.requestPermission();
}
function sendNotif(title, body) {
  if (notifPermission === "granted") {
    try { new Notification(title, { body }); } catch {}
  }
}

// ── BigRing ─────────────────────────────────────────────────
function BigRing({ progress, running, finished, children }) {
  const r = 130, cx = 150, cy = 150;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, progress));
  const color = finished ? "#4ECDC4" : running ? "#FF6B6B" : "#4ECDC4";
  return (
    <div style={{ position: "relative", width: 300, height: 300 }}>
      <svg width="300" height="300" style={{ position: "absolute", top: 0, left: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1E3A5F" strokeWidth="14" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="14"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dashoffset 0.5s linear, stroke 0.4s" }} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="4" opacity="0.25"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dashoffset 0.5s linear" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center", flexDirection: "column",
        animation: running && !finished ? "breathe 3s ease-in-out infinite" : "none",
      }}>{children}</div>
    </div>
  );
}

// ── SmallRing ───────────────────────────────────────────────
function SmallRing({ progress, running, done }) {
  const r = 24, cx = 30, cy = 30, circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, progress));
  const color = done ? "#4ECDC4" : running ? "#FF6B6B" : "#4ECDC4";
  return (
    <svg width="60" height="60" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1E3A5F" strokeWidth="5" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dashoffset 0.5s linear, stroke 0.3s" }} />
    </svg>
  );
}

// ── FullscreenTimer ─────────────────────────────────────────
function FullscreenTimer({ routine, routines, activeIndex, elapsed, running, done,
  onPause, onResume, onComplete, onSkip, totalDone }) {
  const remaining = Math.max(0, routine.duration - elapsed);
  const progress = elapsed / routine.duration;
  const finished = elapsed >= routine.duration;
  const nextRoutine = routines[activeIndex + 1];
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "linear-gradient(180deg, #060E1A 0%, #0D1B2A 50%, #060E1A 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "space-between", padding: "48px 24px 40px", overflowY: "auto",
    }}>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {routines.map((r, i) => (
            <div key={r.id} style={{
              height: 4, borderRadius: 2, flex: 1, maxWidth: 40,
              background: i < totalDone ? "#4ECDC4" : i === activeIndex ? (running ? "#FF6B6B" : "#8BB4D8") : "#1E3A5F",
              transition: "background 0.3s",
            }} />
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#4A6FA5" }}>{activeIndex + 1} / {routines.length}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, flex: 1, justifyContent: "center" }}>
        <BigRing progress={done ? 1 : progress} running={running} finished={finished || done}>
          <span style={{ fontSize: 64, lineHeight: 1 }}>{routine.icon}</span>
          <div style={{
            fontSize: finished || done ? 36 : 52, fontWeight: 900,
            color: finished || done ? "#4ECDC4" : running ? "#FF6B6B" : "#F7F9FC",
            letterSpacing: -2, fontVariantNumeric: "tabular-nums", lineHeight: 1.1, marginTop: 4,
          }}>
            {finished || done ? "完了！" : fmt(remaining)}
          </div>
        </BigRing>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#F7F9FC" }}>{routine.name}</div>
          <div style={{ fontSize: 13, color: "#4A6FA5", marginTop: 4 }}>設定時間 {fmt(routine.duration)}</div>
          {nextRoutine && !done && (
            <div style={{ fontSize: 12, color: "#4A6FA5", marginTop: 6 }}>次: {nextRoutine.icon} {nextRoutine.name}</div>
          )}
        </div>
      </div>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
        {!done && !finished && (
          running
            ? <button onClick={onPause} style={bigBtn("#FF6B6B", "#fff")}>⏸ 一時停止</button>
            : <button onClick={onResume} style={bigBtn("#4ECDC4", "#0D1B2A")}>▶ {elapsed > 0 ? "再開" : "開始"}</button>
        )}
        {(done || finished) && (
          <button onClick={onComplete} style={bigBtn("#4ECDC4", "#0D1B2A")}>
            {nextRoutine ? `次へ: ${nextRoutine.icon} ${nextRoutine.name} →` : "✅ すべて完了"}
          </button>
        )}
        {!done && (
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onComplete} style={smallBtn}>✓ 完了にする</button>
            <button onClick={onSkip} style={smallBtn}>⏭ スキップ</button>
          </div>
        )}
      </div>
    </div>
  );
}
const bigBtn = (bg, color) => ({
  width: "100%", padding: "18px 0", background: bg, color,
  border: "none", borderRadius: 16, fontSize: 18, fontWeight: 700, cursor: "pointer",
});
const smallBtn = {
  flex: 1, padding: "13px 0", background: "#1E3A5F", color: "#8BB4D8",
  border: "1px solid #2A4F7C", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
};

// ── TabBar ──────────────────────────────────────────────────
function TabBar({ tab, setTab }) {
  const tabs = [
    { key: "today", label: "今日", icon: "✅" },
    { key: "routines", label: "設定", icon: "⚙️" },
    { key: "log", label: "ログ", icon: "📊" },
  ];
  return (
    <div style={{
      display: "flex", background: "#0A1628", borderTop: "1px solid #1E3A5F",
      position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 430, margin: "0 auto", zIndex: 100,
    }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => setTab(t.key)} style={{
          flex: 1, padding: "12px 0 20px", background: "none", border: "none",
          color: tab === t.key ? "#4ECDC4" : "#4A6FA5",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          cursor: "pointer", fontSize: 11, fontWeight: tab === t.key ? 700 : 400,
        }}>
          <span style={{ fontSize: 22 }}>{t.icon}</span>{t.label}
        </button>
      ))}
    </div>
  );
}

// ── TodayPage ───────────────────────────────────────────────
function TodayPage({ routines, logs, setLogs, comments, setComments }) {
  const today = todayStr();
  const todayLog = logs[today] || {};
  const [activeIndex, setActiveIndex] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const timerRef = useRef(null);
  const elapsedRef = useRef(0);
  const activeRoutine = activeIndex !== null ? routines[activeIndex] : null;

  function findNextIndex(from) {
    for (let i = from; i < routines.length; i++) {
      if (!todayLog[routines[i].id]) return i;
    }
    return null;
  }

  function startTimer(index) {
    clearInterval(timerRef.current);
    elapsedRef.current = 0;
    setElapsed(0);
    setActiveIndex(index);
    setRunning(true);
    setShowFull(true);
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      const routine = routines[index];
      if (elapsedRef.current >= routine.duration) {
        clearInterval(timerRef.current);
        setRunning(false);
        playFinishSound();
        sendNotif(`✅ ${routine.icon} ${routine.name} 完了！`,
          routines[index + 1] ? `次: ${routines[index + 1].name}` : "すべて完了しました");
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    }, 1000);
  }

  function handlePause() { clearInterval(timerRef.current); setRunning(false); }

  function handleResume() {
    if (!activeRoutine || running) return;
    setRunning(true);
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= activeRoutine.duration) {
        clearInterval(timerRef.current);
        setRunning(false);
        playFinishSound();
        sendNotif(`✅ ${activeRoutine.icon} ${activeRoutine.name} 完了！`, "");
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    }, 1000);
  }

  function handleComplete() {
    if (!activeRoutine) return;
    const updated = {
      ...logs,
      [today]: { ...todayLog, [activeRoutine.id]: { completedAt: new Date().toISOString(), elapsed: elapsedRef.current } },
    };
    setLogs(updated); save(STORAGE_KEYS.logs, updated);
    clearInterval(timerRef.current); setRunning(false);
    const nextIdx = findNextIndex(activeIndex + 1);
    if (nextIdx !== null) setTimeout(() => startTimer(nextIdx), 400);
    else { setActiveIndex(null); setShowFull(false); }
  }

  function handleSkip() {
    clearInterval(timerRef.current); setRunning(false);
    const nextIdx = findNextIndex(activeIndex + 1);
    if (nextIdx !== null) setTimeout(() => startTimer(nextIdx), 200);
    else { setActiveIndex(null); setShowFull(false); }
  }

  function handleSingleDone(id) {
    const updated = { ...logs, [today]: { ...todayLog, [id]: { completedAt: new Date().toISOString(), elapsed: 0 } } };
    setLogs(updated); save(STORAGE_KEYS.logs, updated);
  }

  useEffect(() => () => clearInterval(timerRef.current), []);

  const doneCount = Object.keys(todayLog).length;
  const total = routines.length;
  const allDone = doneCount === total && total > 0;
  const todayComment = comments[today] || "";

  function handleComment(val) {
    const updated = { ...comments, [today]: val };
    setComments(updated); save(STORAGE_KEYS.comments, updated);
  }

  return (
    <>
      {showFull && activeRoutine && (
        <FullscreenTimer routine={activeRoutine} routines={routines} activeIndex={activeIndex}
          elapsed={elapsed} running={running} done={!!todayLog[activeRoutine.id]}
          onPause={handlePause} onResume={handleResume} onComplete={handleComplete}
          onSkip={handleSkip} totalDone={doneCount} />
      )}
      <div style={{ padding: "20px 16px 100px" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "#4A6FA5", marginBottom: 4 }}>
            {new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#F7F9FC" }}>
            {allDone ? "🎉 今日のルーティン完了！" : "今日のルーティン"}
          </div>
          <div style={{ marginTop: 10, background: "#1E3A5F", borderRadius: 6, height: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${total ? (doneCount / total) * 100 : 0}%`, background: allDone ? "#4ECDC4" : "#FF6B6B", transition: "width 0.4s ease" }} />
          </div>
          <div style={{ fontSize: 12, color: "#4A6FA5", marginTop: 4 }}>{doneCount} / {total} 完了</div>
        </div>
        {!allDone && routines.length > 0 && (
          <button onClick={activeIndex !== null ? () => setShowFull(true) : () => startTimer(findNextIndex(0))} style={{
            width: "100%", padding: "15px 0", marginBottom: 20,
            background: activeIndex !== null ? "#1E3A5F" : "#4ECDC4",
            color: activeIndex !== null ? "#4ECDC4" : "#0D1B2A",
            border: activeIndex !== null ? "2px solid #4ECDC4" : "none",
            borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: "pointer",
          }}>
            {activeIndex !== null ? "▣ タイマー画面に戻る" : "▶ ルーティンを順番に開始"}
          </button>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {routines.map((r, idx) => {
            const done = !!todayLog[r.id];
            const isActive = idx === activeIndex;
            const prog = isActive ? elapsed / r.duration : done ? 1 : 0;
            return (
              <div key={r.id} onClick={() => { if (isActive) setShowFull(true); }} style={{
                background: done ? "#0D2B1E" : isActive ? "#162B45" : "#1E3A5F",
                border: `1px solid ${done ? "#2D6A4F" : isActive ? "#4ECDC4" : "#2A4F7C"}`,
                borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12,
                opacity: done ? 0.72 : 1, cursor: isActive ? "pointer" : "default",
                boxShadow: isActive ? "0 0 0 2px #4ECDC440" : "none", transition: "all 0.3s",
              }}>
                <div style={{ position: "relative" }}>
                  <SmallRing progress={prog} running={isActive && running} done={done} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{r.icon}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#F7F9FC", textDecoration: done ? "line-through" : "none", opacity: done ? 0.7 : 1 }}>{r.name}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: done ? "#4ECDC4" : isActive && running ? "#FF6B6B" : "#8BB4D8", lineHeight: 1.2 }}>
                    {done ? "完了" : isActive ? fmt(Math.max(0, r.duration - elapsed)) : fmt(r.duration)}
                  </div>
                </div>
                {isActive && <div style={{ fontSize: 11, color: "#4ECDC4", fontWeight: 700, background: "#0D2233", border: "1px solid #4ECDC440", padding: "3px 8px", borderRadius: 8 }}>実行中</div>}
                {done && <div style={{ fontSize: 28 }}>✅</div>}
                {!done && !isActive && (
                  <button onClick={e => { e.stopPropagation(); handleSingleDone(r.id); }} style={{ background: "none", border: "1px solid #2A4F7C", borderRadius: 8, color: "#4A6FA5", fontSize: 11, padding: "4px 8px", cursor: "pointer" }}>完了</button>
                )}
              </div>
            );
          })}
          {routines.length === 0 && <div style={{ textAlign: "center", color: "#4A6FA5", padding: 40, fontSize: 14 }}>⚙️ 設定タブからルーティンを追加してください</div>}
        </div>
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, color: "#8BB4D8", fontWeight: 600, marginBottom: 8 }}>📝 今日のメモ・コメント</div>
          <textarea value={todayComment} onChange={e => handleComment(e.target.value)} placeholder="気づき、体調、感想など..."
            style={{ width: "100%", minHeight: 90, background: "#1E3A5F", border: "1px solid #2A4F7C", borderRadius: 12, padding: "12px 14px", color: "#F7F9FC", fontSize: 14, resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
        </div>
      </div>
    </>
  );
}

// ── RoutinesPage ────────────────────────────────────────────
const inputStyle = { width: "100%", background: "#0D1B2A", border: "1px solid #2A4F7C", borderRadius: 8, padding: "10px 12px", color: "#F7F9FC", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const iconBtn2 = { background: "none", border: "none", color: "#8BB4D8", fontSize: 16, cursor: "pointer", padding: "4px 6px" };
const ICONS = ["⭐","🧘","🤸","📝","💧","📚","🏃","☕","🎵","💪","🛏","🌿","🧹","🍎","😴","🌅","🧴","🦷","🥤","🎯"];

function RoutinesPage({ routines, setRoutines }) {
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState(5);
  const [icon, setIcon] = useState("⭐");
  const [editing, setEditing] = useState(null);

  function addOrUpdate() {
    if (!name.trim()) return;
    let updated;
    if (editing) {
      updated = routines.map(r => r.id === editing ? { ...r, name: name.trim(), duration: Math.round(minutes * 60), icon } : r);
      setEditing(null);
    } else {
      updated = [...routines, { id: `r${Date.now()}`, name: name.trim(), duration: Math.round(minutes * 60), icon }];
    }
    setRoutines(updated); save(STORAGE_KEYS.routines, updated);
    setName(""); setMinutes(5); setIcon("⭐");
  }
  function remove(id) { const u = routines.filter(r => r.id !== id); setRoutines(u); save(STORAGE_KEYS.routines, u); }
  function move(idx, dir) {
    const a = [...routines], to = idx + dir;
    if (to < 0 || to >= a.length) return;
    [a[idx], a[to]] = [a[to], a[idx]];
    setRoutines(a); save(STORAGE_KEYS.routines, a);
  }
  function startEdit(r) { setEditing(r.id); setName(r.name); setMinutes(r.duration / 60); setIcon(r.icon); }

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#F7F9FC", marginBottom: 6 }}>⚙️ ルーティン設定</div>
      <div style={{ fontSize: 12, color: "#4A6FA5", marginBottom: 20 }}>順番通りにタイマーが自動で進みます</div>
      <div style={{ background: "#1E3A5F", borderRadius: 16, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "#8BB4D8", fontWeight: 600, marginBottom: 10 }}>{editing ? "✏️ 編集中" : "＋ 新規追加"}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {ICONS.map(ic => <button key={ic} onClick={() => setIcon(ic)} style={{ fontSize: 20, background: ic === icon ? "#4ECDC4" : "#0D1B2A", border: "none", borderRadius: 8, padding: "4px 6px", cursor: "pointer" }}>{ic}</button>)}
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="ルーティン名" style={inputStyle} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <span style={{ color: "#8BB4D8", fontSize: 13, whiteSpace: "nowrap" }}>時間（分）</span>
          <input type="number" value={minutes} min={0.5} max={120} step={0.5} onChange={e => setMinutes(Number(e.target.value))} style={{ ...inputStyle, width: 80 }} />
          <span style={{ color: "#4A6FA5", fontSize: 12 }}>{fmt(Math.round(minutes * 60))}</span>
        </div>
        <button onClick={addOrUpdate} style={{ marginTop: 12, width: "100%", padding: "12px 0", background: "#4ECDC4", color: "#0D1B2A", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{editing ? "更新する" : "追加する"}</button>
        {editing && <button onClick={() => { setEditing(null); setName(""); setMinutes(5); setIcon("⭐"); }} style={{ marginTop: 8, width: "100%", padding: "10px 0", background: "none", color: "#4A6FA5", border: "1px solid #2A4F7C", borderRadius: 10, cursor: "pointer", fontSize: 14 }}>キャンセル</button>}
      </div>
      {routines.map((r, idx) => (
        <div key={r.id} style={{ background: "#1E3A5F", border: "1px solid #2A4F7C", borderRadius: 12, padding: "12px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 11, color: "#4A6FA5", fontWeight: 700, width: 18, textAlign: "center" }}>{idx + 1}</div>
          <span style={{ fontSize: 24 }}>{r.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: "#F7F9FC", fontSize: 14 }}>{r.name}</div>
            <div style={{ fontSize: 12, color: "#4A6FA5" }}>{fmt(r.duration)}</div>
          </div>
          <button onClick={() => move(idx, -1)} style={iconBtn2}>↑</button>
          <button onClick={() => move(idx, 1)} style={iconBtn2}>↓</button>
          <button onClick={() => startEdit(r)} style={iconBtn2}>✏️</button>
          <button onClick={() => remove(r.id)} style={{ ...iconBtn2, color: "#FF6B6B" }}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ── LogPage ─────────────────────────────────────────────────
function LogPage({ routines, logs, comments }) {
  const dates = Object.keys(logs).sort((a, b) => b.localeCompare(a));
  const stats = routines.map(r => {
    const completedDays = dates.filter(d => logs[d]?.[r.id]);
    const totalElapsed = completedDays.reduce((sum, d) => sum + (logs[d][r.id].elapsed || r.duration), 0);
    return { ...r, completedDays: completedDays.length, totalElapsed };
  });
  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#F7F9FC", marginBottom: 20 }}>📊 ログ・分析</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[{ val: dates.length, label: "記録した日数", color: "#4ECDC4" },
          { val: dates.filter(d => routines.length > 0 && Object.keys(logs[d]).length === routines.length).length, label: "全完了日", color: "#FF6B6B" }
        ].map(s => (
          <div key={s.label} style={{ background: "#1E3A5F", borderRadius: 14, padding: 16, textAlign: "center", border: "1px solid #2A4F7C" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: "#4A6FA5" }}>{s.label}</div>
          </div>
        ))}
      </div>
      {stats.length > 0 && dates.length > 0 && (
        <div style={{ background: "#1E3A5F", borderRadius: 16, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: "#8BB4D8", fontWeight: 600, marginBottom: 12 }}>ルーティン別達成率</div>
          {stats.map(s => {
            const rate = dates.length > 0 ? (s.completedDays / dates.length) * 100 : 0;
            return (
              <div key={s.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "#F7F9FC" }}>{s.icon} {s.name}</span>
                  <span style={{ fontSize: 12, color: "#4ECDC4", fontWeight: 700 }}>{rate.toFixed(0)}%</span>
                </div>
                <div style={{ background: "#0D1B2A", borderRadius: 4, height: 6 }}>
                  <div style={{ height: "100%", width: `${rate}%`, background: "#4ECDC4", borderRadius: 4, transition: "width 0.5s" }} />
                </div>
                <div style={{ fontSize: 10, color: "#4A6FA5", marginTop: 2 }}>{s.completedDays}日完了 ／ 累計 {fmt(s.totalElapsed)}</div>
              </div>
            );
          })}
        </div>
      )}
      {dates.length === 0 ? (
        <div style={{ textAlign: "center", color: "#4A6FA5", padding: 40, fontSize: 14 }}>まだログがありません。今日からはじめましょう！</div>
      ) : dates.map(date => {
        const dl = logs[date]; const comment = comments[date];
        return (
          <div key={date} style={{ background: "#1E3A5F", borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#F7F9FC" }}>{dateLabel(date)}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: Object.keys(dl).length === routines.length ? "#4ECDC4" : "#FF6B6B" }}>{Object.keys(dl).length} / {routines.length} 完了</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: comment ? 10 : 0 }}>
              {routines.map(r => {
                const entry = dl[r.id];
                return <div key={r.id} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: entry ? "#2D6A4F" : "#0D1B2A", color: entry ? "#4ECDC4" : "#4A6FA5", border: `1px solid ${entry ? "#2D6A4F" : "#1E3A5F"}` }}>{r.icon} {r.name}{entry && entry.elapsed ? ` (${fmt(entry.elapsed)})` : ""}</div>;
              })}
            </div>
            {comment && <div style={{ fontSize: 12, color: "#8BB4D8", borderTop: "1px solid #2A4F7C", paddingTop: 8 }}>📝 {comment}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── App ─────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("today");
  const [routines, setRoutines] = useState(() => load(STORAGE_KEYS.routines) ?? DEFAULT_ROUTINES);
  const [logs, setLogs] = useState(() => load(STORAGE_KEYS.logs) ?? {});
  const [comments, setComments] = useState(() => load(STORAGE_KEYS.comments) ?? {});
  const [notifAsked, setNotifAsked] = useState(false);

  async function handleEnableNotif() {
    await requestNotifPermission();
    setNotifAsked(true);
  }

  return (
    <div style={{ background: "#0D1B2A", minHeight: "100vh", maxWidth: 430, margin: "0 auto", fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif", color: "#F7F9FC", overflowX: "hidden" }}>
      <style>{`
        @keyframes breathe { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.04);opacity:0.88} }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        textarea:focus, input:focus { border-color: #4ECDC4 !important; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
      {!notifAsked && typeof Notification !== "undefined" && Notification.permission === "default" && (
        <div style={{ background: "#162B45", borderBottom: "1px solid #2A4F7C", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>⌚</span>
          <div style={{ flex: 1, fontSize: 12, color: "#8BB4D8" }}>通知を許可するとApple Watchにも終了通知が届きます</div>
          <button onClick={handleEnableNotif} style={{ background: "#4ECDC4", color: "#0D1B2A", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>許可</button>
        </div>
      )}
      {tab === "today" && <TodayPage routines={routines} logs={logs} setLogs={setLogs} comments={comments} setComments={setComments} />}
      {tab === "routines" && <RoutinesPage routines={routines} setRoutines={setRoutines} />}
      {tab === "log" && <LogPage routines={routines} logs={logs} comments={comments} />}
      <TabBar tab={tab} setTab={setTab} />
    </div>
  );
}