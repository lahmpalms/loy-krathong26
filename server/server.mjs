// Tiny API for krathongs: Node built-ins only (node:sqlite needs Node >= 22.13).
import http from 'node:http';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const PORT = Number(process.env.PORT ?? 3026);
const DB_PATH = process.env.DB_PATH ?? new URL('./krathong.db', import.meta.url).pathname;
const POSTS_PER_MINUTE = 6;
const ADMIN_TRIES_PER_MINUTE = 5;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // unset → admin API disabled

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
const remove = db.prepare('DELETE FROM krathong WHERE id = ?');

const recentPosts = new Map(); // ip -> timestamps within the last minute
const recentAdminFails = new Map();
const recentHits = (map, ip) => (map.get(ip) ?? []).filter((t) => Date.now() - t < 60_000);
function hit(map, ip) {
  map.set(ip, [...recentHits(map, ip), Date.now()]);
}

// Caddy replaces X-Forwarded-For with the real client IP; the port is only reachable from Caddy.
const clientIp = (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() ?? req.socket.remoteAddress;

const digest = (s) => createHash('sha256').update(s).digest();
function isAdmin(req) {
  const given = req.headers.authorization?.replace(/^Bearer /, '');
  return Boolean(ADMIN_PASSWORD && given && timingSafeEqual(digest(given), digest(ADMIN_PASSWORD)));
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

function handleAdmin(req, res) {
  const ip = clientIp(req);
  if (recentHits(recentAdminFails, ip).length >= ADMIN_TRIES_PER_MINUTE) return send(res, 429, { error: 'ลองรหัสผิดบ่อยเกินไป รอ 1 นาที' });
  if (!isAdmin(req)) {
    hit(recentAdminFails, ip);
    return send(res, 401, { error: 'รหัสผ่านไม่ถูกต้อง' });
  }
  if (req.url === '/api/admin' && req.method === 'GET') return send(res, 200, { ok: true });
  const id = req.url.match(/^\/api\/krathongs\/([0-9a-f-]{36})$/)?.[1];
  if (id && req.method === 'DELETE') {
    return remove.run(id).changes ? send(res, 200, { deleted: id }) : send(res, 404, { error: 'not found' });
  }
  send(res, 404, { error: 'not found' });
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/admin' || req.url.startsWith('/api/krathongs/')) return handleAdmin(req, res);
  if (req.url !== '/api/krathongs') {
    if (STATIC_DIR && req.method === 'GET' && !req.url.startsWith('/api/')) return serveStatic(req, res).catch(() => send(res, 400, { error: 'bad request' }));
    return send(res, 404, { error: 'not found' });
  }

  if (req.method === 'GET') return send(res, 200, listAll.all());

  if (req.method === 'POST') {
    const ip = clientIp(req);
    if (recentHits(recentPosts, ip).length >= POSTS_PER_MINUTE) return send(res, 429, { error: 'ลอยถี่เกินไป รอสักครู่' });
    hit(recentPosts, ip);
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
