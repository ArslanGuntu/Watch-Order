// ─── STRING UTILS ────────────────────────────────────────────────────────────

/** Safely escape HTML entities */
export function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Normalize string for fuzzy matching */
export function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

/** Fuzzy title match */
export function fuzzyMatch(title: string, query: string): boolean {
  if (!query) return true;
  const nt = norm(title), nq = norm(query);
  if (nt.includes(nq)) return true;
  return nq.split(' ').filter(Boolean).every(w => nt.split(' ').some(tw => tw.includes(w)));
}

/** Get initials from a name */
export function initials(name: string): string {
  return name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '??';
}

// ─── NUMBER UTILS ────────────────────────────────────────────────────────────

/** Format currency (budget/revenue) */
export function fmtMoney(n: number | null | undefined): string {
  if (!n) return 'N/A';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

/** Format a rating number */
export function fmtRating(r: number | null | undefined): string {
  return r && r > 0 ? r.toFixed(1) : '—';
}

// ─── DATE UTILS ──────────────────────────────────────────────────────────────

/** Extract 4-digit year from ISO date string */
export function extractYear(dateStr: string | null | undefined): string {
  return (dateStr ?? '').slice(0, 4);
}

/** Compute year range from an array of items with date fields */
export function yearRange(items: Array<{ release_date?: string; first_air_date?: string }>): string {
  const years = items
    .map(p => +(p.release_date ?? p.first_air_date ?? '').slice(0, 4))
    .filter(Boolean)
    .sort((a, b) => a - b);
  return years.length ? `${years[0]}–${years[years.length - 1]}` : 'N/A';
}

// ─── ACCENT COLORS ───────────────────────────────────────────────────────────
// Centralized so all pages share the same color logic

export type ContentType = 'franchises' | 'movies' | 'anime' | 'series';

export function accentColor(type: ContentType | string): string {
  switch (type) {
    case 'anime': return '#e05c7a';
    case 'series': return '#5fbf8c';
    default: return '#c9a84c'; // gold for movies/franchises
  }
}

export function accentClass(type: ContentType | string): string {
  switch (type) {
    case 'anime': return 'anime';
    case 'series': return 'series';
    default: return 'movie';
  }
}

// ─── SCROLL UTILS ────────────────────────────────────────────────────────────

/** Scroll to top of an element smoothly (no direct DOM access in component logic) */
export function scrollToSelector(selector: string) {
  if (typeof document === 'undefined') return;
  const el = document.querySelector(selector);
  if (el) {
    const y = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
}

// ─── URL UTILS ───────────────────────────────────────────────────────────────

/** Build query string for guide sub-pages (preserves type/id params) */
export function guideQs(type: string, id: string | number): string {
  return `?type=${type}&id=${id}`;
}
