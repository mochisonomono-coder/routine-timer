// build: 2026-06-27-v2
import { useState, useEffect, useRef } from "react";

// ── ストレージ ──────────────────────────────────────────────
const SK = { weekday: "rt_routines_weekday", weekend: "rt_routines_weekend", logs: "rt_logs", comments: "rt_comments" };
function load(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } }
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

// ── 祝日判定 ────────────────────────────────────────────────
const HOLIDAYS = ["01-01","01-02","01-03","02-11","02-23","03-20","04-29","05-03","05-04","05-05","07-20","08-11","09-23","10-14","11-03","11-23","12-23"];
function isHoliday(d) { const md = `${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; return HOLIDAYS.includes(md); }
function isWeekend(d) { const w = d.getDay(); return w===0||w===6||isHoliday(d); }
function getScheduleType(d) { return isWeekend(d) ? "weekend" : "weekday"; }

// ── デフォルトルーティン ────────────────────────────────────
const DEFAULT_WEEKDAY = [
  { id:"r1", name:"深呼吸・瞑想", duration:300, icon:"🧘" },
  { id:"r2", name:"ストレッチ", duration:600, icon:"🤸" },
  { id:"r3", name:"日記・メモ", duration:420, icon:"📝" },
  { id:"r4", name:"水を飲む", duration:60, icon:"💧" },
  { id:"r5", name:"読書", duration:900, icon:"📚" },
];
const DEFAULT_WEEKEND = [
  { id:"w1", name:"深呼吸・瞑想", duration:600, icon:"🧘" },
  { id:"w2", name:"ストレッチ", duration:900, icon:"🤸" },
  { id:"w3", name:"読書", duration:1800, icon:"📚" },
  { id:"w4", name:"散歩", duration:1800, icon:"🏃" },
];

// ── ユーティリティ ──────────────────────────────────────────
function fmt(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = s%60;
  if (h>0) return `${h}:${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
  return `${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
}
function fmtMin(sec) {
  const s = Math.max(0,sec), h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
  if (h>0&&m>0) return `${h}時間${m}分`; if (h>0) return `${h}時間`; return `${m}分`;
}
function todayStr() { return new Date().toISOString().slice(0,10); }
function dateLabel(d) { return new Date(d).toLocaleDateString("ja-JP",{month:"short",day:"numeric",weekday:"short"}); }

// ── Web Audio ───────────────────────────────────────────────
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  if (_audioCtx.state==="suspended") _audioCtx.resume().catch(()=>{});
  return _audioCtx;
}
function unlockAudio() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator(), g = ctx.createGain();
    g.gain.value = 0; osc.connect(g); g.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime+0.001);
  } catch {}
}
function playFinishSound() {
  try {
    const ctx = getAudioCtx();
    [523.25,659.25,783.99,1046.5].forEach((freq,i) => {
      const osc=ctx.createOscillator(), gain=ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type="sine"; osc.frequency.value=freq;
      const t=ctx.currentTime+i*0.2;
      gain.gain.setValueAtTime(0,t);
      gain.gain.linearRampToValueAtTime(0.4,t+0.03);
      gain.gain.exponentialRampToValueAtTime(0.001,t+0.5);
      osc.start(t); osc.stop(t+0.55);
    });
    const osc2=ctx.createOscillator(), g2=ctx.createGain();
    osc2.connect(g2); g2.connect(ctx.destination);
    osc2.type="sine"; osc2.frequency.value=1046.5;
    const t2=ctx.currentTime+4*0.2+0.1;
    g2.gain.setValueAtTime(0,t2); g2.gain.linearRampToValueAtTime(0.3,t2+0.05);
    g2.gain.exponentialRampToValueAtTime(0.001,t2+1.2);
    osc2.start(t2); osc2.stop(t2+1.3);
  } catch {}
}

// ── 通知 ────────────────────────────────────────────────────
let notifPermission = typeof Notification!=="undefined" ? Notification.permission : "denied";
async function requestNotifPermission() { if (!("Notification" in window)) return; notifPermission = await Notification.requestPermission(); }
function sendNotif(title,body) { if (notifPermission==="granted") { try { new Notification(title,{body}); } catch {} } }

// ── BigRing ─────────────────────────────────────────────────
function BigRing({progress,running,finished,children}) {
  const r=130,cx=150,cy=150,circ=2*Math.PI*r,offset=circ*(1-Math.min(1,progress));
  const color=finished?"#4ECDC4":running?"#FF6B6B":"#4ECDC4";
  return (
    <div style={{position:"relative",width:300,height:300}}>
      <svg width="300" height="300" style={{position:"absolute",top:0,left:0}}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1E3A5F" strokeWidth="14"/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="14"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} style={{transition:"stroke-dashoffset 0.5s linear,stroke 0.4s"}}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="4" opacity="0.25"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} style={{transition:"stroke-dashoffset 0.5s linear"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",
        animation:running&&!finished?"breathe 3s ease-in-out infinite":"none"}}>
        {children}
      </div>
    </div>
  );
}

// ── SmallRing ───────────────────────────────────────────────
function SmallRing({progress,running,done}) {
  const r=24,cx=30,cy=30,circ=2*Math.PI*r,offset=circ*(1-Math.min(1,progress));
  const color=done?"#4ECDC4":running?"#FF6B6B":"#4ECDC4";
  return (
    <svg width="60" height="60" style={{flexShrink:0}}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1E3A5F" strokeWidth="5"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} style={{transition:"stroke-dashoffset 0.5s linear,stroke 0.3s"}}/>
    </svg>
  );
}

// ── FullscreenTimer ─────────────────────────────────────────
function FullscreenTimer({routine,routines,activeIndex,elapsed,running,done,
  onPause,onResume,onComplete,onSkip,onBack,totalDone,totalRemainSec}) {
  const remaining=Math.max(0,routine.duration-elapsed);
  const progress=elapsed/routine.duration;
  const finished=elapsed>=routine.duration;
  const nextRoutine=routines[activeIndex+1];
  return (
    <div style={{position:"fixed",inset:0,zIndex:200,
      background:"linear-gradient(180deg,#060E1A 0%,#0D1B2A 50%,#060E1A 100%)",
      display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"space-between",padding:"48px 24px 40px",overflowY:"auto"}}>

      {/* 戻るボタン + 進捗 */}
      <div style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
        <button onClick={onBack} style={{
          alignSelf:"flex-start", background:"none", border:"1px solid #2A4F7C",
          borderRadius:10, color:"#8BB4D8", fontSize:13, fontWeight:600,
          padding:"6px 14px", cursor:"pointer", marginBottom:4,
        }}>← 一覧に戻る</button>
        <div style={{display:"flex",gap:6,width:"100%",justifyContent:"center"}}>
          {routines.map((r,i)=>(
            <div key={r.id} style={{height:4,borderRadius:2,flex:1,maxWidth:40,
              background:i<totalDone?"#4ECDC4":i===activeIndex?(running?"#FF6B6B":"#8BB4D8"):"#1E3A5F",
              transition:"background 0.3s"}}/>
          ))}
        </div>
        <div style={{fontSize:12,color:"#4A6FA5"}}>{activeIndex+1} / {routines.length}</div>
        {totalRemainSec>0&&(
          <div style={{fontSize:12,color:"#4A6FA5",background:"#1E3A5F",borderRadius:20,padding:"3px 12px"}}>
            全体残り <span style={{color:"#8BB4D8",fontWeight:700}}>{fmtMin(totalRemainSec)}</span>
          </div>
        )}
      </div>

      {/* リング */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:24,flex:1,justifyContent:"center"}}>
        <BigRing progress={done?1:progress} running={running} finished={finished||done}>
          <span style={{fontSize:64,lineHeight:1}}>{routine.icon}</span>
          <div style={{fontSize:finished||done?36:52,fontWeight:900,
            color:finished||done?"#4ECDC4":running?"#FF6B6B":"#F7F9FC",
            letterSpacing:-2,fontVariantNumeric:"tabular-nums",lineHeight:1.1,marginTop:4}}>
            {finished||done?"完了！":fmt(remaining)}
          </div>
        </BigRing>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:22,fontWeight:700,color:"#F7F9FC"}}>{routine.name}</div>
          <div style={{fontSize:13,color:"#4A6FA5",marginTop:4}}>設定時間 {fmt(routine.duration)}</div>
          {nextRoutine&&!done&&<div style={{fontSize:12,color:"#4A6FA5",marginTop:6}}>次: {nextRoutine.icon} {nextRoutine.name}</div>}
        </div>
      </div>

      {/* ボタン */}
      <div style={{width:"100%",display:"flex",flexDirection:"column",gap:12}}>
        {!done&&!finished&&(running
          ?<button onClick={onPause} style={bigBtn("#FF6B6B","#fff")}>⏸ 一時停止</button>
          :<button onClick={onResume} style={bigBtn("#4ECDC4","#0D1B2A")}>▶ {elapsed>0?"再開":"開始"}</button>
        )}
        {(done||finished)&&(
          <button onClick={onComplete} style={bigBtn("#4ECDC4","#0D1B2A")}>
            {nextRoutine?`次へ: ${nextRoutine.icon} ${nextRoutine.name} →`:"✅ すべて完了"}
          </button>
        )}
        {!done&&(
          <div style={{display:"flex",gap:10}}>
            <button onClick={onComplete} style={smallBtn}>✓ 完了にする</button>
            <button onClick={onSkip} style={smallBtn}>⏭ スキップ</button>
          </div>
        )}
      </div>
    </div>
  );
}
const bigBtn=(bg,color)=>({width:"100%",padding:"18px 0",background:bg,color,border:"none",borderRadius:16,fontSize:18,fontWeight:700,cursor:"pointer"});
const smallBtn={flex:1,padding:"13px 0",background:"#1E3A5F",color:"#8BB4D8",border:"1px solid #2A4F7C",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer"};

// ── TabBar ──────────────────────────────────────────────────
function TabBar({tab,setTab}) {
  return (
    <div style={{display:"flex",background:"#0A1628",borderTop:"1px solid #1E3A5F",
      position:"fixed",bottom:0,left:0,right:0,maxWidth:430,margin:"0 auto",zIndex:100}}>
      {[{key:"today",label:"今日",icon:"✅"},{key:"routines",label:"設定",icon:"⚙️"},{key:"log",label:"ログ",icon:"📊"}].map(t=>(
        <button key={t.key} onClick={()=>setTab(t.key)} style={{flex:1,padding:"12px 0 20px",background:"none",border:"none",
          color:tab===t.key?"#4ECDC4":"#4A6FA5",display:"flex",flexDirection:"column",alignItems:"center",gap:3,
          cursor:"pointer",fontSize:11,fontWeight:tab===t.key?700:400}}>
          <span style={{fontSize:22}}>{t.icon}</span>{t.label}
        </button>
      ))}
    </div>
  );
}

// ── TodayPage ───────────────────────────────────────────────
function TodayPage({weekday,weekend,logs,setLogs,comments,setComments}) {
  const today=todayStr();
  const todayDate=new Date();
  const autoType=getScheduleType(todayDate);
  const [scheduleType,setScheduleType]=useState(()=>load(`rt_schedule_override_${today}`)||autoType);
  const routines=scheduleType==="weekend"?weekend:weekday;
  const todayLog=logs[today]||{};

  function handleTypeChange(type) { setScheduleType(type); save(`rt_schedule_override_${today}`,type); }

  const [activeIndex,setActiveIndex]=useState(null);
  const [elapsed,setElapsed]=useState(0);
  const [running,setRunning]=useState(false);
  const [showFull,setShowFull]=useState(false);
  const [missedMsg,setMissedMsg]=useState(null);
  const timerRef=useRef(null);
  const startedAtRef=useRef(null);
  const baseElapsedRef=useRef(0);
  const activeIndexRef=useRef(null);
  const routinesRef=useRef(routines);
  useEffect(()=>{routinesRef.current=routines;},[routines]);

  const activeRoutine=activeIndex!==null?routines[activeIndex]:null;
  const totalSec=routines.reduce((s,r)=>s+r.duration,0);
  const doneSec=routines.reduce((s,r)=>todayLog[r.id]?s+(todayLog[r.id].elapsed||r.duration):s,0);
  const remainSec=routines.reduce((s,r)=>!todayLog[r.id]?s+r.duration:s,0);
  const totalRemainSec=activeIndex!==null
    ?routines.slice(activeIndex).reduce((s,r,i)=>{
      if(i===0) return s+Math.max(0,r.duration-elapsed);
      return todayLog[r.id]?s:s+r.duration;
    },0):remainSec;

  // 未完了の次のindex（完了済みも含めてどこからでも）
  function findNextUndone(from) {
    for (let i=from;i<routines.length;i++) { if (!todayLog[routines[i].id]) return i; }
    return null;
  }

  function calcElapsed(base) {
    if (startedAtRef.current===null) return base;
    return base+Math.floor((Date.now()-startedAtRef.current)/1000);
  }

  function tickStart(index,base) {
    clearInterval(timerRef.current);
    timerRef.current=setInterval(()=>{
      const e=calcElapsed(base);
      setElapsed(e);
      const routine=routinesRef.current[index];
      if (e>=routine.duration) {
        clearInterval(timerRef.current); setRunning(false);
        playFinishSound();
        sendNotif(`✅ ${routine.icon} ${routine.name} 完了！`,
          routinesRef.current[index+1]?`次: ${routinesRef.current[index+1].name}`:"すべて完了しました");
        if (navigator.vibrate) navigator.vibrate([200,100,200]);
      }
    },500);
  }

  function startTimer(index) {
    unlockAudio();
    baseElapsedRef.current=0; startedAtRef.current=Date.now();
    activeIndexRef.current=index;
    setElapsed(0); setActiveIndex(index); setRunning(true); setShowFull(true); setMissedMsg(null);
    save("rt_timer_state",{index,startedAt:startedAtRef.current,base:0,scheduleType});
    tickStart(index,0);
  }

  function handlePause() {
    clearInterval(timerRef.current);
    baseElapsedRef.current=calcElapsed(baseElapsedRef.current);
    startedAtRef.current=null; setRunning(false); save("rt_timer_state",null);
  }
  function handleResume() {
    if (!activeRoutine||running) return;
    unlockAudio(); startedAtRef.current=Date.now(); setRunning(true);
    save("rt_timer_state",{index:activeIndex,startedAt:startedAtRef.current,base:baseElapsedRef.current,scheduleType});
    tickStart(activeIndex,baseElapsedRef.current);
  }
  function handleComplete() {
    if (!activeRoutine) return;
    const e=calcElapsed(baseElapsedRef.current);
    const updated={...logs,[today]:{...todayLog,[activeRoutine.id]:{completedAt:new Date().toISOString(),elapsed:e}}};
    setLogs(updated); save(SK.logs,updated);
    clearInterval(timerRef.current); setRunning(false);
    startedAtRef.current=null; save("rt_timer_state",null); setMissedMsg(null);
    const nextIdx=findNextUndone(activeIndex+1);
    if (nextIdx!==null) setTimeout(()=>startTimer(nextIdx),400);
    else { setActiveIndex(null); activeIndexRef.current=null; setShowFull(false); }
  }
  function handleSkip() {
    clearInterval(timerRef.current); setRunning(false);
    startedAtRef.current=null; save("rt_timer_state",null); setMissedMsg(null);
    const nextIdx=findNextUndone(activeIndex+1);
    if (nextIdx!==null) setTimeout(()=>startTimer(nextIdx),200);
    else { setActiveIndex(null); activeIndexRef.current=null; setShowFull(false); }
  }
  function handleBack() { setShowFull(false); }

  // 単体タイマースタート（完了済みも再スタート可）
  function handleSingleStart(idx) {
    startTimer(idx);
  }
  // 手動完了
  function handleSingleDone(id) {
    const updated={...logs,[today]:{...todayLog,[id]:{completedAt:new Date().toISOString(),elapsed:0}}};
    setLogs(updated); save(SK.logs,updated);
  }
  // 完了を取り消す
  function handleUndone(id) {
    const newLog={...todayLog}; delete newLog[id];
    const updated={...logs,[today]:newLog};
    setLogs(updated); save(SK.logs,updated);
  }

  // バックグラウンド復帰時の時刻補正
  useEffect(()=>{
    function onVisibilityChange() {
      if (document.visibilityState!=="visible") return;
      const state=load("rt_timer_state"); if (!state) return;
      const {index,startedAt,base}=state;
      const now=Date.now();
      const realElapsed=base+Math.floor((now-startedAt)/1000);
      const routine=routinesRef.current[index]; if (!routine) return;
      baseElapsedRef.current=realElapsed; startedAtRef.current=now;
      setElapsed(realElapsed); setActiveIndex(index); activeIndexRef.current=index;
      if (realElapsed>=routine.duration) {
        clearInterval(timerRef.current); setRunning(false);
        startedAtRef.current=null; save("rt_timer_state",null);
        const over=realElapsed-routine.duration;
        setMissedMsg(`${routine.icon} ${routine.name} が ${over<60?`${over}秒`:`${Math.floor(over/60)}分`}前に終了しました`);
        playFinishSound();
      } else {
        setRunning(true); tickStart(index,base);
      }
    }
    document.addEventListener("visibilitychange",onVisibilityChange);
    return ()=>document.removeEventListener("visibilitychange",onVisibilityChange);
  },[]);
  useEffect(()=>()=>clearInterval(timerRef.current),[]);

  const doneCount=Object.keys(todayLog).length;
  const total=routines.length;
  const allDone=doneCount===total&&total>0;
  const todayComment=comments[today]||"";
  function handleComment(val) { const u={...comments,[today]:val}; setComments(u); save(SK.comments,u); }

  return (
    <>
      {showFull&&activeRoutine&&(
        <FullscreenTimer routine={activeRoutine} routines={routines} activeIndex={activeIndex}
          elapsed={elapsed} running={running} done={!!todayLog[activeRoutine.id]}
          onPause={handlePause} onResume={handleResume} onComplete={handleComplete}
          onSkip={handleSkip} onBack={handleBack} totalDone={doneCount} totalRemainSec={totalRemainSec}/>
      )}
      <div style={{padding:"20px 16px 100px"}}>
        {/* ヘッダー */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:"#4A6FA5",marginBottom:4}}>
            {todayDate.toLocaleDateString("ja-JP",{year:"numeric",month:"long",day:"numeric",weekday:"long"})}
          </div>
          <div style={{fontSize:22,fontWeight:800,color:"#F7F9FC"}}>
            {allDone?"🎉 今日のルーティン完了！":"今日のルーティン"}
          </div>
        </div>

        {/* 平日/土日祝切替 */}
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {[{key:"weekday",label:"📅 平日"},{key:"weekend",label:"🌅 土日祝"}].map(({key,label})=>(
            <button key={key} onClick={()=>handleTypeChange(key)} style={{
              flex:1,padding:"9px 0",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,
              background:scheduleType===key?"#4ECDC4":"#1E3A5F",
              color:scheduleType===key?"#0D1B2A":"#4A6FA5",
              boxShadow:scheduleType===key?"0 0 0 2px #4ECDC480":"none",transition:"all 0.2s",
            }}>{label}{autoType===key?" ✦":""}</button>
          ))}
        </div>

        {/* 合計・残り時間 */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
          {[
            {label:"合計時間",val:fmtMin(totalSec),color:"#8BB4D8"},
            {label:"完了時間",val:fmtMin(doneSec),color:"#4ECDC4"},
            {label:"残り時間",val:allDone?"0分":fmtMin(remainSec),color:allDone?"#4ECDC4":"#FF6B6B"},
          ].map(s=>(
            <div key={s.label} style={{background:"#1E3A5F",borderRadius:12,padding:"10px 8px",textAlign:"center",border:"1px solid #2A4F7C"}}>
              <div style={{fontSize:16,fontWeight:800,color:s.color,letterSpacing:-0.5}}>{s.val}</div>
              <div style={{fontSize:10,color:"#4A6FA5",marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* 進捗バー */}
        <div style={{marginBottom:16}}>
          <div style={{background:"#1E3A5F",borderRadius:6,height:6,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${total?(doneCount/total)*100:0}%`,background:allDone?"#4ECDC4":"#FF6B6B",transition:"width 0.4s ease"}}/>
          </div>
          <div style={{fontSize:12,color:"#4A6FA5",marginTop:4}}>{doneCount} / {total} 完了</div>
        </div>

        {/* バックグラウンド終了バナー */}
        {missedMsg&&(
          <div style={{background:"#2D1B00",border:"1px solid #FF6B6B",borderRadius:12,padding:"12px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>⏰</span>
            <div style={{flex:1,fontSize:13,color:"#FF9966"}}>{missedMsg}</div>
            <button onClick={()=>{setMissedMsg(null);setShowFull(true);}} style={{background:"#FF6B6B",color:"#fff",border:"none",borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:700,cursor:"pointer"}}>確認</button>
          </div>
        )}

        {/* 全体スタートボタン */}
        {routines.length>0&&(
          <button onClick={activeIndex!==null?()=>setShowFull(true):()=>startTimer(findNextUndone(0)??0)} style={{
            width:"100%",padding:"15px 0",marginBottom:16,
            background:activeIndex!==null?"#1E3A5F":allDone?"#1E3A5F":"#4ECDC4",
            color:activeIndex!==null?"#4ECDC4":allDone?"#4A6FA5":"#0D1B2A",
            border:activeIndex!==null?"2px solid #4ECDC4":"none",
            borderRadius:14,fontSize:16,fontWeight:700,cursor:"pointer",
          }}>
            {activeIndex!==null?"▣ タイマー画面に戻る":allDone?"↺ 最初からやり直す":"▶ ルーティンを順番に開始"}
          </button>
        )}

        {/* ルーティン一覧 */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {routines.map((r,idx)=>{
            const done=!!todayLog[r.id];
            const isActive=idx===activeIndex;
            const prog=isActive?elapsed/r.duration:done?1:0;
            return (
              <div key={r.id} style={{
                background:done?"#0D2B1E":isActive?"#162B45":"#1E3A5F",
                border:`1px solid ${done?"#2D6A4F":isActive?"#4ECDC4":"#2A4F7C"}`,
                borderRadius:14,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,
                boxShadow:isActive?"0 0 0 2px #4ECDC440":"none",transition:"all 0.3s",
              }}>
                {/* リング（クリックで全画面） */}
                <div style={{position:"relative",cursor:isActive?"pointer":"default"}}
                  onClick={()=>{if(isActive)setShowFull(true);}}>
                  <SmallRing progress={prog} running={isActive&&running} done={done}/>
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{r.icon}</div>
                </div>
                <div style={{flex:1,cursor:isActive?"pointer":"default"}} onClick={()=>{if(isActive)setShowFull(true);}}>
                  <div style={{fontSize:14,fontWeight:600,color:"#F7F9FC",textDecoration:done?"line-through":"none",opacity:done?0.7:1}}>{r.name}</div>
                  <div style={{fontSize:20,fontWeight:800,fontVariantNumeric:"tabular-nums",
                    color:done?"#4ECDC4":isActive&&running?"#FF6B6B":"#8BB4D8",lineHeight:1.2}}>
                    {done?"完了":isActive?fmt(Math.max(0,r.duration-elapsed)):fmt(r.duration)}
                  </div>
                </div>
                {/* 右側ボタン群 */}
                <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end"}}>
                  {isActive&&(
                    <div style={{fontSize:11,color:"#4ECDC4",fontWeight:700,background:"#0D2233",border:"1px solid #4ECDC440",padding:"3px 8px",borderRadius:8}}>実行中</div>
                  )}
                  {/* 単体スタートボタン（実行中以外は常に表示） */}
                  {!isActive&&(
                    <button onClick={e=>{e.stopPropagation();handleSingleStart(idx);}} style={{
                      background:done?"#162B45":"#0D2233",
                      border:`1px solid ${done?"#2D6A4F":"#2A4F7C"}`,
                      borderRadius:8,color:done?"#4ECDC4":"#4A6FA5",
                      fontSize:11,padding:"4px 8px",cursor:"pointer",fontWeight:600,
                    }}>▶ {done?"再実行":"開始"}</button>
                  )}
                  {/* 完了/未完了切替 */}
                  {!isActive&&(done
                    ?<button onClick={e=>{e.stopPropagation();handleUndone(r.id);}} style={{background:"none",border:"1px solid #2D6A4F",borderRadius:8,color:"#4A6FA5",fontSize:11,padding:"4px 8px",cursor:"pointer"}}>↩ 戻す</button>
                    :<button onClick={e=>{e.stopPropagation();handleSingleDone(r.id);}} style={{background:"none",border:"1px solid #2A4F7C",borderRadius:8,color:"#4A6FA5",fontSize:11,padding:"4px 8px",cursor:"pointer"}}>✓ 完了</button>
                  )}
                </div>
              </div>
            );
          })}
          {routines.length===0&&<div style={{textAlign:"center",color:"#4A6FA5",padding:40,fontSize:14}}>⚙️ 設定タブからルーティンを追加してください</div>}
        </div>

        {/* コメント */}
        <div style={{marginTop:24}}>
          <div style={{fontSize:13,color:"#8BB4D8",fontWeight:600,marginBottom:8}}>📝 今日のメモ・コメント</div>
          <textarea value={todayComment} onChange={e=>handleComment(e.target.value)} placeholder="気づき、体調、感想など..."
            style={{width:"100%",minHeight:90,background:"#1E3A5F",border:"1px solid #2A4F7C",borderRadius:12,
              padding:"12px 14px",color:"#F7F9FC",fontSize:14,resize:"vertical",
              boxSizing:"border-box",outline:"none",fontFamily:"inherit"}}/>
        </div>
      </div>
    </>
  );
}

// ── RoutinesPage（パズル式編集） ────────────────────────────
const inputStyle={width:"100%",background:"#0D1B2A",border:"1px solid #2A4F7C",borderRadius:8,padding:"10px 12px",color:"#F7F9FC",fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};
const ICONS=["⭐","🧘","🤸","📝","💧","📚","🏃","☕","🎵","💪","🛏","🌿","🧹","🍎","😴","🌅","🧴","🦷","🥤","🎯"];

function RoutineEditor({routines,setRoutines,storageKey}) {
  const [name,setName]=useState("");
  const [minutes,setMinutes]=useState(5);
  const [icon,setIcon]=useState("⭐");
  const [editing,setEditing]=useState(null);
  const [dragging,setDragging]=useState(null); // ドラッグ中のindex
  const dragOver=useRef(null);

  function addOrUpdate() {
    if (!name.trim()) return;
    let updated;
    if (editing) {
      updated=routines.map(r=>r.id===editing?{...r,name:name.trim(),duration:Math.round(minutes*60),icon}:r);
      setEditing(null);
    } else {
      updated=[...routines,{id:`r${Date.now()}`,name:name.trim(),duration:Math.round(minutes*60),icon}];
    }
    setRoutines(updated); save(storageKey,updated); setName(""); setMinutes(5); setIcon("⭐");
  }
  function remove(id) { const u=routines.filter(r=>r.id!==id); setRoutines(u); save(storageKey,u); }
  function move(idx,dir) {
    const a=[...routines],to=idx+dir;
    if (to<0||to>=a.length) return;
    [a[idx],a[to]]=[a[to],a[idx]];
    setRoutines(a); save(storageKey,a);
  }
  function startEdit(r) { setEditing(r.id); setName(r.name); setMinutes(r.duration/60); setIcon(r.icon); }

  // ドラッグ並べ替え
  function onDragStart(idx) { setDragging(idx); }
  function onDragEnter(idx) { dragOver.current=idx; }
  function onDragEnd() {
    if (dragging===null||dragOver.current===null||dragging===dragOver.current) { setDragging(null); return; }
    const a=[...routines];
    const item=a.splice(dragging,1)[0];
    a.splice(dragOver.current,0,item);
    setRoutines(a); save(storageKey,a);
    setDragging(null); dragOver.current=null;
  }

  const totalSec=routines.reduce((s,r)=>s+r.duration,0);
  return (
    <div>
      {routines.length>0&&(
        <div style={{background:"#0D1B2A",borderRadius:10,padding:"8px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:12,color:"#4A6FA5"}}>合計ルーティン時間</span>
          <span style={{fontSize:15,fontWeight:700,color:"#4ECDC4"}}>{fmtMin(totalSec)}</span>
        </div>
      )}
      {/* 追加フォーム */}
      <div style={{background:"#1E3A5F",borderRadius:16,padding:16,marginBottom:14}}>
        <div style={{fontSize:13,color:"#8BB4D8",fontWeight:600,marginBottom:10}}>{editing?"✏️ 編集中":"＋ 新規追加"}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
          {ICONS.map(ic=><button key={ic} onClick={()=>setIcon(ic)} style={{fontSize:20,background:ic===icon?"#4ECDC4":"#0D1B2A",border:"none",borderRadius:8,padding:"4px 6px",cursor:"pointer"}}>{ic}</button>)}
        </div>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="ルーティン名" style={inputStyle}/>
        <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10}}>
          <span style={{color:"#8BB4D8",fontSize:13,whiteSpace:"nowrap"}}>時間（分）</span>
          <input type="number" value={minutes} min={0.5} max={120} step={0.5} onChange={e=>setMinutes(Number(e.target.value))} style={{...inputStyle,width:80}}/>
          <span style={{color:"#4A6FA5",fontSize:12}}>{fmt(Math.round(minutes*60))}</span>
        </div>
        <button onClick={addOrUpdate} style={{marginTop:12,width:"100%",padding:"12px 0",background:"#4ECDC4",color:"#0D1B2A",border:"none",borderRadius:10,fontWeight:700,fontSize:15,cursor:"pointer"}}>{editing?"更新する":"追加する"}</button>
        {editing&&<button onClick={()=>{setEditing(null);setName("");setMinutes(5);setIcon("⭐");}} style={{marginTop:8,width:"100%",padding:"10px 0",background:"none",color:"#4A6FA5",border:"1px solid #2A4F7C",borderRadius:10,cursor:"pointer",fontSize:14}}>キャンセル</button>}
      </div>

      {/* パズル式リスト（ドラッグ並べ替え） */}
      <div style={{fontSize:12,color:"#4A6FA5",marginBottom:8,textAlign:"center"}}>☰ 長押しでドラッグして並べ替え　↑↓ボタンでも移動可</div>
      {routines.map((r,idx)=>(
        <div key={r.id}
          draggable
          onDragStart={()=>onDragStart(idx)}
          onDragEnter={()=>onDragEnter(idx)}
          onDragEnd={onDragEnd}
          onDragOver={e=>e.preventDefault()}
          style={{
            background:dragging===idx?"#0D2233":"#1E3A5F",
            border:`1px solid ${dragging===idx?"#4ECDC4":"#2A4F7C"}`,
            borderRadius:12,padding:"12px 14px",marginBottom:10,
            display:"flex",alignItems:"center",gap:10,
            opacity:dragging===idx?0.6:1,
            transition:"all 0.2s",cursor:"grab",
          }}>
          <div style={{fontSize:11,color:"#4A6FA5",fontWeight:700,width:18,textAlign:"center"}}>{idx+1}</div>
          <span style={{fontSize:24,userSelect:"none"}}>{r.icon}</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,color:"#F7F9FC",fontSize:14}}>{r.name}</div>
            <div style={{fontSize:12,color:"#4A6FA5"}}>{fmt(r.duration)}</div>
          </div>
          <div style={{display:"flex",gap:4}}>
            <button onClick={()=>move(idx,-1)} style={{background:"none",border:"none",color:"#8BB4D8",fontSize:16,cursor:"pointer",padding:"4px 6px"}}>↑</button>
            <button onClick={()=>move(idx,1)} style={{background:"none",border:"none",color:"#8BB4D8",fontSize:16,cursor:"pointer",padding:"4px 6px"}}>↓</button>
            <button onClick={()=>startEdit(r)} style={{background:"none",border:"none",color:"#8BB4D8",fontSize:16,cursor:"pointer",padding:"4px 6px"}}>✏️</button>
            <button onClick={()=>remove(r.id)} style={{background:"none",border:"none",color:"#FF6B6B",fontSize:16,cursor:"pointer",padding:"4px 6px"}}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function RoutinesPage({weekday,setWeekday,weekend,setWeekend}) {
  const [tab,setTab]=useState("weekday");
  return (
    <div style={{padding:"20px 16px 100px"}}>
      <div style={{fontSize:20,fontWeight:800,color:"#F7F9FC",marginBottom:6}}>⚙️ ルーティン設定</div>
      <div style={{fontSize:12,color:"#4A6FA5",marginBottom:16}}>平日・土日祝それぞれ設定できます</div>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[{key:"weekday",label:"📅 平日"},{key:"weekend",label:"🌅 土日祝"}].map(({key,label})=>(
          <button key={key} onClick={()=>setTab(key)} style={{flex:1,padding:"10px 0",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:tab===key?"#4ECDC4":"#1E3A5F",color:tab===key?"#0D1B2A":"#4A6FA5",transition:"all 0.2s"}}>{label}</button>
        ))}
      </div>
      {tab==="weekday"
        ?<RoutineEditor routines={weekday} setRoutines={setWeekday} storageKey={SK.weekday}/>
        :<RoutineEditor routines={weekend} setRoutines={setWeekend} storageKey={SK.weekend}/>
      }
    </div>
  );
}

// ── LogPage ─────────────────────────────────────────────────
function LogPage({weekday,weekend,logs,comments}) {
  const dates=Object.keys(logs).sort((a,b)=>b.localeCompare(a));
  const allR=[...weekday,...weekend].filter((r,i,a)=>a.findIndex(x=>x.id===r.id)===i);
  const stats=allR.map(r=>{
    const completedDays=dates.filter(d=>logs[d]?.[r.id]);
    const totalElapsed=dates.reduce((s,d)=>s+(logs[d]?.[r.id]?.elapsed||0),0);
    return {...r,completedDays:completedDays.length,totalElapsed};
  }).filter(s=>s.completedDays>0);

  return (
    <div style={{padding:"20px 16px 100px"}}>
      <div style={{fontSize:20,fontWeight:800,color:"#F7F9FC",marginBottom:20}}>📊 ログ・分析</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
        {[
          {val:dates.length,label:"記録した日数",color:"#4ECDC4"},
          {val:dates.reduce((s,d)=>s+Object.values(logs[d]).reduce((ss,e)=>ss+(e.elapsed||0),0),0),label:"累計ルーティン時間",color:"#FF6B6B",isSec:true},
        ].map(s=>(
          <div key={s.label} style={{background:"#1E3A5F",borderRadius:14,padding:16,textAlign:"center",border:"1px solid #2A4F7C"}}>
            <div style={{fontSize:s.isSec?20:32,fontWeight:800,color:s.color,lineHeight:1.3}}>{s.isSec?fmtMin(s.val):s.val}</div>
            <div style={{fontSize:11,color:"#4A6FA5"}}>{s.label}</div>
          </div>
        ))}
      </div>
      {stats.length>0&&(
        <div style={{background:"#1E3A5F",borderRadius:16,padding:16,marginBottom:20}}>
          <div style={{fontSize:13,color:"#8BB4D8",fontWeight:600,marginBottom:12}}>ルーティン別累計</div>
          {stats.map(s=>(
            <div key={s.id} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:13,color:"#F7F9FC"}}>{s.icon} {s.name}</span>
                <span style={{fontSize:12,color:"#4ECDC4",fontWeight:700}}>{s.completedDays}日 / {fmtMin(s.totalElapsed)}</span>
              </div>
              <div style={{background:"#0D1B2A",borderRadius:4,height:6}}>
                <div style={{height:"100%",width:`${Math.min(100,(s.completedDays/Math.max(dates.length,1))*100)}%`,background:"#4ECDC4",borderRadius:4,transition:"width 0.5s"}}/>
              </div>
            </div>
          ))}
        </div>
      )}
      {dates.length===0?(
        <div style={{textAlign:"center",color:"#4A6FA5",padding:40,fontSize:14}}>まだログがありません。今日からはじめましょう！</div>
      ):dates.map(date=>{
        const dl=logs[date],comment=comments[date];
        const type=getScheduleType(new Date(date));
        const routinesForDay=type==="weekend"?weekend:weekday;
        const doneIds=Object.keys(dl);
        const daySec=doneIds.reduce((s,id)=>s+(dl[id].elapsed||0),0);
        return (
          <div key={date} style={{background:"#1E3A5F",borderRadius:16,padding:16,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:14,fontWeight:700,color:"#F7F9FC"}}>{dateLabel(date)}</div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {daySec>0&&<span style={{fontSize:11,color:"#8BB4D8"}}>{fmtMin(daySec)}</span>}
                <div style={{fontSize:12,fontWeight:600,color:doneIds.length===routinesForDay.length?"#4ECDC4":"#FF6B6B"}}>{doneIds.length} / {routinesForDay.length} 完了</div>
              </div>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:comment?10:0}}>
              {routinesForDay.map(r=>{
                const entry=dl[r.id];
                return <div key={r.id} style={{fontSize:11,padding:"3px 10px",borderRadius:20,background:entry?"#2D6A4F":"#0D1B2A",color:entry?"#4ECDC4":"#4A6FA5",border:`1px solid ${entry?"#2D6A4F":"#1E3A5F"}`}}>{r.icon} {r.name}{entry&&entry.elapsed?` (${fmt(entry.elapsed)})`:""}</div>;
              })}
            </div>
            {comment&&<div style={{fontSize:12,color:"#8BB4D8",borderTop:"1px solid #2A4F7C",paddingTop:8}}>📝 {comment}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── App ─────────────────────────────────────────────────────
export default function App() {
  const [tab,setTab]=useState("today");
  const [weekday,setWeekday]=useState(()=>load(SK.weekday)??DEFAULT_WEEKDAY);
  const [weekend,setWeekend]=useState(()=>load(SK.weekend)??DEFAULT_WEEKEND);
  const [logs,setLogs]=useState(()=>load(SK.logs)??{});
  const [comments,setComments]=useState(()=>load(SK.comments)??{});
  const [notifAsked,setNotifAsked]=useState(false);

  async function handleEnableNotif() { await requestNotifPermission(); setNotifAsked(true); }

  return (
    <div style={{background:"#0D1B2A",minHeight:"100vh",maxWidth:430,margin:"0 auto",fontFamily:"-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif",color:"#F7F9FC",overflowX:"hidden"}}>
      <style>{`
        @keyframes breathe{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.04);opacity:0.88}}
        *{-webkit-tap-highlight-color:transparent;box-sizing:border-box;}
        textarea:focus,input:focus{border-color:#4ECDC4!important;}
        ::-webkit-scrollbar{display:none;}
      `}</style>
      {!notifAsked&&typeof Notification!=="undefined"&&Notification.permission==="default"&&(
        <div style={{background:"#162B45",borderBottom:"1px solid #2A4F7C",padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>⌚</span>
          <div style={{flex:1,fontSize:12,color:"#8BB4D8"}}>通知を許可するとApple Watchにも終了通知が届きます</div>
          <button onClick={handleEnableNotif} style={{background:"#4ECDC4",color:"#0D1B2A",border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>許可</button>
        </div>
      )}
      {tab==="today"&&<TodayPage weekday={weekday} weekend={weekend} logs={logs} setLogs={setLogs} comments={comments} setComments={setComments}/>}
      {tab==="routines"&&<RoutinesPage weekday={weekday} setWeekday={setWeekday} weekend={weekend} setWeekend={setWeekend}/>}
      {tab==="log"&&<LogPage weekday={weekday} weekend={weekend} logs={logs} comments={comments}/>}
      <TabBar tab={tab} setTab={setTab}/>
    </div>
  );
}