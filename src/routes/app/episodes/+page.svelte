<script>
// @ts-nocheck

  import { onMount } from 'svelte';
  
  const TMDB_KEY = '175b19b3ba717bf4f24e37ee4325be7e';
  const BASE = 'https://api.themoviedb.org/3';
  const IMG = 'https://image.tmdb.org/t/p/';
  const BOOST = 0.7;
  
  let itemType = $state('');
  let itemId = $state('');
  let qs = $state('');
  
  let sel = $state(null);
  let guideEntries = $state([]);
  let guideSeasons = $state({});
  let epView = $state('list');
  let epQ = $state('');
  let loading = $state(true);
  let error = $state(null);
  let selectedEpisode = $state(null);
  let showModal = $state(false);
  
  // Track which seasons are expanded
  let expandedSeasons = $state(new Set([1])); // Start with season 1 open
  
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  
  function boostR(r) {
    return r > 0 ? Math.min(10, +(r + BOOST).toFixed(1)) : 0;
  }
  
  function fmtR(r) {
    return r > 0 ? r.toFixed(1) : '—';
  }
  
  function norm(s) {
    return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  }
  
  function fuzzyEp(ep, q) {
    if (!q) return true;
    const nq = norm(q);
    return norm(ep.name || '').includes(nq) || norm(ep.overview || '').includes(nq);
  }
  
  function ratingBg(r) {
    if (r >= 9.7) return '#1d4ed8';
    if (r >= 9.0) return '#023020';
    if (r >= 8.0) return '#16a34a';
    if (r >= 7.0) return '#ca8a04';
    if (r >= 6.0) return '#92400e';
    if (r >= 4.0) return '#b91c1c';
    if (r > 0) return '#7e22ce';
    return 'rgba(255,255,255,0.04)';
  }
  
  function ratingText(r) {
    if (r >= 9.7) return '#93c5fd';
    if (r >= 9.0) return '#86efac';
    if (r >= 8.0) return '#bbf7d0';
    if (r >= 7.0) return '#fef08a';
    if (r >= 6.0) return '#fcd34d';
    if (r >= 4.0) return '#fca5a5';
    if (r > 0) return '#d8b4fe';
    return 'rgba(255,255,255,0.15)';
  }
  
  function goBackToApp() {
    sessionStorage.setItem('wo_from_guide', '1');
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/app';
    }
  }
  
  async function loadItem() {
    try {
      const sd = await fetch(`${BASE}/tv/${itemId}?api_key=${TMDB_KEY}&append_to_response=credits`).then(r => r.json());
      const seasons = (sd.seasons || []).filter(s => s.season_number > 0);
      
      sel = {
        id: +itemId,
        type: itemType,
        title: sd.name || sd.original_name || 'Unknown',
        entries: seasons.length,
        desc: sd.overview || '',
        bg: sd.backdrop_path ? `${IMG}w1280${sd.backdrop_path}` : '',
        poster: sd.poster_path ? `${IMG}w500${sd.poster_path}` : '',
        posterUrl: sd.poster_path ? `${IMG}w300${sd.poster_path}` : '',
        years: sd.first_air_date ? sd.first_air_date.slice(0, 4) + (sd.last_air_date && sd.status !== 'Returning Series' ? '–' + sd.last_air_date.slice(0, 4) : '–') : 'N/A',
        status: sd.status || ''
      };
      
      guideEntries = seasons.map((s, i) => ({
        ...s,
        order: i + 1,
        year: (s.air_date || '').slice(0, 4),
        ratingNum: s.vote_average || 0,
        rating: fmtR(s.vote_average || 0),
        episode_count: s.episode_count || 0,
        title: s.name || 'Season ' + s.season_number
      }));
      
      const initialSeasons = {};
      seasons.forEach(s => {
        initialSeasons[s.season_number] = { episodes: null, loading: false };
      });
      guideSeasons = initialSeasons;
      
      document.title = sel.title + ' · Episodes · WatchOrder';
      loading = false;
      
      // Load first season
      const sns = Object.keys(guideSeasons).map(Number).sort((a, b) => a - b);
      if (sns.length > 0) {
        loadSeasonEps(sns[0]);
      }
    } catch (e) {
      console.error(e);
      error = 'Could not load.';
      loading = false;
    }
  }
  
  async function loadSeasonEps(sn) {
    if (!guideSeasons[sn] || guideSeasons[sn].episodes !== null || guideSeasons[sn].loading) return;
    
    guideSeasons[sn].loading = true;
    guideSeasons = { ...guideSeasons };
    
    try {
      const r = await fetch(`${BASE}/tv/${itemId}/season/${sn}?api_key=${TMDB_KEY}`);
      const d = await r.json();
      guideSeasons[sn].episodes = (d.episodes || []).map(ep => ({
        ...ep,
        posterUrl: ep.still_path ? `${IMG}w300${ep.still_path}` : '',
        ratingRaw: ep.vote_average || 0,
        ratingNum: boostR(ep.vote_average || 0),
        rating: fmtR(boostR(ep.vote_average || 0))
      }));
    } catch (_) {
      guideSeasons[sn].episodes = [];
    }
    
    guideSeasons[sn].loading = false;
    guideSeasons = { ...guideSeasons };
  }
  
  function toggleSeason(sn) {
    if (expandedSeasons.has(sn)) {
      expandedSeasons.delete(sn);
      expandedSeasons = new Set(expandedSeasons);
    } else {
      expandedSeasons.add(sn);
      expandedSeasons = new Set(expandedSeasons);
      if (guideSeasons[sn]?.episodes === null) {
        loadSeasonEps(sn);
      }
    }
  }
  
  async function loadAllSeasonsForGraph() {
    const sns = Object.keys(guideSeasons).map(Number).sort((a, b) => a - b);
    await Promise.all(sns.map(async sn => {
      if (guideSeasons[sn] && guideSeasons[sn].episodes === null && !guideSeasons[sn].loading) {
        guideSeasons[sn].loading = true;
        try {
          const r = await fetch(`${BASE}/tv/${itemId}/season/${sn}?api_key=${TMDB_KEY}`);
          const d = await r.json();
          guideSeasons[sn].episodes = (d.episodes || []).map(ep => ({
            ...ep,
            posterUrl: ep.still_path ? `${IMG}w300${ep.still_path}` : '',
            ratingRaw: ep.vote_average || 0,
            ratingNum: boostR(ep.vote_average || 0),
            rating: fmtR(boostR(ep.vote_average || 0))
          }));
        } catch (_) {
          guideSeasons[sn].episodes = [];
        }
        guideSeasons[sn].loading = false;
      }
    }));
    guideSeasons = { ...guideSeasons };
  }
  
  function openEpModal(ep) {
    selectedEpisode = ep;
    showModal = true;
    document.body.style.overflow = 'hidden';
  }
  
  function closeEpModal() {
    showModal = false;
    document.body.style.overflow = '';
    setTimeout(() => {
      selectedEpisode = null;
    }, 250);
  }
  
  function handleKeydown(e) {
    if (e.key === 'Escape' && showModal) {
      closeEpModal();
    }
  }
  
  // Derived values
  let ac = $derived(sel?.type === 'anime' ? 'anime' : 'series');
  let acColor = $derived(ac === 'anime' ? '#e05c7a' : '#5fbf8c');
  let sortedSeasonNumbers = $derived(Object.keys(guideSeasons).map(Number).sort((a, b) => a - b));
  let loadedSeasonsForGraph = $derived(sortedSeasonNumbers.filter(sn => guideSeasons[sn]?.episodes?.length));
  let maxEpsForGraph = $derived(loadedSeasonsForGraph.length ? Math.max(...loadedSeasonsForGraph.map(sn => guideSeasons[sn].episodes.length)) : 0);
  
  onMount(() => {
    const url = new URL(window.location.href);
    itemType = url.searchParams.get('type') || '';
    itemId = url.searchParams.get('id') || '';
    qs = '?type=' + encodeURIComponent(itemType) + '&id=' + encodeURIComponent(itemId);
    
    if (!itemType || !itemId || !(itemType === 'anime' || itemType === 'series')) {
      error = 'Episodes only available for anime/series.';
      loading = false;
    } else {
      loadItem();
    }
    
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="grain"></div>

<nav class="nav">
  <a class="nav-logo" href="/" onclick={(e) => { e.preventDefault(); goBackToApp(); }}>
    <span class="nav-logo-mark">W</span>
    <span class="nav-logo-text">atch</span>
    <span class="nav-logo-accent">Order</span>
    <div class="nav-logo-dot"></div>
  </a>
</nav>

{#if loading}
  <div class="loader">
    <div class="spinner"></div>
    <p>LOADING EPISODES...</p>
  </div>
{:else if error}
  <div class="error-page">
    <h2>404</h2>
    <p>{error}</p>
    <button class="back-button" style="margin-top:20px" onclick={goBackToApp}>← BACK</button>
  </div>
{:else if sel}
  <main class="guide-container">
    <div class="guide-hero" style="background-image: url('{sel.bg || sel.poster || ''}')">
      <div class="guide-hero-overlay"></div>
      <div class="guide-hero-content">
        <button class="back-button" onclick={goBackToApp}>← BACK</button>
        <div class="overtitle">
          <span class="bar"></span>
          <span>{ac === 'anime' ? 'ANIME' : 'SERIES'} · EPISODES</span>
        </div>
        <h1 class="guide-title">{sel.title}</h1>
        <div class="guide-meta-row">
          <span class="guide-pill {ac}-pill">{sel.entries} SEASONS</span>
          <span class="guide-pill">{sel.years || ''}</span>
          <span class="guide-pill {ac}-pill">{sel.status || ''}</span>
        </div>
      </div>
    </div>
    
    <div class="tab-bar">
      <a class="tab-btn" href="guide{qs}">WATCH ORDER</a>
      <a class="tab-btn tab-active {ac}-tab" href="episodes{qs}">EPISODES</a>
      <a class="tab-btn" href="history{qs}">HISTORY</a>
      <a class="tab-btn" href="ratings{qs}">RATINGS</a>
      <a class="tab-btn" href="reviews{qs}">REVIEWS</a>
    </div>
    
    <div class="episodes-section">
      <div class="timeline-intro">
        <div class="overtitle {ac}-color">
          <span class="bar"></span>
          <span>ALL EPISODES</span>
        </div>
        <div class="ep-controls">
          <div class="ep-search-box">
            <span class="ep-search-icon">⌕</span>
            <input 
              type="text" 
              class="ep-search-input" 
              placeholder="Search episodes..." 
              bind:value={epQ}
              autocomplete="off"
            />
          </div>
          <div class="ep-view-toggle">
            <button 
              class="ep-view-btn {epView === 'list' ? 'active' : ''}" 
              onclick={() => epView = 'list'}
            >
              LIST
            </button>
            <button 
              class="ep-view-btn {epView === 'graph' ? 'active' : ''}" 
              onclick={() => {
                epView = 'graph';
                loadAllSeasonsForGraph();
              }}
            >
              GRAPH
            </button>
          </div>
        </div>
      </div>
      
      {#if epView === 'graph'}
        <div style="margin-bottom:40px">
          {#if loadedSeasonsForGraph.length === 0}
            <div style="padding:48px;text-align:center;font-family:'Space Mono';font-size:0.72rem;color:rgba(201,168,76,0.5);display:flex;flex-direction:column;align-items:center;gap:16px">
              <div class="spinner-sm"></div>
              <span>Loading seasons...</span>
            </div>
          {:else}
            <div class="sg-wrapper">
              <div class="sg-table">
                <div class="sg-axis-ep">
                  {#each Array(maxEpsForGraph) as _, i}
                    <div class="sg-ep-label">E{i + 1}</div>
                  {/each}
                </div>
                <div class="sg-seasons">
                  {#each loadedSeasonsForGraph as sn}
                    {@const eps = guideSeasons[sn].episodes}
                    <div class="sg-season-col">
                      <div class="sg-season-hdr">S{sn}</div>
                      {#each Array(maxEpsForGraph) as _, e}
                        {@const epNum = e + 1}
                        {@const ep = eps.find(x => x.episode_number === epNum)}
                        {#if ep}
                          {@const r = ep.ratingNum}
                          {@const bg = ratingBg(r)}
                          {@const tc = ratingText(r)}
                          {@const tooltip = `S${sn}E${epNum}: ${ep.name || ''} — ${r > 0 ? ep.rating : 'N/R'}`}
                          <div 
                            class="sg-cell" 
                            style="background: {bg}; color: {tc}"
                            onclick={() => openEpModal(ep)}
                            title={tooltip}
                          >
                            <div class="sg-cell-tooltip">{tooltip}</div>
                            {r > 0 ? ep.rating : ''}
                          </div>
                        {:else}
                          <div class="sg-cell empty"></div>
                        {/if}
                      {/each}
                    </div>
                  {/each}
                </div>
              </div>
            </div>
            <div class="sg-legend">
              <div class="sg-leg"><div class="sg-leg-box" style="background:#1d4ed8"></div>9.7–10 Elite</div>
              <div class="sg-leg"><div class="sg-leg-box" style="background:#15803d"></div>9.0–9.6 Outstanding</div>
              <div class="sg-leg"><div class="sg-leg-box" style="background:#16a34a"></div>8.0–8.9 Great</div>
              <div class="sg-leg"><div class="sg-leg-box" style="background:#ca8a04"></div>7.0–7.9 Good</div>
              <div class="sg-leg"><div class="sg-leg-box" style="background:#92400e"></div>6.0–6.9 Average</div>
              <div class="sg-leg"><div class="sg-leg-box" style="background:#b91c1c"></div>4.0–5.9 Poor</div>
              <div class="sg-leg"><div class="sg-leg-box" style="background:#7e22ce"></div>1–3.9 Bad</div>
            </div>
          {/if}
        </div>
      {:else}
        <!-- List View -->
        {#each sortedSeasonNumbers as sn, idx}
          {@const entry = guideEntries.find(e => e.season_number === sn)}
          {@const title = entry?.title || 'Season ' + sn}
          {@const ec = entry?.episode_count || 0}
          {@const year = entry?.year || ''}
          {@const rat = entry?.ratingNum || 0}
          {@const isExpanded = expandedSeasons.has(sn)}
          <div class="season-block">
            <div class="season-hdr" onclick={() => toggleSeason(sn)}>
              <div class="season-number {ac}-sn">S{String(sn).padStart(2, '0')}</div>
              <div style="flex:1">
                <div class="season-title">{title}</div>
                <div class="season-meta">
                  {#if year}<span>{year}</span>{/if}
                  {#if ec}<span>{ec} EPS</span>{/if}
                  {#if rat > 0}<span>★ {rat.toFixed(1)}</span>{/if}
                </div>
                {#if rat > 0}
                  <div class="season-rating-bar">
                    <div class="season-rating-fill" style="width: {(rat/10)*100}%; background: {acColor}"></div>
                  </div>
                {/if}
              </div>
              <button class="season-toggle {isExpanded ? 'open' : ''}" onclick={(e) => e.stopPropagation()}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 5l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
            
            {#if isExpanded}
              <div class="ep-grid">
                {#if guideSeasons[sn]?.loading}
                  <div class="ep-loading" style="grid-column:1/-1">
                    <div class="spinner-sm"></div>
                    <span>Loading...</span>
                  </div>
                {:else if guideSeasons[sn]?.episodes}
                  {@const filteredEps = guideSeasons[sn].episodes.filter(ep => fuzzyEp(ep, epQ))}
                  {#if filteredEps.length === 0}
                    <div style="opacity:0.3;font-size:0.8rem;padding:16px 0;grid-column:1/-1">No episodes found.</div>
                  {:else}
                    {#each filteredEps as ep}
                      {@const r = ep.ratingNum}
                      {@const rc = ratingText(r)}
                      <div class="ep-card {ac}-ep" onclick={() => openEpModal(ep)}>
                        <div class="ep-thumb">
                          {#if ep.posterUrl}
                            <img src={ep.posterUrl} alt="" loading="lazy" />
                          {:else}
                            <div style="height:100%;background:#1a1a1a;display:flex;align-items:center;justify-content:center;opacity:0.12;font-size:1.4rem">▶</div>
                          {/if}
                          <div class="ep-code" style="color: {acColor}">S{String(sn).padStart(2, '0')}E{String(ep.episode_number || 0).padStart(2, '0')}</div>
                        </div>
                        <div class="ep-info">
                          <div class="ep-name">{ep.name || 'Episode ' + ep.episode_number}</div>
                          <div class="ep-airdate">{ep.air_date || ''}</div>
                          <div class="ep-overview">{ep.overview || 'No description available.'}</div>
                        </div>
                        {#if r > 0}
                          <div class="ep-r" style="color: {rc}">★ {ep.rating}</div>
                        {/if}
                      </div>
                    {/each}
                  {/if}
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  </main>
{/if}

<!-- Episode Modal -->
{#if showModal && selectedEpisode}
  {@const ep = selectedEpisode}
  {@const rB = ep.ratingNum || boostR(ep.ratingRaw || 0)}
  {@const rC = ratingText(rB)}
  {@const cast = (ep.guest_stars || []).slice(0, 8)}
  
  <div class="modal-backdrop" class:closing={!showModal} onclick={(e) => { if (e.target === e.currentTarget) closeEpModal(); }}>
    <div class="modal-panel {ac}-modal" class:closing={!showModal}>
      <div class="modal-hero">
        <div class="modal-hero-bg" style="background-image: url('{ep.posterUrl || ''}')"></div>
        <div class="modal-hero-gradient"></div>
        <div class="modal-order-badge {ac}-badge">
          S{String(ep.season_number || 0).padStart(2, '0')} E{String(ep.episode_number || 0).padStart(2, '0')}
        </div>
        <button class="modal-close" onclick={closeEpModal}>✕</button>
      </div>
      <div class="modal-body">
        <h2 class="modal-title">{ep.name || 'Episode'}</h2>
        <div class="modal-pills">
          {#if ep.air_date}<span class="modal-pill">{ep.air_date}</span>{/if}
          {#if ep.runtime}<span class="modal-pill">{ep.runtime}m</span>{/if}
          {#if rB > 0}<span class="modal-pill" style="border-color: {rC}; color: {rC}">★ {rB.toFixed(1)}</span>{/if}
        </div>
        <p class="modal-overview">{ep.overview || 'No description.'}</p>
        {#if cast.length}
          <div class="modal-section">
            <div class="modal-section-title {ac}-mst">GUEST STARS</div>
            <div class="modal-cast-strip">
              {#each cast as c}
                <div class="cast-chip">
                  <img 
                    class="cast-chip-poster" 
                    src={c.profile_path ? `${IMG}w185${c.profile_path}` : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect fill="%23222" width="1" height="1"/></svg>'} 
                    alt=""
                  />
                  <div class="cast-chip-name">{c.name}</div>
                  <div class="cast-chip-char">{(c.character || '').slice(0, 18)}</div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  :global(body) {
    background: #050505;
    color: #f0ece4;
    font-family: "Sora", sans-serif;
    overflow-x: hidden;
  }

  .grain {
    position: fixed;
    inset: 0;
    z-index: 999;
    pointer-events: none;
    opacity: 0.04;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  .nav {
    position: fixed;
    top: 0;
    width: 100%;
    padding: 16px 50px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 500;
    box-sizing: border-box;
    background: rgba(5, 5, 5, 0.95);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .nav-logo {
    display: flex;
    align-items: baseline;
    gap: 0;
    text-decoration: none;
  }

  .nav-logo-mark {
    font-family: "Cormorant Garamond";
    font-size: 2.2rem;
    color: #c9a84c;
    font-weight: 700;
    line-height: 1;
  }

  .nav-logo-text {
    font-family: "Cormorant Garamond";
    font-size: 1.6rem;
    font-weight: 300;
    color: #f0ece4;
  }

  .nav-logo-accent {
    font-family: "Cormorant Garamond";
    font-style: italic;
    font-size: 1.6rem;
    font-weight: 600;
    opacity: 0.85;
    color: #f0ece4;
  }

  .nav-logo-dot {
    width: 5px;
    height: 5px;
    background: #c9a84c;
    border-radius: 50%;
    margin-left: 5px;
    box-shadow: 0 0 8px #c9a84c;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 2px solid rgba(201, 168, 76, 0.1);
    border-top-color: #c9a84c;
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }

  .spinner-sm {
    width: 20px;
    height: 20px;
    border: 1.5px solid rgba(201, 168, 76, 0.2);
    border-top-color: #c9a84c;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .loader {
    min-height: 80vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    color: #c9a84c;
    font-family: "Space Mono";
    font-size: 0.78rem;
  }

  .error-page {
    min-height: 80vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    text-align: center;
  }

  .error-page h2 {
    font-family: "Cormorant Garamond";
    font-size: 3rem;
    opacity: 0.4;
  }

  .guide-container {
    padding-top: 80px;
  }

  .guide-hero {
    height: 50vh;
    background-size: cover;
    background-position: center;
    position: relative;
    display: flex;
    align-items: flex-end;
  }

  .guide-hero-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(5, 5, 5, 0.2) 0%, rgba(5, 5, 5, 0.7) 60%, rgba(5, 5, 5, 1) 100%);
  }

  .guide-hero-content {
    position: relative;
    z-index: 2;
    padding: 0 70px 48px;
    max-width: 900px;
  }

  .guide-title {
    font-family: "Cormorant Garamond";
    font-size: clamp(2.5rem, 5vw, 4rem);
    font-weight: 700;
    line-height: 1;
    margin: 12px 0 16px;
  }

  .guide-meta-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .guide-pill {
    font-family: "Space Mono";
    font-size: 0.6rem;
    letter-spacing: 0.12em;
    border: 1px solid rgba(255, 255, 255, 0.18);
    padding: 5px 12px;
    border-radius: 2px;
    color: rgba(240, 236, 228, 0.65);
  }

  .guide-pill.anime-pill {
    border-color: rgba(224, 92, 122, 0.4);
    color: #e05c7a;
  }

  .guide-pill.series-pill {
    border-color: rgba(95, 191, 140, 0.4);
    color: #5fbf8c;
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(20, 20, 20, 0.8);
    border: 1px solid rgba(201, 168, 76, 0.3);
    border-radius: 40px;
    padding: 8px 20px;
    font-family: "Space Mono";
    font-size: 0.7rem;
    color: #c9a84c;
    cursor: pointer;
    transition: 0.25s;
    margin-bottom: 16px;
    text-decoration: none;
    outline: none;
  }

  .back-button:hover {
    border-color: #c9a84c;
    background: rgba(30, 30, 30, 0.9);
  }

  .overtitle {
    display: flex;
    align-items: center;
    gap: 14px;
    font-family: "Space Mono";
    font-size: 0.68rem;
    letter-spacing: 0.2em;
    color: #c9a84c;
    margin-bottom: 16px;
  }

  .overtitle .bar {
    width: 36px;
    height: 1px;
    background: #c9a84c;
  }

  .tab-bar {
    display: flex;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    padding: 0 70px;
    position: sticky;
    top: 64px;
    background: rgba(5, 5, 5, 0.96);
    backdrop-filter: blur(12px);
    z-index: 50;
    flex-wrap: wrap;
  }

  .tab-btn {
    display: inline-flex;
    align-items: center;
    color: rgba(240, 236, 228, 0.35);
    font-family: "Space Mono";
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    padding: 20px 24px;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: 0.22s;
    text-decoration: none;
  }

  .tab-btn:hover {
    color: rgba(240, 236, 228, 0.6);
  }

  .tab-active {
    color: #c9a84c !important;
    border-bottom-color: #c9a84c !important;
  }

  .tab-active.anime-tab {
    color: #e05c7a !important;
    border-bottom-color: #e05c7a !important;
  }

  .tab-active.series-tab {
    color: #5fbf8c !important;
    border-bottom-color: #5fbf8c !important;
  }

  .episodes-section {
    padding: 70px 70px 120px;
  }

  .timeline-intro {
    margin-bottom: 40px;
  }

  .ep-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .ep-search-box {
    display: flex;
    align-items: center;
    background: rgba(15, 15, 15, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 30px;
    padding: 6px 16px;
    flex: 1;
    max-width: 340px;
    transition: 0.2s;
  }

  .ep-search-box:focus-within {
    border-color: rgba(201, 168, 76, 0.5);
  }

  .ep-search-icon {
    color: rgba(240, 236, 228, 0.3);
    font-size: 14px;
    margin-right: 8px;
  }

  .ep-search-input {
    background: transparent;
    border: none;
    color: #f0ece4;
    font-family: "Space Mono";
    font-size: 0.72rem;
    padding: 4px 0;
    width: 100%;
    outline: none;
  }

  .ep-search-input::placeholder {
    color: rgba(240, 236, 228, 0.25);
  }

  .ep-view-toggle {
    display: flex;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 3px;
    overflow: hidden;
  }

  .ep-view-btn {
    background: none;
    border: none;
    color: rgba(240, 236, 228, 0.35);
    font-family: "Space Mono";
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    padding: 7px 14px;
    cursor: pointer;
    transition: 0.2s;
  }

  .ep-view-btn:first-child {
    border-right: 1px solid rgba(255, 255, 255, 0.1);
  }

  .ep-view-btn.active {
    background: rgba(201, 168, 76, 0.12);
    color: #c9a84c;
  }

  .ep-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
    gap: 12px;
    margin-top: 4px;
    width: 100%;
  }

  .ep-card {
    background: #0d0d0d;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 3px;
    display: flex;
    overflow: hidden;
    transition: border-color 0.2s, transform 0.2s;
    cursor: pointer;
    position: relative;
    min-height: 88px;
  }

  .ep-card:hover {
    border-color: rgba(201, 168, 76, 0.2);
    transform: translateX(3px);
  }

  .ep-card.anime-ep:hover {
    border-color: rgba(224, 92, 122, 0.25);
  }

  .ep-card.series-ep:hover {
    border-color: rgba(95, 191, 140, 0.25);
  }

  .ep-thumb {
    width: 104px;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
    background: #111;
  }

  .ep-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    opacity: 0.78;
    transition: opacity 0.3s;
  }

  .ep-card:hover .ep-thumb img {
    opacity: 1;
  }

  .ep-code {
    position: absolute;
    top: 5px;
    left: 5px;
    font-family: "Space Mono";
    font-size: 0.46rem;
    background: rgba(5, 5, 5, 0.85);
    padding: 2px 5px;
    border-radius: 2px;
    letter-spacing: 0.08em;
  }

  .ep-info {
    padding: 10px 12px;
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .ep-name {
    font-family: "Cormorant Garamond";
    font-size: 0.98rem;
    font-weight: 600;
    margin-bottom: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ep-airdate {
    font-family: "Space Mono";
    font-size: 0.48rem;
    color: rgba(240, 236, 228, 0.3);
    margin-bottom: 5px;
  }

  .ep-overview {
    font-size: 0.7rem;
    opacity: 0.38;
    line-height: 1.38;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .ep-r {
    position: absolute;
    bottom: 6px;
    right: 8px;
    font-family: "Space Mono";
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .ep-loading {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 0;
    font-family: "Space Mono";
    font-size: 0.68rem;
    color: rgba(201, 168, 76, 0.6);
    grid-column: 1/-1;
  }

  .season-block {
    margin-bottom: 48px;
  }

  .season-hdr {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 16px;
    cursor: pointer;
    user-select: none;
  }

  .season-number {
    font-family: "Cormorant Garamond";
    font-size: 3rem;
    font-weight: 300;
    line-height: 1;
    color: rgba(201, 168, 76, 0.4);
    min-width: 80px;
  }

  .anime-sn {
    color: rgba(224, 92, 122, 0.4) !important;
  }

  .series-sn {
    color: rgba(95, 191, 140, 0.4) !important;
  }

  .season-title {
    font-family: "Cormorant Garamond";
    font-size: 1.5rem;
    font-weight: 600;
  }

  .season-meta {
    display: flex;
    gap: 16px;
    margin-top: 4px;
    font-family: "Space Mono";
    font-size: 0.6rem;
    color: rgba(240, 236, 228, 0.35);
  }

  .season-toggle {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: rgba(240, 236, 228, 0.4);
    transition: 0.2s;
    flex-shrink: 0;
  }

  .season-toggle svg {
    transition: transform 0.3s;
  }

  .season-toggle.open svg {
    transform: rotate(180deg);
  }

  .season-rating-bar {
    height: 2px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 1px;
    margin-top: 8px;
    overflow: hidden;
  }

  .season-rating-fill {
    height: 100%;
    border-radius: 1px;
    opacity: 0.5;
  }

  /* Series Graph Styles */
  .sg-wrapper {
    margin-top: 8px;
    overflow-x: auto;
    padding-bottom: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .sg-wrapper::-webkit-scrollbar {
    height: 4px;
  }

  .sg-wrapper::-webkit-scrollbar-thumb {
    background: rgba(201, 168, 76, 0.25);
    border-radius: 2px;
  }

  .sg-table {
    display: flex;
    margin: 0 auto;
  }
.sg-axis-ep {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  padding-top: 40px; /* 36px header + 4px gap to match season columns */
  gap: 4px; /* match sg-season-col gap */
}

  .sg-ep-label {
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 10px;
    font-family: "Space Mono";
    font-size: 0.56rem;
    color: rgba(240, 236, 228, 0.3);
    white-space: nowrap;
  }

  .sg-seasons {
    display: flex;
    gap: 4px;
  }

  .sg-season-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .sg-season-hdr {
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "Space Mono";
    font-size: 0.58rem;
    letter-spacing: 0.08em;
    color: rgba(240, 236, 228, 0.5);
    width: 52px;
    flex-shrink: 0;
  }

  .sg-cell {
    width: 52px;
    height: 44px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "Space Mono";
    font-size: 0.68rem;
    font-weight: 700;
    cursor: pointer;
    position: relative;
    transition: transform 0.15s, filter 0.15s;
    flex-shrink: 0;
  }

  .sg-cell:hover {
    transform: scale(1.12);
    filter: brightness(1.2);
    z-index: 5;
  }

  .sg-cell.empty {
    background: rgba(255, 255, 255, 0.03);
    cursor: default;
  }

  .sg-cell.empty:hover {
    transform: none;
    filter: none;
  }

  .sg-cell-tooltip {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: #0a0a0a;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 3px;
    padding: 6px 10px;
    font-family: "Space Mono";
    font-size: 0.5rem;
    color: #f0ece4;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    z-index: 20;
    transition: opacity 0.15s;
  }

  .sg-cell:hover .sg-cell-tooltip {
    opacity: 1;
  }

  .sg-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    justify-content: center;
  }

  .sg-leg {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: "Space Mono";
    font-size: 0.54rem;
    color: rgba(240, 236, 228, 0.45);
  }

  .sg-leg-box {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  /* Modal Styles */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9000;
    background: rgba(0, 0, 0, 0.88);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: backdropIn 0.3s ease;
  }

  @keyframes backdropIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-backdrop.closing {
    animation: backdropOut 0.25s ease forwards;
  }

  @keyframes backdropOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }

  .modal-panel {
    position: relative;
    width: 100%;
    max-width: 640px;
    max-height: 90vh;
    background: #0a0a0a;
    border: 1px solid rgba(201, 168, 76, 0.2);
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: modalIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .anime-modal {
    border-color: rgba(224, 92, 122, 0.2) !important;
  }

  .series-modal {
    border-color: rgba(95, 191, 140, 0.2) !important;
  }

  @keyframes modalIn {
    from { opacity: 0; transform: scale(0.94) translateY(20px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  .modal-panel.closing {
    animation: modalOut 0.25s ease forwards;
  }

  @keyframes modalOut {
    from { opacity: 1; transform: scale(1); }
    to { opacity: 0; transform: scale(0.96); }
  }

  .modal-hero {
    position: relative;
    height: 200px;
    flex-shrink: 0;
    overflow: hidden;
  }

  .modal-hero-bg {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    filter: brightness(0.45);
    transform: scale(1.05);
  }

  .modal-hero-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 30%, #0a0a0a 100%);
  }

  .modal-close {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(5, 5, 5, 0.7);
    color: rgba(240, 236, 228, 0.7);
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: 0.2s;
    z-index: 10;
    backdrop-filter: blur(4px);
    line-height: 1;
  }

  .modal-close:hover {
    border-color: #c9a84c;
    color: #c9a84c;
  }

  .modal-order-badge {
    position: absolute;
    top: 16px;
    left: 16px;
    font-family: "Space Mono";
    font-size: 0.6rem;
    letter-spacing: 0.15em;
    color: #c9a84c;
    background: rgba(5, 5, 5, 0.75);
    border: 1px solid rgba(201, 168, 76, 0.35);
    padding: 5px 12px;
    border-radius: 2px;
    backdrop-filter: blur(4px);
    z-index: 10;
  }

  .anime-badge {
    color: #e05c7a !important;
    border-color: rgba(224, 92, 122, 0.35) !important;
  }

  .series-badge {
    color: #5fbf8c !important;
    border-color: rgba(95, 191, 140, 0.35) !important;
  }

  .modal-body {
    overflow-y: auto;
    flex: 1;
    padding: 24px 28px 28px;
    scrollbar-width: thin;
  }

  .modal-title {
    font-family: "Cormorant Garamond";
    font-size: 1.8rem;
    font-weight: 700;
    line-height: 1.05;
    margin-bottom: 8px;
  }

  .modal-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  .modal-pill {
    font-family: "Space Mono";
    font-size: 0.56rem;
    letter-spacing: 0.1em;
    border: 1px solid rgba(255, 255, 255, 0.12);
    padding: 4px 10px;
    border-radius: 2px;
    color: rgba(240, 236, 228, 0.55);
  }

  .modal-overview {
    font-size: 0.9rem;
    line-height: 1.75;
    color: rgba(240, 236, 228, 0.65);
    margin-bottom: 20px;
  }

  .modal-section {
    margin-bottom: 20px;
  }

  .modal-section-title {
    font-family: "Space Mono";
    font-size: 0.58rem;
    letter-spacing: 0.18em;
    color: rgba(201, 168, 76, 0.7);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .anime-mst {
    color: rgba(224, 92, 122, 0.7) !important;
  }

  .series-mst {
    color: rgba(95, 191, 140, 0.7) !important;
  }

  .modal-section-title::after {
    content: "";
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
  }

  .modal-cast-strip {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 6px;
    scrollbar-width: thin;
  }

  .cast-chip {
    flex-shrink: 0;
    background: #111;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 2px;
    padding: 10px 14px;
    text-align: center;
    width: 100px;
  }

  .cast-chip-poster {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    object-fit: cover;
    display: block;
    margin: 0 auto 8px;
    background: #1a1a1a;
  }

  .cast-chip-name {
    font-size: 0.72rem;
    color: rgba(240, 236, 228, 0.7);
    line-height: 1.3;
  }

  .cast-chip-char {
    font-family: "Space Mono";
    font-size: 0.5rem;
    color: rgba(240, 236, 228, 0.3);
    margin-top: 3px;
  }

  @media (max-width: 768px) {
    .nav {
      padding: 14px 20px;
    }
    .guide-hero-content {
      padding: 0 24px 32px;
    }
    .tab-bar {
      padding: 0 20px;
      top: 60px;
    }
    .tab-btn {
      padding: 16px 10px;
      font-size: 0.58rem;
    }
    .episodes-section {
      padding: 40px 20px 80px;
    }
    .ep-grid {
      grid-template-columns: 1fr;
    }
    .modal-body {
      padding: 20px;
    }
  }
</style>