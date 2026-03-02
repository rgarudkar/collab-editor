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
    const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(
        null
    );
    const [isBindingComplete, setIsBindingComplete] = useState(false);
    const providerRef = useRef<WebrtcProvider | null>(null);
    const bindingRef = useRef<MonacoBinding | null>(null);
    const ydocRef = useRef<Y.Doc | null>(null);

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

    const { user } = useUser();
    const [isRoomFull, setIsRoomFull] = useState(false);

    const handleEditorDidMount = (
        editor: monaco.editor.IStandaloneCodeEditor,
        monacoInstance: typeof monaco
    ) => {
        monacoEditorRef.current = editor;

        // Initialize Yjs Document
        const ydoc = new Y.Doc();
        ydocRef.current = ydoc;

        if (onYDocReady) {
            onYDocReady(ydoc);
        }

        // WebrtcProvider connects to the signaling server and peers
        // Use the current window's hostname to allow connections from other devices on the same network
        // (e.g. if accessed via 192.168.1.X, the websocket should connect to 192.168.1.X)
        const signalingHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        const signalingUrl = process.env.NEXT_PUBLIC_SIGNALING_URL || `ws://${signalingHost}:4444`;

        const provider = new WebrtcProvider(roomName, ydoc, {
            signaling: [signalingUrl],
        });
        providerRef.current = provider;

        // Get the shared text type
        const ytext = ydoc.getText("monaco");

        // Bind Yjs to the Monaco Editor
        const binding = new MonacoBinding(
            ytext,
            monacoEditorRef.current.getModel()!,
            new Set([monacoEditorRef.current]),
            provider.awareness
        );
        bindingRef.current = binding;

        // Shared Logs Array
        const ylogs = ydoc.getArray<string>("execution-logs");
        if (onOutputChange) {
            ylogs.observe(() => {
                onOutputChange(ylogs.toArray());
            });
            // Initial logs push
            onOutputChange(ylogs.toArray());
        }

        // Expose a function to push new logs to the array
        if (onPushLogRef) {
            onPushLogRef((newLogs: string[]) => {
                ylogs.delete(0, ylogs.length); // Clear old logs
                ylogs.push(newLogs); // Push new logs. This syncs over WebRTC
            });
        }

        // Shared Language Map
        const ystate = ydoc.getMap<string>("editor-state");
        if (onLanguageChange) {
            ystate.observe(() => {
                const syncedLang = ystate.get("language");
                if (syncedLang) {
                    onLanguageChange(syncedLang);
                }
            });
            // Initial sync if taking over room
            if (ystate.has("language")) {
                onLanguageChange(ystate.get("language")!);
            }
        }

        // Expose a function to change the global language
        if (onPushLanguageRef) {
            onPushLanguageRef((newLang: string) => {
                ystate.set("language", newLang);
            });
        }

        // Set cursor and awareness info using Clerk identity (or Guest fallback)
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

        // HACK: y-monaco doesn't automatically add the user's name to the DOM element
        // for the cursor header, and doesn't inject distinct CSS per user properly.
        // We observe awareness changes to explicitly map client IDs to their specific colors
        // and inject custom CSS rules per connected user to ensure robust rendering.
        provider.awareness.on('change', () => {
            setTimeout(() => {
                const states = Array.from(provider.awareness.getStates().entries());

                // Room Limiting Logic (Max 4 Users)
                if (states.length > 4) {
                    // Yjs typically assigns the highest ClientID incrementally but we can check 
                    // if our ID is arbitrarily excluded or just kill the connection.
                    setIsRoomFull(true);
                    provider.disconnect();
                    return;
                }

                // 1. Maintain dynamic CSS for all connected peers
                let dynamicCss = '';

                // Track active users for the header UI
                const activeUsers: any[] = [];
                const seenClientIds = new Set();

                // 2. Map data attributes onto the DOM by injecting CSS targeting y-monaco's generated classes
                states.forEach(([clientId, state]) => {
                    if (state?.user) {
                        const color = state.user.color;
                        const name = state.user.name;
                        const avatar = state.user.avatar;

                        // Create a translucent version of the hex color for text selections
                        let r = 0, g = 0, b = 0;
                        if (color.length === 7) {
                            r = parseInt(color.slice(1, 3), 16);
                            g = parseInt(color.slice(3, 5), 16);
                            b = parseInt(color.slice(5, 7), 16);
                        }
                        const translucentColor = `rgba(${r}, ${g}, ${b}, 0.15)`;

                        // Prevent duplicates and add to active users list
                        if (!seenClientIds.has(clientId)) {
                            seenClientIds.add(clientId);
                            activeUsers.push({
                                clientId,
                                name,
                                color,
                                avatar,
                                isMe: clientId === ydoc.clientID
                            });
                        }

                        // We skip generating dynamic CSS for the local user because y-monaco only manages remote cursors
                        if (clientId !== ydoc.clientID) {
                            // Generate CSS strictly for this specific user's cursor
                            const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" style="transform: rotate(-25deg);"><path d="M4 4l5.5 16 3-6.5L19 10.5 4 4z"></path></svg>`;
                            const svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;

                            // Y-monaco adds the following classes to decorations: .yRemoteSelection-${clientId} and .yRemoteSelectionHead-${clientId}
                            // By using these exact selectors with !important, we override y-monaco's default inline <style> injection.
                            dynamicCss += `
                                .yRemoteSelection-${clientId} {
                                    background-color: ${translucentColor} !important;
                                }
                                .yRemoteSelectionHead-${clientId} {
                                    position: absolute !important;
                                    border: none !important;
                                    background: transparent !important;
                                    height: 100% !important;
                                    width: 2px !important;
                                    box-sizing: border-box !important;
                                    margin: 0 !important;
                                    padding: 0 !important;
                                }
                                .yRemoteSelectionHead-${clientId}::after {
                                    position: absolute !important;
                                    content: ' ' !important;
                                    background-image: url('${svgDataUrl}') !important;
                                    background-size: contain !important;
                                    background-repeat: no-repeat !important;
                                    background-position: center !important;
                                    border: none !important;      /* Clears y-monaco's default block cursor */
                                    border-radius: 0 !important;  
                                    width: 24px !important;
                                    height: 24px !important;
                                    left: -12px !important;
                                    top: 0px !important; 
                                    filter: drop-shadow(0px 10px 15px rgba(0,0,0,0.5)) !important;
                                    z-index: 90 !important;
                                }
                                .yRemoteSelectionHead-${clientId}::before {
                                    position: absolute !important;
                                    content: '${name}' !important;
                                    background-color: ${color} !important;
                                    top: 26px !important; 
                                    left: 10px !important;
                                    color: #fff !important;
                                    font-size: 11px !important;
                                    font-family: inherit !important;
                                    font-weight: 700 !important;
                                    padding: 4px 8px !important;
                                    border-radius: 4px !important;
                                    white-space: nowrap !important;
                                    z-index: 100 !important;
                                    pointer-events: none !important;
                                    opacity: 0 !important;
                                    transition: opacity 0.2s ease-in-out !important;
                                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3) !important;
                                    border: 1px solid rgba(255,255,255,0.2) !important;
                                }
                                .yRemoteSelectionHead-${clientId}:hover::before {
                                    opacity: 1 !important;
                                }
                            `;
                        }
                    }
                });

                // Inject the generated per-user CSS into our style tag
                const styleId = `y-monaco-dynamic-cursors-${roomName}`;
                let styleElement = document.getElementById(styleId);
                if (styleElement) {
                    styleElement.innerHTML = dynamicCss;
                }

                // Expose active users up to the parent component
                if (onUsersChange) {
                    onUsersChange(activeUsers);
                }

            }, 50);
        });

        setIsBindingComplete(true);
    };

    useEffect(() => {
        // Inject core layout CSS for y-monaco remote cursors (shared skeleton)
        const styleId = `y-monaco-core-style-${roomName}`;
        let style = document.getElementById(styleId) as HTMLStyleElement;

        const dynamicStyleId = `y-monaco-dynamic-cursors-${roomName}`;
        let dynamicStyle = document.getElementById(dynamicStyleId) as HTMLStyleElement;

        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            document.head.appendChild(style);
        }

        if (!dynamicStyle) {
            dynamicStyle = document.createElement('style');
            dynamicStyle.id = dynamicStyleId;
            document.head.appendChild(dynamicStyle);
        }

        // Provide absolute global overrides to completely wipe out y-monaco's built-in 
        // fallback "orange block" styles so they never show up under our custom SVGs
        style.innerHTML = `
            .yRemoteSelectionHead {
                position: absolute;
                border: none !important;
                background: transparent !important;
                box-sizing: border-box;
                height: 100%;
                width: 2px !important;
                margin: 0;
            }
            .yRemoteSelectionHead::after {
                border: none !important;
                background: transparent !important;
                display: block !important;
                content: " " !important;
            }
        `;

        return () => {
            // Cleanup on unmount
            if (style && style.parentNode) {
                style.parentNode.removeChild(style);
            }
            bindingRef.current?.destroy();
            providerRef.current?.destroy();
            ydocRef.current?.destroy();
        };
    }, [roomName]);

    return (
        <div className="relative w-full h-full min-h-[500px] border border-gray-700/50 rounded-xl overflow-hidden shadow-2xl bg-[#1e1e1e] flex flex-col">
            {isRoomFull && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#1e1e1e]/90 backdrop-blur-md">
                    <div className="flex flex-col items-center max-w-sm text-center bg-gray-900 border border-red-500/50 p-8 rounded-2xl shadow-2xl">
                        <svg className="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
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
