FROM node:24.11.0-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

EXPOSE 3001

COPY . .

RUN npm run build

CMD ["node", "dist/index.js"]