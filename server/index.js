const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { WebSocketServer } = require("ws");
const map = require("lib0/map");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3002;

// --- Code Execution API ---
app.post("/api/execute", (req, res) => {
    const { language, code } = req.body;
    if (!code) {
        return res.status(400).json({ error: "No code provided", success: false });
    }

    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }

    const fileName = `temp_${Date.now()}`;
    let filePath = "";
    let command = "";

    if (language === "javascript") {
        filePath = path.join(tempDir, `${fileName}.js`);
        command = `node "${filePath}"`;
    } else if (language === "python" || language === "python3") {
        filePath = path.join(tempDir, `${fileName}.py`);
        command = `python "${filePath}"`;
    } else if (language === "cpp") {
        filePath = path.join(tempDir, `${fileName}.cpp`);
        const outPath = path.join(tempDir, `${fileName}.exe`);
        command = `g++ "${filePath}" -o "${outPath}" && "${outPath}"`;
    } else {
        return res.status(400).json({ error: `Unsupported language: ${language}`, success: false });
    }

    fs.writeFileSync(filePath, code);

    exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (language === "cpp") {
            const outPath = path.join(tempDir, `${fileName}.exe`);
            if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
        }

        if (error) {
            if (error.killed) {
                return res.json({ logs: stdout ? [stdout] : [], error: "Execution Timeout: Script ran for more than 5 seconds.", success: false });
            }
            return res.json({ logs: stdout ? [stdout] : [], error: stderr || error.message, success: false });
        }
        return res.json({ logs: stdout ? [stdout] : [], result: null, success: true });
    });
});

// --- Unified Server Setup ---
const server = http.createServer(app);

// --- y-webrtc Signaling Logic ---
const wss = new WebSocketServer({ noServer: true });
const topics = new Map();

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;

const send = (conn, message) => {
    if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
        conn.close();
    }
    try {
        conn.send(JSON.stringify(message));
    } catch (e) {
        conn.close();
    }
};

wss.on("connection", (conn) => {
    const subscribedTopics = new Set();
    let closed = false;
    let pongReceived = true;

    const pingInterval = setInterval(() => {
        if (!pongReceived) {
            conn.close();
            clearInterval(pingInterval);
        } else {
            pongReceived = false;
            try { conn.ping(); } catch (e) { conn.close(); }
        }
    }, 30000);

    conn.on("pong", () => { pongReceived = true; });
    conn.on("close", () => {
        subscribedTopics.forEach(topicName => {
            const subs = topics.get(topicName);
            if (subs) {
                subs.delete(conn);
                if (subs.size === 0) topics.delete(topicName);
            }
        });
        subscribedTopics.clear();
        closed = true;
    });

    conn.on("message", (message) => {
        if (typeof message === "string" || message instanceof Buffer) {
            try { message = JSON.parse(message); } catch (e) { return; }
        }
        if (message && message.type && !closed) {
            switch (message.type) {
                case "subscribe":
                    (message.topics || []).forEach(topicName => {
                        if (typeof topicName === "string") {
                            const topic = map.setIfUndefined(topics, topicName, () => new Set());
                            topic.add(conn);
                            subscribedTopics.add(topicName);
                        }
                    });
                    break;
                case "unsubscribe":
                    (message.topics || []).forEach(topicName => {
                        const subs = topics.get(topicName);
                        if (subs) subs.delete(conn);
                    });
                    break;
                case "publish":
                    if (message.topic) {
                        const receivers = topics.get(message.topic);
                        if (receivers) {
                            message.clients = receivers.size;
                            receivers.forEach(receiver => send(receiver, message));
                        }
                    }
                    break;
                case "ping":
                    send(conn, { type: "pong" });
            }
        }
    });
});

server.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
    });
});

server.listen(PORT, () => {
    console.log(`Unified SyncWrite Backend running on http://localhost:${PORT}`);
});
