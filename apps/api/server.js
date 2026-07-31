// RFC-0002: Entry point for the ordering API service.
const { server } = require('./src/server');

const port = Number(process.env.API_PORT || 3001);

server.listen(port, () => {
  console.log(`ordering-api listening on ${port}`);
});
