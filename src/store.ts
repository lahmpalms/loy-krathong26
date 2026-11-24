import type { Schema } from '../amplify/data/resource';

export type Krathong = { id: string; name: string; wish: string; color: string; kind?: string | null; createdAt: string };
export type NewKrathong = Pick<Krathong, 'name' | 'wish' | 'color' | 'kind'>;

export interface Store {
  readonly mode: 'cloud' | 'local';
  subscribe(onChange: (items: Krathong[]) => void): void;
  add(k: NewKrathong): Promise<Krathong>;
}

const outputs = Object.values(
  import.meta.glob('../amplify_outputs.json', { eager: true, import: 'default' }),
)[0] as Record<string, unknown> | undefined;

export async function createStore(): Promise<Store> {
  return outputs ? cloudStore(outputs) : localStore();
}

async function cloudStore(config: Record<string, unknown>): Promise<Store> {
  const { Amplify } = await import('aws-amplify');
  const { generateClient } = await import('aws-amplify/data');
  Amplify.configure(config);
  const client = generateClient<Schema>();

  return {
    mode: 'cloud',
    subscribe(onChange) {
      client.models.Krathong.observeQuery().subscribe({
        next: ({ items }) => onChange(items as Krathong[]),
        error: (e) => console.error('observeQuery failed', e),
      });
    },
    async add(k) {
      const { data, errors } = await client.models.Krathong.create(k);
      if (!data) throw new Error(errors?.map((e) => e.message).join(', ') ?? 'create failed');
      return data as Krathong;
    },
  };
}

function localStore(): Store {
  const KEY = 'krathongs';
  let items: Krathong[] = [];
  try { items = JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { /* empty */ }
  let listener: (items: Krathong[]) => void = () => {};

  return {
    mode: 'local',
    subscribe(onChange) {
      listener = onChange;
      onChange(items);
    },
    async add(k) {
      const item = { ...k, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      items = [...items, item];
      try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* empty */ }
      listener(items);
      return item;
    },
  };
}
