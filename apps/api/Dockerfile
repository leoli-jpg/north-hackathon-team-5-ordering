# RFC-0002: Ordering API service image.
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY src ./src
COPY database ./database
EXPOSE 3001
CMD ["node", "server.js"]
