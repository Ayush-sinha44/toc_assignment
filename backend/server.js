const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ─── Health Check ────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "C Lexical Analyzer API is running",
    endpoints: {
      analyze: "POST /analyze",
    },
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Unescape lexer output back to the original lexeme text.
 * The lexer escapes: \\ -> \\\\, | -> \\|, \n -> \\n, \r -> \\r, \t -> \\t
 */
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

/**
 * Parse the pipe-delimited lexer output into structured token objects.
 * Each line of output has the format: TYPE|LEXEME|LINE_NUMBER
 */
function parseLexerOutput(output) {
  const tokens = [];
  const lines = output.split("\n").filter((line) => line.trim().length > 0);

  for (const line of lines) {
    // Split only on unescaped pipes: find first unescaped pipe and last pipe
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

/**
 * Find the index of the first unescaped pipe character starting from `start`.
 */
function findUnescapedPipe(str, start) {
  for (let i = start; i < str.length; i++) {
    if (str[i] === "|") {
      // Count preceding backslashes
      let backslashes = 0;
      let j = i - 1;
      while (j >= 0 && str[j] === "\\") {
        backslashes++;
        j--;
      }
      // Pipe is unescaped if preceded by an even number of backslashes
      if (backslashes % 2 === 0) {
        return i;
      }
    }
  }
  return -1;
}

// ─── POST /analyze ──────────────────────────────────────────────────────────

app.post("/analyze", (req, res) => {
  const { code } = req.body;

  // Validate input
  if (!code || typeof code !== "string") {
    return res.status(400).json({
      error: "Missing or invalid 'code' field. Expected a non-empty string.",
    });
  }

  if (code.length > 100_000) {
    return res.status(413).json({
      error: "Input too large. Maximum 100,000 characters allowed.",
    });
  }

  // Generate unique temp file to avoid race conditions
  const uniqueId = crypto.randomBytes(8).toString("hex");
  const inputFile = path.join(os.tmpdir(), `lexer_input_${uniqueId}.c`);
  const lexerPath = path.join(__dirname, "lexer");

  // Write code to temp file
  fs.writeFile(inputFile, code, "utf8", (writeErr) => {
    if (writeErr) {
      console.error("Failed to write input file:", writeErr);
      return res.status(500).json({ error: "Failed to process input." });
    }

    // Execute the lexer
    const command = `"${lexerPath}" < "${inputFile}"`;
    const execOptions = {
      timeout: 10_000, // 10 second timeout
      maxBuffer: 5 * 1024 * 1024, // 5MB output buffer
    };

    exec(command, execOptions, (execErr, stdout, stderr) => {
      // Clean up temp file regardless of outcome
      fs.unlink(inputFile, (unlinkErr) => {
        if (unlinkErr) {
          console.warn("Failed to clean up temp file:", inputFile, unlinkErr);
        }
      });

      if (execErr) {
        // Distinguish timeout from other errors
        if (execErr.killed) {
          return res.status(408).json({
            error: "Lexer execution timed out. Input may be too complex.",
          });
        }

        console.error("Lexer execution error:", execErr.message);
        return res.status(500).json({
          error: "Lexer execution failed.",
          details: stderr || execErr.message,
        });
      }

      // Parse the output
      try {
        const tokens = parseLexerOutput(stdout);

        // Build summary statistics
        const summary = {};
        for (const token of tokens) {
          summary[token.type] = (summary[token.type] || 0) + 1;
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
  });
});

// ─── Error Handling ──────────────────────────────────────────────────────────

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error." });
});

// ─── Start Server ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✓ C Lexical Analyzer API running on port ${PORT}`);
  console.log(`  Health check:  GET  http://localhost:${PORT}/`);
  console.log(`  Analyze code:  POST http://localhost:${PORT}/analyze`);
});
