const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const LEXER_PATH = path.join(__dirname, "lexer");

// Verify lexer exists on startup — fail fast
if (!fs.existsSync(LEXER_PATH)) {
  console.error(`FATAL: lexer binary not found at ${LEXER_PATH}`);
  process.exit(1);
}

app.post("/analyze", (req, res) => {
  const { code } = req.body;

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'code' field" });
  }

  // Guard against double-response
  let responded = false;
  const sendOnce = (statusCode, payload) => {
    if (responded) return;
    responded = true;
    res.status(statusCode).json(payload);
  };

  const tmpFile = path.join(os.tmpdir(), `input_${Date.now()}_${Math.random().toString(36).slice(2)}.c`);

  fs.writeFile(tmpFile, code, (writeErr) => {
    if (writeErr) {
      return sendOnce(500, { error: "Failed to write temporary file" });
    }

    const inputStream = fs.createReadStream(tmpFile);
    const lexer = spawn(LEXER_PATH);

    let stdout = "";
    let stderr = "";

    lexer.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    lexer.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    lexer.on("error", (err) => {
      console.error("Lexer spawn error:", err);
      fs.unlink(tmpFile, () => {});
      sendOnce(500, { error: `Failed to start lexer: ${err.message}` });
    });

    lexer.on("close", (code) => {
      fs.unlink(tmpFile, () => {});

      if (code !== 0) {
        console.error("Lexer exited with code", code, "stderr:", stderr);
        return sendOnce(500, { error: "Lexer failed", details: stderr });
      }

      try {
        const tokens = parseTokens(stdout);
        sendOnce(200, { tokens });
      } catch (parseErr) {
        console.error("Token parse error:", parseErr);
        sendOnce(500, { error: "Failed to parse lexer output" });
      }
    });

    inputStream.on("error", (err) => {
      console.error("Input stream error:", err);
      lexer.kill();
      sendOnce(500, { error: "Failed to stream input to lexer" });
    });

    inputStream.pipe(lexer.stdin);

    // Handle broken pipe (lexer closes stdin early)
    lexer.stdin.on("error", (err) => {
      if (err.code !== "EPIPE") console.error("stdin error:", err);
    });
  });
});

// Adjust this to match your actual lexer output format
function parseTokens(output) {
  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [type, ...rest] = line.split(/\s+/);
      return { type, value: rest.join(" ") };
    });
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Lexer path: ${LEXER_PATH}`);
});