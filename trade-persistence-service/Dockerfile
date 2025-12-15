FROM node:22-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

RUN mkdir -p dist/proto && \
    cp src/proto/trades.proto dist/proto/trades.proto && \
    ls -la dist/proto/

CMD ["node", "dist/index.js"]
