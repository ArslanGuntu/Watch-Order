# WatchOrder — Full Refactoring Summary

## New File System Architecture

```
src/
├── app.html
├── lib/
│   ├── api/
│   │   └── tmdb.ts                  ← Single TMDB config, typed fetch, all interfaces
│   ├── stores/
│   │   └── watchlist.svelte.ts      ← Svelte 5 $state rune store (replaces localStorage spread)
│   ├── types/
│   │   └── index.ts                 ← MediaItem, GuideEntry, SelectedItem, WatchlistItem…
│   ├── utils/
│   │   ├── index.ts                 ← esc, fuzzy, fmtMoney, accentColor, yearRange…
│   │   └── guideLoader.ts           ← URL param + sessionStorage loader for guide tabs
│   └── components/
│       ├── layout/
│       │   ├── NavBar.svelte        ← Shared nav, Tailwind, reactive scroll state
│       │   └── GrainOverlay.svelte  ← Extracted decorative overlay
│       ├── ui/
│       │   └── Spinner.svelte       ← Reusable loading spinner
│       ├── media/
│       │   └── MediaCard.svelte     ← Browse grid card, Tailwind, typed props
│       └── guide/
│           ├── GuideHero.svelte     ← Shared hero across all guide sub-pages
│           └── GuideTabBar.svelte   ← Shared tab nav (5 pages → 1 component)
└── routes/
    ├── +layout.svelte               ← Root layout (unchanged, correct)
    ├── +page.svelte                 ← Landing page
    ├── app/
    │   ├── +page.svelte             ← Browse page (Svelte 5, paginated grid)
    │   ├── guide/+page.svelte       ← ✅ REFACTORED (see below)
    │   ├── episodes/+page.svelte    ← Uses GuideHero + GuideTabBar
    │   ├── ratings/+page.svelte     ← Uses GuideHero + GuideTabBar
    │   ├── history/+page.svelte     ← Uses GuideHero + GuideTabBar
    │   └── reviews/+page.svelte     ← Uses GuideHero + GuideTabBar
    ├── recommendations/
    │   └── +page.svelte             ← ✅ FULLY REWRITTEN (see below)
    ├── mcu/
    │   └── +page.svelte             ← ✅ FULLY REWRITTEN (see below)
    └── signin/+page.svelte
```

---

## Issues Fixed

### 1. DOM Manipulation → Svelte Templates

| File | Before | After |
|------|--------|-------|
| `recommendations/+page.svelte` | 2000+ lines of vanilla JS, `document.createElement`, `innerHTML`, `canvas` | Full Svelte 5 with `{#if}`, `{#each}`, `$state`, `$derived` |
| `mcu/+page.svelte` | Entire page rendered via `renderGuide()` writing `appRoot.innerHTML` | Pure Svelte template, zero DOM writes |
| `guide/+page.svelte` | `document.body.style.overflow = 'hidden'` directly | `$effect()` reactive scroll-lock via CSS class |

### 2. TMDB API Key — Single Source of Truth

**Before:** `const TMDB_KEY = '175b19b3ba717bf4f24e37ee4325be7e'` hardcoded in 6+ files.

**After:** One export in `$lib/api/tmdb.ts`:
```ts
export const TMDB_KEY = '175b19b3ba717bf4f24e37ee4325be7e';
export async function tmdbFetch<T>(endpoint, params): Promise<T> { ... }
```

### 3. CSS → Tailwind

All `<style>` blocks removed from refactored pages. Replaced with Tailwind utility classes. Examples:

```diff
- .nav-scrolled { background: rgba(5,5,5,0.95); backdrop-filter: blur(16px); border-bottom: 1px solid rgba(255,255,255,0.07); }
+ class="bg-[rgba(5,5,5,0.95)] backdrop-blur-[16px] border-b border-white/[0.07]"
```

```diff
- .spinner { width: 36px; height: 36px; border: 2px solid rgba(201,168,76,0.1); border-top-color: #c9a84c; animation: spin 0.9s linear infinite; }
+ <Spinner size="lg" />   ← reusable component
```

### 4. Shared Components Replace Copy-Paste

**GuideTabBar** — 5 pages all had copy-pasted tab HTML:
```svelte
<!-- Before (in each of 5 pages): -->
<div class="tab-bar">
  <a class="tab-btn tab-active anime-tab" href="guide{qs}">WATCH ORDER</a>
  <a class="tab-btn" href="episodes{qs}">EPISODES</a>
  ...
</div>

<!-- After (in each page): -->
<GuideTabBar type={sel.type} {qs} active="guide" />
```

**GuideHero** — replaces duplicated hero HTML in all 5 guide sub-pages.

### 5. Watchlist Store — Reactive + No Direct localStorage Access in Components

**Before:** Each page directly called `localStorage.setItem(...)` and maintained its own array.

**After:** `$lib/stores/watchlist.svelte.ts` — Svelte 5 rune store with persistence:
```ts
export const watchlist = createWatchlistStore();
// Usage anywhere:
watchlist.toggle({ id, media_type, title, ... });
watchlist.has(id, media_type); // reactive
watchlist.count; // reactive
```

### 6. SvelteKit Best Practices

| Pattern | Before | After |
|---------|--------|-------|
| URL reading | `new URL(window.location.href)` in script | `$app/stores page` or `onMount` with proper SSR guard |
| Navigation | `window.location.href = '/'` | `goto('/')` from `$app/navigation` |
| Body scroll lock | `document.body.style.overflow = 'hidden'` inline | `$effect()` reactive side-effect |
| `window.history.back()` | Direct call | `goto('/app')` |
| `document.querySelector` | Finding elements after render | Svelte bindings + reactive state |
| `on:event` | Svelte 4 syntax found in some files | `onevent` (Svelte 5 standard) |

### 7. Utility Functions — DRY

**Before:** `esc()`, `norm()`, `fuzzy()`, `fmtR()`, `accentCol()`, `yearRange()` duplicated in every page.

**After:** Single import:
```ts
import { esc, fuzzyMatch, fmtRating, accentColor, yearRange } from '$lib/utils';
```

---

## Optional Next Steps

1. **Move TMDB key to server** — Create `src/routes/api/tmdb/[...path]/+server.ts` to proxy TMDB calls server-side (hides API key from client).
2. **`+page.ts` loaders** — Move `onMount` data fetching to `load()` functions for SSR and better performance.
3. **`on:error` images** — Replace inline `onerror` with a proper `<Image>` component.
4. **`app.css`** — Move the `@theme` font/color tokens from `layout.css` into a proper `app.css` Tailwind theme config.
