#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Installing dependencies..."

apt-get update
apt-get install -y flex gcc

echo "Building C Lexical Analyzer..."

flex lexer.l
echo "Generated lex.yy.c"

gcc lex.yy.c -o lexer
echo "Built ./lexer"

chmod +x lexer

echo "Build complete!"