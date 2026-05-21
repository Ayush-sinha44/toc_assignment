FROM node:20

RUN apt-get update && apt-get install -y \
    flex \
    gcc \
    build-essential

WORKDIR /opt/render/project/src/backend

COPY package*.json ./

RUN npm install

COPY . .

RUN flex lexer.l && \
    gcc lex.yy.c -o lexer -lfl && \
    chmod +x lexer

EXPOSE 10000

CMD ["node", "server.js"]