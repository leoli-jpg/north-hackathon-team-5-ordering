#!/usr/bin/env node
// RFC-0002: Apply the ordering database schema to the configured Postgres database.
const fs = require('fs');
const path = require('path');

const { Client } = require('pg');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required to apply the ordering database schema.');
  process.exit(1);
}

const schemaPath = path.join(__dirname, 'schema.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');

async function main() {
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    await client.query(sql);
    console.log('Applied RFC-0002 ordering database schema.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Failed to apply ordering database schema:', error);
  process.exit(1);
});
