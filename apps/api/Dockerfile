# RFC-0002: API service image for local ordering system demos.
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY src ./src
COPY database ./database
EXPOSE 3001
CMD ["npm", "start"]
