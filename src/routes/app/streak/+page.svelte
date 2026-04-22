<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';

  const TMDB_KEY = '175b19b3ba717bf4f24e37ee4325be7e';
  const BASE     = 'https://api.themoviedb.org/3';
  const IMG_W300 = 'https://image.tmdb.org/t/p/w300';
  const IMG_W780 = 'https://image.tmdb.org/t/p/w780';

  // ── STATE (Svelte 5) ──
  let me             = $state(null);
  let step           = $state(1);
  let isTemporary    = $state(false);
  let selectedGenres = $state([]);   // array of genre objects

  let durationPreset = $state(null);
  let durationCustom = $state('');
  let durationError  = $state('');

  let selectedBusyness = $state(null);

  let partnerSearchQ  = $state('');
  let partnerResults  = $state([]);
  let partnerLoading  = $state(false);
  let selectedPartner = $state(null);
  let conversations   = $state([]);

  let creating       = $state(false);
  let createdStreak  = $state(null);
  let waitingPartner = $state(false);

  let activeStreak   = $state(null);
  let streakMovies   = $state([]);
  let streakLoading  = $state(true);
  let previousTaste  = $state(null);
  let hasPrevTaste   = $state(false);

  let partnerTimer  = null;
  let realtimeSub   = null;

  const TODAY = new Date().toISOString().split('T')[0];

  // ── STATIC DATA ──
  const ALL_GENRES = [
    { id: 28,    name: 'Action'     },
    { id: 12,    name: 'Adventure'  },
    { id: 16,    name: 'Animation'  },
    { id: 35,    name: 'Comedy'     },
    { id: 80,    name: 'Crime'      },
    { id: 18,    name: 'Drama'      },
    { id: 14,    name: 'Fantasy'    },
    { id: 27,    name: 'Horror'     },
    { id: 9648,  name: 'Mystery'    },
    { id: 10749, name: 'Romance'    },
    { id: 878,   name: 'Sci-Fi'     },
    { id: 53,    name: 'Thriller'   },
    { id: 10752, name: 'War'        },
    { id: 37,    name: 'Western'    },
  ];

  const DURATION_PRESETS = [
    { label: '10 days',  value: 10  },
    { label: '2 weeks',  value: 14  },
    { label: '1 month',  value: 30  },
    { label: '2 months', value: 60  },
    { label: '100 days', value: 100 },
  ];

  const BUSYNESS_OPTIONS = [
    { id: 'low',    label: 'Very Busy',     sub: '1 movie / week',    icon: '🧳', perWeek: 1   },
    { id: 'medium', label: 'Somewhat Busy', sub: '2 movies / week',   icon: '⏱️', perWeek: 2   },
    { id: 'free',   label: "I'm Free!",     sub: '3–4 movies / week', icon: '🍿', perWeek: 3.5 },
  ];

  // ── DERIVED ──
  function getDuration() {
    if (durationPreset !== null) return durationPreset;
    const v = parseInt(durationCustom, 10);
    return isNaN(v) ? null : v;
  }

  function canNext() {
    if (step === 1) return selectedGenres.length >= 1 && selectedGenres.length <= 3;
    if (step === 2) {
      const d = getDuration();
      return d !== null && d >= 10 && d <= 100;
    }
    if (step === 3) return selectedBusyness !== null;
    return true;
  }

  function todaysMovies() {
    return streakMovies.filter(m => m.scheduled_date === TODAY && m.status === 'available');
  }

  function streakDay() {
    if (!activeStreak?.start_date) return 0;
    const diff = new Date() - new Date(activeStreak.start_date);
    return Math.floor(diff / 86400000) + 1;
  }

  function watchedCount() { return streakMovies.filter(m => m.status === 'watched').length; }
  function totalCount()   { return streakMovies.length; }

  function statusColor(s) {
    if (s === 'watched')   return '#5fbf8c';
    if (s === 'available') return '#c9a84c';
    if (s === 'missed')    return '#e74c3c';
    return 'rgba(255,255,255,.15)';
  }

  // ── BOOT ──
  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { goto('/signin'); return; }

    const { data: profile } = await supabase
      .from('profiles').select('id, username').eq('id', session.user.id).single();

    me = {
      id:       session.user.id,
      username: profile?.username || session.user.email?.split('@')[0] || 'user',
    };

    await checkExistingStreak();
    await loadConversations();
    streakLoading = false;
  });

  onDestroy(() => {
    realtimeSub?.unsubscribe();
    clearTimeout(partnerTimer);
  });

  // ── STREAK CHECKS ──
  async function checkExistingStreak() {
    const { data } = await supabase
      .from('streaks')
      .select('*')
      .or(`creator_id.eq.${me.id},partner_id.eq.${me.id}`)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      activeStreak = data;
      await loadStreakMovies(data.id);
      subscribeStreak(data.id);
    }

    const { data: broken } = await supabase
      .from('streaks')
      .select('genres, busyness, duration_days')
      .or(`creator_id.eq.${me.id},partner_id.eq.${me.id}`)
      .eq('status', 'broken')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (broken) {
      hasPrevTaste  = true;
      previousTaste = broken;
    }
  }

  async function loadStreakMovies(streakId) {
    const { data } = await supabase
      .from('streak_movies')
      .select('*')
      .eq('streak_id', streakId)
      .eq('user_id', me.id)
      .order('scheduled_date', { ascending: true });

    streakMovies = data || [];
    await checkMissed();
  }

  async function checkMissed() {
    if (!activeStreak || activeStreak.status !== 'active') return;
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toISOString().split('T')[0];

    const missed = streakMovies.filter(m => m.status === 'available' && m.scheduled_date <= yestStr);
    if (!missed.length) return;

    await supabase.from('streaks').update({ status: 'broken' }).eq('id', activeStreak.id);
    await supabase.from('streak_movies').update({ status: 'missed' }).in('id', missed.map(m => m.id));

    activeStreak = { ...activeStreak, status: 'broken' };
    streakMovies = streakMovies.map(m => missed.find(mm => mm.id === m.id) ? { ...m, status: 'missed' } : m);

    if (activeStreak.conversation_id && activeStreak.partner_id) {
      await supabase.from('messages').insert({
        conversation_id: activeStreak.conversation_id,
        sender_id: me.id,
        content: '💔 Your streak is broken! You missed a movie.',
        meta: { type: 'streak_broken', streak_id: activeStreak.id }
      });
    }
  }

  function subscribeStreak(streakId) {
    realtimeSub = supabase
      .channel('streak-' + streakId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streaks', filter: `id=eq.${streakId}` }, (p) => {
        activeStreak = { ...activeStreak, ...p.new };
        if (p.new.status === 'active' && !streakMovies.length) loadStreakMovies(streakId);
      })
      .subscribe();
  }

  // ── CONVERSATIONS (for partner picker) ──
  async function loadConversations() {
    const { data } = await supabase
      .from('conversations')
      .select('id, user1_id, user2_id')
      .or(`user1_id.eq.${me.id},user2_id.eq.${me.id}`);
    if (!data) return;

    const ids = data.map(c => c.user1_id === me.id ? c.user2_id : c.user1_id);
    const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', [...new Set(ids)]);
    const pMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

    conversations = data.map(c => {
      const otherId = c.user1_id === me.id ? c.user2_id : c.user1_id;
      return { convId: c.id, userId: otherId, username: pMap[otherId]?.username || 'Unknown' };
    });
  }

  // ── GENRE TOGGLE (the fix!) ──
  function toggleGenre(g) {
    const idx = selectedGenres.findIndex(s => s.id === g.id);
    if (idx >= 0) {
      // remove
      selectedGenres = selectedGenres.filter(s => s.id !== g.id);
    } else {
      // add only if under limit
      if (selectedGenres.length < 3) {
        selectedGenres = [...selectedGenres, g];
      }
    }
  }

  function isGenreSelected(g) {
    return selectedGenres.some(s => s.id === g.id);
  }

  // ── STEP NAVIGATION ──
  function validateStep2() {
    durationError = '';
    const d = getDuration();
    if (durationCustom !== '' && durationPreset === null) {
      if (d === null) { durationError = 'Enter a valid number'; return false; }
      if (d < 10)  { durationError = 'Minimum is 10 days'; return false; }
      if (d > 100) { durationError = 'Maximum is 100 days'; return false; }
    }
    return true;
  }

  function nextStep() {
    if (step === 2 && !validateStep2()) return;
    if (canNext()) step = step + 1;
  }

  function prevStep() { if (step > 1) step = step - 1; }

  // ── PARTNER SEARCH ──
  async function searchPartners(q) {
    if (!q.trim()) { partnerResults = []; return; }
    partnerLoading = true;
    const { data } = await supabase
      .from('profiles').select('id, username')
      .ilike('username', `%${q.trim()}%`)
      .neq('id', me.id).limit(8);
    partnerResults = data || [];
    partnerLoading = false;
  }

  function handlePartnerSearch(e) {
    partnerSearchQ = e.target.value;
    clearTimeout(partnerTimer);
    partnerTimer = setTimeout(() => searchPartners(partnerSearchQ), 350);
  }

  function selectPartner(u) {
    selectedPartner = { id: u.id || u.userId, username: u.username };
    partnerSearchQ  = '';
    partnerResults  = [];
  }

  function getConvWithUser(userId) {
    return conversations.find(c => c.userId === userId);
  }

  // ── TMDB HELPERS ──
  async function fetchMoviesForStreak(genreIds, total) {
    const movies = [];
    const seen   = new Set();
    for (let page = 1; page <= 6 && movies.length < total * 2; page++) {
      try {
        const res = await fetch(
          `${BASE}/discover/movie?api_key=${TMDB_KEY}` +
          `&with_genres=${genreIds.join(',')}` +
          `&sort_by=popularity.desc&vote_count.gte=500&vote_average.gte=5.5&page=${page}`
        ).then(r => r.json());
        (res.results || []).forEach(m => {
          if (!seen.has(m.id) && m.poster_path) { seen.add(m.id); movies.push(m); }
        });
      } catch (_) {}
    }

    // Mix popular (40%) and mid (60%)
    const sorted = [...movies].sort((a, b) => b.popularity - a.popularity);
    const top    = sorted.slice(0, Math.floor(sorted.length * 0.4));
    const mid    = sorted.slice(Math.floor(sorted.length * 0.4));
    const mixed  = [];
    for (let i = 0; i < total; i++) {
      const useTp = Math.random() < 0.45 && top.length;
      const pool  = useTp ? top : mid;
      if (!pool.length) break;
      const idx = Math.floor(Math.random() * pool.length);
      mixed.push(pool.splice(idx, 1)[0]);
    }
    return mixed;
  }

  function distributeDates(count, duration, startDateStr) {
    const days = Array.from({ length: duration }, (_, i) => i);
    // Fisher-Yates shuffle
    for (let i = days.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [days[i], days[j]] = [days[j], days[i]];
    }
    return days.slice(0, count).sort((a, b) => a - b).map(offset => {
      const d = new Date(startDateStr);
      d.setDate(d.getDate() + offset);
      return d.toISOString().split('T')[0];
    });
  }

  // ── CREATE STREAK ──
  async function createStreak() {
    if (creating) return;
    creating = true;

    const duration    = getDuration();
    const bOpt        = BUSYNESS_OPTIONS.find(b => b.id === selectedBusyness);
    const total       = Math.round((duration / 7) * (bOpt?.perWeek || 2));
    const genreIds    = selectedGenres.map(g => g.id);
    const startStr    = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();
    const endStr      = (() => { const d = new Date(startStr); d.setDate(d.getDate() + duration - 1); return d.toISOString().split('T')[0]; })();

    let convId = null;
    if (selectedPartner) {
      const existing = getConvWithUser(selectedPartner.id);
      convId = existing?.convId || null;
    }

    const { data: streak, error: se } = await supabase.from('streaks').insert({
      creator_id:      me.id,
      partner_id:      selectedPartner?.id || null,
      partner_status:  selectedPartner ? 'pending' : 'none',
      genres:          selectedGenres.map(g => g.name),
      duration_days:   duration,
      busyness:        selectedBusyness,
      is_temporary:    isTemporary,
      status:          selectedPartner ? 'pending' : 'active',
      start_date:      selectedPartner ? null : startStr,
      end_date:        selectedPartner ? null : endStr,
      conversation_id: convId,
      taste_snapshot:  { genres: selectedGenres.map(g => g.name), busyness: selectedBusyness, duration_days: duration },
    }).select().single();

    if (se || !streak) { console.error(se); creating = false; return; }

    // Solo: schedule movies now
    if (!selectedPartner) {
      const movies = await fetchMoviesForStreak(genreIds, total);
      const dates  = distributeDates(movies.length, duration, startStr);
      const rows   = movies.slice(0, dates.length).map((m, i) => ({
        streak_id:      streak.id, user_id: me.id, tmdb_id: m.id,
        title: m.title,
        poster:   m.poster_path   ? IMG_W300 + m.poster_path   : null,
        backdrop: m.backdrop_path ? IMG_W780 + m.backdrop_path : null,
        year:     (m.release_date || '').slice(0, 4),
        rating:   m.vote_average,
        scheduled_date: dates[i],
        status: dates[i] === startStr ? 'available' : 'locked',
      }));
      await supabase.from('streak_movies').insert(rows);
    }

    // Partner: send request via chat
    if (selectedPartner && convId) {
      await supabase.from('messages').insert({
        conversation_id: convId,
        sender_id:       me.id,
        content: `🔥 @${me.username} invited you to a Movie Streak! ${duration} days · ${selectedGenres.map(g=>g.name).join(', ')} · ${bOpt?.label}`,
        meta: {
          type:      'streak_request',
          streak_id: streak.id,
          from_user: me.id,
          from_name: me.username,
          genres:    selectedGenres.map(g => g.name),
          duration,
          busyness: selectedBusyness,
        }
      });
    }

    createdStreak  = streak;
    activeStreak   = streak;
    waitingPartner = !!selectedPartner;
    creating       = false;

    if (!selectedPartner) {
      await loadStreakMovies(streak.id);
    }
    subscribeStreak(streak.id);
  }

  // ── SOLO START (kick partner) ──
  async function startSolo() {
    if (!activeStreak) return;
    const duration = activeStreak.duration_days;
    const bOpt     = BUSYNESS_OPTIONS.find(b => b.id === activeStreak.busyness);
    const total    = Math.round((duration / 7) * (bOpt?.perWeek || 2));
    const genreIds = ALL_GENRES.filter(g => (activeStreak.genres || []).includes(g.name)).map(g => g.id);
    const startStr = new Date().toISOString().split('T')[0];
    const endDate  = new Date(startStr); endDate.setDate(endDate.getDate() + duration - 1);

    await supabase.from('streaks').update({
      status: 'active', partner_id: null, partner_status: 'kicked',
      start_date: startStr, end_date: endDate.toISOString().split('T')[0],
    }).eq('id', activeStreak.id);

    const movies = await fetchMoviesForStreak(genreIds, total);
    const dates  = distributeDates(movies.length, duration, startStr);
    const rows   = movies.slice(0, dates.length).map((m, i) => ({
      streak_id: activeStreak.id, user_id: me.id, tmdb_id: m.id,
      title: m.title,
      poster:   m.poster_path   ? IMG_W300 + m.poster_path   : null,
      backdrop: m.backdrop_path ? IMG_W780 + m.backdrop_path : null,
      year: (m.release_date || '').slice(0, 4), rating: m.vote_average,
      scheduled_date: dates[i],
      status: dates[i] === startStr ? 'available' : 'locked',
    }));
    await supabase.from('streak_movies').insert(rows);

    activeStreak = { ...activeStreak, status: 'active', start_date: startStr };
    await loadStreakMovies(activeStreak.id);
  }

  async function kickPartner() {
    if (!activeStreak) return;
    await supabase.from('streaks').update({ partner_id: null, partner_status: 'kicked' }).eq('id', activeStreak.id);
    activeStreak = { ...activeStreak, partner_id: null, partner_status: 'kicked' };
    if (activeStreak.status === 'pending') await startSolo();
  }

  // ── MARK WATCHED ──
  async function markWatched(movie) {
    if (movie.status !== 'available') return;
    const now = new Date().toISOString();
    await supabase.from('streak_movies').update({ status: 'watched', watched_at: now }).eq('id', movie.id);
    streakMovies = streakMovies.map(m => m.id === movie.id ? { ...m, status: 'watched', watched_at: now } : m);
    if (streakMovies.filter(m => m.status !== 'watched').length === 0) {
      await supabase.from('streaks').update({ status: 'completed' }).eq('id', activeStreak.id);
      activeStreak = { ...activeStreak, status: 'completed' };
    }
  }

  // ── RESTART FROM TASTE ──
  function restartFromTaste() {
    if (!previousTaste) return;
    selectedGenres   = ALL_GENRES.filter(g => (previousTaste.genres || []).includes(g.name));
    selectedBusyness = previousTaste.busyness || null;
    const preset     = DURATION_PRESETS.find(p => p.value === previousTaste.duration_days);
    if (preset) { durationPreset = preset.value; durationCustom = ''; }
    else { durationPreset = null; durationCustom = String(previousTaste.duration_days || ''); }
    activeStreak  = null;
    createdStreak = null;
    step = 1;
  }

  function startFresh() {
    activeStreak   = null;
    createdStreak  = null;
    selectedGenres = [];
    selectedBusyness = null;
    durationPreset = null;
    durationCustom = '';
    step = 1;
  }
</script>

<div class="grain"></div>

<nav class="nav">
  <button class="nav-back" onclick={() => goto('/chat')}>
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    BACK TO CHAT
  </button>
  <div class="nav-logo">
    <span class="logo-mark">W</span><span class="logo-rest">atch</span><span class="logo-accent">Order</span>
    <div class="logo-dot"></div>
  </div>
  <span class="nav-pill">{isTemporary ? '⚡ TEMP' : '🔥 STREAK'}</span>
</nav>

<main class="page">

  {#if streakLoading}
    <div class="full-center"><div class="spin-lg"></div></div>

  <!-- ── ACTIVE STREAK ── -->
  {:else if activeStreak && !createdStreak}

    {#if activeStreak.status === 'broken'}
      <div class="status-screen">
        <div class="ss-icon">💔</div>
        <h1 class="ss-title">Streak Broken</h1>
        <p class="ss-sub">You missed a movie. Your streak ended on day {streakDay() - 1}.</p>
        <div class="ss-actions">
          {#if hasPrevTaste}
            <button class="btn-gold" onclick={restartFromTaste}>↺ Restart from My Taste</button>
          {/if}
          <button class="btn-ghost" onclick={startFresh}>Start Fresh</button>
        </div>
      </div>

    {:else if activeStreak.status === 'completed'}
      <div class="status-screen">
        <div class="ss-icon">🏆</div>
        <h1 class="ss-title">Streak Complete!</h1>
        <p class="ss-sub">You watched all {watchedCount()} movies in {activeStreak.duration_days} days. Incredible!</p>
        <div class="ss-actions">
          {#if hasPrevTaste}
            <button class="btn-gold" onclick={restartFromTaste}>🔁 Go Again (Same Taste)</button>
          {/if}
          <button class="btn-ghost" onclick={startFresh}>New Streak</button>
        </div>
      </div>

    {:else if activeStreak.status === 'pending'}
      <div class="status-screen">
        <div class="ss-icon">⏳</div>
        <h1 class="ss-title">Waiting for Partner</h1>
        <p class="ss-sub">Streak request sent. Once your partner accepts, it starts automatically.</p>
        <div class="ss-actions">
          <button class="btn-red" onclick={kickPartner}>Kick Partner & Start Solo 🚀</button>
        </div>
      </div>

    {:else if activeStreak.status === 'active'}
      <div class="active-wrap">

        <!-- TOP STATS -->
        <div class="streak-hdr">
          <div class="flame-block">
            <div class="flame-emoji">🔥</div>
            <div class="flame-day">Day {streakDay()}</div>
            <div class="flame-of">of {activeStreak.duration_days}</div>
          </div>
          <div class="stats-row">
            <div class="stat-card">
              <span class="stat-n">{watchedCount()}</span>
              <span class="stat-l">Watched</span>
            </div>
            <div class="stat-card">
              <span class="stat-n">{totalCount() - watchedCount()}</span>
              <span class="stat-l">Remaining</span>
            </div>
            <div class="stat-card">
              <span class="stat-n">{Math.max(0, activeStreak.duration_days - streakDay() + 1)}</span>
              <span class="stat-l">Days Left</span>
            </div>
          </div>
          {#if activeStreak.partner_id}
            <button class="kick-btn" onclick={kickPartner}>Kick Partner</button>
          {/if}
        </div>

        <!-- GENRE TAGS -->
        <div class="genre-tags-row">
          {#each (activeStreak.genres || []) as g}
            <span class="gtag">{g}</span>
          {/each}
          {#if activeStreak.is_temporary}
            <span class="gtag temp">TEMP</span>
          {/if}
        </div>

        <!-- TODAY'S MOVIES -->
        {#if todaysMovies().length > 0}
          <div class="section-block">
            <div class="section-ey"><span></span>WATCH TODAY</div>
            {#each todaysMovies() as movie}
              <div class="today-card">
                {#if movie.backdrop}
                  <div class="today-bg" style="background-image:url({movie.backdrop})"></div>
                  <div class="today-bg-fade"></div>
                {/if}
                <div class="today-left">
                  {#if movie.poster}
                    <img class="today-poster" src={movie.poster} alt={movie.title} />
                  {/if}
                  <div>
                    <div class="today-title">{movie.title}</div>
                    <div class="today-meta">{movie.year} · ★ {movie.rating?.toFixed(1)}</div>
                  </div>
                </div>
                <button class="watched-btn" onclick={() => markWatched(movie)}>✓ Watched</button>
              </div>
            {/each}
          </div>
        {:else}
          <div class="no-today">📅 No movies scheduled for today. Enjoy the break!</div>
        {/if}

        <!-- TIMELINE -->
        <div class="section-block">
          <div class="section-ey"><span></span>FULL SCHEDULE</div>
          <div class="timeline">
            {#each streakMovies as movie}
              <div class="tl-row">
                <div class="tl-date">{movie.scheduled_date}</div>
                <div class="tl-dot" style="background:{statusColor(movie.status)}">
                  {#if movie.status === 'watched'}✓{:else if movie.status === 'missed'}✗{:else if movie.status === 'available'}▶{:else}🔒{/if}
                </div>
                <div class="tl-card" class:tl-locked={movie.status === 'locked'}>
                  {#if movie.poster && movie.status !== 'locked'}
                    <img class="tl-poster" src={movie.poster} alt={movie.title} />
                  {:else}
                    <div class="tl-placeholder">🔒</div>
                  {/if}
                  <div class="tl-info">
                    <div class="tl-title">{movie.status === 'locked' ? 'Locked until ' + movie.scheduled_date : movie.title}</div>
                    {#if movie.status !== 'locked'}
                      <div class="tl-meta">{movie.year} · ★ {movie.rating?.toFixed(1)}</div>
                    {/if}
                  </div>
                  <div class="tl-badge" style="color:{statusColor(movie.status)}">{movie.status.toUpperCase()}</div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

  <!-- ── POST-CREATE ── -->
  {:else if createdStreak}
    <div class="status-screen">
      <div class="ss-icon">{waitingPartner ? '📨' : '🎬'}</div>
      <h1 class="ss-title">{waitingPartner ? 'Invitation Sent!' : 'Streak Started!'}</h1>
      {#if waitingPartner}
        <p class="ss-sub">Sent to @{selectedPartner?.username}. Once they accept, the streak begins automatically.</p>
        <div class="ss-actions">
          <button class="btn-gold" onclick={startSolo}>Start Solo Now 🚀</button>
          <button class="btn-ghost" onclick={() => goto('/chat')}>Back to Chat</button>
        </div>
      {:else}
        <p class="ss-sub">Your streak is live! Come back tomorrow for your first movie.</p>
        <button class="btn-gold" onclick={() => createdStreak = null}>View My Streak 🔥</button>
      {/if}
    </div>

  <!-- ── WIZARD ── -->
  {:else}
    <div class="wizard">

      <!-- PROGRESS -->
      <div class="progress">
        {#each [1,2,3,4] as s}
          <div class="prog-item">
            <div class="prog-dot" class:prog-done={step > s} class:prog-cur={step === s}>
              {step > s ? '✓' : s}
            </div>
            <div class="prog-lbl" class:prog-lbl-cur={step === s}>
              {s===1?'Genre':s===2?'Duration':s===3?'Pace':'Partner'}
            </div>
          </div>
          {#if s < 4}<div class="prog-line" class:prog-line-done={step > s}></div>{/if}
        {/each}
      </div>

      <!-- TEMP TOGGLE (only on step 1) -->
      {#if step === 1}
        <div class="toggle-row">
          <button class="tog-btn" class:tog-active={!isTemporary} onclick={() => isTemporary = false}>🔥 Real Streak</button>
          <button class="tog-btn" class:tog-active={isTemporary}  onclick={() => isTemporary = true}>⚡ Temporary</button>
        </div>
        {#if isTemporary}
          <p class="temp-note">Temporary streaks won't be saved to your taste profile.</p>
        {/if}
      {/if}

      <div class="step-card">

        <!-- STEP 1: GENRES -->
        {#if step === 1}
          <div class="step-ey"><span></span>STEP 1 OF 4</div>
          <h2 class="step-title">What's your vibe?</h2>
          <p class="step-sub">Pick 1 to 3 genres for your streak</p>

          <div class="genres-grid">
            {#each ALL_GENRES as g}
              {@const sel = isGenreSelected(g)}
              {@const disabled = !sel && selectedGenres.length >= 3}
              <button
                class="genre-btn"
                class:genre-sel={sel}
                class:genre-dis={disabled}
                onclick={() => toggleGenre(g)}
              >
                {g.name}
                {#if sel}<span class="gcheck">✓</span>{/if}
              </button>
            {/each}
          </div>
          <p class="sel-count">{selectedGenres.length}/3 selected</p>

        <!-- STEP 2: DURATION -->
        {:else if step === 2}
          <div class="step-ey"><span></span>STEP 2 OF 4</div>
          <h2 class="step-title">How long?</h2>
          <p class="step-sub">Choose a preset or type a custom number (10–100 days)</p>

          <div class="preset-grid">
            {#each DURATION_PRESETS as p}
              <button
                class="preset-btn"
                class:preset-sel={durationPreset === p.value}
                onclick={() => { durationPreset = p.value; durationCustom = ''; durationError = ''; }}
              >{p.label}</button>
            {/each}
          </div>

          <div class="or-sep"><span>or enter custom</span></div>

          <div class="custom-row">
            <input
              class="custom-inp"
              type="number" min="10" max="100"
              placeholder="e.g. 45"
              value={durationCustom}
              oninput={(e) => { durationCustom = e.target.value; durationPreset = null; durationError = ''; }}
            />
            <span class="custom-unit">days</span>
          </div>
          {#if durationError}<p class="field-err">{durationError}</p>{/if}
          {#if getDuration()}
            <div class="dur-preview">
              Your streak: <strong>{getDuration()} days</strong> — ends {(() => {
                const d = new Date(); d.setDate(d.getDate() + getDuration());
                return d.toLocaleDateString([], { month:'short', day:'numeric', year:'numeric' });
              })()}
            </div>
          {/if}

        <!-- STEP 3: PACE -->
        {:else if step === 3}
          <div class="step-ey"><span></span>STEP 3 OF 4</div>
          <h2 class="step-title">How busy are you?</h2>
          <p class="step-sub">Sets how many movies per week you'll receive</p>

          <div class="busy-grid">
            {#each BUSYNESS_OPTIONS as b}
              <button
                class="busy-card"
                class:busy-sel={selectedBusyness === b.id}
                onclick={() => selectedBusyness = b.id}
              >
                <div class="busy-icon">{b.icon}</div>
                <div class="busy-label">{b.label}</div>
                <div class="busy-sub">{b.sub}</div>
                {#if selectedBusyness === b.id}<div class="busy-check">✓</div>{/if}
              </button>
            {/each}
          </div>

          {#if selectedBusyness && getDuration()}
            {@const bOpt = BUSYNESS_OPTIONS.find(b => b.id === selectedBusyness)}
            {@const total = Math.round((getDuration() / 7) * bOpt.perWeek)}
            <div class="dur-preview">~<strong>{total} movies</strong> over {getDuration()} days</div>
          {/if}

        <!-- STEP 4: PARTNER -->
        {:else if step === 4}
          <div class="step-ey"><span></span>STEP 4 OF 4</div>
          <h2 class="step-title">Invite a partner?</h2>
          <p class="step-sub">Optional — you can streak solo too</p>

          {#if selectedPartner}
            <div class="sel-partner">
              <div class="sp-av">{selectedPartner.username.slice(0,2).toUpperCase()}</div>
              <span>@{selectedPartner.username}</span>
              <button class="sp-rm" onclick={() => selectedPartner = null}>✕</button>
            </div>
          {:else}
            {#if conversations.length > 0}
              <p class="partner-lbl">FROM YOUR CHATS</p>
              <div class="conv-list">
                {#each conversations.slice(0, 6) as c}
                  <button class="conv-btn" onclick={() => selectPartner(c)}>
                    <div class="conv-av">{c.username.slice(0,2).toUpperCase()}</div>
                    <span>@{c.username}</span>
                  </button>
                {/each}
              </div>
            {/if}

            <p class="partner-lbl">SEARCH BY USERNAME</p>
            <div class="psearch-wrap">
              <input
                class="psearch"
                type="text"
                placeholder="Search users..."
                value={partnerSearchQ}
                oninput={handlePartnerSearch}
                autocomplete="off"
              />
            </div>

            {#if partnerLoading}
              <div class="p-loading"><div class="spin"></div> Searching...</div>
            {:else if partnerResults.length > 0}
              <div class="p-results">
                {#each partnerResults as u}
                  <button class="p-result" onclick={() => selectPartner(u)}>
                    <div class="pr-av">{u.username.slice(0,2).toUpperCase()}</div>
                    <span>@{u.username}</span>
                  </button>
                {/each}
              </div>
            {:else if partnerSearchQ.trim() && !partnerLoading}
              <p class="p-empty">No users found</p>
            {/if}
          {/if}

          <div class="solo-info">
            ℹ️ If your partner doesn't accept, you can start solo anytime.
          </div>
        {/if}

      </div><!-- end step-card -->

      <!-- WIZARD NAVIGATION -->
      <div class="wiz-nav">
        {#if step > 1}
          <button class="btn-back-wiz" onclick={prevStep}>← Back</button>
        {:else}
          <div></div>
        {/if}

        {#if step < 4}
          <button
            class="btn-next-wiz"
            class:btn-dis={!canNext()}
            disabled={!canNext()}
            onclick={nextStep}
          >Next →</button>
        {:else}
          <button
            class="btn-generate"
            class:btn-dis={creating}
            disabled={creating}
            onclick={createStreak}
          >
            {#if creating}
              <div class="spin white"></div> Generating…
            {:else}
              🔥 Generate Streak
            {/if}
          </button>
        {/if}
      </div>

      {#if hasPrevTaste && step === 1}
        <button class="restart-btn" onclick={restartFromTaste}>↺ Restart from previous taste</button>
      {/if}

    </div><!-- end wizard -->
  {/if}

</main>

<style>
  :global(*){margin:0;padding:0;box-sizing:border-box}
  :global(html,body){background:#050505;color:#f0ece4;font-family:'Sora',sans-serif;min-height:100vh}

  .grain{position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:.04;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}

  /* NAV */
  .nav{position:fixed;top:0;left:0;right:0;z-index:500;height:60px;padding:0 24px;
    display:flex;align-items:center;justify-content:space-between;
    background:rgba(5,5,5,.96);backdrop-filter:blur(16px);
    border-bottom:1px solid rgba(255,255,255,.06)}
  .nav-back{display:flex;align-items:center;gap:7px;background:none;
    border:1px solid rgba(255,255,255,.1);color:rgba(240,236,228,.5);
    font-family:'Space Mono',monospace;font-size:.58rem;letter-spacing:.1em;
    padding:7px 14px;cursor:pointer;border-radius:20px;transition:.2s}
  .nav-back:hover{border-color:rgba(201,168,76,.4);color:#c9a84c}
  .nav-logo{display:flex;align-items:baseline}
  .logo-mark{font-family:'Georgia',serif;font-size:1.8rem;color:#c9a84c;font-weight:700;line-height:1}
  .logo-rest{font-family:'Georgia',serif;font-size:1.3rem;font-weight:300}
  .logo-accent{font-family:'Georgia',serif;font-style:italic;font-size:1.3rem;font-weight:600;opacity:.85}
  .logo-dot{width:5px;height:5px;background:#c9a84c;border-radius:50%;margin-left:4px;box-shadow:0 0 8px #c9a84c}
  .nav-pill{font-family:'Space Mono',monospace;font-size:.58rem;letter-spacing:.1em;
    background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.3);color:#c9a84c;
    padding:4px 10px;border-radius:20px}

  /* PAGE */
  .page{padding:80px 0 80px;min-height:100vh}
  .full-center{height:80vh;display:flex;align-items:center;justify-content:center}

  /* STATUS SCREENS */
  .status-screen{max-width:500px;margin:80px auto;text-align:center;padding:20px}
  .ss-icon{font-size:4rem;margin-bottom:20px}
  .ss-title{font-family:'Cormorant Garamond',serif;font-size:2.6rem;font-weight:700;margin-bottom:12px}
  .ss-sub{font-size:.92rem;opacity:.5;line-height:1.7;margin-bottom:32px}
  .ss-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}

  .btn-gold{background:rgba(201,168,76,.18);border:1px solid rgba(201,168,76,.5);color:#c9a84c;
    font-family:'Space Mono',monospace;font-size:.65rem;letter-spacing:.1em;
    padding:12px 24px;cursor:pointer;border-radius:30px;transition:.2s}
  .btn-gold:hover{background:rgba(201,168,76,.28)}
  .btn-ghost{background:transparent;border:1px solid rgba(255,255,255,.12);color:rgba(240,236,228,.5);
    font-family:'Space Mono',monospace;font-size:.65rem;letter-spacing:.1em;
    padding:12px 24px;cursor:pointer;border-radius:30px;transition:.2s}
  .btn-ghost:hover{border-color:rgba(255,255,255,.25);color:#f0ece4}
  .btn-red{background:rgba(231,76,60,.14);border:1px solid rgba(231,76,60,.35);color:#e74c3c;
    font-family:'Space Mono',monospace;font-size:.65rem;letter-spacing:.1em;
    padding:12px 24px;cursor:pointer;border-radius:30px;transition:.2s}
  .btn-red:hover{background:rgba(231,76,60,.24)}

  /* WIZARD */
  .wizard{max-width:660px;margin:0 auto;padding:40px 20px}

  .progress{display:flex;align-items:center;justify-content:center;gap:4px;margin-bottom:36px;flex-wrap:wrap}
  .prog-item{display:flex;flex-direction:column;align-items:center;gap:5px}
  .prog-dot{width:32px;height:32px;border-radius:50%;border:2px solid rgba(255,255,255,.1);
    background:#0d0d0d;display:flex;align-items:center;justify-content:center;
    font-family:'Space Mono',monospace;font-size:.6rem;color:rgba(240,236,228,.3);transition:.3s}
  .prog-dot.prog-done{border-color:#5fbf8c;background:rgba(95,191,140,.12);color:#5fbf8c}
  .prog-dot.prog-cur{border-color:#c9a84c;background:rgba(201,168,76,.15);color:#c9a84c;box-shadow:0 0 12px rgba(201,168,76,.3)}
  .prog-lbl{font-family:'Space Mono',monospace;font-size:.46rem;letter-spacing:.12em;color:rgba(240,236,228,.2);text-transform:uppercase}
  .prog-lbl.prog-lbl-cur{color:#c9a84c}
  .prog-line{width:36px;height:2px;background:rgba(255,255,255,.07);margin-bottom:16px;transition:.3s}
  .prog-line.prog-line-done{background:#5fbf8c}

  .toggle-row{display:flex;gap:8px;justify-content:center;margin-bottom:14px}
  .tog-btn{background:none;border:1px solid rgba(255,255,255,.1);color:rgba(240,236,228,.4);
    font-family:'Space Mono',monospace;font-size:.6rem;letter-spacing:.08em;
    padding:8px 18px;cursor:pointer;border-radius:20px;transition:.2s}
  .tog-btn:hover{border-color:rgba(255,255,255,.2)}
  .tog-active{background:rgba(201,168,76,.14);border-color:rgba(201,168,76,.45);color:#c9a84c}
  .temp-note{text-align:center;font-family:'Space Mono',monospace;font-size:.56rem;
    color:rgba(93,173,226,.7);letter-spacing:.06em;margin-bottom:14px}

  .step-card{background:#0d0d0d;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:32px;margin-bottom:24px}
  .step-ey{display:flex;align-items:center;gap:12px;font-family:'Space Mono',monospace;
    font-size:.54rem;letter-spacing:.2em;color:rgba(201,168,76,.65);margin-bottom:14px}
  .step-ey span{width:24px;height:1px;background:#c9a84c;opacity:.5}
  .step-title{font-family:'Cormorant Garamond',serif;font-size:2.1rem;font-weight:700;margin-bottom:7px}
  .step-sub{font-size:.83rem;opacity:.38;margin-bottom:26px}

  /* GENRES */
  .genres-grid{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:14px}
  .genre-btn{
    background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);
    color:rgba(240,236,228,.7);font-family:'Space Mono',monospace;
    font-size:.62rem;letter-spacing:.07em;padding:9px 16px;
    cursor:pointer;border-radius:20px;transition:.2s;
    display:flex;align-items:center;gap:6px;
    /* Important: explicit type so browser doesn't treat as submit */
  }
  .genre-btn:hover:not(.genre-dis){border-color:rgba(201,168,76,.45);color:#c9a84c}
  .genre-sel{background:rgba(201,168,76,.16)!important;border-color:#c9a84c!important;color:#c9a84c!important}
  .genre-dis{opacity:.3;cursor:not-allowed}
  .gcheck{font-size:.65rem}
  .sel-count{font-family:'Space Mono',monospace;font-size:.54rem;color:rgba(240,236,228,.28);letter-spacing:.1em}

  /* DURATION */
  .preset-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:9px;margin-bottom:18px}
  .preset-btn{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
    color:rgba(240,236,228,.7);font-family:'Space Mono',monospace;
    font-size:.6rem;letter-spacing:.06em;padding:12px;cursor:pointer;border-radius:10px;transition:.2s}
  .preset-btn:hover{border-color:rgba(201,168,76,.35)}
  .preset-sel{background:rgba(201,168,76,.14)!important;border-color:#c9a84c!important;color:#c9a84c!important}
  .or-sep{text-align:center;position:relative;margin:18px 0;
    font-family:'Space Mono',monospace;font-size:.5rem;color:rgba(240,236,228,.2);letter-spacing:.12em}
  .or-sep::before{content:'';position:absolute;top:50%;left:0;right:0;height:1px;background:rgba(255,255,255,.06)}
  .or-sep span{background:#0d0d0d;position:relative;padding:0 12px}
  .custom-row{display:flex;align-items:center;gap:10px}
  .custom-inp{flex:1;background:#111;border:1px solid rgba(255,255,255,.1);border-radius:10px;
    padding:12px 16px;color:#f0ece4;font-family:'Sora',sans-serif;font-size:1rem;outline:none;transition:.2s}
  .custom-inp:focus{border-color:rgba(201,168,76,.45)}
  .custom-unit{font-family:'Space Mono',monospace;font-size:.62rem;color:rgba(240,236,228,.4)}
  .field-err{color:#e74c3c;font-family:'Space Mono',monospace;font-size:.58rem;margin-top:8px}
  .dur-preview{margin-top:14px;background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.15);
    border-radius:8px;padding:12px 16px;font-size:.82rem;color:rgba(240,236,228,.6)}
  .dur-preview strong{color:#c9a84c}

  /* BUSYNESS */
  .busy-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px}
  .busy-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);
    border-radius:12px;padding:22px 14px;cursor:pointer;transition:.22s;
    text-align:center;position:relative}
  .busy-card:hover{border-color:rgba(201,168,76,.3);background:rgba(201,168,76,.04)}
  .busy-sel{background:rgba(201,168,76,.1)!important;border-color:#c9a84c!important}
  .busy-icon{font-size:2rem;margin-bottom:9px}
  .busy-label{font-family:'Cormorant Garamond',serif;font-size:1.05rem;font-weight:600;margin-bottom:3px}
  .busy-sub{font-family:'Space Mono',monospace;font-size:.52rem;color:rgba(240,236,228,.38);letter-spacing:.05em}
  .busy-check{position:absolute;top:9px;right:9px;width:20px;height:20px;
    background:#c9a84c;color:#050505;border-radius:50%;font-size:.62rem;
    display:flex;align-items:center;justify-content:center;font-weight:700}

  /* PARTNER */
  .partner-lbl{font-family:'Space Mono',monospace;font-size:.5rem;letter-spacing:.14em;
    color:rgba(240,236,228,.22);margin-bottom:9px;margin-top:14px}
  .conv-list{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px}
  .conv-btn{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.09);color:rgba(240,236,228,.7);
    font-size:.78rem;padding:7px 14px;border-radius:20px;cursor:pointer;transition:.2s}
  .conv-btn:hover{border-color:rgba(201,168,76,.3)}
  .conv-av{width:26px;height:26px;border-radius:50%;background:rgba(201,168,76,.12);
    border:1px solid rgba(201,168,76,.25);color:#c9a84c;font-family:'Space Mono',monospace;
    font-size:.48rem;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .psearch-wrap{position:relative;margin-bottom:10px}
  .psearch{width:100%;background:#111;border:1px solid rgba(255,255,255,.09);
    border-radius:20px;padding:10px 16px;color:#f0ece4;font-family:'Sora',sans-serif;
    font-size:.85rem;outline:none;transition:.2s}
  .psearch:focus{border-color:rgba(201,168,76,.4)}
  .psearch::placeholder{color:rgba(240,236,228,.2)}
  .p-loading{padding:10px;font-family:'Space Mono',monospace;font-size:.58rem;
    color:rgba(240,236,228,.28);display:flex;align-items:center;gap:8px}
  .p-results{background:#111;border:1px solid rgba(255,255,255,.07);border-radius:10px;overflow:hidden;margin-bottom:10px}
  .p-result{display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;
    background:none;border:none;border-bottom:1px solid rgba(255,255,255,.05);
    color:#f0ece4;cursor:pointer;transition:.14s;text-align:left;font-size:.82rem}
  .p-result:last-child{border-bottom:none}
  .p-result:hover{background:rgba(201,168,76,.06)}
  .pr-av{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.06);
    border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;
    font-family:'Space Mono',monospace;font-size:.48rem;color:rgba(240,236,228,.5);flex-shrink:0}
  .p-empty{font-family:'Space Mono',monospace;font-size:.58rem;color:rgba(240,236,228,.22);margin:8px 0}
  .sel-partner{display:flex;align-items:center;gap:10px;background:rgba(201,168,76,.1);
    border:1px solid rgba(201,168,76,.3);border-radius:12px;padding:12px 16px;margin-bottom:14px}
  .sp-av{width:34px;height:34px;border-radius:50%;background:rgba(201,168,76,.18);
    border:1px solid rgba(201,168,76,.4);color:#c9a84c;font-family:'Space Mono',monospace;
    font-size:.52rem;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .sp-rm{margin-left:auto;background:none;border:none;color:rgba(240,236,228,.38);cursor:pointer;font-size:1rem;transition:.2s}
  .sp-rm:hover{color:#e74c3c}
  .solo-info{display:flex;align-items:flex-start;gap:8px;background:rgba(255,255,255,.03);
    border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:11px 14px;
    font-size:.77rem;color:rgba(240,236,228,.38);line-height:1.5;margin-top:14px}

  /* WIZARD NAV */
  .wiz-nav{display:flex;justify-content:space-between;align-items:center;margin-top:4px}
  .btn-back-wiz{background:none;border:1px solid rgba(255,255,255,.1);color:rgba(240,236,228,.45);
    font-family:'Space Mono',monospace;font-size:.6rem;letter-spacing:.08em;
    padding:12px 22px;cursor:pointer;border-radius:30px;transition:.2s}
  .btn-back-wiz:hover{border-color:rgba(255,255,255,.22);color:#f0ece4}
  .btn-next-wiz{background:rgba(201,168,76,.18);border:1px solid rgba(201,168,76,.5);color:#c9a84c;
    font-family:'Space Mono',monospace;font-size:.65rem;letter-spacing:.1em;
    padding:13px 28px;cursor:pointer;border-radius:30px;transition:.2s}
  .btn-next-wiz:hover:not(.btn-dis){background:rgba(201,168,76,.28)}
  .btn-generate{display:flex;align-items:center;gap:10px;background:#c9a84c;color:#050505;
    font-family:'Space Mono',monospace;font-size:.65rem;letter-spacing:.1em;font-weight:700;
    padding:13px 28px;border:none;cursor:pointer;border-radius:30px;transition:.2s}
  .btn-generate:hover:not(.btn-dis){background:#e8c46a;transform:translateY(-2px);box-shadow:0 8px 24px rgba(201,168,76,.3)}
  .btn-dis{opacity:.35;cursor:not-allowed}
  .restart-btn{width:100%;margin-top:18px;background:rgba(93,173,226,.08);
    border:1px solid rgba(93,173,226,.2);color:#5dade2;font-family:'Space Mono',monospace;
    font-size:.6rem;letter-spacing:.1em;padding:12px;cursor:pointer;border-radius:10px;transition:.2s}
  .restart-btn:hover{background:rgba(93,173,226,.15)}

  /* ACTIVE STREAK */
  .active-wrap{max-width:820px;margin:0 auto;padding:40px 20px}
  .streak-hdr{display:flex;align-items:center;gap:24px;margin-bottom:22px;flex-wrap:wrap}
  .flame-block{text-align:center}
  .flame-emoji{font-size:2.8rem;line-height:1}
  .flame-day{font-family:'Cormorant Garamond',serif;font-size:2.4rem;font-weight:700;color:#c9a84c;line-height:1}
  .flame-of{font-family:'Space Mono',monospace;font-size:.52rem;color:rgba(240,236,228,.3);letter-spacing:.1em;margin-top:3px}
  .stats-row{display:flex;gap:10px;flex-wrap:wrap}
  .stat-card{background:#0d0d0d;border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:11px 15px;text-align:center}
  .stat-n{display:block;font-family:'Cormorant Garamond',serif;font-size:1.7rem;font-weight:700;color:#c9a84c}
  .stat-l{font-family:'Space Mono',monospace;font-size:.48rem;color:rgba(240,236,228,.28);letter-spacing:.1em}
  .kick-btn{margin-left:auto;background:rgba(231,76,60,.1);border:1px solid rgba(231,76,60,.25);
    color:#e74c3c;font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.08em;
    padding:8px 16px;cursor:pointer;border-radius:20px;transition:.2s}
  .kick-btn:hover{background:rgba(231,76,60,.2)}

  .genre-tags-row{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:26px}
  .gtag{background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.25);color:#c9a84c;
    font-family:'Space Mono',monospace;font-size:.52rem;letter-spacing:.08em;padding:4px 11px;border-radius:20px}
  .gtag.temp{background:rgba(93,173,226,.1);border-color:rgba(93,173,226,.25);color:#5dade2}

  .section-block{margin-bottom:32px}
  .section-ey{display:flex;align-items:center;gap:12px;font-family:'Space Mono',monospace;
    font-size:.55rem;letter-spacing:.2em;color:rgba(201,168,76,.7);margin-bottom:14px}
  .section-ey span{width:24px;height:1px;background:#c9a84c;opacity:.5}

  .today-card{position:relative;background:#0d0d0d;border:1px solid rgba(201,168,76,.3);
    border-radius:14px;padding:18px;overflow:hidden;display:flex;align-items:center;
    gap:14px;min-height:110px;margin-bottom:10px}
  .today-bg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.12;filter:blur(4px)}
  .today-bg-fade{position:absolute;inset:0;background:linear-gradient(to right,#0d0d0d 30%,transparent)}
  .today-left{position:relative;z-index:1;display:flex;align-items:center;gap:12px;flex:1}
  .today-poster{width:55px;height:82px;object-fit:cover;border-radius:6px;flex-shrink:0}
  .today-title{font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:600;margin-bottom:3px}
  .today-meta{font-family:'Space Mono',monospace;font-size:.52rem;color:rgba(240,236,228,.38);letter-spacing:.07em}
  .watched-btn{position:relative;z-index:1;background:#c9a84c;color:#050505;
    font-family:'Space Mono',monospace;font-size:.6rem;letter-spacing:.1em;font-weight:700;
    padding:10px 18px;border:none;cursor:pointer;border-radius:20px;transition:.2s;flex-shrink:0}
  .watched-btn:hover{background:#e8c46a;transform:scale(1.03)}

  .no-today{text-align:center;padding:36px 20px;opacity:.28;font-family:'Space Mono',monospace;font-size:.62rem;letter-spacing:.08em}

  .timeline{display:flex;flex-direction:column;gap:6px}
  .tl-row{display:grid;grid-template-columns:88px 30px 1fr;align-items:center;gap:10px;padding:6px 0}
  .tl-date{font-family:'Space Mono',monospace;font-size:.5rem;color:rgba(240,236,228,.28);text-align:right}
  .tl-dot{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    font-size:.65rem;color:#050505;font-weight:700;flex-shrink:0}
  .tl-card{display:flex;align-items:center;gap:9px;background:#0d0d0d;
    border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:7px 11px;transition:.2s}
  .tl-locked{opacity:.38}
  .tl-poster{width:30px;height:44px;object-fit:cover;border-radius:4px;flex-shrink:0}
  .tl-placeholder{width:30px;height:44px;background:#111;border-radius:4px;
    display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0}
  .tl-info{flex:1;min-width:0}
  .tl-title{font-size:.8rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tl-meta{font-family:'Space Mono',monospace;font-size:.48rem;color:rgba(240,236,228,.28);margin-top:2px}
  .tl-badge{font-family:'Space Mono',monospace;font-size:.46rem;letter-spacing:.07em;flex-shrink:0}

  /* SPINNERS */
  .spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(201,168,76,.2);border-top-color:#c9a84c;animation:spin .7s linear infinite}
  .spin.white{border-color:rgba(5,5,5,.25);border-top-color:#050505}
  .spin-lg{width:40px;height:40px;border-radius:50%;border:3px solid rgba(201,168,76,.15);border-top-color:#c9a84c;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}

  @media(max-width:640px){
    .busy-grid{grid-template-columns:1fr}
    .streak-hdr{gap:14px}
    .tl-row{grid-template-columns:66px 26px 1fr;gap:7px}
  }
</style>