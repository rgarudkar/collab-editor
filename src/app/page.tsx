"use client";

import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import { Terminal, Users, Zap, ArrowRight, Play, Code2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

// Floating Code Background Component for Light & Dark Theme
const FloatingCode = ({ delay, duration, code, xOffset, opacity, scale }: { delay: number, duration: number, code: string, xOffset: string, opacity: number, scale: number }) => (
    <motion.div
        className="absolute whitespace-pre font-mono text-[10px] md:text-xs pointer-events-none z-0 select-none p-3 md:p-4 rounded-xl border bg-white/40 border-slate-200/30 shadow-xl backdrop-blur-md dark:bg-[#0a0f25]/40 dark:border-indigo-500/20 dark:shadow-[0_0_40px_rgba(99,102,241,0.1)] text-slate-500/70 font-medium dark:text-indigo-200/50"
        style={{ left: xOffset, opacity, transform: `scale(${scale})` }}
        initial={{ y: "110vh", x: 0 }}
        animate={{
            y: "-100vh",
            x: [0, 20, -15, 0]
        }}
        transition={{
            y: { duration, delay, repeat: Infinity, ease: "linear" },
            x: { duration: 18, delay, repeat: Infinity, ease: "easeInOut" }
        }}
    >
        {/* Terminal Header Dots */}
        <div className="flex gap-1.5 mb-2 md:mb-3 opacity-40">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-400"></div>
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-amber-400"></div>
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-400"></div>
        </div>
        {code}
    </motion.div>
);

// Floating Cursor Component mimicking active peer-to-peer users
const FloatingCursor = ({ color, name, xOffsets, yOffsets, delay, duration }: { color: string, name: string, xOffsets: string[], yOffsets: string[], delay: number, duration: number }) => (
    <motion.div
        className="absolute pointer-events-none z-20 flex items-start gap-1 drop-shadow-2xl"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
            left: xOffsets,
            top: yOffsets,
            opacity: [0, 1, 1, 0],
            scale: [0.8, 1, 1, 0.8],
            y: [0, -15, 10, -5, 0] // Subtle bobbing
        }}
        transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    >
        <svg className="w-6 h-6 md:w-8 md:h-8" style={{ color: color, transform: 'rotate(-25deg)' }} fill="currentColor" stroke="white" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4l5.5 16 3-6.5L19 10.5 4 4z" /></svg>
        <span className="text-xs md:text-sm font-bold px-2.5 py-1 rounded shadow-lg whitespace-nowrap mt-5 md:mt-7 -ml-2 border border-white/20" style={{ backgroundColor: color, color: 'white' }}>{name}</span>
    </motion.div>
);

// Custom Typewriter Hook for Realistic Coding Effect
const useTypewriter = (texts: string[], typingSpeed: number = 80, delayBetweenTexts: number = 500) => {
    const [displayedText1, setDisplayedText1] = useState("");
    const [displayedText2, setDisplayedText2] = useState("");
    const [currentTextIndex, setCurrentTextIndex] = useState(0);

    useEffect(() => {
        if (currentTextIndex === 0) {
            if (displayedText1.length < texts[0].length) {
                const timeout = setTimeout(() => {
                    setDisplayedText1(texts[0].slice(0, displayedText1.length + 1));
                }, typingSpeed);
                return () => clearTimeout(timeout);
            } else {
                const timeout = setTimeout(() => {
                    setCurrentTextIndex(1);
                }, delayBetweenTexts);
                return () => clearTimeout(timeout);
            }
        } else if (currentTextIndex === 1) {
            if (displayedText2.length < texts[1].length) {
                const timeout = setTimeout(() => {
                    setDisplayedText2(texts[1].slice(0, displayedText2.length + 1));
                }, typingSpeed);
                return () => clearTimeout(timeout);
            }
        }
    }, [displayedText1, displayedText2, currentTextIndex, texts, typingSpeed, delayBetweenTexts]);

    return { displayedText1, displayedText2, isFinished: currentTextIndex === 1 && displayedText2.length === texts[1].length };
};

export default function LandingPage() {
    const router = useRouter();
    const [roomIdInput, setRoomIdInput] = useState("");

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

    // Framer motion variants for stagger effects
    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.12, delayChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 350, damping: 28 } }
    };

    // Array of realistic code snippets for the background
    const bgSnippets = [
        `function execute(ast) {\n  return VM.run(ast);\n}`,
        `const wss = new WebSocketServer();\nwss.on('connection', ws => {\n  ws.send(syncStep1);\n});`,
        `import * as Y from 'yjs';\nconst doc = new Y.Doc();\nconst text = doc.getText('monaco');`,
        `template <typename T>\nclass CollabEngine {\n  std::vector<T> peers;\n};`,
        `@dataclass\nclass EditorState:\n  cursor_pos: int\n  active_line: int`,
        `// Applying delta\nif (delta.insert) {\n  editor.apply(delta);\n}`,
        `SELECT * FROM active_rooms \nWHERE users < 4 \nLIMIT 10;`,
    ];

    const { displayedText1, displayedText2, isFinished } = useTypewriter(["Code Together.", "Execute Anywhere."], 70, 400);

    return (
        <div className="min-h-screen w-full flex flex-col font-sans relative overflow-x-hidden bg-slate-50 dark:bg-[#02040a] selection:bg-blue-200 dark:selection:bg-indigo-500/30">

            {/* Absolute Premium Background - Light & Dark Theme */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                {/* Soft gradient background - Improved Light Mode */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/80 via-white to-purple-50/80 dark:hidden z-[-2]"></div>

                {/* Subtle Dot Grid */}
                <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff15_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_20%,transparent_100%)] z-[-1]"></div>

                {/* Ambient Soft Orbs */}
                <motion.div
                    animate={{ y: [0, -30, 0], x: [0, 20, 0] }}
                    transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-[-5%] left-[15%] w-[600px] h-[600px] bg-blue-300/30 dark:bg-indigo-600/20 rounded-full blur-[100px] dark:blur-[120px]"
                />
                <motion.div
                    animate={{ y: [0, 40, 0], x: [0, -30, 0] }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="absolute bottom-[-10%] right-[5%] w-[700px] h-[700px] bg-purple-300/30 dark:bg-fuchsia-600/10 rounded-full blur-[120px] dark:blur-[150px]"
                />

                {/* Animated Code Blocks - Positioned strictly left and right to prevent hero overlap */}
                <div className="absolute inset-0 z-0 [mask-image:linear-gradient(to_bottom,transparent_0%,#000_10%,#000_90%,transparent_100%)] dark:[mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_40%,transparent_100%)]">
                    {/* LEFT SIDE SNIPPETS */}
                    <FloatingCode code={bgSnippets[0]} xOffset="4%" duration={35} delay={0} opacity={0.6} scale={0.9} />
                    <FloatingCode code={bgSnippets[2]} xOffset="12%" duration={45} delay={5} opacity={0.5} scale={0.8} />
                    <FloatingCode code={bgSnippets[5]} xOffset="8%" duration={40} delay={15} opacity={0.4} scale={0.85} />

                    {/* RIGHT SIDE SNIPPETS */}
                    <FloatingCode code={bgSnippets[1]} xOffset="78%" duration={38} delay={2} opacity={0.5} scale={1.05} />
                    <FloatingCode code={bgSnippets[3]} xOffset="86%" duration={42} delay={8} opacity={0.5} scale={0.9} />
                    <FloatingCode code={bgSnippets[4]} xOffset="82%" duration={50} delay={1} opacity={0.7} scale={1.1} />
                    <FloatingCode code={bgSnippets[6]} xOffset="75%" duration={32} delay={12} opacity={0.6} scale={0.95} />
                </div>

                {/* Floating Collaborative Cursors */}
                <div className="absolute inset-0 z-10 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent_0%,#000_20%,#000_80%,transparent_100%)]">
                    <FloatingCursor color="#f59e0b" name="Sarah (Designing)" xOffsets={["15%", "25%", "20%", "15%"]} yOffsets={["40%", "50%", "30%", "40%"]} duration={12} delay={0} />
                    <FloatingCursor color="#3b82f6" name="Alex (Coding)" xOffsets={["70%", "60%", "80%", "70%"]} yOffsets={["60%", "30%", "45%", "60%"]} duration={15} delay={2} />
                    <FloatingCursor color="#10b981" name="Chris (Reviewing)" xOffsets={["40%", "55%", "45%", "40%"]} yOffsets={["75%", "65%", "85%", "75%"]} duration={10} delay={5} />
                    <FloatingCursor color="#ec4899" name="Guest_901" xOffsets={["85%", "75%", "90%", "85%"]} yOffsets={["20%", "40%", "30%", "20%"]} duration={18} delay={7} />
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 dark:border-white/5 bg-white/70 dark:bg-black/20 backdrop-blur-xl sticky top-0 z-50 shadow-sm dark:shadow-none">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 dark:to-purple-600 flex items-center justify-center font-bold text-lg text-white shadow-md dark:shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                        S
                    </div>
                    <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 dark:from-blue-400 dark:to-purple-500 tracking-tight">
                        SyncWrite Pro
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <ThemeToggle />

                    <SignedOut>
                        <SignInButton mode="modal">
                            <button className="px-5 py-2 text-sm font-semibold rounded-lg bg-white dark:bg-white/10 hover:bg-slate-50 dark:hover:bg-white/20 text-slate-700 dark:text-white transition-all border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-lg dark:backdrop-blur-md">
                                Sign In
                            </button>
                        </SignInButton>
                    </SignedOut>
                    <SignedIn>
                        <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "w-9 h-9 border border-slate-200 dark:border-2 dark:border-gray-800" } }} />
                    </SignedIn>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 md:py-4 text-center relative z-10 w-full max-w-6xl mx-auto overflow-visible">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="flex flex-col items-center w-full min-h-[500px]"
                >
                    {/* Eyebrow badge */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="mb-6 mt-2 px-5 py-2 rounded-full border border-slate-200 dark:border-indigo-500/20 bg-white/50 dark:bg-indigo-500/10 shadow-sm dark:shadow-[0_0_20px_rgba(99,102,241,0.1)] text-slate-700 dark:text-indigo-200 text-sm font-medium flex items-center gap-3 backdrop-blur-md backdrop-saturate-150"
                    >
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                        </span>
                        <span>WebRTC Real-time Engine Active</span>
                        <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-600"></span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold tracking-wide">127 Peers Online</span>
                    </motion.div>

                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-4 max-w-5xl text-pretty leading-[1.1] text-slate-900 dark:text-white flex flex-col items-center min-h-[120px] md:min-h-[220px]">
                        <div className="flex items-center justify-center">
                            <span>{displayedText1}</span>
                            {displayedText2.length === 0 && !isFinished && (
                                <span className="inline-block w-[3px] md:w-[6px] h-[36px] md:h-[56px] lg:h-[70px] bg-blue-500 ml-1 md:ml-3 animate-[pulse_0.8s_ease-in-out_infinite]"></span>
                            )}
                        </div>
                        <div className="flex items-center justify-center pt-2 md:pt-4 group">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-500 dark:drop-shadow-[0_0_25px_rgba(99,102,241,0.5)]">
                                {displayedText2}
                            </span>
                            {displayedText2.length > 0 && !isFinished && (
                                <span className="inline-block w-[3px] md:w-[6px] h-[36px] md:h-[56px] lg:h-[70px] bg-fuchsia-500 ml-1 md:ml-3 animate-[pulse_0.8s_ease-in-out_infinite]"></span>
                            )}
                        </div>
                    </h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={isFinished ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="text-base md:text-lg text-slate-600 dark:text-slate-400 mb-8 max-w-2xl leading-relaxed tracking-wide"
                    >
                        The ultimate peer-to-peer collaborative editor. Write code with your team, see live cursors, and execute algorithms instantly over WebSockets.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={isFinished ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                        className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-xl mx-auto"
                    >
                        {/* Create Room Button - Redesigned with glow effects */}
                        <div className="relative group w-full sm:w-auto">
                            {/* Animated Glow Backdrop */}
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 rounded-xl blur-md opacity-40 group-hover:opacity-100 transition duration-500 group-hover:duration-200 animate-pulse"></div>

                            {/* Logged In State: Creates Room directly */}
                            <SignedIn>
                                <button
                                    onClick={handleCreateRoom}
                                    className="relative w-full sm:w-auto px-8 py-3.5 bg-slate-900 dark:bg-[#060918] hover:bg-slate-800 dark:hover:bg-[#0a0f25] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] transition-all flex items-center justify-center gap-3 border border-slate-700 dark:border-indigo-500/40 overflow-hidden"
                                >
                                    {/* Button Hover Gradient Sweep */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 dark:from-blue-500/0 dark:via-blue-500/10 dark:to-purple-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>

                                    <Code2 className="w-5 h-5 text-blue-300 dark:text-blue-400 group-hover:scale-110 group-hover:rotate-3 transition-transform relative z-10" />
                                    <span className="relative z-10 bg-clip-text text-transparent bg-white dark:bg-gradient-to-r dark:from-white dark:to-indigo-200">
                                        Start Coding Now
                                    </span>
                                </button>
                            </SignedIn>

                            {/* Guest State: Forces Login Modal when they click */}
                            <SignedOut>
                                <SignInButton mode="modal" forceRedirectUrl="/">
                                    <button
                                        className="relative w-full sm:w-auto px-8 py-3.5 bg-slate-900 dark:bg-[#060918] hover:bg-slate-800 dark:hover:bg-[#0a0f25] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] transition-all flex items-center justify-center gap-3 border border-slate-700 dark:border-indigo-500/40 overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 dark:from-blue-500/0 dark:via-blue-500/10 dark:to-purple-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>

                                        <Code2 className="w-5 h-5 text-blue-300 dark:text-blue-400 group-hover:scale-110 group-hover:rotate-3 transition-transform relative z-10" />
                                        <span className="relative z-10 bg-clip-text text-transparent bg-white dark:bg-gradient-to-r dark:from-white dark:to-indigo-200">
                                            Start Coding Now
                                        </span>
                                    </button>
                                </SignInButton>
                            </SignedOut>
                        </div>

                        <span className="text-slate-400 dark:text-slate-500 font-medium font-mono text-sm hidden sm:block px-2">OR</span>

                        {/* Join Room Form - Secondary Ghost Style */}
                        <form onSubmit={handleJoinRoom} className="w-full sm:w-auto flex-1 relative flex items-center group">
                            <input
                                type="text"
                                placeholder="Paste Room ID..."
                                value={roomIdInput}
                                onChange={(e) => setRoomIdInput(e.target.value)}
                                className="w-full bg-slate-50/50 dark:bg-white/[0.02] border border-slate-300/60 dark:border-white/10 focus:bg-white dark:focus:bg-[#0a0f25]/80 focus:border-blue-500 dark:focus:border-indigo-500/80 focus:shadow-[0_0_15px_rgba(59,130,246,0.15)] dark:focus:shadow-[0_0_20px_rgba(99,102,241,0.2)] rounded-xl px-5 py-3.5 text-sm outline-none transition-all duration-300 pr-12 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 backdrop-blur-sm"
                            />
                            <button
                                type="submit"
                                disabled={!roomIdInput.trim()}
                                className="absolute right-2 p-1.5 bg-transparent hover:bg-slate-200/50 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </form>
                    </motion.div>

                    {/* Social Proof Avatars */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={isFinished ? { opacity: 1 } : { opacity: 0 }}
                        transition={{ duration: 1, delay: 0.6 }}
                        className="mt-8 flex items-center justify-center gap-3"
                    >
                        <div className="flex -space-x-2 overflow-hidden items-center justify-center">
                            {[
                                "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
                                "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna",
                                "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
                                "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
                            ].map((src, i) => (
                                <img key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-[#02040a] bg-slate-100 dark:bg-slate-800" src={src} alt="User Avatar" />
                            ))}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Joined by 1,000+ developers</p>
                    </motion.div>
                </motion.div>

                {/* Feature Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={isFinished ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
                    transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 pb-20 w-full px-4 relative z-10"
                >
                    {[
                        {
                            title: "Zero Latency Collab",
                            desc: "Peer-to-peer data channels mean your keystrokes arrive instantly without server bottlenecks.",
                            icon: <Zap className="w-5 h-5 text-amber-500 dark:text-amber-400" />,
                            hoverClass: "hover:border-amber-300 dark:hover:border-amber-500/30 dark:hover:shadow-[0_8px_30px_rgba(245,158,11,0.15)] dark:hover:bg-[#1a150cf0]",
                            iconBg: "dark:bg-amber-500/10 dark:border-amber-500/20 group-hover:bg-amber-50 dark:group-hover:bg-amber-500/20"
                        },
                        {
                            title: "Live Code Execution",
                            desc: "Run sandboxed JavaScript locally or dispatch Python/C++ to the execution engine.",
                            icon: <Terminal className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />,
                            hoverClass: "hover:border-emerald-300 dark:hover:border-emerald-500/30 dark:hover:shadow-[0_8px_30px_rgba(16,185,129,0.15)] dark:hover:bg-[#0b1a12f0]",
                            iconBg: "dark:bg-emerald-500/10 dark:border-emerald-500/20 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-500/20"
                        },
                        {
                            title: "Awareness & Presence",
                            desc: "See exactly who is editing what line using Yjs conflict-free replication capabilities.",
                            icon: <Users className="w-5 h-5 text-blue-500 dark:text-blue-400" />,
                            hoverClass: "hover:border-blue-300 dark:hover:border-blue-500/30 dark:hover:shadow-[0_8px_30px_rgba(59,130,246,0.15)] dark:hover:bg-[#0a1024f0]",
                            iconBg: "dark:bg-blue-500/10 dark:border-blue-500/20 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/20"
                        },
                    ].map((feature, i) => (
                        <motion.div
                            key={i}
                            whileHover={{ y: -5, scale: 1.01 }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            className={`p-6 rounded-2xl bg-white/70 dark:bg-[#060918]/60 border border-slate-200 dark:border-white/[0.05] backdrop-blur-xl text-left shadow-sm dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] relative overflow-hidden group transition-all duration-300 ${feature.hoverClass}`}
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-[0.03] dark:opacity-[0.05] group-hover:scale-150 transition-transform duration-700 ease-out group-hover:opacity-[0.08] dark:group-hover:opacity-10 group-hover:rotate-12">
                                {feature.icon}
                            </div>
                            <div className={`w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mb-4 border border-slate-100 dark:shadow-inner ${feature.iconBg}`}>
                                {feature.icon}
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100 mb-2">{feature.title}</h3>
                            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-light tracking-wide">{feature.desc}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </main>
        </div>
    );
}
