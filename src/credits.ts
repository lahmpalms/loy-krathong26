import type { Krathong } from './store';
import { drawKrathong, toKind } from './kinds';

const PX_PER_SECOND = 38;
const HOLD_LAST_CARD_MS = 10_000;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function creditRow(k: Krathong) {
  const row = el('div', 'credit');
  const icon = el('span', 'credit-icon');
  icon.innerHTML = drawKrathong(toKind(k.kind), k.color);
  const name = el('span', 'credit-name', k.name);
  name.prepend(icon);
  row.append(el('span', 'credit-wish', k.wish), el('span', 'credit-dot', '·'), name);
  return row;
}

// End-of-film roll: starts on the title card, everyone's wish and name scroll up, the closing
// card holds in the middle of the screen, then the roll starts again.
// Built once from the first list; later polls don't touch it so the scroll never jumps.
export function showCredits(items: Krathong[]) {
  const root = el('section', 'credits');
  root.setAttribute('aria-label', 'ขอบคุณทุกคนที่มาลอยกระทง');
  const roll = el('div', 'credits-roll');

  const opening = el('div', 'credits-block');
  opening.append(
    el('p', 'credits-kicker', 'ขอบคุณทุกคนที่มาร่วมสนุก'),
    el('h2', 'credits-title', 'ลอยกระทง 2569'),
    el('p', 'credits-sub', `ร่วมลอยทั้งหมด ${items.length} กระทง`),
  );

  const list = el('div', 'credits-list');
  list.append(el('h3', 'credits-heading', 'คำอธิษฐาน'), ...items.map(creditRow));

  const closing = el('div', 'credits-block');
  closing.append(
    el('p', 'credits-kicker', 'ขอให้ทุกคำอธิษฐานเป็นจริง'),
    el('h2', 'credits-title small', 'แล้วพบกันใหม่ปีหน้า'),
    el('p', 'credits-moon', '🌕'),
  );

  roll.append(opening, list, closing);
  root.append(roll);
  document.body.append(root);

  // Tap pauses the roll so people can read their wish.
  const toggle = () => root.classList.toggle('paused');
  root.addEventListener('click', toggle);

  const start = () => {
    const centered = (card: HTMLElement) => root.clientHeight / 2 - (card.offsetTop + card.offsetHeight / 2);
    const from = centered(opening);
    const to = centered(closing);
    roll.style.setProperty('--from', `${from}px`);
    roll.style.setProperty('--to', `${to}px`);
    roll.style.animationDuration = `${(from - to) / PX_PER_SECOND}s`;
    roll.classList.add('rolling');
  };
  let holdTimer = 0;
  const restart = () => {
    clearTimeout(holdTimer);
    roll.classList.remove('rolling');
    void roll.offsetHeight; // reflow so the animation starts over with fresh measurements
    start();
  };
  roll.addEventListener('animationend', () => (holdTimer = window.setTimeout(restart, HOLD_LAST_CARD_MS)));
  // Measure only after the Thai webfont loads, or the roll height is wrong.
  document.fonts.ready.then(start);
  window.addEventListener('resize', restart);
}
