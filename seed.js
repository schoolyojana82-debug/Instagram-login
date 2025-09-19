import 'dotenv/config'; import sqlite3 from 'sqlite3'; import { open } from 'sqlite';
const db = await open({ filename: process.env.DB_FILE || './data.db', driver: sqlite3.Database });
await db.exec('DELETE FROM users; DELETE FROM accounts; DELETE FROM transactions;');
console.log('Database cleared. The server will reseed a demo user on next start if empty.');
await db.close();
