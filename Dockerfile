FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY server ./server
COPY --from=build /app/dist ./dist
ENV HOST=0.0.0.0 PORT=3026 STATIC_DIR=/app/dist DB_PATH=/data/krathong.db
VOLUME /data
USER node
EXPOSE 3026
CMD ["node", "--disable-warning=ExperimentalWarning", "server/server.mjs"]
