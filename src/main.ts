import './style.css';
import { checkAdmin, createStore, removeKrathong, type Krathong } from './store';
import { KINDS, drawKrathong, toKind, type Kind } from './kinds';

const COLORS = ['#ff8fb1', '#ffd23f', '#ffffff', '#c49bff', '#ff9f45'];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const river = $<HTMLDivElement>('river');
const bubble = $<HTMLDivElement>('bubble');
const form = $<HTMLFormElement>('form');
const nameInput = $<HTMLInputElement>('name');
const wishInput = $<HTMLInputElement>('wish');
const count = $<HTMLParagraphElement>('count');
const colorsBox = $<HTMLDivElement>('colors');
const kindsBox = $<HTMLDivElement>('kinds');

let selectedColor = COLORS[0];
let selectedKind: Kind = 'classic';
const rendered = new Map<string, HTMLElement>();
let adminPassword: string | null = null; // set after logging in on /admin

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

// Krathong in slot i (createdAt order) goes to lane i % LANES. Every krathong in a lane moves at
// the lane's speed, so their spacing never changes; lanes at different depths pass each other
// (parallax). Within a lane, the golden ratio spreads them evenly however many there are.
// Position is a function of wall-clock time, so every viewer sees the same river.
const LANES = 7;
const GOLDEN = 0.6180339887;
const frac = (x: number) => x - Math.floor(x);

function place(k: Krathong, el: HTMLElement, slot: number) {
  const h = hash(k.id);
  const lane = slot % LANES;
  const laneDepth = (lane + 0.5) / LANES; // 0 = far (horizon), 1 = near (bank)
  const depth = laneDepth + ((h % 100) / 100 - 0.5) * (0.6 / LANES); // jitter looks, not speed
  const phase = frac(lane * 0.37 + Math.floor(slot / LANES) * GOLDEN);
  const duration = 70 + (1 - laneDepth) * 90; // far lanes drift slower across the screen
  el.style.setProperty('--depth', depth.toFixed(3));
  el.style.setProperty('--y', (depth ** 1.6).toFixed(3)); // perspective: far rows bunch at the horizon
  el.style.setProperty('--scale', (0.42 + depth * 0.68).toFixed(3));
  el.style.zIndex = String(1 + Math.round(depth * 100));
  el.style.animationDuration = `${duration}s`;
  el.style.animationDelay = `${-((Date.now() / 1000 + phase * duration) % duration)}s`;
  el.style.setProperty('--bob', `${3.5 + (h % 20) / 10}s`);
  el.style.setProperty('--bob-delay', `${-(h % 1000) / 100}s`);
}

function updateCount(items: Krathong[]) {
  count.textContent = items.length
    ? `ลอยแล้ว ${items.length} กระทง`
    : 'ยังไม่มีใครลอย มาเป็นคนแรกกัน';
}

function unrender(id: string) {
  rendered.get(id)?.remove();
  rendered.delete(id);
}

// `items` is the full list from the server: anything missing was deleted, except krathongs
// newer than the list itself (a poll that started before our own add finished).
function sync(items: Krathong[]) {
  const ids = new Set(items.map((k) => k.id));
  const newest = items.at(-1)?.createdAt ?? '';
  for (const [id, el] of [...rendered]) if (!ids.has(id) && el.dataset.createdAt! <= newest) unrender(id);
  render(items, 0);
}

function render(items: Krathong[], firstSlot: number) {
  for (const [i, k] of items.entries()) {
    if (rendered.has(k.id)) continue;
    const el = document.createElement('button');
    el.className = 'krathong';
    el.type = 'button';
    el.dataset.createdAt = k.createdAt;

    const caption = document.createElement('span');
    caption.className = 'caption';
    const wish = document.createElement('span');
    wish.className = 'wish';
    wish.textContent = k.wish;
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = `— ${k.name}`;
    caption.append(wish, who);

    el.innerHTML = `<span class="ripple"></span><span class="ripple r2"></span><span class="reflect"></span>`
      + `<span class="float">${drawKrathong(toKind(k.kind), k.color)}</span>`;
    el.prepend(caption);
    el.addEventListener('click', (ev) => showWish(k, ev));
    place(k, el, firstSlot + i);
    river.append(el);
    rendered.set(k.id, el);
  }
}

function showWish(k: Krathong, ev: MouseEvent) {
  bubble.replaceChildren();
  const who = document.createElement('strong');
  who.textContent = `${k.name} · กระทง${KINDS[toKind(k.kind)].label}`;
  const wish = document.createElement('p');
  wish.textContent = `“${k.wish}”`;
  bubble.append(who, wish);
  if (adminPassword) bubble.append(deleteButton(k));
  bubble.hidden = false;
  bubble.style.left = `${Math.min(ev.clientX, window.innerWidth - 260)}px`;
  bubble.style.top = `${Math.max(ev.clientY - 110, 10)}px`;
  ev.stopPropagation();
}
document.addEventListener('click', () => (bubble.hidden = true));
bubble.addEventListener('click', (e) => e.stopPropagation());

function deleteButton(k: Krathong) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'delete';
  b.textContent = 'ลบกระทงนี้';
  let armed = false;
  b.addEventListener('click', async () => {
    if (!armed) {
      armed = true;
      b.textContent = 'กดอีกครั้งเพื่อยืนยัน';
      return;
    }
    b.disabled = true;
    try {
      await removeKrathong(k.id, adminPassword!);
      unrender(k.id);
      bubble.hidden = true;
    } catch (err) {
      b.textContent = `ลบไม่สำเร็จ: ${(err as Error).message}`;
      b.disabled = false;
      armed = false;
    }
  });
  return b;
}

function setupAdmin() {
  document.body.classList.add('admin');
  const box = document.createElement('form');
  box.className = 'admin-login';
  box.innerHTML = '<strong>โหมดแอดมิน</strong><input type="password" placeholder="รหัสผ่าน" autocomplete="current-password" required /><button>เข้าสู่ระบบ</button><span class="msg"></span>';
  const input = box.querySelector('input')!;
  const msg = box.querySelector<HTMLSpanElement>('.msg')!;
  const enter = (pw: string) => {
    adminPassword = pw;
    box.replaceChildren(Object.assign(document.createElement('strong'), { textContent: 'แอดมิน: แตะกระทงเพื่อลบ' }));
  };
  box.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    try {
      await checkAdmin(input.value);
      try { sessionStorage.setItem('krathong-admin', input.value); } catch { /* empty */ }
      enter(input.value);
    } catch (err) {
      msg.textContent = (err as Error).message;
    }
  });
  document.body.append(box);
  let saved: string | null = null;
  try { saved = sessionStorage.getItem('krathong-admin'); } catch { /* empty */ }
  if (saved) checkAdmin(saved).then(() => enter(saved), () => {});
}

const setFormOpen = (open: boolean) => document.body.classList.toggle('form-open', open);
$('open-form').addEventListener('click', (e) => { e.stopPropagation(); setFormOpen(true); });
$('close-form').addEventListener('click', () => setFormOpen(false));
document.addEventListener('keydown', (e) => e.key === 'Escape' && setFormOpen(false));

function setupPicker<T extends string>(
  box: HTMLElement,
  values: readonly T[],
  build: (b: HTMLButtonElement, v: T) => void,
  onPick: (v: T) => void,
) {
  for (const v of values) {
    const b = document.createElement('button');
    b.type = 'button';
    build(b, v);
    b.addEventListener('click', () => {
      onPick(v);
      box.querySelectorAll('button').forEach((s) => s.classList.toggle('on', s === b));
    });
    box.append(b);
  }
  box.firstElementChild?.classList.add('on');
}

function refreshKindPreviews() {
  kindsBox.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.querySelector('.thumb')!.innerHTML = drawKrathong(b.dataset.kind as Kind, selectedColor);
  });
}

function setupStars() {
  const sky = $<HTMLDivElement>('sky');
  for (let i = 0; i < 80; i++) {
    const s = document.createElement('i');
    s.className = 'star';
    s.style.left = `${Math.random() * 100}%`;
    s.style.top = `${Math.random() * 100}%`;
    s.style.animationDelay = `${Math.random() * 4}s`;
    sky.append(s);
  }
}

async function main() {
  setupStars();
  if (location.pathname.replace(/\/$/, '') === '/admin') setupAdmin();
  setupPicker(kindsBox, Object.keys(KINDS) as Kind[], (b, k) => {
    b.className = 'kind';
    b.dataset.kind = k;
    b.title = KINDS[k].label;
    b.innerHTML = `<span class="thumb"></span><span>${KINDS[k].label}</span>`;
  }, (k) => (selectedKind = k));
  setupPicker(colorsBox, COLORS, (b, c) => {
    b.className = 'swatch';
    b.style.background = c;
    b.setAttribute('aria-label', `สี ${c}`);
  }, (c) => { selectedColor = c; refreshKindPreviews(); });
  refreshKindPreviews();
  try { nameInput.value = localStorage.getItem('krathong-name') ?? ''; } catch { /* empty */ }

  const store = createStore();
  store.subscribe((items) => { updateCount(items); sync(items); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]') as HTMLButtonElement;
    btn.disabled = true;
    try {
      const name = nameInput.value.trim();
      const k = await store.add({ name, wish: wishInput.value.trim(), color: selectedColor, kind: selectedKind });
      try { localStorage.setItem('krathong-name', name); } catch { /* empty */ }
      wishInput.value = '';
      setFormOpen(false);
      render([k], rendered.size);
      rendered.get(k.id)?.classList.add('mine');
    } catch (err) {
      console.error(err);
      alert('ลอยไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      btn.disabled = false;
    }
  });
}

main();
