// Tiny API for krathongs: Node built-ins only (node:sqlite needs Node >= 22.13).
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const PORT = Number(process.env.PORT ?? 3026);
const DB_PATH = process.env.DB_PATH ?? new URL('./krathong.db', import.meta.url).pathname;
const POSTS_PER_MINUTE = 6;

const db = new DatabaseSync(DB_PATH);
db.exec(`PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS krathong (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  wish TEXT NOT NULL,
  color TEXT NOT NULL,
  kind TEXT,
  createdAt TEXT NOT NULL
);`);
const listAll = db.prepare('SELECT id, name, wish, color, kind, createdAt FROM krathong ORDER BY createdAt');
const insert = db.prepare('INSERT INTO krathong (id, name, wish, color, kind, createdAt) VALUES (?, ?, ?, ?, ?, ?)');

const recentPosts = new Map(); // ip -> timestamps within the last minute
function rateLimited(ip) {
  const now = Date.now();
  const hits = (recentPosts.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (hits.length >= POSTS_PER_MINUTE) return true;
  hits.push(now);
  recentPosts.set(ip, hits);
  return false;
}

const str = (v, max) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 4096) throw new Error('too large');
  }
  return JSON.parse(raw);
}

const STATIC_DIR = process.env.STATIC_DIR; // built frontend (dist); unset in dev, where vite serves it
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

async function serveStatic(req, res) {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = normalize(join(STATIC_DIR, path));
  const inside = file.startsWith(STATIC_DIR + sep);
  const target = inside && (await stat(file).catch(() => null))?.isFile() ? file : join(STATIC_DIR, 'index.html');
  res.writeHead(200, {
    'Content-Type': TYPES[extname(target)] ?? 'application/octet-stream',
    'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  res.end(await readFile(target));
}

const server = http.createServer(async (req, res) => {
  if (req.url !== '/api/krathongs') {
    if (STATIC_DIR && req.method === 'GET' && !req.url.startsWith('/api/')) return serveStatic(req, res).catch(() => send(res, 400, { error: 'bad request' }));
    return send(res, 404, { error: 'not found' });
  }

  if (req.method === 'GET') return send(res, 200, listAll.all());

  if (req.method === 'POST') {
    const ip = req.headers['x-real-ip'] ?? req.socket.remoteAddress;
    if (rateLimited(ip)) return send(res, 429, { error: 'ลอยถี่เกินไป รอสักครู่' });
    let body;
    try { body = await readJson(req); } catch { return send(res, 400, { error: 'bad json' }); }
    const name = str(body.name, 30);
    const wish = str(body.wish, 80);
    const color = typeof body.color === 'string' && /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : null;
    const kind = body.kind == null ? null : str(body.kind, 20);
    if (!name || !wish || !color) return send(res, 400, { error: 'invalid fields' });
    const item = { id: randomUUID(), name, wish, color, kind, createdAt: new Date().toISOString() };
    insert.run(item.id, item.name, item.wish, item.color, item.kind, item.createdAt);
    return send(res, 201, item);
  }

  send(res, 405, { error: 'method not allowed' });
});
server.listen(PORT, process.env.HOST ?? '127.0.0.1', () => console.log(`krathong api on 127.0.0.1:${PORT}, db ${DB_PATH}`));
