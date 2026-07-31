// RFC-0002: Ordering API service placeholder for T1 topology validation.
// T3 will replace this with the real CRUD, recommendation, and image-candidate APIs.
const http = require('http');

const port = Number(process.env.API_PORT || 3001);
const server = http.createServer((request, response) => {
  const body = {
    service: 'ordering-api',
    status: 'placeholder',
    rfc: 'RFC-0002',
    message: 'API topology is ready; business endpoints are implemented in T3.'
  };

  response.writeHead(200, {
    'content-type': 'application/json',
    'access-control-allow-origin': process.env.API_CORS_ORIGIN || 'http://localhost:3000',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type'
  });
  response.end(JSON.stringify(body, null, 2));
});

server.listen(port, () => {
  console.log(`ordering-api placeholder listening on ${port}`);
});
