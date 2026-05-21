#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building C Lexical Analyzer..."

# Check prerequisites
command -v flex >/dev/null 2>&1 || { echo "flex not found. Install with: sudo apt-get install flex"; exit 1; }
command -v gcc >/dev/null 2>&1 || { echo "gcc not found. Install with: sudo apt-get install gcc"; exit 1; }

# Compile
flex lexer.l
echo "Generated lex.yy.c"

gcc lex.yy.c -o lexer -lfl
echo "Built ./lexer"

chmod +x lexer
echo "Build complete!"
