
<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';

  const TMDB_KEY = '175b19b3ba717bf4f24e37ee4325be7e';
  const BASE = 'https://api.themoviedb.org/3';
  const IMG = 'https://image.tmdb.org/t/p';
  const PAGE_SIZE = 24;

  let user = $state(null);
  let userMenuOpen = $state(false);
  let activeFilter = $state('all');
  let page = $state(0);
  let searchQ = $state('');
  let allItems = $state([]);
  let filteredItems = $state([]);
  let loadState = $state({ franchises: false, movies: false, anime: false, series: false });
  let idSet = $state({ franchises: new Set(), movies: new Set(), anime: new Set(), series: new Set() });
  let colIdSet = $state(new Set());
  let partIdSet = $state(new Set());
  let navScrolled = $state(false);
  let isSearching = $state(false);
  let me = $state(null);
  let loggedIds = $state(new Set());
  let favIds = $state(new Set());
  let searchOpen = $state(false);
  let searchResults = $state([]);
  let cardKey = $state(0);
  let heroReady = $state(false);
  let featuredItem = $state(null);

  let currentItems = $derived.by(() => filteredItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE));
  let done = $derived(Object.values(loadState).every(Boolean));
  let loadingProgress = $derived(Object.values(loadState).filter(Boolean).length / 4);
  let totalFiltered = $derived(filteredItems.length);
  let np = $derived(Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE)));
  let hasPrev = $derived(page > 0);
  let hasNext = $derived(totalFiltered > (page + 1) * PAGE_SIZE);

  let userInitials = $derived(() => {
    if (!user) return '?';
    const n = user.user_metadata?.full_name || user.user_metadata?.name || user.email || '';
    return n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  });
  let userAvatar = $derived(user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null);
  let userName = $derived(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User');
  let countByType = $derived({
    franchises: allItems.filter(x => x.type === 'franchises').length,
    movies: allItems.filter(x => x.type === 'movies').length,
    anime: allItems.filter(x => x.type === 'anime').length,
    series: allItems.filter(x => x.type === 'series').length,
  });
  let pageNumbers = $derived.by(() => {
    if (np <= 7) return Array.from({ length: np }, (_, i) => i);
    const pages = [0];
    if (page > 2) pages.push(-1);
    for (let i = Math.max(1, page - 1); i <= Math.min(np - 2, page + 1); i++) pages.push(i);
    if (page < np - 3) pages.push(-1);
    pages.push(np - 1);
    return pages;
  });

  async function loadUser() {
    const { data: { session } } = await supabase.auth.getSession();
    me = session?.user || null; user = me;
    if (me) {
      const [{ data: logged }, { data: favs }] = await Promise.all([
        supabase.from('logged_movies').select('tmdb_id,type').eq('user_id', me.id),
        supabase.from('favorites').select('tmdb_id,type').eq('user_id', me.id)
      ]);
      loggedIds = new Set((logged || []).map(r => `${r.type}:${r.tmdb_id}`));
      favIds = new Set((favs || []).map(r => `${r.type}:${r.tmdb_id}`));
    }
  }

  async function toggleLog(item) {
    if (!me) { goto('/signin'); return; }
    const tmdbId = String(item.id).replace('col_', '');
    const key = `${item.type}:${tmdbId}`;
    if (loggedIds.has(key)) {
      loggedIds = new Set([...loggedIds].filter(id => id !== key));
      favIds = new Set([...favIds].filter(id => id !== key));
      await supabase.from('logged_movies').delete().eq('user_id', me.id).eq('tmdb_id', tmdbId).eq('type', item.type);
      await supabase.from('favorites').delete().eq('user_id', me.id).eq('tmdb_id', tmdbId).eq('type', item.type);
    } else {
      loggedIds = new Set([...loggedIds, key]);
      await supabase.from('logged_movies').insert({ user_id: me.id, tmdb_id: tmdbId, title: item.title, poster: item.poster, year: item.year, rating: item.ratingNum, type: item.type });
    }
  }

  async function toggleFav(item) {
    if (!me) { goto('/signin'); return; }
    const tmdbId = String(item.id).replace('col_', '');
    const key = `${item.type}:${tmdbId}`;
    if (favIds.has(key)) {
      favIds = new Set([...favIds].filter(id => id !== key));
      await supabase.from('favorites').delete().eq('user_id', me.id).eq('tmdb_id', tmdbId).eq('type', item.type);
    } else {
      favIds = new Set([...favIds, key]);
      await supabase.from('favorites').insert({ user_id: me.id, tmdb_id: tmdbId, title: item.title, poster: item.poster, year: item.year, rating: item.ratingNum, type: item.type });
      if (!loggedIds.has(key)) {
        loggedIds = new Set([...loggedIds, key]);
        await supabase.from('logged_movies').insert({ user_id: me.id, tmdb_id: tmdbId, title: item.title, poster: item.poster, year: item.year, rating: item.ratingNum, type: item.type });
      }
    }
  }

  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const norm = s => s?.toLowerCase().replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim() || '';
  const matchesSearch = (title, desc, q) => {
    if (!q || !title) return false;
    const nt = norm(title), nd = norm(desc || ''), nq = norm(q);
    if (nt.includes(nq) || nd.includes(nq)) return true;
    const qw = nq.split(' ').filter(Boolean), tw = nt.split(' ');
    return qw.length > 1 && qw.every(w => tw.some(t => t === w || t.startsWith(w)));
  };
  const getYearRange = parts => {
    const y = (parts || []).map(p => +(p.release_date || p.first_air_date || '').slice(0,4)).filter(Boolean).sort((a,b)=>a-b);
    return y.length ? `${y[0]}–${y[y.length-1]}` : 'N/A';
  };
  const typeLabel = f => {
    if (f.type==='franchises') return f.entries+' Films';
    if (f.type==='movies') return 'Film';
    return f.entries+' Season'+(f.entries>1?'s':'');
  };

  const applyFilter = () => {
    const q = searchQ.trim();
    filteredItems = allItems.filter(f => (activeFilter==='all'||f.type===activeFilter) && (!q||matchesSearch(f.title,f.desc,q)));
    page=0; cardKey++;
  };

  const ingestItem = f => {
    if (allItems.some(i => i.id===f.id)) return;
    allItems = [...allItems, f];
    if (!featuredItem && f.bg && f.ratingNum > 7.5) featuredItem = f;
    const q = searchQ.trim();
    if (q && !matchesSearch(f.title,f.desc,q)) return;
    if (activeFilter!=='all' && f.type!==activeFilter) return;
    filteredItems = [...filteredItems, f];
  };

  const addFranchise = c => {
    if (!c.parts||c.parts.length<2||idSet.franchises.has(c.id)) return;
    idSet.franchises.add(c.id); c.parts.forEach(p=>{partIdSet.add(p.id);});
    ingestItem({id:'col_'+c.id,type:'franchises',title:(c.name||'').replace(/ Collection$/i,''),entries:c.parts.length,desc:c.overview||'',poster:c.poster_path?IMG+'/w500'+c.poster_path:'',bg:c.backdrop_path?IMG+'/w1280'+c.backdrop_path:'',years:getYearRange(c.parts),year:(c.parts[0]?.release_date||'').slice(0,4),label:'SAGA',ratingNum:0,rating:'—'});
    c.parts.forEach(p=>addFranchiseMovie(p,c.id));
  };
  const addFranchiseMovie = (m,fid) => {
    if (!m?.id||idSet.movies.has(m.id)) return; idSet.movies.add(m.id);
    ingestItem({id:m.id,type:'movies',title:m.title||m.original_title||'Unknown',entries:1,desc:m.overview||'',poster:m.poster_path?IMG+'/w500'+m.poster_path:'',bg:m.backdrop_path?IMG+'/w1280'+m.backdrop_path:'',years:m.release_date?m.release_date.slice(0,4):'N/A',year:m.release_date?m.release_date.slice(0,4):'',label:'FILM',ratingNum:m.vote_average||0,rating:m.vote_average?m.vote_average.toFixed(1):'—',franchiseId:fid});
  };
  const addSingleMovie = m => {
    if (!m?.id||idSet.movies.has(m.id)) return; idSet.movies.add(m.id);
    ingestItem({id:m.id,type:'movies',title:m.title||m.original_title||'Unknown',entries:1,desc:m.overview||'',poster:m.poster_path?IMG+'/w500'+m.poster_path:'',bg:m.backdrop_path?IMG+'/w1280'+m.backdrop_path:'',years:m.release_date?m.release_date.slice(0,4):'N/A',year:m.release_date?m.release_date.slice(0,4):'',label:'FILM',ratingNum:m.vote_average||0,rating:m.vote_average?m.vote_average.toFixed(1):'—'});
  };
  const addTV = (show,sk) => {
    if (!show.id||idSet[sk].has(show.id)) return; idSet[sk].add(show.id);
    ingestItem({id:show.id,type:sk,title:show.name||show.original_name||'Unknown',entries:show.number_of_seasons||1,desc:show.overview||'',poster:show.poster_path?IMG+'/w500'+show.poster_path:'',bg:show.backdrop_path?IMG+'/w1280'+show.backdrop_path:'',years:show.first_air_date?show.first_air_date.slice(0,4)+(show.last_air_date&&show.status!=='Returning Series'?'–'+show.last_air_date.slice(0,4):'–'):'N/A',year:show.first_air_date?show.first_air_date.slice(0,4):'',status:show.status||'',label:show.status==='Ended'||show.status==='Canceled'?'ENDED':'ONGOING',ratingNum:show.vote_average||0,rating:show.vote_average?show.vote_average.toFixed(1):'—'});
  };

  const fetchCollection = async id=>{try{const r=await fetch(`${BASE}/collection/${id}?api_key=${TMDB_KEY}`);addFranchise(await r.json());}catch(e){}};
  const procMovies = async ids=>{
    const res=await Promise.allSettled(ids.map(id=>fetch(`${BASE}/movie/${id}?api_key=${TMDB_KEY}`).then(r=>r.json()).catch(()=>null)));
    const nc=[];
    res.forEach(r=>{if(r.status!=='fulfilled'||!r.value)return;const m=r.value;if(m.belongs_to_collection?.id){const cid=m.belongs_to_collection.id;if(!colIdSet.has(cid)){colIdSet.add(cid);nc.push(cid);}}else{addSingleMovie(m);}});
    if(nc.length)await Promise.all(nc.map(id=>fetchCollection(id)));
  };
  const fetchTV = async(id,sk)=>{try{const r=await fetch(`${BASE}/tv/${id}?api_key=${TMDB_KEY}`);const d=await r.json();if(d.number_of_seasons>=1)addTV(d,sk);}catch(e){}};
  const searchMedia = async(query,type='all')=>{
    const qw=norm(query).split(' ').filter(Boolean);
    try{
      if(type==='all'||type==='movies'){const mr=await fetch(`${BASE}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&page=1`);const md=await mr.json();if(md.results){const vr=md.results.filter(m=>qw.every(w=>norm(m.title||'').includes(w)||norm(m.original_title||'').includes(w)));for(const m of vr.slice(0,5)){if(!idSet.movies.has(m.id)){const d=await fetch(`${BASE}/movie/${m.id}?api_key=${TMDB_KEY}`).then(r=>r.json()).catch(()=>null);if(d?.id){if(d.belongs_to_collection?.id)await fetchCollection(d.belongs_to_collection.id);else addSingleMovie(d);}}}}}
      if(type==='all'||type==='series'||type==='anime'){const tr=await fetch(`${BASE}/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&page=1`);const td=await tr.json();if(td.results){const vr=td.results.filter(s=>qw.every(w=>norm(s.name||'').includes(w)||norm(s.original_name||'').includes(w)));for(const s of vr.slice(0,5)){const isA=s.genre_ids?.includes(16)||norm(s.name).includes('anime');const sk=isA?'anime':'series';if(type==='all'||type===sk){if(!idSet[sk].has(s.id)){const d=await fetch(`${BASE}/tv/${s.id}?api_key=${TMDB_KEY}`).then(r=>r.json()).catch(()=>null);if(d?.id)addTV(d,sk);}}}}}
    }catch(e){}
  };

  const discoverFranchises=async()=>{let tp=200;try{const r=await fetch(`${BASE}/discover/movie?api_key=${TMDB_KEY}&sort_by=popularity.desc&page=1`);tp=Math.min((await r.json()).total_pages||200,200);}catch(e){}const pages=Array.from({length:tp},(_,i)=>i+1);for(let i=0;i<pages.length;i+=20){const pr=await Promise.allSettled(pages.slice(i,i+20).map(p=>fetch(`${BASE}/discover/movie?api_key=${TMDB_KEY}&sort_by=popularity.desc&page=${p}`).then(r=>r.json()).catch(()=>({results:[]}))));const mids=[];pr.forEach(r=>{if(r.status==='fulfilled')(r.value.results||[]).forEach(m=>mids.push(m.id));});for(let j=0;j<mids.length;j+=40)await procMovies(mids.slice(j,j+40));}for(const sort of['vote_count.desc','revenue.desc']){for(let p=1;p<=40;p++){try{const r=await fetch(`${BASE}/discover/movie?api_key=${TMDB_KEY}&sort_by=${sort}&page=${p}`);const d=await r.json();const mids=(d.results||[]).map(m=>m.id);if(!mids.length)break;for(let j=0;j<mids.length;j+=40)await procMovies(mids.slice(j,j+40));if(d.total_pages<=p)break;}catch(e){break;}}}loadState={...loadState,franchises:true};};
  const discoverMovies=async()=>{for(const sort of['popularity.desc','vote_average.desc&vote_count.gte=1000','revenue.desc']){for(let p=1;p<=50;p++){try{const r=await fetch(`${BASE}/discover/movie?api_key=${TMDB_KEY}&sort_by=${sort}&page=${p}`);const d=await r.json();const results=d.results||[];if(!results.length)break;const ids=results.map(m=>m.id).filter(id=>!idSet.movies.has(id)&&!partIdSet.has(id));for(let j=0;j<ids.length;j+=20){const dets=await Promise.allSettled(ids.slice(j,j+20).map(id=>fetch(`${BASE}/movie/${id}?api_key=${TMDB_KEY}`).then(r=>r.json()).catch(()=>null)));dets.forEach(res=>{if(res.status!=='fulfilled'||!res.value)return;const m=res.value;if(m.belongs_to_collection?.id){const cid=m.belongs_to_collection.id;if(!colIdSet.has(cid)){colIdSet.add(cid);fetchCollection(cid);}}else{addSingleMovie(m);}});}if(d.total_pages<=p)break;}catch(e){break;}}}loadState={...loadState,movies:true};};
  const discoverAnime=async()=>{for(const url of[`${BASE}/discover/tv?api_key=${TMDB_KEY}&with_genres=16&with_origin_country=JP&sort_by=popularity.desc`,`${BASE}/discover/tv?api_key=${TMDB_KEY}&with_keywords=210024&sort_by=popularity.desc`]){for(let p=1;p<=50;p++){try{const r=await fetch(`${url}&page=${p}`);const d=await r.json();const results=d.results||[];if(!results.length)break;await Promise.allSettled(results.map(x=>x.id).filter(id=>!idSet.anime.has(id)).map(id=>fetchTV(id,'anime')));if(d.total_pages<=p)break;}catch(e){break;}}}loadState={...loadState,anime:true};};
  const discoverSeries=async()=>{for(const sort of['popularity.desc','vote_count.desc','first_air_date.desc']){for(let p=1;p<=40;p++){try{const r=await fetch(`${BASE}/discover/tv?api_key=${TMDB_KEY}&sort_by=${sort}&page=${p}&without_genres=16&vote_count.gte=50`);const d=await r.json();const results=d.results||[];if(!results.length)break;await Promise.allSettled(results.map(x=>x.id).filter(id=>!idSet.series.has(id)).map(id=>fetchTV(id,'series')));if(d.total_pages<=p)break;}catch(e){break;}}}loadState={...loadState,series:true};};

  const goPage = p=>{if(p<0||p>=np)return;page=p;cardKey++;window.scrollTo({top:0,behavior:'smooth'});};
  const goToGuide = (href,e)=>{e.preventDefault();searchOpen=false;goto(href);};
  const handleSearchKey = e=>{if(e.key==='Enter'&&searchQ.trim()){e.preventDefault();applyFilter();searchOpen=false;setTimeout(()=>document.getElementById('browse')?.scrollIntoView({behavior:'smooth',block:'start'}),100);}};
  async function signOut(){await supabase.auth.signOut();goto('/signin');}

  let searchTimeout, prevQ=$state('');
  $effect(()=>{
    const q=searchQ;
    if(q===prevQ)return; prevQ=q;
    clearTimeout(searchTimeout);
    if(!q.trim()){searchResults=[];applyFilter();isSearching=false;return;}
    searchResults=allItems.filter(f=>matchesSearch(f.title,f.desc,q)).slice(0,8);
    isSearching=true;
    searchTimeout=setTimeout(async()=>{
      applyFilter();
      if(filteredItems.length===0&&q.length>1){await searchMedia(q,activeFilter);applyFilter();searchResults=allItems.filter(f=>matchesSearch(f.title,f.desc,q)).slice(0,8);}
      isSearching=false;
    },300);
    return()=>clearTimeout(searchTimeout);
  });

  onMount(async()=>{
    const{data:{user:u}}=await supabase.auth.getUser();
    user=u; await loadUser();
    setTimeout(()=>heroReady=true,80);
    discoverFranchises();discoverMovies();discoverAnime();discoverSeries();
  });

  const TYPE={
    franchises:{label:'SAGA',  color:'#F0C040',dimBg:'rgba(240,192,64,0.12)', border:'rgba(240,192,64,0.35)'},
    movies:    {label:'FILM',  color:'#D0CCCA',dimBg:'rgba(208,204,202,0.08)', border:'rgba(208,204,202,0.25)'},
    anime:     {label:'ANIME', color:'#F06090',dimBg:'rgba(240,96,144,0.12)',  border:'rgba(240,96,144,0.35)'},
    series:    {label:'SERIES',color:'#40C8F0',dimBg:'rgba(64,200,240,0.12)',  border:'rgba(64,200,240,0.35)'},
  };
  const FILTERS=[['all','All'],['franchises','Sagas'],['movies','Films'],['anime','Anime'],['series','Series']];
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,900;1,400;1,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
</svelte:head>

<svelte:window
  onscroll={()=>navScrolled=window.scrollY>48}
  onclick={e=>{
    if(userMenuOpen&&!e.target.closest('.umw'))userMenuOpen=false;
    if(searchOpen&&!e.target.closest('.search-overlay')&&!e.target.closest('.search-toggle'))searchOpen=false;
  }}
  onkeydown={e=>{if(e.key==='Escape'){searchOpen=false;userMenuOpen=false;}}}
/>

<!-- ═══════════ NAVBAR ═══════════ -->
<header class="navbar" class:navbar--scrolled={navScrolled}>
  <div class="navbar__inner">

    <a href="/" class="navbar__logo">
      <div class="navbar__logo-icon">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="0.5" y="0.5" width="5.5" height="5.5" fill="#0C0C10"/>
          <rect x="8" y="0.5" width="5.5" height="5.5" fill="#0C0C10"/>
          <rect x="0.5" y="8" width="5.5" height="5.5" fill="#0C0C10"/>
          <rect x="8" y="8" width="5.5" height="5.5" fill="#0C0C10"/>
        </svg>
      </div>
      <span class="navbar__logo-text">WATCHORDER</span>
    </a>

    <nav class="navbar__filters">
      {#each FILTERS as [t,l]}
        {@const cfg=TYPE[t]}
        <button class="navbar__filter" class:navbar__filter--active={activeFilter===t}
          style={activeFilter===t&&cfg?`--ac:${cfg.color}`:''}
          onclick={()=>{activeFilter=t;page=0;applyFilter();}}>
          {l}
        </button>
      {/each}
    </nav>

    <div class="navbar__actions">
      <div class="navbar__counter">
        <span class="navbar__counter-dot" class:navbar__counter-dot--live={!done}></span>
        <span class="navbar__counter-num">{totalFiltered.toLocaleString()}</span>
      </div>

      <button class="search-toggle navbar__icon-btn" onclick={()=>searchOpen=!searchOpen} aria-label="Search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      </button>

      <a href="/app/chat" class="navbar__icon-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </a>

      <a href="/recommendations" class="navbar__cta">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        Recommend
      </a>

      {#if user}
        <div class="umw">
          <button class="navbar__avatar" onclick={()=>userMenuOpen=!userMenuOpen}>
            {#if userAvatar}<img src={userAvatar} alt={userName} referrerpolicy="no-referrer"/>{:else}<span>{userInitials()}</span>{/if}
          </button>
          {#if userMenuOpen}
            <div class="user-menu">
              <div class="user-menu__header">
                {#if userAvatar}<img src={userAvatar} alt={userName} referrerpolicy="no-referrer" class="user-menu__avatar"/>{:else}<div class="user-menu__avatar-init">{userInitials()}</div>{/if}
                <div>
                  <p class="user-menu__name">{userName}</p>
                  <p class="user-menu__email">{user.email}</p>
                </div>
              </div>
              <div class="user-menu__divider"></div>
              {#each [['/app/Profile','Profile'],['/app/favorites','Favorites'],['/app/logged','Watched'],['/app/watchlist','Watchlist'],['/app/chat','Chat']] as [href,label]}
                <a {href} class="user-menu__item" onclick={()=>userMenuOpen=false}>{label}</a>
              {/each}
              <div class="user-menu__divider"></div>
              <button class="user-menu__item user-menu__item--danger" onclick={signOut}>Sign out</button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</header>

<!-- ═══════════ SEARCH OVERLAY ═══════════ -->
{#if searchOpen}
  <div class="search-overlay">
    <div class="search-overlay__backdrop"></div>
    <div class="search-overlay__panel">
      <div class="search-overlay__bar">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="search-overlay__icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input
          bind:value={searchQ}
          placeholder="Search films, sagas, anime, series…"
          autofocus autocomplete="off"
          class="search-overlay__input"
          onkeydown={handleSearchKey}/>
        {#if isSearching}
          <div class="search-overlay__spinner"></div>
        {:else if searchQ}
          <button class="search-overlay__clear" onclick={()=>searchQ=''}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        {/if}
        <button class="search-overlay__esc" onclick={()=>searchOpen=false}>ESC</button>
      </div>

      {#if searchQ.trim()}
        <div class="search-overlay__results">
          {#if searchResults.length>0}
            {#each searchResults as f (f.id)}
              {@const cfg=TYPE[f.type]||TYPE.movies}
              <a href="/app/guide?type={f.type}&id={f.id}" class="search-result" onclick={e=>goToGuide(`/app/guide?type=${f.type}&id=${f.id}`,e)}>
                <div class="search-result__thumb">
                  {#if f.poster}<img src={f.poster.replace('/w500','/w92')} alt=""/>{:else}<span>{f.title[0]}</span>{/if}
                </div>
                <div class="search-result__info">
                  <p class="search-result__title">{f.title}</p>
                  <p class="search-result__meta">
                    <span style="color:{cfg.color}">{cfg.label}</span>
                    <span>·</span>
                    <span>{f.years}</span>
                  </p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-result__arrow"><path d="M9 18l6-6-6-6"/></svg>
              </a>
            {/each}
            <p class="search-overlay__hint">↵ Press Enter to see all results</p>
          {:else if !isSearching}
            <p class="search-overlay__empty">No results — try different keywords</p>
          {/if}
        </div>
      {:else}
        <p class="search-overlay__prompt">Start typing to search the full catalog…</p>
      {/if}
    </div>
  </div>
{/if}

<!-- ═══════════ HERO ═══════════ -->
<section class="hero" class:hero--ready={heroReady}>
  <!-- Full-bleed backdrop -->
  <div class="hero__backdrop">
    {#if featuredItem?.bg}
      <img src={featuredItem.bg} alt="" class="hero__backdrop-img"/>
    {/if}
    <div class="hero__backdrop-scrim-h"></div>
    <div class="hero__backdrop-scrim-v"></div>
    <div class="hero__backdrop-noise"></div>
  </div>

  <div class="hero__body">
    <!-- Left: headline -->
    <div class="hero__left">
      <div class="hero__eyebrow">
        <span class="hero__eyebrow-dot"></span>
        <span>WATCHORDER.IO — CINEMA DATABASE</span>
      </div>

      <h1 class="hero__heading">
        <span class="hero__heading-pre">The Complete</span>
        <span class="hero__heading-main">Universe</span>
        <span class="hero__heading-ghost">Database.</span>
      </h1>

      <p class="hero__sub">
        Every franchise, film, anime and series — mapped, ordered, and ready to watch in one place.
      </p>

      <div class="hero__buttons">
        <a href="/recommendations" class="btn btn--gold">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          Get Recommendations
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
        <button class="btn btn--ghost" onclick={()=>searchOpen=true}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          Search Library
        </button>
      </div>
    </div>

    <!-- Right: catalog board -->
    <div class="catalog-board">
      <div class="catalog-board__header">
        <span class="catalog-board__label">CATALOG</span>
        <div class="catalog-board__status">
          <span class="catalog-board__status-dot" class:catalog-board__status-dot--live={!done}></span>
          <span>{done?'Loaded':'Indexing…'}</span>
        </div>
      </div>
      <div class="catalog-board__progress">
        <div class="catalog-board__progress-fill" style="width:{loadingProgress*100}%"></div>
      </div>
      {#each Object.entries(TYPE) as [type,cfg],i}
        <button class="catalog-board__row" class:catalog-board__row--active={activeFilter===type}
          style={activeFilter===type?`border-left-color:${cfg.color}`:''}
          onclick={()=>{activeFilter=type;page=0;applyFilter();}}>
          <span class="catalog-board__row-idx">0{i+1}</span>
          <span class="catalog-board__row-sep"></span>
          <span class="catalog-board__row-type" style="color:{activeFilter===type?cfg.color:'rgba(255,255,255,0.38)'}">{cfg.label}S</span>
          <span class="catalog-board__row-count" style="color:{cfg.color}">{countByType[type].toLocaleString()}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="catalog-board__row-arr"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      {/each}
      <div class="catalog-board__footer">Franchises · Films · Anime · Series</div>
    </div>
  </div>

  <div class="hero__scroll-cue">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
  </div>
</section>

<!-- ═══════════ BROWSE ═══════════ -->
<section id="browse" class="browse">

  <!-- Sticky filter bar -->
  <div class="filter-bar">
    <div class="filter-bar__inner">
      <div class="filter-bar__tabs">
        {#each FILTERS as [t,l]}
          {@const cfg=TYPE[t]}
          <button class="filter-tab" class:filter-tab--active={activeFilter===t}
            style={activeFilter===t&&cfg?`--ac:${cfg.color}`:''} 
            onclick={()=>{activeFilter=t;page=0;applyFilter();}}>
            {l}
            {#if t!=='all'&&countByType[t]>0}
              <span class="filter-tab__count">{countByType[t].toLocaleString()}</span>
            {/if}
          </button>
        {/each}
      </div>
      <div class="filter-bar__meta">
        {#if isSearching}<span class="filter-bar__scanning">Scanning…</span>{/if}
        <span class="filter-bar__total">{totalFiltered.toLocaleString()} titles</span>
      </div>
    </div>
  </div>

  <!-- Grid -->
  <div class="grid-wrap">
    {#if currentItems.length>0}
      <div class="card-grid" key={cardKey}>
        {#each currentItems as f,i (f.id)}
          {@const tmdbId=String(f.id).replace('col_','')}
          {@const itemKey=`${f.type}:${tmdbId}`}
          {@const logged=loggedIds.has(itemKey)}
          {@const fav=favIds.has(itemKey)}
          {@const cfg=TYPE[f.type]||TYPE.movies}
          <a href="/app/guide?type={f.type}&id={f.id}"
            class="card" class:card--marked={logged||fav}
            style="--ac:{cfg.color};--ab:{cfg.dimBg};--abr:{cfg.border};animation-delay:{i*22}ms"
            onclick={e=>goToGuide(`/app/guide?type=${f.type}&id=${f.id}`,e)}>

            <!-- Poster -->
            <div class="card__poster" style={fav||logged?`box-shadow:0 0 0 2px ${cfg.border},0 8px 32px rgba(0,0,0,0.5)`:''}>
              {#if f.poster}
                <img src={f.poster} alt={esc(f.title)} loading="lazy" class="card__poster-img"/>
              {:else}
                <div class="card__poster-blank">
                  <span>{f.title[0]}</span>
                </div>
              {/if}

              <!-- Bottom scrim always visible -->
              <div class="card__scrim"></div>

              <!-- Badges top row -->
              <div class="card__badges">
                <span class="card__badge-type" style="color:{cfg.color};background:{cfg.dimBg};border-color:{cfg.border}">{cfg.label}</span>
                {#if f.ratingNum>0}
                  <span class="card__badge-rating">★ {f.rating}</span>
                {/if}
              </div>

              <!-- Airing -->
              {#if f.label==='ONGOING'}
                <span class="card__badge-live"><i></i>AIRING</span>
              {/if}

              <!-- Hover overlay -->
              <div class="card__hover">
                <div class="card__hover-actions">
                  <button class="card__action-btn" class:card__action-btn--active={logged}
                    onclick={e=>{e.preventDefault();e.stopPropagation();toggleLog(f);}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3" fill={logged?'currentColor':'none'}/></svg>
                    {logged?'Watched':'Watch'}
                  </button>
                  <button class="card__action-btn card__action-btn--fav" class:card__action-btn--fav-on={fav}
                    onclick={e=>{e.preventDefault();e.stopPropagation();toggleFav(f);}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill={fav?'currentColor':'none'} stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    {fav?'Saved':'Save'}
                  </button>
                </div>
                <div class="card__hover-guide">View Guide →</div>
              </div>

              <!-- Color accent bar -->
              <div class="card__accent-bar"></div>
            </div>

            <!-- Info -->
            <div class="card__info">
              <div class="card__info-row">
                <span class="card__info-year">{f.years}</span>
                <span class="card__info-type" style="color:{cfg.color}">{typeLabel(f)}</span>
              </div>
              <h3 class="card__title">{f.title}</h3>
              {#if fav||logged}
                <div class="card__tags">
                  {#if fav}<span class="card__tag card__tag--fav">♥ Saved</span>{/if}
                  {#if logged&&!fav}<span class="card__tag card__tag--watched">✓ Watched</span>{/if}
                </div>
              {/if}
            </div>
          </a>
        {/each}
      </div>

      <!-- Pagination -->
      {#if np>1}
        <div class="pagination">
          <button class="pagination__btn" disabled={!hasPrev} onclick={()=>goPage(page-1)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Prev
          </button>
          <div class="pagination__nums">
            {#each pageNumbers as pn}
              {#if pn===-1}
                <span class="pagination__ellipsis">…</span>
              {:else}
                <button class="pagination__num" class:pagination__num--active={pn===page} onclick={()=>goPage(pn)}>{pn+1}</button>
              {/if}
            {/each}
          </div>
          <button class="pagination__btn pagination__btn--next" disabled={!hasNext} onclick={()=>goPage(page+1)}>
            Next
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      {/if}

    {:else if searchQ.trim()&&!isSearching}
      <div class="empty-state">
        <p class="empty-state__glyph">∅</p>
        <p class="empty-state__msg">No results for <em>"{searchQ}"</em></p>
        <button class="empty-state__btn" onclick={()=>{searchQ='';applyFilter();}}>Clear Search</button>
      </div>

    {:else}
      <div class="card-grid">
        {#each Array(24) as _,i}
          <div class="skeleton" style="animation-delay:{i*22}ms">
            <div class="skeleton__poster"></div>
            <div class="skeleton__info">
              <div class="skeleton__line" style="width:40%"></div>
              <div class="skeleton__line skeleton__line--tall" style="width:80%"></div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</section>

<!-- ═══════════ MOBILE NAV ═══════════ -->
<nav class="mobile-nav">
  {#each [['all','All','M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],['franchises','Sagas','M4 6h16M4 12h16M4 18h16'],['movies','Films','M2 4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4zM10 15V9l5 3-5 3z'],['anime','Anime','M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2'],['series','Series','M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7zM17 2l-5 5-5-5']] as [t,l,icon]}
    {@const cfg=TYPE[t]}
    <button class="mobile-nav__btn" class:mobile-nav__btn--active={activeFilter===t}
      style={activeFilter===t&&cfg?`--mc:${cfg.color}`:''}
      onclick={()=>{activeFilter=t;page=0;applyFilter();}}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d={icon}/></svg>
      <span>{l}</span>
    </button>
  {/each}
</nav>

<style>
  /* ══════════════════════════════════════════════════════
     GLOBAL
  ══════════════════════════════════════════════════════ */
  :global(*) { margin:0; padding:0; box-sizing:border-box; }
  :global(html) { scroll-behavior:smooth; font-size:16px; }
  :global(body) {
    background: #0C0C10;
    color: #E4E0DA;
    font-family: 'Sora', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow-x: hidden;
  }
  :global(::selection) { background: rgba(240,192,64,0.28); }
  :global(:focus-visible) { outline: 2px solid #F0C040; outline-offset: 3px; border-radius: 4px; }
  :global(::-webkit-scrollbar) { width: 5px; height: 5px; }
  :global(::-webkit-scrollbar-track) { background: #0C0C10; }
  :global(::-webkit-scrollbar-thumb) { background: #28262E; border-radius: 3px; }
  :global(::-webkit-scrollbar-thumb:hover) { background: #3A3844; }

  /* Tokens */
  :root {
    --gold:   #F0C040;
    --gold-d: rgba(240,192,64,0.12);
    --gold-b: rgba(240,192,64,0.35);
    --bg:     #0C0C10;
    --bg1:    #111118;
    --bg2:    #18171F;
    --bg3:    #201F28;
    --bg4:    #2A2930;
    --ink:    #E4E0DA;
    --ink2:   #948E98;
    --ink3:   #524E5A;
    --ink4:   #302E38;
    --border: rgba(255,255,255,0.07);
    --border2:rgba(255,255,255,0.12);
    --nav-h:  64px;
    --gutter: clamp(16px, 4vw, 64px);
  }

  /* Animations */
  @keyframes fadeUp   { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
  @keyframes menuIn   { from { opacity:0; transform:translateY(-8px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
  @keyframes searchIn { from { opacity:0; } to { opacity:1; } }
  @keyframes accentIn { from { transform:scaleX(0); } to { transform:scaleX(1); } }
  @keyframes pulse    { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:0.4;transform:scale(0.9);} }
  @keyframes bounce   { 0%,100%{transform:translateY(0);} 50%{transform:translateY(5px);} }
  @keyframes shimmer  { from{background-position:200% center;} to{background-position:-200% center;} }
  @keyframes spin     { to{transform:rotate(360deg);} }

  /* ══════════════════════════════════════════════════════
     NAVBAR
  ══════════════════════════════════════════════════════ */
  .navbar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 500;
    height: var(--nav-h);
    transition: background 0.3s, border-color 0.3s, backdrop-filter 0.3s;
    border-bottom: 1px solid transparent;
  }
  .navbar--scrolled {
    background: rgba(12,12,16,0.92);
    backdrop-filter: blur(24px) saturate(1.5);
    border-color: var(--border);
  }
  .navbar__inner {
    max-width: 1680px; margin: 0 auto;
    height: 100%; padding: 0 var(--gutter);
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 24px;
  }

  /* Logo */
  .navbar__logo {
    display: flex; align-items: center; gap: 11px;
    text-decoration: none; flex-shrink: 0;
  }
  .navbar__logo-icon {
    width: 34px; height: 34px;
    background: var(--gold);
    border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.2s;
  }
  .navbar__logo:hover .navbar__logo-icon { transform: scale(1.06); }
  .navbar__logo-text {
    font-family: 'Sora', sans-serif;
    font-size: 13px; font-weight: 700;
    letter-spacing: 0.18em; color: var(--ink);
  }

  /* Filters */
  .navbar__filters {
    display: flex; justify-content: center;
    gap: 2px;
  }
  .navbar__filter {
    position: relative;
    background: none; border: none; cursor: pointer;
    font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600;
    letter-spacing: 0.13em; text-transform: uppercase;
    color: var(--ink3); padding: 8px 18px; height: var(--nav-h);
    transition: color 0.15s;
  }
  .navbar__filter:hover { color: var(--ink2); }
  .navbar__filter--active { color: var(--ac, var(--gold)) !important; }
  .navbar__filter--active::after {
    content: '';
    position: absolute; bottom: 0; left: 18px; right: 18px;
    height: 2px; background: var(--ac, var(--gold));
    border-radius: 2px 2px 0 0;
  }

  /* Actions */
  .navbar__actions {
    display: flex; align-items: center; gap: 8px; justify-content: flex-end;
  }
  .navbar__counter {
    display: flex; align-items: center; gap: 7px;
    padding: 0 12px; height: 34px;
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 999px;
    font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink3);
  }
  .navbar__counter-dot {
    width: 7px; height: 7px; border-radius: 50%; background: #3CB878; flex-shrink: 0;
  }
  .navbar__counter-dot--live {
    background: var(--gold);
    animation: pulse 1.6s ease-in-out infinite;
    box-shadow: 0 0 8px rgba(240,192,64,0.5);
  }
  .navbar__counter-num { min-width: 40px; text-align: right; }
  .navbar__icon-btn {
    width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    background: var(--bg2); border: 1px solid var(--border); border-radius: 10px;
    color: var(--ink3); cursor: pointer; text-decoration: none;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .navbar__icon-btn:hover { color: var(--ink); border-color: var(--border2); background: var(--bg3); }
  .navbar__cta {
    display: flex; align-items: center; gap: 7px;
    height: 36px; padding: 0 18px;
    background: var(--gold); color: #0C0C10;
    font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.06em;
    text-decoration: none; border-radius: 10px;
    transition: opacity 0.15s, transform 0.15s;
  }
  .navbar__cta:hover { opacity: 0.9; transform: translateY(-1px); }
  .navbar__avatar {
    width: 36px; height: 36px; border-radius: 10px; overflow: hidden;
    background: var(--gold-d); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 700; color: var(--gold);
    transition: border-color 0.15s;
  }
  .navbar__avatar:hover { border-color: var(--gold-b); }
  .navbar__avatar img { width: 100%; height: 100%; object-fit: cover; }

  /* User dropdown */
  .user-menu {
    position: absolute; top: calc(100% + 10px); right: 0;
    width: 230px; background: var(--bg2);
    border: 1px solid var(--border2); border-radius: 16px;
    overflow: hidden; padding: 6px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.7);
    animation: menuIn 0.18s cubic-bezier(0.16,1,0.3,1);
    z-index: 600;
  }
  .user-menu__header {
    display: flex; align-items: center; gap: 11px;
    padding: 12px; border-radius: 10px;
    background: rgba(255,255,255,0.03);
    margin-bottom: 4px;
  }
  .user-menu__avatar {
    width: 36px; height: 36px; border-radius: 8px; object-fit: cover; flex-shrink: 0;
  }
  .user-menu__avatar-init {
    width: 36px; height: 36px; border-radius: 8px;
    background: var(--gold-d); display: flex; align-items: center; justify-content: center;
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 700; color: var(--gold);
    flex-shrink: 0;
  }
  .user-menu__name { font-size: 14px; font-weight: 600; color: var(--ink); }
  .user-menu__email {
    font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink3);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 145px;
  }
  .user-menu__divider { height: 1px; background: var(--border); margin: 4px 0; }
  .user-menu__item {
    display: block; padding: 10px 12px; border-radius: 8px;
    font-size: 13px; font-weight: 500; color: var(--ink2);
    text-decoration: none; background: none; border: none; cursor: pointer;
    width: 100%; text-align: left;
    transition: background 0.12s, color 0.12s;
  }
  .user-menu__item:hover { background: rgba(255,255,255,0.05); color: var(--ink); }
  .user-menu__item--danger:hover { background: rgba(240,80,80,0.1); color: #F07070; }

  /* ══════════════════════════════════════════════════════
     SEARCH OVERLAY
  ══════════════════════════════════════════════════════ */
  .search-overlay {
    position: fixed; inset: 0; z-index: 800;
    animation: searchIn 0.2s ease;
  }
  .search-overlay__backdrop {
    position: absolute; inset: 0;
    background: rgba(12,12,16,0.96);
    backdrop-filter: blur(28px);
  }
  .search-overlay__panel {
    position: relative; z-index: 1;
    max-width: 800px; margin: 0 auto;
    padding: 0 24px; height: 100%;
    display: flex; flex-direction: column;
  }
  .search-overlay__bar {
    display: flex; align-items: center; gap: 18px;
    padding: 24px 0; border-bottom: 1px solid var(--border);
    margin-top: 80px;
  }
  .search-overlay__icon { color: var(--ink3); flex-shrink: 0; }
  .search-overlay__input {
    flex: 1; background: none; border: none; outline: none;
    font-family: 'Playfair Display', serif; font-size: 2.4rem; font-style: italic;
    font-weight: 400; color: var(--ink);
  }
  .search-overlay__input::placeholder { color: rgba(228,224,218,0.12); }
  .search-overlay__spinner {
    width: 20px; height: 20px; border-radius: 50%;
    border: 2px solid var(--gold-d); border-top-color: var(--gold);
    animation: spin 0.6s linear infinite; flex-shrink: 0;
  }
  .search-overlay__clear {
    background: none; border: none; color: var(--ink3); cursor: pointer;
    padding: 5px; flex-shrink: 0; transition: color 0.1s;
  }
  .search-overlay__clear:hover { color: var(--ink); }
  .search-overlay__esc {
    font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink3);
    background: var(--bg3); border: 1px solid var(--border); border-radius: 5px;
    padding: 4px 10px; cursor: pointer; flex-shrink: 0;
    transition: border-color 0.1s, color 0.1s;
  }
  .search-overlay__esc:hover { border-color: var(--border2); color: var(--ink2); }
  .search-overlay__results {
    flex: 1; overflow-y: auto; padding: 8px 0; margin-top: 4px;
  }
  .search-overlay__hint {
    padding: 12px 0; text-align: center;
    font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink3);
  }
  .search-overlay__empty {
    padding: 48px 0; text-align: center;
    font-size: 16px; color: var(--ink3); font-style: italic;
  }
  .search-overlay__prompt {
    padding: 80px 0; text-align: center;
    font-size: 16px; color: var(--ink3);
  }

  /* Search results */
  .search-result {
    display: flex; align-items: center; gap: 16px;
    padding: 14px 12px; border-radius: 14px;
    text-decoration: none; color: var(--ink);
    transition: background 0.12s;
  }
  .search-result:hover { background: rgba(255,255,255,0.05); }
  .search-result__thumb {
    width: 44px; height: 64px; border-radius: 8px;
    background: var(--bg3); overflow: hidden; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid var(--border);
    font-family: 'Sora', sans-serif; font-size: 20px; font-weight: 700; color: var(--ink4);
  }
  .search-result__thumb img { width: 100%; height: 100%; object-fit: cover; }
  .search-result__info { flex: 1; min-width: 0; }
  .search-result__title { font-size: 15px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .search-result__meta {
    display: flex; align-items: center; gap: 7px; margin-top: 4px;
    font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink3);
  }
  .search-result__arrow { color: var(--ink3); flex-shrink: 0; transition: transform 0.12s, color 0.12s; }
  .search-result:hover .search-result__arrow { transform: translateX(3px); color: var(--ink2); }

  /* ══════════════════════════════════════════════════════
     HERO
  ══════════════════════════════════════════════════════ */
  .hero {
    position: relative; min-height: 100svh;
    display: flex; flex-direction: column; justify-content: flex-end;
    overflow: hidden;
    opacity: 0; transform: translateY(12px);
    transition: opacity 0.7s ease, transform 0.7s cubic-bezier(0.16,1,0.3,1);
  }
  .hero--ready { opacity: 1; transform: translateY(0); }

  .hero__backdrop { position: absolute; inset: 0; z-index: 0; }
  .hero__backdrop-img {
    width: 100%; height: 100%; object-fit: cover;
    filter: brightness(0.22) saturate(1.4) contrast(1.05);
  }
  .hero__backdrop-scrim-h {
    position: absolute; inset: 0;
    background: linear-gradient(to right, #0C0C10 0%, rgba(12,12,16,0.5) 52%, rgba(12,12,16,0.75) 100%);
  }
  .hero__backdrop-scrim-v {
    position: absolute; inset: 0;
    background: linear-gradient(to top, #0C0C10 0%, rgba(12,12,16,0.55) 40%, transparent 68%);
  }
  .hero__backdrop-noise {
    position: absolute; inset: 0; opacity: 0.025;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 256px;
  }

  .hero__body {
    position: relative; z-index: 2;
    display: grid; grid-template-columns: 1fr 380px; gap: 64px; align-items: end;
    max-width: 1680px; margin: 0 auto; width: 100%;
    padding: 0 var(--gutter) 80px;
  }
  .hero__left { display: flex; flex-direction: column; gap: 32px; }

  .hero__eyebrow {
    display: flex; align-items: center; gap: 12px;
    font-family: 'JetBrains Mono', monospace; font-size: 11px;
    letter-spacing: 0.28em; color: var(--gold); text-transform: uppercase;
  }
  .hero__eyebrow-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--gold); flex-shrink: 0;
    animation: pulse 2.4s ease-in-out infinite;
    box-shadow: 0 0 12px rgba(240,192,64,0.6);
  }

  .hero__heading { display: flex; flex-direction: column; line-height: 0.88; }
  .hero__heading-pre {
    font-family: 'Sora', sans-serif; font-weight: 300;
    font-size: clamp(0.95rem, 1.8vw, 1.3rem);
    letter-spacing: 0.46em; text-transform: uppercase;
    color: rgba(228,224,218,0.28); margin-bottom: 10px;
  }
  .hero__heading-main {
    font-family: 'Playfair Display', serif; font-style: italic;
    font-size: clamp(5rem, 11vw, 10.5rem);
    color: var(--ink); font-weight: 700; line-height: 0.88;
  }
  .hero__heading-ghost {
    font-family: 'Sora', sans-serif; font-weight: 800;
    font-size: clamp(5rem, 11vw, 10.5rem);
    color: transparent;
    -webkit-text-stroke: 1.5px rgba(228,224,218,0.13);
    line-height: 0.85;
  }

  .hero__sub {
    font-size: clamp(0.88rem, 1.3vw, 1.05rem); font-weight: 300; line-height: 1.75;
    color: rgba(228,224,218,0.5); max-width: 500px;
    border-left: 3px solid var(--gold-b); padding-left: 20px;
  }

  .hero__buttons { display: flex; gap: 14px; flex-wrap: wrap; }

  .btn {
    display: inline-flex; align-items: center; gap: 10px;
    height: 52px; padding: 0 30px; border-radius: 14px;
    font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 700;
    text-decoration: none; cursor: pointer; border: none;
    transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
  }
  .btn--gold { background: var(--gold); color: #0C0C10; }
  .btn--gold:hover { opacity: 0.92; transform: translateY(-2px); box-shadow: 0 12px 36px rgba(240,192,64,0.28); }
  .btn--ghost {
    background: rgba(255,255,255,0.07); color: rgba(228,224,218,0.7);
    border: 1px solid rgba(255,255,255,0.14); backdrop-filter: blur(8px);
  }
  .btn--ghost:hover { background: rgba(255,255,255,0.12); color: var(--ink); border-color: rgba(255,255,255,0.22); }

  /* Catalog board */
  .catalog-board {
    background: rgba(12,12,16,0.75); backdrop-filter: blur(24px);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; overflow: hidden;
  }
  .catalog-board__header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 16px 20px; border-bottom: 1px solid var(--border);
  }
  .catalog-board__label {
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
    letter-spacing: 0.26em; color: var(--ink3); text-transform: uppercase;
  }
  .catalog-board__status {
    display: flex; align-items: center; gap: 8px;
    font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--ink3);
  }
  .catalog-board__status-dot {
    width: 7px; height: 7px; border-radius: 50%; background: #3CB878; flex-shrink: 0;
  }
  .catalog-board__status-dot--live {
    background: var(--gold); animation: pulse 1.5s ease-in-out infinite;
  }
  .catalog-board__progress {
    height: 2px; background: var(--border); position: relative;
  }
  .catalog-board__progress-fill {
    position: absolute; left: 0; top: 0; height: 100%;
    background: var(--gold); transition: width 0.5s ease;
  }
  .catalog-board__row {
    display: flex; align-items: center; gap: 14px;
    width: 100%; padding: 16px 20px;
    background: none; border: none; border-bottom: 1px solid var(--border);
    border-left: 3px solid transparent; cursor: pointer; text-align: left;
    transition: background 0.15s, border-left-color 0.2s;
  }
  .catalog-board__row:last-of-type { border-bottom: none; }
  .catalog-board__row:hover { background: rgba(255,255,255,0.04); }
  .catalog-board__row--active { background: rgba(255,255,255,0.055) !important; }
  .catalog-board__row-idx {
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
    color: var(--ink3); width: 22px; flex-shrink: 0;
  }
  .catalog-board__row-sep {
    width: 1px; height: 16px; background: var(--border); flex-shrink: 0;
  }
  .catalog-board__row-type {
    font-family: 'Sora', sans-serif; font-size: 11px; font-weight: 700;
    letter-spacing: 0.2em; text-transform: uppercase; flex: 1;
    transition: color 0.15s;
  }
  .catalog-board__row-count {
    font-family: 'Sora', sans-serif; font-size: 1.6rem; font-weight: 800; line-height: 1;
  }
  .catalog-board__row-arr { color: var(--ink3); transition: transform 0.15s; }
  .catalog-board__row:hover .catalog-board__row-arr { transform: translateX(3px); }
  .catalog-board__footer {
    padding: 14px 20px; border-top: 1px solid var(--border);
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
    color: var(--ink3); letter-spacing: 0.06em;
  }

  .hero__scroll-cue {
    position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
    color: rgba(255,255,255,0.25); z-index: 3;
    animation: bounce 2s ease-in-out infinite;
  }

  /* ══════════════════════════════════════════════════════
     BROWSE
  ══════════════════════════════════════════════════════ */
  .browse { background: var(--bg); }

  /* Filter bar */
  .filter-bar {
    position: sticky; top: var(--nav-h); z-index: 400;
    background: rgba(12,12,16,0.95);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
  }
  .filter-bar__inner {
    max-width: 1680px; margin: 0 auto; padding: 0 var(--gutter);
    display: flex; align-items: center; justify-content: space-between;
    height: 52px; gap: 16px;
  }
  .filter-bar__tabs { display: flex; gap: 0; overflow-x: auto; height: 100%; flex-shrink: 0; }
  .filter-bar__tabs::-webkit-scrollbar { display: none; }
  .filter-tab {
    display: flex; align-items: center; gap: 8px;
    background: none; border: none; border-bottom: 2px solid transparent;
    cursor: pointer; height: 100%; padding: 0 20px; white-space: nowrap;
    font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--ink3); transition: color 0.15s, border-color 0.15s;
  }
  .filter-tab:hover { color: var(--ink2); }
  .filter-tab--active { color: var(--ac, var(--gold)) !important; border-bottom-color: var(--ac, var(--gold)) !important; }
  .filter-tab__count {
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
    background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 99px;
    color: var(--ink3);
  }
  .filter-bar__meta { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
  .filter-bar__total {
    font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink3);
  }
  .filter-bar__scanning {
    font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--gold);
    animation: pulse 1s ease-in-out infinite;
  }

  /* Grid */
  .grid-wrap {
    max-width: 1680px; margin: 0 auto;
    padding: 40px var(--gutter) 140px;
  }

  /* ══ THE CARD GRID — proper movie site layout ══ */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
    gap: 32px 24px;   /* row gap: 32px, column gap: 24px — every card breathes */
  }

  .card {
    display: flex; flex-direction: column; gap: 0;
    text-decoration: none; color: inherit;
    animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both;
  }

  /* Poster — the hero element of every card */
  .card__poster {
    position: relative; aspect-ratio: 2/3;
    border-radius: 14px; overflow: hidden;
    background: var(--bg2);
    box-shadow: 0 8px 28px rgba(0,0,0,0.55);
    transition: transform 0.38s cubic-bezier(0.16,1,0.3,1), box-shadow 0.35s ease;
  }
  .card:hover .card__poster {
    transform: translateY(-10px) scale(1.015);
    box-shadow: 0 28px 70px rgba(0,0,0,0.72), 0 0 0 2px var(--ab, rgba(255,255,255,0.1));
  }

  .card__poster-img {
    width: 100%; height: 100%; object-fit: cover; display: block;
    transition: filter 0.38s, transform 0.5s cubic-bezier(0.16,1,0.3,1);
  }
  .card:hover .card__poster-img { filter: brightness(1.08); transform: scale(1.04); }

  .card__poster-blank {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, var(--bg2), var(--bg3));
  }
  .card__poster-blank span {
    font-family: 'Playfair Display', serif; font-style: italic;
    font-size: 5rem; font-weight: 700; color: rgba(255,255,255,0.05);
  }

  .card__scrim {
    position: absolute; inset: 0; z-index: 1;
    background: linear-gradient(to top, rgba(12,12,16,0.94) 0%, rgba(12,12,16,0.35) 30%, transparent 55%);
  }

  /* Type & rating badges */
  .card__badges {
    position: absolute; top: 12px; left: 12px; right: 12px; z-index: 3;
    display: flex; justify-content: space-between; align-items: flex-start;
  }
  .card__badge-type {
    font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 500;
    letter-spacing: 0.12em; padding: 4px 10px; border-radius: 8px;
    border: 1px solid; backdrop-filter: blur(8px);
  }
  .card__badge-rating {
    font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 500;
    background: rgba(12,12,16,0.82); color: var(--gold);
    border: 1px solid rgba(240,192,64,0.28); padding: 4px 9px; border-radius: 8px;
    backdrop-filter: blur(8px);
  }
  .card__badge-live {
    position: absolute; bottom: 12px; left: 12px; z-index: 3;
    display: flex; align-items: center; gap: 6px;
    font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.14em;
    background: rgba(64,200,240,0.12); color: #40C8F0;
    border: 1px solid rgba(64,200,240,0.32); padding: 4px 10px; border-radius: 8px;
    backdrop-filter: blur(8px);
  }
  .card__badge-live i {
    width: 6px; height: 6px; border-radius: 50%; background: #40C8F0;
    animation: pulse 1.6s ease-in-out infinite;
    box-shadow: 0 0 8px rgba(64,200,240,0.7);
    font-style: normal;
  }

  /* Hover overlay */
  .card__hover {
    position: absolute; inset: 0; z-index: 4;
    display: flex; flex-direction: column; justify-content: flex-end;
    padding: 16px;
    background: linear-gradient(to top, rgba(12,12,16,0.96) 0%, rgba(12,12,16,0.4) 50%, transparent 75%);
    opacity: 0;
    transition: opacity 0.25s ease;
  }
  .card:hover .card__hover { opacity: 1; }

  .card__hover-actions { display: flex; gap: 8px; margin-bottom: 10px; }
  .card__action-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
    padding: 9px 6px; border-radius: 10px;
    font-family: 'Sora', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
    background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18);
    color: var(--ink); cursor: pointer; backdrop-filter: blur(10px);
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .card__action-btn:hover { background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.28); }
  .card__action-btn--active {
    background: rgba(64,200,240,0.2) !important;
    border-color: rgba(64,200,240,0.45) !important;
    color: #40C8F0 !important;
  }
  .card__action-btn--fav { }
  .card__action-btn--fav-on {
    background: rgba(240,192,64,0.2) !important;
    border-color: rgba(240,192,64,0.45) !important;
    color: var(--gold) !important;
  }
  .card__hover-guide {
    font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 700;
    color: rgba(228,224,218,0.9); text-align: center; letter-spacing: 0.06em;
    padding: 10px; border-radius: 10px;
    background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
    backdrop-filter: blur(8px);
  }

  /* Accent color bar slides in top on hover */
  .card__accent-bar {
    position: absolute; top: 0; left: 0; right: 0; height: 3px; z-index: 5;
    background: var(--ac, var(--gold));
    transform: scaleX(0); transform-origin: left;
    transition: transform 0.32s cubic-bezier(0.16,1,0.3,1);
  }
  .card:hover .card__accent-bar { transform: scaleX(1); }

  /* Card info below poster */
  .card__info {
    padding: 14px 2px 0;
  }
  .card__info-row {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 6px;
  }
  .card__info-year {
    font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink3);
  }
  .card__info-type {
    font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500;
  }
  .card__title {
    font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 600;
    line-height: 1.35; color: var(--ink);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .card__tags { display: flex; gap: 7px; margin-top: 7px; flex-wrap: wrap; }
  .card__tag {
    font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 500;
    padding: 3px 9px; border-radius: 99px; border: 1px solid;
  }
  .card__tag--fav { color: var(--gold); border-color: var(--gold-b); background: var(--gold-d); }
  .card__tag--watched { color: #40C8F0; border-color: rgba(64,200,240,0.32); background: rgba(64,200,240,0.1); }

  /* ══════════════════════════════════════════════════════
     SKELETON
  ══════════════════════════════════════════════════════ */
  .skeleton { animation: fadeUp 0.4s ease both; }
  .skeleton__poster {
    aspect-ratio: 2/3; border-radius: 14px;
    background: var(--bg2); overflow: hidden; position: relative;
    box-shadow: 0 8px 28px rgba(0,0,0,0.35);
  }
  .skeleton__poster::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.04) 50%, transparent 75%);
    background-size: 200% 100%; animation: shimmer 2.2s ease-in-out infinite;
  }
  .skeleton__info { padding: 14px 2px 0; display: flex; flex-direction: column; gap: 9px; }
  .skeleton__line {
    height: 11px; background: var(--bg2); border-radius: 99px;
    position: relative; overflow: hidden;
  }
  .skeleton__line::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.04) 50%, transparent 75%);
    background-size: 200% 100%; animation: shimmer 2.2s ease-in-out infinite;
  }
  .skeleton__line--tall { height: 15px; }

  /* ══════════════════════════════════════════════════════
     PAGINATION
  ══════════════════════════════════════════════════════ */
  .pagination {
    display: flex; align-items: center; justify-content: center;
    gap: 8px; margin-top: 64px; padding-top: 48px;
    border-top: 1px solid var(--border); flex-wrap: wrap;
  }
  .pagination__btn {
    display: inline-flex; align-items: center; gap: 8px;
    height: 44px; padding: 0 24px; border-radius: 12px;
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600;
    border: 1px solid var(--border); background: var(--bg2); color: var(--ink3); cursor: pointer;
    transition: all 0.15s;
  }
  .pagination__btn:hover:not(:disabled) { border-color: var(--border2); color: var(--ink); background: var(--bg3); }
  .pagination__btn:disabled { opacity: 0.2; cursor: not-allowed; }
  .pagination__btn--next {
    background: var(--gold-d); border-color: var(--gold-b); color: var(--gold);
  }
  .pagination__btn--next:hover:not(:disabled) { background: var(--gold); color: #0C0C10; border-color: var(--gold); }
  .pagination__nums { display: flex; gap: 4px; }
  .pagination__num {
    width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
    border-radius: 12px; border: 1px solid transparent; background: none;
    font-family: 'JetBrains Mono', monospace; font-size: 13px;
    color: var(--ink3); cursor: pointer; transition: all 0.15s;
  }
  .pagination__num:hover:not(.pagination__num--active) { background: var(--bg3); color: var(--ink); border-color: var(--border); }
  .pagination__num--active { background: var(--gold); color: #0C0C10; font-weight: 700; border-color: var(--gold); }
  .pagination__ellipsis { width: 44px; text-align: center; color: var(--ink3); font-size: 16px; }

  /* ══════════════════════════════════════════════════════
     EMPTY STATE
  ══════════════════════════════════════════════════════ */
  .empty-state {
    display: flex; flex-direction: column; align-items: center; gap: 16px;
    padding: 120px 0; text-align: center;
  }
  .empty-state__glyph {
    font-family: 'Playfair Display', serif; font-size: 6rem; font-style: italic;
    color: rgba(228,224,218,0.05); line-height: 1;
  }
  .empty-state__msg { font-size: 17px; color: var(--ink3); }
  .empty-state__msg em { font-style: normal; color: var(--ink2); font-weight: 600; }
  .empty-state__btn {
    margin-top: 8px; height: 44px; padding: 0 28px; border-radius: 12px;
    border: 1px solid var(--border); background: var(--bg2); color: var(--ink2);
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer;
    transition: all 0.15s;
  }
  .empty-state__btn:hover { border-color: var(--gold-b); color: var(--gold); background: var(--gold-d); }

  /* ══════════════════════════════════════════════════════
     MOBILE NAV
  ══════════════════════════════════════════════════════ */
  .mobile-nav {
    display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 500;
    height: 68px; background: rgba(12,12,16,0.97);
    backdrop-filter: blur(24px) saturate(1.4);
    border-top: 1px solid var(--border);
    padding: 0 6px; align-items: center; justify-content: space-around;
  }
  .mobile-nav__btn {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    background: none; border: none; cursor: pointer;
    color: var(--ink3); padding: 7px 14px; border-radius: 14px;
    transition: color 0.15s, background 0.15s;
    font-family: 'Sora', sans-serif; font-size: 10px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase;
  }
  .mobile-nav__btn--active { color: var(--mc, var(--gold)) !important; background: rgba(255,255,255,0.04); }

  /* ══════════════════════════════════════════════════════
     RESPONSIVE
  ══════════════════════════════════════════════════════ */
  @media (max-width: 1100px) {
    .hero__body { grid-template-columns: 1fr; gap: 48px; }
    .catalog-board { max-width: 500px; }
  }
  @media (max-width: 768px) {
    :root { --nav-h: 56px; --gutter: 16px; }
    .navbar__filters, .navbar__cta { display: none; }
    .mobile-nav { display: flex; }
    .hero__body { padding-bottom: 56px; }
    .catalog-board { display: none; }
    .hero__heading-main, .hero__heading-ghost { font-size: clamp(3.5rem, 14vw, 6rem); }
    .card-grid { grid-template-columns: repeat(2, 1fr); gap: 20px 14px; }
    .grid-wrap { padding: 24px var(--gutter) 120px; }
    .pagination__nums { display: none; }
    .filter-tab__count { display: none; }
  }
  @media (max-width: 420px) {
    .card-grid { gap: 16px 10px; }
    .hero__heading-main, .hero__heading-ghost { font-size: 3rem; }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(*) { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
</style>

