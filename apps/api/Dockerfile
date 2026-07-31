# RFC-0002: Placeholder API service image for T1 topology validation.
# T3 will replace this with the real Node.js/TypeScript API service.
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY database ./database
EXPOSE 3001
CMD ["node", "server.js"]
