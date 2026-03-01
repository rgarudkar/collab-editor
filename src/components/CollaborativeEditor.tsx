"use client";

import React, { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { MonacoBinding } from "y-monaco";
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
}

export default function CollaborativeEditor({
    roomName,
    language = "javascript",
    onLanguageChange,
    onOutputChange,
    onPushLogRef,
    onPushLanguageRef,
    onYDocReady,
}: CollaborativeEditorProps) {
    const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(
        null
    );
    const [isBindingComplete, setIsBindingComplete] = useState(false);
    const providerRef = useRef<WebrtcProvider | null>(null);
    const bindingRef = useRef<MonacoBinding | null>(null);
    const ydocRef = useRef<Y.Doc | null>(null);

    // Generates a random color for the cursor
    // Generates a visible, vibrant color for the cursor
    const cursorColor = useRef(
        `hsl(${Math.floor(Math.random() * 360)}, 100%, 65%)`
    );

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

        // Set cursor and awareness info
        const userName = `User-${Math.floor(Math.random() * 1000)}`;
        provider.awareness.setLocalStateField("user", {
            name: userName,
            color: cursorColor.current,
        });

        // HACK: y-monaco doesn't automatically add the user's name to the DOM element
        // for the cursor header, and doesn't inject distinct CSS per user properly.
        // We observe awareness changes to explicitly map client IDs to their specific colors
        // and inject custom CSS rules per connected user to ensure robust rendering.
        provider.awareness.on('change', () => {
            setTimeout(() => {
                const states = Array.from(provider.awareness.getStates().entries());

                // 1. Maintain dynamic CSS for all connected peers
                let dynamicCss = '';

                // 2. Map data attributes onto the DOM
                states.forEach(([clientId, state]) => {
                    if (state?.user) {
                        const color = state.user.color;
                        const name = state.user.name;
                        const hslaColor = color.replace('hsl', 'hsla').replace(')', ', 0.3)');
                        const cssSafeId = `client-${clientId}`;

                        // Generate CSS strictly for this specific user's cursor
                        dynamicCss += `
                            .yRemoteSelectionHead[data-client-id="${clientId}"] {
                                border-color: ${color} !important;
                            }
                            .yRemoteSelectionHead[data-client-id="${clientId}"]::after {
                                border-color: ${color} !important;
                            }
                            .yRemoteSelectionHead[data-client-id="${clientId}"]::before {
                                content: '${name}';
                                background-color: ${color} !important;
                            }
                            .yRemoteSelection[data-client-id="${clientId}"] {
                                background-color: ${hslaColor} !important;
                            }
                        `;

                        // If it is another user, try to find their cursor rendering in the DOM
                        if (clientId !== ydoc.clientID) {
                            try {
                                const cursorElements = document.querySelectorAll('.yRemoteSelectionHead');
                                const selectionElements = document.querySelectorAll('.yRemoteSelection');

                                // Tag the DOM elements. Y-monaco sets inline borders, so we use that to find which is which.
                                cursorElements.forEach(el => {
                                    const htmlEl = el as HTMLElement;
                                    if (htmlEl.style.borderColor === color || htmlEl.style.borderLeftColor === color) {
                                        htmlEl.setAttribute('data-client-name', name);
                                        htmlEl.setAttribute('data-client-id', String(clientId));
                                    }
                                });

                                selectionElements.forEach(el => {
                                    const htmlEl = el as HTMLElement;
                                    if (htmlEl.style.backgroundColor === hslaColor || htmlEl.style.backgroundColor?.includes(hslaColor)) {
                                        htmlEl.setAttribute('data-client-id', String(clientId));
                                    }
                                });
                            } catch (e) {
                                console.error("Failed to inject cursor name tag", e);
                            }
                        }
                    }
                });

                // Inject the generated per-user CSS into our style tag
                const styleId = `y-monaco-dynamic-cursors-${roomName}`;
                let styleElement = document.getElementById(styleId);
                if (styleElement) {
                    styleElement.innerHTML = dynamicCss;
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

        // We will define the base geometric layout here. 
        // The dynamic style block above will inject the specific vibrant colors!
        style.innerHTML = `
            .yRemoteSelectionHead {
                position: absolute;
                border-left: 2px solid;
                border-top: 2px solid;
                border-bottom: 2px solid;
                height: 100%;
                box-sizing: border-box;
            }
            .yRemoteSelectionHead::after {
                position: absolute;
                content: ' ';
                border: 3px solid;
                border-radius: 4px;
                left: -4px;
                top: -5px;
            }
            .yRemoteSelectionHead::before {
                position: absolute;
                top: -18px;
                left: -2px;
                color: #fff;
                font-size: 10px;
                font-family: sans-serif;
                padding: 1px 4px;
                border-radius: 2px;
                white-space: nowrap;
                z-index: 100;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease-in-out;
            }
            .yRemoteSelectionHead:hover::before {
                opacity: 1;
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
            {!isBindingComplete && (
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
