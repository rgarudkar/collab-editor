"use client";

import dynamic from "next/dynamic";
import { Suspense, useState, useRef, useEffect, useCallback } from "react";
import React from "react";
import { useParams, useRouter } from "next/navigation";
import NetworkHealthSparkline from "@/components/NetworkHealthSparkline";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import * as Y from "yjs";

// Dynamically import the collaborative editor to enable Code Splitting
// This keeps the initial load time fast since Monaco is heavy.
const CollaborativeEditor = dynamic(
  () => import("@/components/CollaborativeEditor"),
  {
    ssr: false, // Monaco doesn't run on the server
    loading: () => (
      <div className="w-full h-full min-h-[500px] flex items-center justify-center bg-white dark:bg-[#1e1e1e] rounded-xl border border-slate-200 dark:border-gray-700/50 shadow-2xl transition-colors">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 dark:text-gray-400 font-medium tracking-wide">
            Loading Editor Engine...
          </p>
        </div>
      </div>
    ),
  }
);

export default function Home() {
  const [outputLogs, setOutputLogs] = useState<string[]>([]);
  const sharedOutputRef = useRef<string[]>([]); // Keeps a ref to the latest shared logs for appending
  const pushLogRef = useRef<((logs: string[]) => void) | null>(null);
  const pushLanguageRef = useRef<((lang: string) => void) | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");

  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  // Room ID state
  const [roomId, setRoomId] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Live Stats State (Mocked)
  const [ping, setPing] = useState(12);
  const [mem, setMem] = useState(248);

  useEffect(() => {
    const interval = setInterval(() => {
      setPing(prev => Math.max(8, Math.min(30, prev + (Math.random() - 0.5) * 4)));
      setMem(prev => Math.max(200, Math.min(500, prev + (Math.random() - 0.5) * 10)));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Active Users State from Yjs
  const [activeUsers, setActiveUsers] = useState<any[]>([]);

  useEffect(() => {
    const roomParam = params?.id as string;
    if (!roomParam) {
      // If someone reaches here without an ID somehow, redirect to home
      router.replace(`/`);
    } else {
      setRoomId(roomParam);
    }
  }, [params, router]);

  // Time Travel State
  const [updates, setUpdates] = useState<{ timestamp: number; update: Uint8Array }[]>([]);
  const [replayIndex, setReplayIndex] = useState(-1);
  const [previewValue, setPreviewValue] = useState("");
  const ydocRef = useRef<any>(null);

  const handleYDocReady = React.useCallback((ydoc: any) => {
    ydocRef.current = ydoc;

    // Listen for all updates on the YDoc
    ydoc.on('update', (update: Uint8Array) => {
      setUpdates(prev => [...prev, { timestamp: Date.now(), update }]);
    });
  }, []);

  const handleTimeTravelChange = (index: number) => {
    const isLatest = index === updates.length - 1 || index === -1;
    setReplayIndex(isLatest ? -1 : index);

    if (isLatest) {
      setPreviewValue("");
      return;
    }

    if (!ydocRef.current) return;

    // Reconstruct state at index using the imported Y instance
    const tempDoc = new Y.Doc();
    for (let i = 0; i <= index; i++) {
      Y.applyUpdate(tempDoc, updates[i].update);
    }

    const snapshotText = tempDoc.getText("monaco").toString();
    setPreviewValue(snapshotText);

    const newLogs = [`[Time Travel]: Previewing state at update #${index + 1} / ${updates.length}`];
    handleOutputChange([...newLogs, ...sharedOutputRef.current.slice(0, 5)]);
  };

  const handleOutputChange = React.useCallback((logs: string[]) => {
    sharedOutputRef.current = logs;
    setOutputLogs(logs);
  }, []);

  const handleLanguageChange = React.useCallback((lang: string) => {
    setSelectedLanguage(lang);
  }, []);

  const handlePushLogRef = React.useCallback((fn: (logs: string[]) => void) => {
    pushLogRef.current = fn;
  }, []);

  const handlePushLanguageRef = React.useCallback((fn: (lang: string) => void) => {
    pushLanguageRef.current = fn;
  }, []);

  const pushToSharedLogs = (newLogs: string[]) => {
    // We update local state to reflect immediately.
    setOutputLogs(newLogs);

    // Broadcast via Yjs WebRTC Data Channels to everyone else
    if (pushLogRef.current) {
      pushLogRef.current(newLogs);
    }
  };

  const handleRunCode = () => {
    // We cannot rely on React state `currentCode` because it breaks Yjs cursor sync.
    // Instead we grab the actual code from the YDoc text type directly so it is always 
    // correct without causing re-renders.
    const ytext = ydocRef.current?.getText("monaco");
    const codeToRun = ytext ? ytext.toString() : "";

    if (!codeToRun.trim()) {
      pushToSharedLogs(["Please enter some code to run."]);
      return;
    }

    setIsExecuting(true);

    if (selectedLanguage === "javascript") {
      pushToSharedLogs(["Initializing local JS sandbox environment...", "Running code..."]);

      // Spawn a local worker
      const worker = new Worker(new URL("@/workers/jsWorker.ts", import.meta.url));

      worker.onmessage = (e) => {
        const { type, logs, result, error } = e.data;

        let finalLogs = [...logs];
        if (type === "success") {
          if (result !== null) finalLogs.push(`=> ${result}`);
          finalLogs.push(`\n[Execution completed successfully]`);
        } else {
          finalLogs.push(`\n[Error]: ${error}`);
        }

        // We update the shared logs, replacing the "Running code..." message
        pushToSharedLogs(finalLogs);

        setIsExecuting(false);
        worker.terminate();
      };

      worker.onerror = (err) => {
        pushToSharedLogs([...sharedOutputRef.current, `\n[Fatal Worker Error]: ${err.message}`]);
        setIsExecuting(false);
        worker.terminate();
      };

      worker.postMessage({ code: codeToRun });

      setTimeout(() => {
        if (isExecuting) {
          pushToSharedLogs([...sharedOutputRef.current, "\n[Execution Timeout: Script ran for more than 5 seconds and was killed.]"]);
          setIsExecuting(false);
          worker.terminate();
        }
      }, 5000);

    } else {
      // Remote Execution via our Backend
      pushToSharedLogs([`Connecting to execution cluster for ${selectedLanguage}...`, "Sending payload..."]);

      const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || `http://${host}:3002`;

      fetch(`${backendUrl}/api/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: selectedLanguage, code: codeToRun })
      })
        .then(res => res.json())
        .then(data => {
          let finalLogs: string[] = [];
          if (data.logs && data.logs.length > 0 && data.logs[0]) {
            finalLogs.push(data.logs[0]);
          }
          if (data.success) {
            finalLogs.push(`\n[Execution completed successfully]`);
          } else {
            finalLogs.push(`\n[Error]: ${data.error}`);
          }

          pushToSharedLogs(finalLogs);
        })
        .catch(err => {
          pushToSharedLogs([...sharedOutputRef.current, `\n[Fatal Network Error]: ${err.message}`]);
        })
        .finally(() => {
          setIsExecuting(false);
        });
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
    }
  };

  if (!roomId || !hasMounted) {
    // Prevent rendering the editor until we have a room ID and client has mounted
    return (
      <main className="min-h-screen bg-[#02040a] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </main>
    );
  }

  return (
    <main className="h-screen bg-[#02040a] text-white flex flex-col font-sans selection:bg-blue-500/30 overflow-hidden">
      {/* 1. Top Navigation Bar */}
      <header className="h-12 border-b border-white/5 bg-[#0d1117] flex items-center justify-between px-3 shrink-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => router.push('/')}>
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
              <span className="text-[10px] font-bold">S</span>
            </div>
            <span className="font-bold tracking-tight text-sm">SyncWrite IDE</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex -space-x-2 mr-2">
            {activeUsers.slice(0, 3).map((u) => (
              <div
                key={u.clientId}
                className="w-6 h-6 rounded-full border-2 border-[#0d1117] relative group"
                style={{ backgroundColor: u.color }}
              >
                {u.avatar ? (
                  <img src={u.avatar} className="w-full h-full rounded-full" alt={u.name} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[8px] font-bold">{u.name[0]}</div>
                )}
                {/* Premium Tooltip */}
                <div className="absolute top-[120%] left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-[100]">
                   <div className="w-1.5 h-1.5 bg-gray-900 rotate-45 border-l border-t border-white/10 -mb-[4px] relative z-20"></div>
                   <div className="bg-gray-900 text-[9px] font-bold text-white px-2 py-1 rounded shadow-xl border border-white/10 whitespace-nowrap relative z-10">
                     {u.name} {u.isMe ? "(You)" : ""}
                   </div>
                </div>
              </div>
            ))}
            {activeUsers.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-gray-700 border-2 border-[#0d1117] flex items-center justify-center text-[8px]">
                +{activeUsers.length - 3}
              </div>
            )}
          </div>

          <button
            onClick={handleShare}
            className={`h-7 px-3 text-[10px] font-bold rounded flex items-center gap-2 transition-all ${isCopied ? "bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]" : "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30"}`}
          >
            {isCopied ? (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                COPIED
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                SHARE
              </>
            )}
          </button>

          <div className="flex items-center gap-3 border-l border-white/10 pl-4 h-6">
            <ThemeToggle />
            <img
              src={session?.user?.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session?.user?.name || 'Guest'}`}
              className="w-7 h-7 rounded-full border border-white/10 cursor-pointer"
              title="Profile"
              onClick={() => signOut({ callbackUrl: '/' })}
            />
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden lg:flex-row flex-col">
        {/* 2. Left Activity Bar */}
        <aside className="w-12 border-r border-white/5 bg-[#0d1117] flex-col items-center py-4 gap-6 hidden md:flex shrink-0">
          <div className="text-gray-400 hover:text-blue-400 cursor-pointer transition-colors p-2 rounded-lg hover:bg-white/5"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h18" strokeWidth="2" strokeLinecap="round" /></svg></div>
          <div className="text-blue-400 cursor-pointer p-2 rounded-lg bg-white/5"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round" /></svg></div>
          <div className="text-gray-500 hover:text-white cursor-not-allowed p-2 rounded-lg opacity-50"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6" strokeWidth="2" strokeLinecap="round" /></svg></div>
          <div className="mt-auto text-gray-400 hover:text-white cursor-pointer p-2 rounded-lg transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth="2" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2" /></svg></div>
          <div className="text-gray-400 hover:text-white cursor-pointer p-2 rounded-lg transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" /></svg></div>
        </aside>

        {/* 3. Main Editor Area */}
        <section className="flex-1 flex flex-col min-w-0 bg-[#02040a] relative">
          {/* Editor Header / Tabs */}
          <div className="h-9 bg-[#0d1117] flex items-center px-2 shrink-0 border-b border-white/5">
            <div className="flex items-center h-full bg-[#02040a] border-t-2 border-blue-500 px-4 gap-2 text-[10px] font-medium tracking-wide">
              <span className="text-blue-500 font-bold">
                {selectedLanguage === 'javascript' ? 'JS' : selectedLanguage === 'python' ? 'PY' : 'C++'}
              </span>
              <span>index.{selectedLanguage === 'python' ? 'py' : selectedLanguage === 'cpp' ? 'cpp' : 'js'}</span>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div className="relative flex items-center bg-white/5 border border-white/10 rounded px-2 py-0.5 gap-2 group hover:border-blue-500/50 transition-colors">
                <span className="text-[9px] font-bold text-gray-500 uppercase">Lang</span>
                <select
                  value={selectedLanguage}
                  onChange={(e) => {
                    setSelectedLanguage(e.target.value);
                    if (pushLanguageRef.current) pushLanguageRef.current(e.target.value);
                  }}
                  className="bg-transparent text-[10px] text-blue-400 font-bold outline-none cursor-pointer"
                >
                  <option value="javascript" className="bg-[#0b0e14]">JavaScript</option>
                  <option value="python" className="bg-[#0b0e14]">Python</option>
                  <option value="cpp" className="bg-[#0b0e14]">C++</option>
                </select>
              </div>
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="h-6 flex items-center px-4 gap-2 text-[10px] text-gray-500 bg-[#02040a] shrink-0 border-b border-white/5">
            <span className="text-blue-500/50 uppercase tracking-tighter">Room</span>
            <span className="text-gray-600">/</span>
            <span className="text-gray-300">workspace_{roomId?.slice(0, 6)}</span>
            <span className="text-gray-600">/</span>
            <span className="text-blue-400">index.{selectedLanguage === 'python' ? 'py' : selectedLanguage === 'cpp' ? 'cpp' : 'js'}</span>
          </div>

          {/* Actual Editor Wrapper */}
          <div className="flex-1 relative overflow-hidden">
            <Suspense fallback={<div className="p-4 text-gray-500 text-xs">Loading Editor Environment...</div>}>
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

            {/* Floating Time Travel UI (Centered at bottom) */}
            {updates.length > 0 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[100] w-72 bg-[#161b22]/90 backdrop-blur-md border border-white/10 rounded-full h-10 px-4 flex items-center gap-4 shadow-2xl">
                <svg className="w-3 h-3 text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <input
                  type="range"
                  min="0"
                  max={updates.length > 0 ? updates.length - 1 : 0}
                  value={replayIndex === -1 ? (updates.length > 0 ? updates.length - 1 : 0) : replayIndex}
                  onChange={(e) => handleTimeTravelChange(parseInt(e.target.value))}
                  className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
                />
                <span className="text-[9px] font-bold text-gray-400 whitespace-nowrap min-w-[30px]">
                  {replayIndex === -1 ? 'LIVE' : `T-${updates.length - replayIndex}`}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* 4. Right Side-Panel (Multi-tool) */}
        <aside className="lg:w-80 w-full border-l border-white/5 bg-[#0d1117] flex flex-col shrink-0">
          {/* Header */}
          <div className="h-9 flex items-center justify-between px-4 border-b border-white/5 bg-[#0d1117] shrink-0">
            <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Execution Output</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              <span className="text-[9px] font-bold text-emerald-500 uppercase">Success</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto custom-scrollbar">
            {/* Run Button Zone */}
            <div className="flex gap-2">
              <button
                onClick={handleRunCode}
                disabled={isExecuting}
                className="flex-1 bg-blue-600 hover:bg-blue-500 h-8 rounded text-[10px] font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {isExecuting ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : 'RUN CODE'}
              </button>
              <button className="w-8 bg-white/5 hover:bg-white/10 rounded flex items-center justify-center text-gray-400 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            </div>

            {/* Terminal View */}
            <div className="flex-1 bg-black/40 rounded border border-white/5 p-3 font-mono text-[11px] text-gray-300 min-h-[200px] shadow-inner selection:bg-purple-500/20">
              <div className="text-blue-400 mb-2">$ npm run build:syncwrite</div>
              {outputLogs.length === 0 ? (
                <div className="opacity-30">Ready for execution...</div>
              ) : (
                outputLogs.map((log, i) => <div key={i} className="mb-1">{log}</div>)
              )}
            </div>

            {/* Network Stats Card */}
            <div className="bg-white/5 border border-white/5 rounded-lg p-3">
              <div className="text-[9px] font-bold text-gray-500 uppercase mb-3 tracking-widest">Network Stats</div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-gray-400">Sync Latency</span>
                    <span className="text-blue-400">{Math.round(ping)}ms</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.min(100, (ping / 40) * 100)}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-gray-400">Memory Usage</span>
                    <span className="text-pink-400">{Math.round(mem)}MB</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-pink-500 transition-all duration-1000" style={{ width: `${Math.min(100, (mem / 1024) * 100)}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* 5. Bottom Status Bar */}
      <footer className="h-6 bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-between px-3 text-[9px] font-bold tracking-wide uppercase shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 h-full px-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" strokeWidth="2" strokeLinecap="round" /></svg>
            <span>main*</span>
          </div>
          <div className="flex items-center gap-1.5 h-full px-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" strokeWidth="2" strokeLinecap="round" /></svg>
            <span>Up to date</span>
          </div>
        </div>

        <div className="flex items-center gap-4 h-full">
          <span>Spaces: 2</span>
          <span>UTF-8</span>
          <span>{selectedLanguage.toUpperCase()}</span>
          <div className="flex items-center gap-1.5 h-full bg-black/20 px-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Connected: {activeUsers.length} Nodes</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
