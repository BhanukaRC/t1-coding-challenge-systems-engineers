FROM node:22-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

RUN mkdir -p dist/src/proto && \
    cp src/proto/trades.proto dist/src/proto/trades.proto && \
    ls -la dist/src/proto/

CMD ["node", "dist/src/index.js"]
