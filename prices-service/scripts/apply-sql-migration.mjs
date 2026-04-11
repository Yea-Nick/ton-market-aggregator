import { readFile } from 'node:fs/promises';
import pg from 'pg';

const client = new pg.Client({
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? 'ton_prices',
  user: process.env.POSTGRES_USER ?? 'postgres',
  password: process.env.POSTGRES_PASSWORD ?? 'postgres',
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const sql = await readFile(new URL('../db/migrations/001_init.sql', import.meta.url), 'utf8');

await client.connect();
await client.query(sql);
await client.end();

console.log('Applied db/migrations/001_init.sql');
