import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const DB_FILE = process.env.DB_FILE || './data.db';

// DB helper
let db;
async function getDb(){
  if(db) return db;
  db = await open({ filename: DB_FILE, driver: sqlite3.Database });
  await db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      name TEXT NOT NULL,
      accountNo TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      whenDate TEXT NOT NULL,
      desc TEXT NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  // Seed demo user if none
  const row = await db.get('SELECT COUNT(*) as c FROM users');
  if(row.c === 0){
    const hash = await bcrypt.hash('demo123', 10);
    const now = new Date().toISOString();
    const result = await db.run('INSERT INTO users (username, passwordHash, createdAt) VALUES (?,?,?)', ['demo', hash, now]);
    const uid = result.lastID;
    await db.run('INSERT INTO accounts (userId, name, accountNo, balance) VALUES (?,?,?,?)', [uid, 'Savings', 'SAV-001', 52340.75]);
    await db.run('INSERT INTO accounts (userId, name, accountNo, balance) VALUES (?,?,?,?)', [uid, 'Checking', 'CHK-201', 8340.10]);
    await db.run('INSERT INTO transactions (userId, whenDate, desc, amount) VALUES (?,?,?,?)', [uid, '2025-09-05', 'UPI • Grocery', -1450.50]);
    await db.run('INSERT INTO transactions (userId, whenDate, desc, amount) VALUES (?,?,?,?)', [uid, '2025-09-03', 'NEFT • Salary', 35000.00]);
    await db.run('INSERT INTO transactions (userId, whenDate, desc, amount) VALUES (?,?,?,?)', [uid, '2025-08-30', 'Card • Fuel', -1200.00]);
    console.log('Seeded demo user: demo / demo123');
  }
  return db;
}

// Auth middleware
function auth(req, res, next){
  const hdr = req.headers['authorization']||'';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if(!token) return res.status(401).send('Missing token');
  try{
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  }catch(e){
    return res.status(401).send('Invalid token');
  }
}

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health
app.get('/health', (req,res)=>res.json({ ok:true }));

// Auth
app.post('/auth/register', async (req,res) => {
  const { username, password } = req.body || {};
  if(!username || !password) return res.status(400).send('username and password required');
  const db = await getDb();
  const exists = await db.get('SELECT id FROM users WHERE username = ?', [username]);
  if(exists) return res.status(409).send('username already exists');
  const hash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const result = await db.run('INSERT INTO users (username, passwordHash, createdAt) VALUES (?,?,?)', [username, hash, now]);
  // Create default accounts
  const uid = result.lastID;
  await db.run('INSERT INTO accounts (userId, name, accountNo, balance) VALUES (?,?,?,?)', [uid, 'Savings', 'SAV-'+String(uid).padStart(3,'0'), 10000.00]);
  await db.run('INSERT INTO accounts (userId, name, accountNo, balance) VALUES (?,?,?,?)', [uid, 'Checking', 'CHK-'+String(uid).padStart(3,'0'), 2000.00]);
  res.json({ ok:true });
});

app.post('/auth/login', async (req,res) => {
  const { username, password } = req.body || {};
  if(!username || !password) return res.status(400).send('username and password required');
  const db = await getDb();
  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
  if(!user) return res.status(401).send('invalid credentials');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if(!ok) return res.status(401).send('invalid credentials');
  const token = jwt.sign({ id:user.id, username:user.username }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ token });
});

app.get('/me', auth, async (req,res) => {
  const db = await getDb();
  const user = await db.get('SELECT id, username, createdAt FROM users WHERE id = ?', [req.user.id]);
  res.json(user);
});

app.get('/accounts', auth, async (req,res) => {
  const db = await getDb();
  const rows = await db.all('SELECT id, name, accountNo, balance FROM accounts WHERE userId = ?', [req.user.id]);
  res.json(rows);
});

app.get('/transactions', auth, async (req,res) => {
  const db = await getDb();
  const rows = await db.all('SELECT id, whenDate as "when", desc, amount FROM transactions WHERE userId = ? ORDER BY id DESC', [req.user.id]);
  res.json(rows);
});

app.post('/transfer', auth, async (req,res) => {
  const { fromAccountId, toPayee, amount } = req.body || {};
  if(!fromAccountId || !toPayee || !amount || amount <= 0) return res.status(400).send('invalid params');
  const db = await getDb();
  const acc = await db.get('SELECT * FROM accounts WHERE id = ? AND userId = ?', [fromAccountId, req.user.id]);
  if(!acc) return res.status(404).send('account not found');
  if(acc.balance < amount) return res.status(400).send('insufficient funds');
  await db.run('UPDATE accounts SET balance = balance - ? WHERE id = ?', [amount, acc.id]);
  const now = new Date().toISOString().slice(0,10);
  await db.run('INSERT INTO transactions (userId, whenDate, desc, amount) VALUES (?,?,?,?)', [req.user.id, now, `Transfer to ${toPayee}`, -amount]);
  res.json({ ok:true });
});

app.listen(PORT, () => console.log('API on http://localhost:'+PORT));
