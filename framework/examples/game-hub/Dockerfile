# Build: install deps, bundle Discord SDK, prune for production
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

# Copy source files needed for the build
COPY src/ ./src/
COPY public/ ./public/
COPY server.js .
COPY storage.js .

# Bundle Discord SDK into public/js/
RUN npx esbuild src/discord-entry.js --bundle --outfile=public/js/discord-sdk.js --format=iife --global-name=DiscordSDKModule --target=es2020

# Remove devDependencies for smaller image
RUN npm prune --omit=dev

RUN mkdir -p data

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.js"]
