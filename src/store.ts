export type Krathong = { id: string; name: string; wish: string; color: string; kind?: string | null; createdAt: string };
export type NewKrathong = Pick<Krathong, 'name' | 'wish' | 'color' | 'kind'>;

export interface Store {
  subscribe(onChange: (items: Krathong[]) => void): void;
  add(k: NewKrathong): Promise<Krathong>;
}

const API = '/api/krathongs';
const POLL_MS = 5000;

export function createStore(): Store {
  return {
    subscribe(onChange) {
      const load = async () => {
        try {
          const res = await fetch(API);
          if (res.ok) onChange(await res.json());
        } catch (e) {
          console.error('load failed', e);
        }
      };
      load();
      setInterval(() => document.hidden || load(), POLL_MS);
    },
    async add(k) {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(k),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
      return res.json();
    },
  };
}

export async function checkAdmin(password: string): Promise<void> {
  const res = await fetch('/api/admin', { headers: { Authorization: `Bearer ${password}` } });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
}

export async function removeKrathong(id: string, password: string): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${password}` } });
  if (!res.ok && res.status !== 404) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
}
