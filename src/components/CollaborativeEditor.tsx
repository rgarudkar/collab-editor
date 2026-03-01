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
    onCodeChange?: (code: string) => void;
    onYDocReady?: (ydoc: Y.Doc) => void;
}

export default function CollaborativeEditor({
    roomName,
    language = "javascript",
    onCodeChange,
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
    const cursorColor = useRef(
        `#${Math.floor(Math.random() * 16777215).toString(16)}`
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
        // We use our custom signaling server hosted on our Node.js backend
        const signalingUrl = process.env.NEXT_PUBLIC_SIGNALING_URL || "ws://localhost:4444";
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

        // Listen for changes
        if (onCodeChange) {
            ytext.observe(() => {
                onCodeChange(ytext.toString());
            });
            // Initial code push
            onCodeChange(ytext.toString());
        }

        // Set cursor and awareness info
        provider.awareness.setLocalStateField("user", {
            name: `User-${Math.floor(Math.random() * 1000)}`,
            color: cursorColor.current,
        });

        setIsBindingComplete(true);
    };

    useEffect(() => {
        return () => {
            // Cleanup on unmount
            bindingRef.current?.destroy();
            providerRef.current?.destroy();
            ydocRef.current?.destroy();
        };
    }, []);

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
