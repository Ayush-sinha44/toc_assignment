FROM node:20

RUN apt-get update && apt-get install -y \
    flex \
    gcc \
    build-essential

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN flex lexer.l
RUN gcc lex.yy.c -o lexer -lfl

EXPOSE 10000

CMD ["node", "server.js"]