<script>
// @ts-nocheck
// Route: /app/compare
// URL params: ?type=movies|anime|series|franchises

  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  const TMDB_KEY = '175b19b3ba717bf4f24e37ee4325be7e';
  const BASE = 'https://api.themoviedb.org/3';
  const IMG = 'https://image.tmdb.org/t/p';

  let compareType = $state('movies');   // locked to what guide passed
  let entities = $state([]);            // up to 5
  let searchQ = $state('');
  let searchResults = $state([]);
  let searching = $state(false);
  let searchTimer = null;

  // Scoring / reveal
  let scoreMap = $state({});            // idx → score
  let winner = $state(null);            // { idx, entity, score }
  let phase = $state('idle');           // idle | counting | revealed

  // Type display
  let typeLabel = $derived(
    compareType === 'franchises' ? 'Franchises' :
    compareType === 'movies'     ? 'Movies' :
    compareType === 'anime'      ? 'Anime' : 'Series'
  );

  let acC = $derived(
    compareType === 'anime'   ? '#e05c7a' :
    compareType === 'series'  ? '#5fbf8c' : '#c9a84c'
  );

  // ── SCORING ────────────────────────────────────────────
  // Season avg rating   45 pts   (for TV: average season ratings)
  // Episode avg rating  45 pts   (for TV: needs extra fetch; for movies: same as rating)
  // Popularity          10 pts

  async function fetchEpisodeAvg(entity) {
    // For franchises: fetch average rating of all movies in the collection
    if (compareType === 'franchises') {
      try {
        // Extract collection ID (remove 'col_' prefix)
        const collectionId = String(entity.id).replace('col_', '');
        const collectionData = await fetch(`${BASE}/collection/${collectionId}?api_key=${TMDB_KEY}`).then(r => r.json());
        
        if (collectionData.parts && collectionData.parts.length > 0) {
          const movieRatings = collectionData.parts
            .filter(part => part.vote_average > 0)
            .map(part => part.vote_average);
          
          if (movieRatings.length > 0) {
            return movieRatings.reduce((a, b) => a + b, 0) / movieRatings.length;
          }
        }
        return 0;
      } catch (_) {
        return 0;
      }
    }
    
    // For movies: episode avg = movie rating (no episodes)
    if (compareType === 'movies') return entity.rating || 0;

    // For TV/Anime: fetch all seasons and average all episode ratings
    try {
      const sd = await fetch(`${BASE}/tv/${entity.id}?api_key=${TMDB_KEY}`).then(r => r.json());
      const seasons = (sd.seasons || []).filter(s => s.season_number > 0).slice(0, 8);
      const allEpRatings = [];
      const chunks = [];
      for (let i = 0; i < seasons.length; i += 3) chunks.push(seasons.slice(i, i + 3));
      for (const chunk of chunks) {
        const fetched = await Promise.all(
          chunk.map(s => fetch(`${BASE}/tv/${entity.id}/season/${s.season_number}?api_key=${TMDB_KEY}`)
            .then(r => r.json()).catch(() => ({ episodes: [] })))
        );
        fetched.forEach(sd => {
          (sd.episodes || []).forEach(ep => {
            if (ep.vote_average > 0) allEpRatings.push(ep.vote_average);
          });
        });
      }
      if (!allEpRatings.length) return entity.rating || 0;
      return allEpRatings.reduce((a, b) => a + b, 0) / allEpRatings.length;
    } catch (_) { 
      return entity.rating || 0; 
    }
  }

  function calcScore(seasonRating, episodeAvg, popularity) {
    // Season rating component (45 pts max)
    const rS = seasonRating > 0 ? Math.min((seasonRating / 10) * 45, 45) : 0;
    
    // Episode average component (45 pts max)
    const eS = episodeAvg > 0 ? Math.min((episodeAvg / 10) * 45, 45) : 0;
    
    // Popularity component (10 pts max) - handle zero popularity
    let popS = 0;
    if (popularity > 0) {
      // Normalize popularity to 0-10 scale (using log scale for better distribution)
      popS = Math.min(Math.log10(popularity + 1) / Math.log10(1001) * 10, 10);
    }
    
    // Return total score (can be zero if all components are zero)
    return rS + eS + popS;
  }

  function scoreLabel(s) {
    if (s >= 88) return 'LEGENDARY';
    if (s >= 78) return 'ELITE';
    if (s >= 65) return 'GREAT';
    if (s >= 52) return 'GOOD';
    if (s >= 38) return 'AVERAGE';
    return 'WEAK';
  }

  function scoreColor(s) {
    if (s >= 88) return '#f0c060';
    if (s >= 78) return '#5fbf8c';
    if (s >= 65) return '#c9a84c';
    if (s >= 52) return '#8ecae6';
    return '#e05c7a';
  }

  // ── RUN COMPARISON ─────────────────────────────────────
  async function runComparison() {
    if (entities.length < 2 || phase !== 'idle') return;
    phase = 'counting';
    scoreMap = {};
    winner = null;

    // Fetch episode averages for all entities in parallel
    const epAvgs = await Promise.all(entities.map(e => fetchEpisodeAvg(e)));

    const scores = entities.map((e, i) => ({
      idx: i,
      score: calcScore(e.rating || 0, epAvgs[i], e.popularity || 0),
      epAvg: epAvgs[i]
    }));

    // Stagger score reveal with a cinematic delay
    await new Promise(r => setTimeout(r, 1400));

    scores.forEach(({ idx, score }) => {
      scoreMap = { ...scoreMap, [idx]: score };
    });

    await new Promise(r => setTimeout(r, 800));

    // Find best score (even if zero, pick one)
    const best = scores.reduce((a, b) => b.score > a.score ? b : a);
    winner = { idx: best.idx, entity: entities[best.idx], score: best.score };
    phase = 'revealed';
  }

  function resetComparison() {
    phase = 'idle';
    scoreMap = {};
    winner = null;
  }

  function clearAll() {
    entities = [];
    phase = 'idle';
    scoreMap = {};
    winner = null;
    searchQ = '';
    searchResults = [];
  }

  // ── SEARCH ─────────────────────────────────────────────
  async function doSearch(q) {
    if (!q || q.trim().length < 2) { searchResults = []; return; }
    searching = true;
    try {
      let results = [];
      if (compareType === 'movies') {
        const r = await fetch(`${BASE}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&page=1`).then(r => r.json());
        results = (r.results || []).slice(0, 10).map(m => ({
          id: m.id, type: 'movies',
          title: m.title || m.original_title || '',
          poster: m.poster_path ? `${IMG}/w300${m.poster_path}` : '',
          backdrop: m.backdrop_path ? `${IMG}/w780${m.backdrop_path}` : '',
          rating: m.vote_average || 0,
          popularity: m.popularity || 0,
          year: (m.release_date || '').slice(0, 4),
          voteCount: m.vote_count || 0,
          overview: m.overview || ''
        }));
      } else if (compareType === 'franchises') {
        const r = await fetch(`${BASE}/search/collection?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&page=1`).then(r => r.json());
        results = (r.results || []).slice(0, 10).map(c => ({
          id: 'col_' + c.id, type: 'franchises',
          title: (c.name || '').replace(/ Collection$/i, ''),
          poster: c.poster_path ? `${IMG}/w300${c.poster_path}` : '',
          backdrop: c.backdrop_path ? `${IMG}/w780${c.backdrop_path}` : '',
          rating: 0, // Will be calculated when comparing
          popularity: 0, // Will be calculated from collection data
          year: '', voteCount: 0, overview: c.overview || '',
          collectionId: c.id // Store original ID for fetching details
        }));
      } else if (compareType === 'anime') {
        const r = await fetch(`${BASE}/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&page=1`).then(r => r.json());
        let res = (r.results || []).slice(0, 12)
          .filter(s => (s.genre_ids || []).includes(16) || (s.origin_country || []).includes('JP'))
          .slice(0, 10);
        if (res.length < 3) {
          res = (r.results || []).slice(0, 10);
        }
        results = res.map(s => ({
          id: s.id, type: 'anime',
          title: s.name || s.original_name || '',
          poster: s.poster_path ? `${IMG}/w300${s.poster_path}` : '',
          backdrop: s.backdrop_path ? `${IMG}/w780${s.backdrop_path}` : '',
          rating: s.vote_average || 0,
          popularity: s.popularity || 0,
          year: (s.first_air_date || '').slice(0, 4),
          voteCount: s.vote_count || 0,
          overview: s.overview || ''
        }));
      } else {
        const r = await fetch(`${BASE}/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&page=1`).then(r => r.json());
        results = (r.results || []).slice(0, 10).map(s => ({
          id: s.id, type: 'series',
          title: s.name || s.original_name || '',
          poster: s.poster_path ? `${IMG}/w300${s.poster_path}` : '',
          backdrop: s.backdrop_path ? `${IMG}/w780${s.backdrop_path}` : '',
          rating: s.vote_average || 0,
          popularity: s.popularity || 0,
          year: (s.first_air_date || '').slice(0, 4),
          voteCount: s.vote_count || 0,
          overview: s.overview || ''
        }));
      }
      const addedIds = new Set(entities.map(e => String(e.id)));
      searchResults = results.filter(r => !addedIds.has(String(r.id)));
    } catch (_) { searchResults = []; }
    searching = false;
  }

  function addEntity(entity) {
    if (entities.length >= 5) return;
    if (entities.some(e => String(e.id) === String(entity.id))) return;
    entities = [...entities, entity];
    searchResults = [];
    searchQ = '';
    resetComparison();
  }

  function removeEntity(idx) {
    entities = entities.filter((_, i) => i !== idx);
    resetComparison();
  }

  function goBack() {
    if (window.history.length > 1) window.history.back();
    else goto('/app');
  }

  onMount(() => {
    const url = new URL(window.location.href);
    compareType = url.searchParams.get('type') || 'movies';
    document.title = `Compare ${typeLabel} · WatchOrder`;
  });
</script>

<!-- ════ GRAIN ════ -->
<div class="grain"></div>

<!-- ════ NAV ════ -->
<nav class="nav">
  <a class="nav-logo" href="/app" onclick={(e) => { e.preventDefault(); goBack(); }}>
    <span class="nav-logo-mark">W</span>
    <span class="nav-logo-text">atch</span>
    <span class="nav-logo-accent">Order</span>
    <div class="nav-logo-dot"></div>
  </a>
  <button class="nav-back-btn" onclick={goBack}>
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    BACK TO GUIDE
  </button>
</nav>

<!-- ════ MAIN ════ -->
<main class="compare-page">

  <!-- ── PAGE HEADER ── -->
  <header class="cp-header">
    <div class="cp-header-inner">
      <div class="cp-eyebrow">
        <span class="cp-eyebrow-bar"></span>
        <span>HEAD TO HEAD</span>
      </div>
      <h1 class="cp-title">
        Compare
        <em style="color:{acC}">{typeLabel}</em>
      </h1>
      <p class="cp-desc">
        Add up to 5 · Winner decided by season rating (45%) + episode rating (45%) + popularity (10%)
      </p>
    </div>

    <!-- Type pills (locked to same type, just visual) -->
    <div class="cp-type-row">
      <span class="cp-type-pill active" style="border-color:{acC};color:{acC};background:{acC}11">
        {typeLabel}
      </span>
      <span class="cp-count">{entities.length}/5 added</span>
    </div>
  </header>

  <!-- ── SEARCH ── -->
  {#if entities.length < 5 && phase === 'idle'}
    <div class="cp-search-section">
      <div class="cp-search-wrap" class:focused={searchQ.length > 0}>
        <svg class="cp-search-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M13 13l3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input
          class="cp-search-input"
          type="text"
          placeholder="Search {typeLabel.toLowerCase()} to add..."
          bind:value={searchQ}
          oninput={() => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => doSearch(searchQ), 320);
          }}
          autofocus
        />
        {#if searching}
          <div class="cp-spin"></div>
        {:else if searchQ.length > 0}
          <button class="cp-clear-btn" onclick={() => { searchQ = ''; searchResults = []; }}>✕</button>
        {/if}
      </div>

      <!-- Results -->
      {#if searchResults.length > 0}
        <div class="cp-results">
          {#each searchResults as result}
            <button class="cp-result" onclick={() => addEntity(result)}>
              <div class="cp-result-poster">
                {#if result.poster}
                  <img src={result.poster} alt="" loading="lazy"/>
                {:else}
                  <div class="cp-result-poster-empty">{result.title.slice(0,2).toUpperCase()}</div>
                {/if}
              </div>
              <div class="cp-result-body">
                <div class="cp-result-title">{result.title}</div>
                <div class="cp-result-meta">
                  {#if result.year}<span>{result.year}</span>{/if}
                  {#if result.rating > 0}<span>★ {result.rating.toFixed(1)}</span>{/if}
                  {#if result.voteCount > 0}<span>{result.voteCount.toLocaleString()} votes</span>{/if}
                </div>
                {#if result.overview}
                  <div class="cp-result-overview">{result.overview.slice(0, 80)}...</div>
                {/if}
              </div>
              <div class="cp-result-add-btn" style="border-color:{acC}44;color:{acC}">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                </svg>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- ── EMPTY STATE ── -->
  {#if entities.length === 0}
    <div class="cp-empty">
      <div class="cp-empty-icon" style="border-color:{acC}33">
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
          <rect x="5" y="14" width="16" height="24" rx="3" stroke={acC} stroke-width="1.5" opacity="0.4"/>
          <rect x="31" y="6" width="16" height="40" rx="3" stroke={acC} stroke-width="1.5" opacity="0.4"/>
          <path d="M21 26h10" stroke={acC} stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
        </svg>
      </div>
      <p class="cp-empty-title">Nothing to compare yet</p>
      <p class="cp-empty-sub">Search for {typeLabel.toLowerCase()} above to begin</p>
    </div>
  {/if}

  <!-- ── ARENA ── -->
  {#if entities.length > 0}
    <div class="cp-arena" class:cp-arena-wide={entities.length >= 4}>

      {#each entities as entity, i}
        {@const sc = scoreMap[i]}
        {@const isWinner = phase === 'revealed' && winner?.idx === i}
        {@const isLoser  = phase === 'revealed' && winner?.idx !== i}
        {@const hasScore = sc !== undefined}

        <div
          class="cp-card"
          class:cp-card-winner={isWinner}
          class:cp-card-loser={isLoser}
        >
          <!-- Remove -->
          {#if phase === 'idle'}
            <button class="cp-card-remove" onclick={() => removeEntity(i)}>✕</button>
          {/if}

          <!-- Crown -->
          {#if isWinner}
            <div class="cp-crown">
              <svg viewBox="0 0 32 20" fill="none" width="48" height="30">
                <path d="M1 19L5.5 6l7 7L16 1l3.5 12 7-7L31 19H1z" fill="#c9a84c"/>
                <path d="M1 19h30" stroke="#c9a84c" stroke-width="1.5"/>
                <circle cx="1" cy="19" r="2" fill="#c9a84c"/>
                <circle cx="16" cy="1" r="2" fill="#c9a84c"/>
                <circle cx="31" cy="19" r="2" fill="#c9a84c"/>
              </svg>
            </div>
          {/if}

          <!-- Backdrop blurred behind poster area -->
          <div class="cp-card-bg">
            {#if entity.backdrop || entity.poster}
              <img src={entity.backdrop || entity.poster} alt="" />
              <div class="cp-card-bg-fade"></div>
            {/if}
          </div>

          <!-- Poster -->
          <div class="cp-card-poster" class:cp-card-poster-winner={isWinner}>
            {#if entity.poster}
              <img src={entity.poster} alt={entity.title} loading="lazy"/>
            {:else}
              <div class="cp-card-poster-empty">
                <span>{entity.title.slice(0, 2).toUpperCase()}</span>
              </div>
            {/if}

            <!-- Score badge -->
            {#if hasScore}
              <div
                class="cp-card-score-badge"
                style="color:{scoreColor(sc)};background:{scoreColor(sc)}18;border-color:{scoreColor(sc)}55"
              >
                {sc.toFixed(1)}
              </div>
            {/if}
          </div>

          <!-- Info -->
          <div class="cp-card-info">
            <div class="cp-card-title">{entity.title}</div>
            {#if entity.year}
              <div class="cp-card-year">{entity.year}</div>
            {/if}

            <!-- Stats pills -->
            <div class="cp-card-stats">
              <span class="cp-card-stat" style="color:{acC}">
                ★ {entity.rating > 0 ? entity.rating.toFixed(1) : '—'}
              </span>
              {#if entity.popularity > 0}
                <span class="cp-card-stat">
                  ◉ {Math.round(entity.popularity)}
                </span>
              {/if}
            </div>

            <!-- Score bar (revealed state) -->
            {#if hasScore}
              <div class="cp-card-bar-label" style="color:{scoreColor(sc)}">
                {scoreLabel(sc)}
              </div>
              <div class="cp-card-bar-track">
                <div
                  class="cp-card-bar-fill"
                  style="width:{Math.min(sc, 100)}%;background:linear-gradient(to right,{scoreColor(sc)}88,{scoreColor(sc)})"
                ></div>
              </div>
              <div class="cp-card-score-text" style="color:{scoreColor(sc)}">
                {sc.toFixed(1)}<span class="cp-card-score-max">/100</span>
              </div>
            {/if}
          </div>

          <!-- Winner glow ring -->
          {#if isWinner}
            <div class="cp-winner-ring" style="border-color:{acC}"></div>
            <div class="cp-winner-glow" style="background:radial-gradient(ellipse at 50% 100%,{acC}22,transparent 70%)"></div>
          {/if}

          <!-- Loser vignette -->
          {#if isLoser}
            <div class="cp-loser-veil"></div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- ── COUNTING PHASE ── -->
  {#if phase === 'counting'}
    <div class="cp-counting">
      <div class="cp-counting-bars">
        {#each Array(8) as _, b}
          <div class="cp-counting-bar" style="animation-delay:{b*0.09}s"></div>
        {/each}
      </div>
      <div class="cp-counting-label" style="color:{acC}">
        ANALYSING · FETCHING EPISODE DATA · CALCULATING...
      </div>
    </div>
  {/if}

  <!-- ── VERDICT ── -->
  {#if phase === 'revealed' && winner}
    <div class="cp-verdict">
      <!-- Left line -->
      <div class="cp-verdict-rule">
        <div class="cp-verdict-rule-line"></div>
        <span class="cp-verdict-rule-text" style="color:{acC}">WINNER</span>
        <div class="cp-verdict-rule-line"></div>
      </div>

      <!-- Winner card big -->
      <div class="cp-verdict-card" style="border-color:{acC}33">
        {#if winner.entity.poster}
          <img class="cp-verdict-poster" src={winner.entity.poster} alt=""/>
        {/if}
        <div class="cp-verdict-body">
          <div class="cp-verdict-name" style="color:{acC}">{winner.entity.title}</div>
          <div class="cp-verdict-year">{winner.entity.year || ''}</div>
          <div class="cp-verdict-score-row">
            <span class="cp-verdict-score" style="color:{acC}">{winner.score.toFixed(1)}</span>
            <span class="cp-verdict-score-denom">/100</span>
            <span class="cp-verdict-score-label" style="color:{acC};border-color:{acC}44;background:{acC}11">
              {scoreLabel(winner.score)}
            </span>
          </div>
          <div class="cp-verdict-breakdown">
            <span>★ {winner.entity.rating > 0 ? winner.entity.rating.toFixed(1) : '—'} season rating</span>
            <span class="cp-vb-sep">·</span>
            <span>◉ {Math.round(winner.entity.popularity)} popularity</span>
          </div>
        </div>
      </div>

      <!-- Breakdown table -->
      <div class="cp-scores-table">
        {#each entities as entity, i}
          {@const sc = scoreMap[i]}
          {@const isBest = winner?.idx === i}
          <div class="cp-score-row" class:cp-score-row-best={isBest}>
            <div class="cp-score-row-poster">
              {#if entity.poster}
                <img src={entity.poster} alt=""/>
              {:else}
                <div class="cp-score-row-no-poster">{entity.title.slice(0,1)}</div>
              {/if}
            </div>
            <div class="cp-score-row-title">{entity.title}</div>
            {#if isBest}
              <div class="cp-score-row-crown">👑</div>
            {/if}
            <div class="cp-score-row-bar-wrap">
              <div class="cp-score-row-bar" style="width:{Math.min(sc||0,100)}%;background:{scoreColor(sc||0)}"></div>
            </div>
            <div class="cp-score-row-val" style="color:{scoreColor(sc||0)}">{sc ? sc.toFixed(1) : '—'}</div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- ── ACTIONS ── -->
  {#if entities.length >= 2}
    <div class="cp-actions">
      {#if phase === 'idle'}
        <button class="cp-run-btn" style="background:{acC}" onclick={runComparison}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M4 9h10M10 5l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          DECLARE A WINNER
        </button>
      {:else if phase === 'revealed'}
        <button class="cp-reset-btn" onclick={resetComparison}>↺ COMPARE AGAIN</button>
        <button class="cp-clear-all-btn" onclick={clearAll}>✕ START OVER</button>
      {/if}
    </div>
  {/if}

</main>

<style>
  :global(*) { margin: 0; padding: 0; box-sizing: border-box; }
  :global(body) { background: #050505; color: #f0ece4; font-family: "Sora", sans-serif; overflow-x: hidden; }

  .grain {
    position: fixed; inset: 0; z-index: 999; pointer-events: none; opacity: 0.035;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  /* ── NAV ── */
  .nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 500;
    padding: 16px 60px;
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(5,5,5,0.96); backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .nav-logo { display: flex; align-items: baseline; gap: 0; text-decoration: none; }
  .nav-logo-mark { font-family: "Cormorant Garamond"; font-size: 2.2rem; color: #c9a84c; font-weight: 700; line-height: 1; }
  .nav-logo-text { font-family: "Cormorant Garamond"; font-size: 1.6rem; font-weight: 300; color: #f0ece4; }
  .nav-logo-accent { font-family: "Cormorant Garamond"; font-style: italic; font-size: 1.6rem; font-weight: 600; opacity: 0.85; color: #f0ece4; }
  .nav-logo-dot { width: 5px; height: 5px; background: #c9a84c; border-radius: 50%; margin-left: 5px; box-shadow: 0 0 8px #c9a84c; }
  .nav-back-btn {
    display: inline-flex; align-items: center; gap: 8px;
    font-family: "Space Mono"; font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase;
    color: rgba(240,236,228,0.35); background: transparent;
    border: 1px solid rgba(255,255,255,0.08); padding: 8px 16px; cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
  }
  .nav-back-btn:hover { color: #c9a84c; border-color: rgba(201,168,76,0.3); }

  /* ── PAGE ── */
  .compare-page {
    min-height: 100vh;
    padding-top: 80px;
    padding-bottom: 120px;
    max-width: 1400px;
    margin: 0 auto;
    padding-left: 60px; padding-right: 60px;
  }

  /* ── HEADER ── */
  .cp-header {
    padding: 64px 0 48px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    margin-bottom: 48px;
    display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 24px;
  }
  .cp-header-inner { flex: 1; }
  .cp-eyebrow {
    display: flex; align-items: center; gap: 12px;
    font-family: "Space Mono"; font-size: 0.6rem; letter-spacing: 0.24em; text-transform: uppercase;
    color: #c9a84c; margin-bottom: 20px;
  }
  .cp-eyebrow-bar { width: 32px; height: 1px; background: #c9a84c; }
  .cp-title {
    font-family: "Cormorant Garamond"; font-size: clamp(3rem, 6vw, 5.5rem);
    font-weight: 700; line-height: 0.95; letter-spacing: -0.03em;
    color: #f0ece4; margin-bottom: 18px;
  }
  .cp-title em { font-style: italic; font-weight: 300; }
  .cp-desc {
    font-size: 0.9rem; font-weight: 300; color: rgba(240,236,228,0.4); line-height: 1.7; max-width: 480px;
    font-family: "Space Mono"; font-size: 0.58rem; letter-spacing: 0.08em;
  }
  .cp-type-row { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
  .cp-type-pill {
    font-family: "Space Mono"; font-size: 0.58rem; letter-spacing: 0.16em; text-transform: uppercase;
    padding: 8px 18px; border: 1px solid; border-radius: 1px;
  }
  .cp-count {
    font-family: "Space Mono"; font-size: 0.56rem; letter-spacing: 0.14em;
    color: rgba(240,236,228,0.25); text-transform: uppercase;
  }

  /* ── SEARCH ── */
  .cp-search-section { margin-bottom: 48px; }
  .cp-search-wrap {
    display: flex; align-items: center; gap: 14px;
    border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03);
    padding: 14px 20px; transition: border-color 0.25s;
  }
  .cp-search-wrap:focus-within { border-color: rgba(201,168,76,0.5); background: rgba(201,168,76,0.03); }
  .cp-search-icon { color: rgba(240,236,228,0.2); flex-shrink: 0; }
  .cp-search-input {
    flex: 1; background: transparent; border: none; outline: none;
    font-family: "Sora"; font-size: 1rem; font-weight: 300; color: #f0ece4;
  }
  .cp-search-input::placeholder { color: rgba(240,236,228,0.18); }
  .cp-clear-btn {
    background: transparent; border: none; color: rgba(240,236,228,0.25);
    cursor: pointer; font-size: 0.9rem; transition: color 0.2s; line-height: 1; flex-shrink: 0;
  }
  .cp-clear-btn:hover { color: rgba(240,236,228,0.6); }
  @keyframes spin { to { transform: rotate(360deg); } }
  .cp-spin { width: 18px; height: 18px; border: 1.5px solid rgba(201,168,76,0.2); border-top-color: #c9a84c; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }

  /* Results */
  .cp-results {
    border: 1px solid rgba(255,255,255,0.07); border-top: none;
    background: #080808; max-height: 380px; overflow-y: auto;
  }
  .cp-results::-webkit-scrollbar { width: 3px; }
  .cp-results::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.2); }
  .cp-result {
    display: flex; align-items: center; gap: 16px;
    width: 100%; padding: 14px 20px;
    background: transparent; border: none; cursor: pointer;
    border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s;
    text-align: left;
  }
  .cp-result:last-child { border-bottom: none; }
  .cp-result:hover { background: rgba(255,255,255,0.03); }
  .cp-result-poster { width: 42px; height: 62px; overflow: hidden; background: #1a1a1a; flex-shrink: 0; position: relative; }
  .cp-result-poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cp-result-poster-empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-family: "Cormorant Garamond"; font-size: 1.2rem; font-weight: 700; color: rgba(201,168,76,0.3); }
  .cp-result-body { flex: 1; min-width: 0; }
  .cp-result-title { font-family: "Cormorant Garamond"; font-size: 1.05rem; font-weight: 600; color: #f0ece4; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cp-result-meta { display: flex; gap: 12px; margin-top: 4px; font-family: "Space Mono"; font-size: 0.5rem; letter-spacing: 0.1em; color: rgba(240,236,228,0.28); }
  .cp-result-overview { font-size: 0.76rem; font-weight: 300; color: rgba(240,236,228,0.25); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cp-result-add-btn { width: 32px; height: 32px; border: 1px solid; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.2s; }
  .cp-result:hover .cp-result-add-btn { background: rgba(201,168,76,0.12); }

  /* ── EMPTY ── */
  .cp-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 16px; padding: 80px 0; text-align: center;
  }
  .cp-empty-icon { width: 96px; height: 96px; border: 1px solid; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
  .cp-empty-title { font-family: "Cormorant Garamond"; font-size: 1.6rem; font-weight: 300; color: rgba(240,236,228,0.3); }
  .cp-empty-sub { font-family: "Space Mono"; font-size: 0.56rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(240,236,228,0.15); }

  /* ── ARENA ── */
  .cp-arena {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 3px;
    margin-bottom: 48px;
  }
  .cp-arena-wide { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }

  .cp-card {
    position: relative; overflow: hidden;
    background: #0a0808;
    border: 1px solid rgba(255,255,255,0.06);
    padding: 0 0 24px 0;
    display: flex; flex-direction: column;
    transition: border-color 0.4s, opacity 0.5s;
  }
  .cp-card-winner { border-color: rgba(201,168,76,0.35); }
  .cp-card-loser { opacity: 0.38; }

  /* Blurred backdrop behind card */
  .cp-card-bg { position: absolute; inset: 0; z-index: 0; overflow: hidden; }
  .cp-card-bg img { width: 100%; height: 60%; object-fit: cover; filter: blur(18px) brightness(0.18) saturate(0.4); transform: scale(1.1); display: block; }
  .cp-card-bg-fade { position: absolute; top: 0; left: 0; right: 0; height: 60%; background: linear-gradient(to bottom, transparent 40%, #0a0808 100%); }

  /* Crown */
  .cp-crown { display: flex; justify-content: center; padding-top: 18px; position: relative; z-index: 2; animation: crownIn 0.6s cubic-bezier(0.16,1,0.3,1); }
  @keyframes crownIn { from { opacity: 0; transform: translateY(-20px) scale(0.6); } to { opacity: 1; transform: translateY(0) scale(1); } }

  /* Poster */
  .cp-card-poster {
    position: relative; z-index: 2;
    margin: 16px auto 0; width: 72%; aspect-ratio: 2/3; overflow: hidden;
    background: #111; border: 1px solid rgba(255,255,255,0.06);
    transition: border-color 0.4s;
    max-width: 180px;
  }
  .cp-card-poster-winner { border-color: rgba(201,168,76,0.5); box-shadow: 0 0 32px rgba(201,168,76,0.15); }
  .cp-card-poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cp-card-poster-empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #1a1a1a; }
  .cp-card-poster-empty span { font-family: "Cormorant Garamond"; font-size: 2.5rem; font-weight: 700; color: rgba(201,168,76,0.25); }

  /* Score badge on poster */
  .cp-card-score-badge {
    position: absolute; bottom: 8px; right: 8px;
    font-family: "Space Mono"; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.04em;
    padding: 4px 8px; border: 1px solid; border-radius: 1px;
    animation: badgeIn 0.4s cubic-bezier(0.16,1,0.3,1);
  }
  @keyframes badgeIn { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }

  /* Card info */
  .cp-card-info { position: relative; z-index: 2; padding: 18px 18px 0; flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .cp-card-title { font-family: "Cormorant Garamond"; font-size: 1.05rem; font-weight: 600; color: #f0ece4; letter-spacing: -0.01em; line-height: 1.2; }
  .cp-card-year { font-family: "Space Mono"; font-size: 0.5rem; letter-spacing: 0.12em; color: rgba(240,236,228,0.28); }
  .cp-card-stats { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; }
  .cp-card-stat { font-family: "Space Mono"; font-size: 0.56rem; letter-spacing: 0.08em; color: rgba(240,236,228,0.4); }
  .cp-card-bar-label { font-family: "Space Mono"; font-size: 0.52rem; letter-spacing: 0.18em; font-weight: 700; text-transform: uppercase; margin-top: 10px; animation: fadeUp 0.4s ease; }
  .cp-card-bar-track { height: 3px; background: rgba(255,255,255,0.06); overflow: hidden; margin-top: 6px; }
  .cp-card-bar-fill { height: 100%; animation: barGrow 0.9s cubic-bezier(0.16,1,0.3,1); }
  @keyframes barGrow { from { width: 0% !important; } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .cp-card-score-text { font-family: "Cormorant Garamond"; font-size: 2rem; font-weight: 700; line-height: 1; letter-spacing: -0.03em; margin-top: 4px; animation: fadeUp 0.5s 0.2s ease both; }
  .cp-card-score-max { font-size: 1rem; opacity: 0.4; font-weight: 300; margin-left: 2px; }

  /* Winner effects */
  .cp-winner-ring { position: absolute; inset: 0; border: 2px solid; pointer-events: none; z-index: 3; animation: ringPulse 2s ease-in-out infinite; }
  @keyframes ringPulse { 0%,100%{opacity:0.4}50%{opacity:0.8} }
  .cp-winner-glow { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
  .cp-loser-veil { position: absolute; inset: 0; background: rgba(5,4,4,0.4); pointer-events: none; z-index: 4; }

  /* Remove button */
  .cp-card-remove {
    position: absolute; top: 10px; right: 10px; z-index: 10;
    width: 24px; height: 24px; border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.1); background: rgba(5,5,5,0.85);
    color: rgba(240,236,228,0.3); font-size: 0.65rem; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: border-color 0.2s, color 0.2s;
  }
  .cp-card-remove:hover { border-color: #e74c3c; color: #e74c3c; }

  /* ── COUNTING ── */
  .cp-counting {
    display: flex; flex-direction: column; align-items: center; gap: 20px;
    padding: 56px 0;
    border-top: 1px solid rgba(255,255,255,0.04);
  }
  .cp-counting-bars { display: flex; align-items: flex-end; gap: 5px; height: 44px; }
  .cp-counting-bar { width: 5px; background: #c9a84c; border-radius: 3px; animation: dance 0.7s ease-in-out infinite alternate; }
  @keyframes dance { from { height: 6px; opacity: 0.25; } to { height: 44px; opacity: 1; } }
  .cp-counting-label { font-family: "Space Mono"; font-size: 0.6rem; letter-spacing: 0.24em; text-transform: uppercase; opacity: 0.7; animation: labelBlink 1.4s ease-in-out infinite; }
  @keyframes labelBlink { 0%,100%{opacity:0.5}50%{opacity:1} }

  /* ── VERDICT ── */
  .cp-verdict { margin-top: 8px; animation: fadeUp 0.6s ease; }
  .cp-verdict-rule { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; }
  .cp-verdict-rule-line { flex: 1; height: 1px; background: rgba(255,255,255,0.06); }
  .cp-verdict-rule-text { font-family: "Space Mono"; font-size: 0.6rem; letter-spacing: 0.28em; text-transform: uppercase; white-space: nowrap; }

  .cp-verdict-card {
    display: flex; align-items: center; gap: 28px;
    background: rgba(12,10,10,0.8); border: 1px solid;
    padding: 28px 36px; margin-bottom: 24px;
  }
  .cp-verdict-poster { width: 80px; height: 120px; object-fit: cover; flex-shrink: 0; display: block; border: 1px solid rgba(201,168,76,0.2); }
  .cp-verdict-body { flex: 1; }
  .cp-verdict-name { font-family: "Cormorant Garamond"; font-size: 2.2rem; font-weight: 700; letter-spacing: -0.03em; line-height: 1; margin-bottom: 6px; }
  .cp-verdict-year { font-family: "Space Mono"; font-size: 0.54rem; letter-spacing: 0.14em; color: rgba(240,236,228,0.3); margin-bottom: 16px; }
  .cp-verdict-score-row { display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px; }
  .cp-verdict-score { font-family: "Cormorant Garamond"; font-size: 3.5rem; font-weight: 900; line-height: 1; letter-spacing: -0.04em; }
  .cp-verdict-score-denom { font-family: "Cormorant Garamond"; font-size: 1.5rem; font-weight: 300; color: rgba(240,236,228,0.3); }
  .cp-verdict-score-label { font-family: "Space Mono"; font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; padding: 5px 12px; border: 1px solid; }
  .cp-verdict-breakdown { display: flex; align-items: center; gap: 10px; font-family: "Space Mono"; font-size: 0.54rem; letter-spacing: 0.1em; color: rgba(240,236,228,0.3); }
  .cp-vb-sep { color: rgba(201,168,76,0.3); }

  /* Score table */
  .cp-scores-table { display: flex; flex-direction: column; gap: 3px; margin-top: 16px; margin-bottom: 40px; }
  .cp-score-row {
    display: flex; align-items: center; gap: 14px;
    padding: 12px 20px; background: #0a0808;
    border: 1px solid rgba(255,255,255,0.04);
    transition: background 0.2s;
  }
  .cp-score-row-best { background: rgba(201,168,76,0.05); border-color: rgba(201,168,76,0.15); }
  .cp-score-row-poster { width: 32px; height: 48px; overflow: hidden; background: #1a1a1a; flex-shrink: 0; }
  .cp-score-row-poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cp-score-row-no-poster { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-family: "Cormorant Garamond"; font-size: 1.1rem; color: rgba(240,236,228,0.2); }
  .cp-score-row-title { font-family: "Cormorant Garamond"; font-size: 1rem; font-weight: 600; color: rgba(240,236,228,0.7); flex: 1; letter-spacing: -0.01em; }
  .cp-score-row-crown { font-size: 1rem; flex-shrink: 0; }
  .cp-score-row-bar-wrap { width: 180px; height: 3px; background: rgba(255,255,255,0.05); flex-shrink: 0; overflow: hidden; }
  .cp-score-row-bar { height: 100%; animation: barGrow 0.8s cubic-bezier(0.16,1,0.3,1); }
  .cp-score-row-val { font-family: "Space Mono"; font-size: 0.62rem; font-weight: 700; min-width: 40px; text-align: right; }

  /* ── ACTIONS ── */
  .cp-actions { display: flex; align-items: center; gap: 16px; padding: 40px 0 0; flex-wrap: wrap; }
  .cp-run-btn {
    display: inline-flex; align-items: center; gap: 12px;
    color: #050505; font-family: "Space Mono"; font-size: 0.65rem; font-weight: 700;
    letter-spacing: 0.2em; text-transform: uppercase; padding: 16px 36px; border: none;
    cursor: pointer;
    clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
    transition: filter 0.2s, transform 0.2s;
  }
  .cp-run-btn:hover { filter: brightness(1.15); transform: translateY(-2px); }
  .cp-reset-btn {
    display: inline-flex; align-items: center; gap: 8px;
    background: transparent; border: 1px solid rgba(201,168,76,0.3); color: #c9a84c;
    font-family: "Space Mono"; font-size: 0.6rem; letter-spacing: 0.16em; text-transform: uppercase;
    padding: 14px 28px; cursor: pointer; transition: background 0.2s, border-color 0.2s;
  }
  .cp-reset-btn:hover { background: rgba(201,168,76,0.1); border-color: #c9a84c; }
  .cp-clear-all-btn {
    background: transparent; border: 1px solid rgba(255,255,255,0.08); color: rgba(240,236,228,0.3);
    font-family: "Space Mono"; font-size: 0.6rem; letter-spacing: 0.16em; text-transform: uppercase;
    padding: 14px 24px; cursor: pointer; transition: border-color 0.2s, color 0.2s;
  }
  .cp-clear-all-btn:hover { border-color: rgba(255,255,255,0.2); color: rgba(240,236,228,0.6); }

  /* ── RESPONSIVE ── */
  @media (max-width: 768px) {
    .nav { padding: 14px 24px; }
    .compare-page { padding: 80px 24px 80px; }
    .cp-header { padding: 44px 0 32px; flex-direction: column; align-items: flex-start; }
    .cp-arena { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
    .cp-score-row-bar-wrap { width: 100px; }
    .cp-verdict-card { flex-direction: column; align-items: flex-start; }
    .cp-verdict-name { font-size: 1.6rem; }
  }
</style>