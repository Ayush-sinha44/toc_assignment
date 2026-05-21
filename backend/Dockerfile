FROM node:20

RUN apt-get update && apt-get install -y \
    flex \
    bison \
    gcc \
    g++ \
    make \
    libc6-dev

WORKDIR /opt/render/project/src/backend

COPY package*.json ./

RUN npm install

COPY . .

RUN flex lexer.l

RUN gcc lex.yy.c -o lexer -ll

RUN chmod +x lexer

RUN ls -la

EXPOSE 10000

CMD ["node", "server.js"]