<script>
// @ts-nocheck

  import { onMount } from 'svelte';
  
  const TMDB_KEY = '175b19b3ba717bf4f24e37ee4325be7e';
  const BASE = 'https://api.themoviedb.org/3';
  const IMG = 'https://image.tmdb.org/t/p/';
  
  let sel = $state(null);
  let guideEntries = $state([]);
  let loading = $state(true);
  let error = $state(null);
  
  const params = new URLSearchParams(window.location.search);
  const itemType = params.get('type') || '';
  const itemId = params.get('id') || '';
  const QS = `?type=${encodeURIComponent(itemType)}&id=${encodeURIComponent(itemId)}`;
  
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  
  function fmtR(r) {
    return r > 0 ? r.toFixed(1) : '—';
  }
  
  function getYearRange(parts) {
    const y = (parts || []).map(p => +(p.release_date || p.first_air_date || '').slice(0,4)).filter(Boolean).sort((a,b) => a-b);
    return y.length ? `${y[0]}–${y[y.length-1]}` : 'N/A';
  }
  
  function accentCol(t) {
    return t === 'anime' ? '#e05c7a' : t === 'series' ? '#5fbf8c' : '#c9a84c';
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
      const isTV = itemType === 'anime' || itemType === 'series';
      const isFr = itemType === 'franchises';
      
      if (isFr) {
        const colId = String(itemId).replace(/^col_/, '');
        const col = await fetch(`${BASE}/collection/${colId}?api_key=${TMDB_KEY}`).then(r => r.json());
        const parts = (col.parts || []).filter(p => p.release_date).sort((a,b) => a.release_date.localeCompare(b.release_date));
        sel = {
          id: itemId, type: 'franchises', title: (col.name || '').replace(/ Collection$/i, ''),
          entries: parts.length, bg: col.backdrop_path ? `${IMG}/w1280${col.backdrop_path}` : '',
          poster: col.poster_path ? `${IMG}/w500${col.poster_path}` : '', years: getYearRange(parts)
        };
        let dets = await Promise.all(parts.map(p => fetch(`${BASE}/movie/${p.id}?api_key=${TMDB_KEY}&append_to_response=credits`).then(r => r.json()).catch(() => null)));
        dets = dets.filter(Boolean).sort((a,b) => (a.release_date || '').localeCompare(b.release_date || ''));
        guideEntries = dets.map((m,i) => ({
          ...m, order: i+1, year: (m.release_date || '').slice(0,4),
          posterUrl: m.poster_path ? `${IMG}/w300${m.poster_path}` : '',
          runtime: m.runtime ? `${Math.floor(m.runtime/60)}h ${m.runtime%60}m` : 'N/A',
          rating: fmtR(m.vote_average || 0), ratingNum: m.vote_average || 0,
          director: (m.credits?.crew || []).find(c => c.job === 'Director')?.name || 'Unknown'
        }));
      } else if (itemType === 'movies') {
        const m = await fetch(`${BASE}/movie/${itemId}?api_key=${TMDB_KEY}&append_to_response=credits`).then(r => r.json());
        sel = {
          id: itemId, type: 'movies', title: m.title || m.original_title || 'Unknown',
          entries: 1, bg: m.backdrop_path ? `${IMG}/w1280${m.backdrop_path}` : '',
          poster: m.poster_path ? `${IMG}/w500${m.poster_path}` : '', years: m.release_date ? m.release_date.slice(0,4) : 'N/A'
        };
        guideEntries = [{
          ...m, order: 1, year: (m.release_date || '').slice(0,4),
          posterUrl: m.poster_path ? `${IMG}/w300${m.poster_path}` : '',
          runtime: m.runtime ? `${Math.floor(m.runtime/60)}h ${m.runtime%60}m` : 'N/A',
          rating: fmtR(m.vote_average || 0), ratingNum: m.vote_average || 0,
          director: (m.credits?.crew || []).find(c => c.job === 'Director')?.name || 'Unknown'
        }];
      } else if (isTV) {
        const sd = await fetch(`${BASE}/tv/${itemId}?api_key=${TMDB_KEY}&append_to_response=credits`).then(r => r.json());
        const seasons = (sd.seasons || []).filter(s => s.season_number > 0);
        sel = {
          id: +itemId, type: itemType, title: sd.name || sd.original_name || 'Unknown',
          entries: seasons.length, bg: sd.backdrop_path ? `${IMG}/w1280${sd.backdrop_path}` : '',
          poster: sd.poster_path ? `${IMG}/w500${sd.poster_path}` : '',
          years: sd.first_air_date ? sd.first_air_date.slice(0,4) + (sd.last_air_date && sd.status !== 'Returning Series' ? `–${sd.last_air_date.slice(0,4)}` : '–') : 'N/A',
          status: sd.status || ''
        };
        guideEntries = seasons.map((s,i) => ({
          ...s, order: i+1, year: (s.air_date || '').slice(0,4),
          posterUrl: s.poster_path ? `${IMG}/w300${s.poster_path}` : (sd.poster_path ? `${IMG}/w300${sd.poster_path}` : ''),
          title: s.name || `Season ${s.season_number}`,
          overview: s.overview || sd.overview || '',
          ratingNum: s.vote_average || 0, rating: fmtR(s.vote_average || 0),
          runtime: sd.episode_run_time?.[0] ? `~${sd.episode_run_time[0]}m/ep` : 'N/A',
          episode_count: s.episode_count || 0,
          director: (sd.credits?.crew || []).find(c => c.job === 'Director' || c.job === 'Executive Producer')?.name || 'Unknown'
        }));
      }
      
      document.title = `${sel.title} · History · WatchOrder`;
      loading = false;
    } catch(e) {
      console.error(e);
      error = e.message;
      loading = false;
    }
  }
  
  onMount(() => {
    if (!itemType || !itemId) {
      error = 'No guide found';
      loading = false;
    } else {
      loadItem();
    }
  });
</script>

<div class="grain"></div>
<nav class="nav">
  <a class="nav-logo" href="/">
    <span class="nav-logo-mark">W</span><span class="nav-logo-text">atch</span><span class="nav-logo-accent">Order</span>
    <div class="nav-logo-dot"></div>
  </a>
</nav>

{#if loading}
  <div class="loader">
    <div class="spinner"></div>
    <p>LOADING HISTORY...</p>
  </div>
{:else if error}
  <div class="error-page">
    <h2>404</h2>
    <p>{error}</p>
    <button class="back-button" on:click={goBackToApp}>← BACK</button>
  </div>
{:else if sel}
  {@const isTV = sel.type === 'anime' || sel.type === 'series'}
  {@const isFr = sel.type === 'franchises'}
  {@const ac = sel.type === 'anime' ? 'anime' : sel.type === 'series' ? 'series' : ''}
  {@const hyClass = ac ? `${ac}-hy` : ''}
  {@const acC = accentCol(sel.type)}
  {@const act = `tab-btn tab-active${ac ? ` ${ac}-tab` : ''}`}
  {@const inact = 'tab-btn'}
  
  {@const byY = {}}
  {#each guideEntries as m}
    {@const y = m.year || '?'}
    {#if !byY[y]} {@const _ = (byY[y] = [])} {/if}
    {#if byY[y]} {byY[y].push(m)} {/if}
  {/each}
  
  <main class="guide-container">
    <div class="guide-hero" style="background-image: url({sel.bg || sel.poster || ''})">
      <div class="guide-hero-overlay"></div>
      <div class="guide-hero-content">
        <button class="back-button" on:click={goBackToApp}>← BACK</button>
        <div class="overtitle"><span class="bar"></span><span>{isTV ? 'ANIME' : 'FRANCHISE'} · HISTORY</span></div>
        <h1 class="guide-title">{esc(sel.title)}</h1>
        <div class="guide-meta-row">
          {#if isTV}
            <span class="guide-pill {ac ? `${ac}-pill` : ''}">{sel.entries} SEASONS</span>
            <span class="guide-pill">{sel.years || ''}</span>
          {:else}
            <span class="guide-pill">{sel.entries} FILMS</span>
            <span class="guide-pill">{sel.years || ''}</span>
          {/if}
        </div>
      </div>
    </div>
    
    {#if isTV}
      <div class="tab-bar">
        <a class={inact} href={`guide${QS}`}>WATCH ORDER</a>
        <a class={inact} href={`episodes${QS}`}>EPISODES</a>
        <a class={act} href={`history${QS}`}>HISTORY</a>
        <a class={inact} href={`ratings${QS}`}>RATINGS</a>
        <a class={inact} href={`reviews${QS}`}>REVIEWS</a>
      </div>
    {:else}
      <div class="tab-bar">
        <a class={inact} href={`guide${QS}`}>WATCH ORDER</a>
        <a class={act} href={`history${QS}`}>HISTORY</a>
        <a class={inact} href={`ratings${QS}`}>RATINGS</a>
        <a class={inact} href={`reviews${QS}`}>REVIEWS</a>
      </div>
    {/if}
    
    <div class="history-section">
      <div class="timeline-intro">
        <div class="overtitle {ac ? `${ac}-color` : ''}">
          <span class="bar"></span>
          <span>{isTV ? 'AIRDATE HISTORY' : 'RELEASE HISTORY'}</span>
        </div>
        <p class="section-subtitle">Evolution across years.</p>
      </div>
      
      {#each Object.entries(byY).sort((a,b) => +a[0] - +b[0]) as [year, items]}
        <div class="history-year {hyClass}">{year}</div>
        {#each items as m}
          <div class="history-card">
            <img src={m.posterUrl || ''} on:error={(e) => e.target.style.display = 'none'} loading="lazy" />
            <div class="history-card-info">
              <div style="font-family:'Space Mono';font-size:0.58rem;color:{acC};margin-bottom:4px">#{m.order}</div>
              <h4 class="history-card-title">{esc(m.title || m.name || '')}</h4>
              <div style="font-size:0.68rem;opacity:0.45;margin-top:4px">
                {m.runtime || ''} · ★ {m.rating}{m.director ? ` · ${esc(m.director)}` : ''}
              </div>
              <p style="font-size:0.76rem;opacity:0.4;margin-top:8px;line-height:1.5">
                {esc((m.overview || '').slice(0,100))}{(m.overview || '').length > 100 ? '...' : ''}
              </p>
            </div>
          </div>
        {/each}
      {/each}
      
      <div class="span-bar"><div class="span-fill"></div></div>
    </div>
  </main>
{/if}

<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
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
    background: linear-gradient(to bottom, rgba(5, 5, 5, 0.2) 0%, rgba(5, 5, 5, 0.7) 60%, #050505 100%);
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

  .history-section {
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

  .history-card {
    background: #0d0d0d;
    border: 1px solid rgba(255, 255, 255, 0.05);
    margin-bottom: 14px;
    display: flex;
    overflow: hidden;
    transition: border-color 0.2s;
  }

  .history-card:hover {
    border-color: rgba(201, 168, 76, 0.2);
  }

  .history-card img {
    width: 72px;
    object-fit: cover;
    flex-shrink: 0;
    background: #111;
  }

  .history-card-info {
    padding: 16px 20px;
    flex: 1;
  }

  .history-card-title {
    font-family: "Cormorant Garamond";
    font-size: 1.2rem;
    font-weight: 600;
    margin-bottom: 6px;
  }

  .history-year {
    font-family: "Cormorant Garamond";
    font-size: 2.2rem;
    font-weight: 300;
    color: rgba(201, 168, 76, 0.6);
    margin: 32px 0 12px;
  }

  .anime-hy {
    color: rgba(224, 92, 122, 0.6) !important;
  }

  .series-hy {
    color: rgba(95, 191, 140, 0.6) !important;
  }

  .span-bar {
    height: 2px;
    background: rgba(255, 255, 255, 0.06);
    position: relative;
    margin-top: 32px;
  }

  .span-fill {
    position: absolute;
    height: 100%;
    background: #c9a84c;
    opacity: 0.35;
    width: 100%;
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
    .history-section {
      padding: 40px 20px 80px;
    }
  }
</style>