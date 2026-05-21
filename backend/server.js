const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;

// ─────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ─────────────────────────────────────────────────────────────
// Health Routes
// ─────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "C Lexical Analyzer API is running",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function unescapeLexeme(raw) {
  let result = "";
  let i = 0;

  while (i < raw.length) {
    if (raw[i] === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1];

      if (next === "\\") {
        result += "\\";
        i += 2;
      } else if (next === "|") {
        result += "|";
        i += 2;
      } else if (next === "n") {
        result += "\n";
        i += 2;
      } else if (next === "r") {
        result += "\r";
        i += 2;
      } else if (next === "t") {
        result += "\t";
        i += 2;
      } else {
        result += raw[i];
        i++;
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

      while (j >= 0 && str[j] === "\\") {
        backslashes++;
        j--;
      }

      if (backslashes % 2 === 0) {
        return i;
      }
    }
  }

  return -1;
}

function parseLexerOutput(output) {
  const tokens = [];

  const lines = output
    .split("\n")
    .filter((line) => line.trim().length > 0);

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
      type,
      line: lineNum,
    });
  }

  return tokens;
}

// ─────────────────────────────────────────────────────────────
// Analyze Route
// ─────────────────────────────────────────────────────────────

app.post("/analyze", (req, res) => {

  const { code } = req.body;

  // Validate input
  if (!code || typeof code !== "string") {
    return res.status(400).json({
      error: "Missing or invalid 'code' field.",
    });
  }

  if (code.length > 100000) {
    return res.status(413).json({
      error: "Input too large.",
    });
  }

  // Generate unique temp file
  const uniqueId = crypto.randomBytes(8).toString("hex");

  const inputFile = path.join(
    os.tmpdir(),
    `lexer_input_${uniqueId}.c`
  );

  const lexerPath = path.join(__dirname, "lexer");

  // Write code to temp file
  fs.writeFile(inputFile, code, "utf8", (writeErr) => {

    if (writeErr) {
      console.error("Failed to write temp file:", writeErr);

      return res.status(500).json({
        error: "Failed to process input.",
      });
    }

    // Spawn lexer process
    const lexer = spawn(lexerPath);

    let stdout = "";
    let stderr = "";

    // Collect stdout
    lexer.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    // Collect stderr
    lexer.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    // Handle process errors
    lexer.on("error", (err) => {

      console.error("Failed to start lexer:", err);

      fs.unlink(inputFile, () => {});

      return res.status(500).json({
        error: "Failed to start lexer process.",
      });
    });

    // Process finished
    lexer.on("close", (code) => {

      // Cleanup temp file
      fs.unlink(inputFile, () => {});

      // Non-zero exit code
      if (code !== 0) {

        console.error("Lexer exited with code:", code);

        return res.status(500).json({
          error: "Lexer execution failed.",
          details: stderr || "Unknown lexer error.",
        });
      }

      // Parse output
      try {

        const tokens = parseLexerOutput(stdout);

        const summary = {};

        for (const token of tokens) {
          summary[token.type] =
            (summary[token.type] || 0) + 1;
        }

        return res.json({
          tokens,
          summary,
          totalTokens: tokens.length,
        });

      } catch (parseErr) {

        console.error("Failed to parse lexer output:", parseErr);

        return res.status(500).json({
          error: "Failed to parse lexer output.",
        });
      }
    });

    // Pipe input file into lexer stdin
    const stream = fs.createReadStream(inputFile);

    stream.on("error", (err) => {
    console.error("Stream error:", err);
});

    stream.pipe(lexer.stdin);
  });
});

// ─────────────────────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found.`,
  });
});

// ─────────────────────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────────────────────

app.use((err, req, res, next) => {

  console.error("Unhandled error:", err);

  res.status(500).json({
    error: "Internal server error.",
  });
});

// ─────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {

  console.log(`✓ Server running on port ${PORT}`);

  console.log(`Health: GET /`);

  console.log(`Analyze: POST /analyze`);
});