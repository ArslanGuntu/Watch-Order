<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';

  const TMDB_KEY = '175b19b3ba717bf4f24e37ee4325be7e';
  const BASE = 'https://api.themoviedb.org/3';
  const IMG = 'https://image.tmdb.org/t/p';
  const PAGE_SIZE = 24;

  let user = $state(null);
  let me = $state(null);
  let userMenuOpen = $state(false);
  let navScrolled = $state(false);
  let searchOpen = $state(false);

  let items = $state([]);
  let totalCount = $state(0);
  let loading = $state(false);
  let activeFilter = $state('all');
  let page = $state(0);
  let searchQ = $state('');
  let debouncedQ = $state('');
  let searchTimer = null;

  let tmdbQ = $state('');
  let tmdbResults = $state([]);
  let tmdbLoading = $state(false);
  let tmdbTimer = null;
  let tmdbAbort = null;

  const norm = (s) => s?.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim() || '';
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let np = $derived(Math.max(1, Math.ceil(totalCount / PAGE_SIZE)));
  let hasPrev = $derived(page > 0);
  let hasNext = $derived(totalCount > (page + 1) * PAGE_SIZE);

  const TYPE_CFG = {
    franchises: { label:'SAGA',  color:'#b91c1c', dim:'rgba(185,28,28,0.1)',  border:'rgba(185,28,28,0.35)', glow:'rgba(185,28,28,0.12)' },
    movies:     { label:'FILM',  color:'#d97706', dim:'rgba(217,119,6,0.08)', border:'rgba(217,119,6,0.3)',  glow:'rgba(217,119,6,0.1)' },
    anime:      { label:'ANIME', color:'#0ea5e9', dim:'rgba(14,165,233,0.08)',border:'rgba(14,165,233,0.3)', glow:'rgba(14,165,233,0.1)' },
    series:     { label:'SERIES',color:'#059669', dim:'rgba(5,150,105,0.08)', border:'rgba(5,150,105,0.3)',  glow:'rgba(5,150,105,0.1)' },
  };

  async function init() {
    // FIX 2: Use getUser() instead of getSession() to reliably get avatar and metadata
    const { data: { session } } = await supabase.auth.getSession();
    const { data: { user: u } } = await supabase.auth.getUser();
    me = session?.user || null;
    user = u || me; 
    if (!me) goto('/signin');
    document.title = 'Logged · WatchOrder';
  }

  // FIX 1: Explicitly guard `me` so the effect waits for auth before fetching
  $effect(() => {
    if (!me) return;
    fetchPage(page, activeFilter, debouncedQ);
  });

  async function fetchPage(p, type, q) {
    loading = true;
    let query = supabase.from('logged_movies').select('*', { count: 'exact' }).eq('user_id', me.id).order('created_at', { ascending: false }).range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1);
    if (type !== 'all') query = query.eq('type', type);
    if (q) query = query.ilike('title', `%${q}%`);
    const { data, error, count } = await query;
    if (!error) {
      items = (data || []).map(row => ({ id: row.type === 'franchises' ? 'col_' + row.tmdb_id : row.tmdb_id, tmdbId: String(row.tmdb_id), type: row.type, title: row.title, poster: row.poster, year: row.year, ratingNum: row.rating || 0, rating: row.rating ? row.rating.toFixed(1) : '—' }));
      totalCount = count || 0;
    }
    loading = false;
  }

  $effect(() => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { debouncedQ = searchQ.trim(); page = 0; }, 120); return () => clearTimeout(searchTimer); });

  function setFilter(type) { activeFilter = type; page = 0; }
  function goPage(p) { if (p < 0 || p >= np) return; page = p; window.scrollTo({ top: 0, behavior: 'smooth' }); }

  async function removeItem(item) {
    if (!me) return;
    await supabase.from('logged_movies').delete().eq('user_id', me.id).eq('tmdb_id', item.tmdbId).eq('type', item.type);
    fetchPage(page, activeFilter, debouncedQ);
  }

  $effect(() => { clearTimeout(tmdbTimer); if (!tmdbQ || tmdbQ.trim().length < 2) { tmdbResults = []; return; } tmdbTimer = setTimeout(() => runTmdbSearch(tmdbQ.trim()), 200); return () => clearTimeout(tmdbTimer); });

  async function runTmdbSearch(q) {
    if (tmdbAbort) tmdbAbort.abort();
    tmdbAbort = new AbortController();
    tmdbLoading = true;
    try {
      let results = []; const words = norm(q).split(' ').filter(Boolean); const type = activeFilter;
      if (type === 'all' || type === 'movies') { const r = await fetch(`${BASE}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&page=1`, { signal: tmdbAbort.signal }).then(r => r.json()); results.push(...(r.results || []).filter(m => words.every(w => norm(m.title||'').includes(w) || norm(m.original_title||'').includes(w))).slice(0, 5).map(m => ({ id: m.id, type: 'movies', title: m.title || m.original_title || '', poster: m.poster_path ? `${IMG}/w500${m.poster_path}` : '', year: (m.release_date || '').slice(0, 4), rating: m.vote_average || 0 }))); }
      if (type === 'all' || type === 'franchises') { const r = await fetch(`${BASE}/search/collection?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&page=1`, { signal: tmdbAbort.signal }).then(r => r.json()); results.push(...(r.results || []).slice(0, 5).map(c => ({ id: 'col_' + c.id, type: 'franchises', title: (c.name || '').replace(/ Collection$/i, ''), poster: c.poster_path ? `${IMG}/w500${c.poster_path}` : '', year: '', rating: 0 }))); }
      if (type === 'all' || type === 'series' || type === 'anime') { const r = await fetch(`${BASE}/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&page=1`, { signal: tmdbAbort.signal }).then(r => r.json()); (r.results || []).slice(0, 10).forEach(s => { const isAnime = (s.genre_ids || []).includes(16) || norm(s.name).includes('anime'); const t = isAnime ? 'anime' : 'series'; if (type !== 'all' && type !== t) return; results.push({ id: s.id, type: t, title: s.name || s.original_name || '', poster: s.poster_path ? `${IMG}/w500${s.poster_path}` : '', year: (s.first_air_date || '').slice(0, 4), rating: s.vote_average || 0 }); }); }
      const existing = new Set(items.map(i => String(i.id)));
      tmdbResults = results.filter(r => !existing.has(String(r.id))).slice(0, 6);
    } catch (e) { if (e.name !== 'AbortError') tmdbResults = []; }
    tmdbLoading = false;
  }

  async function addItem(entity) {
    if (!me) return;
    const tmdbId = String(entity.id).replace('col_', '');
    const { data: dup } = await supabase.from('logged_movies').select('id', { head: true }).eq('user_id', me.id).eq('tmdb_id', tmdbId).eq('type', entity.type).maybeSingle();
    if (dup) { tmdbQ = ''; tmdbResults = []; return; }
    await supabase.from('logged_movies').insert({ user_id: me.id, tmdb_id: tmdbId, title: entity.title, poster: entity.poster, year: entity.year, rating: entity.rating || 0, type: entity.type });
    tmdbQ = ''; tmdbResults = []; fetchPage(page, activeFilter, debouncedQ);
  }

  async function signOut() { await supabase.auth.signOut(); goto('/signin'); }

  let userInitials = $derived(() => { if (!user) return '?'; const n = user.user_metadata?.full_name || user.user_metadata?.name || user.email || ''; return n.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || user.email?.[0]?.toUpperCase() || '?'; });
  let userAvatar = $derived(user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null);
  let userName = $derived(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User');

  onMount(init);
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Archivo:wght@300;400;500;600&family=Archivo+Narrow:wght@400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<svelte:window onscroll={() => navScrolled = window.scrollY > 20} onclick={(e) => { if (userMenuOpen && !e.target.closest('.umw')) userMenuOpen = false; if (searchOpen && !e.target.closest('.search-overlay') && !e.target.closest('.nav-search-btn')) searchOpen = false; }} />

<div class="noise" aria-hidden="true"></div>

<header class="nav {navScrolled ? 'nav-solid' : ''}">
  <a class="logo" href="/"><div class="logo-bracket">[</div><div class="logo-text"><span class="logo-w">W</span><span class="logo-o">ATCH</span><span class="logo-order">ORDER</span></div><div class="logo-bracket">]</div></a>
  <nav class="nav-filters">
    {#each [['all','ALL'],['franchises','SAGAS'],['movies','FILMS'],['anime','ANIME'],['series','SERIES']] as [t, l]}
      <button class="nf {activeFilter === t ? 'nf-on' : ''}" data-type={t} onclick={() => setFilter(t)}><span class="nf-label">{l}</span>{#if activeFilter === t}<span class="nf-bar"></span>{/if}</button>
    {/each}
  </nav>
  <div class="nav-end">
    <button class="nav-icon-btn nav-search-btn" onclick={() => searchOpen = !searchOpen} aria-label="Search">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
    </button>
    <a href="/app/chat" class="nav-icon-btn" title="Chat"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></a>
    {#if user}
      <div class="umw">
        <button class="uav" onclick={() => userMenuOpen = !userMenuOpen}>
          {#if userAvatar}<img src={userAvatar} alt={userName} referrerpolicy="no-referrer" />{:else}<span>{userInitials()}</span>{/if}
          <div class="uav-pip"></div>
        </button>
        {#if userMenuOpen}
          <div class="udrop">
            <div class="udrop-top">{#if userAvatar}<img src={userAvatar} alt={userName} class="udrop-av" referrerpolicy="no-referrer" />{:else}<div class="udrop-initials">{userInitials()}</div>{/if}<div><div class="udrop-name">{userName}</div><div class="udrop-email">{user.email}</div></div></div>
            <div class="udrop-divider"></div>
            {#each [['/app/favorites','Favorites','M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'],['/app/logged','Logged','M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],['/app/chat','Chat','M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],['/app/watchlist','Watchlist','M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z']] as [href, label, icon]}
              <a {href} class="udrop-item" onclick={() => userMenuOpen = false}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d={icon}/></svg>{label}</a>
            {/each}
            <div class="udrop-divider"></div>
            <button class="udrop-item udrop-out" onclick={signOut}><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 1H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3M9 9l3-3-3-3M12 6.5H5"/></svg>Sign out</button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</header>

{#if searchOpen}
  <div class="search-overlay">
    <div class="so-inner">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input type="text" placeholder="Filter watch history..." bind:value={searchQ} autocomplete="off" class="so-input" autofocus />
      {#if searchQ}<button class="so-clear" onclick={() => { searchQ = ''; }}>✕</button>{/if}
    </div>
  </div>
{/if}

<main class="content">
  <header class="sub-header">
    <div class="hero-tag"><span class="ht-pulse"></span><span>YOUR JOURNAL</span><span class="ht-line"></span></div>
    <!-- FIX 3: Changed text to Logged Movies -->
    <h1 class="sub-h1">Logged <em>Movies</em></h1>
    <p class="sub-desc">{totalCount.toLocaleString()} titles logged · Add new entries instantly via TMDB</p>
  </header>

  <div class="add-bar">
    <div class="add-wrap">
      <svg class="add-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
      <input type="text" placeholder="Search TMDB to log a new title..." bind:value={tmdbQ} class="add-inp" />
      {#if tmdbLoading}<div class="so-spin sm"></div>{/if}
    </div>
    {#if tmdbResults.length > 0}
      <div class="tmdb-dd">
        {#each tmdbResults as r}
          {@const cfg = TYPE_CFG[r.type] || TYPE_CFG.movies}
          <button class="tmdb-row" onclick={() => addItem(r)}>
            <div class="tmdb-poster">{#if r.poster}<img src={r.poster} alt="" loading="lazy"/>{:else}<div class="tmdb-empty">{r.title.slice(0,2).toUpperCase()}</div>{/if}</div>
            <div class="tmdb-body">
              <div class="tmdb-title">{r.title}</div>
              <div class="tmdb-meta">
                {#if r.year}<span>{r.year}</span>{/if}
                {#if r.rating > 0}<span>★ {r.rating.toFixed(1)}</span>{/if}
                <span class="tmdb-type" style="color:{cfg.color}">{cfg.label}</span>
              </div>
            </div>
            <div class="tmdb-add" style="border-color:{cfg.border};color:{cfg.color}">+</div>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  {#if loading && items.length === 0}
    <div class="state-box"><div class="sb-spin"></div><p>Loading your history...</p></div>
  {:else if items.length === 0}
    <div class="state-box"><div class="sb-icon">∅</div><p>Nothing logged yet</p><button class="sb-btn" onclick={() => tmdbQ = ''}>Search above to add</button></div>
  {:else}
    <div class="card-grid">
      {#each items as item (item.id)}
        {@const cfg = TYPE_CFG[item.type] || TYPE_CFG.movies}
        <div class="card" style="--cc:{cfg.color};--cdim:{cfg.dim};--cb:{cfg.border};--cglow:{cfg.glow};">
          <button class="card-rm" onclick={() => removeItem(item)}>✕</button>
          <a class="card-link" href="/app/guide?type={item.type}&id={item.id}">
            <div class="cp">
              {#if item.poster}<img src={item.poster} alt={esc(item.title)} loading="lazy" onerror={(e)=>e.target.style.display='none'} />{:else}<div class="cp-blank"><span>{item.title[0]}</span></div>{/if}
              <div class="cp-grad"></div>
              <div class="cp-type">{cfg.label}</div>
              {#if item.ratingNum > 0}<div class="cp-rating"><svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>{item.rating}</div>{/if}
            </div>
            <div class="cb">
              <div class="cb-meta"><span class="cb-year">{item.year || '—'}</span><span class="cb-entries">{item.type}</span></div>
              <h3 class="cb-title">{item.title}</h3>
            </div>
          </a>
        </div>
      {/each}
    </div>

    {#if np > 1}
      <div class="pager">
        <button class="pg-prev" disabled={!hasPrev} onclick={() => goPage(page-1)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>PREV</button>
        <div class="pg-track">{#each Array(Math.min(np, 9)) as _, i}{@const pg = np <= 9 ? i : Math.round(i * (np-1) / 8)}<button class="pg-pip {pg === page ? 'pg-pip-on' : ''}" onclick={() => goPage(pg)}></button>{/each}<span class="pg-label">{page+1} / {np}</span></div>
        <button class="pg-next" disabled={!hasNext} onclick={() => goPage(page+1)}>NEXT<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>
      </div>
    {/if}
  {/if}
</main>

<style>
  :global(*){margin:0;padding:0;box-sizing:border-box;}
  :global(body){background:#0a0a0a;color:#ede8e0;font-family:'Archivo',sans-serif;overflow-x:hidden;-webkit-font-smoothing:antialiased;}
  :root{--bg:#0a0a0a;--bg2:#111;--bg3:#191919;--red:#b91c1c;--red-h:#dc2626;--red-d:rgba(185,28,28,0.14);--red-b:rgba(185,28,28,0.3);--cream:#ede8e0;--cream-d:rgba(237,232,224,0.5);--cream-dd:rgba(237,232,224,0.28);--border:rgba(255,255,255,0.07);--border-h:rgba(255,255,255,0.13);--display:'Playfair Display',Georgia,serif;--sans:'Archivo',sans-serif;--narrow:'Archivo Narrow',sans-serif;}
  .noise{position:fixed;inset:0;pointer-events:none;z-index:999;opacity:0.035;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
  .nav{position:fixed;top:0;left:0;right:0;z-index:200;height:64px;display:flex;align-items:center;padding:0 40px;gap:0;transition:background 0.25s,border-color 0.25s;border-bottom:1px solid transparent;}
  .nav-solid{background:rgba(10,10,10,0.97);backdrop-filter:blur(24px);border-color:var(--border);}
  .logo{display:flex;align-items:center;gap:4px;text-decoration:none;flex-shrink:0;}
  .logo-bracket{font-family:var(--display);font-size:1.6rem;color:var(--red);font-weight:900;line-height:1;}
  .logo-text{display:flex;align-items:baseline;gap:2px;}
  .logo-w{font-family:var(--display);font-size:1.25rem;font-weight:900;color:#fff;}
  .logo-o{font-family:var(--narrow);font-size:0.85rem;font-weight:700;color:var(--cream-d);letter-spacing:0.1em;text-transform:uppercase;}
  .logo-order{font-family:var(--narrow);font-size:0.78rem;font-weight:400;color:var(--red);letter-spacing:0.18em;margin-left:6px;border-left:1px solid var(--red-b);padding-left:6px;}
  .nav-filters{flex:1;display:flex;justify-content:center;gap:0;}
  .nf{position:relative;background:none;border:none;cursor:pointer;font-family:var(--narrow);font-size:0.65rem;font-weight:600;letter-spacing:0.14em;color:var(--cream-dd);padding:0 18px;height:64px;transition:color 0.15s;white-space:nowrap;}
  .nf:hover{color:var(--cream-d);}
  .nf-on{color:#fff !important;}
  .nf-on[data-type="franchises"]{color:#fca5a5 !important;}.nf-on[data-type="movies"]{color:#fcd34d !important;}.nf-on[data-type="anime"]{color:#7dd3fc !important;}.nf-on[data-type="series"]{color:#6ee7b7 !important;}
  .nf-bar{position:absolute;bottom:0;left:18px;right:18px;height:2px;border-radius:2px 2px 0 0;}
  .nf-on[data-type="franchises"] .nf-bar{background:#b91c1c;}.nf-on[data-type="movies"] .nf-bar{background:#d97706;}.nf-on[data-type="anime"] .nf-bar{background:#0ea5e9;}.nf-on[data-type="series"] .nf-bar{background:#059669;}
  .nav-end{display:flex;align-items:center;gap:8px;flex-shrink:0;}
  .nav-icon-btn{width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:6px;background:transparent;border:1px solid var(--border);color:var(--cream-dd);cursor:pointer;text-decoration:none;transition:color 0.12s,border-color 0.12s,background 0.12s;}
  .nav-icon-btn:hover{color:#fff;border-color:var(--border-h);background:var(--bg3);}
  .umw{position:relative;}
  .uav{position:relative;width:34px;height:34px;border-radius:6px;background:var(--bg3);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:visible;transition:border-color 0.12s;}
  .uav:hover{border-color:var(--red-b);}
  .uav img{width:100%;height:100%;object-fit:cover;border-radius:5px;}
  .uav span{font-family:var(--narrow);font-size:0.6rem;font-weight:700;color:var(--red-h);letter-spacing:0.05em;}
  .uav-pip{position:absolute;bottom:-3px;right:-3px;width:8px;height:8px;background:#059669;border-radius:50%;border:2px solid var(--bg);}
  .udrop{position:absolute;top:calc(100% + 10px);right:0;width:216px;background:#141414;border:1px solid var(--border-h);border-radius:10px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.8);animation:ddin 0.16s cubic-bezier(0.16,1,0.3,1);z-index:300;}
  @keyframes ddin{from{opacity:0;transform:translateY(-6px) scale(0.96);}}
  .udrop-top{display:flex;gap:10px;align-items:center;padding:14px;background:rgba(255,255,255,0.02);}
  .udrop-av{width:34px;height:34px;border-radius:6px;object-fit:cover;}
  .udrop-initials{width:34px;height:34px;border-radius:6px;background:var(--red-d);display:flex;align-items:center;justify-content:center;font-family:var(--narrow);font-size:0.6rem;font-weight:700;color:var(--red-h);}
  .udrop-name{font-family:var(--sans);font-size:0.8rem;font-weight:600;color:#fff;}
  .udrop-email{font-family:var(--narrow);font-size:0.55rem;color:var(--cream-dd);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;}
  .udrop-divider{height:1px;background:var(--border);}
  .udrop-item{display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;font-family:var(--narrow);font-size:0.62rem;letter-spacing:0.06em;font-weight:500;color:var(--cream-d);text-decoration:none;background:none;border:none;cursor:pointer;transition:background 0.1s,color 0.1s;}
  .udrop-item:hover{background:rgba(255,255,255,0.04);color:#fff;}
  .udrop-out:hover{background:var(--red-d);color:#fca5a5;}
  .search-overlay{position:fixed;top:64px;left:0;right:0;z-index:190;background:rgba(10,10,10,0.98);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);animation:soIn 0.18s ease;}
  @keyframes soIn{from{opacity:0;transform:translateY(-8px);}}
  .so-inner{display:flex;align-items:center;gap:14px;padding:16px 40px;}
  .so-inner svg{color:var(--cream-dd);flex-shrink:0;}
  .so-input{flex:1;background:none;border:none;outline:none;font-family:var(--display);font-size:1.4rem;font-weight:700;color:#fff;}
  .so-input::placeholder{color:rgba(237,232,224,0.2);}
  .so-spin{width:18px;height:18px;border-radius:50%;border:2px solid var(--red-d);border-top-color:var(--red);animation:spin 0.7s linear infinite;flex-shrink:0;}
  .so-spin.sm{width:14px;height:14px;border-width:1.5px;}
  .so-clear{background:none;border:none;color:var(--cream-dd);cursor:pointer;font-size:1rem;padding:4px;transition:color 0.1s;}
  .so-clear:hover{color:#fff;}
  .content{padding:100px 40px 80px;max-width:1400px;margin:0 auto;}
  .sub-header{padding-bottom:48px;border-bottom:1px solid var(--border);margin-bottom:48px;}
  .hero-tag{display:inline-flex;align-items:center;gap:10px;font-family:var(--narrow);font-size:0.6rem;font-weight:600;letter-spacing:0.22em;color:var(--red-h);text-transform:uppercase;margin-bottom:24px;}
  .ht-pulse{width:6px;height:6px;border-radius:50%;background:var(--red-h);animation:blink 1.4s ease-in-out infinite;flex-shrink:0;}
  .ht-line{flex:none;width:40px;height:1px;background:var(--red-b);}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
  .sub-h1{font-family:var(--display);font-size:clamp(3rem,6vw,5.5rem);font-weight:900;line-height:0.9;color:#fff;margin-bottom:16px;}
  .sub-h1 em{font-style:italic;font-weight:700;color:transparent;-webkit-text-stroke:2px var(--red);}
  .sub-desc{font-family:var(--narrow);font-size:0.7rem;color:var(--cream-dd);letter-spacing:0.08em;line-height:1.6;}
  .add-bar{margin-bottom:48px;position:relative;}
  .add-wrap{display:flex;align-items:center;gap:14px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:14px 20px;max-width:600px;transition:border-color 0.2s;}
  .add-wrap:focus-within{border-color:var(--border-h);}
  .add-ico{color:var(--cream-dd);flex-shrink:0;}
  .add-inp{flex:1;background:none;border:none;outline:none;font-family:var(--narrow);font-size:0.75rem;letter-spacing:0.06em;color:var(--cream);}
  .add-inp::placeholder{color:var(--cream-dd);}
  .tmdb-dd{position:absolute;top:calc(100% + 8px);left:0;width:600px;max-width:90vw;background:#141414;border:1px solid var(--border-h);border-radius:8px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.8);z-index:50;animation:ddin 0.2s ease;}
  .tmdb-row{display:flex;align-items:center;gap:14px;width:100%;padding:14px 18px;background:transparent;border:none;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.15s;text-align:left;color:inherit;}
  .tmdb-row:last-child{border-bottom:none;}
  .tmdb-row:hover{background:rgba(255,255,255,0.04);}
  .tmdb-poster{width:40px;height:60px;overflow:hidden;background:var(--bg3);border-radius:4px;flex-shrink:0;}
  .tmdb-poster img{width:100%;height:100%;object-fit:cover;}
  .tmdb-empty{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:var(--display);font-size:1rem;color:rgba(255,255,255,0.1);}
  .tmdb-body{flex:1;min-width:0;}
  .tmdb-title{font-family:var(--sans);font-weight:600;font-size:0.85rem;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .tmdb-meta{display:flex;gap:12px;margin-top:4px;font-family:var(--narrow);font-size:0.55rem;color:var(--cream-dd);letter-spacing:0.08em;}
  .tmdb-type{text-transform:uppercase;font-weight:700;}
  .tmdb-add{width:32px;height:32px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:var(--display);font-size:1.2rem;transition:background 0.15s;}
  .tmdb-row:hover .tmdb-add{background:rgba(255,255,255,0.06);}
  .card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;align-items:stretch;}
  .card{position:relative;background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden;transition:transform 0.28s cubic-bezier(0.16,1,0.3,1),border-color 0.2s,box-shadow 0.2s;height:100%;}
  .card:hover{transform:translateY(-4px);border-color:var(--cb);box-shadow:0 6px 24px rgba(0,0,0,0.5),0 0 0 1px var(--cb);}
  .card-rm{position:absolute;top:10px;right:10px;z-index:10;width:26px;height:26px;border-radius:5px;border:1px solid var(--border);background:rgba(10,10,10,0.85);color:var(--cream-dd);font-size:0.7rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:border-color 0.2s,color 0.2s;}
  .card-rm:hover{border-color:var(--red);color:var(--red);}
  .card-link{text-decoration:none;color:inherit;display:block;height:100%;display:flex;flex-direction:column;}
  .cp{position:relative;aspect-ratio:2/3;background:var(--bg3);overflow:hidden;}
  .cp img{width:100%;height:100%;object-fit:cover;display:block;opacity:0.8;transition:opacity 0.35s,transform 0.45s cubic-bezier(0.16,1,0.3,1);}
  .card:hover .cp img{opacity:1;transform:scale(1.04);}
  .cp-blank{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}
  .cp-blank span{font-family:var(--display);font-size:5rem;font-weight:900;color:rgba(255,255,255,0.07);}
  .cp-grad{position:absolute;inset:0;background:linear-gradient(to top,rgba(10,10,10,0.95) 0%,rgba(10,10,10,0.2) 45%,transparent 70%);z-index:1;}
  .cp-type{position:absolute;top:10px;left:10px;z-index:2;font-family:var(--narrow);font-size:0.5rem;font-weight:700;letter-spacing:0.16em;background:var(--cdim);color:var(--cc);border:1px solid var(--cb);padding:3px 7px;border-radius:3px;}
  .cp-rating{position:absolute;top:10px;right:10px;z-index:2;font-family:var(--narrow);font-size:0.52rem;font-weight:700;background:rgba(217,119,6,0.15);color:#fcd34d;border:1px solid rgba(217,119,6,0.25);padding:3px 7px;border-radius:3px;display:flex;align-items:center;gap:4px;}
  .cb{padding:14px 16px 16px;display:flex;flex-direction:column;gap:6px;flex:1;}
  .cb-meta{display:flex;justify-content:space-between;align-items:center;}
  .cb-year{font-family:var(--narrow);font-size:0.55rem;color:var(--cream-dd);letter-spacing:0.08em;}
  .cb-entries{font-family:var(--narrow);font-size:0.5rem;font-weight:700;letter-spacing:0.12em;color:var(--cc);}
  .cb-title{font-family:var(--display);font-size:1.05rem;font-weight:700;line-height:1.22;color:#fff;}
  .pager{display:flex;align-items:center;justify-content:center;gap:20px;margin-top:56px;padding-top:48px;border-top:1px solid var(--border);flex-wrap:wrap;}
  .pg-prev,.pg-next{display:inline-flex;align-items:center;gap:8px;font-family:var(--narrow);font-size:0.65rem;font-weight:700;letter-spacing:0.12em;padding:10px 20px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--cream-d);cursor:pointer;transition:all 0.15s;}
  .pg-prev:hover:not(:disabled),.pg-next:hover:not(:disabled){border-color:var(--border-h);color:#fff;background:var(--bg3);}
  .pg-prev:disabled,.pg-next:disabled{opacity:0.2;cursor:not-allowed;}
  .pg-next{background:var(--red-d);border-color:var(--red-b);color:#fca5a5;}
  .pg-next:hover:not(:disabled){background:var(--red);border-color:var(--red);color:#fff;}
  .pg-track{display:flex;align-items:center;gap:6px;}
  .pg-pip{width:5px;height:5px;border-radius:50%;background:var(--border);border:none;padding:0;cursor:pointer;transition:all 0.15s;}
  .pg-pip:hover:not(.pg-pip-on){background:var(--cream-dd);}
  .pg-pip-on{background:var(--red);width:16px;border-radius:3px;}
  .pg-label{font-family:var(--narrow);font-size:0.58rem;letter-spacing:0.1em;color:var(--cream-dd);margin-left:8px;}
  .state-box{display:flex;flex-direction:column;align-items:center;gap:16px;padding:100px 0;text-align:center;font-family:var(--narrow);font-size:0.75rem;color:var(--cream-dd);letter-spacing:0.1em;}
  .sb-spin{width:24px;height:24px;border-radius:50%;border:2px solid var(--red-d);border-top-color:var(--red);animation:spin 0.8s linear infinite;}
  .sb-icon{font-family:var(--display);font-size:3.5rem;color:rgba(255,255,255,0.08);line-height:1;}
  .sb-btn{margin-top:8px;padding:10px 24px;border-radius:5px;border:1px solid var(--border);background:none;color:var(--cream-d);font-family:var(--narrow);font-size:0.63rem;font-weight:600;letter-spacing:0.1em;cursor:pointer;transition:all 0.15s;}
  .sb-btn:hover{border-color:var(--red-b);color:#fca5a5;background:var(--red-d);}
  @keyframes spin{to{transform:rotate(360deg);}}
  @media(max-width:768px){.nav{padding:0 20px;}.nav-filters{display:none;}.content{padding:90px 20px 60px;}.card-grid{grid-template-columns:repeat(2,1fr);gap:9px;}.tmdb-dd{width:90vw;}.add-wrap{max-width:100%;}}
</style>