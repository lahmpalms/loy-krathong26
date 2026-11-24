// Each drawing uses viewBox 0 0 100 90 with the waterline near y=58.
const flame = (x: number, y: number) => `
  <g class="flame" style="transform-origin:${x}px ${y + 6}px">
    <ellipse cx="${x}" cy="${y}" rx="4" ry="7" fill="#ffb300"/>
    <ellipse cx="${x}" cy="${y + 1}" rx="2" ry="4" fill="#fff59d"/>
  </g>`;

const leafBase = () => {
  const petals = Array.from({ length: 8 }, (_, i) => {
    const x = 10 + i * 10;
    return `<path d="M${x} 52 L${x + 6} 34 L${x + 12} 52 Z" fill="#3f9a4a" stroke="#2c6e35" stroke-width="1"/>`;
  }).join('');
  return `<ellipse cx="50" cy="58" rx="46" ry="12" fill="#2c6e35"/>
    <ellipse cx="50" cy="54" rx="42" ry="10" fill="#4caf50"/>${petals}`;
};

const classic = (c: string) => `
  ${leafBase()}
  <circle cx="38" cy="38" r="9" fill="${c}"/>
  <circle cx="62" cy="38" r="9" fill="${c}"/>
  <circle cx="50" cy="32" r="10" fill="${c}"/>
  <circle cx="50" cy="32" r="3" fill="#f5b700"/>
  <rect x="47" y="10" width="6" height="18" rx="1" fill="#fff6d5"/>
  <rect x="30" y="16" width="2" height="18" fill="#8d6e63"/>
  <rect x="68" y="16" width="2" height="18" fill="#8d6e63"/>
  ${flame(50, 6)}`;

const beer = (c: string) => `
  ${leafBase()}
  <rect x="40" y="30" width="20" height="26" rx="4" fill="#7a4a12"/>
  <path d="M44 30 L44 18 Q44 14 47 13 L53 13 Q56 14 56 18 L56 30 Z" fill="#7a4a12"/>
  <rect x="40" y="36" width="20" height="12" fill="${c}"/>
  <text x="50" y="45" font-size="7" font-weight="700" text-anchor="middle" fill="#3a2a00">BEER</text>
  <rect x="62" y="38" width="14" height="16" rx="2" fill="#f2c14e" stroke="#fff" stroke-width="1.5"/>
  <rect x="61" y="34" width="16" height="5" rx="2.5" fill="#fff"/>
  <path d="M76 41 q5 0 5 5 q0 5 -5 5" fill="none" stroke="#fff" stroke-width="1.5"/>
  <rect x="48" y="7" width="4" height="7" fill="#fff6d5"/>
  ${flame(50, 3)}`;

const docs = (c: string) => `
  <path d="M8 44 L92 44 L78 64 L22 64 Z" fill="#f4f4f4" stroke="#bdbdbd"/>
  <path d="M50 8 L26 44 L74 44 Z" fill="#ffffff" stroke="#bdbdbd"/>
  <line x1="40" y1="30" x2="60" y2="30" stroke="#9e9e9e" stroke-width="1.5"/>
  <line x1="36" y1="36" x2="64" y2="36" stroke="#9e9e9e" stroke-width="1.5"/>
  <line x1="30" y1="52" x2="70" y2="52" stroke="#9e9e9e" stroke-width="1.5"/>
  <rect x="30" y="54" width="40" height="8" rx="1" fill="none" stroke="${c === '#ffffff' ? '#e53935' : c}" stroke-width="1.5" transform="rotate(-6 50 58)"/>
  <text x="50" y="60.5" font-size="6" font-weight="700" text-anchor="middle" fill="${c === '#ffffff' ? '#e53935' : c}" transform="rotate(-6 50 58)">FINAL_v9</text>
  <rect x="48" y="0" width="4" height="9" fill="#fff6d5"/>
  ${flame(50, -3)}`;

const bread = (c: string) => `
  <ellipse cx="50" cy="56" rx="44" ry="13" fill="#b7752c"/>
  <ellipse cx="50" cy="51" rx="40" ry="11" fill="#e0a458"/>
  <path d="M28 48 q6 -6 12 0 M46 46 q6 -6 12 0 M64 48 q6 -6 12 0" stroke="#b7752c" stroke-width="2" fill="none"/>
  <circle cx="40" cy="38" r="7" fill="${c}"/>
  <circle cx="60" cy="38" r="7" fill="${c}"/>
  <circle cx="50" cy="34" r="8" fill="${c}"/>
  <rect x="47" y="12" width="6" height="18" rx="1" fill="#fff6d5"/>
  ${flame(50, 8)}`;

const coffee = (c: string) => `
  <ellipse cx="50" cy="60" rx="32" ry="7" fill="#e0e0e0"/>
  <path d="M30 26 L70 26 L64 60 L36 60 Z" fill="#fafafa" stroke="#bdbdbd"/>
  <rect x="27" y="20" width="46" height="7" rx="3" fill="${c === '#ffffff' ? '#6d4c41' : c}"/>
  <rect x="33" y="36" width="34" height="12" fill="#6d4c41"/>
  <text x="50" y="45" font-size="6.5" font-weight="700" text-anchor="middle" fill="#fff">OT ☕</text>
  <path class="steam" d="M42 16 q-4 -5 0 -10 M58 16 q-4 -5 0 -10" stroke="#ffffffaa" stroke-width="2" fill="none"/>
  <rect x="48" y="10" width="4" height="10" fill="#fff6d5"/>
  ${flame(50, 6)}`;

export const KINDS = {
  classic: { label: 'ใบตอง', draw: classic },
  beer: { label: 'เบียร์', draw: beer },
  docs: { label: 'เอกสาร', draw: docs },
  bread: { label: 'ขนมปัง', draw: bread },
  coffee: { label: 'กาแฟ OT', draw: coffee },
} as const;

export type Kind = keyof typeof KINDS;

export function toKind(v: string | null | undefined): Kind {
  return v && v in KINDS ? (v as Kind) : 'classic';
}

export function drawKrathong(kind: Kind, color: string) {
  return `<svg viewBox="0 -10 100 100" width="100%" height="100%" aria-hidden="true">${KINDS[kind].draw(color)}</svg>`;
}
