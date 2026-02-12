# Stage 1: Build frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx vite build

# Stage 2: Production server
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js .
COPY --from=builder /app/dist ./dist
COPY data/ ./data/
COPY admin/ ./admin/
COPY public/ ./public/
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.js"]
