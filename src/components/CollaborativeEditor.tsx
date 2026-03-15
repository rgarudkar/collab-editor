"use client";

import React, { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { MonacoBinding } from "y-monaco";
import { useSession } from "next-auth/react";
import Editor from "@monaco-editor/react";
import * as monaco from "monaco-editor";

interface CollaborativeEditorProps {
    roomName: string;
    language?: string;
    readOnly?: boolean;
    previewValue?: string;
    onLanguageChange?: (lang: string) => void;
    onOutputChange?: (logs: string[]) => void;
    onPushLogRef?: (pushFn: (logs: string[]) => void) => void;
    onPushLanguageRef?: (pushFn: (lang: string) => void) => void;
    onYDocReady?: (ydoc: Y.Doc) => void;
    onUsersChange?: (users: any[]) => void;
}

/**
 * WHY THIS WRAPPER EXISTS — THE CURSOR BUG EXPLAINED
 *
 * y-monaco's MonacoBinding does two things with awareness:
 *   1. On local cursor move  → awareness.setLocalStateField('selection', ...)
 *   2. On remote text change → editor.setSelection(savedPos) to keep the local
 *      cursor stable after text is inserted above/before it.
 *
 * Step 2 triggers Monaco's onDidChangeCursorSelection event, which fires step 1
 * again — even though the local user didn't actually move their cursor.
 * This causes THIS tab to re-broadcast its cursor position on every keystroke
 * from a REMOTE user. The other tab sees the broadcast, re-renders the cursor
 * decoration, and the remote cursor appears to "jump" or flicker.
 *
 * Fix: wrap the awareness object so that `setLocalStateField('selection', ...)`
 * is a no-op while we are inside a Yjs transaction triggered by a remote origin.
 * We detect "remote origin" by observing the ytext and setting a flag for the
 * duration of the microtask. Since editor.setSelection() → onDidChangeCursorSelection
 * → setLocalStateField all happen synchronously in the same call stack as the
 * ytext observer, the flag is reliably set when the spurious broadcast occurs.
 */
function createSuppressableAwareness(awareness: InstanceType<typeof import("y-protocols/awareness").Awareness>) {
    let suppressSelectionBroadcast = false;

    const proxy = new Proxy(awareness, {
        get(target, prop) {
            if (prop === "setLocalStateField") {
                return (field: string, value: any) => {
                    // Drop selection broadcasts that happen during remote text application.
                    if (field === "selection" && suppressSelectionBroadcast) return;
                    return target.setLocalStateField(field, value);
                };
            }
            const val = (target as any)[prop];
            return typeof val === "function" ? val.bind(target) : val;
        },
    });

    return { proxy, setSuppressed: (v: boolean) => { suppressSelectionBroadcast = v; } };
}

export default function CollaborativeEditor({
    roomName,
    language = "javascript",
    readOnly = false,
    previewValue = "",
    onLanguageChange,
    onOutputChange,
    onPushLogRef,
    onPushLanguageRef,
    onYDocReady,
    onUsersChange,
}: CollaborativeEditorProps) {
    const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
    const [isBindingComplete, setIsBindingComplete] = useState(false);
    const [isYReady, setIsYReady] = useState(false);
    const [isRoomFull, setIsRoomFull] = useState(false);

    const providerRef = useRef<WebrtcProvider | null>(null);
    const bindingRef = useRef<MonacoBinding | null>(null);
    const ydocRef = useRef<Y.Doc | null>(null);
    const localClientIdRef = useRef<number | null>(null);
    const decoratedClientsRef = useRef<Set<number>>(new Set());
    // Ref to the suppression toggle so the binding effect can use it
    const setSuppressedRef = useRef<((v: boolean) => void) | null>(null);

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

    const { data: session } = useSession();
    const user = session?.user;

    const injectCursorStyles = (activeUsers: any[]) => {
        let styleStr = '';
        activeUsers.forEach(u => {
            if (u.isMe) return; // Never inject CSS for own clientId

            const isNew = !decoratedClientsRef.current.has(u.clientId);
            if (isNew) decoratedClientsRef.current.add(u.clientId);

            const nameParts = u.name.split(' ');
            const displayName = u.isGuest ? `${nameParts[0]} ${nameParts[1] || ''}` : nameParts[0];
            const rgbColor = u.color;

            styleStr += `
                .yRemoteSelectionHead-${u.clientId} {
                    position: absolute;
                    box-sizing: border-box;
                    height: 100%;
                    width: 2px;
                    background-color: ${rgbColor} !important;
                    background-image: linear-gradient(to bottom, ${rgbColor}, ${rgbColor}44) !important;
                    box-shadow: 0 0 8px 1px ${rgbColor}88 !important;
                    border-radius: 2px;
                    z-index: 4;
                }
                .yRemoteSelection-${u.clientId} {
                    background-color: ${rgbColor}33 !important;
                    border-radius: 2px;
                }
                .yRemoteSelectionHead-${u.clientId}::before {
                    content: '';
                    position: absolute;
                    top: -4px;
                    left: -3px;
                    width: 8px;
                    height: 8px;
                    background: ${rgbColor};
                    border: 1.5px solid #ffffff;
                    border-radius: 50%;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3), 0 0 8px ${rgbColor}AA;
                    box-sizing: border-box;
                    z-index: 5;
                    ${isNew ? 'animation: cursorAnchorAppear 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards;' : ''}
                }
                .yRemoteSelectionHead-${u.clientId}::after {
                    content: '${displayName}';
                    position: absolute;
                    bottom: calc(100% + 6px);
                    left: 2px;
                    background: ${rgbColor};
                    color: #fff;
                    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
                    font-size: 11px;
                    font-weight: 600;
                    line-height: 1;
                    padding: 4px 8px;
                    border-radius: 6px 6px 6px 0;
                    white-space: nowrap;
                    pointer-events: none;
                    box-shadow: 0 6px 12px rgba(0,0,0,0.15), inset 0 0 0 1px rgba(255,255,255,0.2);
                    text-shadow: 0 1px 1.5px rgba(0,0,0,0.2);
                    z-index: 5;
                    transform-origin: bottom left;
                    ${isNew ? 'animation: cursorBadgeAppear 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;' : ''}
                }
            `;
        });

        const styleId = `yjs-dynamic-cursors-${roomName}`;
        let styleTag = document.getElementById(styleId);
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = styleId;
            document.head.appendChild(styleTag);
        }
        styleTag.innerHTML = styleStr;
    };

    // Initialize YDoc and Provider once
    useEffect(() => {
        const ydoc = new Y.Doc();
        ydocRef.current = ydoc;
        localClientIdRef.current = ydoc.clientID;

        if (onYDocReady) onYDocReady(ydoc);

        const signalingHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        const signalingUrl = process.env.NEXT_PUBLIC_SIGNALING_URL || `ws://${signalingHost}:4444`;
        const provider = new WebrtcProvider(roomName, ydoc, { signaling: [signalingUrl] });
        providerRef.current = provider;

        const generateGuestIdentity = () => {
            const animals = ["Fox", "Panda", "Tiger", "Penguin", "Koala", "Lion", "Wolf", "Leopard", "Rabbit", "Deer"];
            const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
            const guestId = Math.floor(Math.random() * 1000);
            return {
                name: `Guest ${randomAnimal} #${guestId}`,
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${randomAnimal}${guestId}`
            };
        };

        const isGuest = !user;
        const guestIdent = isGuest ? generateGuestIdentity() : null;
        const userName = user?.name || guestIdent?.name || "Guest";
        const userAvatar = user?.image || guestIdent?.avatar || "";
        const computedColor = getColorFromName(userName);

        provider.awareness.setLocalStateField("user", {
            name: userName,
            color: computedColor,
            avatar: userAvatar,
            isGuest: isGuest
        });

        provider.awareness.on('change', () => {
            const states = Array.from(provider.awareness.getStates().entries());
            if (states.length > 4) {
                setIsRoomFull(true);
                provider.disconnect();
                return;
            }

            const activeUsers: any[] = [];
            const seenIds = new Set<number>();
            const myClientId = localClientIdRef.current!;

            states.forEach(([clientId, state]) => {
                if (state?.user && !seenIds.has(clientId)) {
                    seenIds.add(clientId);
                    const { color, name, avatar, isGuest: uIsGuest } = state.user;
                    activeUsers.push({
                        clientId,
                        name,
                        color,
                        avatar,
                        isGuest: uIsGuest,
                        isMe: clientId === myClientId,
                    });
                }
            });

            injectCursorStyles(activeUsers);
            if (onUsersChange) onUsersChange(activeUsers);
        });

        const ylogs = ydoc.getArray<string>("execution-logs");
        const ystate = ydoc.getMap<string>("editor-state");

        const logObserver = () => onOutputChange?.(ylogs.toArray());
        const stateObserver = () => {
            const syncedLang = ystate.get("language");
            if (syncedLang && onLanguageChange) onLanguageChange(syncedLang);
        };

        ylogs.observe(logObserver);
        ystate.observe(stateObserver);

        if (onOutputChange) onOutputChange(ylogs.toArray());
        if (ystate.has("language") && onLanguageChange) onLanguageChange(ystate.get("language")!);

        if (onPushLogRef) {
            onPushLogRef((newLogs: string[]) => {
                ylogs.delete(0, ylogs.length);
                ylogs.push(newLogs);
            });
        }
        if (onPushLanguageRef) {
            onPushLanguageRef((newLang: string) => ystate.set("language", newLang));
        }

        setIsYReady(true);

        return () => {
            provider.destroy();
            ydoc.destroy();
            localClientIdRef.current = null;
            setIsYReady(false);
        };
    }, [roomName, onYDocReady, onOutputChange, onPushLogRef, onLanguageChange, onPushLanguageRef, onUsersChange]);

    // Handle Identity Updates separately
    useEffect(() => {
        if (providerRef.current) {
            const userName = user?.name;
            if (userName) {
                providerRef.current.awareness.setLocalStateField("user", {
                    name: userName,
                    color: getColorFromName(userName),
                    avatar: user?.image || "",
                    isGuest: false
                });
            }
        }
    }, [user]);

    // Binding Lifecycle
    useEffect(() => {
        if (!editorInstance || !isYReady || !ydocRef.current || !providerRef.current || readOnly) {
            if (readOnly) setIsBindingComplete(true);
            return;
        }

        const ydoc = ydocRef.current;
        const ytext = ydoc.getText("monaco");

        // Create the suppressable awareness proxy.
        // This is the core fix: when a REMOTE ytext change comes in, y-monaco calls
        // editor.setSelection() to preserve the local cursor position. That call
        // triggers onDidChangeCursorSelection, which calls awareness.setLocalStateField
        // — pointlessly re-broadcasting this tab's cursor to all peers, making them
        // all re-render and causing the "ghost cursor moving" visual bug.
        // The proxy intercepts that broadcast and drops it.
        const { proxy: awarenessProxy, setSuppressed } = createSuppressableAwareness(
            providerRef.current.awareness
        );
        setSuppressedRef.current = setSuppressed;

        // Observe ytext to know when we are applying a REMOTE change.
        // A remote change has a transaction origin that is NOT our local doc.
        // We set the suppression flag for the synchronous duration of the observer
        // call — which is exactly when y-monaco calls editor.setSelection() and
        // triggers the spurious awareness broadcast.
        const suppressObserver = (event: Y.YTextEvent, transaction: Y.Transaction) => {
            const isRemote = transaction.origin !== ydoc.clientID && transaction.origin !== null;
            if (isRemote) {
                setSuppressed(true);
                // The selection restore happens synchronously, so we can lift the
                // flag in a microtask — after the current call stack unwinds.
                Promise.resolve().then(() => setSuppressed(false));
            }
        };
        ytext.observe(suppressObserver);

        const binding = new MonacoBinding(
            ytext,
            editorInstance.getModel()!,
            new Set([editorInstance]),
            awarenessProxy as any
        );
        bindingRef.current = binding;
        setIsBindingComplete(true);

        return () => {
            ytext.unobserve(suppressObserver);
            binding.destroy();
            bindingRef.current = null;
            setSuppressedRef.current = null;
            setIsBindingComplete(false);
        };
    }, [readOnly, editorInstance, isYReady]);

    const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
        setEditorInstance(editor);
    };

    useEffect(() => {
        const styleId = `y-monaco-cursor-keyframes-${roomName}`;
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
                @keyframes cursorAnchorAppear {
                    from { opacity: 0; transform: scale(0.2); }
                    to   { opacity: 1; transform: scale(1); }
                }
                @keyframes cursorBadgeAppear {
                    from { opacity: 0; transform: scale(0.6) translateY(8px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                }
                .yRemoteSelectionHead, [class^="yRemoteSelectionHead"] { overflow: visible !important; transition: none !important; }
                .yRemoteSelection, [class^="yRemoteSelection"] { transition: none !important; }
                .monaco-editor .overflowingContentWidgets,
                .monaco-editor .suggest-widget,
                .monaco-editor .parameter-hints-widget,
                .monaco-editor .monaco-hover,
                .monaco-editor .context-view {
                    z-index: 9999 !important;
                    overflow: visible !important;
                }
                .monaco-editor-overlaymessage,
                .monaco-aria-container,
                .overflowingContentWidgets {
                    position: fixed !important;
                    z-index: 9999 !important;
                }
            `;
            document.head.appendChild(style);
        }

        return () => {
            document.getElementById(styleId)?.remove();
            document.getElementById(`yjs-dynamic-cursors-${roomName}`)?.remove();
        };
    }, [roomName]);

    return (
        <div className="relative w-full h-full min-h-[500px] border border-gray-700/50 rounded-xl shadow-2xl bg-[#1e1e1e] flex flex-col" style={{ overflow: 'visible' }}>
            {isRoomFull && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#1e1e1e]/90 backdrop-blur-md rounded-xl">
                    <div className="flex flex-col items-center max-w-sm text-center bg-gray-900 border border-red-500/50 p-8 rounded-2xl shadow-2xl">
                        <svg className="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <h2 className="text-xl font-bold text-white mb-2">Workspace Full</h2>
                        <p className="text-gray-400 text-sm">Capacity reached. Try again later.</p>
                    </div>
                </div>
            )}
            {(!isBindingComplete && !readOnly) && !isRoomFull && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]/80 backdrop-blur-sm z-20 text-white/70">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm font-medium">Connecting to workspace...</p>
                    </div>
                </div>
            )}
            <div className="flex-1 relative w-full min-h-0 z-[100]" style={{ overflow: 'visible' }}>
                <div className="absolute inset-0" style={{ overflow: 'visible' }}>
                    <Editor
                        height="100%"
                        language={language}
                        theme="vs-dark"
                        value={readOnly ? previewValue : undefined}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            wordWrap: "on",
                            lineNumbersMinChars: 3,
                            padding: { top: 28, bottom: 16 },
                            scrollBeyondLastLine: false,
                            smoothScrolling: true,
                            cursorBlinking: readOnly ? "solid" : "smooth",
                            cursorSmoothCaretAnimation: "on",
                            formatOnPaste: true,
                            fixedOverflowWidgets: true,
                            readOnly: readOnly,
                            domReadOnly: readOnly,
                        }}
                        onMount={handleEditorDidMount}
                        loading={<div className="text-white/50 p-4">Initializing Editor Engine...</div>}
                    />
                </div>
            </div>
        </div>
    );
}