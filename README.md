# SyncWrite — Collaborative Code Editor

> Real-time collaborative coding with sub-100ms sync, multi-language execution, and time travel edit history.

**[Live Demo](https://syncwriter.vercel.app)**

---

## What is SyncWrite?

SyncWrite is a browser-based collaborative code editor — think Google Docs, but for code. Multiple developers can edit the same file simultaneously in real-time, see each other's cursors, run code in multiple languages, and scrub through the full edit history of a session.

Built entirely with **Next.js, TypeScript, Yjs CRDTs, and WebRTC** — no Firebase, no operational transforms, no central document state.

---

## Features

### Real-time Collaborative Editing
- Up to **4 simultaneous peers** per room
- **Color-coded cursors** with name badges synced across all peers in real-time
- Conflict-free editing via **Yjs CRDT (YATA algorithm)** — no locking, no conflicts, ever

### Multi-language Code Execution
| Language | Runtime | Method |
|---|---|---|
| JavaScript | Browser V8 | Sandboxed Web Worker |
| Python | Server-side | Backend `exec()` |
| C++ | Server-side | `g++` compile + run |

All executions are **timeout-enforced at 5 seconds** to prevent abuse.

### Time Travel — Edit History Replay
- Every document update is captured as a `Uint8Array` snapshot (event sourcing)
- A **timeline slider** lets you scrub back to any point in the session
- Reconstructs document state by replaying Yjs updates on a fresh `Y.Doc`

### Authentication & Room System
- **GitHub and Google OAuth** via NextAuth.js
- **Guest mode** with randomly-generated animal identities (e.g. "Guest Fox #248") via DiceBear
- Rooms created with shareable 8-character IDs — anyone with the link can join
- No persistence — room state lives as long as at least one peer is connected

---

## Architecture

```
┌─────────────────────────┐        ┌─────────────────────────┐
│     Browser (Client A)  │        │     Browser (Client B)  │
│                         │        │                         │
│  Next.js + Monaco       │◄──────►│  Next.js + Monaco       │
│  Yjs Doc (CRDT)         │        │  Yjs Doc (CRDT)         │
│  y-webrtc Provider      │        │  y-webrtc Provider      │
└──────────┬──────────────┘        └──────────┬──────────────┘
           │ WebSocket (signaling)             │
           └──────────────┬────────────────────┘
                          ▼
          ┌───────────────────────────────┐
          │      Node.js Backend          │
          │  (Render.com — Dockerized)    │
          │                               │
          │  POST /api/execute            │ ← Python / C++ execution
          │  GET  /api/health             │
          │  WebSocket signaling server   │ ← y-webrtc peer routing
          └───────────────────────────────┘
```

**How sync works:**
1. Client connects to the WebSocket signaling server and joins a named room
2. Yjs CRDT document is shared **peer-to-peer over WebRTC** (server only handles signaling)
3. Monaco Editor is bound to the Yjs `Text` type via `y-monaco`
4. All edits are CRDT operations — no central document state, no conflicts

---

## Interesting Engineering Decisions

### Cursor Ghost Prevention — Awareness Proxy
**The problem:** When a remote peer's text change arrives, `y-monaco` calls `editor.setSelection()` to stabilize the local cursor. This triggers Monaco's `onDidChangeCursorSelection` event, which re-broadcasts the local cursor — causing remote cursors to flicker or jump.

**The fix:** A `Proxy` wraps the Yjs `Awareness` object. A `suppressSelectionBroadcast` flag is set during remote transaction processing. The proxy intercepts and drops `setLocalStateField('selection', ...)` calls while the flag is active, then clears it in a microtask via `Promise.resolve().then(...)`.

```
Remote text arrives
  → Yjs observer fires → setSuppressed(true)
  → y-monaco calls editor.setSelection()
    → Monaco fires onDidChangeCursorSelection
      → awareness.setLocalStateField('selection') → SUPPRESSED (no-op)
  → Promise.resolve().then(() => setSuppressed(false))
```

### Sandboxed JavaScript Execution
JavaScript is executed inside a **Web Worker** — a separate thread with no DOM access. This prevents user code from accessing `document`, `window`, or `localStorage`, and stops infinite loops from blocking the main UI thread. Custom `console.log` is monkey-patched inside the worker to capture output as strings.

### Time Travel via Event Sourcing
Each Yjs document update event is stored as a `Uint8Array` in an append-only array. To reconstruct state at any point:

```typescript
const tempDoc = new Y.Doc();
for (let i = 0; i <= targetIndex; i++) {
  Y.applyUpdate(tempDoc, updates[i].update);
}
const snapshotText = tempDoc.getText("monaco").toString();
```

No snapshots, no diffs — pure event replay.

### Reading Code Without React State
`handleRunCode` reads editor content directly from the Yjs `Y.Text` object instead of React state. Reading from state would require syncing on every keystroke, breaking cursor sync and causing re-renders. The ref sidesteps this entirely.

---

## Tech Stack

**Frontend** — Next.js 16, React 19, TypeScript, Tailwind CSS v4, Framer Motion, Monaco Editor, Yjs, y-webrtc, y-monaco, NextAuth.js, D3.js

**Backend** — Node.js, Express, ws (WebSocket), y-webrtc signaling

**Infra** — Vercel (frontend), Render.com — Dockerized (backend)

---

## Running Locally

```bash
# Terminal 1 — Frontend
npm install
npm run dev           # http://localhost:3000

# Terminal 2 — Backend
cd server
npm install
node index.js         # http://localhost:3002
```

`.env.local` (frontend root):
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3002
NEXT_PUBLIC_SIGNALING_URL=ws://localhost:3002
NEXTAUTH_SECRET=any-random-string
NEXTAUTH_URL=http://localhost:3000
GITHUB_ID=your_github_oauth_id
GITHUB_SECRET=your_github_oauth_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

---

## Deployment

| Service | Platform | URL |
|---|---|---|
| Frontend | Vercel | https://syncwriter.vercel.app |
| Backend | Render.com (Docker) | https://collab-editor-ofkg.onrender.com |

> **Note:** The backend runs on Render's free tier and spins down after 15 minutes of inactivity. First room creation after inactivity may take ~50 seconds to wake up.

---

## Roadmap
- [ ] Persistent rooms with database-backed document storage
- [ ] Voice/video chat within rooms
- [ ] More language runtimes (Java, Go, Rust)
- [ ] File tree with multi-file support
- [ ] Vim / Emacs keybinding modes

---

## Author

**Ramgopal Garudkar** — Frontend Engineer

[LinkedIn](https://linkedin.com/in/ramgopal-garudkar) · [GitHub](https://github.com/rgarudkar)

---

## License

MIT
