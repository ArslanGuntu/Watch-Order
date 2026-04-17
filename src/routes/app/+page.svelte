<script>
  // @ts-nocheck
  import { onMount } from 'svelte';
  
  const TMDB_KEY = '175b19b3ba717bf4f24e37ee4325be7e';
  const BASE = 'https://api.themoviedb.org/3';
  const IMG = 'https://image.tmdb.org/t/p';
  const PAGE_SIZE = 24;
  
  let activeFilter = $state('all');
  let page = $state(0);
  let searchQ = $state('');
  let allItems = $state([]);
  let filteredItems = $state([]);
  let loadState = $state({ franchises: false, movies: false, anime: false, series: false });
  let idSet = $state({ franchises: new Set(), movies: new Set(), anime: new Set(), series: new Set() });
  let colIdSet = $state(new Set());
  let partIdSet = $state(new Set());
  
  let done = $derived(Object.values(loadState).every(Boolean));
  let np = $derived(Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE)));
  let start = $derived(page * PAGE_SIZE);
  let pageItems = $derived(filteredItems.slice(start, start + PAGE_SIZE));
  let hasPrev = $derived(page > 0);
  let hasNext = $derived(filteredItems.length > start + PAGE_SIZE || !done);
  
  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function norm(s) { return s.toLowerCase().replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim(); }
  function fuzzy(title, q) {
    if (!q) return true;
    const nt = norm(title), nq = norm(q);
    if (nt.includes(nq)) return true;
    return nq.split(' ').filter(Boolean).every(w => nt.split(' ').some(tw => tw.includes(w)));
  }
  function applyFilter() {
    const q = searchQ.trim();
    filteredItems = allItems.filter(f => { const tm = activeFilter === 'all' || f.type === activeFilter; return tm && (!q || fuzzy(f.title, q)); });
    page = 0;
  }
  function getYearRange(parts) {
    const y = (parts||[]).map(p=>+(p.release_date||p.first_air_date||'').slice(0,4)).filter(Boolean).sort((a,b)=>a-b);
    return y.length ? `${y[0]}–${y[y.length-1]}` : 'N/A';
  }
  function ingestItem(f) {
    allItems = [...allItems, f];
    const q = searchQ.trim();
    if ((activeFilter !== 'all' && f.type !== activeFilter) || (q && !fuzzy(f.title, q))) return;
    filteredItems = [...filteredItems, f];
  }
  function addFranchise(c) {
    if (!c.parts || c.parts.length < 2 || idSet.franchises.has(c.id)) return;
    idSet.franchises.add(c.id);
    c.parts.forEach(p => partIdSet.add(p.id));
    ingestItem({ id:'col_'+c.id, tmdbId:c.id, type:'franchises', title:(c.name||'').replace(/ Collection$/i,''), entries:c.parts.length, desc:c.overview||'', bg:c.backdrop_path?IMG+'/w1280'+c.backdrop_path:'', poster:c.poster_path?IMG+'/w500'+c.poster_path:'', years:getYearRange(c.parts), year:(c.parts[0]?.release_date||'').slice(0,4), label:c.parts.length>5?'COMPLEX':'LINEAR', labelCls:c.parts.length>5?'lbl-blue':'lbl-green', ratingNum:0, rating:'—' });
  }
  function addSingleMovie(m) {
    if (!m?.id || idSet.movies.has(m.id) || partIdSet.has(m.id)) return;
    idSet.movies.add(m.id); partIdSet.add(m.id);
    ingestItem({ id:m.id, type:'movies', title:m.title||m.original_title||'Unknown', entries:1, desc:m.overview||'', bg:m.backdrop_path?IMG+'/w1280'+m.backdrop_path:'', poster:m.poster_path?IMG+'/w500'+m.poster_path:'', years:m.release_date?m.release_date.slice(0,4):'N/A', year:m.release_date?m.release_date.slice(0,4):'', label:'FILM', labelCls:'lbl-movie', ratingNum:m.vote_average||0, rating:m.vote_average?m.vote_average.toFixed(1):'—' });
  }
  function addTV(show, sk) {
    if (!show.id || idSet[sk].has(show.id)) return;
    idSet[sk].add(show.id);
    ingestItem({ id:show.id, type:sk, title:show.name||show.original_name||'Unknown', entries:show.number_of_seasons||1, desc:show.overview||'', bg:show.backdrop_path?IMG+'/w1280'+show.backdrop_path:'', poster:show.poster_path?IMG+'/w500'+show.poster_path:'', years:show.first_air_date?show.first_air_date.slice(0,4)+(show.last_air_date&&show.status!=='Returning Series'?'–'+show.last_air_date.slice(0,4):'–'):'N/A', year:show.first_air_date?show.first_air_date.slice(0,4):'', status:show.status||'', label:show.status==='Ended'||show.status==='Canceled'?'ENDED':'ONGOING', labelCls:show.status==='Ended'||show.status==='Canceled'?'lbl-ended':(sk==='anime'?'lbl-anime':'lbl-series'), ratingNum:show.vote_average||0, rating:show.vote_average?show.vote_average.toFixed(1):'—' });
  }
  async function fetchCollection(id) { try { const r=await fetch(`${BASE}/collection/${id}?api_key=${TMDB_KEY}`); addFranchise(await r.json()); } catch(e){} }
  async function procMovies(ids) {
    const res=await Promise.allSettled(ids.map(id=>fetch(`${BASE}/movie/${id}?api_key=${TMDB_KEY}`).then(r=>r.json()).catch(()=>null)));
    const newCols=[];
    res.forEach(r=>{ if(r.status!=='fulfilled'||!r.value)return; const m=r.value; if(m.belongs_to_collection?.id){const cid=m.belongs_to_collection.id;partIdSet.add(m.id);if(!colIdSet.has(cid)){colIdSet.add(cid);newCols.push(cid);}}else{addSingleMovie(m);}});
    if(newCols.length) await Promise.all(newCols.map(id=>fetchCollection(id)));
  }
  async function fetchTV(id, sk) { try { const r=await fetch(`${BASE}/tv/${id}?api_key=${TMDB_KEY}`); const d=await r.json(); if(d.number_of_seasons>=1)addTV(d,sk); }catch(e){} }
  async function discoverFranchises() {
    let tp=200;
    try { const r=await fetch(`${BASE}/discover/movie?api_key=${TMDB_KEY}&sort_by=popularity.desc&page=1`); tp=Math.min((await r.json()).total_pages||200,200); }catch(e){}
    const B=20; const pages=Array.from({length:tp},(_,i)=>i+1);
    for(let i=0;i<pages.length;i+=B){
      const pr=await Promise.allSettled(pages.slice(i,i+B).map(p=>fetch(`${BASE}/discover/movie?api_key=${TMDB_KEY}&sort_by=popularity.desc&page=${p}`).then(r=>r.json()).catch(()=>({results:[]}))));
      const mids=[];
      pr.forEach(r=>{if(r.status==='fulfilled')(r.value.results||[]).forEach(m=>{if(!partIdSet.has(m.id))mids.push(m.id);});});
      if(mids.length) await procMovies([...new Set(mids)]);
    }
    loadState={...loadState,franchises:true};
  }
  async function discoverMovies() {
    for(const sort of['popularity.desc','vote_count.desc','primary_release_date.desc']){
      for(let p=1;p<=60;p++){
        try{
          const r=await fetch(`${BASE}/discover/movie?api_key=${TMDB_KEY}&sort_by=${sort}&page=${p}&vote_count.gte=100`);
          const d=await r.json(); const results=d.results||[];
          if(!results.length)break;
          const mids=results.map(m=>m.id).filter(id=>!partIdSet.has(id));
          if(mids.length)await procMovies(mids);
          if(d.total_pages<=p)break;
        }catch(e){break;}
      }
    }
    loadState={...loadState,movies:true};
  }
  async function discoverAnime() {
    for(const url of[`${BASE}/discover/tv?api_key=${TMDB_KEY}&with_genres=16&with_origin_country=JP&sort_by=popularity.desc`,`${BASE}/discover/tv?api_key=${TMDB_KEY}&with_keywords=210024&sort_by=popularity.desc`]){
      for(let p=1;p<=50;p++){
        try{ const r=await fetch(`${url}&page=${p}`); const d=await r.json(); const results=d.results||[]; if(!results.length)break; await Promise.allSettled(results.map(x=>x.id).filter(id=>!idSet.anime.has(id)).map(id=>fetchTV(id,'anime'))); if(d.total_pages<=p)break; }catch(e){break;}
      }
    }
    loadState={...loadState,anime:true};
  }
  async function discoverSeries() {
    for(const sort of['popularity.desc','vote_count.desc','first_air_date.desc']){
      for(let p=1;p<=40;p++){
        try{ const r=await fetch(`${BASE}/discover/tv?api_key=${TMDB_KEY}&sort_by=${sort}&page=${p}&without_genres=16&vote_count.gte=50`); const d=await r.json(); const results=d.results||[]; if(!results.length)break; await Promise.allSettled(results.map(x=>x.id).filter(id=>!idSet.series.has(id)).map(id=>fetchTV(id,'series'))); if(d.total_pages<=p)break; }catch(e){break;}
      }
    }
    loadState={...loadState,series:true};
  }
  function goPage(p) {
    page = p;
    const heroEl = document.querySelector('.hero');
    const y = heroEl ? heroEl.getBoundingClientRect().bottom + window.scrollY : 0;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
  function goToGuide(href, event) { event.preventDefault(); sessionStorage.setItem('wo_from_guide','1'); window.location.href = href; }
  $effect(() => { applyFilter(); });
  onMount(() => {
    const handleScroll = () => { const nav=document.getElementById('mainNav'); if(nav)nav.classList.toggle('nav-scrolled',window.scrollY>50); };
    window.addEventListener('scroll', handleScroll, { passive: true });
    discoverFranchises(); discoverMovies(); discoverAnime(); discoverSeries();
    return () => window.removeEventListener('scroll', handleScroll);
  });
</script>

<div class="grain"></div>
<nav class="nav" id="mainNav">
  <a class="nav-logo" href="/"><span class="nav-logo-mark">W</span><span class="nav-logo-text">atch</span><span class="nav-logo-accent">Order</span><div class="nav-logo-dot"></div></a>
  <div class="nav-right">
    <div class="filter-bar">
      <button class="filter-btn {activeFilter==='all'?'active':''}" onclick={()=>activeFilter='all'}><span class="filter-dot all"></span>ALL</button>
      <button class="filter-btn {activeFilter==='franchises'?'active':''}" onclick={()=>activeFilter='franchises'}><span class="filter-dot franchises"></span>FRANCHISES</button>
      <button class="filter-btn {activeFilter==='movies'?'active':''}" onclick={()=>activeFilter='movies'}><span class="filter-dot movies"></span>MOVIES</button>
      <button class="filter-btn {activeFilter==='anime'?'active':''}" onclick={()=>activeFilter='anime'}><span class="filter-dot anime"></span>ANIME</button>
      <button class="filter-btn {activeFilter==='series'?'active':''}" onclick={()=>activeFilter='series'}><span class="filter-dot series"></span>SERIES</button>
    </div>
    <div class="search-wrapper">
      <span class="search-icon">⌕</span>
      <input type="text" class="search-input" placeholder="Search..." bind:value={searchQ} autocomplete="off"/>
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
          <div class="live-counter"><div class="live-dot"></div><span>{filteredItems.length} titles loaded</span></div>
        </div>
        <div class="hero-right">
          <a href="/recommendations" class="recommend-btn"><span>✦</span>RECOMMEND ME!<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" stroke-width="1.5"/></svg></a>
        </div>
      </div>
    </header>
    <section>
      {#if pageItems.length > 0}
        <div class="franchise-grid page-transition">
          {#each pageItems as f}
            <a class="card {f.type==='anime'?'anime-card':f.type==='series'?'series-card':''}" href="app/guide?type={f.type}&id={f.id}" onclick={(e)=>goToGuide(`app/guide?type=${f.type}&id=${f.id}`,e)}>
              <div class="card-media">
                <img src={f.poster} alt={esc(f.title)} loading="lazy" onerror={(e)=>e.target.style.display='none'} />
                <div class="card-badge {f.type==='movies'?'lbl-movie':f.labelCls}">{f.type==='anime'||f.type==='series'?(f.status||f.label):(f.type==='franchises'?f.label:(f.ratingNum>0?'★ '+f.rating:f.label))}</div>
              </div>
              <div class="card-content">
                <div class="card-meta {f.type==='anime'?'anime-meta':f.type==='series'?'series-meta':''}">
                  <span>{f.type==='franchises'?f.entries+' FILMS':(f.type==='movies'?'FILM':(f.entries>1?f.entries+' SEASONS':'1 SEASON'))}</span>
                  <span>{f.years}</span>
                </div>
                <h3 class="card-title">{f.title}</h3>
                <p class="card-desc">{(f.desc||'').slice(0,95)}{(f.desc||'').length>=95?'...':''}</p>
                <div class="card-btn">VIEW GUIDE <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" stroke-width="1.5"/></svg></div>
              </div>
            </a>
          {/each}
        </div>
      {:else if searchQ.trim()}
        {#if !done}<div class="loading-more"><div class="spinner-sm"></div><span>Searching...</span></div>
        {:else}<div class="no-results"><div style="font-size:3rem;opacity:0.2">⌕</div><span>No results for "{searchQ}"</span></div>{/if}
      {:else}
        <div class="loading-more" style="padding:80px 0"><div class="spinner-sm"></div><span>Loading titles...</span></div>
      {/if}
      {#if pageItems.length > 0}
        <div class="pagination-bar">
          <div class="pagination-info">Page <strong>{page+1}</strong> of <strong>{np}</strong> · {filteredItems.length} total</div>
          <div class="pagination-dots">
            {#each Array(Math.min(np,8)) as _,i}
              {@const pg=np<=8?i:Math.round(i*(np-1)/7)}
              <button class="pg-dot {pg===page?'active':''}" onclick={()=>goPage(pg)}></button>
            {/each}
          </div>
          <div class="pagination-btns">
            <button class="pg-btn" disabled={!hasPrev} onclick={()=>goPage(page-1)}>PREV</button>
            <button class="pg-btn next" disabled={!hasNext} onclick={()=>goPage(page+1)}>NEXT</button>
          </div>
        </div>
      {/if}
    </section>
  </div>
</main>

<style>
  :global(*){margin:0;padding:0;box-sizing:border-box;}
  :global(body){background:#050505;color:#f0ece4;font-family:"Sora",sans-serif;overflow-x:hidden;}
  .grain{position:fixed;inset:0;z-index:999;pointer-events:none;opacity:.04;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
  .nav{position:fixed;top:0;width:100%;padding:16px 50px;display:flex;justify-content:space-between;align-items:center;z-index:500;transition:.4s ease;box-sizing:border-box;}
  :global(.nav-scrolled){background:rgba(5,5,5,.95)!important;backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,.07);}
  .nav-logo{display:flex;align-items:baseline;cursor:pointer;text-decoration:none;}
  .nav-logo-mark{font-family:"Cormorant Garamond";font-size:2.2rem;color:#c9a84c;font-weight:700;line-height:1;}
  .nav-logo-text{font-family:"Cormorant Garamond";font-size:1.6rem;font-weight:300;color:#f0ece4;}
  .nav-logo-accent{font-family:"Cormorant Garamond";font-style:italic;font-size:1.6rem;font-weight:600;opacity:.85;color:#f0ece4;}
  .nav-logo-dot{width:5px;height:5px;background:#c9a84c;border-radius:50%;margin-left:5px;box-shadow:0 0 8px #c9a84c;}
  .nav-right{display:flex;align-items:center;gap:16px;}
  .filter-bar{display:flex;gap:4px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:2px;padding:4px;}
  .filter-btn{background:none;border:none;color:rgba(240,236,228,.35);font-family:"Space Mono";font-size:.58rem;letter-spacing:.1em;padding:7px 14px;cursor:pointer;border-radius:1px;transition:all .2s;display:flex;align-items:center;gap:6px;}
  .filter-btn.active{background:rgba(201,168,76,.12);color:#c9a84c;}
  .filter-dot{width:6px;height:6px;border-radius:50%;}
  .filter-dot.all{background:#c9a84c;}.filter-dot.franchises{background:#5dade2;}.filter-dot.movies{background:#c9a84c;}.filter-dot.anime{background:#e05c7a;}.filter-dot.series{background:#5fbf8c;}
  .search-wrapper{display:flex;align-items:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:2px;padding:0 14px;gap:10px;}
  .search-icon{color:rgba(240,236,228,.3);font-size:1rem;}
  .search-input{background:none;border:none;color:#f0ece4;font-family:"Space Mono";font-size:.65rem;letter-spacing:.05em;padding:10px 0;width:200px;outline:none;}
  .container{padding:0 50px;width:100%;max-width:100%;}
  .hero{min-height:52vh;padding-top:100px;display:flex;align-items:center;border-bottom:1px solid rgba(255,255,255,.05);}
  .hero-inner{display:flex;justify-content:space-between;align-items:flex-end;width:100%;gap:40px;flex-wrap:wrap;padding-bottom:40px;}
  .hero-left{flex:1;}.hero-right{display:flex;flex-direction:column;align-items:flex-end;gap:12px;flex-shrink:0;}
  .overtitle{display:flex;align-items:center;gap:14px;font-family:"Space Mono";font-size:.68rem;letter-spacing:.2em;color:#c9a84c;margin-bottom:20px;}
  .bar{width:36px;height:1px;background:#c9a84c;}
  .title{font-family:"Cormorant Garamond";font-size:clamp(3.5rem,6vw,5.5rem);font-weight:600;line-height:1;}
  .title em{font-style:italic;font-weight:300;opacity:.65;}
  .subtitle{max-width:520px;margin-top:28px;font-size:1rem;opacity:.45;line-height:1.7;}
  .live-counter{display:inline-flex;align-items:center;gap:10px;margin-top:24px;font-family:"Space Mono";font-size:.68rem;letter-spacing:.12em;color:#c9a84c;}
  .live-dot{width:7px;height:7px;border-radius:50%;background:#c9a84c;animation:livePulse 1.2s ease-in-out infinite;}
  @keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.6)}}
  .recommend-btn{display:flex;align-items:center;gap:10px;background:transparent;border:1px solid rgba(201,168,76,.3);border-radius:2px;padding:14px 24px;font-family:"Space Mono";font-size:.65rem;letter-spacing:.1em;color:#c9a84c;cursor:pointer;transition:all .3s;text-decoration:none;}
  .recommend-btn:hover{border-color:#c9a84c;box-shadow:0 0 20px rgba(201,168,76,.25);transform:translateY(-1px);}
  .franchise-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:28px;padding:60px 0 0;}
  .card{background:#0a0a0a;border:1px solid rgba(255,255,255,.06);border-radius:1px;overflow:hidden;display:flex;flex-direction:column;cursor:pointer;transition:all .3s;text-decoration:none;color:#f0ece4;}
  .card:hover{border-color:rgba(255,255,255,.14);transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,.5);}
  .card-media{position:relative;aspect-ratio:2/3;overflow:hidden;background:#111;}
  .card-media img{width:100%;height:100%;object-fit:cover;opacity:.8;transition:all .5s;}
  .card:hover .card-media img{opacity:1;transform:scale(1.05);}
  .card-badge{position:absolute;top:12px;left:12px;font-family:"Space Mono";font-size:.48rem;letter-spacing:.18em;text-transform:uppercase;padding:4px 10px;border-radius:1px;border:1px solid;}
  .lbl-movie{color:#c9a84c;border-color:rgba(201,168,76,.35);background:rgba(201,168,76,.08);}
  .lbl-blue{color:#5dade2;border-color:rgba(93,173,226,.35);background:rgba(93,173,226,.08);}
  .lbl-green{color:#5fbf8c;border-color:rgba(95,191,140,.35);background:rgba(95,191,140,.08);}
  .lbl-anime{color:#e05c7a;border-color:rgba(224,92,122,.35);background:rgba(224,92,122,.08);}
  .lbl-series{color:#5fbf8c;border-color:rgba(95,191,140,.35);background:rgba(95,191,140,.08);}
  .lbl-ended{color:rgba(240,236,228,.4);border-color:rgba(255,255,255,.15);background:rgba(255,255,255,.04);}
  .card-content{padding:20px;flex:1;display:flex;flex-direction:column;gap:6px;}
  .card-meta{display:flex;gap:8px;font-family:"Space Mono";font-size:.48rem;letter-spacing:.14em;color:rgba(201,168,76,.7);}
  .anime-meta{color:#e05c7a;}.series-meta{color:#5fbf8c;}
  .card-title{font-family:"Cormorant Garamond";font-size:1.15rem;font-weight:600;line-height:1.25;letter-spacing:-.01em;}
  .card-desc{font-size:.72rem;opacity:.38;line-height:1.5;flex:1;}
  .card-btn{margin-top:auto;padding-top:12px;font-family:"Space Mono";font-size:.58rem;letter-spacing:.1em;color:#c9a84c;display:flex;align-items:center;gap:6px;opacity:0;transition:opacity .2s;}
  .card:hover .card-btn{opacity:1;}
  .anime-card .card-btn{color:#e05c7a;}.series-card .card-btn{color:#5fbf8c;}
  .pagination-bar{display:flex;align-items:center;justify-content:space-between;padding:48px 0 80px;border-top:1px solid rgba(255,255,255,.05);margin-top:48px;flex-wrap:wrap;gap:16px;}
  .pagination-info{font-family:"Space Mono";font-size:.65rem;color:rgba(240,236,228,.3);letter-spacing:.1em;}
  .pagination-info strong{color:#c9a84c;font-weight:700;}
  .pagination-dots{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
  .pg-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.12);cursor:pointer;transition:all .2s;border:none;padding:0;}
  .pg-dot.active{background:#c9a84c;width:20px;border-radius:3px;box-shadow:0 0 8px rgba(201,168,76,.5);}
  .pagination-btns{display:flex;gap:10px;}
  .pg-btn{background:none;border:1px solid rgba(201,168,76,.25);color:rgba(240,236,228,.5);font-family:"Space Mono";font-size:.65rem;letter-spacing:.1em;padding:10px 20px;cursor:pointer;transition:all .2s;border-radius:2px;}
  .pg-btn:hover:not(:disabled){border-color:#c9a84c;color:#c9a84c;background:rgba(201,168,76,.06);}
  .pg-btn:disabled{opacity:.2;cursor:not-allowed;}
  .pg-btn.next{background:rgba(201,168,76,.08);border-color:rgba(201,168,76,.4);color:#c9a84c;}
  .page-transition{animation:pageFade .25s ease both;}
  @keyframes pageFade{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  .loading-more{padding:32px 0 80px;display:flex;align-items:center;justify-content:center;gap:14px;font-family:"Space Mono";font-size:.68rem;color:#c9a84c;opacity:.6;}
  .spinner-sm{width:20px;height:20px;border:1.5px solid rgba(201,168,76,.2);border-top-color:#c9a84c;border-radius:50%;animation:spin .8s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg)}}
  .no-results{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 0;gap:12px;font-family:"Space Mono";font-size:.72rem;color:rgba(240,236,228,.3);letter-spacing:.1em;}
</style>
