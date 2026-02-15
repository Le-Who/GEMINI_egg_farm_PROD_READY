# Stage: Production server (no build step — static HTML/CSS/JS)
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js .
COPY storage.js .
COPY public/ ./public/

RUN mkdir -p data

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.js"]
