<script>
// @ts-nocheck

  import { onMount } from 'svelte';
  
  const TMDB_KEY = '175b19b3ba717bf4f24e37ee4325be7e';
  const BASE = 'https://api.themoviedb.org/3';
  const IMG = 'https://image.tmdb.org/t/p/';
  
  let itemType = $state('');
  let itemId = $state('');
  let qs = $state('');
  
  let sel = $state(null);
  let guideEntries = $state([]);
  let chartMode = $state('bar');
  let loading = $state(true);
  let error = $state(null);
  
  // Hover state
  let hoverItem = $state(null);
  let hoverX = $state(0);
  let hoverY = $state(0);
  let showHover = $state(false);
  
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  
  function fmtR(r) {
    return r > 0 ? r.toFixed(1) : '—';
  }
  
  function accentCol(t) {
    return t === 'anime' ? '#e05c7a' : t === 'series' ? '#5fbf8c' : '#c9a84c';
  }
  
  function getYearRange(parts) {
    const y = (parts || []).map(p => +(p.release_date || p.first_air_date || '').slice(0, 4)).filter(Boolean).sort((a, b) => a - b);
    return y.length ? `${y[0]}–${y[y.length - 1]}` : 'N/A';
  }
  
  function barColor(r) {
    if (r >= 7.5) return '#5fbf8c';
    if (r >= 5.5) return '#c9a84c';
    return '#e74c3c';
  }
  
  function rankClass(r) {
    if (r === 0) return 'rank-none';
    if (r >= 7.5) return 'rank-high';
    if (r >= 5.5) return 'rank-mid';
    return 'rank-low';
  }
  
  function scoreClass(r) {
    if (r === 0) return 'dim';
    if (r >= 7.5) return 'green';
    if (r >= 5.5) return 'gold';
    return 'red';
  }
  
  function goBackToApp() {
    sessionStorage.setItem('wo_from_guide', '1');
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/app';
    }
  }
  
  function handleMouseEnter(item, e) {
    hoverItem = item;
    showHover = true;
    updateHoverPosition(e);
  }
  
  function handleMouseMove(e) {
    updateHoverPosition(e);
  }
  
  function handleMouseLeave() {
    showHover = false;
  }
  
  function updateHoverPosition(e) {
    let px = e.clientX + 20;
    let py = e.clientY - 140;
    if (px + 200 > window.innerWidth) px = e.clientX - 220;
    if (py < 10) py = 10;
    if (py + 290 > window.innerHeight) py = window.innerHeight - 300;
    hoverX = px;
    hoverY = py;
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
          id: itemId,
          type: 'franchises',
          title: (col.name || '').replace(/ Collection$/i, ''),
          entries: parts.length,
          bg: col.backdrop_path ? `${IMG}w1280${col.backdrop_path}` : '',
          poster: col.poster_path ? `${IMG}w500${col.poster_path}` : '',
          years: getYearRange(parts)
        };
        
        let dets = await Promise.all(parts.map(p => 
          fetch(`${BASE}/movie/${p.id}?api_key=${TMDB_KEY}`).then(r => r.json()).catch(() => null)
        ));
        dets = dets.filter(Boolean).sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''));
        
        guideEntries = dets.map((m, i) => ({
          ...m,
          order: i + 1,
          year: (m.release_date || '').slice(0, 4),
          posterUrl: m.poster_path ? `${IMG}w300${m.poster_path}` : '',
          rating: fmtR(m.vote_average || 0),
          ratingNum: m.vote_average || 0,
          title: m.title
        }));
        
      } else if (itemType === 'movies') {
        const m = await fetch(`${BASE}/movie/${itemId}?api_key=${TMDB_KEY}`).then(r => r.json());
        
        sel = {
          id: itemId,
          type: 'movies',
          title: m.title || m.original_title || 'Unknown',
          entries: 1,
          bg: m.backdrop_path ? `${IMG}w1280${m.backdrop_path}` : '',
          poster: m.poster_path ? `${IMG}w500${m.poster_path}` : '',
          years: m.release_date ? m.release_date.slice(0, 4) : 'N/A'
        };
        
        guideEntries = [{
          ...m,
          order: 1,
          year: (m.release_date || '').slice(0, 4),
          posterUrl: m.poster_path ? `${IMG}w300${m.poster_path}` : '',
          rating: fmtR(m.vote_average || 0),
          ratingNum: m.vote_average || 0,
          title: m.title
        }];
        
      } else if (isTV) {
        const sd = await fetch(`${BASE}/tv/${itemId}?api_key=${TMDB_KEY}`).then(r => r.json());
        const seasons = (sd.seasons || []).filter(s => s.season_number > 0);
        
        sel = {
          id: +itemId,
          type: itemType,
          title: sd.name || sd.original_name || 'Unknown',
          entries: seasons.length,
          bg: sd.backdrop_path ? `${IMG}w1280${sd.backdrop_path}` : '',
          poster: sd.poster_path ? `${IMG}w500${sd.poster_path}` : '',
          years: sd.first_air_date ? sd.first_air_date.slice(0, 4) + (sd.last_air_date && sd.status !== 'Returning Series' ? '–' + sd.last_air_date.slice(0, 4) : '–') : 'N/A',
          status: sd.status || ''
        };
        
        guideEntries = seasons.map((s, i) => ({
          ...s,
          order: i + 1,
          year: (s.air_date || '').slice(0, 4),
          posterUrl: s.poster_path ? `${IMG}w300${s.poster_path}` : (sd.poster_path ? `${IMG}w300${sd.poster_path}` : ''),
          title: s.name || 'Season ' + s.season_number,
          ratingNum: s.vote_average || 0,
          rating: fmtR(s.vote_average || 0)
        }));
      }
      
      document.title = sel.title + ' · Ratings · WatchOrder';
      loading = false;
    } catch (e) {
      console.error(e);
      error = 'Could not load.';
      loading = false;
    }
  }
  
  // Derived values
  let ac = $derived(sel?.type === 'anime' ? 'anime' : sel?.type === 'series' ? 'series' : '');
  let isTV = $derived(sel?.type === 'anime' || sel?.type === 'series');
  let isFr = $derived(sel?.type === 'franchises');
  let isSM = $derived(sel?.type === 'movies');
  let acColor = $derived(accentCol(sel?.type));
  
  let ratedMovies = $derived(guideEntries.filter(m => m.ratingNum > 0));
  let avgRating = $derived(ratedMovies.length ? (ratedMovies.reduce((a, m) => a + m.ratingNum, 0) / ratedMovies.length).toFixed(1) : '—');
  let highest = $derived(ratedMovies.length ? ratedMovies.reduce((a, m) => m.ratingNum > a.ratingNum ? m : a, ratedMovies[0]) : null);
  let lowest = $derived(ratedMovies.length ? ratedMovies.reduce((a, m) => m.ratingNum < a.ratingNum ? m : a, ratedMovies[0]) : null);
  let sortedEntries = $derived([...guideEntries].sort((a, b) => b.ratingNum - a.ratingNum));
  
  // Chart calculations for line chart
  let chartWidth = $state(800);
  let chartHeight = 260;
  let chartPadding = { top: 28, right: 16, bottom: 36, left: 40 };
  let chartInnerWidth = $derived(chartWidth - chartPadding.left - chartPadding.right);
  let chartInnerHeight = $derived(chartHeight - chartPadding.top - chartPadding.bottom);
  
  function getXPos(i, n) {
    return chartPadding.left + (n === 1 ? chartInnerWidth / 2 : (i / (n - 1)) * chartInnerWidth);
  }
  
  function getYPos(v) {
    return chartPadding.top + chartInnerHeight - (v / 10) * chartInnerHeight;
  }
  
  let chartPoints = $derived(guideEntries.map((m, i) => ({
    x: getXPos(i, guideEntries.length),
    y: getYPos(m.ratingNum),
    m,
    i
  })));
  
  let ratedPoints = $derived(chartPoints.filter(p => p.m.ratingNum > 0));
  
  let linePath = $derived(ratedPoints.length >= 2 
    ? ratedPoints.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ')
    : ''
  );
  
  let areaPath = $derived(ratedPoints.length >= 2 && ratedPoints[0] && ratedPoints[ratedPoints.length - 1]
    ? ratedPoints.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ') + 
      ' L' + ratedPoints[ratedPoints.length - 1].x + ',' + (chartPadding.top + chartInnerHeight) + 
      ' L' + ratedPoints[0].x + ',' + (chartPadding.top + chartInnerHeight) + ' Z'
    : ''
  );
  
  onMount(() => {
    const url = new URL(window.location.href);
    itemType = url.searchParams.get('type') || '';
    itemId = url.searchParams.get('id') || '';
    qs = '?type=' + encodeURIComponent(itemType) + '&id=' + encodeURIComponent(itemId);
    
    if (!itemType || !itemId) {
      error = 'No guide found.';
      loading = false;
    } else {
      loadItem();
    }
  });
</script>

<div class="grain"></div>

<!-- Hover Poster Card -->
{#if showHover && hoverItem}
  <div class="hover-poster-card visible" style="left: {hoverX}px; top: {hoverY}px">
    <img src={hoverItem.posterUrl || ''} alt="" />
    <div class="poster-title">{hoverItem.title || hoverItem.name || ''}</div>
    <div class="poster-meta">
      <span>{hoverItem.year || ''}</span>
      <span>{hoverItem.ratingNum > 0 ? '★ ' + hoverItem.rating : ''}</span>
    </div>
  </div>
{/if}

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
    <p>LOADING RATINGS...</p>
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
          <span>RATINGS & SCORES</span>
        </div>
        <h1 class="guide-title">{sel.title}</h1>
        <div class="guide-meta-row">
          {#if isTV}
            <span class="guide-pill {ac}-pill">{sel.entries} SEASONS</span>
            <span class="guide-pill">{sel.years || ''}</span>
          {:else}
            <span class="guide-pill">{isFr ? sel.entries + ' FILMS' : 'FILM'}</span>
            <span class="guide-pill">{sel.years || ''}</span>
          {/if}
        </div>
      </div>
    </div>
    
    <!-- Tabs -->
    <div class="tab-bar">
      {#if isTV}
        <a class="tab-btn" href="guide{qs}">WATCH ORDER</a>
        <a class="tab-btn" href="episodes{qs}">EPISODES</a>
        <a class="tab-btn" href="history{qs}">HISTORY</a>
        <a class="tab-btn tab-active {ac}-tab" href="ratings{qs}">RATINGS</a>
        <a class="tab-btn" href="reviews{qs}">REVIEWS</a>
      {:else if isFr}
        <a class="tab-btn" href="guide{qs}">WATCH ORDER</a>
        <a class="tab-btn" href="history{qs}">HISTORY</a>
        <a class="tab-btn tab-active" href="ratings{qs}">RATINGS</a>
        <a class="tab-btn" href="reviews{qs}">REVIEWS</a>
      {:else}
        <a class="tab-btn" href="guide{qs}">FILM INFO</a>
        <a class="tab-btn tab-active" href="ratings{qs}">RATINGS</a>
        <a class="tab-btn" href="reviews{qs}">REVIEWS</a>
      {/if}
    </div>
    
    <div class="ratings-section">
      <div class="timeline-intro">
        <div class="overtitle">
          <span class="bar"></span>
          <span>RATINGS</span>
        </div>
        <p class="section-subtitle">TMDB ratings overview.</p>
      </div>
      
      <!-- Stats Row -->
      <div class="ratings-stat-row">
        <div class="ratings-stat-card avg">
          <div class="stat-value gold">{avgRating}</div>
          <div class="stat-label">AVG RATING</div>
          <div class="stat-sub">{ratedMovies.length} rated</div>
        </div>
        <div class="ratings-stat-card high">
          <div class="stat-value green">{highest ? highest.rating : '—'}</div>
          <div class="stat-label">HIGHEST</div>
          <div class="stat-sub">{highest ? (highest.title || highest.name || '') : '—'}</div>
        </div>
        <div class="ratings-stat-card low">
          <div class="stat-value red">{lowest ? lowest.rating : '—'}</div>
          <div class="stat-label">LOWEST</div>
          <div class="stat-sub">{lowest ? (lowest.title || lowest.name || '') : '—'}</div>
        </div>
        <div class="ratings-stat-card total">
          <div class="stat-value dim">{guideEntries.length}</div>
          <div class="stat-label">{isTV ? 'SEASONS' : isFr ? 'FILMS' : 'TOTAL'}</div>
        </div>
      </div>
      
      <!-- Chart Toggle -->
      <div class="chart-toggle-row">
        <h3>Rating Chart</h3>
        <div class="toggle-pills">
          <button 
            class="toggle-pill {chartMode === 'bar' ? 'active' : ''}" 
            onclick={() => chartMode = 'bar'}
          >
            BAR
          </button>
          <button 
            class="toggle-pill {chartMode === 'line' ? 'active' : ''}" 
            onclick={() => chartMode = 'line'}
          >
            LINE
          </button>
        </div>
      </div>
      
      <!-- Chart -->
      <div class="chart-shell">
        {#if guideEntries.length === 0}
          <div style="opacity:0.3;padding:40px;text-align:center">No data</div>
        {:else if chartMode === 'bar'}
          <!-- Bar Chart -->
          <div class="chart-area">
            <div class="y-axis">
              {#each [10, 8, 6, 4, 2, 0] as v}
                <span class="y-tick">{v}</span>
              {/each}
            </div>
            <div class="chart-inner">
              {#each [0, 20, 40, 60, 80, 100] as p}
                <div class="h-grid-line" style="bottom: {p}%"></div>
              {/each}
              <div class="bars-row">
                {#each guideEntries as m, i}
                  {@const pct = m.ratingNum === 0 ? 4 : (m.ratingNum / 10) * 100}
                  {@const bc = m.ratingNum === 0 ? 'rgba(255,255,255,0.06)' : barColor(m.ratingNum)}
                  <div 
                    class="bar-col"
                    onmouseenter={(e) => handleMouseEnter(m, e)}
                    onmousemove={handleMouseMove}
                    onmouseleave={handleMouseLeave}
                  >
                    <span class="bar-top-label">{m.ratingNum > 0 ? m.rating : ''}</span>
                    <div class="bar-body" style="height: {pct}%; background: {bc}"></div>
                    <span class="bar-x-label">#{m.order}</span>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {:else}
          <!-- Line Chart -->
          <svg viewBox="0 0 {chartWidth} {chartHeight}" style="width:100%;display:block;overflow:visible">
            <defs>
              <linearGradient id="lcG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color={acColor} stop-opacity="0.18"/>
                <stop offset="100%" stop-color={acColor} stop-opacity="0"/>
              </linearGradient>
            </defs>
            
            <!-- Grid lines -->
            {#each [0, 2, 4, 6, 8, 10] as v}
              {@const y = getYPos(v)}
              <line stroke="rgba(255,255,255,0.04)" stroke-width="1" x1={chartPadding.left} y1={y} x2={chartWidth - chartPadding.right} y2={y}/>
              <text x={chartPadding.left - 6} y={y + 4} class="lc-x-label" text-anchor="end">{v}</text>
            {/each}
            
            <!-- Area fill -->
            {#if areaPath}
              <path d={areaPath} fill="url(#lcG)"/>
            {/if}
            
            <!-- Line - FIXED: using path with explicit stroke attributes -->
            {#if linePath}
              <path 
                d={linePath} 
                fill="none"
                stroke={acColor}
                stroke-width="2"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
            {/if}
            
            <!-- Dots and labels -->
            {#each chartPoints as p}
              {@const strokeColor = p.m.ratingNum === 0 ? 'rgba(255,255,255,0.15)' : acColor}
              <circle 
                cx={p.x} 
                cy={p.m.ratingNum > 0 ? p.y : getYPos(0)} 
                r="4" 
                fill="#0d0d0d"
                stroke={strokeColor}
                stroke-width="2"
                style="cursor: pointer; transition: r 0.2s;"
                onmouseenter={(e) => handleMouseEnter(p.m, e)}
                onmousemove={handleMouseMove}
                onmouseleave={handleMouseLeave}
              />
              {#if guideEntries.length <= 12 && p.m.ratingNum > 0}
                <text x={p.x} y={p.y - 10} class="lc-label">{p.m.rating}</text>
              {/if}
              <text x={p.x} y={chartPadding.top + chartInnerHeight + 18} class="lc-x-label">#{p.m.order}</text>
            {/each}
          </svg>
        {/if}
      </div>
      
      <!-- Ranked List -->
      <div style="margin-top:40px">
        <div class="overtitle" style="margin-bottom:20px">
          <span class="bar"></span>
          <span>RANKED</span>
        </div>
        <div class="ranked-list">
          {#each sortedEntries as m, i}
            <div 
              class="ranked-item {rankClass(m.ratingNum)}"
              onmouseenter={(e) => handleMouseEnter(m, e)}
              onmousemove={handleMouseMove}
              onmouseleave={handleMouseLeave}
            >
              <span class="rank-num">{m.ratingNum > 0 ? '#' + (i + 1) : '—'}</span>
              <div class="rank-poster">
                {#if m.posterUrl}
                  <img src={m.posterUrl} loading="lazy" alt="" />
                {:else}
                  <div style="height:100%;background:#111"></div>
                {/if}
              </div>
              <div class="rank-info">
                <div class="rank-title">{m.title || m.name || ''}</div>
                <div class="rank-year">{m.year || ''}</div>
              </div>
              <div class="rank-bar-wrap">
                <div class="rank-bar-track">
                  <div class="rank-bar-fill" style="width: {(m.ratingNum / 10) * 100}%; background: {barColor(m.ratingNum)}"></div>
                </div>
                <span class="rank-score {scoreClass(m.ratingNum)}">{m.ratingNum > 0 ? m.rating + '/10' : '—'}</span>
              </div>
              <span class="rank-score {scoreClass(m.ratingNum)}" style="min-width:36px;text-align:right">{m.ratingNum > 0 ? m.rating : ''}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </main>
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

  .ratings-section {
    padding: 70px 70px 120px;
  }

  .timeline-intro {
    margin-bottom: 40px;
  }

  .section-subtitle {
    opacity: 0.5;
    font-size: 0.9rem;
    margin-top: 12px;
  }

  .ratings-stat-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 36px;
  }

  .ratings-stat-card {
    background: #0d0d0d;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    padding: 24px 20px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .ratings-stat-card::before {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
  }

  .ratings-stat-card.avg::before {
    background: #c9a84c;
  }

  .ratings-stat-card.high::before {
    background: #5fbf8c;
  }

  .ratings-stat-card.low::before {
    background: #e74c3c;
  }

  .ratings-stat-card.total::before {
    background: rgba(201, 168, 76, 0.3);
  }

  .stat-value {
    font-family: "Cormorant Garamond";
    font-size: 2.8rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 6px;
  }

  .stat-value.gold {
    color: #c9a84c;
  }

  .stat-value.green {
    color: #5fbf8c;
  }

  .stat-value.red {
    color: #e74c3c;
  }

  .stat-value.dim {
    color: rgba(240, 236, 228, 0.5);
  }

  .stat-label {
    font-family: "Space Mono";
    font-size: 0.55rem;
    letter-spacing: 0.14em;
    color: rgba(240, 236, 228, 0.35);
  }

  .stat-sub {
    font-size: 0.7rem;
    color: rgba(240, 236, 228, 0.35);
    margin-top: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chart-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .chart-toggle-row h3 {
    font-family: "Cormorant Garamond";
    font-size: 1.6rem;
    font-weight: 600;
  }

  .toggle-pills {
    display: flex;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
  }

  .toggle-pill {
    display: flex;
    align-items: center;
    background: none;
    border: none;
    color: rgba(240, 236, 228, 0.35);
    font-family: "Space Mono";
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    padding: 8px 16px;
    cursor: pointer;
    transition: 0.2s;
  }

  .toggle-pill:first-child {
    border-right: 1px solid rgba(255, 255, 255, 0.1);
  }

  .toggle-pill.active {
    background: rgba(201, 168, 76, 0.12);
    color: #c9a84c;
  }

  .chart-shell {
    background: #0d0d0d;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    padding: 36px 36px 20px;
    margin-bottom: 40px;
    overflow-x: auto;
  }

  .chart-area {
    position: relative;
    height: 320px;
    display: flex;
    min-width: 600px;
  }

  .y-axis {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding-bottom: 36px;
    padding-right: 12px;
    width: 36px;
    flex-shrink: 0;
  }

  .y-tick {
    font-family: "Space Mono";
    font-size: 0.52rem;
    color: rgba(240, 236, 228, 0.2);
    text-align: right;
  }

  .chart-inner {
    position: relative;
    flex: 1;
    padding-bottom: 36px;
  }

  .h-grid-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background: rgba(255, 255, 255, 0.04);
  }

  .bars-row {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 36px;
    top: 0;
    display: flex;
    align-items: flex-end;
    gap: 6px;
    padding: 0 4px;
  }

  .bar-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
    position: relative;
    cursor: pointer;
  }

  .bar-col:hover .bar-body {
    filter: brightness(1.25);
  }

  .bar-top-label {
    font-family: "Space Mono";
    font-size: 0.58rem;
    color: rgba(240, 236, 228, 0.7);
    margin-bottom: 4px;
    white-space: nowrap;
  }

  .bar-body {
    width: 100%;
    border-radius: 2px 2px 0 0;
    transition: filter 0.2s;
    min-height: 4px;
  }

  .bar-x-label {
    position: absolute;
    bottom: -28px;
    left: 50%;
    transform: translateX(-50%);
    font-family: "Space Mono";
    font-size: 0.5rem;
    color: rgba(240, 236, 228, 0.3);
    white-space: nowrap;
  }

  .lc-label {
    font-family: "Space Mono";
    font-size: 10px;
    fill: rgba(240, 236, 228, 0.6);
    text-anchor: middle;
    pointer-events: none;
  }

  .lc-x-label {
    font-family: "Space Mono";
    font-size: 9px;
    fill: rgba(240, 236, 228, 0.25);
    text-anchor: middle;
  }

  .ranked-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 8px;
  }

  .ranked-item {
    display: flex;
    align-items: center;
    gap: 16px;
    background: #0d0d0d;
    border: 1px solid rgba(255, 255, 255, 0.05);
    padding: 14px 18px;
    border-radius: 3px;
    transition: border-color 0.2s;
    position: relative;
    overflow: hidden;
    cursor: default;
  }

  .ranked-item:hover {
    border-color: rgba(201, 168, 76, 0.25);
  }

  .ranked-item::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
  }

  .rank-high::before {
    background: #5fbf8c;
  }

  .rank-mid::before {
    background: #c9a84c;
  }

  .rank-low::before {
    background: #e74c3c;
  }

  .rank-none::before {
    background: rgba(255, 255, 255, 0.1);
  }

  .rank-num {
    font-family: "Space Mono";
    font-size: 0.6rem;
    color: rgba(240, 236, 228, 0.25);
    min-width: 24px;
  }

  .rank-poster {
    width: 40px;
    height: 56px;
    border-radius: 2px;
    overflow: hidden;
    flex-shrink: 0;
    background: #111;
  }

  .rank-poster img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .rank-info {
    flex: 1;
    min-width: 0;
  }

  .rank-title {
    font-family: "Cormorant Garamond";
    font-size: 1rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rank-year {
    font-size: 0.68rem;
    color: rgba(240, 236, 228, 0.35);
    margin-top: 2px;
  }

  .rank-bar-wrap {
    width: 120px;
    flex-shrink: 0;
  }

  .rank-bar-track {
    height: 3px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 2px;
    margin-bottom: 4px;
  }

  .rank-bar-fill {
    height: 100%;
    border-radius: 2px;
  }

  .rank-score {
    font-family: "Space Mono";
    font-size: 0.7rem;
    font-weight: 700;
  }

  .rank-score.gold {
    color: #c9a84c;
  }

  .rank-score.green {
    color: #5fbf8c;
  }

  .rank-score.red {
    color: #e74c3c;
  }

  .rank-score.dim {
    color: rgba(240, 236, 228, 0.25);
  }

  .hover-poster-card {
    position: fixed;
    width: 200px;
    background: #0a0a0a;
    border: 1px solid rgba(201, 168, 76, 0.4);
    border-radius: 8px;
    padding: 10px;
    pointer-events: none;
    opacity: 0;
    z-index: 1001;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8);
    transition: opacity 0.2s;
    font-family: "Sora", sans-serif;
  }

  .hover-poster-card.visible {
    opacity: 1;
  }

  .hover-poster-card img {
    width: 100%;
    aspect-ratio: 2/3;
    object-fit: cover;
    border-radius: 6px;
    margin-bottom: 10px;
  }

  .hover-poster-card .poster-title {
    font-family: "Cormorant Garamond";
    font-size: 0.9rem;
    font-weight: 600;
    color: #f0ece4;
    margin-bottom: 4px;
  }

  .hover-poster-card .poster-meta {
    font-family: "Space Mono";
    font-size: 0.55rem;
    color: #c9a84c;
    display: flex;
    justify-content: space-between;
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
    .ratings-section {
      padding: 40px 20px 80px;
    }
    .ratings-stat-row {
      grid-template-columns: repeat(2, 1fr);
    }
    .rank-bar-wrap {
      display: none;
    }
  }
</style>