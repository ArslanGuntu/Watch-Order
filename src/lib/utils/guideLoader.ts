// ─── GUIDE PAGE SHARED LOADER ────────────────────────────────────────────────
// Each guide sub-page (guide, episodes, ratings, history, reviews) calls this
// to parse URL params and re-hydrate the selected item from sessionStorage.

import type { ContentType, SelectedItem } from '$lib/types';

const SESSION_KEY = 'watchorder_selected';

/** Save the selected item to sessionStorage (called from /app when navigating to a guide) */
export function saveSelected(item: SelectedItem) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(item));
}

/** Load the selected item — from sessionStorage, keyed by type+id from URL params */
export function loadSelected(url: URL): { item: SelectedItem | null; type: ContentType; id: string; qs: string } {
  const type = (url.searchParams.get('type') ?? 'movies') as ContentType;
  const id = url.searchParams.get('id') ?? '';
  const qs = id ? `?type=${type}&id=${id}` : '';

  let item: SelectedItem | null = null;
  if (typeof sessionStorage !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SelectedItem;
        // Validate it matches the URL params
        if (String(parsed.id) === id && parsed.type === type) {
          item = parsed;
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  return { item, type, id, qs };
}
