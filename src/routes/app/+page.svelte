<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  
  const TMDB_KEY = '175b19b3ba717bf4f24e37ee4325be7e';
  const BASE = 'https://api.themoviedb.org/3';
  const IMG = 'https://image.tmdb.org/t/p';
  const PAGE_SIZE = 24;
  
  // State
  let activeFilter = $state('all');
  let page = $state(0);
  let searchQ = $state('');
  let allItems = $state([]);
  let filteredItems = $state([]);
  let currentItems = $state([]);
  let loadState = $state({ franchises: false, movies: false, anime: false, series: false });
  let idSet = $state({ franchises: new Set(), movies: new Set(), anime: new Set(), series: new Set() });
  let colIdSet = $state(new Set());
  let partIdSet = $state(new Set());
  let navScrolled = $state(false);
  let isSearching = $state(false);
  let searchError = $state('');
  
  // Track which movies belong to which franchise
  let franchiseMovies = $state(new Map()); // franchiseId -> Set of movieIds
  
  // Derived values
  let done = $derived(Object.values(loadState).every(Boolean));
  let totalFiltered = $derived(filteredItems.length);
  let np = $derived(Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE)));
  let hasPrev = $derived(page > 0);
  let hasNext = $derived(totalFiltered > (page + 1) * PAGE_SIZE);
  
  $effect(() => {
    const p = page;
    const items = filteredItems;
    const start = p * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    currentItems = items.slice(start, end);
  });
  
  // Helpers
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  
  const norm = (s) => s?.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim() || '';
  
  const matchesSearch = (title, desc, q) => {
    if (!q || !title) return false;
    const nt = norm(title);
    const nd = norm(desc || '');
    const nq = norm(q);
    
    if (nt.includes(nq)) return true;
    if (nd.includes(nq)) return true;
    
    const qWords = nq.split(' ').filter(Boolean);
    const tWords = nt.split(' ');
    if (qWords.length > 1 && qWords.every(w => tWords.some(tw => tw === w || tw.startsWith(w)))) return true;
    
    return false;
  };
  
  const getYearRange = (parts) => {
    const y = (parts || []).map(p => +(p.release_date || p.first_air_date || '').slice(0,4)).filter(Boolean).sort((a,b) => a-b);
    return y.length ? `${y[0]}–${y[y.length-1]}` : 'N/A';
  };
  
  const applyFilter = () => {
    const q = searchQ.trim();
    if (!q) {
      filteredItems = activeFilter === 'all' ? [...allItems] : allItems.filter(f => f.type === activeFilter);
    } else {
      filteredItems = allItems.filter(f => {
        const typeMatch = activeFilter === 'all' || f.type === activeFilter;
        return typeMatch && matchesSearch(f.title, f.desc, q);
      });
    }
    page = 0;
  };
  
  const ingestItem = (f) => {
    if (allItems.some(item => item.id === f.id)) return;
    allItems = [...allItems, f];
    const q = searchQ.trim();
    if (q && !matchesSearch(f.title, f.desc, q)) return;
    if (activeFilter !== 'all' && f.type !== activeFilter) return;
    filteredItems = [...filteredItems, f];
  };
  
  const addFranchise = (c) => {
    if (!c.parts || c.parts.length < 2 || idSet.franchises.has(c.id)) return;
    idSet.franchises.add(c.id);
    
    // Track which movies belong to this franchise
    const movieIds = new Set();
    c.parts.forEach(p => {
      partIdSet.add(p.id);
      movieIds.add(p.id);
    });
    franchiseMovies.set(c.id, movieIds);
    
    ingestItem({
      id: 'col_' + c.id, tmdbId: c.id, type: 'franchises',
      title: (c.name || '').replace(/ Collection$/i, ''),
      entries: c.parts.length, desc: c.overview || '',
      bg: c.backdrop_path ? IMG + '/w1280' + c.backdrop_path : '',
      poster: c.poster_path ? IMG + '/w500' + c.poster_path : '',
      years: getYearRange(c.parts),
      year: (c.parts[0]?.release_date || '').slice(0, 4),
      label: c.parts.length > 5 ? 'COMPLEX' : 'LINEAR',
      labelCls: c.parts.length > 5 ? 'lbl-blue' : 'lbl-green',
      ratingNum: 0, rating: '—',
      movieIds: Array.from(movieIds) // Store for reference
    });
    
    // Also add individual movies from this franchise
    c.parts.forEach(p => addFranchiseMovie(p, c.id));
  };
  
  // NEW: Add individual franchise movies as separate entries
  const addFranchiseMovie = (m, franchiseId) => {
    if (!m?.id || idSet.movies.has(m.id)) return;
    idSet.movies.add(m.id);
    
    ingestItem({
      id: m.id,
      type: 'movies',
      title: m.title || m.original_title || 'Unknown',
      entries: 1,
      desc: m.overview || '',
      bg: m.backdrop_path ? IMG + '/w1280' + m.backdrop_path : '',
      poster: m.poster_path ? IMG + '/w500' + m.poster_path : '',
      years: m.release_date ? m.release_date.slice(0, 4) : 'N/A',
      year: m.release_date ? m.release_date.slice(0, 4) : '',
      label: 'FILM',
      labelCls: 'lbl-movie',
      ratingNum: m.vote_average || 0,
      rating: m.vote_average ? m.vote_average.toFixed(1) : '—',
      franchiseId: franchiseId, // Link back to franchise
      isFranchiseMovie: true
    });
  };
  
  const addSingleMovie = (m) => {
    if (!m?.id || idSet.movies.has(m.id)) return;
    idSet.movies.add(m.id);
    
    ingestItem({
      id: m.id, type: 'movies', title: m.title || m.original_title || 'Unknown',
      entries: 1, desc: m.overview || '',
      bg: m.backdrop_path ? IMG + '/w1280' + m.backdrop_path : '',
      poster: m.poster_path ? IMG + '/w500' + m.poster_path : '',
      years: m.release_date ? m.release_date.slice(0, 4) : 'N/A',
      year: m.release_date ? m.release_date.slice(0, 4) : '',
      label: 'FILM', labelCls: 'lbl-movie',
      ratingNum: m.vote_average || 0,
      rating: m.vote_average ? m.vote_average.toFixed(1) : '—'
    });
  };
  
  const addTV = (show, storeKey) => {
    if (!show.id || idSet[storeKey].has(show.id)) return;
    idSet[storeKey].add(show.id);
    ingestItem({
      id: show.id, type: storeKey, title: show.name || show.original_name || 'Unknown',
      entries: show.number_of_seasons || 1, desc: show.overview || '',
      bg: show.backdrop_path ? IMG + '/w1280' + show.backdrop_path : '',
      poster: show.poster_path ? IMG + '/w500' + show.poster_path : '',
      years: show.first_air_date ? show.first_air_date.slice(0,4) + (show.last_air_date && show.status !== 'Returning Series' ? '–' + show.last_air_date.slice(0,4) : '–') : 'N/A',
      year: show.first_air_date ? show.first_air_date.slice(0,4) : '',
      status: show.status || '',
      label: show.status === 'Ended' || show.status === 'Canceled' ? 'ENDED' : 'ONGOING',
      labelCls: show.status === 'Ended' || show.status === 'Canceled' ? 'lbl-ended' : (storeKey === 'anime' ? 'lbl-anime' : 'lbl-series'),
      ratingNum: show.vote_average || 0,
      rating: show.vote_average ? show.vote_average.toFixed(1) : '—'
    });
  };
  
  const fetchCollection = async (id) => {
    try {
      const r = await fetch(`${BASE}/collection/${id}?api_key=${TMDB_KEY}`);
      addFranchise(await r.json());
    } catch(e) {}
  };
  
  const procMovies = async (ids) => {
    const res = await Promise.allSettled(ids.map(id => fetch(`${BASE}/movie/${id}?api_key=${TMDB_KEY}`).then(r => r.json()).catch(() => null)));
    const newCols = [];
    res.forEach(r => {
      if (r.status !== 'fulfilled' || !r.value) return;
      const m = r.value;
      if (m.belongs_to_collection?.id) {
        const cid = m.belongs_to_collection.id;
        if (!colIdSet.has(cid)) {
          colIdSet.add(cid);
          newCols.push(cid);
        }
        // Don't add to partIdSet here - let the franchise handle it
      } else {
        addSingleMovie(m);
      }
    });
    if (newCols.length) await Promise.all(newCols.map(id => fetchCollection(id)));
  };
  
  const fetchTV = async (id, sk) => {
    try {
      const r = await fetch(`${BASE}/tv/${id}?api_key=${TMDB_KEY}`);
      const d = await r.json();
      if (d.number_of_seasons >= 1) addTV(d, sk);
    } catch(e) {}
  };
  
  const searchMedia = async (query, type = 'all') => {
    const normalizedQuery = norm(query);
    const queryWords = normalizedQuery.split(' ').filter(Boolean);
    
    try {
      if (type === 'all' || type === 'movies') {
        const movieRes = await fetch(`${BASE}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&page=1`);
        const movieData = await movieRes.json();
        
        if (movieData.results) {
          const validResults = movieData.results.filter(m => {
            const title = norm(m.title || '');
            const origTitle = norm(m.original_title || '');
            return queryWords.every(w => title.includes(w) || origTitle.includes(w));
          });
          
          for (const m of validResults.slice(0, 10)) {
            if (!idSet.movies.has(m.id)) {
              const details = await fetch(`${BASE}/movie/${m.id}?api_key=${TMDB_KEY}`).then(r => r.json()).catch(() => null);
              if (details?.id) {
                if (details.belongs_to_collection?.id) {
                  // Fetch the full collection to get all movies
                  await fetchCollection(details.belongs_to_collection.id);
                } else {
                  addSingleMovie(details);
                }
              }
            }
          }
        }
      }
      
      if (type === 'all' || type === 'series' || type === 'anime') {
        const tvRes = await fetch(`${BASE}/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&page=1`);
        const tvData = await tvRes.json();
        
        if (tvData.results) {
          const validResults = tvData.results.filter(show => {
            const name = norm(show.name || '');
            const origName = norm(show.original_name || '');
            return queryWords.every(w => name.includes(w) || origName.includes(w));
          });
          
          for (const show of validResults.slice(0, 10)) {
            const isAnime = show.genre_ids?.includes(16) || norm(show.name).includes('anime');
            const storeKey = isAnime ? 'anime' : 'series';
            if (type === 'all' || type === storeKey) {
              if (!idSet[storeKey].has(show.id)) {
                const details = await fetch(`${BASE}/tv/${show.id}?api_key=${TMDB_KEY}`).then(r => r.json()).catch(() => null);
                if (details?.id) addTV(details, storeKey);
              }
            }
          }
        }
      }
    } catch(e) {}
  };
  
  const performSearch = async () => {
    const q = searchQ.trim();
    if (!q) {
      applyFilter();
      return;
    }
    
    isSearching = true;
    searchError = '';
    
    applyFilter();
    
    if (filteredItems.length === 0 && q.length > 1) {
      await searchMedia(q, activeFilter);
      applyFilter();
      
      if (filteredItems.length === 0) {
        searchError = `No results found for "${q}"`;
      }
    }
    
    isSearching = false;
  };
  
  const discoverFranchises = async () => {
    let tp = 200;
    try {
      const r = await fetch(`${BASE}/discover/movie?api_key=${TMDB_KEY}&sort_by=popularity.desc&page=1`);
      tp = Math.min((await r.json()).total_pages || 200, 200);
    } catch(e) {}
    
    const B = 20;
    const pages = Array.from({ length: tp }, (_, i) => i + 1);
    
    for (let i = 0; i < pages.length; i += B) {
      const pr = await Promise.allSettled(pages.slice(i, i + B).map(p => 
        fetch(`${BASE}/discover/movie?api_key=${TMDB_KEY}&sort_by=popularity.desc&page=${p}`)
          .then(r => r.json()).catch(() => ({ results: [] }))
      ));
      const mids = [];
      pr.forEach(r => { if (r.status === 'fulfilled') (r.value.results || []).forEach(m => mids.push(m.id)); });
      for (let j = 0; j < mids.length; j += 40) await procMovies(mids.slice(j, j + 40));
    }
    
    for (const sort of ['vote_count.desc', 'revenue.desc']) {
      for (let p = 1; p <= 40; p++) {
        try {
          const r = await fetch(`${BASE}/discover/movie?api_key=${TMDB_KEY}&sort_by=${sort}&page=${p}`);
          const d = await r.json();
          const mids = (d.results || []).map(m => m.id);
          if (!mids.length) break;
          for (let j = 0; j < mids.length; j += 40) await procMovies(mids.slice(j, j + 40));
          if (d.total_pages <= p) break;
        } catch(e) { break; }
      }
    }
    loadState = { ...loadState, franchises: true };
  };
  
  const discoverMovies = async () => {
    for (const sort of ['popularity.desc', 'vote_average.desc&vote_count.gte=1000', 'revenue.desc']) {
      for (let p = 1; p <= 50; p++) {
        try {
          const r = await fetch(`${BASE}/discover/movie?api_key=${TMDB_KEY}&sort_by=${sort}&page=${p}`);
          const d = await r.json();
          const results = d.results || [];
          if (!results.length) break;
          const ids = results.map(m => m.id).filter(id => !idSet.movies.has(id) && !partIdSet.has(id));
          for (let j = 0; j < ids.length; j += 20) {
            const dets = await Promise.allSettled(ids.slice(j, j + 20).map(id => 
              fetch(`${BASE}/movie/${id}?api_key=${TMDB_KEY}`).then(r => r.json()).catch(() => null)
            ));
            dets.forEach(res => {
              if (res.status !== 'fulfilled' || !res.value) return;
              const m = res.value;
              if (m.belongs_to_collection?.id) {
                const cid = m.belongs_to_collection.id;
                if (!colIdSet.has(cid)) {
                  colIdSet.add(cid);
                  fetchCollection(cid);
                }
              } else {
                addSingleMovie(m);
              }
            });
          }
          if (d.total_pages <= p) break;
        } catch(e) { break; }
      }
    }
    loadState = { ...loadState, movies: true };
  };
  
  const discoverAnime = async () => {
    for (const url of [
      `${BASE}/discover/tv?api_key=${TMDB_KEY}&with_genres=16&with_origin_country=JP&sort_by=popularity.desc`,
      `${BASE}/discover/tv?api_key=${TMDB_KEY}&with_keywords=210024&sort_by=popularity.desc`
    ]) {
      for (let p = 1; p <= 50; p++) {
        try {
          const r = await fetch(`${url}&page=${p}`);
          const d = await r.json();
          const results = d.results || [];
          if (!results.length) break;
          await Promise.allSettled(results.map(x => x.id).filter(id => !idSet.anime.has(id)).map(id => fetchTV(id, 'anime')));
          if (d.total_pages <= p) break;
        } catch(e) { break; }
      }
    }
    loadState = { ...loadState, anime: true };
  };
  
  const discoverSeries = async () => {
    for (const sort of ['popularity.desc', 'vote_count.desc', 'first_air_date.desc']) {
      for (let p = 1; p <= 40; p++) {
        try {
          const r = await fetch(`${BASE}/discover/tv?api_key=${TMDB_KEY}&sort_by=${sort}&page=${p}&without_genres=16&vote_count.gte=50`);
          const d = await r.json();
          const results = d.results || [];
          if (!results.length) break;
          await Promise.allSettled(results.map(x => x.id).filter(id => !idSet.series.has(id)).map(id => fetchTV(id, 'series')));
          if (d.total_pages <= p) break;
        } catch(e) { break; }
      }
    }
    loadState = { ...loadState, series: true };
  };
  
  const goPage = (p) => {
    if (p < 0 || p >= np) return;
    page = p;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const goToGuide = (href, event) => {
    event.preventDefault();
    goto(href);
  };
  
  let searchTimeout;
  $effect(() => {
    const q = searchQ;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => performSearch(), 400);
    return () => clearTimeout(searchTimeout);
  });
  
  onMount(() => {
    discoverFranchises();
    discoverMovies();
    discoverAnime();
    discoverSeries();
  });
</script>

<svelte:window onscroll={() => navScrolled = window.scrollY > 50} />

<div class="grain"></div>
<nav class="nav {navScrolled ? 'nav-scrolled' : ''}">
  <a class="nav-logo" href="/">
    <span class="nav-logo-mark">W</span><span class="nav-logo-text">atch</span><span class="nav-logo-accent">Order</span>
    <div class="nav-logo-dot"></div>
  </a>
  <div class="nav-right">
    <div class="filter-bar">
      {#each [['all', 'ALL'], ['franchises', 'FRANCHISES'], ['movies', 'MOVIES'], ['anime', 'ANIME'], ['series', 'SERIES']] as [type, label]}
        <button class="filter-btn {activeFilter === type ? 'active' : ''}" onclick={() => { activeFilter = type; page = 0; applyFilter(); }}>
          <span class="filter-dot {type}"></span>{label}
        </button>
      {/each}
    </div>
    <div class="search-wrapper">
      <span class="search-icon">⌕</span>
      <input 
        type="text" 
        class="search-input" 
        placeholder="Search titles..." 
        bind:value={searchQ} 
        autocomplete="off"
      />
      {#if isSearching}
        <div class="search-spinner"></div>
      {/if}
    </div>
    <div class="debug-indicator">
      {done ? '✓' : '⚡'} 🎭{allItems.filter(x => x.type === 'franchises').length} 🎬{allItems.filter(x => x.type === 'movies').length} 🌸{allItems.filter(x => x.type === 'anime').length} 📺{allItems.filter(x => x.type === 'series').length}
    </div>
  </div>
</nav>

<main>
  <div class="container">
    <header class="hero">
      <div class="hero-inner">
        <div class="hero-left">
          <div class="overtitle"><span class="bar"></span><span>COMPLETE DATABASE</span></div>
          <h1 class="title">The Entire<br/><em>Watch Universe</em></h1>
          <p class="subtitle">Every franchise, movie, anime, and series in one place.</p>
          <div class="live-counter"><div class="live-dot"></div><span>{totalFiltered} titles loaded</span></div>
        </div>
        <div class="hero-right">
          <a href="/recommendations" class="recommend-btn">
            <span>✦</span>RECOMMEND ME!
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </a>
          <div class="text-[0.55rem] font-mono text-[rgba(201,168,76,0.4)] tracking-widest text-right">PERSONALISED PICKS</div>
        </div>
      </div>
    </header>
    <section>
      {#if isSearching}
        <div class="loading-more" style="padding:80px 0">
          <div class="spinner-sm"></div>
          <span>Searching for "{searchQ}"...</span>
        </div>
      {:else if searchError}
        <div class="no-results">
          <div class="text-5xl opacity-20">⌕</div>
          <span>{searchError}</span>
          <button class="retry-btn" onclick={() => performSearch()}>Try Again</button>
        </div>
      {:else if currentItems.length > 0}
        {#key page}
          <div class="franchise-grid page-transition">
            {#each currentItems as f (f.id)}
              <a class="card {f.type === 'anime' ? 'anime-card' : f.type === 'series' ? 'series-card' : f.isFranchiseMovie ? 'franchise-movie-card' : ''}" 
                 href="app/guide?type={f.type}&id={f.id}" 
                 onclick={(e) => goToGuide(`app/guide?type=${f.type}&id=${f.id}`, e)}>
                <div class="card-media">
                  <img src={f.poster} alt={esc(f.title)} loading="lazy" onerror={(e) => e.target.style.display = 'none'} />
                  <div class="card-badge {f.type === 'movies' ? 'lbl-movie' : f.labelCls}">
                    {f.type === 'anime' || f.type === 'series' ? (f.status || f.label) : (f.type === 'franchises' ? f.label : (f.ratingNum > 0 ? '★ ' + f.rating : f.label))}
                  </div>
                  {#if f.type === 'anime'}
                    <div class="card-type-strip anime-strip"><span>⦿ ANIME</span><span>{f.label}</span></div>
                  {:else if f.type === 'series'}
                    <div class="card-type-strip series-strip"><span>▶ SERIES</span><span>{f.label}</span></div>
                  {:else if f.type === 'franchises'}
                    <div class="card-type-strip movies-strip"><span>🎬 SAGA</span><span>{f.label}</span></div>
                  {:else if f.isFranchiseMovie}
                    <div class="card-type-strip franchise-movie-strip"><span>🎬 FRANCHISE</span><span>{f.years}</span></div>
                  {:else}
                    <div class="card-type-strip movie-strip"><span>🎬 FILM</span><span>{f.years}</span></div>
                  {/if}
                </div>
                <div class="card-content">
                  <div class="card-meta {f.type === 'anime' ? 'anime-meta' : f.type === 'series' ? 'series-meta' : f.isFranchiseMovie ? 'franchise-movie-meta' : ''}">
                    <span>{f.type === 'franchises' ? f.entries + ' FILMS' : (f.type === 'movies' ? (f.isFranchiseMovie ? 'FRANCHISE FILM' : 'FILM') : (f.entries > 1 ? f.entries + ' SEASONS' : '1 SEASON'))}</span>
                    <span>{f.years}</span>
                  </div>
                  <h3 class="card-title">{f.title}</h3>
                  <p class="card-desc">{(f.desc || '').slice(0, 95)}{(f.desc || '').length >= 95 ? '...' : ''}</p>
                  <div class="card-btn">VIEW GUIDE <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" stroke-width="1.5"/></svg></div>
                </div>
              </a>
            {/each}
          </div>
        {/key}
      {:else if searchQ.trim()}
        <div class="no-results">
          <div class="text-5xl opacity-20">⌕</div>
          <span>No results for "{searchQ}"</span>
          <span class="text-[0.7rem] opacity-50 mt-2">Try a different search term</span>
        </div>
      {:else}
        <div class="loading-more" style="padding:80px 0">
          <div class="spinner-sm"></div>
          <span>Loading titles...</span>
        </div>
      {/if}
      
      {#if !done && currentItems.length === 0 && !searchQ.trim()}
        <div class="loading-more">
          <div class="spinner-sm"></div>
          <span>Loading everything...</span>
        </div>
      {/if}
      
      {#if totalFiltered > 0 && np > 1}
        <div class="pagination-bar">
          <div class="pagination-info">Page <strong>{page + 1}</strong> of <strong>{np}</strong> · {totalFiltered} total</div>
          <div class="pagination-dots">
            {#each Array(Math.min(np, 8)) as _, i}
              {@const pg = np <= 8 ? i : Math.round(i * (np - 1) / 7)}
              <button class="pg-dot {pg === page ? 'active' : ''}" onclick={() => goPage(pg)}></button>
            {/each}
          </div>
          <div class="pagination-btns">
            <button class="pg-btn" disabled={!hasPrev} onclick={() => goPage(page - 1)}>PREV</button>
            <button class="pg-btn next" disabled={!hasNext} onclick={() => goPage(page + 1)}>NEXT</button>
          </div>
        </div>
      {/if}
    </section>
  </div>
</main>

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
    transition: 0.4s ease;
    box-sizing: border-box;
  }

  .nav-scrolled {
    background: rgba(5, 5, 5, 0.95);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .nav-logo {
    display: flex;
    align-items: baseline;
    cursor: pointer;
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

  .nav-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .search-wrapper {
    display: flex;
    align-items: center;
    background: rgba(20, 20, 20, 0.8);
    border: 1px solid rgba(201, 168, 76, 0.3);
    border-radius: 40px;
    padding: 5px 14px;
    backdrop-filter: blur(8px);
    transition: 0.25s;
    position: relative;
  }

  .search-wrapper:focus-within {
    border-color: #c9a84c;
    background: rgba(10, 10, 10, 0.95);
  }

  .search-icon {
    color: #c9a84c;
    font-size: 15px;
    margin-right: 8px;
  }

  .search-input {
    background: transparent;
    border: none;
    color: #f0ece4;
    font-family: "Space Mono";
    font-size: 0.78rem;
    padding: 8px 0;
    width: 220px;
    outline: none;
  }

  .search-input::placeholder {
    color: rgba(240, 236, 228, 0.35);
  }

  .search-spinner {
    width: 16px;
    height: 16px;
    border: 1.5px solid rgba(201, 168, 76, 0.2);
    border-top-color: #c9a84c;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-left: 8px;
  }

  .debug-indicator {
    font-family: "Space Mono";
    font-size: 0.62rem;
    color: #c9a84c;
    opacity: 0.6;
    white-space: nowrap;
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .filter-bar {
    display: flex;
    gap: 0;
    border: 1px solid rgba(201, 168, 76, 0.25);
    border-radius: 3px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .filter-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: rgba(240, 236, 228, 0.35);
    font-family: "Space Mono";
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    padding: 7px 14px;
    cursor: pointer;
    transition: 0.2s;
    border-right: 1px solid rgba(201, 168, 76, 0.15);
  }

  .filter-btn:last-child {
    border-right: none;
  }

  .filter-btn.active {
    background: rgba(201, 168, 76, 0.12);
    color: #c9a84c;
  }

  .filter-btn:hover:not(.active) {
    color: rgba(240, 236, 228, 0.6);
    background: rgba(255, 255, 255, 0.03);
  }

  .filter-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .filter-dot.all { background: #c9a84c; }
  .filter-dot.franchises { background: #a07830; }
  .filter-dot.movies { background: #c9a84c; }
  .filter-dot.anime { background: #e05c7a; }
  .filter-dot.series { background: #5fbf8c; }

  .recommend-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, rgba(201, 168, 76, 0.18), rgba(201, 168, 76, 0.06));
    border: 1px solid rgba(201, 168, 76, 0.55);
    border-radius: 40px;
    padding: 9px 22px;
    font-family: "Space Mono";
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    color: #c9a84c;
    cursor: pointer;
    transition: all 0.3s ease;
    text-decoration: none;
    position: relative;
    overflow: hidden;
  }

  .recommend-btn::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(201, 168, 76, 0.3), rgba(201, 168, 76, 0.08));
    opacity: 0;
    transition: opacity 0.3s;
  }

  .recommend-btn:hover::before { opacity: 1; }
  .recommend-btn:hover {
    border-color: #c9a84c;
    box-shadow: 0 0 20px rgba(201, 168, 76, 0.25);
    transform: translateY(-1px);
  }

  .container {
    padding: 0 50px;
    width: 100%;
    max-width: 100%;
  }

  .hero {
    min-height: 52vh;
    padding-top: 100px;
    display: flex;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .hero-inner {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    width: 100%;
    gap: 40px;
    flex-wrap: wrap;
    padding-bottom: 40px;
  }

  .hero-left { flex: 1; }
  .hero-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
    flex-shrink: 0;
  }

  .overtitle {
    display: flex;
    align-items: center;
    gap: 14px;
    font-family: "Space Mono";
    font-size: 0.68rem;
    letter-spacing: 0.2em;
    color: #c9a84c;
    margin-bottom: 20px;
  }

  .overtitle .bar {
    width: 36px;
    height: 1px;
    background: #c9a84c;
  }

  .title {
    font-family: "Cormorant Garamond";
    font-size: clamp(3.5rem, 6vw, 5.5rem);
    font-weight: 600;
    line-height: 1;
  }

  .title em {
    font-style: italic;
    font-weight: 300;
    opacity: 0.65;
  }

  .subtitle {
    max-width: 520px;
    margin-top: 28px;
    font-size: 1rem;
    opacity: 0.45;
    line-height: 1.7;
  }

  .live-counter {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-top: 24px;
    font-family: "Space Mono";
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    color: #c9a84c;
  }

  .live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #c9a84c;
    animation: livePulse 1.2s ease-in-out infinite;
  }

  @keyframes livePulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.6); }
  }

  .franchise-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 28px;
    padding: 60px 0 0;
  }

  .pagination-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 48px 0 80px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    margin-top: 48px;
    flex-wrap: wrap;
    gap: 16px;
  }

  .pagination-info {
    font-family: "Space Mono";
    font-size: 0.65rem;
    color: rgba(240, 236, 228, 0.3);
    letter-spacing: 0.1em;
  }

  .pagination-info strong {
    color: #c9a84c;
    font-weight: 700;
  }

  .pagination-dots {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .pg-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    padding: 0;
  }

  .pg-dot.active {
    background: #c9a84c;
    width: 20px;
    border-radius: 3px;
    box-shadow: 0 0 8px rgba(201, 168, 76, 0.5);
  }

  .pg-dot:hover:not(.active) {
    background: rgba(201, 168, 76, 0.4);
  }

  .pagination-btns {
    display: flex;
    gap: 10px;
  }

  .pg-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: 1px solid rgba(201, 168, 76, 0.25);
    color: rgba(240, 236, 228, 0.5);
    font-family: "Space Mono";
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    padding: 10px 20px;
    cursor: pointer;
    transition: all 0.2s;
    border-radius: 2px;
  }

  .pg-btn:hover:not(:disabled) {
    border-color: #c9a84c;
    color: #c9a84c;
    background: rgba(201, 168, 76, 0.06);
  }

  .pg-btn:disabled {
    opacity: 0.2;
    cursor: not-allowed;
  }

  .pg-btn.next {
    background: rgba(201, 168, 76, 0.08);
    border-color: rgba(201, 168, 76, 0.4);
    color: #c9a84c;
  }

  .page-transition {
    animation: pageFade 0.25s ease both;
  }

  @keyframes pageFade {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .loading-more {
    padding: 32px 0 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    font-family: "Space Mono";
    font-size: 0.68rem;
    color: #c9a84c;
    opacity: 0.6;
  }

  .spinner-sm {
    width: 20px;
    height: 20px;
    border: 1.5px solid rgba(201, 168, 76, 0.2);
    border-top-color: #c9a84c;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .card {
    position: relative;
    background: #0a0a0a;
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: border-color 0.35s ease, transform 0.35s ease;
    overflow: hidden;
    cursor: pointer;
    text-decoration: none;
    display: block;
    color: inherit;
  }

  .card:hover {
    border-color: #c9a84c;
    transform: translateY(-8px);
  }

  .card.anime-card:hover {
    border-color: #e05c7a;
  }

  .card.series-card:hover {
    border-color: #5fbf8c;
  }

  .card.franchise-movie-card:hover {
    border-color: #d4a84c;
  }

  .card-media {
    position: relative;
    aspect-ratio: 2/3;
    overflow: hidden;
    background: #111;
  }

  .card-media img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.7;
    transition: opacity 0.5s, transform 0.5s;
    display: block;
    position: relative;
    z-index: 1;
  }

  .card:hover .card-media img {
    opacity: 1;
    transform: scale(1.06);
  }

  .card-media::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, #111 0%, #1a1a1a 50%, #111 100%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    z-index: 0;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .card-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 2;
    font-family: "Space Mono";
    font-size: 0.55rem;
    letter-spacing: 0.1em;
    padding: 4px 9px;
    border-radius: 2px;
  }

  .lbl-blue {
    background: rgba(30, 58, 138, 0.9);
    color: #93c5fd;
  }

  .lbl-green {
    background: rgba(6, 78, 59, 0.9);
    color: #6ee7b7;
  }

  .lbl-anime {
    background: rgba(180, 40, 80, 0.85);
    color: #f9a8c9;
  }

  .lbl-series {
    background: rgba(10, 100, 80, 0.85);
    color: #6ee7b7;
  }

  .lbl-movie {
    background: rgba(100, 80, 10, 0.85);
    color: #fde68a;
  }

  .lbl-ended {
    background: rgba(60, 60, 60, 0.9);
    color: rgba(240, 236, 228, 0.5);
  }

  .card-type-strip {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 2;
    padding: 4px 10px;
    font-family: "Space Mono";
    font-size: 0.52rem;
    letter-spacing: 0.12em;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .anime-strip {
    background: rgba(180, 40, 80, 0.75);
    color: #f9a8c9;
  }

  .series-strip {
    background: rgba(10, 100, 80, 0.75);
    color: #6ee7b7;
  }

  .movies-strip {
    background: rgba(180, 140, 20, 0.75);
    color: #f9e08c;
  }

  .movie-strip {
    background: rgba(140, 100, 10, 0.75);
    color: #fde68a;
  }

  .franchise-movie-strip {
    background: rgba(180, 140, 40, 0.75);
    color: #f9e08c;
  }

  .card-content {
    padding: 24px 28px 28px;
  }

  .card-meta {
    display: flex;
    justify-content: space-between;
    font-family: "Space Mono";
    font-size: 0.6rem;
    color: #c9a84c;
    margin-bottom: 12px;
  }

  .anime-meta {
    color: #e05c7a;
  }

  .series-meta {
    color: #5fbf8c;
  }

  .franchise-movie-meta {
    color: #d4a84c;
  }

  .card-title {
    font-family: "Cormorant Garamond";
    font-size: 1.65rem;
    font-weight: 600;
    margin-bottom: 12px;
    line-height: 1.15;
  }

  .card-desc {
    font-size: 0.82rem;
    opacity: 0.38;
    line-height: 1.55;
    margin-bottom: 22px;
  }

  .card-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: "Space Mono";
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    color: rgba(240, 236, 228, 0.5);
    border-bottom: 1px solid rgba(201, 168, 76, 0.25);
    padding-bottom: 4px;
    transition: 0.25s;
  }

  .card:hover .card-btn {
    color: #c9a84c;
    border-bottom-color: #c9a84c;
  }

  .card.anime-card:hover .card-btn {
    color: #e05c7a;
    border-bottom-color: #e05c7a;
  }

  .card.series-card:hover .card-btn {
    color: #5fbf8c;
    border-bottom-color: #5fbf8c;
  }

  .card.franchise-movie-card:hover .card-btn {
    color: #d4a84c;
    border-bottom-color: #d4a84c;
  }

  .no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 0;
    gap: 16px;
    color: rgba(240, 236, 228, 0.3);
    font-family: "Space Mono";
    font-size: 0.72rem;
    letter-spacing: 0.12em;
  }

  .retry-btn {
    margin-top: 16px;
    padding: 8px 20px;
    background: rgba(201, 168, 76, 0.1);
    border: 1px solid rgba(201, 168, 76, 0.4);
    color: #c9a84c;
    font-family: "Space Mono";
    font-size: 0.65rem;
    cursor: pointer;
    border-radius: 3px;
    transition: all 0.2s;
  }

  .retry-btn:hover {
    background: rgba(201, 168, 76, 0.2);
    border-color: #c9a84c;
  }

  @media (max-width: 768px) {
    .nav {
      padding: 14px 20px;
    }
    .container {
      padding: 0 20px;
    }
    .franchise-grid {
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 20px;
      padding: 40px 0 0;
    }
    .search-input {
      width: 140px;
    }
    .filter-btn {
      padding: 6px 8px;
      font-size: 0.52rem;
    }
    .hero-right {
      align-items: flex-start;
    }
  }
</style>