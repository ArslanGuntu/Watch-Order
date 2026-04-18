<script>
  // @ts-nocheck
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  
  const TMDB_KEY = '175b19b3ba717bf4f24e37ee4325be7e';
  const BASE = 'https://api.themoviedb.org/3';
  const IMG = 'https://image.tmdb.org/t/p';
  
  let itemType = $state('');
  let itemId = $state('');
  let qs = $state('');
  
  let sel = $state(null);
  let guideEntries = $state([]);
  let loading = $state(true);
  let error = $state(null);
  let selectedEntryIndex = $state(null);
  
  let showModal = $state(false);
  let modalEntry = $state(null);

  // ── VIDEO PLAYER STATE ──
  let showVideoPlayer = $state(false);
  let videoTitle = $state('');
  let videoTrailerKey = $state('');

  let showCompare = $state(false);
  let compareEntities = $state([]);
  let compareSearchQ = $state('');
  let compareSearchResults = $state([]);
  let compareSearching = $state(false);
  let compareSearchTimer = null;
  let compareWinner = $state(null);
  let compareRevealing = $state(false);
  let compareRevealed = $state(false);
  
  let compareType = $derived(
    itemType === 'franchises' ? 'franchises'
    : itemType === 'movies' ? 'movies'
    : itemType === 'anime' ? 'anime'
    : 'series'
  );

  let isTV = $derived(sel?.type === 'anime' || sel?.type === 'series');
  let isSM = $derived(sel?.type === 'movies');
  let ac = $derived(sel?.type === 'anime' ? 'anime' : sel?.type === 'series' ? 'series' : '');
  let acC = $derived(accentCol(sel?.type));
  let typeLabel = $derived(sel?.type === 'anime' ? 'ANIME GUIDE' : sel?.type === 'series' ? 'SERIES GUIDE' : isSM ? 'FILM GUIDE' : 'FRANCHISE GUIDE');
  let compareTypeLabel = $derived(
    compareType === 'franchises' ? 'Franchises' :
    compareType === 'movies' ? 'Movies' :
    compareType === 'anime' ? 'Anime' : 'Series'
  );

  $effect(() => {
    if (showModal || showCompare || showVideoPlayer) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  });

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  
  function fmtR(r) { return r > 0 ? r.toFixed(1) : '—'; }
  
  function fmtMoney(n) {
    if (!n || n === 0) return 'N/A';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    return '$' + n.toLocaleString();
  }
  
  function initials(n) { return n ? n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '??'; }
  function accentCol(t) { return t === 'anime' ? '#e05c7a' : t === 'series' ? '#5fbf8c' : '#c9a84c'; }
  
  function getYearRange(parts) {
    const y = (parts || []).map(p => +(p.release_date || p.first_air_date || '').slice(0, 4)).filter(Boolean).sort((a, b) => a - b);
    return y.length ? `${y[0]}–${y[y.length - 1]}` : 'N/A';
  }
  
  function goBack() { goto('/app'); }
  
  // ── VIDEO PLAYER FUNCTIONS ──
  function openVideoPlayer(trailerKey, title) {
    videoTrailerKey = trailerKey;
    videoTitle = title || 'Trailer';
    showVideoPlayer = true;
  }

  function closeVideoPlayer() {
    showVideoPlayer = false;
    // Small delay so iframe stops loading before we null the key
    setTimeout(() => { videoTrailerKey = ''; videoTitle = ''; }, 300);
  }

  function buildME(m, i) {
    let tk = null;
    if (m.videos?.results) {
      const t = m.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
      if (t) tk = t.key;
    }
    const wp = m['watch/providers']?.results?.US;
    const crew = m.credits?.crew || [];
    return {
      ...m, order: i + 1, year: (m.release_date || '').slice(0, 4),
      posterUrl: m.poster_path ? `${IMG}/w300${m.poster_path}` : '',
      backdropUrl: m.backdrop_path ? `${IMG}/w1280${m.backdrop_path}` : '',
      runtime: m.runtime ? Math.floor(m.runtime / 60) + 'h ' + (m.runtime % 60) + 'm' : 'N/A',
      rating: fmtR(m.vote_average || 0), ratingNum: m.vote_average || 0,
      director: crew.find(c => c.job === 'Director')?.name || 'Unknown',
      writer: crew.find(c => c.job === 'Screenplay' || c.job === 'Writer')?.name || null,
      producer: crew.find(c => c.job === 'Producer' || c.job === 'Executive Producer')?.name || null,
      dop: crew.find(c => c.job === 'Director of Photography')?.name || null,
      composer: crew.find(c => c.department === 'Sound' && c.job?.includes('Music'))?.name || null,
      trailerKey: tk, streamingServices: wp?.flatrate || [],
      cast: (m.credits?.cast || []).slice(0, 12),
      keywords: (m.keywords?.keywords || []).slice(0, 15),
      genres: m.genres || [], budget: m.budget || 0, revenue: m.revenue || 0,
      tagline: m.tagline || null, status: m.status || null,
      voteCount: m.vote_count || 0, popularity: m.popularity || 0, imdb_id: m.imdb_id || null
    };
  }
  
  async function loadItem() {
    try {
      const isTV = itemType === 'anime' || itemType === 'series';
      const isFr = itemType === 'franchises';
      
      if (isFr) {
        const colId = String(itemId).replace(/^col_/, '');
        const col = await fetch(`${BASE}/collection/${colId}?api_key=${TMDB_KEY}`).then(r => r.json());
        const parts = (col.parts || []).filter(p => p.release_date).sort((a, b) => a.release_date.localeCompare(b.release_date));
        sel = {
          id: itemId, type: 'franchises',
          title: (col.name || '').replace(/ Collection$/i, ''),
          entries: parts.length, desc: col.overview || '',
          bg: col.backdrop_path ? `${IMG}/w1280${col.backdrop_path}` : '',
          poster: col.poster_path ? `${IMG}/w500${col.poster_path}` : '',
          posterUrl: col.poster_path ? `${IMG}/w300${col.poster_path}` : '',
          years: getYearRange(parts), year: (parts[0]?.release_date || '').slice(0, 4),
          ratingNum: 0, rating: '—'
        };
        let dets = await Promise.all(parts.map(p =>
          fetch(`${BASE}/movie/${p.id}?api_key=${TMDB_KEY}&append_to_response=credits,videos,watch/providers,keywords`)
            .then(r => r.json()).catch(() => null)
        ));
        dets = dets.filter(Boolean).sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''));
        guideEntries = dets.map((m, i) => buildME(m, i));
      } else if (itemType === 'movies') {
        const m = await fetch(`${BASE}/movie/${itemId}?api_key=${TMDB_KEY}&append_to_response=credits,videos,watch/providers,keywords`).then(r => r.json());
        sel = {
          id: itemId, type: 'movies',
          title: m.title || m.original_title || 'Unknown',
          entries: 1, desc: m.overview || '',
          bg: m.backdrop_path ? `${IMG}/w1280${m.backdrop_path}` : '',
          poster: m.poster_path ? `${IMG}/w500${m.poster_path}` : '',
          posterUrl: m.poster_path ? `${IMG}/w300${m.poster_path}` : '',
          years: m.release_date ? m.release_date.slice(0, 4) : 'N/A',
          year: m.release_date ? m.release_date.slice(0, 4) : '',
          ratingNum: m.vote_average || 0, rating: fmtR(m.vote_average || 0)
        };
        guideEntries = [buildME(m, 0)];
      } else if (isTV) {
        const sd = await fetch(`${BASE}/tv/${itemId}?api_key=${TMDB_KEY}&append_to_response=credits,videos,watch/providers`).then(r => r.json());
        const seasons = (sd.seasons || []).filter(s => s.season_number > 0);
        sel = {
          id: +itemId, type: itemType,
          title: sd.name || sd.original_name || 'Unknown',
          entries: seasons.length, desc: sd.overview || '',
          bg: sd.backdrop_path ? `${IMG}/w1280${sd.backdrop_path}` : '',
          poster: sd.poster_path ? `${IMG}/w500${sd.poster_path}` : '',
          posterUrl: sd.poster_path ? `${IMG}/w300${sd.poster_path}` : '',
          years: sd.first_air_date ? `${sd.first_air_date.slice(0, 4)}${sd.last_air_date && sd.status !== 'Returning Series' ? '–' + sd.last_air_date.slice(0, 4) : '–'}` : 'N/A',
          year: sd.first_air_date ? sd.first_air_date.slice(0, 4) : '',
          status: sd.status || '', ratingNum: sd.vote_average || 0, rating: fmtR(sd.vote_average || 0)
        };
        guideEntries = seasons.map((s, i) => ({
          ...s, order: i + 1, year: (s.air_date || '').slice(0, 4),
          posterUrl: s.poster_path ? `${IMG}/w300${s.poster_path}` : (sd.poster_path ? `${IMG}/w300${sd.poster_path}` : ''),
          backdropUrl: sd.backdrop_path ? `${IMG}/w1280${sd.backdrop_path}` : '',
          title: s.name || 'Season ' + s.season_number,
          overview: s.overview || sd.overview || '',
          ratingNum: s.vote_average || 0, rating: fmtR(s.vote_average || 0),
          runtime: sd.episode_run_time?.[0] ? `~${sd.episode_run_time[0]}m/ep` : 'N/A',
          episode_count: s.episode_count || 0,
          director: (sd.credits?.crew || []).find(c => c.job === 'Director' || c.job === 'Series Director' || c.job === 'Executive Producer')?.name || 'Unknown',
          trailerKey: (() => { const t = sd.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube'); return t?.key || null; })(),
          streamingServices: sd['watch/providers']?.results?.US?.flatrate || [],
          cast: (sd.credits?.cast || []).slice(0, 12), genres: sd.genres || [], networks: sd.networks || [],
          status: sd.status || '', tagline: sd.tagline || null,
          voteCount: s.vote_count || sd.vote_count || 0, popularity: sd.popularity || 0, showId: +itemId
        }));
      }
      loading = false;
    } catch (e) {
      console.error(e);
      error = 'Could not load guide.';
      loading = false;
    }
  }
  
  function openMI(idx) {
    modalEntry = guideEntries[idx];
    selectedEntryIndex = idx;
    showModal = true;
  }
  
  function closeMI() {
    showModal = false;
    setTimeout(() => { modalEntry = null; selectedEntryIndex = null; }, 250);
  }
  
  function handleKeydown(e) {
    if (e.key === 'Escape') {
      if (showVideoPlayer) closeVideoPlayer();
      else if (showModal) closeMI();
      else if (showCompare) closeCompare();
    }
  }
  
  onMount(() => {
    const url = new URL(window.location.href);
    itemType = url.searchParams.get('type') || '';
    itemId = url.searchParams.get('id') || '';
    qs = '?type=' + encodeURIComponent(itemType) + '&id=' + encodeURIComponent(itemId);
    
    if (!itemType || !itemId) { error = 'No guide found.'; loading = false; }
    else loadItem();
  });

  function openCompare() {
    showCompare = true;
    compareEntities = [];
    compareSearchQ = '';
    compareSearchResults = [];
    compareWinner = null;
    compareRevealing = false;
    compareRevealed = false;
    if (sel) {
      compareEntities = [{ id: sel.id, type: itemType, title: sel.title, poster: sel.posterUrl || sel.poster || '', rating: sel.ratingNum || 0, popularity: 0, year: sel.year || '', overview: sel.desc || '' }];
    }
  }

  function closeCompare() {
    showCompare = false;
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
        const r = await fetch(`${BASE}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&page=1`).then(r => r.json());
        results = (r.results || []).slice(0, 8).map(m => ({ id: m.id, type: 'movies', title: m.title || m.original_title || '', poster: m.poster_path ? `${IMG}/w300${m.poster_path}` : '', rating: m.vote_average || 0, popularity: m.popularity || 0, year: (m.release_date || '').slice(0, 4), overview: m.overview || '' }));
      } else if (compareType === 'franchises') {
        const r = await fetch(`${BASE}/search/collection?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&page=1`).then(r => r.json());
        results = (r.results || []).slice(0, 8).map(c => ({ id: 'col_' + c.id, type: 'franchises', title: (c.name || '').replace(/ Collection$/i, ''), poster: c.poster_path ? `${IMG}/w300${c.poster_path}` : '', rating: 0, popularity: 0, year: '', overview: c.overview || '' }));
      } else if (compareType === 'anime') {
        const r = await fetch(`${BASE}/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&page=1`).then(r => r.json());
        results = (r.results || []).slice(0, 8).filter(s => (s.genre_ids || []).includes(16) || s.origin_country?.includes('JP')).map(s => ({ id: s.id, type: 'anime', title: s.name || s.original_name || '', poster: s.poster_path ? `${IMG}/w300${s.poster_path}` : '', rating: s.vote_average || 0, popularity: s.popularity || 0, year: (s.first_air_date || '').slice(0, 4), overview: s.overview || '' }));
      } else {
        const r = await fetch(`${BASE}/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&page=1`).then(r => r.json());
        results = (r.results || []).slice(0, 8).map(s => ({ id: s.id, type: 'series', title: s.name || s.original_name || '', poster: s.poster_path ? `${IMG}/w300${s.poster_path}` : '', rating: s.vote_average || 0, popularity: s.popularity || 0, year: (s.first_air_date || '').slice(0, 4), overview: s.overview || '' }));
      }
      const addedIds = new Set(compareEntities.map(e => String(e.id)));
      compareSearchResults = results.filter(r => !addedIds.has(String(r.id)));
    } catch(_) { compareSearchResults = []; }
    compareSearching = false;
  }

  function addToCompare(entity) {
    if (compareEntities.length >= 5) return;
    if (compareEntities.some(e => String(e.id) === String(entity.id))) return;
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
    if (score >= 85) return 'ELITE';
    if (score >= 70) return 'GREAT';
    if (score >= 55) return 'GOOD';
    if (score >= 40) return 'AVERAGE';
    return 'WEAK';
  }

  function scoreColor(score) {
    if (score >= 85) return '#5fbf8c';
    if (score >= 70) return '#c9a84c';
    if (score >= 55) return '#f0c060';
    return '#e05c7a';
  }
</script>

<svelte:head>
  <title>{sel?.title ? `${sel.title} · WatchOrder` : 'WatchOrder'}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="grain"></div>

<nav class="nav">
  <a class="nav-logo" href="/" onclick={(e) => { e.preventDefault(); goBack(); }}>
    <span class="nav-logo-mark">W</span>
    <span class="nav-logo-text">atch</span>
    <span class="nav-logo-accent">Order</span>
    <div class="nav-logo-dot"></div>
  </a>
  <button
    class="cmp-nav-btn"
    onclick={() => goto(`/app/compare?type=${encodeURIComponent(itemType)}`)}
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="3" width="4" height="8" rx="1" stroke="currentColor" stroke-width="1.3"/>
      <rect x="9" y="1" width="4" height="12" rx="1" stroke="currentColor" stroke-width="1.3"/>
      <path d="M5 7h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    </svg>
    <span>COMPARE</span>
  </button>
</nav>

{#if loading}
  <div class="loader"><div class="spinner"></div><p>LOADING GUIDE...</p></div>
{:else if error}
  <div class="error-page">
    <h2>{error === 'No guide found.' ? '404' : 'Error'}</h2>
    <p>{error}</p>
    <button class="back-button" style="margin-top:20px" onclick={goBack}>← BACK</button>
  </div>
{:else if sel}
  <main class="guide-container">
    <div class="guide-hero" style="background-image: url('{sel.bg || sel.poster || ''}')">
      <div class="guide-hero-overlay"></div>
      <div class="guide-hero-content">
        <button class="back-button" onclick={goBack}>← BACK</button>
        <div class="overtitle"><span class="bar"></span><span>{typeLabel}</span></div>
        <h1 class="guide-title">{sel.title}</h1>
        <div class="guide-meta-row">
          {#if isTV}
            <span class="guide-pill {ac ? ac + '-pill' : ''}">{sel.entries} SEASONS</span>
            <span class="guide-pill">{sel.years || ''}</span>
            <span class="guide-pill {ac ? ac + '-pill' : ''}">{sel.status || ''}</span>
          {:else if isSM}
            <span class="guide-pill">FILM</span>
            <span class="guide-pill">{sel.years || ''}</span>
            {#if sel.ratingNum > 0}<span class="guide-pill">★ {sel.rating}</span>{/if}
          {:else}
            <span class="guide-pill">{sel.entries} FILMS</span>
            <span class="guide-pill">{sel.years || ''}</span>
          {/if}
        </div>
        <p class="guide-desc">{sel.desc || ''}</p>
      </div>
    </div>

    <div class="tab-bar">
      {#if itemType === 'movies'}
        <a class="tab-btn tab-active" href="guide{qs}">WATCH ORDER</a>
        <a class="tab-btn" href="ratings{qs}">RATINGS</a>
        <a class="tab-btn" href="reviews{qs}">REVIEWS</a>
      {:else if isTV}
        <a class="tab-btn tab-active {ac ? ac + '-tab' : ''}" href="guide{qs}">WATCH ORDER</a>
        <a class="tab-btn" href="episodes{qs}">EPISODES</a>
        <a class="tab-btn" href="history{qs}">HISTORY</a>
        <a class="tab-btn" href="ratings{qs}">RATINGS</a>
        <a class="tab-btn" href="reviews{qs}">REVIEWS</a>
      {:else}
        <a class="tab-btn tab-active" href="guide{qs}">WATCH ORDER</a>
        <a class="tab-btn" href="history{qs}">HISTORY</a>
        <a class="tab-btn" href="ratings{qs}">RATINGS</a>
        <a class="tab-btn" href="reviews{qs}">REVIEWS</a>
      {/if}
    </div>

    <div class="timeline-section">
      <div class="timeline-intro">
        <div class="overtitle"><span class="bar"></span><span>{isTV ? 'SEASON ORDER' : isSM ? 'FILM DETAILS' : 'RELEASE ORDER'}</span></div>
        <p class="section-subtitle">{isTV ? 'By season.' : isSM ? 'Film info below.' : 'By release date.'}</p>
      </div>
      <div class="timeline-track">
        <div class="timeline-spine {ac ? ac + '-spine' : ''}"></div>
        {#each guideEntries as m, i}
          {@const right = i % 2 !== 0}
          {@const hasStreaming = m.streamingServices?.length > 0}
          <div class="timeline-item {right ? 'timeline-item-right' : ''}">
            <div class="timeline-dot"><span class="dot-num {ac ? ac + '-dot' : ''}">{m.order}</span></div>
            <div class="tl-card {ac ? ac + '-tl' : ''}">
              <div class="tl-card-poster">
                {#if m.posterUrl}<img src={m.posterUrl} alt="" loading="lazy" />{:else}<div style="height:160px;background:#111"></div>{/if}
              </div>
              <div class="tl-card-body">
                <div class="tl-card-year {ac ? ac + '-yr' : ''}">{m.year}</div>
                <div style="display:flex;align-items:center;flex-wrap:wrap">
                  <h3 class="tl-card-title" style="margin:8px 0">{m.title || m.name || ''}</h3>
                  {#if m.trailerKey}
                    <!-- CHANGED: now calls openVideoPlayer instead of linking to YouTube -->
                    <button
                      class="trailer-btn"
                      onclick={() => openVideoPlayer(m.trailerKey, m.title || m.name || '')}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      TRAILER
                    </button>
                  {/if}
                </div>
                <div class="tl-card-details">
                  {#if isTV && m.episode_count}<span>{m.episode_count} eps</span>{:else if m.runtime}<span>{m.runtime}</span>{/if}
                  <span>★ {m.rating}</span>
                  {#if m.director}<span>{m.director}</span>{/if}
                </div>
                <p class="tl-card-overview">{(m.overview || '').slice(0, 130)}...</p>
                {#if hasStreaming}
                  <div class="watch-buttons">
                    {#each m.streamingServices.slice(0, 4) as p}
                      <span class="watch-provider">
                        {#if p.logo_path}<img src="{IMG}/w45{p.logo_path}" alt={p.provider_name} />{/if}
                        {p.provider_name}
                      </span>
                    {/each}
                    {#if m.streamingServices.length > 4}<span class="watch-provider">+{m.streamingServices.length - 4}</span>{/if}
                  </div>
                {/if}
              </div>
              <button class="more-info-btn {ac ? ac + '-mib' : ''}" onclick={() => openMI(i)}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.2"/>
                  <line x1="6" y1="5" x2="6" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                  <circle cx="6" cy="3.5" r="0.6" fill="currentColor"/>
                </svg>
                MORE INFO
              </button>
            </div>
          </div>
        {/each}
        <div class="timeline-end">
          <div class="end-circle {ac ? ac + '-ec' : ''}">✓</div>
          <p>{isTV ? 'ALL SEASONS' : isSM ? 'END CREDITS' : 'SAGA COMPLETE'}</p>
        </div>
      </div>
    </div>
  </main>
{/if}

<!-- ═══════════════════════════════════════
     VIDEO PLAYER MODAL
═══════════════════════════════════════ -->
{#if showVideoPlayer}
  <div
    class="vp-backdrop"
    onclick={(e) => { if (e.target === e.currentTarget) closeVideoPlayer(); }}
  >
    <div class="vp-panel">
      <!-- Header -->
      <div class="vp-header">
        <div class="vp-header-left">
          <div class="vp-play-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <polygon points="3,2 12,7 3,12" fill="#c9a84c"/>
            </svg>
          </div>
          <div>
            <div class="vp-label">OFFICIAL TRAILER</div>
            <div class="vp-title">{videoTitle}</div>
          </div>
        </div>
        <div class="vp-header-actions">
          <a
            href="https://www.youtube.com/watch?v={videoTrailerKey}"
            target="_blank"
            rel="noopener noreferrer"
            class="vp-yt-btn"
            title="Open on YouTube"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.75 15.5V8.5l6.5 3.5-6.5 3.5z"/>
            </svg>
            YOUTUBE
          </a>
          <button class="vp-close" onclick={closeVideoPlayer}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Player -->
      <div class="vp-player-wrap">
        <div class="vp-aspect">
          {#if videoTrailerKey}
            <iframe
              src="https://www.youtube.com/embed/{videoTrailerKey}?autoplay=1&rel=0&modestbranding=1&color=white"
              title="{videoTitle} Trailer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
              class="vp-iframe"
            ></iframe>
          {/if}
        </div>
      </div>

      <!-- Footer hint -->
      <div class="vp-footer">
        <span class="vp-footer-hint">Press ESC to close</span>
        <span class="vp-footer-sep">·</span>
        <span class="vp-footer-hint">Powered by YouTube</span>
      </div>
    </div>
  </div>
{/if}

<!-- Compare & Info Modal (unchanged) -->
{#if showCompare}
  <div class="cmp-backdrop" onclick={(e) => { if (e.target === e.currentTarget) closeCompare(); }}>
    <div class="cmp-panel">
      <div class="cmp-header">
        <div class="cmp-header-left">
          <div class="cmp-header-icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="1" y="4" width="5" height="10" rx="1.5" stroke="#c9a84c" stroke-width="1.4"/>
              <rect x="12" y="1" width="5" height="16" rx="1.5" stroke="#c9a84c" stroke-width="1.4"/>
              <path d="M6 9h6" stroke="#c9a84c" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <h2 class="cmp-title">Compare {compareTypeLabel}</h2>
            <p class="cmp-subtitle">Add up to 5 · Ranked by rating + popularity</p>
          </div>
        </div>
        <button class="cmp-close" onclick={closeCompare}>✕</button>
      </div>

      {#if compareEntities.length < 5}
        <div class="cmp-search-row">
          <div class="cmp-search-wrap">
            <svg class="cmp-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.4"/>
              <path d="M11 11l3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            <input class="cmp-search-input" type="text" placeholder="Search {compareTypeLabel.toLowerCase()} to add..." bind:value={compareSearchQ} oninput={() => { clearTimeout(compareSearchTimer); compareSearchTimer = setTimeout(() => searchCompare(compareSearchQ), 350); }} autofocus />
            {#if compareSearching}<div class="cmp-spin"></div>{/if}
          </div>
          <div class="cmp-count-badge">{compareEntities.length}/5</div>
        </div>
        {#if compareSearchResults.length > 0}
          <div class="cmp-results">
            {#each compareSearchResults as r}
              <button class="cmp-result-item" onclick={() => addToCompare(r)}>
                <div class="cmp-result-poster">{#if r.poster}<img src={r.poster} alt="" />{:else}<div class="cmp-result-no-poster">?</div>{/if}</div>
                <div class="cmp-result-info">
                  <div class="cmp-result-title">{r.title}</div>
                  <div class="cmp-result-meta">{#if r.year}<span>{r.year}</span>{/if}{#if r.rating > 0}<span>★ {r.rating.toFixed(1)}</span>{/if}</div>
                </div>
                <div class="cmp-result-add"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>
              </button>
            {/each}
          </div>
        {/if}
      {/if}

      {#if compareEntities.length > 0}
        <div class="cmp-arena">
          {#each compareEntities as entity, i}
            {@const isWinner = compareRevealed && compareWinner?.idx === i}
            {@const isLoser = compareRevealed && compareWinner?.idx !== i}
            {@const score = compareWinner?.scores?.[i]}
            <div class="cmp-entity {isWinner ? 'cmp-winner' : ''} {isLoser ? 'cmp-loser' : ''}">
              {#if !compareRevealing && !compareRevealed}<button class="cmp-entity-remove" onclick={() => removeCompareEntity(i)}>✕</button>{/if}
              {#if isWinner}<div class="cmp-crown"><svg viewBox="0 0 24 14" fill="none" width="36" height="22"><path d="M1 13L4 4l5 5 3-8 3 8 5-5 3 9H1z" fill="#c9a84c" opacity="0.9"/><path d="M2 13h20" stroke="#c9a84c" stroke-width="1.5"/></svg></div>{/if}
              <div class="cmp-entity-poster">
                {#if entity.poster}<img src={entity.poster} alt={entity.title} />{:else}<div class="cmp-entity-no-poster"><span>{entity.title.slice(0, 2).toUpperCase()}</span></div>{/if}
                {#if compareRevealed && score !== undefined}<div class="cmp-score-badge" style="background:{scoreColor(score)}22;border-color:{scoreColor(score)}55;color:{scoreColor(score)}">{score.toFixed(0)}</div>{/if}
              </div>
              <div class="cmp-entity-info">
                <div class="cmp-entity-title">{entity.title}</div>
                {#if entity.year}<div class="cmp-entity-year">{entity.year}</div>{/if}
                <div class="cmp-entity-stats">
                  <span class="cmp-stat"><span class="cmp-stat-icon">★</span>{entity.rating > 0 ? entity.rating.toFixed(1) : '—'}</span>
                  {#if entity.popularity > 0}<span class="cmp-stat"><span class="cmp-stat-icon">◉</span>{Math.round(entity.popularity)}</span>{/if}
                </div>
                {#if compareRevealed && score !== undefined}
                  <div class="cmp-bar-wrap"><div class="cmp-bar" style="width:{Math.min((score/100)*100,100)}%;background:{scoreColor(score)}"></div></div>
                  <div class="cmp-score-label" style="color:{scoreColor(score)}">{scoreLabel(score)}</div>
                {/if}
              </div>
              {#if isWinner}<div class="cmp-winner-glow"></div>{/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if compareEntities.length === 0}
        <div class="cmp-empty">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.3"><rect x="4" y="12" width="14" height="26" rx="3" stroke="#c9a84c" stroke-width="2"/><rect x="30" y="4" width="14" height="40" rx="3" stroke="#c9a84c" stroke-width="2"/><path d="M18 24h12" stroke="#c9a84c" stroke-width="2" stroke-linecap="round"/></svg>
          <p>Search above to add {compareTypeLabel.toLowerCase()} to compare</p>
        </div>
      {/if}

      {#if compareRevealed && compareWinner}
        <div class="cmp-verdict">
          <div class="cmp-verdict-line"></div>
          <div class="cmp-verdict-inner">
            <div class="cmp-verdict-label">WINNER</div>
            <div class="cmp-verdict-title">{compareWinner.entity.title}</div>
            <div class="cmp-verdict-reasons">
              <span>★ {compareWinner.entity.rating > 0 ? compareWinner.entity.rating.toFixed(1) : '—'} rating</span>
              {#if compareWinner.entity.popularity > 0}<span class="cmp-verdict-sep">·</span><span>◉ {Math.round(compareWinner.entity.popularity)} popularity</span>{/if}
              <span class="cmp-verdict-sep">·</span>
              <span class="cmp-verdict-score">{compareWinner.score.toFixed(0)} pts</span>
            </div>
          </div>
          <div class="cmp-verdict-line"></div>
        </div>
      {/if}

      {#if compareRevealing}
        <div class="cmp-revealing">
          <div class="cmp-reveal-bars">{#each [0,1,2,3,4,5,6,7] as b}<div class="cmp-reveal-bar" style="animation-delay:{b*0.08}s"></div>{/each}</div>
          <div class="cmp-revealing-label">CALCULATING WINNER...</div>
        </div>
      {/if}

      <div class="cmp-footer">
        {#if !compareRevealing && !compareRevealed && compareEntities.length >= 2}
          <button class="cmp-run-btn" onclick={runComparison}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>DECLARE A WINNER</button>
        {:else if compareRevealed}
          <button class="cmp-reset-btn" onclick={() => { compareWinner = null; compareRevealed = false; compareRevealing = false; }}>↺ COMPARE AGAIN</button>
        {:else if compareEntities.length < 2}
          <div class="cmp-footer-hint">Add at least 2 {compareTypeLabel.toLowerCase()} to compare</div>
        {/if}
        <button class="cmp-cancel-btn" onclick={closeCompare}>CLOSE</button>
      </div>
    </div>
  </div>
{/if}

{#if showModal && modalEntry}
  {@const m = modalEntry}
  {@const isTVModal = sel?.type !== 'franchises' && sel?.type !== 'movies'}
  {@const rC = m.ratingNum >= 7.5 ? '#5fbf8c' : m.ratingNum >= 5.5 ? '#c9a84c' : m.ratingNum > 0 ? '#e74c3c' : 'rgba(240,236,228,0.3)'}
  {@const rP = m.ratingNum >= 7.5 ? 'green' : m.ratingNum >= 5.5 ? 'gold' : m.ratingNum > 0 ? 'red' : ''}
  {@const mx = Math.max(m.budget || 0, m.revenue || 0, 1)}
  {@const crew = [m.director && { name: m.director, role: 'Director' }, m.writer && { name: m.writer, role: 'Writer' }, m.producer && { name: m.producer, role: 'Producer' }, m.dop && { name: m.dop, role: 'Cinematography' }, m.composer && { name: m.composer, role: 'Music' }].filter(Boolean)}
  {@const avCls = ac ? ac + '-av' : ''}
  {@const mstCls = ac ? ac + '-mst' : ''}

  <div class="modal-backdrop" class:closing={!showModal} onclick={(e) => { if (e.target === e.currentTarget) closeMI(); }}>
    <div class="modal-panel {ac ? ac + '-modal' : ''}" class:closing={!showModal}>
      <div class="modal-hero">
        <div class="modal-hero-bg" style="background-image: url('{m.backdropUrl || m.posterUrl || ''}')"></div>
        <div class="modal-hero-gradient"></div>
        <div class="modal-order-badge {ac ? ac + '-badge' : ''}">{isTVModal ? 'SEASON' : 'ENTRY'} #{m.order}</div>
        <button class="modal-close" onclick={closeMI}>✕</button>
        <div class="modal-hero-poster-wrap">
          {#if m.posterUrl}<img src={m.posterUrl} alt="" />{:else}<div style="height:100%;background:#1a1a1a"></div>{/if}
        </div>
      </div>
      <div class="modal-body">
        <h2 class="modal-title">{m.title || m.name || ''}</h2>
        {#if m.tagline}<div class="modal-tagline">"{m.tagline}"</div>{/if}
        <div class="modal-pills">
          {#if m.year}<span class="modal-pill">{m.year}</span>{/if}
          {#if m.runtime}<span class="modal-pill">{m.runtime}</span>{/if}
          {#if m.ratingNum > 0}<span class="modal-pill {rP}">★ {m.rating} / 10</span>{/if}
          {#if m.voteCount}<span class="modal-pill">{m.voteCount.toLocaleString()} votes</span>{/if}
          {#if isTVModal && m.episode_count}<span class="modal-pill">{m.episode_count} eps</span>{/if}
        </div>
        <div class="modal-score-row">
          <div class="modal-score"><div class="modal-score-value" style="color: {rC}">{m.ratingNum > 0 ? m.rating : '—'}</div><div class="modal-score-label">RATING</div></div>
          <div class="modal-score-divider"></div>
          <div class="modal-score"><div class="modal-score-value" style="color: rgba(240,236,228,0.6)">{m.voteCount > 0 ? m.voteCount.toLocaleString() : '—'}</div><div class="modal-score-label">VOTES</div></div>
          <div class="modal-score-divider"></div>
          <div class="modal-score"><div class="modal-score-value" style="color: {acC}; font-size: 1.8rem">{m.popularity > 0 ? Math.round(m.popularity) : '—'}</div><div class="modal-score-label">POPULARITY</div></div>
          {#if !isTVModal && m.revenue > 0}<div class="modal-score-divider"></div><div class="modal-score"><div class="modal-score-value" style="color: #5fbf8c; font-size: 1.6rem">{fmtMoney(m.revenue)}</div><div class="modal-score-label">GROSS</div></div>{/if}
        </div>
        <div class="modal-section">
          <div class="modal-section-title {mstCls}">SYNOPSIS</div>
          <p class="modal-overview">{m.overview || 'No synopsis.'}</p>
        </div>
        {#if m.genres?.length}
          <div class="modal-section">
            <div class="modal-section-title {mstCls}">GENRES</div>
            <div class="modal-genre-tags">{#each m.genres as g}<span class="genre-tag">{g.name}</span>{/each}</div>
          </div>
        {/if}
        <div class="modal-section">
          <div class="modal-section-title {mstCls}">DETAILS</div>
          <div class="modal-grid">
            {#if !isTVModal && m.release_date}<div class="modal-data-cell"><div class="modal-data-label">RELEASE</div><div class="modal-data-value">{m.release_date}</div></div>{/if}
            {#if isTVModal && m.air_date}<div class="modal-data-cell"><div class="modal-data-label">AIR DATE</div><div class="modal-data-value">{m.air_date}</div></div>{/if}
            {#if m.runtime}<div class="modal-data-cell"><div class="modal-data-label">RUNTIME</div><div class="modal-data-value">{m.runtime}</div></div>{/if}
            {#if m.status}<div class="modal-data-cell"><div class="modal-data-label">STATUS</div><div class="modal-data-value">{m.status}</div></div>{/if}
          </div>
        </div>
        {#if m.networks?.length}
          <div class="modal-section">
            <div class="modal-section-title {mstCls}">NETWORKS</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              {#each m.networks as n}<div class="network-tag">{#if n.logo_path}<img src="{IMG}/w45{n.logo_path}" alt="" />{/if}{n.name}</div>{/each}
            </div>
          </div>
        {/if}
        {#if crew.length}
          <div class="modal-section">
            <div class="modal-section-title {mstCls}">KEY CREW</div>
            <div class="modal-people-grid">
              {#each crew as p}
                <div class="modal-person"><div class="modal-person-avatar {avCls}">{initials(p.name)}</div><div><div class="modal-person-name">{p.name}</div><div class="modal-person-role">{p.role}</div></div></div>
              {/each}
            </div>
          </div>
        {/if}
        {#if m.cast?.length}
          <div class="modal-section">
            <div class="modal-section-title {mstCls}">CAST</div>
            <div class="modal-cast-strip">
              {#each m.cast as c}
                <div class="cast-chip"><img class="cast-chip-poster" src={c.profile_path ? `${IMG}/w185${c.profile_path}` : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect fill="%23222" width="1" height="1"/></svg>'} onerror={(e) => e.target.style.background = '#222'} alt="" /><div class="cast-chip-name">{c.name}</div><div class="cast-chip-char">{(c.character || '').slice(0, 22)}</div></div>
              {/each}
            </div>
          </div>
        {/if}
        {#if !isTVModal && (m.budget > 0 || m.revenue > 0)}
          <div class="modal-section">
            <div class="modal-section-title {mstCls}">BOX OFFICE</div>
            <div class="modal-revenue-bars">
              <div class="rev-bar-row"><span class="rev-bar-label">BUDGET</span><div class="rev-bar-track"><div class="rev-bar-fill" style="width: {m.budget ? Math.max((m.budget / mx) * 100, 4) : 0}%; background: #c9a84c"></div></div><span class="rev-bar-val">{fmtMoney(m.budget)}</span></div>
              <div class="rev-bar-row"><span class="rev-bar-label">REVENUE</span><div class="rev-bar-track"><div class="rev-bar-fill" style="width: {m.revenue ? Math.max((m.revenue / mx) * 100, 4) : 0}%; background: {m.revenue > m.budget ? '#5fbf8c' : '#e74c3c'}"></div></div><span class="rev-bar-val">{fmtMoney(m.revenue)}</span></div>
            </div>
          </div>
        {/if}
        {#if m.streamingServices?.length}
          <div class="modal-section">
            <div class="modal-section-title {mstCls}">WHERE TO WATCH</div>
            <div class="modal-streaming">
              {#each m.streamingServices as p}<div class="streaming-chip">{#if p.logo_path}<img src="{IMG}/w45{p.logo_path}" alt="" />{/if}<span class="streaming-chip-name">{p.provider_name}</span></div>{/each}
            </div>
          </div>
        {/if}
        {#if m.trailerKey}
          <div class="modal-section">
            <div class="modal-section-title {mstCls}">TRAILER</div>
            <!-- CHANGED: also uses openVideoPlayer in the info modal -->
            <button
              onclick={() => { closeMI(); setTimeout(() => openVideoPlayer(m.trailerKey, m.title || m.name || ''), 300); }}
              class="modal-trailer-link"
            >
              <div class="modal-play-icon"><svg width="10" height="12" viewBox="0 0 10 12" fill="none"><path d="M1 1l8 5-8 5V1z" fill={acC}/></svg></div>
              WATCH TRAILER
            </button>
          </div>
        {/if}
        {#if !isTVModal && m.imdb_id}
          <div class="modal-section">
            <div class="modal-section-title {mstCls}">EXTERNAL</div>
            <a href="https://www.imdb.com/title/{m.imdb_id}" target="_blank" style="display:inline-flex;align-items:center;gap:8px;background:rgba(245,197,24,0.12);border:1px solid rgba(245,197,24,0.3);border-radius:3px;padding:8px 16px;font-family:'Space Mono';font-size:0.6rem;color:#f5c518;text-decoration:none;">IMDb ↗</a>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  :global(*) { margin: 0; padding: 0; box-sizing: border-box; }
  :global(body) { background: #050505; color: #f0ece4; font-family: "Sora", sans-serif; overflow-x: hidden; }

  .grain { position: fixed; inset: 0; z-index: 999; pointer-events: none; opacity: 0.04; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }

  .nav { position: fixed; top: 0; width: 100%; padding: 16px 50px; display: flex; justify-content: space-between; align-items: center; z-index: 500; box-sizing: border-box; background: rgba(5,5,5,0.95); backdrop-filter: blur(16px); border-bottom: 1px solid rgba(255,255,255,0.07); }
  .nav-logo { display: flex; align-items: baseline; gap: 0; text-decoration: none; }
  .nav-logo-mark { font-family: "Cormorant Garamond"; font-size: 2.2rem; color: #c9a84c; font-weight: 700; line-height: 1; }
  .nav-logo-text { font-family: "Cormorant Garamond"; font-size: 1.6rem; font-weight: 300; color: #f0ece4; }
  .nav-logo-accent { font-family: "Cormorant Garamond"; font-style: italic; font-size: 1.6rem; font-weight: 600; opacity: 0.85; color: #f0ece4; }
  .nav-logo-dot { width: 5px; height: 5px; background: #c9a84c; border-radius: 50%; margin-left: 5px; box-shadow: 0 0 8px #c9a84c; }

  .compare-trigger-btn { display: inline-flex; align-items: center; gap: 8px; font-family: "Space Mono"; font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase; color: #c9a84c; background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.35); padding: 9px 18px; cursor: pointer; transition: all 0.25s ease; border-radius: 2px; clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); }
  .compare-trigger-btn:hover { background: rgba(201,168,76,0.18); border-color: #c9a84c; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(201,168,76,0.18); }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner { width: 36px; height: 36px; border: 2px solid rgba(201,168,76,0.1); border-top-color: #c9a84c; border-radius: 50%; animation: spin 0.9s linear infinite; }
  .loader { min-height: 80vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; color: #c9a84c; font-family: "Space Mono"; font-size: 0.78rem; }
  .error-page { min-height: 80vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; text-align: center; }
  .error-page h2 { font-family: "Cormorant Garamond"; font-size: 3rem; opacity: 0.4; }
  .error-page p { font-family: "Space Mono"; font-size: 0.72rem; opacity: 0.3; }

  .guide-container { padding-top: 80px; }
  .guide-hero { height: 65vh; background-size: cover; background-position: center; position: relative; display: flex; align-items: flex-end; }
  .guide-hero-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(5,5,5,0.15) 0%, rgba(5,5,5,0.65) 55%, rgba(5,5,5,1) 100%); }
  .guide-hero-content { position: relative; z-index: 2; padding: 0 70px 64px; max-width: 900px; }
  .guide-title { font-family: "Cormorant Garamond"; font-size: clamp(3rem,6vw,5rem); font-weight: 700; line-height: 1; margin: 16px 0 20px; }
  .guide-meta-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
  .guide-pill { font-family: "Space Mono"; font-size: 0.6rem; letter-spacing: 0.12em; border: 1px solid rgba(255,255,255,0.18); padding: 5px 12px; border-radius: 2px; color: rgba(240,236,228,0.65); }
  .guide-pill.anime-pill { border-color: rgba(224,92,122,0.4); color: #e05c7a; }
  .guide-pill.series-pill { border-color: rgba(95,191,140,0.4); color: #5fbf8c; }
  .guide-desc { font-size: 0.95rem; opacity: 0.5; line-height: 1.7; max-width: 680px; }
  .back-button { display: inline-flex; align-items: center; gap: 8px; background: rgba(20,20,20,0.8); border: 1px solid rgba(201,168,76,0.3); border-radius: 40px; padding: 8px 20px; font-family: "Space Mono"; font-size: 0.7rem; color: #c9a84c; cursor: pointer; transition: 0.25s; margin-bottom: 20px; text-decoration: none; outline: none; }
  .back-button:hover { border-color: #c9a84c; background: rgba(30,30,30,0.9); }
  .overtitle { display: flex; align-items: center; gap: 14px; font-family: "Space Mono"; font-size: 0.68rem; letter-spacing: 0.2em; color: #c9a84c; margin-bottom: 20px; }
  .overtitle .bar { width: 36px; height: 1px; background: #c9a84c; }
  .tab-bar { display: flex; border-bottom: 1px solid rgba(255,255,255,0.07); padding: 0 70px; position: sticky; top: 64px; background: rgba(5,5,5,0.96); backdrop-filter: blur(12px); z-index: 50; flex-wrap: wrap; }
  .tab-btn { display: inline-flex; align-items: center; color: rgba(240,236,228,0.35); font-family: "Space Mono"; font-size: 0.68rem; letter-spacing: 0.12em; padding: 20px 24px; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: 0.22s; text-decoration: none; }
  .tab-btn:hover { color: rgba(240,236,228,0.6); }
  .tab-active { color: #c9a84c !important; border-bottom-color: #c9a84c !important; }
  .tab-active.anime-tab { color: #e05c7a !important; border-bottom-color: #e05c7a !important; }
  .tab-active.series-tab { color: #5fbf8c !important; border-bottom-color: #5fbf8c !important; }
  .timeline-section { padding: 70px 70px 120px; }
  .timeline-intro { margin-bottom: 56px; }
  .section-subtitle { opacity: 0.5; font-size: 0.9rem; margin-top: 12px; }
  .timeline-track { position: relative; }
  .timeline-spine { position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: linear-gradient(to bottom, transparent, rgba(201,168,76,0.35), rgba(201,168,76,0.12), transparent); transform: translateX(-50%); }
  .anime-spine { background: linear-gradient(to bottom, transparent, rgba(224,92,122,0.35), rgba(224,92,122,0.12), transparent) !important; }
  .series-spine { background: linear-gradient(to bottom, transparent, rgba(95,191,140,0.35), rgba(95,191,140,0.12), transparent) !important; }
  .timeline-item { display: grid; grid-template-columns: 1fr 64px 1fr; align-items: start; margin-bottom: 56px; }
  .timeline-dot { grid-column: 2; display: flex; justify-content: center; padding-top: 24px; }
  .dot-num { width: 44px; height: 44px; border-radius: 50%; border: 1px solid rgba(201,168,76,0.4); background: #0a0a0a; display: flex; align-items: center; justify-content: center; font-family: "Space Mono"; font-size: 0.65rem; color: #c9a84c; }
  .anime-dot { border-color: rgba(224,92,122,0.4) !important; color: #e05c7a !important; }
  .series-dot { border-color: rgba(95,191,140,0.4) !important; color: #5fbf8c !important; }
  .tl-card { background: #0d0d0d; border: 1px solid rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; transition: 0.3s; position: relative; }
  .tl-card:hover { border-color: rgba(201,168,76,0.25); }
  .anime-tl:hover { border-color: rgba(224,92,122,0.25) !important; }
  .series-tl:hover { border-color: rgba(95,191,140,0.25) !important; }
  .timeline-item .tl-card { grid-column: 1; margin-right: 28px; }
  .timeline-item-right .tl-card { grid-column: 3; margin-left: 28px; margin-right: 0; }
  .tl-card-poster { aspect-ratio: 2/3; max-height: 220px; overflow: hidden; background: #111; }
  .tl-card-poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .tl-card-body { padding: 20px 22px 64px; }
  .tl-card-year { font-family: "Space Mono"; font-size: 0.58rem; color: #c9a84c; }
  .anime-yr { color: #e05c7a !important; }
  .series-yr { color: #5fbf8c !important; }
  .tl-card-title { font-family: "Cormorant Garamond"; font-size: 1.25rem; font-weight: 600; margin: 8px 0; }
  .tl-card-details { display: flex; gap: 14px; font-size: 0.62rem; color: rgba(240,236,228,0.45); margin-bottom: 8px; flex-wrap: wrap; }
  .tl-card-overview { opacity: 0.5; font-size: 0.78rem; line-height: 1.55; }
  .more-info-btn { position: absolute; bottom: 18px; right: 18px; display: inline-flex; align-items: center; gap: 7px; background: linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05)); border: 1px solid rgba(201,168,76,0.45); border-radius: 3px; padding: 8px 14px; font-family: "Space Mono"; font-size: 0.6rem; letter-spacing: 0.1em; color: #c9a84c; cursor: pointer; transition: all 0.22s ease; z-index: 10; backdrop-filter: blur(4px); white-space: nowrap; }
  .more-info-btn:hover { background: rgba(201,168,76,0.22); border-color: #c9a84c; color: #f0ece4; transform: translateY(-1px); }
  .anime-mib { background: linear-gradient(135deg, rgba(224,92,122,0.15), rgba(224,92,122,0.05)) !important; border-color: rgba(224,92,122,0.45) !important; color: #e05c7a !important; }
  .anime-mib:hover { background: rgba(224,92,122,0.22) !important; border-color: #e05c7a !important; color: #f0ece4 !important; }
  .series-mib { background: linear-gradient(135deg, rgba(95,191,140,0.15), rgba(95,191,140,0.05)) !important; border-color: rgba(95,191,140,0.45) !important; color: #5fbf8c !important; }
  .series-mib:hover { background: rgba(95,191,140,0.22) !important; border-color: #5fbf8c !important; color: #f0ece4 !important; }
  .trailer-btn { display: inline-flex; align-items: center; gap: 6px; background: rgba(201,168,76,0.1); border: 1px solid rgba(201,168,76,0.3); border-radius: 20px; padding: 4px 12px; font-family: "Space Mono"; font-size: 0.6rem; color: #c9a84c; cursor: pointer; margin-left: 12px; transition: 0.2s; }
  .trailer-btn:hover { background: rgba(201,168,76,0.22); border-color: #c9a84c; transform: translateY(-1px); }
  .watch-buttons { display: flex; align-items: center; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
  .watch-provider { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 4px 10px; font-family: "Space Mono"; font-size: 0.55rem; color: rgba(240,236,228,0.7); }
  .watch-provider img { width: 16px; height: 16px; border-radius: 3px; }
  .timeline-end { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px 0; color: rgba(201,168,76,0.5); font-family: "Space Mono"; font-size: 0.65rem; letter-spacing: 0.14em; }
  .end-circle { width: 48px; height: 48px; border-radius: 50%; border: 1px solid rgba(201,168,76,0.35); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
  .anime-ec { border-color: rgba(224,92,122,0.35) !important; }
  .series-ec { border-color: rgba(95,191,140,0.35) !important; }

  /* ════════════════════════════════════════
     VIDEO PLAYER STYLES
  ════════════════════════════════════════ */
  .vp-backdrop {
    position: fixed; inset: 0; z-index: 10000;
    background: rgba(0, 0, 0, 0.92);
    backdrop-filter: blur(16px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    animation: vpFadeIn 0.25s ease;
  }
  @keyframes vpFadeIn { from { opacity: 0; } to { opacity: 1; } }

  .vp-panel {
    width: 100%; max-width: 900px;
    background: #080808;
    border: 1px solid rgba(201, 168, 76, 0.2);
    display: flex; flex-direction: column;
    overflow: hidden;
    animation: vpSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(201, 168, 76, 0.06);
  }
  @keyframes vpSlideUp { from { opacity: 0; transform: scale(0.96) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }

  .vp-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: #0e0c0c;
    flex-shrink: 0;
  }
   .cmp-nav-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: "Space Mono";
    font-size: 0.6rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #c9a84c;
    background: rgba(201, 168, 76, 0.08);
    border: 1px solid rgba(201, 168, 76, 0.35);
    padding: 9px 18px;
    cursor: pointer;
    transition: background 0.25s, border-color 0.25s, transform 0.2s, box-shadow 0.25s;
    clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
  }
  .cmp-nav-btn:hover {
    background: rgba(201, 168, 76, 0.18);
    border-color: #c9a84c;
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(201, 168, 76, 0.18);
  }
  /* On mobile: hide the text label, keep icon only */
  @media (max-width: 768px) {
    .cmp-nav-btn span { display: none; }
  }
  .vp-header-left { display: flex; align-items: center; gap: 14px; }
  .vp-play-icon {
    width: 36px; height: 36px; flex-shrink: 0;
    background: rgba(201, 168, 76, 0.1);
    border: 1px solid rgba(201, 168, 76, 0.3);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
  }
  .vp-label { font-family: "Space Mono"; font-size: 0.5rem; letter-spacing: 0.2em; color: rgba(201, 168, 76, 0.6); text-transform: uppercase; margin-bottom: 3px; }
  .vp-title { font-family: "Cormorant Garamond"; font-size: 1.15rem; font-weight: 600; color: #f0ece4; letter-spacing: -0.01em; max-width: 500px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .vp-header-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .vp-yt-btn {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(255, 0, 0, 0.1);
    border: 1px solid rgba(255, 0, 0, 0.25);
    border-radius: 3px;
    padding: 7px 14px;
    font-family: "Space Mono"; font-size: 0.55rem; letter-spacing: 0.1em;
    color: rgba(255, 100, 100, 0.8);
    text-decoration: none;
    transition: all 0.2s ease;
  }
  .vp-yt-btn:hover { background: rgba(255, 0, 0, 0.18); border-color: rgba(255, 0, 0, 0.45); color: #ff6464; }
  .vp-close {
    width: 34px; height: 34px; border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(5, 5, 5, 0.8);
    color: rgba(240, 236, 228, 0.5);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all 0.2s;
  }
  .vp-close:hover { border-color: rgba(201, 168, 76, 0.5); color: #c9a84c; background: rgba(201, 168, 76, 0.08); }

  .vp-player-wrap { flex-shrink: 0; background: #000; }
  .vp-aspect {
    position: relative;
    width: 100%;
    padding-bottom: 56.25%; /* 16:9 */
    background: #000;
  }
  .vp-iframe {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    border: none;
    display: block;
  }

  .vp-footer {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    padding: 10px 24px;
    background: #0a0808;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    flex-shrink: 0;
  }
  .vp-footer-hint { font-family: "Space Mono"; font-size: 0.5rem; letter-spacing: 0.12em; color: rgba(240, 236, 228, 0.2); }
  .vp-footer-sep { color: rgba(201, 168, 76, 0.2); font-size: 0.6rem; }

  /* Compare styles */
  .cmp-backdrop { position: fixed; inset: 0; z-index: 8000; background: rgba(0,0,0,0.85); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; padding: 20px; animation: cmpBackdropIn 0.3s ease; }
  @keyframes cmpBackdropIn { from { opacity: 0; } to { opacity: 1; } }
  .cmp-panel { width: 100%; max-width: 920px; max-height: 90vh; background: #080808; border: 1px solid rgba(201,168,76,0.2); display: flex; flex-direction: column; overflow: hidden; animation: cmpPanelIn 0.4s cubic-bezier(0.16,1,0.3,1); position: relative; }
  @keyframes cmpPanelIn { from { opacity: 0; transform: scale(0.95) translateY(24px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .cmp-header { display: flex; align-items: center; justify-content: space-between; padding: 24px 32px; border-bottom: 1px solid rgba(255,255,255,0.06); background: #0e0c0c; flex-shrink: 0; }
  .cmp-header-left { display: flex; align-items: center; gap: 16px; }
  .cmp-header-icon { width: 44px; height: 44px; border: 1px solid rgba(201,168,76,0.3); display: flex; align-items: center; justify-content: center; background: rgba(201,168,76,0.06); flex-shrink: 0; }
  .cmp-title { font-family: "Cormorant Garamond"; font-size: 1.5rem; font-weight: 700; color: #f0ece4; letter-spacing: -0.02em; }
  .cmp-subtitle { font-family: "Space Mono"; font-size: 0.52rem; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(240,236,228,0.3); margin-top: 4px; }
  .cmp-close { width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.15); background: rgba(5,5,5,0.7); color: rgba(240,236,228,0.6); font-size: 1rem; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; flex-shrink: 0; }
  .cmp-close:hover { border-color: #c9a84c; color: #c9a84c; }
  .cmp-search-row { display: flex; align-items: center; gap: 12px; padding: 16px 32px; border-bottom: 1px solid rgba(255,255,255,0.04); flex-shrink: 0; background: #0a0808; }
  .cmp-search-wrap { display: flex; align-items: center; flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); padding: 10px 16px; gap: 10px; transition: border-color 0.2s; }
  .cmp-search-wrap:focus-within { border-color: rgba(201,168,76,0.5); }
  .cmp-search-icon { color: rgba(240,236,228,0.25); flex-shrink: 0; }
  .cmp-search-input { flex: 1; background: transparent; border: none; outline: none; font-family: "Sora"; font-size: 0.9rem; font-weight: 300; color: #f0ece4; }
  .cmp-search-input::placeholder { color: rgba(240,236,228,0.2); }
  .cmp-spin { width: 16px; height: 16px; border: 1.5px solid rgba(201,168,76,0.2); border-top-color: #c9a84c; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
  .cmp-count-badge { font-family: "Space Mono"; font-size: 0.58rem; letter-spacing: 0.14em; color: rgba(201,168,76,0.6); border: 1px solid rgba(201,168,76,0.2); padding: 6px 12px; background: rgba(201,168,76,0.06); white-space: nowrap; flex-shrink: 0; }
  .cmp-results { overflow-y: auto; max-height: 220px; border-bottom: 1px solid rgba(255,255,255,0.04); flex-shrink: 0; }
  .cmp-results::-webkit-scrollbar { width: 3px; }
  .cmp-results::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.2); }
  .cmp-result-item { display: flex; align-items: center; gap: 14px; width: 100%; padding: 10px 32px; background: transparent; border: none; cursor: pointer; transition: background 0.15s; }
  .cmp-result-item:hover { background: rgba(255,255,255,0.04); }
  .cmp-result-poster { width: 36px; height: 54px; overflow: hidden; background: #1a1a1a; flex-shrink: 0; }
  .cmp-result-poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cmp-result-no-poster { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-family: "Space Mono"; font-size: 0.6rem; color: rgba(240,236,228,0.2); }
  .cmp-result-info { flex: 1; text-align: left; min-width: 0; }
  .cmp-result-title { font-family: "Cormorant Garamond"; font-size: 1rem; font-weight: 600; color: #f0ece4; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cmp-result-meta { display: flex; gap: 12px; margin-top: 3px; font-family: "Space Mono"; font-size: 0.52rem; color: rgba(240,236,228,0.3); }
  .cmp-result-add { width: 28px; height: 28px; border: 1px solid rgba(201,168,76,0.3); display: flex; align-items: center; justify-content: center; color: #c9a84c; flex-shrink: 0; transition: 0.2s; }
  .cmp-result-item:hover .cmp-result-add { background: rgba(201,168,76,0.15); border-color: #c9a84c; }
  .cmp-arena { display: flex; gap: 0; flex: 1; overflow: auto; min-height: 0; align-items: stretch; }
  .cmp-arena::-webkit-scrollbar { width: 3px; height: 3px; }
  .cmp-arena::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.2); }
  .cmp-entity { flex: 1; min-width: 140px; max-width: 220px; display: flex; flex-direction: column; border-right: 1px solid rgba(255,255,255,0.04); padding: 24px 16px 20px; position: relative; overflow: hidden; transition: background 0.4s; }
  .cmp-entity:last-child { border-right: none; }
  .cmp-entity.cmp-winner { background: rgba(201,168,76,0.05); border-right-color: rgba(201,168,76,0.15); }
  .cmp-entity.cmp-loser { opacity: 0.45; }
  .cmp-entity-remove { position: absolute; top: 8px; right: 8px; width: 22px; height: 22px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.12); background: rgba(5,5,5,0.8); color: rgba(240,236,228,0.35); font-size: 0.7rem; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; z-index: 5; }
  .cmp-entity-remove:hover { border-color: #e74c3c; color: #e74c3c; }
  .cmp-crown { display: flex; justify-content: center; margin-bottom: 6px; animation: crownDrop 0.5s cubic-bezier(0.16,1,0.3,1); }
  @keyframes crownDrop { from { opacity: 0; transform: translateY(-16px) scale(0.7); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .cmp-entity-poster { position: relative; aspect-ratio: 2/3; width: 100%; overflow: hidden; background: #111; margin-bottom: 14px; border: 1px solid rgba(255,255,255,0.06); transition: border-color 0.4s; }
  .cmp-entity.cmp-winner .cmp-entity-poster { border-color: rgba(201,168,76,0.4); }
  .cmp-entity-poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cmp-entity-no-poster { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #1a1a1a; }
  .cmp-entity-no-poster span { font-family: "Cormorant Garamond"; font-size: 2rem; font-weight: 700; color: rgba(201,168,76,0.3); }
  .cmp-score-badge { position: absolute; bottom: 8px; right: 8px; font-family: "Space Mono"; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.08em; padding: 4px 8px; border: 1px solid; border-radius: 2px; animation: scorePop 0.4s cubic-bezier(0.16,1,0.3,1); }
  @keyframes scorePop { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
  .cmp-entity-title { font-family: "Cormorant Garamond"; font-size: 1rem; font-weight: 600; color: #f0ece4; letter-spacing: -0.01em; line-height: 1.2; margin-bottom: 4px; }
  .cmp-entity-year { font-family: "Space Mono"; font-size: 0.5rem; letter-spacing: 0.12em; color: rgba(240,236,228,0.3); margin-bottom: 10px; }
  .cmp-entity-stats { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .cmp-stat { font-family: "Space Mono"; font-size: 0.58rem; letter-spacing: 0.08em; color: rgba(240,236,228,0.5); display: flex; align-items: center; gap: 6px; }
  .cmp-stat-icon { color: #c9a84c; font-size: 0.5rem; }
  .cmp-bar-wrap { height: 3px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; margin-top: 12px; margin-bottom: 6px; }
  .cmp-bar { height: 100%; border-radius: 2px; transition: width 0.8s cubic-bezier(0.16,1,0.3,1); animation: barGrow 0.8s cubic-bezier(0.16,1,0.3,1); }
  @keyframes barGrow { from { width: 0% !important; } }
  .cmp-score-label { font-family: "Space Mono"; font-size: 0.5rem; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700; }
  .cmp-winner-glow { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 100%, rgba(201,168,76,0.12) 0%, transparent 60%); animation: glowPulse 2s ease-in-out infinite; }
  @keyframes glowPulse { 0%,100%{opacity:0.6}50%{opacity:1} }
  .cmp-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 60px 32px; }
  .cmp-empty p { font-family: "Space Mono"; font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(240,236,228,0.2); text-align: center; }
  .cmp-verdict { padding: 24px 32px; border-top: 1px solid rgba(201,168,76,0.15); background: rgba(201,168,76,0.04); display: flex; align-items: center; gap: 20px; animation: verdictIn 0.5s cubic-bezier(0.16,1,0.3,1); flex-shrink: 0; }
  @keyframes verdictIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .cmp-verdict-line { flex: 1; height: 1px; background: rgba(201,168,76,0.2); }
  .cmp-verdict-inner { text-align: center; flex-shrink: 0; }
  .cmp-verdict-label { font-family: "Space Mono"; font-size: 0.52rem; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(201,168,76,0.7); margin-bottom: 6px; }
  .cmp-verdict-title { font-family: "Cormorant Garamond"; font-size: 1.6rem; font-weight: 700; color: #c9a84c; letter-spacing: -0.02em; }
  .cmp-verdict-reasons { display: flex; align-items: center; gap: 8px; justify-content: center; margin-top: 6px; font-family: "Space Mono"; font-size: 0.52rem; color: rgba(240,236,228,0.35); }
  .cmp-verdict-sep { color: rgba(201,168,76,0.4); }
  .cmp-verdict-score { color: #c9a84c; font-weight: 700; }
  .cmp-revealing { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 32px; border-top: 1px solid rgba(255,255,255,0.04); flex-shrink: 0; }
  .cmp-reveal-bars { display: flex; align-items: flex-end; gap: 4px; height: 32px; }
  .cmp-reveal-bar { width: 4px; background: #c9a84c; border-radius: 2px; animation: barDance 0.7s ease-in-out infinite alternate; }
  @keyframes barDance { from { height: 6px; opacity: 0.3; } to { height: 32px; opacity: 1; } }
  .cmp-revealing-label { font-family: "Space Mono"; font-size: 0.58rem; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(201,168,76,0.7); }
  .cmp-footer { display: flex; align-items: center; justify-content: space-between; padding: 16px 32px; border-top: 1px solid rgba(255,255,255,0.06); background: #0e0c0c; flex-shrink: 0; gap: 12px; }
  .cmp-footer-hint { font-family: "Space Mono"; font-size: 0.56rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(240,236,228,0.2); }
  .cmp-run-btn { display: inline-flex; align-items: center; gap: 10px; background: #c9a84c; color: #050505; font-family: "Space Mono"; font-size: 0.62rem; letter-spacing: 0.16em; text-transform: uppercase; padding: 12px 24px; cursor: pointer; border: none; clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px)); transition: background 0.2s, transform 0.2s; font-weight: 700; }
  .cmp-run-btn:hover { background: #f0c060; transform: translateY(-1px); }
  .cmp-reset-btn { display: inline-flex; align-items: center; gap: 8px; background: rgba(201,168,76,0.1); border: 1px solid rgba(201,168,76,0.3); color: #c9a84c; font-family: "Space Mono"; font-size: 0.58rem; letter-spacing: 0.14em; text-transform: uppercase; padding: 10px 20px; cursor: pointer; transition: 0.2s; }
  .cmp-reset-btn:hover { background: rgba(201,168,76,0.18); border-color: #c9a84c; }
  .cmp-cancel-btn { background: transparent; border: 1px solid rgba(255,255,255,0.08); color: rgba(240,236,228,0.3); font-family: "Space Mono"; font-size: 0.58rem; letter-spacing: 0.14em; text-transform: uppercase; padding: 10px 18px; cursor: pointer; transition: 0.2s; margin-left: auto; }
  .cmp-cancel-btn:hover { border-color: rgba(255,255,255,0.2); color: rgba(240,236,228,0.6); }

  /* Modal styles */
  .modal-backdrop { position: fixed; inset: 0; z-index: 9000; background: rgba(0,0,0,0.88); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 20px; animation: backdropIn 0.3s ease; }
  .modal-backdrop.closing { animation: backdropOut 0.25s ease forwards; }
  @keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes backdropOut { from { opacity: 1; } to { opacity: 0; } }
  .modal-panel { position: relative; width: 100%; max-width: 960px; max-height: 90vh; background: #0a0a0a; border: 1px solid rgba(201,168,76,0.2); border-radius: 4px; overflow: hidden; display: flex; flex-direction: column; animation: modalIn 0.35s cubic-bezier(0.16,1,0.3,1); }
  .modal-panel.closing { animation: modalOut 0.25s ease forwards; }
  .anime-modal { border-color: rgba(224,92,122,0.2) !important; }
  .series-modal { border-color: rgba(95,191,140,0.2) !important; }
  @keyframes modalIn { from { opacity: 0; transform: scale(0.94) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  @keyframes modalOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.96); } }
  .modal-hero { position: relative; height: 260px; flex-shrink: 0; overflow: hidden; }
  .modal-hero-bg { position: absolute; inset: 0; background-size: cover; background-position: center 20%; filter: brightness(0.45); transform: scale(1.05); }
  .modal-hero-gradient { position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 30%, #0a0a0a 100%); }
  .modal-close { position: absolute; top: 16px; right: 16px; width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); background: rgba(5,5,5,0.7); color: rgba(240,236,228,0.7); font-size: 1.1rem; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; z-index: 10; backdrop-filter: blur(4px); line-height: 1; }
  .modal-close:hover { border-color: #c9a84c; color: #c9a84c; }
  .modal-order-badge { position: absolute; top: 16px; left: 16px; font-family: "Space Mono"; font-size: 0.6rem; letter-spacing: 0.15em; color: #c9a84c; background: rgba(5,5,5,0.75); border: 1px solid rgba(201,168,76,0.35); padding: 5px 12px; border-radius: 2px; backdrop-filter: blur(4px); z-index: 10; }
  .anime-badge { color: #e05c7a !important; border-color: rgba(224,92,122,0.35) !important; }
  .series-badge { color: #5fbf8c !important; border-color: rgba(95,191,140,0.35) !important; }
  .modal-hero-poster-wrap { position: absolute; bottom: -40px; left: 36px; width: 100px; height: 150px; border: 2px solid rgba(201,168,76,0.3); border-radius: 2px; overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.8); z-index: 5; }
  .modal-hero-poster-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .modal-body { overflow-y: auto; flex: 1; padding: 56px 36px 36px 152px; scrollbar-width: thin; scrollbar-color: rgba(201,168,76,0.3) transparent; }
  .modal-body::-webkit-scrollbar { width: 4px; }
  .modal-body::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.3); border-radius: 2px; }
  .modal-title { font-family: "Cormorant Garamond"; font-size: 2.4rem; font-weight: 700; line-height: 1.05; margin-bottom: 8px; }
  .modal-tagline { font-family: "Cormorant Garamond"; font-style: italic; font-size: 1rem; color: rgba(240,236,228,0.4); margin-bottom: 18px; }
  .modal-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
  .modal-pill { font-family: "Space Mono"; font-size: 0.56rem; letter-spacing: 0.1em; border: 1px solid rgba(255,255,255,0.12); padding: 4px 10px; border-radius: 2px; color: rgba(240,236,228,0.55); }
  .modal-pill.gold { border-color: rgba(201,168,76,0.4); color: #c9a84c; }
  .modal-pill.green { border-color: rgba(95,191,140,0.4); color: #5fbf8c; }
  .modal-pill.red { border-color: rgba(231,76,60,0.4); color: #e74c3c; }
  .modal-score-row { display: flex; gap: 24px; margin-bottom: 28px; align-items: center; flex-wrap: wrap; }
  .modal-score { display: flex; flex-direction: column; align-items: center; }
  .modal-score-value { font-family: "Cormorant Garamond"; font-size: 2.2rem; font-weight: 700; line-height: 1; }
  .modal-score-label { font-family: "Space Mono"; font-size: 0.52rem; letter-spacing: 0.12em; color: rgba(240,236,228,0.3); margin-top: 4px; }
  .modal-score-divider { width: 1px; height: 48px; background: rgba(255,255,255,0.08); }
  .modal-overview { font-size: 0.9rem; line-height: 1.75; color: rgba(240,236,228,0.65); margin-bottom: 32px; }
  .modal-section { margin-bottom: 28px; }
  .modal-section-title { font-family: "Space Mono"; font-size: 0.58rem; letter-spacing: 0.18em; color: rgba(201,168,76,0.7); margin-bottom: 14px; display: flex; align-items: center; gap: 10px; }
  .anime-mst { color: rgba(224,92,122,0.7) !important; }
  .series-mst { color: rgba(95,191,140,0.7) !important; }
  .modal-section-title::after { content: ""; flex: 1; height: 1px; background: rgba(255,255,255,0.06); }
  .modal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
  .modal-data-cell { background: #111; border: 1px solid rgba(255,255,255,0.05); border-radius: 2px; padding: 12px 14px; }
  .modal-data-label { font-family: "Space Mono"; font-size: 0.52rem; letter-spacing: 0.1em; color: rgba(240,236,228,0.3); margin-bottom: 6px; }
  .modal-data-value { font-size: 0.85rem; color: rgba(240,236,228,0.85); }
  .modal-people-grid { display: flex; flex-wrap: wrap; gap: 10px; }
  .modal-person { display: flex; align-items: center; gap: 10px; background: #111; border: 1px solid rgba(255,255,255,0.05); border-radius: 2px; padding: 10px 14px; flex: 1 0 200px; }
  .modal-person-avatar { width: 36px; height: 36px; border-radius: 50%; background: rgba(201,168,76,0.15); border: 1px solid rgba(201,168,76,0.3); display: flex; align-items: center; justify-content: center; font-family: "Space Mono"; font-size: 0.6rem; color: #c9a84c; flex-shrink: 0; }
  .anime-av { background: rgba(224,92,122,0.15) !important; border-color: rgba(224,92,122,0.3) !important; color: #e05c7a !important; }
  .series-av { background: rgba(95,191,140,0.15) !important; border-color: rgba(95,191,140,0.3) !important; color: #5fbf8c !important; }
  .modal-person-name { font-size: 0.82rem; color: rgba(240,236,228,0.8); }
  .modal-person-role { font-family: "Space Mono"; font-size: 0.52rem; color: rgba(240,236,228,0.35); margin-top: 2px; }
  .modal-cast-strip { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 6px; scrollbar-width: thin; }
  .cast-chip { flex-shrink: 0; background: #111; border: 1px solid rgba(255,255,255,0.05); border-radius: 2px; padding: 10px 14px; text-align: center; width: 100px; }
  .cast-chip-poster { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; display: block; margin: 0 auto 8px; background: #1a1a1a; }
  .cast-chip-name { font-size: 0.72rem; color: rgba(240,236,228,0.7); line-height: 1.3; }
  .cast-chip-char { font-family: "Space Mono"; font-size: 0.5rem; color: rgba(240,236,228,0.3); margin-top: 3px; }
  .modal-genre-tags { display: flex; flex-wrap: wrap; gap: 8px; }
  .genre-tag { font-family: "Space Mono"; font-size: 0.56rem; letter-spacing: 0.08em; padding: 5px 12px; border-radius: 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(240,236,228,0.55); }
  .modal-revenue-bars { display: grid; gap: 10px; }
  .rev-bar-row { display: flex; align-items: center; gap: 12px; }
  .rev-bar-label { font-family: "Space Mono"; font-size: 0.55rem; color: rgba(240,236,228,0.35); width: 70px; flex-shrink: 0; }
  .rev-bar-track { flex: 1; height: 5px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden; }
  .rev-bar-fill { height: 100%; border-radius: 3px; }
  .rev-bar-val { font-family: "Space Mono"; font-size: 0.6rem; color: rgba(240,236,228,0.55); min-width: 90px; text-align: right; }
  .modal-streaming { display: flex; flex-wrap: wrap; gap: 10px; }
  .streaming-chip { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 3px; padding: 8px 14px; }
  .streaming-chip img { width: 20px; height: 20px; border-radius: 3px; }
  .streaming-chip-name { font-family: "Space Mono"; font-size: 0.58rem; color: rgba(240,236,228,0.6); }
  .modal-trailer-link { display: inline-flex; align-items: center; gap: 10px; background: rgba(201,168,76,0.1); border: 1px solid rgba(201,168,76,0.35); border-radius: 3px; padding: 12px 20px; font-family: "Space Mono"; font-size: 0.65rem; letter-spacing: 0.1em; color: #c9a84c; cursor: pointer; transition: all 0.2s; }
  .modal-trailer-link:hover { background: rgba(201,168,76,0.2); border-color: #c9a84c; }
  .modal-play-icon { width: 28px; height: 28px; border-radius: 50%; border: 1px solid rgba(201,168,76,0.5); display: flex; align-items: center; justify-content: center; }
  .network-tag { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 2px; padding: 5px 10px; font-family: "Space Mono"; font-size: 0.55rem; color: rgba(240,236,228,0.5); }
  .network-tag img { width: 18px; height: 18px; border-radius: 2px; }

  @media (max-width: 768px) {
    .nav { padding: 14px 20px; }
    .compare-trigger-btn span { display: none; }
    .guide-hero-content { padding: 0 24px 40px; }
    .tab-bar { padding: 0 20px; top: 60px; }
    .tab-btn { padding: 16px 10px; font-size: 0.58rem; }
    .timeline-section { padding: 40px 20px 80px; }
    .timeline-item { grid-template-columns: 1fr; gap: 16px; }
    .timeline-dot { grid-column: 1; justify-content: flex-start; padding-bottom: 8px; }
    .timeline-item .tl-card, .timeline-item-right .tl-card { grid-column: 1; margin-left: 0; margin-right: 0; }
    .modal-body { padding: 56px 20px 20px 20px; }
    .modal-hero-poster-wrap { display: none; }
    .modal-grid { grid-template-columns: repeat(2, 1fr); }
    .cmp-panel { max-height: 95vh; }
    .cmp-entity { min-width: 110px; padding: 16px 10px; }
    .cmp-header, .cmp-search-row, .cmp-footer { padding-left: 20px; padding-right: 20px; }
    .cmp-result-item { padding-left: 20px; padding-right: 20px; }
    .vp-panel { max-width: 100%; }
    .vp-title { font-size: 0.95rem; max-width: 200px; }
    .vp-yt-btn span { display: none; }
  }
</style>