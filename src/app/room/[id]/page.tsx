"use client";

import dynamic from "next/dynamic";
import { Suspense, useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import NetworkHealthSparkline from "@/components/NetworkHealthSparkline";
import { UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/ThemeToggle";

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

  // Room ID state
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

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
  const ydocRef = useRef<any>(null);

  const handleYDocReady = (ydoc: any) => {
    ydocRef.current = ydoc;

    // Listen for all updates on the YDoc
    ydoc.on('update', (update: Uint8Array) => {
      setUpdates(prev => [...prev, { timestamp: Date.now(), update }]);
    });
  };

  const handleTimeTravelChange = (index: number) => {
    setReplayIndex(index);
    if (!ydocRef.current) return;

    // To time travel, we essentially need a fresh document to apply updates to, 
    // or we manage it carefully. For simplicity in a local demo, we can just log the action,
    // as full time-travel in Yjs usually requires destroying and recreating the YDoc/Binding 
    // or using a separate readonly YDoc.

    // In a full implementation: 
    // 1. Unbind editor
    // 2. Create new YDoc
    // 3. Apply updates 0 to `index`
    // 4. Bind editor as readonly
    // 4. Bind editor as readonly
    const newLogs = [`[Time Travel]: Previewing state at update #${index + 1} / ${updates.length}`, ...sharedOutputRef.current];
    pushToSharedLogs(newLogs);
  };

  const handleOutputChange = (logs: string[]) => {
    sharedOutputRef.current = logs;
    setOutputLogs(logs);
  };

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
  };

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

  if (!roomId) {
    // Prevent rendering the editor until we have a room ID to avoid split-brain
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-gradient-to-br dark:from-[#0d1117] dark:to-[#161b22] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-gradient-to-br dark:from-[#0d1117] dark:to-[#161b22] text-slate-800 dark:text-white p-4 md:p-8 flex flex-col font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-gray-800">
        <div>
          <h1
            onClick={() => router.push('/')}
            className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-500 tracking-tight cursor-pointer hover:opacity-80 transition-opacity"
          >
            SyncWrite Pro
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-gray-400 mt-1 flex items-center gap-2">
            Real-time collaborative code environment
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] uppercase font-bold tracking-wider">Room: {roomId}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-slate-200 dark:border-gray-700/50 backdrop-blur-sm">
            <NetworkHealthSparkline />
          </div>
          <button
            onClick={handleShare}
            className={`px-3 md:px-4 py-2 text-xs md:text-sm font-semibold rounded-lg shadow-sm transition-all duration-200 flex items-center gap-2 text-white
              ${isCopied ? "bg-emerald-600 hover:bg-emerald-500" : "bg-blue-600 hover:bg-blue-500"}`}
          >
            {isCopied ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                <span className="hidden sm:inline">Share Session</span>
              </>
            )}
          </button>

          {/* Controls: Theme & User */}
          <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-slate-200 dark:border-gray-700">
            <ThemeToggle />
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8 md:w-9 md:h-9 border border-slate-200 dark:border-gray-700 shadow-sm"
                }
              }}
            />
          </div>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 w-full pb-8">
        {/* Editor Section */}
        <section className="flex-[2] rounded-xl relative flex flex-col min-h-[500px] lg:min-h-0 shadow-sm dark:shadow-none">
          <div className="absolute -inset-[1px] bg-gradient-to-b from-blue-200 to-purple-200 dark:from-blue-500/20 dark:to-purple-500/20 rounded-xl z-0 blur-sm"></div>
          <div className="relative z-10 w-full h-full p-1 bg-white dark:bg-[#1e1e1e]/90 rounded-xl shadow-xl dark:shadow-none backdrop-blur-md border border-slate-200 dark:border-transparent flex flex-col">
            {/* Header bar for editor */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-[#252526] rounded-t-lg border-b border-slate-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-500 dark:text-gray-400">index.{selectedLanguage === 'python' ? 'py' : selectedLanguage === 'cpp' ? 'cpp' : 'js'}</span>

                {/* Language Selector */}
                <select
                  value={selectedLanguage}
                  onChange={(e) => {
                    setSelectedLanguage(e.target.value);
                    if (pushLanguageRef.current) {
                      pushLanguageRef.current(e.target.value);
                    }
                  }}
                  className="bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-300 text-xs rounded px-2 py-1 outline-none appearance-none cursor-pointer hover:border-slate-400 dark:hover:border-gray-500 transition-colors shadow-sm dark:shadow-none"
                >
                  <option value="javascript">JavaScript (Local)</option>
                  <option value="python">Python (Remote)</option>
                  <option value="cpp">C++ (Remote)</option>
                </select>
              </div>

              <div className="flex gap-2">
                {/* Visual placeholder for peer connection logic */}
                {activeUsers.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-gray-500 animate-pulse">
                    <span>Connecting peers...</span>
                  </div>
                ) : (
                  // Removed overflow-hidden so tooltips can escape the boundary
                  <div className="flex -space-x-3 sm:-space-x-2 px-2">
                    {activeUsers.map((u, i) => (
                      <div
                        key={u.clientId}
                        className="w-8 h-8 md:w-9 md:h-9 rounded-full border-[2.5px] border-slate-100 dark:border-[#1e1e1e] bg-slate-200 dark:bg-gray-800 relative group cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:scale-110 hover:z-40 shadow-sm hover:shadow-lg"
                        style={{ borderColor: u.color }}
                      >
                        {u.avatar ? (
                          <img src={u.avatar} alt={u.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-white rounded-full bg-slate-700" style={{ backgroundColor: u.color }}>
                            {u.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}

                        {/* Premium Tooltip */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 pointer-events-none z-50 flex flex-col items-center">
                          {/* Tooltip Arrow */}
                          <div className="w-2 h-2 -mb-1 rotate-45 border-t border-l border-white/10 dark:border-white/10" style={{ backgroundColor: u.color }}></div>
                          {/* Tooltip Body */}
                          <div
                            className="text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-xl backdrop-blur-md whitespace-nowrap border border-white/20"
                            style={{ backgroundColor: u.color.replace('hsl', 'hsla').replace(')', ', 0.9)') }}
                          >
                            {u.name} {u.isMe && <span className="opacity-75 font-normal ml-1">(You)</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 w-full relative overflow-hidden">
              <Suspense fallback={<div className="p-4 text-slate-500 dark:text-gray-400">Loading editor environment...</div>}>
                <CollaborativeEditor
                  roomName={roomId}
                  language={selectedLanguage}
                  onLanguageChange={handleLanguageChange}
                  onOutputChange={handleOutputChange}
                  onPushLogRef={(fn) => (pushLogRef.current = fn)}
                  onPushLanguageRef={(fn) => (pushLanguageRef.current = fn)}
                  onYDocReady={handleYDocReady}
                  onUsersChange={setActiveUsers}
                />
              </Suspense>
            </div>
          </div>
        </section>

        {/* Sidebar / Tools Section */}
        <aside className="w-full lg:w-80 flex flex-col gap-6 shrink-0 lg:h-auto overflow-visible">
          {/* Output / Execution Area */}
          <div className="bg-white/80 dark:bg-[#161b22]/80 border border-slate-200 dark:border-gray-800 rounded-xl p-4 flex-1 backdrop-blur-md shadow-lg dark:shadow-xl flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-300">Execution Output</h2>
              <button
                onClick={handleRunCode}
                disabled={isExecuting}
                className="text-xs px-3 py-1.5 bg-green-100 dark:bg-green-600/20 hover:bg-green-200 dark:hover:bg-green-600/40 border border-green-300 dark:border-green-500/50 rounded transition-colors text-green-700 dark:text-green-400 font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 shadow-sm"
              >
                {isExecuting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-green-600 dark:border-green-400 border-t-transparent rounded-full animate-spin"></span>
                    Running...
                  </>
                ) : (
                  `► Run ${selectedLanguage === 'javascript' ? 'Local' : 'Remote'}`
                )}
              </button>
            </div>
            <div className="flex-1 bg-slate-50 dark:bg-black/40 rounded-lg border border-slate-200 dark:border-gray-800/50 p-3 font-mono text-xs text-slate-600 dark:text-gray-400 overflow-y-auto whitespace-pre-wrap shadow-inner">
              {outputLogs.length === 0 ? (
                <span className="opacity-50">{"> Ready for execution..."}</span>
              ) : (
                outputLogs.map((log, i) => (
                  <div key={i} className={`mb-1 ${log.includes('[Error]') || log.includes('Timeout') ? 'text-red-500 dark:text-red-400 font-medium' : log.includes('successfully') ? 'text-emerald-600 dark:text-green-400/80 font-medium' : ''}`}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Time Travel / Debugging Panel */}
          <div className="h-44 bg-white/80 dark:bg-[#161b22]/80 border border-slate-200 dark:border-gray-800 rounded-xl p-4 backdrop-blur-md shadow-lg dark:shadow-xl flex flex-col">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-300 mb-1 flex items-center justify-between">
              <span>Time-Travel Debugging</span>
              <span className="text-xs bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-500/30">
                {updates.length} states saved
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-gray-500 mb-4 leading-relaxed">
              Drag the slider to preview the interview history state. In production, these are stored in MongoDB.
            </p>
            <div className="mt-auto">
              <input
                type="range"
                min="0"
                max={updates.length > 0 ? updates.length - 1 : 0}
                value={replayIndex === -1 ? (updates.length > 0 ? updates.length - 1 : 0) : replayIndex}
                onChange={(e) => handleTimeTravelChange(parseInt(e.target.value))}
                disabled={updates.length <= 1}
                className="w-full accent-purple-600 dark:accent-purple-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer mb-2"
              />
              <div className="flex justify-between text-[10px] text-slate-400 dark:text-gray-500 uppercase tracking-widest font-semibold">
                <span>Start</span>
                <span>Current</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
