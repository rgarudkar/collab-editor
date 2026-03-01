"use client";

import dynamic from "next/dynamic";
import { Suspense, useState, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import NetworkHealthSparkline from "@/components/NetworkHealthSparkline";

// Dynamically import the collaborative editor to enable Code Splitting
// This keeps the initial load time fast since Monaco is heavy.
const CollaborativeEditor = dynamic(
  () => import("@/components/CollaborativeEditor"),
  {
    ssr: false, // Monaco doesn't run on the server
    loading: () => (
      <div className="w-full h-full min-h-[500px] flex items-center justify-center bg-[#1e1e1e] rounded-xl border border-gray-700/50 shadow-2xl">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 font-medium tracking-wide">
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

  const searchParams = useSearchParams();
  const router = useRouter();

  // Room ID state
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const roomParam = searchParams.get("room");
    if (!roomParam) {
      // Generate a simple unique ID
      const newRoomId = Math.random().toString(36).substring(2, 10);
      router.replace(`/?room=${newRoomId}`);
    } else {
      setRoomId(roomParam);
    }
  }, [searchParams, router]);

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
      <main className="min-h-screen bg-gradient-to-br from-[#0d1117] to-[#161b22] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0d1117] to-[#161b22] text-white p-4 md:p-8 flex flex-col font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 tracking-tight">
            SyncWrite Pro
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-time collaborative code environment
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-800/50 rounded-lg border border-gray-700/50 backdrop-blur-sm">
            <NetworkHealthSparkline />
          </div>
          <button
            onClick={handleShare}
            className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all duration-200 flex items-center gap-2
              ${isCopied ? "bg-green-600 hover:bg-green-500" : "bg-blue-600 hover:bg-blue-500"}`}
          >
            {isCopied ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                Copied Link!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                Share Session
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 h-full min-h-0">
        {/* Editor Section */}
        <section className="flex-1 rounded-xl glass-panel relative flex flex-col min-h-[500px]">
          <div className="absolute -inset-[1px] bg-gradient-to-b from-blue-500/20 to-purple-500/20 rounded-xl z-0 blur-sm"></div>
          <div className="relative z-10 w-full h-full p-1 bg-[#1e1e1e]/90 rounded-xl backdrop-blur-md">
            {/* Header bar for editor */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#252526] rounded-t-lg border-b border-gray-800">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-gray-400">index.{selectedLanguage === 'python' ? 'py' : selectedLanguage === 'cpp' ? 'cpp' : 'js'}</span>

                {/* Language Selector */}
                <select
                  value={selectedLanguage}
                  onChange={(e) => {
                    setSelectedLanguage(e.target.value);
                    if (pushLanguageRef.current) {
                      pushLanguageRef.current(e.target.value);
                    }
                  }}
                  className="bg-[#1e1e1e] border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 outline-none appearance-none cursor-pointer hover:border-gray-500 transition-colors"
                >
                  <option value="javascript">JavaScript (Local)</option>
                  <option value="python">Python (Remote)</option>
                  <option value="cpp">C++ (Remote)</option>
                </select>
              </div>

              <div className="flex gap-2">
                {/* Placeholder for active users icons */}
                <div className="w-6 h-6 rounded-full bg-orange-500 border-2 border-[#252526] -ml-2 first:ml-0 z-20"></div>
                <div className="w-6 h-6 rounded-full bg-purple-500 border-2 border-[#252526] -ml-2 z-10"></div>
              </div>
            </div>

            <div className="flex-1 w-full relative overflow-hidden">
              <Suspense fallback={<div className="p-4 text-gray-400">Loading editor environment...</div>}>
                <CollaborativeEditor
                  roomName={roomId}
                  language={selectedLanguage}
                  onLanguageChange={handleLanguageChange}
                  onOutputChange={handleOutputChange}
                  onPushLogRef={(fn) => (pushLogRef.current = fn)}
                  onPushLanguageRef={(fn) => (pushLanguageRef.current = fn)}
                  onYDocReady={handleYDocReady}
                />
              </Suspense>
            </div>
          </div>
        </section>

        {/* Sidebar / Tools Section */}
        <aside className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
          {/* Output / Execution Area */}
          <div className="bg-[#161b22]/80 border border-gray-800 rounded-xl p-4 flex-1 backdrop-blur-md shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-300">Execution Output</h2>
              <button
                onClick={handleRunCode}
                disabled={isExecuting}
                className="text-xs px-3 py-1.5 bg-green-600/20 hover:bg-green-600/40 border border-green-500/50 rounded transition-colors text-green-400 font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {isExecuting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></span>
                    Running...
                  </>
                ) : (
                  `► Run ${selectedLanguage === 'javascript' ? 'Local' : 'Remote'}`
                )}
              </button>
            </div>
            <div className="flex-1 bg-black/40 rounded-lg border border-gray-800/50 p-3 font-mono text-xs text-gray-400 overflow-y-auto whitespace-pre-wrap">
              {outputLogs.length === 0 ? (
                <span className="opacity-50">{"> Ready for execution..."}</span>
              ) : (
                outputLogs.map((log, i) => (
                  <div key={i} className={`mb-1 ${log.includes('[Error]') || log.includes('Timeout') ? 'text-red-400' : log.includes('successfully') ? 'text-green-400/80' : ''}`}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Time Travel / Debugging Panel */}
          <div className="h-44 bg-[#161b22]/80 border border-gray-800 rounded-xl p-4 backdrop-blur-md shadow-xl flex flex-col">
            <h2 className="text-sm font-semibold text-gray-300 mb-1 flex items-center justify-between">
              <span>Time-Travel Debugging</span>
              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded border border-purple-500/30">
                {updates.length} states saved
              </span>
            </h2>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
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
                className="w-full accent-purple-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer mb-2"
              />
              <div className="flex justify-between text-[10px] text-gray-500">
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
