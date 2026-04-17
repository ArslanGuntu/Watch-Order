<script lang="ts">
  // @ts-nocheck — complex dynamic question types
  import { onMount } from 'svelte';
  import { tmdbFetch, posterUrl, backdropUrl, MOVIE_GENRES } from '$lib/api/tmdb';
  import { watchlist } from '$lib/stores/watchlist.svelte';
  import { fmtRating, extractYear } from '$lib/utils';
  import GrainOverlay from '$lib/components/layout/GrainOverlay.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';

  // ─── CONSTANTS ────────────────────────────────────────────────────────────

  const ANIME_GENRES: Record<string, number> = {
    Action: 28, Adventure: 12, Comedy: 35, Drama: 18, Fantasy: 14,
    Horror: 27, Mystery: 9648, Romance: 10749, 'Sci-Fi': 878,
    'Slice of Life': 10751, Sports: 10759,
  };

  const TV_GENRES: Record<string, number> = {
    'Action & Adventure': 10759, Comedy: 35, Crime: 80, Documentary: 99,
    Drama: 18, Family: 10751, Horror: 27, Mystery: 9648, Romance: 10749,
    'Sci-Fi & Fantasy': 10765, Thriller: 53, 'War & Politics': 10768, Western: 37,
  };

  const LOAD_MSGS = [
    'Consulting the oracle…',
    'Scanning the archives…',
    'Summoning your vision…',
    'Reading the stars…',
  ];

  const MOVIE_QS = [
    { id: 'genres', text: 'What genres call to you?', hint: 'Select 1 to 3 — they will be combined', type: 'multi', maxPick: 3,
      opts: ['Action','Adventure','Animation','Comedy','Crime','Documentary','Drama','Family','Fantasy','History','Horror','Music','Mystery','Romance','Science Fiction','Thriller','War','Western'] },
    { id: 'era', text: 'Which era of cinema?', hint: 'Choose the time period you want to explore', type: 'single',
      opts: [
        { label: 'Right Now — 2020 to 2025', years: [2020,2025] }, { label: 'Golden Age — 2010 to 2019', years: [2010,2019] },
        { label: 'New Millennium — 2000 to 2009', years: [2000,2009] }, { label: 'The 90s — 1990 to 1999', years: [1990,1999] },
        { label: 'Vintage — 1980 to 1989', years: [1980,1989] }, { label: 'Classic — 1970 to 1979', years: [1970,1979] },
        { label: 'Golden Hollywood — before 1970', years: [1920,1969] },
      ] },
    { id: 'quality', text: 'How picky are you feeling?', hint: 'Sets the minimum TMDB audience rating', type: 'single',
      opts: [{ label: '8.0+ — Absolute masterpieces only', min: 8.0 }, { label: '7.0+ — Great, well-loved films', min: 7.0 },
             { label: '6.0+ — Solid, enjoyable picks', min: 6.0 }, { label: 'Anything goes — chaos mode', min: 0 }] },
    { id: 'language', text: 'Original language?', hint: "Filter by the film's native language", type: 'single',
      opts: [{ label: 'English', lang: 'en' }, { label: 'Korean', lang: 'ko' }, { label: 'Japanese', lang: 'ja' },
             { label: 'French', lang: 'fr' }, { label: 'Spanish', lang: 'es' }, { label: 'German', lang: 'de' },
             { label: 'Italian', lang: 'it' }, { label: 'Hindi', lang: 'hi' }, { label: 'Any language', lang: 'any' }] },
    { id: 'certification', text: 'MPAA rating?', hint: 'US rating system — G to NC-17', type: 'single',
      opts: [{ label: 'Any rating', code: 'any' }, { label: 'G — General Audiences', code: 'G' },
             { label: 'PG — Parental Guidance', code: 'PG' }, { label: 'PG-13 — Parents Strongly Cautioned', code: 'PG-13' },
             { label: 'R — Restricted', code: 'R' }, { label: 'NC-17 — Adults Only', code: 'NC-17' }] },
    { id: 'sort', text: 'How to rank results?', hint: 'What matters most to you?', type: 'single',
      opts: [{ label: 'Highest rated first', sort: 'vote_average.desc' }, { label: 'Most popular first', sort: 'popularity.desc' },
             { label: 'Newest first', sort: 'primary_release_date.desc' }, { label: 'Oldest first', sort: 'primary_release_date.asc' }] },
    { id: 'votes', text: 'Minimum votes?', hint: 'Higher = more consensus', type: 'single',
      opts: [{ label: 'Any (10+ votes)', minV: 10 }, { label: 'Moderate (100+ votes)', minV: 100 },
             { label: 'Popular (500+ votes)', minV: 500 }, { label: 'Very popular (1000+ votes)', minV: 1000 }] },
    { id: 'similar', text: 'Name a movie you absolutely loved (optional)', hint: "We'll find similar titles — skip if you want", type: 'similar', skipable: true },
  ];

  const ANIME_QS = [
    { id: 'genres', text: 'Choose your anime flavour', hint: 'Select 1 to 3 genres', type: 'multi', maxPick: 3,
      opts: ['Action','Adventure','Comedy','Drama','Fantasy','Horror','Mystery','Romance','Sci-Fi','Slice of Life','Sports'] },
    { id: 'era', text: 'Which era of anime?', hint: '', type: 'single',
      opts: [{ label: 'Modern — 2018 to 2025', years: [2018,2025] }, { label: 'Peak era — 2010 to 2017', years: [2010,2017] },
             { label: 'Classics — 2000 to 2009', years: [2000,2009] }, { label: 'Vintage — before 2000', years: [1980,1999] }] },
    { id: 'quality', text: 'Quality threshold', hint: '', type: 'single',
      opts: [{ label: '8.0+ — The absolute best', min: 8.0 }, { label: '7.0+ — Great anime', min: 7.0 },
             { label: '6.0+ — Solid picks', min: 6.0 }, { label: 'Anything goes', min: 0 }] },
    { id: 'sort', text: 'How to rank?', hint: '', type: 'single',
      opts: [{ label: 'Highest rated first', sort: 'vote_average.desc' }, { label: 'Most popular first', sort: 'popularity.desc' },
             { label: 'Newest first', sort: 'first_air_date.desc' }, { label: 'Oldest first', sort: 'first_air_date.asc' }] },
    { id: 'votes', text: 'Popularity level?', hint: '', type: 'single',
      opts: [{ label: 'Hidden gems (20+ votes)', minV: 20 }, { label: 'Cult (200+ votes)', minV: 200 },
             { label: 'Popular (1000+ votes)', minV: 1000 }, { label: 'No preference', minV: 10 }] },
    { id: 'similar', text: 'Name an anime you absolutely loved (optional)', hint: "We'll find similar titles — skip if you want", type: 'similar', skipable: true },
  ];

  const SERIES_QS = [
    { id: 'genres', text: 'What kind of series?', hint: 'Select 1 to 3 genres', type: 'multi', maxPick: 3,
      opts: ['Action & Adventure','Comedy','Crime','Documentary','Drama','Family','Horror','Mystery','Romance','Sci-Fi & Fantasy','Thriller','War & Politics','Western'] },
    { id: 'era', text: 'Which era of television?', hint: '', type: 'single',
      opts: [{ label: 'Streaming Age — 2018 to 2025', years: [2018,2025] }, { label: 'Peak TV — 2010 to 2017', years: [2010,2017] },
             { label: 'Golden Age — 2000 to 2009', years: [2000,2009] }, { label: 'Classic TV — 1990 to 1999', years: [1990,1999] },
             { label: 'Vintage — before 1990', years: [1950,1989] }] },
    { id: 'quality', text: 'How high are your standards?', hint: '', type: 'single',
      opts: [{ label: '8.0+ — Emmy-winning quality', min: 8.0 }, { label: '7.0+ — Critically acclaimed', min: 7.0 },
             { label: '6.0+ — Fun and enjoyable', min: 6.0 }, { label: 'Anything goes', min: 0 }] },
    { id: 'sort', text: 'How to rank?', hint: '', type: 'single',
      opts: [{ label: 'Highest rated first', sort: 'vote_average.desc' }, { label: 'Most popular first', sort: 'popularity.desc' },
             { label: 'Newest first', sort: 'first_air_date.desc' }, { label: 'Oldest first', sort: 'first_air_date.asc' }] },
    { id: 'votes', text: 'Popularity level?', hint: '', type: 'single',
      opts: [{ label: 'Hidden gems (30+ votes)', minV: 30 }, { label: 'Cult (300+ votes)', minV: 300 },
             { label: 'Acclaimed (3000+ votes)', minV: 3000 }, { label: 'No preference', minV: 10 }] },
    { id: 'similar', text: 'Name a series you absolutely loved (optional)', hint: "We'll find similar titles — skip if you want", type: 'similar', skipable: true },
  ];

  // ─── STATE ────────────────────────────────────────────────────────────────

  type Step = 'type' | 'questions' | 'loading' | 'recs' | 'watchlist';
  type MediaType = 'movies' | 'anime' | 'series';

  let step = $state<Step>('type');
  let mediaType = $state<MediaType>('movies');
  let questions = $state<any[]>([]);
  let qIdx = $state(0);
  let answers = $state<Record<string, any>>({});
  let recs = $state<any[]>([]);
  let recIdx = $state(0);
  let similarTitle = $state<{ id: number; title: string; year: string; media_type: string } | null>(null);
  let loadMsgIdx = $state(0);

  // Similar search
  let similarSearch = $state('');
  let similarResults = $state<any[]>([]);
  let similarSearching = $state(false);
  let similarDebounce: ReturnType<typeof setTimeout>;
  let showSimilarDropdown = $state(false);

  // Multi-select temp state
  let multiSelected = $state<string[]>([]);

  // Modal
  let modalItem = $state<any | null>(null);
  let showModal = $state(false);
  let modalLoading = $state(false);
  let modalData = $state<any | null>(null);

  // Toast
  let toastMsg = $state('');
  let showToast = $state(false);
  let toastTimer: ReturnType<typeof setTimeout>;

  // ─── COMPUTED ─────────────────────────────────────────────────────────────

  let currentQ = $derived(questions[qIdx] ?? null);
  let progress = $derived(questions.length ? ((qIdx + 1) / questions.length) * 100 : 0);

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  function toast(msg: string) {
    toastMsg = msg;
    showToast = true;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { showToast = false; }, 3200);
  }

  function startType(t: MediaType) {
    mediaType = t;
    questions = t === 'movies' ? MOVIE_QS : t === 'anime' ? ANIME_QS : SERIES_QS;
    qIdx = 0;
    answers = {};
    similarTitle = null;
    multiSelected = [];
    step = 'questions';
  }

  function resetAll() {
    step = 'type';
    recs = [];
    recIdx = 0;
    answers = {};
    similarTitle = null;
    multiSelected = [];
  }

  function goBack() {
    if (qIdx > 0) {
      qIdx--;
      const q = questions[qIdx];
      multiSelected = q.type === 'multi' ? (answers[q.id] ?? []) : [];
    } else {
      step = 'type';
    }
  }

  function advance(answer?: any) {
    if (answer !== undefined) answers = { ...answers, [currentQ.id]: answer };
    if (qIdx < questions.length - 1) {
      qIdx++;
      const nextQ = questions[qIdx];
      multiSelected = nextQ.type === 'multi' ? (answers[nextQ.id] ?? []) : [];
    } else {
      fetchRecs();
    }
  }

  function toggleGenre(opt: string) {
    const q = currentQ;
    const idx = multiSelected.indexOf(opt);
    if (idx >= 0) {
      multiSelected = multiSelected.filter(x => x !== opt);
    } else if (multiSelected.length < q.maxPick) {
      multiSelected = [...multiSelected, opt];
    }
  }

  // ─── SIMILAR SEARCH ───────────────────────────────────────────────────────

  function onSimilarInput() {
    clearTimeout(similarDebounce);
    if (similarSearch.length < 2) { similarResults = []; showSimilarDropdown = false; return; }
    similarDebounce = setTimeout(() => doSimilarSearch(similarSearch), 380);
  }

  async function doSimilarSearch(q: string) {
    similarSearching = true;
    try {
      const isMovie = mediaType === 'movies';
      const endpoint = isMovie ? '/search/movie' : '/search/tv';
      const res = await tmdbFetch<any>(endpoint, { query: q, page: 1 });
      similarResults = (res.results ?? []).slice(0, 6).map((r: any) => ({
        id: r.id,
        title: isMovie ? r.title : r.name,
        year: extractYear(isMovie ? r.release_date : r.first_air_date),
        poster: r.poster_path ? posterUrl(r.poster_path, 'thumb') : '',
        media_type: isMovie ? 'movie' : 'tv',
      }));
      showSimilarDropdown = similarResults.length > 0;
    } catch { similarResults = []; }
    similarSearching = false;
  }

  function selectSimilar(item: any) {
    similarTitle = item;
    similarSearch = '';
    showSimilarDropdown = false;
  }

  // ─── BUILD URL ────────────────────────────────────────────────────────────

  function buildDiscoverUrl(page = 1): string {
    const a = answers;
    const isMovie = mediaType === 'movies';
    const isAnime = mediaType === 'anime';
    const [y1, y2] = (a.era?.years) ?? [2000, 2025];
    const minR = a.quality?.min ?? 0;
    const minV = a.votes?.minV ?? (isMovie ? 100 : 30);
    const sortBy = a.sort?.sort ?? 'vote_average.desc';
    const cert = (a.certification?.code && a.certification.code !== 'any') ? a.certification.code : null;

    let gids: number[] = [];
    const genreList: string[] = a.genres ?? [];
    if (isMovie) {
      genreList.forEach(g => { if (MOVIE_GENRES[g]) gids.push(MOVIE_GENRES[g]); });
    } else if (isAnime) {
      genreList.forEach(g => { if (ANIME_GENRES[g]) gids.push(ANIME_GENRES[g]); });
    } else {
      genreList.forEach(g => { if (TV_GENRES[g]) gids.push(TV_GENRES[g]); });
    }
    gids = [...new Set(gids)];

    const lang = (a.language?.lang && a.language.lang !== 'any') ? a.language.lang : null;
    const base = 'https://api.themoviedb.org/3';
    const key = '175b19b3ba717bf4f24e37ee4325be7e';

    if (isMovie) {
      const gParam = gids.length ? `&with_genres=${gids.join('|')}` : '';
      const lParam = lang ? `&with_original_language=${lang}` : '';
      const certParam = cert ? `&certification_country=US&certification.lte=${cert}` : '';
      return `${base}/discover/movie?api_key=${key}&sort_by=${sortBy}&vote_count.gte=${minV}&primary_release_date.gte=${y1}-01-01&primary_release_date.lte=${y2}-12-31&vote_average.gte=${minR}${gParam}${lParam}${certParam}&include_adult=false&page=${page}`;
    } else if (isAnime) {
      const gParam = gids.length ? `&with_genres=16|${gids.join('|')}` : '&with_genres=16';
      return `${base}/discover/tv?api_key=${key}&sort_by=${sortBy}&vote_count.gte=${minV}&with_original_language=ja&first_air_date.gte=${y1}-01-01&first_air_date.lte=${y2}-12-31&vote_average.gte=${minR}${gParam}&page=${page}`;
    } else {
      const gParam = gids.length ? `&with_genres=${gids.join('|')}&without_genres=16` : '&without_genres=16';
      return `${base}/discover/tv?api_key=${key}&sort_by=${sortBy}&vote_count.gte=${minV}&first_air_date.gte=${y1}-01-01&first_air_date.lte=${y2}-12-31&vote_average.gte=${minR}${gParam}&page=${page}`;
    }
  }

  // ─── FETCH RECS ───────────────────────────────────────────────────────────

  async function fetchRecs() {
    step = 'loading';
    loadMsgIdx = 0;
    const interval = setInterval(() => { loadMsgIdx = (loadMsgIdx + 1) % LOAD_MSGS.length; }, 1800);

    try {
      const isAnime = mediaType === 'anime';
      const isMovie = mediaType === 'movies';
      let results: any[] = [];

      if (isAnime) {
        const tvUrl = buildDiscoverUrl();
        const movieUrl = tvUrl
          .replace('/discover/tv', '/discover/movie')
          .replace(/first_air_date/g, 'primary_release_date');
        const [tvRes, movieRes] = await Promise.all([
          fetch(tvUrl).then(r => r.json()).catch(() => ({ results: [] })),
          fetch(movieUrl).then(r => r.json()).catch(() => ({ results: [] })),
        ]);
        results = [
          ...(tvRes.results ?? []).map((r: any) => ({ ...r, media_type: 'tv' })),
          ...(movieRes.results ?? []).map((r: any) => ({ ...r, media_type: 'movie' })),
        ];
      } else {
        const [r1, r2] = await Promise.all([
          fetch(buildDiscoverUrl(1)).then(r => r.json()).catch(() => ({ results: [] })),
          fetch(buildDiscoverUrl(2)).then(r => r.json()).catch(() => ({ results: [] })),
        ]);
        results = [...(r1.results ?? []), ...(r2.results ?? [])];
      }

      // Fallback with relaxed filters
      if (results.length < 5) {
        const relaxed = buildDiscoverUrl(1)
          .replace(/vote_average\.gte=[\d.]+/, 'vote_average.gte=0')
          .replace(/vote_count\.gte=\d+/, 'vote_count.gte=10');
        const rr = await fetch(relaxed).then(r => r.json()).catch(() => ({ results: [] }));
        results = [...results, ...(rr.results ?? [])];
      }

      // Deduplicate
      const seen = new Set<number>();
      results = results.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });

      // Boost similar titles
      if (similarTitle?.id) {
        const recUrl = `https://api.themoviedb.org/3/${similarTitle.media_type}/${similarTitle.id}/recommendations?api_key=175b19b3ba717bf4f24e37ee4325be7e&page=1`;
        const recRes = await fetch(recUrl).then(r => r.json()).catch(() => ({ results: [] }));
        const recIds = new Set((recRes.results ?? []).slice(0, 10).map((r: any) => r.id));
        results = results.filter(r => recIds.has(r.id)).concat(results.filter(r => !recIds.has(r.id)));
      }

      // Fetch full details for top 16
      const top = results.slice(0, 16);
      const details = await Promise.all(top.map(async (item: any) => {
        const mt = item.media_type ?? (isMovie ? 'movie' : 'tv');
        try {
          const full = await tmdbFetch<any>(`/${mt}/${item.id}`, { append_to_response: 'credits' });
          const isM = mt === 'movie';
          return {
            id: item.id,
            media_type: mt,
            title: isM ? full.title : full.name,
            year: extractYear(isM ? full.release_date : full.first_air_date),
            overview: full.overview ?? '',
            tagline: full.tagline ?? '',
            rating: full.vote_average ? full.vote_average.toFixed(1) : 'N/A',
            votes: full.vote_count ?? 0,
            poster: full.poster_path ? posterUrl(full.poster_path, 'poster_lg') : '',
            backdrop: full.backdrop_path ? backdropUrl(full.backdrop_path) : '',
            genres: full.genres ?? [],
            runtime: isM ? full.runtime : full.episode_run_time?.[0],
            director: full.credits?.crew?.find((c: any) => c.job === 'Director')?.name ?? '',
            cast: (full.credits?.cast ?? []).slice(0, 6).map((c: any) => c.name),
          };
        } catch { return null; }
      }));

      recs = details.filter(Boolean);
      recIdx = 0;
      step = 'recs';
    } catch (e) {
      console.error(e);
      recs = [];
      step = 'recs';
    } finally {
      clearInterval(interval);
    }
  }

  // ─── MODAL ────────────────────────────────────────────────────────────────

  async function openModal(item: any) {
    modalItem = item;
    showModal = true;
    modalLoading = true;
    modalData = null;
    try {
      const full = await tmdbFetch<any>(`/${item.media_type}/${item.id}`, { append_to_response: 'credits' });
      modalData = full;
    } catch { /* show basic data */ }
    modalLoading = false;
  }

  function closeModal() {
    showModal = false;
    setTimeout(() => { modalItem = null; modalData = null; }, 300);
  }

  // ─── WATCHLIST ────────────────────────────────────────────────────────────

  function toggleWatchlist(item: any) {
    const result = watchlist.toggle({
      id: item.id,
      media_type: item.media_type,
      title: item.title,
      year: item.year ?? '',
      poster: item.poster ?? '',
      rating: item.rating ?? '—',
    });
    toast(result === 'added' ? `✨ "${item.title}" added to watchlist` : `🗑 "${item.title}" removed`);
  }

  // Keyboard handler
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && showModal) closeModal();
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>

<GrainOverlay />

<!-- ── NAV ──────────────────────────────────────────────────────────────── -->
<nav class="fixed top-0 w-full z-[500] flex justify-between items-center px-[50px] py-4 transition-all duration-400">
  <button
    class="flex items-baseline gap-0 bg-none border-none cursor-pointer"
    onclick={resetAll}
  >
    <span class="font-['Cormorant_Garamond'] text-[2.2rem] text-[#c9a84c] font-bold leading-none">W</span>
    <span class="font-['Cormorant_Garamond'] text-[1.6rem] font-light text-[#f0ece4]">atch</span>
    <span class="font-['Cormorant_Garamond'] italic text-[1.6rem] font-semibold opacity-85 text-[#f0ece4]">Order</span>
    <div class="w-[5px] h-[5px] bg-[#c9a84c] rounded-full ml-[5px] shadow-[0_0_8px_#c9a84c]"></div>
  </button>

  <div class="flex items-center gap-4">
    <button
      class="flex items-center gap-2 border border-white/10 text-[rgba(240,236,228,0.6)] font-['Space_Mono'] text-[0.6rem] tracking-[0.1em] uppercase px-4 py-2 rounded-sm cursor-pointer transition-all duration-200 bg-transparent hover:border-[#c9a84c]/50 hover:text-[#c9a84c]"
      onclick={() => step = 'watchlist'}
    >
      📋 <span>WATCHLIST</span>
      {#if watchlist.count > 0}
        <span class="bg-[#c9a84c] text-black text-[0.5rem] font-bold rounded-full w-4 h-4 flex items-center justify-center">{watchlist.count}</span>
      {/if}
    </button>
    <span class="font-['Space_Mono'] text-[0.52rem] tracking-[0.2em] text-white/[0.28] uppercase hidden md:block">✦ CINEMATIC ORACLE ✦</span>
  </div>
</nav>

<!-- ── TOAST ─────────────────────────────────────────────────────────────── -->
{#if showToast}
  <div class="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] bg-[rgba(18,16,12,0.95)] border border-[#c9a84c]/40 text-[#c9a84c] font-['Space_Mono'] text-[0.7rem] tracking-[0.1em] px-6 py-3 rounded-full shadow-xl animate-fade-in">
    ✦ {toastMsg}
  </div>
{/if}

<!-- ── STEP: TYPE SELECTION ───────────────────────────────────────────────── -->
{#if step === 'type'}
  <main class="min-h-screen bg-[#050505] text-[#f0ece4] pt-32 px-[50px] pb-20">
    <div class="hero mb-16 max-w-3xl">
      <div class="font-['Space_Mono'] text-[0.55rem] tracking-[0.3em] text-[#c9a84c] uppercase mb-4 flex items-center gap-3">
        <span class="w-8 h-px bg-[#c9a84c]"></span>THE CINEMATIC ORACLE
      </div>
      <h1 class="font-['Cormorant_Garamond'] text-[clamp(3rem,6vw,5.5rem)] font-light leading-[1.05] tracking-[-0.03em] mb-5">
        Discover your<br /><em class="text-[#c9a84c] font-semibold">next obsession</em>
      </h1>
      <p class="font-['Sora'] text-[0.95rem] font-light text-white/50 leading-relaxed max-w-lg">
        Answer 8 questions. The oracle searches TMDB's library of over 500,000 titles and surfaces the perfect match.
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-[900px]">
      {#each [
        { t: 'movies', num: '01', label: 'FILM', icon: '🎬', title: 'Motion Pictures', desc: 'Cinematic masterpieces, cult classics, and undiscovered gems from every corner of the world.' },
        { t: 'anime', num: '02', label: 'ANIMATION', icon: '🌸', title: 'Japanese Anime', desc: 'From Studio Ghibli to shōnen epics — the absolute finest the medium has to offer.' },
        { t: 'series', num: '03', label: 'EPISODIC', icon: '📺', title: 'TV Series', desc: 'Prestige dramas, binge-worthy comedies, and the greatest episodic storytelling ever made.' },
      ] as card}
        <button
          class="group text-left bg-[#0a0a0a] border border-white/[0.07] rounded-sm p-8 cursor-pointer transition-all duration-300 hover:border-[#c9a84c]/35 hover:-translate-y-1 hover:bg-[#0e0e0e] hover:shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
          onclick={() => startType(card.t as MediaType)}
        >
          <div class="font-['Space_Mono'] text-[0.5rem] tracking-[0.2em] text-white/25 uppercase mb-4">{card.num} — {card.label}</div>
          <div class="text-4xl mb-4">{card.icon}</div>
          <div class="font-['Cormorant_Garamond'] text-[1.65rem] font-semibold text-[#f0ece4] mb-3">{card.title}</div>
          <div class="font-['Sora'] text-[0.82rem] font-light text-white/40 leading-relaxed mb-6">{card.desc}</div>
          <div class="font-['Space_Mono'] text-[0.6rem] tracking-[0.15em] text-[#c9a84c] flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            BEGIN <span>→</span>
          </div>
        </button>
      {/each}
    </div>
  </main>

<!-- ── STEP: QUESTIONS ────────────────────────────────────────────────────── -->
{:else if step === 'questions' && currentQ}
  <main class="min-h-screen bg-[#050505] text-[#f0ece4] pt-32 px-[50px] pb-20">
    <div class="max-w-[760px] mx-auto">
      <button
        class="font-['Space_Mono'] text-[0.6rem] tracking-[0.1em] uppercase text-white/40 bg-transparent border border-white/10 px-4 py-2 rounded-sm cursor-pointer mb-8 transition-all hover:text-white/70 hover:border-white/20"
        onclick={goBack}
      >← Back</button>

      <!-- Progress bar -->
      <div class="h-px bg-white/[0.06] rounded-full mb-10 overflow-hidden">
        <div
          class="h-full bg-[#c9a84c] rounded-full transition-all duration-500"
          style="width: {progress}%"
        ></div>
      </div>

      <div class="bg-[#0d0d0d] border border-white/[0.07] rounded-sm p-[52px]">
        <div class="font-['Space_Mono'] text-[0.52rem] tracking-[0.25em] text-[#c9a84c] uppercase mb-5">
          ✦ CHAPTER {qIdx + 1} OF {questions.length} ✦
        </div>
        <h2 class="font-['Cormorant_Garamond'] text-[clamp(1.8rem,3.5vw,2.8rem)] font-light leading-[1.1] mb-3">{currentQ.text}</h2>
        {#if currentQ.hint}
          <p class="font-['Sora'] text-[0.82rem] text-white/35 mb-8">{currentQ.hint}</p>
        {/if}

        <!-- MULTI-SELECT (genres) -->
        {#if currentQ.type === 'multi'}
          <div class="flex flex-wrap gap-2.5 mb-8">
            {#each currentQ.opts as opt}
              {@const selected = multiSelected.includes(opt)}
              <button
                class="font-['Space_Mono'] text-[0.62rem] tracking-[0.08em] uppercase px-4 py-2.5 border rounded-sm transition-all duration-200 cursor-pointer
                       {selected ? 'bg-[rgba(201,168,76,0.15)] border-[#c9a84c] text-[#c9a84c]' : 'bg-transparent border-white/[0.1] text-white/45 hover:border-white/25 hover:text-white/65'}"
                onclick={() => toggleGenre(opt)}
              >{opt}</button>
            {/each}
          </div>
          <div class="flex items-center justify-between pt-5 border-t border-white/[0.06]">
            <span class="font-['Space_Mono'] text-[0.6rem] text-white/30">{multiSelected.length} / {currentQ.maxPick} selected</span>
            <button
              class="font-['Space_Mono'] text-[0.68rem] tracking-[0.12em] uppercase px-8 py-3.5 bg-[rgba(201,168,76,0.12)] border border-[#c9a84c]/50 text-[#c9a84c] rounded-sm cursor-pointer transition-all hover:bg-[rgba(201,168,76,0.22)] disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={multiSelected.length === 0}
              onclick={() => advance(multiSelected)}
            >CONTINUE →</button>
          </div>

        <!-- SINGLE SELECT -->
        {:else if currentQ.type === 'single'}
          <div class="grid grid-cols-1 gap-2.5">
            {#each currentQ.opts as opt}
              <button
                class="group flex items-center justify-between font-['Sora'] text-[0.9rem] font-light text-left px-6 py-4 border border-white/[0.08] rounded-sm bg-transparent text-white/55 cursor-pointer transition-all duration-200 hover:border-[#c9a84c]/40 hover:bg-[rgba(201,168,76,0.06)] hover:text-white/80"
                onclick={() => advance(opt)}
              >
                <span>{opt.label}</span>
                <span class="text-[#c9a84c] opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              </button>
            {/each}
          </div>

        <!-- SIMILAR TITLE SEARCH -->
        {:else if currentQ.type === 'similar'}
          <div class="relative mb-8">
            {#if similarTitle}
              <div class="flex items-center gap-3 bg-[rgba(201,168,76,0.08)] border border-[#c9a84c]/30 rounded-sm px-4 py-3 mb-4">
                <span class="text-lg">🎬</span>
                <span class="font-['Sora'] text-[0.9rem] text-[#f0ece4] flex-1">{similarTitle.title} ({similarTitle.year || '?'})</span>
                <button
                  class="text-white/40 hover:text-white/80 text-sm bg-transparent border-none cursor-pointer"
                  onclick={() => { similarTitle = null; }}
                >✕</button>
              </div>
            {/if}

            <div class="relative">
              <input
                type="text"
                placeholder="Search for a title… (e.g. Inception, Spirited Away, Breaking Bad)"
                bind:value={similarSearch}
                oninput={onSimilarInput}
                autocomplete="off"
                class="w-full bg-[#111] border border-white/10 rounded-sm px-4 py-3.5 text-[#f0ece4] font-['Sora'] text-[0.92rem] outline-none focus:border-[#c9a84c]/50 placeholder:text-white/30"
              />
              {#if similarSearching}
                <div class="absolute right-4 top-1/2 -translate-y-1/2">
                  <Spinner size="sm" />
                </div>
              {/if}
            </div>

            {#if showSimilarDropdown && similarResults.length > 0}
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div
                class="absolute w-full bg-[#111] border border-white/10 rounded-sm mt-1 z-50 overflow-hidden shadow-2xl"
                onmouseleave={() => {}}
              >
                {#each similarResults as result}
                  <button
                    class="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.05] cursor-pointer transition-colors border-b border-white/[0.04] last:border-0 text-left bg-transparent"
                    onclick={() => selectSimilar(result)}
                  >
                    {#if result.poster}
                      <img src={result.poster} alt="" class="w-8 h-12 object-cover rounded-sm opacity-80" />
                    {:else}
                      <div class="w-8 h-12 bg-white/5 rounded-sm flex items-center justify-center text-base">🎬</div>
                    {/if}
                    <div>
                      <div class="font-['Sora'] text-[0.88rem] text-[#f0ece4]">{result.title}</div>
                      <div class="font-['Space_Mono'] text-[0.52rem] text-white/35">{result.year || 'TBA'}</div>
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          <div class="flex items-center gap-3 pt-5 border-t border-white/[0.06]">
            <button
              class="font-['Space_Mono'] text-[0.68rem] tracking-[0.12em] uppercase px-8 py-3.5 bg-[rgba(201,168,76,0.12)] border border-[#c9a84c]/50 text-[#c9a84c] rounded-sm cursor-pointer transition-all hover:bg-[rgba(201,168,76,0.22)] disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={!similarTitle}
              onclick={() => advance(similarTitle)}
            >CONTINUE →</button>
            <button
              class="font-['Space_Mono'] text-[0.65rem] tracking-[0.1em] uppercase text-white/35 bg-transparent border border-white/10 px-6 py-3.5 rounded-sm cursor-pointer transition-all hover:text-white/60 hover:border-white/20"
              onclick={() => { similarTitle = null; advance(null); }}
            >SKIP</button>
          </div>
        {/if}
      </div>
    </div>
  </main>

<!-- ── STEP: LOADING ──────────────────────────────────────────────────────── -->
{:else if step === 'loading'}
  <main class="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-8">
    <Spinner size="lg" />
    <div class="text-center">
      <p class="font-['Space_Mono'] text-[0.8rem] tracking-[0.2em] text-[#c9a84c] transition-opacity duration-300">
        {LOAD_MSGS[loadMsgIdx]}
      </p>
      <p class="font-['Space_Mono'] text-[0.62rem] text-white/25 mt-2 tracking-[0.1em]">SEARCHING 500,000+ TITLES</p>
    </div>
    <div class="flex gap-2">
      {#each [0,1,2] as i}
        <div
          class="w-[7px] h-[7px] rounded-full bg-[#c9a84c] animate-bounce"
          style="animation-delay: {i * 0.16}s"
        ></div>
      {/each}
    </div>
  </main>

<!-- ── STEP: RESULTS ──────────────────────────────────────────────────────── -->
{:else if step === 'recs'}
  <main class="min-h-screen bg-[#050505] text-[#f0ece4] pt-28 pb-20">
    <div class="max-w-[1180px] mx-auto px-[50px]">
      {#if recs.length === 0}
        <!-- No results -->
        <div class="text-center py-32">
          <div class="font-['Cormorant_Garamond'] text-8xl opacity-10 mb-6">∅</div>
          <h2 class="font-['Cormorant_Garamond'] text-3xl font-light mb-4">No Visions Found</h2>
          <p class="text-white/40 text-sm mb-8">Try a lower rating threshold or broader date range.</p>
          <button
            class="font-['Space_Mono'] text-[0.68rem] tracking-[0.12em] uppercase px-8 py-4 border border-white/20 text-white/60 rounded-sm cursor-pointer hover:border-[#c9a84c]/50 hover:text-[#c9a84c] transition-all bg-transparent"
            onclick={resetAll}
          >← Try Again</button>
        </div>
      {:else}
        {@const rec = recs[recIdx]}
        <!-- Counter & dots -->
        <div class="flex items-start justify-between mb-8 flex-wrap gap-4">
          <button
            class="font-['Space_Mono'] text-[0.6rem] tracking-[0.1em] uppercase text-white/40 bg-transparent border border-white/10 px-4 py-2 rounded-sm cursor-pointer transition-all hover:text-white/70 hover:border-white/20"
            onclick={resetAll}
          >← New Search</button>

          <div class="text-right">
            <div class="font-['Space_Mono'] text-[0.68rem] tracking-[0.15em] text-white/38 mb-3">
              ✦ VISION {recIdx + 1} OF {recs.length} ✦
            </div>
            <div class="flex gap-2 items-center justify-end">
              {#each recs as _, i}
                <button
                  class="rounded-full border-none cursor-pointer transition-all duration-300 p-0
                         {i === recIdx ? 'bg-[#c9a84c] w-[22px] h-2 rounded-[4px] shadow-[0_0_10px_rgba(201,168,76,0.5)]' : 'bg-white/18 w-2 h-2 hover:bg-[rgba(201,168,76,0.45)]'}"
                  onclick={() => recIdx = i}
                ></button>
              {/each}
            </div>
          </div>
        </div>

        <!-- Result card -->
        <div class="grid md:grid-cols-[290px_1fr] bg-[#0d0d0d] border border-white/[0.07] rounded-3xl overflow-hidden transition-all hover:border-[#c9a84c]/15">
          <!-- Poster -->
          <div class="relative overflow-hidden min-h-[400px] md:min-h-[510px] bg-[#111] flex items-center justify-center">
            {#if rec.poster}
              <img
                src={rec.poster}
                alt={rec.title}
                loading="lazy"
                class="w-full h-full object-cover absolute inset-0 transition-transform duration-700 hover:scale-105"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-[rgba(8,7,11,0.85)] to-transparent"></div>
            {:else}
              <div class="text-6xl opacity-20">🎬</div>
            {/if}
            <div class="absolute top-4 right-4 z-10 bg-[rgba(8,7,11,0.82)] backdrop-blur-sm border border-[#c9a84c]/28 rounded-2xl px-3.5 py-2.5 text-center">
              <span class="font-['Cormorant_Garamond'] text-[1.55rem] font-black text-[#c9a84c] leading-none block">{rec.rating}</span>
              <span class="font-['Space_Mono'] text-[0.52rem] tracking-[0.12em] text-white/40">/ 10</span>
            </div>
          </div>

          <!-- Info -->
          <div class="p-10 flex flex-col justify-center gap-4">
            <div class="font-['Space_Mono'] text-[0.58rem] tracking-[0.2em] text-[#c9a84c] uppercase">
              ✦ {rec.media_type === 'movie' ? 'MOTION PICTURE' : 'TV SERIES'}
            </div>
            <h1 class="font-['Cormorant_Garamond'] text-[clamp(1.8rem,3vw,2.8rem)] font-bold leading-tight">{rec.title}</h1>
            {#if rec.tagline}
              <p class="font-['Cormorant_Garamond'] italic text-[1.1rem] text-white/45">"{rec.tagline}"</p>
            {/if}

            <div class="flex gap-2 flex-wrap">
              <span class="font-['Space_Mono'] text-[0.58rem] tracking-[0.1em] border border-white/15 text-white/50 px-3 py-1 rounded-full">📅 {rec.year || 'TBA'}</span>
              <span class="font-['Space_Mono'] text-[0.58rem] tracking-[0.1em] border border-white/15 text-white/50 px-3 py-1 rounded-full">🎫 {rec.votes.toLocaleString()} votes</span>
            </div>

            <div class="flex gap-2 flex-wrap">
              {#each rec.genres.slice(0, 4) as genre}
                <span class="font-['Space_Mono'] text-[0.52rem] tracking-[0.08em] text-[#c9a84c] border border-[#c9a84c]/25 bg-[rgba(201,168,76,0.06)] px-2.5 py-1 rounded-sm">{genre.name}</span>
              {/each}
            </div>

            <div class="border-t border-white/[0.07] pt-4">
              <p class="font-['Sora'] text-[0.88rem] font-light text-white/60 leading-relaxed line-clamp-4">{rec.overview}</p>
            </div>

            {#if rec.director}
              <p class="font-['Sora'] text-[0.8rem] text-white/45">🎥 Directed by <strong class="text-white/70">{rec.director}</strong></p>
            {/if}
            {#if rec.cast.length}
              <p class="font-['Sora'] text-[0.8rem] text-white/45">🎭 Starring <strong class="text-white/70">{rec.cast.join(' · ')}</strong></p>
            {/if}

            <div class="flex gap-3 mt-2 flex-wrap">
              <button
                class="flex items-center gap-2 font-['Space_Mono'] text-[0.65rem] tracking-[0.1em] uppercase border border-white/15 text-white/50 px-6 py-3 rounded-sm cursor-pointer transition-all bg-transparent hover:border-white/30 hover:text-white/80"
                onclick={() => { if (recIdx < recs.length - 1) recIdx++; else resetAll(); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                NEXT
              </button>
              <button
                class="flex items-center gap-2 font-['Space_Mono'] text-[0.65rem] tracking-[0.1em] uppercase border cursor-pointer transition-all px-6 py-3 rounded-sm
                       {watchlist.has(rec.id, rec.media_type) ? 'bg-[rgba(201,168,76,0.2)] border-[#c9a84c] text-[#c9a84c]' : 'bg-[rgba(201,168,76,0.1)] border-[#c9a84c]/50 text-[#c9a84c] hover:bg-[rgba(201,168,76,0.2)]'}"
                onclick={() => toggleWatchlist(rec)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                {watchlist.has(rec.id, rec.media_type) ? '✓ IN WATCHLIST' : 'ADD TO WATCHLIST'}
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </main>

<!-- ── STEP: WATCHLIST ────────────────────────────────────────────────────── -->
{:else if step === 'watchlist'}
  <main class="min-h-screen bg-[#050505] text-[#f0ece4] pt-28 pb-20 px-[50px]">
    <button
      class="font-['Space_Mono'] text-[0.6rem] tracking-[0.1em] uppercase text-white/40 bg-transparent border border-white/10 px-4 py-2 rounded-sm cursor-pointer mb-10 transition-all hover:text-white/70 hover:border-white/20"
      onclick={resetAll}
    >← Back to Oracle</button>

    <div class="mb-10">
      <div class="font-['Space_Mono'] text-[0.55rem] tracking-[0.3em] text-[#c9a84c] uppercase mb-3 flex items-center gap-3">
        <span class="w-6 h-px bg-[#c9a84c]"></span>YOUR LIBRARY
      </div>
      <h1 class="font-['Cormorant_Garamond'] text-[clamp(2.5rem,5vw,4rem)] font-light">Watchlist</h1>
      <p class="text-white/40 text-sm mt-2">{watchlist.count} saved {watchlist.count === 1 ? 'title' : 'titles'}</p>
    </div>

    {#if watchlist.count === 0}
      <div class="text-center py-24 text-white/30">
        <div class="text-6xl mb-4">📭</div>
        <p class="font-['Sora'] text-sm">Your watchlist is empty. Start exploring!</p>
      </div>
    {:else}
      <div class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-5">
        {#each [...watchlist.items].reverse() as item}
          <div
            class="group bg-[#0a0a0a] border border-white/[0.07] rounded-sm overflow-hidden cursor-pointer transition-all hover:border-[#c9a84c]/30 hover:-translate-y-0.5"
            onclick={() => openModal(item)}
            role="button"
            tabindex="0"
            onkeypress={(e) => e.key === 'Enter' && openModal(item)}
          >
            <div class="relative aspect-[2/3] overflow-hidden">
              {#if item.poster}
                <img src={item.poster} alt={item.title} loading="lazy" class="w-full h-full object-cover transition-transform duration-400 group-hover:scale-105" />
              {:else}
                <div class="w-full h-full bg-white/5 flex items-center justify-center text-4xl">🎬</div>
              {/if}
              <div class="absolute top-2 right-2 font-['Space_Mono'] text-[0.5rem] tracking-[0.1em] px-2 py-0.5 rounded-full bg-black/70 text-[#c9a84c] border border-[#c9a84c]/30">
                {item.media_type === 'movie' ? 'FILM' : 'TV'}
              </div>
            </div>
            <div class="p-3">
              <div class="font-['Cormorant_Garamond'] text-[1rem] font-semibold truncate mb-1">{item.title}</div>
              <div class="flex justify-between font-['Space_Mono'] text-[0.52rem] text-white/40">
                <span>📅 {item.year || 'TBA'}</span>
                <span class="text-[#c9a84c]">⭐ {item.rating}</span>
              </div>
              <button
                class="mt-3 w-full bg-transparent border border-white/15 rounded-full py-2 font-['Space_Mono'] text-[0.55rem] tracking-[0.08em] text-white/40 cursor-pointer transition-all hover:border-red-500/50 hover:text-red-400"
                onclick={(e) => { e.stopPropagation(); watchlist.remove(item.id, item.media_type); toast(`🗑 Removed "${item.title}"`); }}
              >REMOVE</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>
{/if}

<!-- ── MODAL ──────────────────────────────────────────────────────────────── -->
{#if showModal && modalItem}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-10 animate-fade-in"
    onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
  >
    <div class="max-w-[900px] w-full max-h-[85vh] bg-[#0d0d0d] border border-[#c9a84c]/20 rounded-3xl overflow-hidden flex flex-col animate-slide-up">
      <!-- Modal header -->
      <div class="relative h-[280px] overflow-hidden flex-shrink-0">
        {#if modalItem.backdrop || modalItem.poster}
          <div
            class="absolute inset-0 bg-cover bg-center filter brightness-[0.4] scale-[1.05]"
            style="background-image: url('{modalItem.backdrop || modalItem.poster}')"
          ></div>
        {/if}
        <div class="absolute inset-0 z-10 p-6 flex gap-6 items-end">
          {#if modalItem.poster}
            <div class="w-[140px] rounded-xl overflow-hidden shadow-2xl border border-[#c9a84c]/30 flex-shrink-0">
              <img src={modalItem.poster} alt={modalItem.title} class="w-full h-auto block" />
            </div>
          {/if}
          <div class="pb-4">
            <h2 class="font-['Cormorant_Garamond'] text-[2.2rem] font-black leading-tight mb-2">{modalItem.title}</h2>
            <div class="flex gap-2 flex-wrap">
              <span class="font-['Space_Mono'] text-[0.58rem] border border-white/20 px-3 py-1 rounded-full text-white/60">
                {modalItem.media_type === 'movie' ? 'FILM' : 'TV SERIES'}
              </span>
              <span class="font-['Space_Mono'] text-[0.58rem] border border-white/20 px-3 py-1 rounded-full text-white/60">{modalItem.year || 'TBA'}</span>
              {#if modalItem.rating && modalItem.rating !== 'N/A'}
                <span class="font-['Space_Mono'] text-[0.58rem] border border-white/20 px-3 py-1 rounded-full text-white/60">⭐ {modalItem.rating}/10</span>
              {/if}
            </div>
          </div>
        </div>
        <button
          class="absolute top-4 right-4 z-20 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white/60 hover:text-white cursor-pointer border-none transition-colors"
          onclick={closeModal}
        >✕</button>
      </div>

      <!-- Modal body -->
      <div class="overflow-y-auto p-8 flex flex-col gap-6">
        {#if modalLoading}
          <div class="flex justify-center py-8"><Spinner /></div>
        {:else}
          {#if modalItem.overview}
            <div>
              <div class="font-['Space_Mono'] text-[0.58rem] tracking-[0.15em] text-white/35 uppercase mb-3">SYNOPSIS</div>
              <p class="font-['Sora'] text-[0.9rem] text-white/60 leading-relaxed">{modalItem.overview}</p>
            </div>
          {/if}
          <div class="flex gap-3 mt-2">
            <button
              class="flex-1 flex items-center justify-center gap-2 font-['Space_Mono'] text-[0.7rem] tracking-[0.12em] uppercase py-4 rounded-xl border cursor-pointer transition-all
                     {watchlist.has(modalItem.id, modalItem.media_type) ? 'bg-[rgba(201,168,76,0.2)] border-[#c9a84c] text-[#c9a84c]' : 'bg-[rgba(201,168,76,0.1)] border-[#c9a84c]/50 text-[#c9a84c] hover:bg-[rgba(201,168,76,0.2)]'}"
              onclick={() => toggleWatchlist(modalItem)}
            >
              {watchlist.has(modalItem.id, modalItem.media_type) ? '✓ IN WATCHLIST' : '+ ADD TO WATCHLIST'}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in { animation: fade-in 0.3s ease; }
  .animate-slide-up { animation: slide-up 0.35s cubic-bezier(0.2, 0.9, 0.4, 1); }
</style>
