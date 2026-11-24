import './style.css';
import { createStore, type Krathong } from './store';
import { KINDS, drawKrathong, toKind, type Kind } from './kinds';

const COLORS = ['#ff8fb1', '#ffd23f', '#ffffff', '#c49bff', '#ff9f45'];
const DURATION_S = 80;

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

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

// Position derives from id + createdAt only, so every viewer sees the same layout.
function place(k: Krathong, el: HTMLElement) {
  const h = hash(k.id);
  const depth = (h % 1000) / 1000; // 0 = far (top of river), 1 = near
  const duration = DURATION_S + (h % 40);
  const startOffset = (h >>> 10) % duration;
  const ageS = Math.max((Date.now() - new Date(k.createdAt).getTime()) / 1000, 0);
  el.style.setProperty('--depth', depth.toFixed(3));
  el.style.zIndex = String(1 + Math.round(depth * 100));
  el.style.setProperty('--scale', (0.75 + depth * 0.4).toFixed(2));
  el.style.animationDuration = `${duration}s, ${3 + (h % 3)}s`;
  el.style.animationDelay = `${-((ageS + startOffset) % duration)}s, ${-(h % 3)}s`;
}

function updateCount(items: Krathong[]) {
  count.textContent = items.length
    ? `ลอยแล้ว ${items.length} กระทง`
    : 'ยังไม่มีใครลอย มาเป็นคนแรกกัน';
}

function render(items: Krathong[]) {
  for (const k of items) {
    if (rendered.has(k.id)) continue;
    const el = document.createElement('button');
    el.className = 'krathong';
    el.type = 'button';

    const caption = document.createElement('span');
    caption.className = 'caption';
    const wish = document.createElement('span');
    wish.className = 'wish';
    wish.textContent = k.wish;
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = `— ${k.name}`;
    caption.append(wish, who);

    el.innerHTML = drawKrathong(toKind(k.kind), k.color);
    el.prepend(caption);
    el.addEventListener('click', (ev) => showWish(k, ev));
    place(k, el);
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
  bubble.hidden = false;
  bubble.style.left = `${Math.min(ev.clientX, window.innerWidth - 260)}px`;
  bubble.style.top = `${Math.max(ev.clientY - 110, 10)}px`;
  ev.stopPropagation();
}
document.addEventListener('click', () => (bubble.hidden = true));

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
  store.subscribe((items) => { updateCount(items); render(items); });

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
      render([k]);
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
