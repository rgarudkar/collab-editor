"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";

// --- Typewriter hook ---
const useTypewriter = (texts: string[], speed = 70, delay = 500) => {
  const [idx, setIdx] = useState(0);
  const [t1, setT1] = useState("");
  const [t2, setT2] = useState("");
  useEffect(() => {
    if (idx === 0) {
      if (t1.length < texts[0].length) {
        const tm = setTimeout(() => setT1(texts[0].slice(0, t1.length + 1)), speed);
        return () => clearTimeout(tm);
      } else {
        const tm = setTimeout(() => setIdx(1), delay);
        return () => clearTimeout(tm);
      }
    } else if (idx === 1) {
      if (t2.length < texts[1].length) {
        const tm = setTimeout(() => setT2(texts[1].slice(0, t2.length + 1)), speed);
        return () => clearTimeout(tm);
      }
    }
  }, [t1, t2, idx, texts, speed, delay]);
  return { t1, t2, done: idx === 1 && t2.length === texts[1].length };
};

// --- Animated Counter ---
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        let start = 0;
        const step = target / 60;
        const interval = setInterval(() => {
          start += step;
          if (start >= target) { setVal(target); clearInterval(interval); }
          else setVal(Math.floor(start));
        }, 16);
        obs.disconnect();
      }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// --- Floating Orbs ---
function FloatingOrbs() {
  return (
    <div className="orb-container" aria-hidden="true">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
    </div>
  );
}

// --- Particle dots grid background ---
function GridBg() {
  return <div className="grid-bg fixed inset-0 pointer-events-none z-0" aria-hidden="true" />;
}

const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    ),
    color: "purple",
    title: "Zero-Latency Collaboration",
    desc: "Powered by WebRTC peer-to-peer data channels. Your keystrokes arrive at teammates instantly—no server bottleneck, no lag.",
    badge: "WebRTC",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    ),
    color: "blue",
    title: "Multi-Language Execution",
    desc: "Run sandboxed JavaScript locally or dispatch Python/C++ to a cloud execution engine. Results stream back in real-time.",
    badge: "JS · Python · C++",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    ),
    color: "pink",
    title: "Live Presence & Cursors",
    desc: "See exactly who is editing which line. Yjs CRDT ensures conflict-free merging even with 20+ simultaneous collaborators.",
    badge: "Yjs CRDT",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    ),
    color: "green",
    title: "Private Rooms, Instantly",
    desc: "Create a unique encrypted room in one click. Share the link—no signup required. Works on any device, any browser.",
    badge: "End-to-End",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    ),
    color: "orange",
    title: "Monaco Editor Core",
    desc: "The same editor engine powering VS Code. Full IntelliSense, syntax highlighting, bracket matching for 30+ languages.",
    badge: "VS Code Engine",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    ),
    color: "cyan",
    title: "Cloud-Ready Architecture",
    desc: "Deploy frontend to Vercel, backend to Railway. Docker-native. Scales from 2 to 200 collaborators without config changes.",
    badge: "Vercel · Railway",
  },
];

const STEPS = [
  { num: "01", title: "Create a Room", desc: "Click 'Start Coding Now' to instantly generate a unique, encrypted collaboration room." },
  { num: "02", title: "Share the Link", desc: "Copy your room ID and send it to your team. No accounts required to join." },
  { num: "03", title: "Code Together", desc: "Edit simultaneously with live cursors, run code, and see output in a shared terminal panel." },
];

const TESTIMONIALS = [
  { name: "Priya S.", role: "Senior Engineer @ Stripe", text: "We use SyncWrite for all our live coding interviews. The zero-lag experience makes candidates feel comfortable.", seed: "Priya" },
  { name: "Marcus T.", role: "CS Professor @ MIT", text: "My students can pair-program on algorithms in real-time. The code execution sandbox is a game changer for teaching.", seed: "Marcus" },
  { name: "Anya K.", role: "Tech Lead @ Vercel", text: "Replaced two separate tools with SyncWrite. WebRTC collab + live execution in one clean interface is unbeatable.", seed: "Anya" },
];

const CODE_LINES = [
  { tokens: [{ t: "import", c: "kw" }, { t: " asyncio", c: "txt" }] },
  { tokens: [{ t: "from", c: "kw" }, { t: " dataclasses ", c: "txt" }, { t: "import", c: "kw" }, { t: " dataclass", c: "txt" }] },
  { blank: true },
  { tokens: [{ t: "@dataclass", c: "dec" }] },
  { tokens: [{ t: "class", c: "kw" }, { t: " ", c: "txt" }, { t: "EditorState", c: "cls" }, { t: ":", c: "txt" }] },
  { tokens: [{ t: "  cursor_pos", c: "txt" }, { t: ": ", c: "txt" }, { t: "int", c: "blue" }], indent: true },
  { tokens: [{ t: "  active_users", c: "txt" }, { t: ": ", c: "txt" }, { t: "list", c: "blue" }], indent: true },
  { blank: true },
  { tokens: [{ t: "async def", c: "kw" }, { t: " ", c: "txt" }, { t: "broadcast_changes", c: "fn" }, { t: "(session):", c: "txt" }] },
  { tokens: [{ t: "  ", c: "txt" }, { t: "# P2P sync engine — Yjs CRDT", c: "cmt" }], indent: true },
  { tokens: [{ t: "  ", c: "txt" }, { t: "for", c: "kw" }, { t: " peer ", c: "txt" }, { t: "in", c: "kw" }, { t: " session.peers:", c: "txt" }], indent: true },
  { tokens: [{ t: "    ", c: "txt" }, { t: "await", c: "kw" }, { t: " peer.send(", c: "txt" }, { t: '"SYNC_STEP_1"', c: "str" }, { t: ")", c: "txt" }], highlight: true },
  { tokens: [{ t: "  ", c: "txt" }, { t: "return", c: "kw" }, { t: " ", c: "txt" }, { t: "True", c: "kw" }], indent: true },
];

function tokenColor(c: string) {
  const map: Record<string, string> = {
    kw: "var(--c-purple)", dec: "var(--c-blue)", cls: "#fbbf24",
    fn: "#fbbf24", blue: "var(--c-blue)", str: "#34d399",
    cmt: "#6b7280", txt: "#d1d5db",
  };
  return map[c] || "#d1d5db";
}

export default function LandingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [roomIdInput, setRoomIdInput] = useState("");
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const { t1, t2, done } = useTypewriter(["Code Together.", "Build Anything."], 70, 400);
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.93]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    const ids = ["features", "how-it-works", "stats", "testimonials"];
    const observers: IntersectionObserver[] = [];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { threshold: 0.15, rootMargin: "-68px 0px 0px 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, []);

  const handleCreateRoom = () => {
    const id = Math.random().toString(36).substring(2, 10);
    router.push(`/room/${id}`);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomIdInput.trim()) router.push(`/room/${roomIdInput.trim()}`);
  };

  return (
    <div className="landing-root">
      <GridBg />
      <FloatingOrbs />

      {/* ── NAVBAR ── */}
      <header className={`landing-nav ${scrolled ? "nav-scrolled" : ""}`}>
        <nav className="nav-inner">
          <div className="logo">
            <div className="logo-icon">S</div>
            <span className="logo-text">SyncWrite</span>
            <span className="logo-badge">Pro</span>
          </div>

          <div className="nav-links">
            <a href="#features" className={activeSection === "features" ? "nav-link-active" : ""}>Features</a>
            <a href="#how-it-works" className={activeSection === "how-it-works" ? "nav-link-active" : ""}>How it Works</a>
            <a href="#stats" className={activeSection === "stats" ? "nav-link-active" : ""}>Stats</a>
            <a href="#testimonials" className={activeSection === "testimonials" ? "nav-link-active" : ""}>Reviews</a>
          </div>

          <div className="nav-actions">
            {status === "authenticated" ? (
              <div className="nav-user" onClick={() => signOut()} title="Sign Out">
                <img
                  src={session?.user?.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session?.user?.name}`}
                  alt="avatar"
                  className="nav-avatar"
                />
                <span className="nav-username">{session?.user?.name?.split(" ")[0]}</span>
              </div>
            ) : (
              <button className="btn-ghost" onClick={() => setIsLoginModalOpen(true)}>Sign In</button>
            )}
            <button className="btn-primary" onClick={handleCreateRoom}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              New Room
            </button>
          </div>
        </nav>
      </header>

      {/* ── HERO ── */}
      <motion.section ref={heroRef} className="hero-section" style={{ opacity: heroOpacity, scale: heroScale }}>
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="hero-badge"
        >
          <span className="badge-dot" />
          <span>WebRTC Real-time Engine Active</span>
          <span className="badge-live">127 Peers Online</span>
        </motion.div>

        <h1 className="hero-title">
          <div className="hero-line-1">
            {t1}
            {t2.length === 0 && !done && <span className="cursor" />}
          </div>
          <div className="hero-line-2">
            <span className="gradient-text">{t2}</span>
            {t2.length > 0 && !done && <span className="cursor" />}
          </div>
        </h1>

        <motion.p
          className="hero-sub"
          initial={{ opacity: 0, y: 16 }}
          animate={done ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.7 }}
        >
          The ultimate peer-to-peer collaborative code editor. Real-time cursors, multi-language execution,
          and WebRTC sync — all in your browser. No install. No friction.
        </motion.p>

        <motion.div
          className="hero-cta-row"
          initial={{ opacity: 0, y: 20 }}
          animate={done ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.7, delay: 0.15 }}
        >
          <button className="btn-hero-primary" onClick={handleCreateRoom}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Start Coding Now — Free
            <span className="btn-shine" />
          </button>

          <span className="cta-divider">or</span>

          <form className="join-form" onSubmit={handleJoinRoom}>
            <input
              id="room-id-input"
              value={roomIdInput}
              onChange={e => setRoomIdInput(e.target.value)}
              className="join-input"
              placeholder="Paste Room ID to join..."
              type="text"
            />
            <button type="submit" disabled={!roomIdInput.trim()} className="join-btn" aria-label="Join room">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </motion.div>

        <motion.div
          className="social-proof"
          initial={{ opacity: 0 }}
          animate={done ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          <div className="avatar-stack">
            {["Felix", "Luna", "Alex", "Sarah", "Kai"].map(s => (
              <img key={s} src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s}`} alt={s} className="stack-avatar" />
            ))}
          </div>
          <p><span className="proof-num">1,000+</span> developers coding together right now</p>
        </motion.div>

        {/* ── CODE MOCKUP ── */}
        <motion.div
          className="mockup-wrapper"
          initial={{ opacity: 0, y: 40 }}
          animate={done ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 0.9, delay: 0.3 }}
        >
          <div className="mockup-glow" />
          <div className="mockup-card">
            {/* title bar */}
            <div className="mockup-bar">
              <div className="traffic-lights">
                <span className="tl tl-red" />
                <span className="tl tl-yellow" />
                <span className="tl tl-green" />
              </div>
              <div className="mockup-tabs">
                <span className="tab tab-active">main.py</span>
                <span className="tab">utils.js</span>
                <span className="tab">algo.cpp</span>
              </div>
              <div className="mockup-status">
                <span className="status-dot" />
                <span>3 collaborators</span>
              </div>
            </div>

            {/* sidebar line numbers */}
            <div className="mockup-body">
              <div className="line-nums">
                {CODE_LINES.map((_, i) => <div key={i} className="ln">{!CODE_LINES[i].blank ? i + 1 : ""}</div>)}
              </div>
              <div className="code-area">
                {/* floating cursors */}
                <motion.div
                  className="f-cursor f-cursor-blue"
                  animate={{ y: [0, -8, 4, 0], x: [0, 4, -4, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="f-label f-label-blue">
                    <span className="f-dot" />Alex (editing)
                  </div>
                  <svg className="f-arrow" fill="#3b82f6" viewBox="0 0 18 24" width="14" height="18"><path d="M1 1L17 12L7.5 13.5L1 23V1Z" stroke="white" strokeWidth="1.2" /></svg>
                </motion.div>
                <motion.div
                  className="f-cursor f-cursor-purple"
                  animate={{ y: [0, 12, -4, 0], x: [0, -8, 8, 0] }}
                  transition={{ duration: 7, delay: 1, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="f-label f-label-purple">
                    <span className="f-dot" />Sarah (reviewing)
                  </div>
                  <svg className="f-arrow" fill="#8b5cf6" viewBox="0 0 18 24" width="14" height="18"><path d="M1 1L17 12L7.5 13.5L1 23V1Z" stroke="white" strokeWidth="1.2" /></svg>
                </motion.div>

                {CODE_LINES.map((line, i) =>
                  line.blank ? <div key={i} className="code-line">&nbsp;</div> :
                    <div key={i} className={`code-line ${line.highlight ? "line-highlight" : ""}`}>
                      {(line.tokens || []).map((tk, j) => (
                        <span key={j} style={{ color: tokenColor(tk.c) }}>{tk.t}</span>
                      ))}
                      {line.highlight && <span className="blink-cursor" />}
                    </div>
                )}
              </div>
            </div>

            {/* output bar */}
            <div className="mockup-output">
              <span className="output-label">OUTPUT</span>
              <span className="output-text">✓ Synced 3 peers in <strong>12ms</strong> · WebRTC channel stable</span>
            </div>
          </div>
        </motion.div>
      </motion.section>

      {/* ── STATS ── */}
      <section id="stats" className="stats-section">
        <div className="stats-grid">
          {[
            { label: "Developers", val: 12400, suf: "+" },
            { label: "Sessions Today", val: 3200, suf: "+" },
            { label: "Lines Executed", val: 890000, suf: "+" },
            { label: "Avg Latency", val: 8, suf: "ms" },
          ].map(s => (
            <div key={s.label} className="stat-item">
              <div className="stat-value"><Counter target={s.val} suffix={s.suf} /></div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="how-section">
        <div className="section-header">
          <span className="section-tag">Process</span>
          <h2 className="section-title">From zero to coding in <span className="gradient-text">30 seconds</span></h2>
          <p className="section-sub">No configuration, no installs, no accounts required to start.</p>
        </div>
        <div className="steps-row">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              className="step-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              <div className="step-num">{step.num}</div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-desc">{step.desc}</p>
              {i < STEPS.length - 1 && <div className="step-connector" aria-hidden="true" />}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="features-section">
        <div className="section-header">
          <span className="section-tag">Features</span>
          <h2 className="section-title">Everything you need. <span className="gradient-text">Nothing you don't.</span></h2>
          <p className="section-sub">Built for professional developers who value speed, reliability and real-time collaboration.</p>
        </div>
        <div className="feat-grid">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              className={`feat-card feat-${f.color}`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -6 }}
            >
              <div className={`feat-icon-wrap feat-icon-${f.color}`}>{f.icon}</div>
              <div className={`feat-badge feat-badge-${f.color}`}>{f.badge}</div>
              <h3 className="feat-title">{f.title}</h3>
              <p className="feat-desc">{f.desc}</p>
              <div className="feat-hover-bg" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimonials" className="testimonials-section">
        <div className="section-header">
          <span className="section-tag">Reviews</span>
          <h2 className="section-title">Loved by <span className="gradient-text">engineering teams</span></h2>
        </div>
        <div className="testi-grid">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              className="testi-card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
            >
              <div className="quote-icon">"</div>
              <p className="testi-text">{t.text}</p>
              <div className="testi-author">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${t.seed}`} alt={t.name} className="testi-avatar" />
                <div>
                  <div className="testi-name">{t.name}</div>
                  <div className="testi-role">{t.role}</div>
                </div>
              </div>
              <div className="testi-stars">{"★★★★★"}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="cta-section">
        <div className="cta-inner">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="cta-title">Start collaborating in seconds.</h2>
            <p className="cta-sub">No credit card. No installs. Just code.</p>
            <div className="cta-btns">
              <button className="btn-hero-primary" onClick={handleCreateRoom}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Create Free Room
                <span className="btn-shine" />
              </button>
              {status === "unauthenticated" && (
                <button className="btn-ghost-lg" onClick={() => setIsLoginModalOpen(true)}>Sign In with GitHub</button>
              )}
            </div>
          </motion.div>
        </div>
        <div className="cta-glow cta-glow-left" />
        <div className="cta-glow cta-glow-right" />
      </section>

      {/* ── FOOTER ── */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="logo">
              <div className="logo-icon">S</div>
              <span className="logo-text">SyncWrite</span>
            </div>
            <p className="footer-tagline">Collaborative coding. Reimagined.</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <span className="footer-col-title">Product</span>
              <a href="#features">Features</a>
              <a href="#how-it-works">How it Works</a>
              <a href="#stats">Stats</a>
            </div>
            <div className="footer-col">
              <span className="footer-col-title">Legal</span>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
            </div>
            <div className="footer-col">
              <span className="footer-col-title">Community</span>
              <a href="#">GitHub</a>
              <a href="#">Twitter / X</a>
              <a href="#">Discord</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 SyncWrite Pro. Built with ❤️ for developers.</p>
        </div>
      </footer>

      {/* ── LOGIN MODAL ── */}
      <AnimatePresence>
        {isLoginModalOpen && status === "unauthenticated" && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsLoginModalOpen(false)}
          >
            <motion.div
              className="modal-card"
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ duration: 0.22 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <div className="modal-logo"><div className="logo-icon">S</div></div>
                <h2 className="modal-title">Welcome Back</h2>
                <p className="modal-sub">Sign in to persist your sessions</p>
                <button className="modal-close" onClick={() => setIsLoginModalOpen(false)} aria-label="Close">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <button className="auth-btn auth-github" onClick={() => signIn("github")}>
                  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  Continue with GitHub
                </button>
                <button className="auth-btn auth-google" onClick={() => signIn("google")}>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </button>
                <div className="modal-divider"><span>or</span></div>
                <button className="auth-btn auth-guest" onClick={handleCreateRoom}>
                  Continue as Anonymous Guest →
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
