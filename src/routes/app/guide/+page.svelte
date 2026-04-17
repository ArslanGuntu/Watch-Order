<script lang="ts">
  // @ts-nocheck
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { tmdbFetch, posterUrl, backdropUrl, IMG_SIZES } from '$lib/api/tmdb';
  import { fmtRating, extractYear, yearRange, accentColor, accentClass } from '$lib/utils';
  import GrainOverlay from '$lib/components/layout/GrainOverlay.svelte';
  import GuideHero from '$lib/components/guide/GuideHero.svelte';
  import GuideTabBar from '$lib/components/guide/GuideTabBar.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';

  // ─── URL PARAMS ───────────────────────────────────────────────────────────
  // Use $app/stores `page` to read URL — no window.location in script

  let itemType = $state('');
  let itemId = $state('');
  let qs = $state('');
  let sel = $state(null);
  let guideEntries = $state([]);
  let loading = $state(true);
  let error = $state(null);
  let selectedEntryIndex = $state(null);

  // Modal
  let showModal = $state(false);
  let modalEntry = $state(null);

  // Compare
  let showCompare = $state(false);
  let compareEntities = $state([]);
  let compareSearchQ = $state('');
  let compareSearchResults = $state([]);
  let compareSearching = $state(false);
  let compareSearchTimer = null;
  let compareWinner = $state(null);
  let compareRevealing = $state(false);
  let compareRevealed = $state(false);

  // Body scroll lock state — use CSS class on <body> instead of inline style
  let bodyScrollLocked = $state(false);

  let compareType = $derived(
    itemType === 'franchises' ? 'franchises'
    : itemType === 'movies' ? 'movies'
    : itemType === 'anime' ? 'anime'
    : 'series'
  );

  let isTV = $derived(sel?.type === 'anime' || sel?.type === 'series');
  let isSM = $derived(sel?.type === 'movies');
  let ac = $derived(accentClass(sel?.type ?? ''));
  let acC = $derived(accentColor(sel?.type ?? ''));
  let typeLabel = $derived(
    sel?.type === 'anime' ? 'ANIME GUIDE'
    : sel?.type === 'series' ? 'SERIES GUIDE'
    : isSM ? 'FILM GUIDE' : 'FRANCHISE GUIDE'
  );

  // ─── SCROLL LOCK (no direct DOM write) ────────────────────────────────────
  $effect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = bodyScrollLocked ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  });

  // ─── COMPARE ──────────────────────────────────────────────────────────────

  function openCompare() {
    showCompare = true;
    bodyScrollLocked = true;
    compareEntities = sel ? [{ id: sel.id, type: itemType, title: sel.title, poster: sel.posterUrl || sel.poster || '', rating: sel.ratingNum || 0, popularity: 0, year: sel.year || '', overview: sel.desc || '' }] : [];
    compareSearchQ = '';
    compareSearchResults = [];
    compareWinner = null;
    compareRevealing = false;
    compareRevealed = false;
  }

  function closeCompare() {
    showCompare = false;
    bodyScrollLocked = false;
    setTimeout(() => { compareEntities = []; compareWinner = null; compareRevealing = false; compareRevealed = false; }, 300);
  }

  function removeCompareEntity(idx) {
    compareEntities = compareEntities.filter((_, i) => i !== idx);
    compareWinner = null; compareRevealed = false; compareRevealing = false;
  }

  async function searchCompare(q) {
    if (!q || q.length < 2) { compareSearchResults = []; return; }
    compareSearching = true;
    try {
      let results = [];
      if (compareType === 'movies') {
        const r = await tmdbFetch('/search/movie', { query: q, page: 1 });
        results = (r.results || []).slice(0, 8).map(m => ({ id: m.id, type: 'movies', title: m.title || '', poster: m.poster_path ? posterUrl(m.poster_path, 'poster_sm') : '', rating: m.vote_average || 0, popularity: m.popularity || 0, year: extractYear(m.release_date), overview: m.overview || '' }));
      } else if (compareType === 'anime' || compareType === 'series') {
        const r = await tmdbFetch('/search/tv', { query: q, page: 1 });
        results = (r.results || []).slice(0, 8).map(s => ({ id: s.id, type: compareType, title: s.name || '', poster: s.poster_path ? posterUrl(s.poster_path, 'poster_sm') : '', rating: s.vote_average || 0, popularity: s.popularity || 0, year: extractYear(s.first_air_date), overview: s.overview || '' }));
      }
      const addedIds = new Set(compareEntities.map(e => String(e.id)));
      compareSearchResults = results.filter(r => !addedIds.has(String(r.id)));
    } catch { compareSearchResults = []; }
    compareSearching = false;
  }

  function addToCompare(entity) {
    if (compareEntities.length >= 5 || compareEntities.some(e => String(e.id) === String(entity.id))) return;
    compareEntities = [...compareEntities, entity];
    compareSearchQ = ''; compareSearchResults = [];
    compareWinner = null; compareRevealed = false; compareRevealing = false;
  }

  function calcScore(entity) {
    const ratingScore = (entity.rating || 0) * 7;
    const pop = entity.popularity || 0;
    const popScore = pop > 0 ? Math.min(Math.log10(pop) / Math.log10(500) * 30, 30) : 0;
    return ratingScore + popScore;
  }

  function runComparison() {
    if (compareEntities.length < 2) return;
    compareRevealing = true; compareRevealed = false; compareWinner = null;
    setTimeout(() => {
      let best = -Infinity, winIdx = 0;
      const scores = compareEntities.map((e, i) => { const s = calcScore(e); if (s > best) { best = s; winIdx = i; } return s; });
      compareWinner = { idx: winIdx, score: scores[winIdx], scores, entity: compareEntities[winIdx] };
      compareRevealed = true; compareRevealing = false;
    }, 2200);
  }

  function scoreLabel(score) {
    if (score >= 85) return 'ELITE'; if (score >= 70) return 'GREAT';
    if (score >= 55) return 'GOOD'; if (score >= 40) return 'AVERAGE'; return 'WEAK';
  }
  function scoreColor(score) {
    if (score >= 85) return '#5fbf8c'; if (score >= 70) return '#c9a84c';
    if (score >= 55) return '#f0c060'; return '#e05c7a';
  }

  // ─── MODAL ────────────────────────────────────────────────────────────────

  function openMI(idx) {
    modalEntry = guideEntries[idx];
    selectedEntryIndex = idx;
    showModal = true;
    bodyScrollLocked = true;
  }

  function closeMI() {
    showModal = false;
    bodyScrollLocked = false;
    setTimeout(() => { modalEntry = null; selectedEntryIndex = null; }, 250);
  }

  // ─── DATA LOADING ─────────────────────────────────────────────────────────

  async function loadItem() {
    try {
      if (itemType === 'franchises') {
        const col = await tmdbFetch(`/collection/${itemId}`);
        const parts = col.parts || [];
        sel = {
          id: col.id, type: 'franchises',
          title: (col.name || '').replace(/ Collection$/i, ''),
          entries: parts.length, desc: col.overview || '',
          bg: backdropUrl(col.backdrop_path), poster: posterUrl(col.poster_path, 'poster_lg'),
          years: yearRange(parts), year: extractYear(parts[0]?.release_date),
          ratingNum: 0, rating: '—',
        };
        const details = await Promise.all(parts.map(p => tmdbFetch(`/movie/${p.id}`, { append_to_response: 'credits,watch/providers' }).catch(() => p)));
        guideEntries = details.map((m, i) => ({
          id: m.id, order: i + 1,
          title: m.title || m.original_title || '',
          overview: m.overview || '',
          posterUrl: posterUrl(m.poster_path, 'poster_md'),
          backdropUrl: backdropUrl(m.backdrop_path),
          release_date: m.release_date || '',
          rating: fmtRating(m.vote_average),
          ratingNum: m.vote_average || 0,
          runtime: m.runtime ? `${Math.floor(m.runtime/60)}h ${m.runtime%60}m` : 'N/A',
          director: m.credits?.crew?.find(c => c.job === 'Director')?.name || '',
          streamingServices: m['watch/providers']?.results?.US?.flatrate || [],
        }));
      } else if (itemType === 'movies') {
        const m = await tmdbFetch(`/movie/${itemId}`, { append_to_response: 'credits' });
        sel = {
          id: itemId, type: 'movies',
          title: m.title || m.original_title || 'Unknown', entries: 1,
          desc: m.overview || '', bg: backdropUrl(m.backdrop_path),
          poster: posterUrl(m.poster_path, 'poster_lg'),
          years: extractYear(m.release_date), year: extractYear(m.release_date),
          ratingNum: m.vote_average || 0, rating: fmtRating(m.vote_average),
        };
        guideEntries = [{
          id: m.id, order: 1, title: m.title || '',
          overview: m.overview || '', posterUrl: posterUrl(m.poster_path, 'poster_md'),
          release_date: m.release_date, rating: fmtRating(m.vote_average),
          ratingNum: m.vote_average || 0,
          runtime: m.runtime ? `${Math.floor(m.runtime/60)}h ${m.runtime%60}m` : 'N/A',
          director: m.credits?.crew?.find(c => c.job === 'Director')?.name || '',
        }];
      } else {
        const sd = await tmdbFetch(`/tv/${itemId}`, { append_to_response: 'credits' });
        const seasons = (sd.seasons || []).filter(s => s.season_number > 0);
        sel = {
          id: +itemId, type: itemType,
          title: sd.name || sd.original_name || 'Unknown',
          entries: seasons.length, desc: sd.overview || '',
          bg: backdropUrl(sd.backdrop_path), poster: posterUrl(sd.poster_path, 'poster_lg'),
          posterUrl: posterUrl(sd.poster_path, 'poster_md'),
          years: sd.first_air_date
            ? extractYear(sd.first_air_date) + (sd.last_air_date && sd.status !== 'Returning Series' ? '–' + extractYear(sd.last_air_date) : '–')
            : 'N/A',
          status: sd.status || '',
          ratingNum: sd.vote_average || 0, rating: fmtRating(sd.vote_average),
        };
        guideEntries = seasons.map((s, i) => ({
          id: s.id, order: i + 1,
          title: s.name || `Season ${s.season_number}`,
          overview: s.overview || sd.overview || '',
          posterUrl: s.poster_path ? posterUrl(s.poster_path, 'poster_md') : posterUrl(sd.poster_path, 'poster_md'),
          season_number: s.season_number,
          episode_count: s.episode_count || 0,
          air_date: s.air_date || '',
          rating: fmtRating(s.vote_average),
          ratingNum: s.vote_average || 0,
          runtime: sd.episode_run_time?.[0] ? `~${sd.episode_run_time[0]}m/ep` : 'N/A',
          director: sd.credits?.crew?.find(c => c.job === 'Executive Producer')?.name || 'Unknown',
        }));
      }
      document.title = `${sel.title} · Guide · WatchOrder`;
      loading = false;
    } catch (e) {
      console.error(e);
      error = 'Could not load guide.';
      loading = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (showModal) closeMI();
      else if (showCompare) closeCompare();
    }
  }

  function goBack() {
    goto('/app');
  }

  onMount(() => {
    const url = new URL(window.location.href);
    itemType = url.searchParams.get('type') || '';
    itemId = url.searchParams.get('id') || '';
    qs = `?type=${encodeURIComponent(itemType)}&id=${encodeURIComponent(itemId)}`;
    if (!itemType || !itemId) { error = 'No guide found.'; loading = false; }
    else loadItem();
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>

<GrainOverlay />

<!-- NAV -->
<nav class="fixed top-0 w-full z-[500] flex justify-between items-center px-[50px] py-4 bg-[rgba(5,5,5,0.95)] backdrop-blur-[16px] border-b border-white/[0.07]">
  <a class="flex items-baseline gap-0 no-underline" href="/" onclick={(e) => { e.preventDefault(); goBack(); }}>
    <span class="font-['Cormorant_Garamond'] text-[2.2rem] text-[#c9a84c] font-bold leading-none">W</span>
    <span class="font-['Cormorant_Garamond'] text-[1.6rem] font-light text-[#f0ece4]">atch</span>
    <span class="font-['Cormorant_Garamond'] italic text-[1.6rem] font-semibold opacity-85 text-[#f0ece4]">Order</span>
    <div class="w-[5px] h-[5px] bg-[#c9a84c] rounded-full ml-[5px] shadow-[0_0_8px_#c9a84c]"></div>
  </a>
  {#if !loading && sel}
    <button
      class="flex items-center gap-2 font-['Space_Mono'] text-[0.62rem] tracking-[0.1em] uppercase border border-white/10 text-white/45 bg-transparent px-4 py-2 rounded-sm cursor-pointer transition-all hover:border-[#c9a84c]/40 hover:text-[#c9a84c]"
      onclick={openCompare}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="3" width="4" height="8" rx="1" stroke="currentColor" stroke-width="1.3"/>
        <rect x="9" y="1" width="4" height="12" rx="1" stroke="currentColor" stroke-width="1.3"/>
        <path d="M5 7h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      </svg>
      COMPARE
    </button>
  {/if}
</nav>

{#if loading}
  <div class="min-h-screen flex flex-col items-center justify-center gap-5 text-[#c9a84c] font-['Space_Mono'] text-[0.78rem]">
    <Spinner size="lg" />
    <p>LOADING GUIDE...</p>
  </div>
{:else if error}
  <div class="min-h-screen flex flex-col items-center justify-center gap-5 text-center">
    <h2 class="font-['Cormorant_Garamond'] text-5xl opacity-40">{error === 'No guide found.' ? '404' : 'Error'}</h2>
    <p class="text-white/50">{error}</p>
    <button
      class="font-['Space_Mono'] text-[0.65rem] tracking-[0.1em] uppercase border border-white/20 text-white/50 bg-transparent px-6 py-3 rounded-sm cursor-pointer mt-5 hover:border-[#c9a84c]/40 hover:text-[#c9a84c] transition-all"
      onclick={goBack}
    >← BACK</button>
  </div>
{:else if sel}
  <main class="pt-[72px]">
    <GuideHero {sel} />
    <GuideTabBar type={sel.type} {qs} active="guide" />

    <!-- Timeline / Guide content -->
    <section class="px-[70px] py-[70px] pb-[120px] max-w-[1400px] mx-auto">
      <div class="mb-14">
        <div class="flex items-center gap-3.5 font-['Space_Mono'] text-[0.68rem] tracking-[0.2em] mb-5" style="color: {acC}">
          <span class="w-9 h-px" style="background: {acC}"></span>
          {isTV ? 'SEASON ORDER' : isSM ? 'FILM DETAILS' : 'RELEASE ORDER'}
        </div>
        <p class="text-white/40 text-[0.9rem]">{isTV ? 'By season.' : isSM ? 'Film info below.' : 'By release date.'}</p>
      </div>

      <!-- Timeline spine + entries -->
      <div class="relative">
        <div class="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 hidden md:block" style="background: linear-gradient(to bottom, transparent, {acC}55, {acC}22, transparent)"></div>

        {#each guideEntries as m, i}
          {@const right = i % 2 !== 0}
          <div class="grid md:grid-cols-[1fr_64px_1fr] items-start mb-14">
            {#if !right}
              <button
                class="group text-left bg-[#0d0d0d] border border-white/[0.06] rounded-sm overflow-hidden cursor-pointer transition-all duration-300 hover:border-[rgba(201,168,76,0.2)] hover:-translate-y-0.5 md:mr-8"
                onclick={() => openMI(i)}
              >
                {#if m.posterUrl}
                  <div class="relative h-[140px] overflow-hidden">
                    <img src={m.posterUrl} alt={m.title || ''} loading="lazy" class="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500" />
                    <div class="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] to-transparent"></div>
                  </div>
                {/if}
                <div class="p-5">
                  <div class="font-['Space_Mono'] text-[0.52rem] mb-1" style="color: {acC}">#{m.order}</div>
                  <h3 class="font-['Cormorant_Garamond'] text-[1.15rem] font-semibold mb-1">{m.title || m.name || ''}</h3>
                  <div class="font-['Space_Mono'] text-[0.52rem] text-white/35 flex gap-2.5 mb-2 flex-wrap">
                    <span>{m.runtime || ''}</span>
                    {#if m.ratingNum > 0}<span>★ {m.rating}</span>{/if}
                    {#if m.director}<span>🎬 {m.director}</span>{/if}
                  </div>
                  <p class="text-[0.76rem] text-white/38 leading-relaxed line-clamp-2">{(m.overview || '').slice(0, 100)}{(m.overview || '').length > 100 ? '...' : ''}</p>
                </div>
              </button>
            {:else}
              <div></div>
            {/if}

            <!-- Dot -->
            <div class="flex justify-center pt-5">
              <div class="w-11 h-11 rounded-full border bg-[#0a0a0a] flex items-center justify-center font-['Space_Mono'] text-[0.65rem]"
                   style="border-color: {acC}66; color: {acC}">
                {m.order}
              </div>
            </div>

            {#if right}
              <button
                class="group text-left bg-[#0d0d0d] border border-white/[0.06] rounded-sm overflow-hidden cursor-pointer transition-all duration-300 hover:border-[rgba(201,168,76,0.2)] hover:-translate-y-0.5 md:ml-8"
                onclick={() => openMI(i)}
              >
                {#if m.posterUrl}
                  <div class="relative h-[140px] overflow-hidden">
                    <img src={m.posterUrl} alt={m.title || ''} loading="lazy" class="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500" />
                    <div class="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] to-transparent"></div>
                  </div>
                {/if}
                <div class="p-5">
                  <div class="font-['Space_Mono'] text-[0.52rem] mb-1" style="color: {acC}">#{m.order}</div>
                  <h3 class="font-['Cormorant_Garamond'] text-[1.15rem] font-semibold mb-1">{m.title || m.name || ''}</h3>
                  <div class="font-['Space_Mono'] text-[0.52rem] text-white/35 flex gap-2.5 mb-2 flex-wrap">
                    <span>{m.runtime || ''}</span>
                    {#if m.ratingNum > 0}<span>★ {m.rating}</span>{/if}
                    {#if m.director}<span>🎬 {m.director}</span>{/if}
                  </div>
                  <p class="text-[0.76rem] text-white/38 leading-relaxed line-clamp-2">{(m.overview || '').slice(0, 100)}{(m.overview || '').length > 100 ? '...' : ''}</p>
                </div>
              </button>
            {:else}
              <div></div>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  </main>
{/if}

<!-- ── ENTRY MODAL ────────────────────────────────────────────────────────── -->
{#if showModal && modalEntry}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-8 animate-fade-in"
    onclick={(e) => { if (e.target === e.currentTarget) closeMI(); }}
  >
    <div class="max-w-[700px] w-full max-h-[85vh] bg-[#0d0d0d] border border-white/[0.1] rounded-2xl overflow-hidden flex flex-col animate-slide-up">
      {#if modalEntry.backdropUrl || modalEntry.posterUrl}
        <div class="relative h-[200px] overflow-hidden flex-shrink-0">
          <div class="absolute inset-0 bg-cover bg-center brightness-50" style="background-image: url('{modalEntry.backdropUrl || modalEntry.posterUrl}')"></div>
          <div class="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] to-transparent"></div>
        </div>
      {/if}
      <button class="absolute top-4 right-4 z-20 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white/60 hover:text-white cursor-pointer border-none" onclick={closeMI}>✕</button>
      <div class="p-7 overflow-y-auto">
        <h2 class="font-['Cormorant_Garamond'] text-[1.8rem] font-bold mb-3">{modalEntry.title || modalEntry.name || ''}</h2>
        <div class="flex gap-2 flex-wrap mb-4">
          {#if modalEntry.ratingNum > 0}<span class="font-['Space_Mono'] text-[0.58rem] border border-white/15 text-white/55 px-2.5 py-1 rounded-full">★ {modalEntry.rating}</span>{/if}
          {#if modalEntry.runtime}<span class="font-['Space_Mono'] text-[0.58rem] border border-white/15 text-white/55 px-2.5 py-1 rounded-full">⏱ {modalEntry.runtime}</span>{/if}
          {#if modalEntry.release_date || modalEntry.air_date}<span class="font-['Space_Mono'] text-[0.58rem] border border-white/15 text-white/55 px-2.5 py-1 rounded-full">📅 {(modalEntry.release_date || modalEntry.air_date || '').slice(0,4)}</span>{/if}
        </div>
        <p class="font-['Sora'] text-[0.9rem] text-white/55 leading-relaxed">{modalEntry.overview}</p>
        {#if modalEntry.director}
          <p class="font-['Sora'] text-[0.8rem] text-white/40 mt-4">🎬 Directed by <strong class="text-white/65">{modalEntry.director}</strong></p>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- ── COMPARE MODAL ──────────────────────────────────────────────────────── -->
{#if showCompare}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-8 animate-fade-in"
    onclick={(e) => { if (e.target === e.currentTarget) closeCompare(); }}
  >
    <div class="max-w-[900px] w-full max-h-[90vh] bg-[#0d0d0d] border border-white/[0.1] rounded-2xl overflow-hidden flex flex-col animate-slide-up">
      <div class="flex items-center justify-between px-7 py-5 border-b border-white/[0.07]">
        <h2 class="font-['Cormorant_Garamond'] text-[1.6rem] font-semibold">Compare</h2>
        <button class="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-white/50 hover:text-white cursor-pointer border-none" onclick={closeCompare}>✕</button>
      </div>

      <div class="p-7 overflow-y-auto flex flex-col gap-5">
        <!-- Entities -->
        <div class="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
          {#each compareEntities as entity, i}
            <div class="relative bg-[#111] border border-white/[0.08] rounded-lg overflow-hidden {compareWinner?.idx === i && compareRevealed ? 'border-[#5fbf8c] shadow-[0_0_20px_rgba(95,191,140,0.2)]' : ''}">
              {#if entity.poster}
                <img src={entity.poster} alt={entity.title} class="w-full aspect-[2/3] object-cover opacity-70" />
              {:else}
                <div class="w-full aspect-[2/3] flex items-center justify-center text-3xl opacity-20">🎬</div>
              {/if}
              <div class="p-3">
                <div class="font-['Cormorant_Garamond'] text-[0.95rem] font-semibold truncate">{entity.title}</div>
                {#if compareRevealed && compareWinner}
                  {@const score = compareWinner.scores[i]}
                  <div class="font-['Space_Mono'] text-[0.6rem] mt-1" style="color: {scoreColor(score)}">{scoreLabel(score)} · {score.toFixed(0)}pts</div>
                {/if}
                {#if compareWinner?.idx === i && compareRevealed}
                  <div class="font-['Space_Mono'] text-[0.55rem] text-[#5fbf8c] mt-1">🏆 WINNER</div>
                {/if}
              </div>
              <button
                class="absolute top-2 right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white/50 hover:text-red-400 cursor-pointer border-none text-xs"
                onclick={() => removeCompareEntity(i)}
              >✕</button>
            </div>
          {/each}

          {#if compareEntities.length < 5}
            <div class="bg-[#0a0a0a] border border-dashed border-white/[0.1] rounded-lg aspect-[2/3] flex items-center justify-center text-white/20 text-3xl cursor-pointer hover:border-white/20 transition-colors">+</div>
          {/if}
        </div>

        <!-- Search -->
        {#if compareEntities.length < 5}
          <div class="relative">
            <input
              type="text"
              placeholder="Search to add…"
              bind:value={compareSearchQ}
              oninput={() => { clearTimeout(compareSearchTimer); compareSearchTimer = setTimeout(() => searchCompare(compareSearchQ), 380); }}
              class="w-full bg-[#111] border border-white/10 rounded-sm px-4 py-3 font-['Sora'] text-[0.9rem] text-[#f0ece4] outline-none focus:border-[#c9a84c]/40 placeholder:text-white/25"
            />
            {#if compareSearchResults.length > 0}
              <div class="absolute w-full bg-[#111] border border-white/10 rounded-sm mt-1 z-10 shadow-xl">
                {#each compareSearchResults as r}
                  <button class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 cursor-pointer border-b border-white/[0.04] last:border-0 text-left bg-transparent" onclick={() => addToCompare(r)}>
                    {#if r.poster}<img src={r.poster} alt="" class="w-8 h-10 object-cover rounded-sm opacity-80" />{/if}
                    <div>
                      <div class="font-['Sora'] text-[0.86rem] text-[#f0ece4]">{r.title}</div>
                      <div class="font-['Space_Mono'] text-[0.5rem] text-white/35">{r.year}</div>
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Actions -->
        <div class="flex gap-3">
          <button
            class="flex-1 font-['Space_Mono'] text-[0.68rem] tracking-[0.12em] uppercase py-3.5 border rounded-sm cursor-pointer transition-all
                   {compareEntities.length >= 2 && !compareRevealing ? 'bg-[rgba(201,168,76,0.12)] border-[#c9a84c]/50 text-[#c9a84c] hover:bg-[rgba(201,168,76,0.22)]' : 'bg-white/5 border-white/10 text-white/25 cursor-not-allowed'}"
            disabled={compareEntities.length < 2 || compareRevealing}
            onclick={runComparison}
          >
            {compareRevealing ? 'CALCULATING…' : compareRevealed ? 'RECALCULATE' : 'COMPARE →'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slide-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
  .animate-fade-in { animation: fade-in 0.25s ease; }
  .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.2, 0.9, 0.4, 1); }
</style>
