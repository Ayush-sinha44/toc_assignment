/**
 * Quick integration test for the lexer API.
 * Starts the server, sends test requests, and validates responses.
 *
 * Usage: node test.js
 */

const http = require("http");

const BASE = "http://localhost:3000";
let passed = 0;
let failed = 0;

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(path, BASE);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, body });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ ${msg}`);
    failed++;
  }
}

async function run() {
  console.log("\n══ C Lexical Analyzer API Tests ══\n");

  // Test 1: Simple declaration
  console.log("Test 1: Simple declaration (int a = 5;)");
  const r1 = await post("/analyze", { code: "int a = 5;" });
  assert(r1.status === 200, "Status 200");
  assert(Array.isArray(r1.body.tokens), "tokens is array");
  assert(r1.body.tokens.length === 5, `Got ${r1.body.tokens.length} tokens (expected 5)`);
  assert(r1.body.tokens[0].type === "KEYWORD", "First token is KEYWORD");
  assert(r1.body.tokens[0].lexeme === "int", 'First lexeme is "int"');
  assert(r1.body.tokens[1].type === "IDENTIFIER", "Second token is IDENTIFIER");
  assert(r1.body.tokens[2].type === "OPERATOR", "Third token is OPERATOR");
  assert(r1.body.tokens[3].type === "NUMBER", "Fourth token is NUMBER");
  assert(r1.body.tokens[4].type === "DELIMITER", "Fifth token is DELIMITER");

  // Test 2: Multi-line code
  console.log("\nTest 2: Multi-line function");
  const r2 = await post("/analyze", {
    code: 'int main() {\n  printf("hello");\n  return 0;\n}',
  });
  assert(r2.status === 200, "Status 200");
  assert(r2.body.tokens.length > 0, `Got ${r2.body.tokens.length} tokens`);
  assert(r2.body.totalTokens === r2.body.tokens.length, "totalTokens matches");

  // Test 3: Comments
  console.log("\nTest 3: Comments");
  const r3 = await post("/analyze", { code: "// line comment\n/* block */\nint x;" });
  assert(r3.status === 200, "Status 200");
  const comments = r3.body.tokens.filter((t) => t.type === "COMMENT");
  assert(comments.length === 2, `Found ${comments.length} comments (expected 2)`);

  // Test 4: Empty input
  console.log("\nTest 4: Empty input");
  const r4 = await post("/analyze", { code: "" });
  assert(r4.status === 400, "Status 400 for empty input");

  // Test 5: Missing code field
  console.log("\nTest 5: Missing code field");
  const r5 = await post("/analyze", { notCode: "test" });
  assert(r5.status === 400, "Status 400 for missing field");

  // Test 6: String literals
  console.log("\nTest 6: String literals");
  const r6 = await post("/analyze", { code: 'char *s = "hello world";' });
  assert(r6.status === 200, "Status 200");
  const strings = r6.body.tokens.filter((t) => t.type === "STRING");
  assert(strings.length === 1, "Found 1 string literal");

  // Test 7: Summary statistics
  console.log("\nTest 7: Summary statistics");
  assert(typeof r1.body.summary === "object", "summary is present");
  assert(r1.body.summary.KEYWORD === 1, "summary counts keywords");

  // Results
  console.log(`\n══ Results: ${passed} passed, ${failed} failed ══\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test failed to run:", err.message);
  console.error("Make sure the server is running: npm start");
  process.exit(1);
});
