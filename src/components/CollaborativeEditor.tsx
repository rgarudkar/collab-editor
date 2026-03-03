"use client";

import React, { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { MonacoBinding } from "y-monaco";
import { useUser } from "@clerk/nextjs";
import Editor, { useMonaco } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

interface CollaborativeEditorProps {
    roomName: string;
    language?: string;
    onLanguageChange?: (lang: string) => void;
    onOutputChange?: (logs: string[]) => void;
    onPushLogRef?: (pushFn: (logs: string[]) => void) => void;
    onPushLanguageRef?: (pushFn: (lang: string) => void) => void;
    onYDocReady?: (ydoc: Y.Doc) => void;
    onUsersChange?: (users: any[]) => void;
}

export default function CollaborativeEditor({
    roomName,
    language = "javascript",
    onLanguageChange,
    onOutputChange,
    onPushLogRef,
    onPushLanguageRef,
    onYDocReady,
    onUsersChange,
}: CollaborativeEditorProps) {
    const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const [isBindingComplete, setIsBindingComplete] = useState(false);
    const providerRef = useRef<WebrtcProvider | null>(null);
    const bindingRef = useRef<MonacoBinding | null>(null);
    const ydocRef = useRef<Y.Doc | null>(null);
    const mutationObserverRef = useRef<MutationObserver | null>(null);

    // Maps clientId → { color, name } so the MutationObserver can decorate new elements
    const cursorMetaRef = useRef<Map<number, { color: string; name: string }>>(new Map());

    const getColorFromName = (name: string) => {
        const vibrantColors = [
            '#f59e0b', '#3b82f6', '#10b981', '#ec4899',
            '#8b5cf6', '#ef4444', '#06b6d4', '#f97316',
            '#14b8a6', '#f43f5e', '#a855f7', '#6366f1'
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return vibrantColors[Math.abs(hash) % vibrantColors.length];
    };

    // "Ramgopal Garudkar" → "RG" | "Anonymous Fox" → "AF" | "Alice" → "Al"
    const getInitials = (name: string): string => {
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    const { user } = useUser();
    const [isRoomFull, setIsRoomFull] = useState(false);

    // ─────────────────────────────────────────────────────────────────────────────
    // Inject real SVG + badge DOM nodes directly into a .yRemoteSelectionHead element.
    // This bypasses all ::after/::before CSS issues inside Monaco's sandboxed DOM.
    // ─────────────────────────────────────────────────────────────────────────────
    const decorateCursorHead = (el: Element, color: string, name: string) => {
        const key = color + name;
        if ((el as HTMLElement).dataset.decorated === key) return;
        (el as HTMLElement).dataset.decorated = key;

        const initials = getInitials(name);

        // Wipe anything y-monaco injected
        el.innerHTML = '';

        // ── Stem: apply styles inline so nothing can override them ──
        const stem = el as HTMLElement;
        stem.style.cssText = `
            position: absolute !important;
            width: 2px !important;
            height: 100% !important;
            background: ${color} !important;
            box-shadow: 0 0 8px 2px ${color}88 !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            pointer-events: none !important;
            border-radius: 1px !important;
        `;

        // ── SVG arrow pointer (real DOM node, not background-image) ──
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", "18");
        svg.setAttribute("height", "22");
        svg.setAttribute("viewBox", "0 0 18 22");
        svg.style.cssText = `
            position: absolute;
            left: -1px;
            top: 0;
            overflow: visible;
            pointer-events: none;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
            animation: yjsCursorAppear 0.22s cubic-bezier(0.34,1.56,0.64,1) both;
            transform-origin: top left;
            z-index: 99;
        `;

        // Classic triangular pointer — tip at top-left (2,1)
        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", "M2,1 L2,17 L6,13 L9,20 L11.5,19 L8.5,12 L14,12 Z");
        path.setAttribute("fill", color);
        path.setAttribute("stroke", "rgba(255,255,255,0.9)");
        path.setAttribute("stroke-width", "1.2");
        path.setAttribute("stroke-linejoin", "round");
        path.setAttribute("stroke-linecap", "round");
        svg.appendChild(path);

        // ── Name badge ──
        const badge = document.createElement("div");
        badge.style.cssText = `
            position: absolute;
            top: 20px;
            left: 12px;
            background: ${color};
            color: #fff;
            font-family: ui-monospace, 'SF Mono', 'Fira Code', Consolas, monospace;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.06em;
            padding: 2px 7px;
            border-radius: 0 5px 5px 5px;
            white-space: nowrap;
            pointer-events: none;
            box-shadow: 0 3px 12px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.15);
            text-shadow: 0 1px 2px rgba(0,0,0,0.4);
            animation: yjsBadgePop 0.28s cubic-bezier(0.34,1.56,0.64,1) both;
            z-index: 100;
            user-select: none;
            min-width: 22px;
            text-align: center;
            transition: padding 0.15s ease, font-size 0.15s ease, border-radius 0.15s ease;
        `;
        badge.textContent = initials;

        // ── Invisible hit-area for hover (badge itself has pointer-events:none) ──
        const hitArea = document.createElement("div");
        hitArea.style.cssText = `
            position: absolute;
            top: 18px;
            left: 10px;
            width: 80px;
            height: 24px;
            pointer-events: auto;
            z-index: 101;
            cursor: default;
        `;

        hitArea.addEventListener("mouseenter", () => {
            badge.textContent = name;
            badge.style.padding = "3px 9px";
            badge.style.fontSize = "11px";
            badge.style.letterSpacing = "0.02em";
            badge.style.borderRadius = "0 6px 6px 6px";
            hitArea.style.width = `${Math.max(80, name.length * 7 + 20)}px`;
        });
        hitArea.addEventListener("mouseleave", () => {
            badge.textContent = initials;
            badge.style.padding = "2px 7px";
            badge.style.fontSize = "10px";
            badge.style.letterSpacing = "0.06em";
            badge.style.borderRadius = "0 5px 5px 5px";
            hitArea.style.width = "80px";
        });

        el.appendChild(svg);
        el.appendChild(badge);
        el.appendChild(hitArea);
    };

    // Scan the entire DOM for known cursor elements and decorate them
    const refreshCursorDecorations = () => {
        cursorMetaRef.current.forEach(({ color, name }, clientId) => {
            document.querySelectorAll(`.yRemoteSelectionHead-${clientId}`)
                .forEach(el => decorateCursorHead(el, color, name));
        });
    };

    const handleEditorDidMount = (
        editor: monaco.editor.IStandaloneCodeEditor,
        monacoInstance: typeof monaco
    ) => {
        monacoEditorRef.current = editor;

        const ydoc = new Y.Doc();
        ydocRef.current = ydoc;
        if (onYDocReady) onYDocReady(ydoc);

        const signalingHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        const signalingUrl = process.env.NEXT_PUBLIC_SIGNALING_URL || `ws://${signalingHost}:4444`;

        const provider = new WebrtcProvider(roomName, ydoc, { signaling: [signalingUrl] });
        providerRef.current = provider;

        const ytext = ydoc.getText("monaco");
        const binding = new MonacoBinding(
            ytext,
            monacoEditorRef.current.getModel()!,
            new Set([monacoEditorRef.current]),
            provider.awareness
        );
        bindingRef.current = binding;

        // Shared logs
        const ylogs = ydoc.getArray<string>("execution-logs");
        if (onOutputChange) {
            ylogs.observe(() => onOutputChange(ylogs.toArray()));
            onOutputChange(ylogs.toArray());
        }
        if (onPushLogRef) {
            onPushLogRef((newLogs: string[]) => {
                ylogs.delete(0, ylogs.length);
                ylogs.push(newLogs);
            });
        }

        // Shared language
        const ystate = ydoc.getMap<string>("editor-state");
        if (onLanguageChange) {
            ystate.observe(() => {
                const syncedLang = ystate.get("language");
                if (syncedLang) onLanguageChange(syncedLang);
            });
            if (ystate.has("language")) onLanguageChange(ystate.get("language")!);
        }
        if (onPushLanguageRef) {
            onPushLanguageRef((newLang: string) => ystate.set("language", newLang));
        }

        // Identity
        const generateGuestIdentity = () => {
            const animals = ["Fox", "Panda", "Tiger", "Penguin", "Koala", "Lion", "Wolf", "Leopard"];
            const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
            return {
                name: `Anonymous ${randomAnimal}`,
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${randomAnimal}${Math.random()}`
            };
        };

        const isGuest = !user;
        const guestIdentity = isGuest ? generateGuestIdentity() : null;
        const userName = user?.fullName || user?.firstName || user?.username || guestIdentity?.name || "Guest";
        const userAvatar = user?.imageUrl || guestIdentity?.avatar || "";
        const computedColor = getColorFromName(userName);

        provider.awareness.setLocalStateField("user", {
            name: userName,
            color: computedColor,
            avatar: userAvatar,
            isGuest: isGuest
        });

        // ── Awareness → sync cursorMetaRef → redecorate ──
        provider.awareness.on('change', () => {
            setTimeout(() => {
                const states = Array.from(provider.awareness.getStates().entries());

                if (states.length > 4) {
                    setIsRoomFull(true);
                    provider.disconnect();
                    return;
                }

                const activeUsers: any[] = [];
                const seenIds = new Set<number>();
                cursorMetaRef.current.clear();

                states.forEach(([clientId, state]) => {
                    if (state?.user && !seenIds.has(clientId)) {
                        seenIds.add(clientId);
                        const { color, name, avatar } = state.user;

                        if (clientId !== ydoc.clientID) {
                            cursorMetaRef.current.set(clientId, { color, name });
                        }

                        activeUsers.push({ clientId, name, color, avatar, isMe: clientId === ydoc.clientID });
                    }
                });

                refreshCursorDecorations();
                if (onUsersChange) onUsersChange(activeUsers);
            }, 50);
        });

        // ── MutationObserver: catch new cursor elements as Monaco re-renders ──
        const editorDom = editor.getDomNode();
        if (editorDom) {
            const observer = new MutationObserver(() => refreshCursorDecorations());
            observer.observe(editorDom, { childList: true, subtree: true });
            mutationObserverRef.current = observer;
        }

        setIsBindingComplete(true);
    };

    useEffect(() => {
        // Keyframe animations + strip y-monaco's default orange cursor — injected once globally
        const styleId = `y-monaco-cursor-keyframes-${roomName}`;
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
                @keyframes yjsCursorAppear {
                    from { opacity: 0; transform: scale(0.5) translateY(-6px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes yjsBadgePop {
                    0%   { opacity: 0; transform: scale(0.75) translateY(-4px); }
                    65%  { opacity: 1; transform: scale(1.07) translateY(1px); }
                    100% { opacity: 1; transform: scale(1)    translateY(0); }
                }

                /* Nuke every possible y-monaco default style */
                .yRemoteSelectionHead,
                [class^="yRemoteSelectionHead"] {
                    border: none !important;
                    border-left: none !important;
                    border-top: none !important;
                    border-bottom: none !important;
                    background: transparent !important;
                    overflow: visible !important;
                }
                .yRemoteSelectionHead::after,
                [class^="yRemoteSelectionHead"]::after,
                .yRemoteSelectionHead::before,
                [class^="yRemoteSelectionHead"]::before {
                    display: none !important;
                    content: none !important;
                    border: none !important;
                    background: transparent !important;
                    width: 0 !important;
                    height: 0 !important;
                }
            `;
            document.head.appendChild(style);
        }

        return () => {
            mutationObserverRef.current?.disconnect();
            bindingRef.current?.destroy();
            providerRef.current?.destroy();
            ydocRef.current?.destroy();
            document.getElementById(styleId)?.remove();
        };
    }, [roomName]);

    return (
        <div className="relative w-full h-full min-h-[500px] border border-gray-700/50 rounded-xl overflow-hidden shadow-2xl bg-[#1e1e1e] flex flex-col">
            {isRoomFull && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#1e1e1e]/90 backdrop-blur-md">
                    <div className="flex flex-col items-center max-w-sm text-center bg-gray-900 border border-red-500/50 p-8 rounded-2xl shadow-2xl">
                        <svg className="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <h2 className="text-xl font-bold text-white mb-2">Workspace Full</h2>
                        <p className="text-gray-400 text-sm">This collaborative session has reached maximum capacity (4 users) to ensure high-performance peer-to-peer syncing.</p>
                    </div>
                </div>
            )}
            {!isBindingComplete && !isRoomFull && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]/80 backdrop-blur-sm z-20 text-white/70">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm font-medium">Connecting to workspace...</p>
                    </div>
                </div>
            )}
            <div className="flex-1 relative w-full min-h-0 z-10">
                <div className="absolute inset-0">
                    <Editor
                        height="100%"
                        language={language}
                        theme="vs-dark"
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            wordWrap: "on",
                            lineNumbersMinChars: 3,
                            padding: { top: 16, bottom: 16 },
                            scrollBeyondLastLine: false,
                            smoothScrolling: true,
                            cursorBlinking: "smooth",
                            cursorSmoothCaretAnimation: "on",
                            formatOnPaste: true,
                        }}
                        onMount={handleEditorDidMount}
                        loading={<div className="text-white/50 p-4">Initializing Editor Engine...</div>}
                    />
                </div>
            </div>
        </div>
    );
}