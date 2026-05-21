FROM node:20-slim

RUN apt-get update && apt-get install -y \
    flex \
    gcc \
    g++ \
    make \
    libc6-dev \
    --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Compile the lexer
RUN flex lexer.l
RUN gcc lex.yy.c -o lexer -lfl
RUN gcc lex.yy.c -o lexer -lfl 2>&1 | tee /tmp/gcc.log && cat /tmp/gcc.log
RUN chmod +x lexer

# Smoke-test: fail the build immediately if the binary is broken
RUN echo "" | ./lexer || (echo "ERROR: lexer binary failed smoke test" && exit 1)

# Verify it exists and is executable
RUN ls -la lexer && echo "lexer binary OK"

EXPOSE 10000
CMD ["node", "server.js"]