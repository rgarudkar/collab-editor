"use client";

import dynamic from "next/dynamic";
import { Suspense, useState, useRef, useEffect } from "react";
import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import * as Y from "yjs";

const CollaborativeEditor = dynamic(
  () => import("@/components/CollaborativeEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#1e1e1e]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-xs font-mono">Loading Editor...</p>
        </div>
      </div>
    ),
  }
);

const LANGS = [
  { value: "javascript", label: "JavaScript", ext: "js",  icon: "JS",  color: "text-yellow-400" },
  { value: "python",     label: "Python",     ext: "py",  icon: "PY",  color: "text-blue-400"   },
  { value: "cpp",        label: "C++",        ext: "cpp", icon: "C+",  color: "text-emerald-400"},
];

export default function RoomPage() {
  const params  = useParams();
  const router  = useRouter();
  const { data: session } = useSession();

  const [roomId,           setRoomId]           = useState<string | null>(null);
  const [hasMounted,       setHasMounted]       = useState(false);
  const [isCopied,         setIsCopied]         = useState(false);
  const [isExecuting,      setIsExecuting]      = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [outputLogs,       setOutputLogs]       = useState<string[]>([]);
  const [activeUsers,      setActiveUsers]      = useState<any[]>([]);
  const [outputOpen,       setOutputOpen]       = useState(true);

  const [updates,      setUpdates]      = useState<{ timestamp: number; update: Uint8Array }[]>([]);
  const [replayIndex,  setReplayIndex]  = useState(-1);
  const [previewValue, setPreviewValue] = useState("");
  const [ping, setPing] = useState(12);
  const [mem,  setMem]  = useState(248);

  const pushLogRef      = useRef<((logs: string[]) => void) | null>(null);
  const pushLanguageRef = useRef<((lang: string)  => void) | null>(null);
  const sharedOutputRef = useRef<string[]>([]);
  const ydocRef         = useRef<any>(null);
  const outputEndRef    = useRef<HTMLDivElement>(null);

  useEffect(() => { setHasMounted(true); }, []);
  useEffect(() => {
    const id = params?.id as string;
    if (!id) router.replace("/"); else setRoomId(id);
  }, [params, router]);
  useEffect(() => {
    const t = setInterval(() => {
      setPing(p => +(Math.max(8, Math.min(30, p + (Math.random() - 0.5) * 4)).toFixed(1)));
      setMem(m => Math.max(200, Math.min(500, m + (Math.random() - 0.5) * 10)));
    }, 2000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [outputLogs]);

  const handleYDocReady = React.useCallback((ydoc: any) => {
    ydocRef.current = ydoc;
    ydoc.on("update", (update: Uint8Array) =>
      setUpdates(prev => [...prev, { timestamp: Date.now(), update }])
    );
  }, []);
  const handleOutputChange   = React.useCallback((logs: string[]) => { sharedOutputRef.current = logs; setOutputLogs(logs); }, []);
  const handleLanguageChange = React.useCallback((lang: string)   => setSelectedLanguage(lang), []);
  const handlePushLogRef     = React.useCallback((fn: (logs: string[]) => void) => { pushLogRef.current = fn; }, []);
  const handlePushLanguageRef= React.useCallback((fn: (lang: string) => void)   => { pushLanguageRef.current = fn; }, []);

  const pushToSharedLogs = (newLogs: string[]) => {
    setOutputLogs(newLogs); pushLogRef.current?.(newLogs);
  };

  const handleRunCode = () => {
    const code = ydocRef.current?.getText("monaco")?.toString() ?? "";
    if (!code.trim()) { pushToSharedLogs(["Nothing to run — editor is empty."]); return; }
    setIsExecuting(true); setOutputOpen(true);

    if (selectedLanguage === "javascript") {
      pushToSharedLogs(["⚡ Running JavaScript locally..."]);
      const worker = new Worker(new URL("@/workers/jsWorker.ts", import.meta.url));
      worker.onmessage = (e) => {
        const { type, logs, result, error } = e.data;
        const out = [...logs];
        if (type === "success") { if (result !== null) out.push(`→ ${result}`); out.push("✓ Completed"); }
        else out.push(`✗ Error: ${error}`);
        pushToSharedLogs(out); setIsExecuting(false); worker.terminate();
      };
      worker.onerror = (err) => { pushToSharedLogs([`✗ Fatal: ${err.message}`]); setIsExecuting(false); worker.terminate(); };
      worker.postMessage({ code });
    } else {
      const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || `http://${host}:3002`;
      pushToSharedLogs([`⚡ Dispatching to ${selectedLanguage.toUpperCase()} execution cluster...`]);
      fetch(`${backendUrl}/api/execute`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: selectedLanguage, code }),
      })
        .then(r => r.json())
        .then(data => {
          const out: string[] = [];
          if (data.logs?.[0]) out.push(data.logs[0]);
          out.push(data.success ? "✓ Completed" : `✗ Error: ${data.error}`);
          pushToSharedLogs(out);
        })
        .catch(err => pushToSharedLogs([`✗ Network: ${err.message}`]))
        .finally(() => setIsExecuting(false));
    }
  };

  const handleShare = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); } catch {}
  };

  const handleTimeTravelChange = (index: number) => {
    const isLatest = index === updates.length - 1 || index === -1;
    setReplayIndex(isLatest ? -1 : index);
    if (isLatest) { setPreviewValue(""); return; }
    if (!ydocRef.current) return;
    const tmp = new Y.Doc();
    for (let i = 0; i <= index; i++) Y.applyUpdate(tmp, updates[i].update);
    setPreviewValue(tmp.getText("monaco").toString());
    handleOutputChange([`[Time Travel] Snapshot #${index + 1} / ${updates.length}`, ...sharedOutputRef.current.slice(0, 5)]);
  };

  const lang = LANGS.find(l => l.value === selectedLanguage) ?? LANGS[0];

  if (!roomId || !hasMounted) {
    return (
      <main className="min-h-screen bg-[#02040a] flex items-center justify-center">
        <div className="w-9 h-9 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="h-screen bg-[#02040a] text-slate-200 flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── TOP BAR ── */}
      <header className="h-12 shrink-0 flex items-center justify-between px-3 gap-2 bg-[#080d14] border-b border-white/[0.06] z-50">

        {/* Left: Logo + room */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <div className="w-6 h-6 rounded-[7px] bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-[11px] font-black text-white shadow-[0_0_12px_rgba(139,92,246,0.4)]">
              S
            </div>
            <span className="text-[13px] font-bold tracking-tight hidden sm:block">SyncWrite</span>
          </button>
          <div className="w-px h-5 bg-white/[0.08]" />
          <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.07] rounded-md px-2.5 py-1 font-mono">
            <span className="w-[5px] h-[5px] rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981] animate-pulse" />
            <span className="text-[11px] font-bold text-slate-300 tracking-widest">{roomId.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>

        {/* Center: File tab */}
        <div className="hidden md:flex items-center gap-2 bg-[#0d1421] border border-white/[0.07] rounded-lg px-4 py-1.5 font-mono text-[12px] text-slate-400">
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
            selectedLanguage === "javascript" ? "bg-yellow-500/15 text-yellow-400" :
            selectedLanguage === "python"     ? "bg-blue-500/15 text-blue-400" :
                                               "bg-emerald-500/15 text-emerald-400"
          }`}>{lang.icon}</span>
          <span>index.{lang.ext}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 opacity-70" />
        </div>

        {/* Right: Users + controls */}
        <div className="flex items-center gap-2">
          {/* Collaborators */}
          {activeUsers.length > 0 && (
            <div className="flex items-center mr-1">
              {activeUsers.slice(0, 4).map((u, i) => (
                <div
                  key={u.clientId}
                  title={`${u.name}${u.isMe ? " (You)" : ""}`}
                  className="relative w-7 h-7 rounded-full border-2 border-[#080d14] hover:-translate-y-1 hover:scale-110 transition-transform cursor-default"
                  style={{ marginLeft: i === 0 ? 0 : -6, zIndex: activeUsers.length - i }}
                >
                  {u.avatar
                    ? <img src={u.avatar} className="w-full h-full rounded-full object-cover" alt={u.name} />
                    : <div className="w-full h-full rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: u.color }}>{u.name[0]}</div>
                  }
                  <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#080d14]" style={{ background: u.color }} />
                </div>
              ))}
              {activeUsers.length > 4 && (
                <div className="w-7 h-7 rounded-full bg-slate-700 border-2 border-[#080d14] -ml-1.5 flex items-center justify-center text-[9px] font-bold text-slate-300">
                  +{activeUsers.length - 4}
                </div>
              )}
            </div>
          )}

          {/* Language selector */}
          <div className="flex items-center bg-white/[0.04] border border-white/[0.08] hover:border-purple-500/40 rounded-lg px-2.5 py-1.5 transition-colors">
            <select
              value={selectedLanguage}
              onChange={e => { setSelectedLanguage(e.target.value); pushLanguageRef.current?.(e.target.value); }}
              className="bg-transparent border-none outline-none text-[12px] font-semibold text-purple-400 cursor-pointer"
            >
              {LANGS.map(l => <option key={l.value} value={l.value} className="bg-[#0d1421]">{l.label}</option>)}
            </select>
          </div>

          {/* Run */}
          <button
            onClick={handleRunCode}
            disabled={isExecuting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed ${
              isExecuting
                ? "bg-blue-700 shadow-[0_0_16px_rgba(29,78,216,0.4)]"
                : "bg-green-700 hover:bg-green-600 shadow-[0_0_16px_rgba(22,163,74,0.35)] hover:shadow-[0_0_24px_rgba(22,163,74,0.55)] hover:-translate-y-px"
            }`}
          >
            {isExecuting ? (
              <span className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            )}
            {isExecuting ? "Running..." : "Run"}
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
              isCopied
                ? "bg-emerald-500/15 border border-emerald-500/35 text-emerald-400"
                : "bg-blue-500/10 border border-blue-500/25 text-blue-400 hover:bg-blue-500/18 hover:border-blue-500/45"
            }`}
          >
            {isCopied ? (
              <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>Copied!</>
            ) : (
              <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" strokeLinecap="round"/></svg>Share</>
            )}
          </button>

          {/* Sign out */}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            title="Sign out"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-white/10 text-slate-500 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Editor column */}
        <section className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#02040a]">
          {/* Breadcrumb */}
          <div className="h-7 shrink-0 flex items-center gap-1.5 px-4 bg-[#080d14] border-b border-white/[0.05] font-mono text-[11px]">
            <span className="text-white/20">workspace</span>
            <span className="text-white/12">/</span>
            <span className="text-slate-500">{roomId.slice(0, 8)}</span>
            <span className="text-white/12">/</span>
            <span className="text-blue-400 font-semibold">index.{lang.ext}</span>
            <div className="flex-1" />
            <span className="flex items-center gap-1.5 text-[10px] text-slate-600">
              <span className="w-[5px] h-[5px] rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981] animate-pulse" />
              WebRTC · {activeUsers.length} peer{activeUsers.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Monaco */}
          <div className="flex-1 relative overflow-hidden">
            <Suspense fallback={<div className="p-4 text-slate-600 text-xs">Loading...</div>}>
              <CollaborativeEditor
                roomName={roomId}
                language={selectedLanguage}
                readOnly={replayIndex !== -1}
                previewValue={previewValue}
                onLanguageChange={handleLanguageChange}
                onOutputChange={handleOutputChange}
                onPushLogRef={handlePushLogRef}
                onPushLanguageRef={handlePushLanguageRef}
                onYDocReady={handleYDocReady}
                onUsersChange={setActiveUsers}
              />
            </Suspense>

            {/* Time Travel */}
            {updates.length > 0 && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#0d1421]/90 backdrop-blur-md border border-white/[0.08] rounded-full px-4 py-2 shadow-2xl min-w-[260px]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <input
                  type="range"
                  min="0"
                  max={updates.length > 0 ? updates.length - 1 : 0}
                  value={replayIndex === -1 ? (updates.length > 0 ? updates.length - 1 : 0) : replayIndex}
                  onChange={e => handleTimeTravelChange(parseInt(e.target.value))}
                  className="flex-1 accent-purple-500 cursor-pointer"
                />
                <span className="text-[9px] font-bold text-purple-400 font-mono min-w-[28px] text-right">
                  {replayIndex === -1 ? "LIVE" : `T-${updates.length - replayIndex}`}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ── OUTPUT PANEL ── */}
        <aside
          className="shrink-0 bg-[#080d14] border-l border-white/[0.06] flex flex-col overflow-hidden transition-[width] duration-300 ease-in-out"
          style={{ width: outputOpen ? "300px" : "42px" }}
        >
          {/* Panel header — always visible */}
          <div className="h-10 shrink-0 flex items-center justify-between px-3 border-b border-white/[0.06] bg-white/[0.02]">
            {outputOpen && (
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-[11px] font-bold tracking-widest uppercase text-slate-500 whitespace-nowrap">Output</span>
                {outputLogs.length > 0 && (
                  <span className="text-[10px] font-bold bg-purple-500/15 text-purple-400 rounded px-1.5 py-0.5">{outputLogs.length}</span>
                )}
              </div>
            )}
            <div className={`flex items-center gap-1 ${outputOpen ? "" : "w-full justify-center"}`}>
              {outputOpen && outputLogs.length > 0 && (
                <button
                  onClick={() => pushToSharedLogs([])}
                  title="Clear"
                  className="p-1.5 rounded hover:bg-red-500/10 hover:text-red-400 text-slate-600 transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
              <button
                onClick={() => setOutputOpen(o => !o)}
                title={outputOpen ? "Collapse panel" : "Expand panel"}
                className="p-1.5 rounded hover:bg-white/[0.06] text-slate-500 hover:text-slate-300 transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d={outputOpen ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"} strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Content — only render when open */}
          {outputOpen && (
            <>
              {/* Terminal */}
              <div className="flex-1 p-3.5 font-mono text-[12px] leading-[1.7] overflow-y-auto overflow-x-hidden custom-scrollbar min-h-0">
                <div className="text-slate-700 text-[11px] mb-2">$ syncwrite run</div>
                {outputLogs.length === 0 ? (
                  <div className="text-slate-700 text-[12px]">Ready. Press Run to execute.</div>
                ) : (
                  outputLogs.map((log, i) => (
                    <div key={i} className={`mb-0.5 break-words ${
                      log.startsWith("✓") ? "text-emerald-400" :
                      log.startsWith("✗") ? "text-red-400" :
                      log.startsWith("⚡") ? "text-blue-400" :
                      log.startsWith("[Time") ? "text-purple-400" :
                      log.startsWith("→") ? "text-yellow-400" :
                      "text-slate-400"
                    }`}>{log}</div>
                  ))
                )}
                <div ref={outputEndRef} />
              </div>

              {/* Stats strip */}
              <div className="shrink-0 px-3.5 py-2.5 border-t border-white/[0.05] flex flex-col gap-2">
                {[
                  { label: "Latency", val: `${Math.round(ping)}ms`, pct: Math.min(100, (ping / 40) * 100), color: "bg-blue-500", textColor: "text-blue-400" },
                  { label: "Memory",  val: `${Math.round(mem)}MB`,  pct: Math.min(100, (mem / 1024) * 100), color: "bg-fuchsia-500", textColor: "text-fuchsia-400" },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-600 w-13 shrink-0">{s.label}</span>
                    <div className="flex-1 h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${s.color}`} style={{ width: `${s.pct}%` }} />
                    </div>
                    <span className={`text-[10px] font-bold font-mono w-10 text-right ${s.textColor}`}>{s.val}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ── STATUS BAR ── */}
      <footer className="h-[22px] shrink-0 bg-gradient-to-r from-blue-700 to-purple-700 flex items-center justify-between px-3 text-[9px] font-bold tracking-widest uppercase text-white/85">
        <div className="flex items-center gap-0">
          <span className="flex items-center gap-1 px-2 opacity-85 hover:opacity-100 transition-opacity">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" strokeLinecap="round"/>
            </svg>
            main
          </span>
          <span className="w-px h-3 bg-white/20" />
          <span className="flex items-center gap-1 px-2 opacity-85 hover:opacity-100 transition-opacity">
            <span className="w-[5px] h-[5px] rounded-full bg-green-400 shadow-[0_0_4px_#4ade80] animate-pulse" />
            {activeUsers.length} connected
          </span>
        </div>
        <div className="flex items-center gap-0">
          <span className="px-2 opacity-85">UTF-8</span>
          <span className="w-px h-3 bg-white/20" />
          <span className="px-2 opacity-85">Spaces: 2</span>
          <span className="w-px h-3 bg-white/20" />
          <span className="px-2 opacity-100">{lang.label}</span>
        </div>
      </footer>
    </main>
  );
}
