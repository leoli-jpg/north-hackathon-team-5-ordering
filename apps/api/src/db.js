// RFC-0002: Database access layer for the ordering API service.
const { Client } = require('pg');

function createClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to connect to the ordering database.');
  }

  return new Client({ connectionString: databaseUrl });
}

async function withClient(handler) {
  const client = createClient();
  await client.connect();
  try {
    return await handler(client);
  } finally {
    await client.end();
  }
}

async function withTransaction(handler) {
  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const result = await handler(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

module.exports = {
  createClient,
  withClient,
  withTransaction,
};
