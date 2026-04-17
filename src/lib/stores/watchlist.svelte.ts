// ─── WATCHLIST STORE ─────────────────────────────────────────────────────────
// Svelte 5 rune-based reactive store with localStorage persistence

export interface WatchlistItem {
  id: number;
  media_type: 'movie' | 'tv';
  title: string;
  year: string;
  poster: string;
  rating: string;
  addedAt: number;
}

const STORAGE_KEY = 'watchorder_watchlist';

function createWatchlistStore() {
  // Load initial state from localStorage (SSR-safe)
  function loadFromStorage(): WatchlistItem[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  let items = $state<WatchlistItem[]>(loadFromStorage());

  function persist() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }

  function has(id: number, media_type: string): boolean {
    return items.some(w => w.id === id && w.media_type === media_type);
  }

  function add(item: Omit<WatchlistItem, 'addedAt'>): boolean {
    if (has(item.id, item.media_type)) return false;
    items = [...items, { ...item, addedAt: Date.now() }];
    persist();
    return true;
  }

  function remove(id: number, media_type: string) {
    items = items.filter(w => !(w.id === id && w.media_type === media_type));
    persist();
  }

  function toggle(item: Omit<WatchlistItem, 'addedAt'>): 'added' | 'removed' {
    if (has(item.id, item.media_type)) {
      remove(item.id, item.media_type);
      return 'removed';
    }
    add(item);
    return 'added';
  }

  return {
    get items() { return items; },
    has,
    add,
    remove,
    toggle,
    get count() { return items.length; },
  };
}

// Export a singleton
export const watchlist = createWatchlistStore();
