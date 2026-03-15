"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/ThemeToggle";

const useTypewriter = (texts: string[], typingSpeed: number = 80, delayBetweenTexts: number = 500) => {
    const [displayedText1, setDisplayedText1] = useState("");
    const [displayedText2, setDisplayedText2] = useState("");
    const [currentTextIndex, setCurrentTextIndex] = useState(0);

    useEffect(() => {
        if (currentTextIndex === 0) {
            if (displayedText1.length < texts[0].length) {
                const timeout = setTimeout(() => setDisplayedText1(texts[0].slice(0, displayedText1.length + 1)), typingSpeed);
                return () => clearTimeout(timeout);
            } else {
                const timeout = setTimeout(() => setCurrentTextIndex(1), delayBetweenTexts);
                return () => clearTimeout(timeout);
            }
        } else if (currentTextIndex === 1) {
            if (displayedText2.length < texts[1].length) {
                const timeout = setTimeout(() => setDisplayedText2(texts[1].slice(0, displayedText2.length + 1)), typingSpeed);
                return () => clearTimeout(timeout);
            }
        }
    }, [displayedText1, displayedText2, currentTextIndex, texts, typingSpeed, delayBetweenTexts]);

    return { displayedText1, displayedText2, isFinished: currentTextIndex === 1 && displayedText2.length === texts[1].length };
};

export default function LandingPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [roomIdInput, setRoomIdInput] = useState("");
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

    const { displayedText1, displayedText2, isFinished } = useTypewriter(["Code Together.", "Execute Anywhere."], 70, 400);

    const handleCreateRoom = () => {
        const newRoomId = Math.random().toString(36).substring(2, 10);
        router.push(`/room/${newRoomId}`);
    };

    const handleJoinRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if (roomIdInput.trim()) {
            router.push(`/room/${roomIdInput.trim()}`);
        }
    };

    return (
        <div className="min-h-screen font-sans bg-brand-dark text-white selection:bg-brand-purple selection:text-white overflow-x-hidden relative">
            {/* Background Decor */}
            <div className="fixed inset-0 grid-bg pointer-events-none z-0"></div>

            {/* Header */}
            <header className="fixed top-0 w-full z-50 border-b border-white/10 bg-brand-dark/80 backdrop-blur-md">
                <nav className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-brand-purple to-brand-blue rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.5)]">
                            <span className="font-bold text-lg">S</span>
                        </div>
                        <span className="text-xl font-bold tracking-tight">SyncWrite Pro</span>
                    </div>

                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                        <a className="hover:text-white transition-colors" href="#">Features</a>
                        <a className="hover:text-white transition-colors" href="#">Integrations</a>
                        <a className="hover:text-white transition-colors" href="#">Enterprise</a>
                        <a className="hover:text-white transition-colors" href="#">Docs</a>
                    </div>

                    <div className="flex items-center gap-4">
                        {status === "unauthenticated" && (
                            <button onClick={() => setIsLoginModalOpen(true)} className="px-5 py-2 text-sm font-semibold bg-white text-black rounded-full hover:bg-gray-200 transition-all">Sign In</button>
                        )}
                        {status === "authenticated" && (
                            <div className="relative group cursor-pointer">
                                <img
                                    src={session?.user?.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session?.user?.name}`}
                                    alt="User Avatar"
                                    className="w-9 h-9 rounded-full border-2 border-brand-dark shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-transform hover:scale-105"
                                    onClick={() => signOut()}
                                    title="Click to Sign Out"
                                />
                            </div>
                        )}
                    </div>
                </nav>
            </header>

            {/* Main Content */}
            <main className="relative pt-32 pb-20 z-10 font-sans">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-brand-purple/20 blur-[120px] rounded-full -z-10 opacity-50"></div>

                {/* Hero Section */}
                <section className="max-w-7xl mx-auto px-6 text-center">
                    {/* Status Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111] border border-white/5 text-xs font-medium mb-10 shadow-sm"
                    >
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                        <span className="text-gray-300">WebRTC Real-time Engine Active</span>
                        <span className="text-white ml-2 font-semibold">127 Peers Online</span>
                    </motion.div>

                    <h1 className="text-5xl md:text-8xl font-black mb-6 tracking-tight leading-tight flex flex-col items-center justify-center min-h-[120px] md:min-h-[220px]">
                        <div className="flex items-center justify-center">
                            <span>{displayedText1}</span>
                            {displayedText2.length === 0 && !isFinished && (
                                <span className="inline-block w-[3px] md:w-[6px] h-[40px] md:h-[80px] bg-brand-blue ml-1 md:ml-3 animate-[pulse_0.8s_ease-in-out_infinite]"></span>
                            )}
                        </div>
                        <div className="flex items-center justify-center group mt-2">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-purple via-[#a855f7] to-[#818cf8] animate-glow">
                                {displayedText2}
                            </span>
                            {displayedText2.length > 0 && !isFinished && (
                                <span className="inline-block w-[3px] md:w-[6px] h-[40px] md:h-[80px] bg-brand-accent ml-1 md:ml-3 animate-[pulse_0.8s_ease-in-out_infinite]"></span>
                            )}
                        </div>
                    </h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={isFinished ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="max-w-2xl mx-auto text-lg md:text-xl text-gray-400 mb-12"
                    >
                        The ultimate peer-to-peer collaborative editor. Write code with your team, see live cursors, and execute algorithms instantly over WebSockets.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={isFinished ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                        className="flex flex-col md:flex-row items-center justify-center gap-4 mb-16"
                    >
                        <button onClick={handleCreateRoom} className="relative w-full md:w-auto px-6 py-3 bg-brand-purple hover:bg-[#7c3aed] text-white rounded-lg font-bold shadow-[0_0_30px_rgba(139,92,246,0.5)] hover:shadow-[0_0_40px_rgba(139,92,246,0.7)] hover:scale-105 transition-all duration-300 outline-none border border-transparent flex items-center justify-center gap-2 text-sm z-10 group">
                            <span className="absolute inset-0 rounded-lg shadow-[0_0_20px_rgba(139,92,246,0.5)] animate-pulse -z-10"></span>
                            <svg className="w-4 h-4 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                            Start Coding Now
                        </button>

                        <span className="text-gray-500 font-mono">OR</span>

                        <form onSubmit={handleJoinRoom} className="relative group w-full md:w-64">
                            <input
                                value={roomIdInput}
                                onChange={(e) => setRoomIdInput(e.target.value)}
                                className="w-full bg-[#111] border border-white/5 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/50 text-white placeholder-gray-500 shadow-sm"
                                placeholder="Paste Room ID..."
                                type="text"
                            />
                            <button type="submit" disabled={!roomIdInput.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white disabled:opacity-30 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                            </button>
                        </form>
                    </motion.div>

                    {/* Social Proof */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={isFinished ? { opacity: 1 } : { opacity: 0 }}
                        transition={{ duration: 1, delay: 0.6 }}
                        className="flex items-center justify-center gap-3 mb-24"
                    >
                        <div className="flex -space-x-2">
                            <img alt="User" className="w-8 h-8 rounded-full border-2 border-brand-dark" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" />
                            <img alt="User" className="w-8 h-8 rounded-full border-2 border-brand-dark" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Luna" />
                            <img alt="User" className="w-8 h-8 rounded-full border-2 border-brand-dark" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alex" />
                            <img alt="User" className="w-8 h-8 rounded-full border-2 border-brand-dark" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" />
                        </div>
                        <p className="text-sm text-gray-500">Joined by <span className="text-white font-semibold">1,000+ developers</span> today</p>
                    </motion.div>

                    {/* Interactive Editor Mockup */}
                    <div className="relative max-w-5xl mx-auto mb-32">
                        <div className="glass-card rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] text-left border border-white/5 bg-[#0a0a0a]/80 backdrop-blur-3xl relative">
                            {/* Window Header */}
                            <div className="bg-[#111]/80 px-4 py-3 flex items-center justify-between border-b border-white/5">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                                </div>
                                <div className="text-xs text-gray-500 font-mono">main.py — SyncWrite Pro</div>
                                <div className="w-12"></div>
                            </div>
                            {/* Code Content */}
                            <div className="p-6 font-mono text-sm leading-relaxed text-gray-300 relative group overflow-visible min-h-[250px]">
                                {/* Floating Cursor Alex */}
                                <motion.div
                                    animate={{ y: [0, -10, 5, 0], x: [0, 5, -5, 0] }}
                                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                                    className="absolute top-10 right-24 z-20 flex flex-col items-start gap-1"
                                >
                                    <div className="flex items-center gap-1 bg-brand-blue px-2 py-1 rounded text-[10px] font-bold shadow-[0_4px_12px_rgba(59,130,246,0.4)] text-white whitespace-nowrap">
                                        <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                                        Alex (Coding)
                                    </div>
                                    <svg className="text-brand-blue fill-current drop-shadow-md" fill="none" height="24" viewBox="0 0 18 24" width="18">
                                        <path d="M1 1L17 12L7.5 13.5L1 23V1Z" stroke="white" strokeWidth="1.5"></path>
                                    </svg>
                                </motion.div>

                                {/* Floating Cursor Sarah */}
                                <motion.div
                                    animate={{ y: [0, 15, -5, 0], x: [0, -10, 10, 0] }}
                                    transition={{ duration: 7, delay: 1, repeat: Infinity, ease: "easeInOut" }}
                                    className="absolute top-36 left-12 z-20 flex flex-col items-start gap-1"
                                >
                                    <div className="flex items-center gap-1 bg-brand-purple px-2 py-1 rounded text-[10px] font-bold shadow-[0_4px_12px_rgba(139,92,246,0.4)] text-white whitespace-nowrap">
                                        <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                                        Sarah (Reviewing)
                                    </div>
                                    <svg className="text-brand-purple fill-current drop-shadow-md" fill="none" height="24" viewBox="0 0 18 24" width="18">
                                        <path d="M1 1L17 12L7.5 13.5L1 23V1Z" stroke="white" strokeWidth="1.5"></path>
                                    </svg>
                                </motion.div>

                                <p><span className="text-brand-purple">import</span> asyncio</p>
                                <p><span className="text-brand-purple">from</span> dataclasses <span className="text-brand-purple">import</span> dataclass</p>
                                <br />
                                <p><span className="text-brand-blue">@dataclass</span></p>
                                <p><span className="text-brand-purple">class</span> <span className="text-yellow-400">EditorState</span>:</p>
                                <p className="pl-4">cursor_pos: <span className="text-brand-blue">int</span></p>
                                <p className="pl-4">active_line: <span className="text-brand-blue">int</span></p>
                                <br />
                                <p><span className="text-brand-purple">async def</span> <span className="text-yellow-400">broadcast_changes</span>(session):</p>
                                <p className="pl-4"><span className="text-gray-500">{"# P2P engine synchronization logic"}</span></p>
                                <p className="pl-4"><span className="text-brand-purple">for</span> peer <span className="text-brand-purple">in</span> session.peers:</p>
                                <p className="pl-8 text-white bg-white/10 border-l-2 border-brand-blue py-0.5 relative z-10 w-fit"> <span className="text-brand-purple">await</span> peer.send(<span className="text-green-400">"SYNC_STEP_1"</span>)<span className="animate-[pulse_1s_ease-in-out_infinite] w-[2px] h-4 bg-brand-blue inline-block align-middle ml-1"></span></p>
                                <p className="pl-4"><span className="text-brand-purple">return</span> <span className="text-brand-purple">True</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Feature Grid */}
                    <div className="grid md:grid-cols-3 gap-6 text-left relative z-20">
                        {/* Feature 1 */}
                        <div className="glass-card p-8 rounded-3xl group hover:-translate-y-2 hover:border-brand-purple/50 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.5)] hover:shadow-[0_10px_40px_rgba(139,92,246,0.15)] relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="w-12 h-12 bg-brand-purple/20 rounded-2xl flex items-center justify-center mb-6 border border-brand-purple/30 group-hover:scale-110 group-hover:bg-brand-purple/30 transition-all relative z-10">
                                <svg className="w-6 h-6 text-brand-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                            </div>
                            <h3 className="text-xl font-bold mb-3 relative z-10 text-white">Zero Latency Collab</h3>
                            <p className="text-gray-400 text-sm leading-relaxed relative z-10">
                                Peer-to-peer data channels mean your keystrokes arrive instantly without server bottlenecks. Built on modern WebRTC.
                            </p>
                        </div>
                        {/* Feature 2 */}
                        <div className="glass-card p-8 rounded-3xl group hover:-translate-y-2 hover:border-brand-blue/50 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.5)] hover:shadow-[0_10px_40px_rgba(59,130,246,0.15)] relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="w-12 h-12 bg-brand-blue/20 rounded-2xl flex items-center justify-center mb-6 border border-brand-blue/30 group-hover:scale-110 group-hover:bg-brand-blue/30 transition-all relative z-10">
                                <svg className="w-6 h-6 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                            </div>
                            <h3 className="text-xl font-bold mb-3 relative z-10 text-white">Live Code Execution</h3>
                            <p className="text-gray-400 text-sm leading-relaxed relative z-10">
                                Run sandboxed JavaScript locally or dispatch Python/C++ to the execution engine. Results stream back in real-time.
                            </p>
                        </div>
                        {/* Feature 3 */}
                        <div className="glass-card p-8 rounded-3xl group hover:-translate-y-2 hover:border-brand-accent/50 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.5)] hover:shadow-[0_10px_40px_rgba(217,70,239,0.15)] relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="w-12 h-12 bg-brand-accent/20 rounded-2xl flex items-center justify-center mb-6 border border-brand-accent/30 group-hover:scale-110 group-hover:bg-brand-accent/30 transition-all relative z-10">
                                <svg className="w-6 h-6 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                            </div>
                            <h3 className="text-xl font-bold mb-3 relative z-10 text-white">Global Presence</h3>
                            <p className="text-gray-400 text-sm leading-relaxed relative z-10">
                                See exactly who is editing what line using Yjs conflict-free replication. Integrated voice and chat for seamless flow.
                            </p>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/5 py-12 z-20 relative bg-brand-dark">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-brand-purple to-brand-blue rounded flex items-center justify-center">
                            <span className="text-xs font-bold text-white">S</span>
                        </div>
                        <span className="text-sm font-semibold text-white">SyncWrite Pro</span>
                    </div>
                    <div className="flex gap-8 text-sm text-gray-500">
                        <a className="hover:text-white transition-colors" href="#">Privacy</a>
                        <a className="hover:text-white transition-colors" href="#">Terms</a>
                        <a className="hover:text-white transition-colors" href="#">Twitter</a>
                        <a className="hover:text-white transition-colors" href="#">GitHub</a>
                    </div>
                    <p className="text-sm text-gray-600">© 2026 SyncWrite Pro Inc. All rights reserved.</p>
                </div>
            </footer>

            {/* Custom Login Modal */}
            {isLoginModalOpen && status === "unauthenticated" && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="bg-[#05050a] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden glass-card"
                    >
                        <div className="p-6 pb-4 text-center border-b border-white/10 relative">
                            <button onClick={() => setIsLoginModalOpen(false)} className="absolute right-4 top-4 p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            <h2 className="text-xl font-bold text-white mb-1 tracking-tight">Welcome Back</h2>
                            <p className="text-gray-400 text-sm">Sign in to start syncing</p>
                        </div>
                        <div className="p-6 flex flex-col gap-3">
                            <button
                                onClick={() => signIn("github")}
                                className="relative w-full px-4 py-3 bg-[#24292e] hover:bg-[#2f363d] text-white font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-3 border border-white/10"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"></path></svg>
                                Continue with GitHub
                            </button>
                            <button
                                onClick={() => signIn("google")}
                                className="relative w-full px-4 py-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] transition-all flex items-center justify-center gap-3 border border-gray-200"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                                Continue with Google
                            </button>
                            <div className="relative my-2">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                                <div className="relative flex justify-center text-[10px] uppercase font-bold text-gray-500"><span className="bg-[#05050a] px-2">OR</span></div>
                            </div>
                            <button
                                onClick={handleCreateRoom}
                                className="w-full px-4 py-2 text-sm font-bold text-brand-blue hover:text-white transition-colors flex items-center justify-center gap-2"
                            >
                                Continue as Anonymous Guest →
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
