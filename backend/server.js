const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ─── Resolve lexer path ─────────────────────────────────────────────────────
// In Docker: /app/lexer   |   Locally: <project>/backend/lexer
const LEXER_PATH = path.join(__dirname, "lexer");

// Verify lexer exists on startup — fail fast with helpful message
if (!fs.existsSync(LEXER_PATH)) {
  console.error("════════════════════════════════════════════════════════");
  console.error(`FATAL: lexer binary not found at ${LEXER_PATH}`);
  console.error("");
  console.error("This means the Flex lexer was not compiled.");
  console.error("Run:  bash build.sh   (or ensure Dockerfile runs it)");
  console.error("════════════════════════════════════════════════════════");
  process.exit(1);
}
console.log(`✓ Lexer binary found at ${LEXER_PATH}`);

// ─── Routes ──────────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "C Lexical Analyzer API is running",
    endpoints: { analyze: "POST /analyze" },
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── POST /analyze ──────────────────────────────────────────────────────────

app.post("/analyze", (req, res) => {
  const { code } = req.body;

  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return res.status(400).json({ error: "Missing or invalid 'code' field" });
  }

  if (code.length > 100_000) {
    return res.status(413).json({ error: "Input too large. Maximum 100,000 characters." });
  }

  // Guard against double-response
  let responded = false;
  const sendOnce = (statusCode, payload) => {
    if (responded) return;
    responded = true;
    res.status(statusCode).json(payload);
  };

  // Unique temp file to avoid race conditions
  const tmpFile = path.join(
    os.tmpdir(),
    `input_${Date.now()}_${Math.random().toString(36).slice(2)}.c`
  );

  fs.writeFile(tmpFile, code, (writeErr) => {
    if (writeErr) {
      console.error("Failed to write temp file:", writeErr);
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

    lexer.on("close", (exitCode) => {
      fs.unlink(tmpFile, () => {});

      if (exitCode !== 0) {
        console.error("Lexer exited with code", exitCode, "stderr:", stderr);
        return sendOnce(500, { error: "Lexer failed", details: stderr });
      }

      try {
        const tokens = parseTokens(stdout);

        // Build summary statistics
        const summary = {};
        for (const token of tokens) {
          summary[token.type] = (summary[token.type] || 0) + 1;
        }

        sendOnce(200, {
          tokens,
          summary,
          totalTokens: tokens.length,
        });
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

// ─── Token Parser ────────────────────────────────────────────────────────────
// Lexer outputs pipe-delimited lines: TYPE|LEXEME|LINE_NUMBER
// Lexeme may contain escaped characters: \\, \|, \n, \r, \t

function unescapeLexeme(raw) {
  let result = "";
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1];
      switch (next) {
        case "\\": result += "\\"; i += 2; break;
        case "|":  result += "|";  i += 2; break;
        case "n":  result += "\n"; i += 2; break;
        case "r":  result += "\r"; i += 2; break;
        case "t":  result += "\t"; i += 2; break;
        default:   result += raw[i]; i++; break;
      }
    } else {
      result += raw[i];
      i++;
    }
  }
  return result;
}

function findUnescapedPipe(str, start) {
  for (let i = start; i < str.length; i++) {
    if (str[i] === "|") {
      let backslashes = 0;
      let j = i - 1;
      while (j >= 0 && str[j] === "\\") { backslashes++; j--; }
      if (backslashes % 2 === 0) return i;
    }
  }
  return -1;
}

function parseTokens(output) {
  const tokens = [];
  const lines = output.split("\n").filter((line) => line.trim().length > 0);

  for (const line of lines) {
    const firstPipe = findUnescapedPipe(line, 0);
    if (firstPipe === -1) continue;

    const lastPipe = line.lastIndexOf("|");
    if (lastPipe === -1 || lastPipe === firstPipe) continue;

    const type = line.substring(0, firstPipe);
    const rawLexeme = line.substring(firstPipe + 1, lastPipe);
    const lineNumStr = line.substring(lastPipe + 1);

    const lineNum = parseInt(lineNumStr, 10);
    if (isNaN(lineNum)) continue;

    tokens.push({
      lexeme: unescapeLexeme(rawLexeme),
      type: type,
      line: lineNum,
    });
  }

  return tokens;
}

// ─── 404 + Error Handling ────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start Server ────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✓ C Lexical Analyzer API running on port ${PORT}`);
  console.log(`  Health:   GET  http://localhost:${PORT}/health`);
  console.log(`  Analyze:  POST http://localhost:${PORT}/analyze`);
});