const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
// Enable CORS for all origins for easy development
app.use(cors());
app.use(express.json());

// Determine ports from environment or fallbacks
const PORT = process.env.PORT || 3002;
const SIGNALING_PORT = process.env.SIGNALING_PORT || 4444;

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
        command = `node ${filePath}`;
    } else if (language === "python" || language === "python3") {
        filePath = path.join(tempDir, `${fileName}.py`);
        // Windows typical python command
        command = `python ${filePath}`;
    } else if (language === "cpp") {
        filePath = path.join(tempDir, `${fileName}.cpp`);
        const outPath = path.join(tempDir, `${fileName}.exe`);
        command = `g++ ${filePath} -o ${outPath} && ${outPath}`;
    } else {
        return res.status(400).json({ error: `Unsupported language: ${language}`, success: false });
    }

    fs.writeFileSync(filePath, code);

    // Execute the code with a 5000ms timeout
    exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
        // Cleanup files
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

app.listen(PORT, () => {
    console.log(`Execution API server running on http://localhost:${PORT}`);
});

// Start the y-webrtc signaling server
// The y-webrtc script reads process.env.PORT natively to bind its WebSocket server.
const { spawn } = require("child_process");
const signalingServerPath = path.join(__dirname, "node_modules", "y-webrtc", "bin", "server.js");

const signalingProcess = spawn("node", [signalingServerPath], {
    env: { ...process.env, PORT: SIGNALING_PORT },
    stdio: "inherit"
});

signalingProcess.on("error", (err) => {
    console.error("Failed to start signaling server:", err);
});
