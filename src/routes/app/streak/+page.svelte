<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';

  const TMDB_KEY = '175b19b3ba717bf4f24e37ee4325be7e';
  const BASE     = 'https://api.themoviedb.org/3';
  const IMG      = 'https://image.tmdb.org/t/p/w300';
  const IMG_BG   = 'https://image.tmdb.org/t/p/w780';

  // ── AUTH ──
  let me = null;

  // ── STEP ──
  let step = 1; // 1-4
  let isTemporary = false;

  // Step 1 — genres
  const ALL_GENRES = [
    { id: 28,    name: 'Action' },
    { id: 12,    name: 'Adventure' },
    { id: 16,    name: 'Animation' },
    { id: 35,    name: 'Comedy' },
    { id: 80,    name: 'Crime' },
    { id: 18,    name: 'Drama' },
    { id: 14,    name: 'Fantasy' },
    { id: 27,    name: 'Horror' },
    { id: 9648,  name: 'Mystery' },
    { id: 10749, name: 'Romance' },
    { id: 878,   name: 'Sci-Fi' },
    { id: 53,    name: 'Thriller' },
    { id: 10752, name: 'War' },
    { id: 37,    name: 'Western' },
  ];
  let selectedGenres = [];

  // Step 2 — duration
  const DURATION_PRESETS = [
    { label: '10 days',  value: 10 },
    { label: '2 weeks',  value: 14 },
    { label: '1 month',  value: 30 },
    { label: '2 months', value: 60 },
    { label: '100 days', value: 100 },
  ];
  let durationPreset = null;
  let durationCustom = '';
  let durationError  = '';

  function getDuration() {
    if (durationPreset !== null) return durationPreset;
    const v = parseInt(durationCustom);
    return isNaN(v) ? null : v;
  }

  // Step 3 — busyness
  const BUSYNESS_OPTIONS = [
    {
      id: 'low',
      label: 'Very Busy',
      sub: '1 movie per week',
      icon: '🧳',
      perWeek: 1
    },
    {
      id: 'medium',
      label: 'Somewhat Busy',
      sub: '2 movies per week',
      icon: '⏱️',
      perWeek: 2
    },
    {
      id: 'free',
      label: "I'm Free!",
      sub: '3–4 movies per week',
      icon: '🍿',
      perWeek: 3.5
    },
  ];
  let selectedBusyness = null;

  // Step 4 — partner
  let partnerSearchQ   = '';
  let partnerResults   = [];
  let partnerLoading   = false;
  let partnerTimer     = null;
  let selectedPartner  = null; // {id, username}
  let conversations    = [];

  // ── STREAK CREATION STATE ──
  let creating     = false;
  let createdStreak = null;
  let waitingPartner = false;

  // ── EXISTING STREAK ──
  let activeStreak     = null;
  let streakMovies     = [];
  let streakLoading    = true;
  let previousTaste    = null;
  let hasDecayedStreak = false;
  let realtimeSub      = null;

  // today
  const TODAY = new Date().toISOString().split('T')[0];

  // ── BOOT ──
  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { goto('/signin'); return; }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', session.user.id)
      .single();

    me = {
      id: session.user.id,
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

    // Check for broken streaks
    const { data: broken } = await supabase
      .from('streaks')
      .select('taste_snapshot, genres, busyness, duration_days')
      .or(`creator_id.eq.${me.id},partner_id.eq.${me.id}`)
      .eq('status', 'broken')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (broken) {
      hasDecayedStreak = true;
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
    await checkMissedMovies();
  }

  async function checkMissedMovies() {
    if (!activeStreak || activeStreak.status !== 'active') return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const missed = streakMovies.filter(m =>
      m.status === 'available' &&
      m.scheduled_date <= yesterdayStr
    );

    if (missed.length > 0) {
      // Mark streak broken
      await supabase.from('streaks').update({ status: 'broken' }).eq('id', activeStreak.id);
      await supabase.from('streak_movies')
        .update({ status: 'missed' })
        .in('id', missed.map(m => m.id));

      activeStreak = { ...activeStreak, status: 'broken' };
      streakMovies = streakMovies.map(m =>
        missed.find(mm => mm.id === m.id) ? { ...m, status: 'missed' } : m
      );

      // Notify partner via message if exists
      if (activeStreak.conversation_id && activeStreak.partner_id) {
        const senderMsg = activeStreak.creator_id === me.id ? 'Your streak is broken! 💔' : `Your partner's streak is broken! 💔`;
        await supabase.from('messages').insert({
          conversation_id: activeStreak.conversation_id,
          sender_id: me.id,
          content: senderMsg,
          meta: { type: 'streak_broken', streak_id: activeStreak.id }
        });
      }
    }
  }

  function subscribeStreak(streakId) {
    realtimeSub = supabase
      .channel('streak-' + streakId)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'streaks',
        filter: `id=eq.${streakId}`
      }, (payload) => {
        activeStreak = { ...activeStreak, ...payload.new };
        if (payload.new.status === 'active' && streakMovies.length === 0) {
          loadStreakMovies(streakId);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'streak_movies',
        filter: `streak_id=eq.${streakId}`
      }, () => {
        loadStreakMovies(streakId);
      })
      .subscribe();
  }

  async function loadConversations() {
    const { data } = await supabase
      .from('conversations')
      .select('id, user1_id, user2_id')
      .or(`user1_id.eq.${me.id},user2_id.eq.${me.id}`);

    if (!data) return;

    const otherIds = data.map(c => c.user1_id === me.id ? c.user2_id : c.user1_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', [...new Set(otherIds)]);

    const pMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    conversations = data.map(c => {
      const otherId = c.user1_id === me.id ? c.user2_id : c.user1_id;
      return { convId: c.id, userId: otherId, username: pMap[otherId]?.username || 'Unknown' };
    });
  }

  // ── PARTNER SEARCH ──
  async function searchPartners(q) {
    q = q.trim();
    if (!q) { partnerResults = []; return; }
    partnerLoading = true;
    const { data } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', `%${q}%`)
      .neq('id', me.id)
      .limit(8);
    partnerResults = data || [];
    partnerLoading = false;
  }

  function handlePartnerSearch(e) {
    partnerSearchQ = e.target.value;
    clearTimeout(partnerTimer);
    partnerTimer = setTimeout(() => searchPartners(partnerSearchQ), 350);
  }

  function selectPartner(user) {
    selectedPartner = user;
    partnerSearchQ  = '';
    partnerResults  = [];
  }

  function getConvWithUser(userId) {
    return conversations.find(c => c.userId === userId);
  }

  // ── STEP VALIDATION ──
  function canNext() {
    if (step === 1) return selectedGenres.length >= 1 && selectedGenres.length <= 3;
    if (step === 2) {
      const d = getDuration();
      return d !== null && d >= 10 && d <= 100;
    }
    if (step === 3) return selectedBusyness !== null;
    return true;
  }

  function validateStep2() {
    const d = getDuration();
    durationError = '';
    if (durationPreset !== null) return true;
    if (durationCustom === '') { durationError = 'Enter a number of days'; return false; }
    if (isNaN(parseInt(durationCustom))) { durationError = 'Must be a number'; return false; }
    if (d < 10)  { durationError = 'Minimum 10 days'; return false; }
    if (d > 100) { durationError = 'Maximum 100 days'; return false; }
    return true;
  }

  function nextStep() {
    if (step === 2 && !validateStep2()) return;
    if (canNext()) step++;
  }

  // ── TMDB MOVIE FETCH ──
  async function fetchMoviesForStreak(genreIds, totalMovies) {
    const movies = [];
    const seen = new Set();
    let page = 1;

    while (movies.length < totalMovies * 2 && page <= 5) {
      const genreParam = genreIds.join(',');
      const res = await fetch(
        `${BASE}/discover/movie?api_key=${TMDB_KEY}` +
        `&with_genres=${genreParam}` +
        `&sort_by=popularity.desc` +
        `&vote_count.gte=500` +
        `&vote_average.gte=5.5` +
        `&page=${page}`
      ).then(r => r.json());

      (res.results || []).forEach(m => {
        if (!seen.has(m.id) && m.poster_path && m.vote_average >= 5.5) {
          seen.add(m.id);
          movies.push(m);
        }
      });
      page++;
    }

    // Mix popular (top 40%) and mid-popular (bottom 60%)
    const sorted = movies.sort((a, b) => b.popularity - a.popularity);
    const topSlice  = sorted.slice(0, Math.floor(sorted.length * 0.4));
    const midSlice  = sorted.slice(Math.floor(sorted.length * 0.4));

    const mixed = [];
    for (let i = 0; i < totalMovies; i++) {
      const useTop = Math.random() < 0.45;
      const pool   = useTop && topSlice.length ? topSlice : midSlice;
      if (!pool.length) break;
      const idx = Math.floor(Math.random() * pool.length);
      mixed.push(pool.splice(idx, 1)[0]);
    }

    return mixed;
  }

  function distributeMoviesOverDays(totalMovies, durationDays, startDate) {
    // Create array of day indices (0..durationDays-1)
    const allDays = Array.from({ length: durationDays }, (_, i) => i);
    // Shuffle
    for (let i = allDays.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allDays[i], allDays[j]] = [allDays[j], allDays[i]];
    }
    const selectedDays = allDays.slice(0, totalMovies).sort((a, b) => a - b);

    return selectedDays.map(dayOffset => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + dayOffset);
      return d.toISOString().split('T')[0];
    });
  }

  // ── CREATE STREAK ──
  async function createStreak() {
    if (creating) return;
    creating = true;

    const duration = getDuration();
    const busynessOpt = BUSYNESS_OPTIONS.find(b => b.id === selectedBusyness);
    const moviesPerWeek = busynessOpt?.perWeek || 2;
    const totalMovies = Math.round((duration / 7) * moviesPerWeek);

    const genreIds = selectedGenres.map(g => g.id);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1); // start tomorrow
    const startDateStr = startDate.toISOString().split('T')[0];

    let convId = null;
    if (selectedPartner) {
      const existing = getConvWithUser(selectedPartner.id);
      convId = existing?.convId || null;
    }

    // Insert streak
    const { data: streak, error: streakErr } = await supabase
      .from('streaks')
      .insert({
        creator_id:       me.id,
        partner_id:       selectedPartner?.id || null,
        partner_status:   selectedPartner ? 'pending' : 'none',
        genres:           selectedGenres.map(g => g.name),
        duration_days:    duration,
        busyness:         selectedBusyness,
        is_temporary:     isTemporary,
        status:           selectedPartner ? 'pending' : 'active',
        start_date:       selectedPartner ? null : startDateStr,
        end_date:         selectedPartner ? null : (() => {
          const e = new Date(startDateStr); e.setDate(e.getDate() + duration - 1);
          return e.toISOString().split('T')[0];
        })(),
        conversation_id:  convId,
        taste_snapshot: {
          genres:   selectedGenres.map(g => g.name),
          busyness: selectedBusyness,
          duration_days: duration,
        }
      })
      .select()
      .single();

    if (streakErr || !streak) {
      console.error('Streak create failed:', streakErr);
      creating = false;
      return;
    }

    // If no partner → schedule movies immediately for creator
    if (!selectedPartner) {
      const movies = await fetchMoviesForStreak(genreIds, totalMovies);
      const dates  = distributeMoviesOverDays(movies.length, duration, startDateStr);

      const rows = movies.slice(0, dates.length).map((m, i) => ({
        streak_id:      streak.id,
        user_id:        me.id,
        tmdb_id:        m.id,
        title:          m.title,
        poster:         m.poster_path ? IMG + m.poster_path : null,
        backdrop:       m.backdrop_path ? IMG_BG + m.backdrop_path : null,
        year:           (m.release_date || '').slice(0, 4),
        rating:         m.vote_average,
        scheduled_date: dates[i],
        status:         dates[i] === startDateStr ? 'available' : 'locked',
      }));

      await supabase.from('streak_movies').insert(rows);
    }

    // If partner → send request message in chat
    if (selectedPartner && convId) {
      await supabase.from('messages').insert({
        conversation_id: convId,
        sender_id:       me.id,
        content:         `🔥 @${me.username} invited you to a Movie Streak!\n${duration} days • ${selectedGenres.map(g => g.name).join(', ')} • ${busynessOpt?.label}`,
        meta: {
          type:       'streak_request',
          streak_id:  streak.id,
          from_user:  me.id,
          from_name:  me.username,
          genres:     selectedGenres.map(g => g.name),
          duration:   duration,
          busyness:   selectedBusyness,
        }
      });
    }

    createdStreak   = streak;
    activeStreak    = streak;
    waitingPartner  = !!selectedPartner;
    creating        = false;

    if (!selectedPartner) {
      await loadStreakMovies(streak.id);
    }

    subscribeStreak(streak.id);
  }

  // ── SOLO START ──
  async function startSolo() {
    if (!activeStreak) return;
    const duration   = activeStreak.duration_days;
    const busynessOpt = BUSYNESS_OPTIONS.find(b => b.id === activeStreak.busyness);
    const moviesPerWeek = busynessOpt?.perWeek || 2;
    const totalMovies   = Math.round((duration / 7) * moviesPerWeek);

    const genreIds  = ALL_GENRES.filter(g => activeStreak.genres.includes(g.name)).map(g => g.id);
    const startDateStr = new Date().toISOString().split('T')[0];

    const endDate = new Date(startDateStr);
    endDate.setDate(endDate.getDate() + duration - 1);

    await supabase.from('streaks').update({
      status: 'active',
      partner_id: null,
      partner_status: 'kicked',
      start_date: startDateStr,
      end_date: endDate.toISOString().split('T')[0],
    }).eq('id', activeStreak.id);

    const movies = await fetchMoviesForStreak(genreIds, totalMovies);
    const dates  = distributeMoviesOverDays(movies.length, duration, startDateStr);

    const rows = movies.slice(0, dates.length).map((m, i) => ({
      streak_id:      activeStreak.id,
      user_id:        me.id,
      tmdb_id:        m.id,
      title:          m.title,
      poster:         m.poster_path ? IMG + m.poster_path : null,
      backdrop:       m.backdrop_path ? IMG_BG + m.backdrop_path : null,
      year:           (m.release_date || '').slice(0, 4),
      rating:         m.vote_average,
      scheduled_date: dates[i],
      status:         dates[i] === startDateStr ? 'available' : 'locked',
    }));

    await supabase.from('streak_movies').insert(rows);
    activeStreak = { ...activeStreak, status: 'active', start_date: startDateStr };
    await loadStreakMovies(activeStreak.id);
  }

  // ── KICK PARTNER ──
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

    // Check if all done
    const remaining = streakMovies.filter(m => m.status !== 'watched');
    if (remaining.length === 0) {
      await supabase.from('streaks').update({ status: 'completed' }).eq('id', activeStreak.id);
      activeStreak = { ...activeStreak, status: 'completed' };
    }
  }

  // ── RESET FROM TASTE ──
  function resetFromTaste() {
    if (!previousTaste) return;
    selectedGenres = ALL_GENRES.filter(g => (previousTaste.genres || []).includes(g.name));
    if (previousTaste.busyness) selectedBusyness = previousTaste.busyness;
    if (previousTaste.duration_days) {
      const preset = DURATION_PRESETS.find(p => p.value === previousTaste.duration_days);
      if (preset) durationPreset = preset.value;
      else durationCustom = String(previousTaste.duration_days);
    }
    activeStreak = null;
    step = 1;
  }

  // ── COMPUTED ──
  function todaysMovies() {
    return streakMovies.filter(m => m.scheduled_date === TODAY && m.status === 'available');
  }

  function streakDayNumber() {
    if (!activeStreak?.start_date) return 0;
    const start = new Date(activeStreak.start_date);
    const now   = new Date();
    return Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;
  }

  function watchedCount() { return streakMovies.filter(m => m.status === 'watched').length; }
  function totalCount()   { return streakMovies.length; }

  function getStatusColor(s) {
    if (s === 'watched')   return '#5fbf8c';
    if (s === 'available') return '#c9a84c';
    if (s === 'missed')    return '#e74c3c';
    return 'rgba(255,255,255,.15)';
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
  <div class="nav-badge">
    {#if isTemporary}
      <span class="temp-badge">TEMP STREAK</span>
    {:else}
      <span class="mode-badge">🔥 STREAK</span>
    {/if}
  </div>
</nav>

<main class="page">

  <!-- ════════════════════════════
       ACTIVE / BROKEN / PENDING STREAK VIEW
  ════════════════════════════ -->
  {#if activeStreak && !createdStreak}

    <!-- BROKEN -->
    {#if activeStreak.status === 'broken'}
      <div class="streak-status broken">
        <div class="status-icon">💔</div>
        <h1>Streak Broken</h1>
        <p>You missed a movie. Your streak of <strong>{streakDayNumber() - 1}</strong> days has ended.</p>
        <div class="broken-actions">
          <button class="btn-gold" onclick={resetFromTaste}>🔄 Restart From My Taste</button>
          <button class="btn-ghost" onclick={() => { activeStreak = null; step = 1; }}>Start Fresh</button>
        </div>
      </div>

    <!-- COMPLETED -->
    {:else if activeStreak.status === 'completed'}
      <div class="streak-status completed">
        <div class="status-icon">🏆</div>
        <h1>Streak Completed!</h1>
        <p>You watched all <strong>{watchedCount()}</strong> movies in {activeStreak.duration_days} days. Amazing!</p>
        <div class="broken-actions">
          <button class="btn-gold" onclick={resetFromTaste}>🔁 Go Again (Same Taste)</button>
          <button class="btn-ghost" onclick={() => { activeStreak = null; step = 1; }}>New Streak</button>
        </div>
      </div>

    <!-- PENDING PARTNER -->
    {:else if activeStreak.status === 'pending'}
      <div class="streak-status pending">
        <div class="status-icon">⏳</div>
        <h1>Waiting for Partner</h1>
        <p>Streak request sent. Once <strong>@{activeStreak.partner_id ? 'your partner' : 'nobody'}</strong> accepts, the streak will start automatically.</p>
        <div class="broken-actions">
          <button class="btn-red" onclick={kickPartner}>Kick Partner & Start Solo 🚀</button>
        </div>
      </div>

    <!-- ACTIVE -->
    {:else if activeStreak.status === 'active'}
      <div class="active-streak">

        <!-- HEADER STATS -->
        <div class="streak-hdr">
          <div class="streak-flame">
            <div class="flame-icon">🔥</div>
            <div class="flame-day">Day {streakDayNumber()}</div>
            <div class="flame-of">of {activeStreak.duration_days}</div>
          </div>
          <div class="streak-stats">
            <div class="stat-pill">
              <span class="stat-n">{watchedCount()}</span>
              <span class="stat-l">Watched</span>
            </div>
            <div class="stat-pill">
              <span class="stat-n">{totalCount() - watchedCount()}</span>
              <span class="stat-l">Remaining</span>
            </div>
            <div class="stat-pill">
              <span class="stat-n">{activeStreak.duration_days - streakDayNumber() + 1}</span>
              <span class="stat-l">Days Left</span>
            </div>
          </div>

          {#if activeStreak.partner_id}
            <button class="kick-btn" onclick={kickPartner}>Kick Partner</button>
          {/if}
        </div>

        <!-- GENRES PILLS -->
        <div class="genres-row">
          {#each activeStreak.genres as g}
            <span class="genre-tag">{g}</span>
          {/each}
          {#if activeStreak.is_temporary}<span class="temp-tag">TEMP</span>{/if}
        </div>

        <!-- TODAY SECTION -->
        {#if todaysMovies().length > 0}
          <div class="today-section">
            <div class="section-eyebrow"><span></span>WATCH TODAY</div>
            <div class="today-movies">
              {#each todaysMovies() as movie}
                <div class="today-card">
                  {#if movie.backdrop}
                    <div class="today-bg" style="background-image:url({movie.backdrop})"></div>
                    <div class="today-bg-fade"></div>
                  {/if}
                  <div class="today-info">
                    {#if movie.poster}
                      <img class="today-poster" src={movie.poster} alt={movie.title} />
                    {/if}
                    <div>
                      <div class="today-title">{movie.title}</div>
                      <div class="today-meta">{movie.year} • ★ {movie.rating?.toFixed(1)}</div>
                    </div>
                  </div>
                  <button class="watched-btn" onclick={() => markWatched(movie)}>
                    ✓ Mark as Watched
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <div class="no-today">
            <div class="no-today-icon">📅</div>
            <p>No movies scheduled for today. Enjoy your break!</p>
          </div>
        {/if}

        <!-- TIMELINE -->
        <div class="timeline-section">
          <div class="section-eyebrow"><span></span>FULL SCHEDULE</div>
          <div class="timeline">
            {#each streakMovies as movie}
              <div
                class="timeline-item"
                class:available={movie.status === 'available'}
                class:watched={movie.status === 'watched'}
                class:missed={movie.status === 'missed'}
              >
                <div class="tl-date">{movie.scheduled_date}</div>
                <div class="tl-dot" style="background:{getStatusColor(movie.status)}">
                  {#if movie.status === 'watched'}✓
                  {:else if movie.status === 'missed'}✗
                  {:else if movie.status === 'available'}▶
                  {:else}🔒{/if}
                </div>
                <div class="tl-card" class:locked={movie.status === 'locked'}>
                  {#if movie.poster && movie.status !== 'locked'}
                    <img class="tl-poster" src={movie.poster} alt={movie.title} />
                  {:else}
                    <div class="tl-poster-placeholder">🔒</div>
                  {/if}
                  <div class="tl-info">
                    <div class="tl-title">{movie.status === 'locked' ? 'Locked' : movie.title}</div>
                    {#if movie.status !== 'locked'}
                      <div class="tl-meta">{movie.year} • ★ {movie.rating?.toFixed(1)}</div>
                    {/if}
                  </div>
                  <div class="tl-status-badge" style="color:{getStatusColor(movie.status)}">
                    {movie.status.toUpperCase()}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

  <!-- ════════════════════════════
       POST-CREATION WAITING STATE
  ════════════════════════════ -->
  {:else if createdStreak}
    <div class="streak-status pending">
      <div class="status-icon">🎬</div>
      <h1>{waitingPartner ? 'Streak Request Sent!' : 'Streak Started!'}</h1>
      {#if waitingPartner}
        <p>Your invitation has been sent to <strong>@{selectedPartner?.username}</strong> in the chat. Once they accept, the streak begins automatically.</p>
        <div class="broken-actions">
          <button class="btn-gold" onclick={startSolo}>Start Solo Now 🚀</button>
          <button class="btn-ghost" onclick={() => goto('/chat')}>Back to Chat</button>
        </div>
      {:else}
        <p>Your streak is active! Head back and start watching.</p>
        <button class="btn-gold" onclick={() => { createdStreak = null; }}>View My Streak 🔥</button>
      {/if}
    </div>

  <!-- ════════════════════════════
       CREATION WIZARD
  ════════════════════════════ -->
  {:else}
    <div class="wizard">

      <!-- STEP PROGRESS -->
      <div class="progress-bar">
        {#each [1,2,3,4] as s}
          <div class="progress-seg {step >= s ? 'done' : ''} {step === s ? 'current' : ''}">
            <div class="prog-dot">{step > s ? '✓' : s}</div>
            <div class="prog-label">
              {s === 1 ? 'Genre' : s === 2 ? 'Duration' : s === 3 ? 'Pace' : 'Partner'}
            </div>
          </div>
          {#if s < 4}<div class="progress-line {step > s ? 'done' : ''}"></div>{/if}
        {/each}
      </div>

      <!-- TEMP TOGGLE -->
      {#if step === 1}
        <div class="temp-toggle">
          <button
            class="toggle-opt {!isTemporary ? 'tog-active' : ''}"
            onclick={() => isTemporary = false}
          >🔥 Real Streak</button>
          <button
            class="toggle-opt {isTemporary ? 'tog-active' : ''}"
            onclick={() => isTemporary = true}
          >⚡ Temporary</button>
        </div>
        {#if isTemporary}
          <p class="temp-hint">A temporary streak won't be saved to your taste profile when completed.</p>
        {/if}
      {/if}

      <!-- ── STEP 1: GENRES ── -->
      {#if step === 1}
        <div class="step-card">
          <div class="step-eyebrow"><span></span>STEP 1 OF 4</div>
          <h2 class="step-title">What's your vibe?</h2>
          <p class="step-sub">Pick 1 to 3 genres for your streak</p>
          <div class="genres-grid">
            {#each ALL_GENRES as g}
              {@const sel = selectedGenres.find(s => s.id === g.id)}
              <button
                class="genre-btn {sel ? 'genre-sel' : ''} {selectedGenres.length >= 3 && !sel ? 'genre-dis' : ''}"
                onclick={() => {
                  if (sel) selectedGenres = selectedGenres.filter(s => s.id !== g.id);
                  else if (selectedGenres.length < 3) selectedGenres = [...selectedGenres, g];
                }}
              >
                {g.name}
                {#if sel}<span class="genre-check">✓</span>{/if}
              </button>
            {/each}
          </div>
          <p class="sel-count">{selectedGenres.length}/3 selected</p>
        </div>

      <!-- ── STEP 2: DURATION ── -->
      {:else if step === 2}
        <div class="step-card">
          <div class="step-eyebrow"><span></span>STEP 2 OF 4</div>
          <h2 class="step-title">How long?</h2>
          <p class="step-sub">Choose a preset or enter custom days (10–100)</p>

          <div class="preset-grid">
            {#each DURATION_PRESETS as p}
              <button
                class="preset-btn {durationPreset === p.value ? 'preset-sel' : ''}"
                onclick={() => { durationPreset = p.value; durationCustom = ''; durationError = ''; }}
              >
                {p.label}
              </button>
            {/each}
          </div>

          <div class="or-divider"><span>or enter custom</span></div>

          <div class="custom-input-wrap">
            <input
              class="custom-input"
              type="number"
              min="10"
              max="100"
              placeholder="e.g. 45"
              bind:value={durationCustom}
              oninput={() => { durationPreset = null; durationError = ''; }}
            />
            <span class="custom-unit">days</span>
          </div>
          {#if durationError}
            <p class="field-error">{durationError}</p>
          {/if}
          {#if getDuration()}
            <div class="duration-preview">
              Your streak: <strong>{getDuration()} days</strong>
              — ends {(() => {
                const d = new Date(); d.setDate(d.getDate() + getDuration());
                return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
              })()}
            </div>
          {/if}
        </div>

      <!-- ── STEP 3: BUSYNESS ── -->
      {:else if step === 3}
        <div class="step-card">
          <div class="step-eyebrow"><span></span>STEP 3 OF 4</div>
          <h2 class="step-title">How busy are you?</h2>
          <p class="step-sub">This sets how many movies per week you'll get</p>

          <div class="busy-grid">
            {#each BUSYNESS_OPTIONS as b}
              <button
                class="busy-card {selectedBusyness === b.id ? 'busy-sel' : ''}"
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
            <div class="duration-preview">
              You'll watch ~<strong>{total} movies</strong> over {getDuration()} days
            </div>
          {/if}
        </div>

      <!-- ── STEP 4: PARTNER ── -->
      {:else if step === 4}
        <div class="step-card">
          <div class="step-eyebrow"><span></span>STEP 4 OF 4</div>
          <h2 class="step-title">Invite a partner?</h2>
          <p class="step-sub">Optional — you can do this streak solo too</p>

          {#if selectedPartner}
            <div class="selected-partner">
              <div class="sp-av">{selectedPartner.username.slice(0,2).toUpperCase()}</div>
              <span>@{selectedPartner.username}</span>
              <button class="sp-remove" onclick={() => selectedPartner = null}>✕</button>
            </div>
          {:else}
            <!-- From chats -->
            {#if conversations.length > 0}
              <p class="partner-sect-label">FROM YOUR CHATS</p>
              <div class="conv-partners">
                {#each conversations.slice(0, 6) as c}
                  <button class="conv-partner-btn" onclick={() => selectPartner({ id: c.userId, username: c.username })}>
                    <div class="cp-av">{c.username.slice(0,2).toUpperCase()}</div>
                    <span>@{c.username}</span>
                  </button>
                {/each}
              </div>
            {/if}

            <!-- Search -->
            <p class="partner-sect-label">SEARCH BY USERNAME</p>
            <div class="partner-search-wrap">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:rgba(240,236,228,.3);pointer-events:none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.3"/>
                <path d="M10 10l2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              <input
                class="partner-search"
                type="text"
                placeholder="Search users..."
                value={partnerSearchQ}
                oninput={handlePartnerSearch}
                autocomplete="off"
              />
            </div>

            {#if partnerLoading}
              <div class="partner-loading"><div class="spin"></div> Searching...</div>
            {:else if partnerResults.length > 0}
              <div class="partner-results">
                {#each partnerResults as u}
                  <button class="partner-result" onclick={() => selectPartner(u)}>
                    <div class="pr-av">{u.username.slice(0,2).toUpperCase()}</div>
                    <span>@{u.username}</span>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="opacity:.4;flex-shrink:0">
                      <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                    </svg>
                  </button>
                {/each}
              </div>
            {:else if partnerSearchQ.trim() && !partnerLoading}
              <p class="partner-empty">No users found for "{partnerSearchQ}"</p>
            {/if}
          {/if}

          <!-- NOTE about solo -->
          <div class="solo-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
            If you skip a partner, or they don't accept, you can start solo anytime.
          </div>
        </div>
      {/if}

      <!-- NAV BUTTONS -->
      <div class="wizard-nav">
        {#if step > 1}
          <button class="btn-back" onclick={() => step--}>← Back</button>
        {:else}
          <div></div>
        {/if}

        {#if step < 4}
          <button
            class="btn-next {canNext() ? '' : 'btn-disabled'}"
            onclick={nextStep}
            disabled={!canNext()}
          >
            Next →
          </button>
        {:else}
          <button
            class="btn-generate {creating ? 'btn-disabled' : ''}"
            onclick={createStreak}
            disabled={creating}
          >
            {#if creating}
              <div class="spin white"></div> Generating…
            {:else}
              🔥 Generate Streak
            {/if}
          </button>
        {/if}
      </div>

      <!-- RESTART FROM TASTE (if broken streak exists) -->
      {#if hasDecayedStreak && step === 1}
        <button class="restart-taste-btn" onclick={resetFromTaste}>
          ↺ Restart from previous taste
        </button>
      {/if}

    </div>
  {/if}

</main>

<style>
  :global(*) { margin:0; padding:0; box-sizing:border-box; }
  :global(html,body) { background:#050505; color:#f0ece4; font-family:'Sora',sans-serif; min-height:100vh; }

  .grain { position:fixed; inset:0; z-index:9999; pointer-events:none; opacity:.04; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }

  /* NAV */
  .nav { position:fixed; top:0; left:0; right:0; z-index:500; height:60px; padding:0 28px; display:flex; align-items:center; justify-content:space-between; background:rgba(5,5,5,.95); backdrop-filter:blur(16px); border-bottom:1px solid rgba(255,255,255,.06); }
  .nav-back { display:flex; align-items:center; gap:7px; background:none; border:1px solid rgba(255,255,255,.1); color:rgba(240,236,228,.5); font-family:'Space Mono',monospace; font-size:.58rem; letter-spacing:.1em; padding:7px 14px; cursor:pointer; border-radius:20px; transition:.2s; }
  .nav-back:hover { border-color:rgba(201,168,76,.4); color:#c9a84c; }
  .nav-logo { display:flex; align-items:baseline; gap:0; }
  .logo-mark { font-family:'Georgia',serif; font-size:1.8rem; color:#c9a84c; font-weight:700; line-height:1; }
  .logo-rest { font-family:'Georgia',serif; font-size:1.3rem; font-weight:300; }
  .logo-accent { font-family:'Georgia',serif; font-style:italic; font-size:1.3rem; font-weight:600; opacity:.85; }
  .logo-dot { width:5px; height:5px; background:#c9a84c; border-radius:50%; margin-left:4px; box-shadow:0 0 8px #c9a84c; }
  .nav-badge { font-family:'Space Mono',monospace; font-size:.58rem; letter-spacing:.1em; }
  .temp-badge { background:rgba(93,173,226,.15); border:1px solid rgba(93,173,226,.3); color:#5dade2; padding:4px 10px; border-radius:20px; }
  .mode-badge { background:rgba(201,168,76,.12); border:1px solid rgba(201,168,76,.3); color:#c9a84c; padding:4px 10px; border-radius:20px; }

  /* PAGE */
  .page { padding:80px 0 60px; min-height:100vh; }

  /* STATUS SCREENS */
  .streak-status { max-width:520px; margin:80px auto; text-align:center; padding:20px; }
  .status-icon { font-size:4rem; margin-bottom:20px; }
  .streak-status h1 { font-family:'Cormorant Garamond',serif; font-size:2.8rem; font-weight:700; margin-bottom:12px; }
  .streak-status p { opacity:.55; font-size:.95rem; line-height:1.7; margin-bottom:32px; }
  .streak-status strong { color:#c9a84c; }
  .broken-actions { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
  .btn-gold { background:rgba(201,168,76,.18); border:1px solid rgba(201,168,76,.5); color:#c9a84c; font-family:'Space Mono',monospace; font-size:.68rem; letter-spacing:.1em; padding:12px 24px; cursor:pointer; border-radius:30px; transition:.2s; }
  .btn-gold:hover { background:rgba(201,168,76,.28); }
  .btn-ghost { background:transparent; border:1px solid rgba(255,255,255,.12); color:rgba(240,236,228,.5); font-family:'Space Mono',monospace; font-size:.68rem; letter-spacing:.1em; padding:12px 24px; cursor:pointer; border-radius:30px; transition:.2s; }
  .btn-ghost:hover { border-color:rgba(255,255,255,.25); color:#f0ece4; }
  .btn-red { background:rgba(231,76,60,.15); border:1px solid rgba(231,76,60,.35); color:#e74c3c; font-family:'Space Mono',monospace; font-size:.68rem; letter-spacing:.1em; padding:12px 24px; cursor:pointer; border-radius:30px; transition:.2s; }
  .btn-red:hover { background:rgba(231,76,60,.25); }

  /* WIZARD */
  .wizard { max-width:680px; margin:0 auto; padding:40px 24px; }

  /* PROGRESS */
  .progress-bar { display:flex; align-items:center; justify-content:center; gap:0; margin-bottom:40px; flex-wrap:wrap; gap:4px; }
  .progress-seg { display:flex; flex-direction:column; align-items:center; gap:6px; }
  .prog-dot { width:32px; height:32px; border-radius:50%; border:2px solid rgba(255,255,255,.1); background:#0d0d0d; display:flex; align-items:center; justify-content:center; font-family:'Space Mono',monospace; font-size:.6rem; color:rgba(240,236,228,.3); transition:.3s; }
  .progress-seg.done .prog-dot { border-color:#5fbf8c; background:rgba(95,191,140,.12); color:#5fbf8c; }
  .progress-seg.current .prog-dot { border-color:#c9a84c; background:rgba(201,168,76,.15); color:#c9a84c; box-shadow:0 0 12px rgba(201,168,76,.3); }
  .prog-label { font-family:'Space Mono',monospace; font-size:.48rem; letter-spacing:.12em; color:rgba(240,236,228,.25); text-transform:uppercase; }
  .progress-seg.current .prog-label { color:#c9a84c; }
  .progress-line { width:40px; height:2px; background:rgba(255,255,255,.07); margin-bottom:18px; transition:.3s; }
  .progress-line.done { background:#5fbf8c; }

  /* TEMP TOGGLE */
  .temp-toggle { display:flex; gap:8px; justify-content:center; margin-bottom:16px; }
  .toggle-opt { background:none; border:1px solid rgba(255,255,255,.1); color:rgba(240,236,228,.4); font-family:'Space Mono',monospace; font-size:.62rem; letter-spacing:.08em; padding:8px 18px; cursor:pointer; border-radius:20px; transition:.2s; }
  .toggle-opt:hover { border-color:rgba(255,255,255,.2); }
  .tog-active { background:rgba(201,168,76,.14); border-color:rgba(201,168,76,.45); color:#c9a84c; }
  .temp-hint { text-align:center; font-size:.75rem; color:rgba(93,173,226,.7); font-family:'Space Mono',monospace; font-size:.58rem; letter-spacing:.06em; margin-bottom:16px; }

  /* STEP CARD */
  .step-card { background:#0d0d0d; border:1px solid rgba(255,255,255,.07); border-radius:16px; padding:36px; margin-bottom:28px; }
  .step-eyebrow { display:flex; align-items:center; gap:12px; font-family:'Space Mono',monospace; font-size:.56rem; letter-spacing:.2em; color:rgba(201,168,76,.65); margin-bottom:16px; }
  .step-eyebrow span { width:28px; height:1px; background:#c9a84c; opacity:.5; }
  .step-title { font-family:'Cormorant Garamond',serif; font-size:2.2rem; font-weight:700; margin-bottom:8px; }
  .step-sub { font-size:.85rem; opacity:.4; margin-bottom:28px; }

  /* GENRES */
  .genres-grid { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:16px; }
  .genre-btn { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); color:rgba(240,236,228,.7); font-family:'Space Mono',monospace; font-size:.62rem; letter-spacing:.08em; padding:9px 16px; cursor:pointer; border-radius:20px; transition:.2s; position:relative; }
  .genre-btn:hover { border-color:rgba(201,168,76,.4); }
  .genre-sel { background:rgba(201,168,76,.16); border-color:#c9a84c; color:#c9a84c; }
  .genre-dis { opacity:.3; cursor:not-allowed; }
  .genre-check { margin-left:6px; font-size:.7rem; }
  .sel-count { font-family:'Space Mono',monospace; font-size:.56rem; color:rgba(240,236,228,.3); letter-spacing:.1em; }

  /* PRESETS */
  .preset-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:10px; margin-bottom:20px; }
  .preset-btn { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); color:rgba(240,236,228,.7); font-family:'Space Mono',monospace; font-size:.62rem; letter-spacing:.06em; padding:12px; cursor:pointer; border-radius:10px; transition:.2s; }
  .preset-btn:hover { border-color:rgba(201,168,76,.35); }
  .preset-sel { background:rgba(201,168,76,.14); border-color:#c9a84c; color:#c9a84c; }

  .or-divider { text-align:center; position:relative; margin:20px 0; font-family:'Space Mono',monospace; font-size:.52rem; color:rgba(240,236,228,.2); letter-spacing:.12em; }
  .or-divider::before { content:''; position:absolute; top:50%; left:0; right:0; height:1px; background:rgba(255,255,255,.06); }
  .or-divider span { background:#0d0d0d; position:relative; padding:0 12px; }

  .custom-input-wrap { display:flex; align-items:center; gap:10px; }
  .custom-input { flex:1; background:#111; border:1px solid rgba(255,255,255,.1); border-radius:10px; padding:12px 16px; color:#f0ece4; font-family:'Sora',sans-serif; font-size:1rem; outline:none; transition:.2s; }
  .custom-input:focus { border-color:rgba(201,168,76,.45); }
  .custom-unit { font-family:'Space Mono',monospace; font-size:.65rem; color:rgba(240,236,228,.4); }
  .field-error { color:#e74c3c; font-family:'Space Mono',monospace; font-size:.6rem; margin-top:8px; }
  .duration-preview { margin-top:16px; background:rgba(201,168,76,.06); border:1px solid rgba(201,168,76,.15); border-radius:8px; padding:12px 16px; font-size:.82rem; color:rgba(240,236,228,.6); }
  .duration-preview strong { color:#c9a84c; }

  /* BUSYNESS */
  .busy-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:20px; }
  .busy-card { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:24px 16px; cursor:pointer; transition:.22s; text-align:center; position:relative; }
  .busy-card:hover { border-color:rgba(201,168,76,.3); background:rgba(201,168,76,.04); }
  .busy-sel { background:rgba(201,168,76,.1); border-color:#c9a84c; }
  .busy-icon { font-size:2rem; margin-bottom:10px; }
  .busy-label { font-family:'Cormorant Garamond',serif; font-size:1.1rem; font-weight:600; margin-bottom:4px; }
  .busy-sub { font-family:'Space Mono',monospace; font-size:.54rem; color:rgba(240,236,228,.4); letter-spacing:.06em; }
  .busy-check { position:absolute; top:10px; right:10px; width:20px; height:20px; background:#c9a84c; color:#050505; border-radius:50%; font-size:.65rem; display:flex; align-items:center; justify-content:center; font-weight:700; }

  /* PARTNER */
  .partner-sect-label { font-family:'Space Mono',monospace; font-size:.52rem; letter-spacing:.14em; color:rgba(240,236,228,.25); margin-bottom:10px; margin-top:16px; }
  .conv-partners { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; }
  .conv-partner-btn { display:flex; align-items:center; gap:8px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09); color:rgba(240,236,228,.7); font-size:.8rem; padding:8px 14px; border-radius:20px; cursor:pointer; transition:.2s; }
  .conv-partner-btn:hover { border-color:rgba(201,168,76,.3); }
  .cp-av { width:28px; height:28px; border-radius:50%; background:rgba(201,168,76,.12); border:1px solid rgba(201,168,76,.25); color:#c9a84c; font-family:'Space Mono',monospace; font-size:.5rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; }

  .partner-search-wrap { position:relative; margin-bottom:12px; }
  .partner-search { width:100%; background:#111; border:1px solid rgba(255,255,255,.09); border-radius:20px; padding:10px 16px 10px 36px; color:#f0ece4; font-family:'Sora',sans-serif; font-size:.85rem; outline:none; transition:.2s; }
  .partner-search:focus { border-color:rgba(201,168,76,.4); }
  .partner-search::placeholder { color:rgba(240,236,228,.2); }
  .partner-loading { padding:12px; font-family:'Space Mono',monospace; font-size:.6rem; color:rgba(240,236,228,.3); display:flex; align-items:center; gap:8px; }
  .partner-results { background:#111; border:1px solid rgba(255,255,255,.07); border-radius:10px; overflow:hidden; margin-bottom:12px; }
  .partner-result { display:flex; align-items:center; gap:10px; width:100%; padding:10px 14px; background:none; border:none; border-bottom:1px solid rgba(255,255,255,.05); color:#f0ece4; cursor:pointer; transition:.15s; text-align:left; font-size:.82rem; }
  .partner-result:last-child { border-bottom:none; }
  .partner-result:hover { background:rgba(201,168,76,.06); }
  .pr-av { width:30px; height:30px; border-radius:50%; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); display:flex; align-items:center; justify-content:center; font-family:'Space Mono',monospace; font-size:.5rem; color:rgba(240,236,228,.5); flex-shrink:0; }
  .partner-empty { font-family:'Space Mono',monospace; font-size:.6rem; color:rgba(240,236,228,.25); margin:8px 0; }
  .selected-partner { display:flex; align-items:center; gap:10px; background:rgba(201,168,76,.1); border:1px solid rgba(201,168,76,.3); border-radius:12px; padding:12px 16px; margin-bottom:16px; }
  .sp-av { width:36px; height:36px; border-radius:50%; background:rgba(201,168,76,.18); border:1px solid rgba(201,168,76,.4); color:#c9a84c; font-family:'Space Mono',monospace; font-size:.55rem; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .sp-remove { margin-left:auto; background:none; border:none; color:rgba(240,236,228,.4); cursor:pointer; font-size:1rem; transition:.2s; }
  .sp-remove:hover { color:#e74c3c; }
  .solo-note { display:flex; align-items:flex-start; gap:8px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:8px; padding:12px 14px; font-size:.78rem; color:rgba(240,236,228,.4); line-height:1.5; margin-top:16px; }

  /* WIZARD NAV */
  .wizard-nav { display:flex; justify-content:space-between; align-items:center; margin-top:4px; }
  .btn-back { background:none; border:1px solid rgba(255,255,255,.1); color:rgba(240,236,228,.5); font-family:'Space Mono',monospace; font-size:.62rem; letter-spacing:.08em; padding:12px 22px; cursor:pointer; border-radius:30px; transition:.2s; }
  .btn-back:hover { border-color:rgba(255,255,255,.22); color:#f0ece4; }
  .btn-next { background:rgba(201,168,76,.18); border:1px solid rgba(201,168,76,.5); color:#c9a84c; font-family:'Space Mono',monospace; font-size:.68rem; letter-spacing:.1em; padding:13px 28px; cursor:pointer; border-radius:30px; transition:.2s; }
  .btn-next:hover:not(.btn-disabled) { background:rgba(201,168,76,.28); }
  .btn-generate { display:flex; align-items:center; gap:10px; background:#c9a84c; color:#050505; font-family:'Space Mono',monospace; font-size:.68rem; letter-spacing:.1em; font-weight:700; padding:13px 28px; border:none; cursor:pointer; border-radius:30px; transition:.2s; }
  .btn-generate:hover:not(.btn-disabled) { background:#e8c46a; transform:translateY(-2px); box-shadow:0 8px 24px rgba(201,168,76,.3); }
  .btn-disabled { opacity:.35; cursor:not-allowed; }
  .restart-taste-btn { width:100%; margin-top:20px; background:rgba(93,173,226,.08); border:1px solid rgba(93,173,226,.2); color:#5dade2; font-family:'Space Mono',monospace; font-size:.62rem; letter-spacing:.1em; padding:12px; cursor:pointer; border-radius:10px; transition:.2s; }
  .restart-taste-btn:hover { background:rgba(93,173,226,.15); }

  /* ── ACTIVE STREAK VIEW ── */
  .active-streak { max-width:860px; margin:0 auto; padding:40px 24px; }

  .streak-hdr { display:flex; align-items:center; gap:28px; margin-bottom:24px; flex-wrap:wrap; }
  .streak-flame { text-align:center; }
  .flame-icon { font-size:3rem; line-height:1; }
  .flame-day { font-family:'Cormorant Garamond',serif; font-size:2.5rem; font-weight:700; color:#c9a84c; line-height:1; }
  .flame-of { font-family:'Space Mono',monospace; font-size:.55rem; color:rgba(240,236,228,.35); letter-spacing:.1em; margin-top:4px; }
  .streak-stats { display:flex; gap:12px; flex-wrap:wrap; }
  .stat-pill { background:#0d0d0d; border:1px solid rgba(255,255,255,.07); border-radius:10px; padding:12px 16px; text-align:center; }
  .stat-n { display:block; font-family:'Cormorant Garamond',serif; font-size:1.8rem; font-weight:700; color:#c9a84c; }
  .stat-l { font-family:'Space Mono',monospace; font-size:.5rem; color:rgba(240,236,228,.3); letter-spacing:.1em; }
  .kick-btn { margin-left:auto; background:rgba(231,76,60,.1); border:1px solid rgba(231,76,60,.25); color:#e74c3c; font-family:'Space Mono',monospace; font-size:.58rem; letter-spacing:.08em; padding:8px 16px; cursor:pointer; border-radius:20px; transition:.2s; }
  .kick-btn:hover { background:rgba(231,76,60,.2); }

  .genres-row { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:28px; }
  .genre-tag { background:rgba(201,168,76,.1); border:1px solid rgba(201,168,76,.25); color:#c9a84c; font-family:'Space Mono',monospace; font-size:.55rem; letter-spacing:.08em; padding:4px 12px; border-radius:20px; }
  .temp-tag { background:rgba(93,173,226,.1); border:1px solid rgba(93,173,226,.25); color:#5dade2; font-family:'Space Mono',monospace; font-size:.55rem; letter-spacing:.08em; padding:4px 12px; border-radius:20px; }

  .section-eyebrow { display:flex; align-items:center; gap:12px; font-family:'Space Mono',monospace; font-size:.58rem; letter-spacing:.2em; color:rgba(201,168,76,.7); margin-bottom:16px; }
  .section-eyebrow span { width:28px; height:1px; background:#c9a84c; opacity:.5; }

  .today-section { margin-bottom:36px; }
  .today-movies { display:flex; flex-direction:column; gap:12px; }
  .today-card { position:relative; background:#0d0d0d; border:1px solid rgba(201,168,76,.3); border-radius:16px; padding:20px; overflow:hidden; display:flex; align-items:center; gap:16px; min-height:120px; }
  .today-bg { position:absolute; inset:0; background-size:cover; background-position:center; opacity:.12; filter:blur(4px); }
  .today-bg-fade { position:absolute; inset:0; background:linear-gradient(to right,#0d0d0d 30%,transparent); }
  .today-info { position:relative; z-index:1; display:flex; align-items:center; gap:14px; flex:1; }
  .today-poster { width:60px; height:90px; object-fit:cover; border-radius:6px; flex-shrink:0; }
  .today-title { font-family:'Cormorant Garamond',serif; font-size:1.4rem; font-weight:600; margin-bottom:4px; }
  .today-meta { font-family:'Space Mono',monospace; font-size:.55rem; color:rgba(240,236,228,.4); letter-spacing:.08em; }
  .watched-btn { position:relative; z-index:1; background:#c9a84c; color:#050505; font-family:'Space Mono',monospace; font-size:.62rem; letter-spacing:.1em; font-weight:700; padding:10px 20px; border:none; cursor:pointer; border-radius:20px; transition:.2s; flex-shrink:0; }
  .watched-btn:hover { background:#e8c46a; transform:scale(1.03); }

  .no-today { text-align:center; padding:40px 20px; opacity:.3; }
  .no-today-icon { font-size:2.5rem; margin-bottom:12px; }
  .no-today p { font-family:'Space Mono',monospace; font-size:.65rem; letter-spacing:.08em; }

  /* TIMELINE */
  .timeline-section { margin-top:12px; }
  .timeline { display:flex; flex-direction:column; gap:4px; }
  .timeline-item { display:grid; grid-template-columns:90px 32px 1fr; align-items:center; gap:12px; padding:8px 0; }
  .tl-date { font-family:'Space Mono',monospace; font-size:.52rem; color:rgba(240,236,228,.3); text-align:right; }
  .tl-dot { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:.7rem; color:#050505; font-weight:700; flex-shrink:0; }
  .tl-card { display:flex; align-items:center; gap:10px; background:#0d0d0d; border:1px solid rgba(255,255,255,.06); border-radius:8px; padding:8px 12px; transition:.2s; }
  .tl-card.locked { opacity:.45; }
  .tl-poster { width:32px; height:48px; object-fit:cover; border-radius:4px; flex-shrink:0; }
  .tl-poster-placeholder { width:32px; height:48px; background:#111; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:1rem; flex-shrink:0; }
  .tl-info { flex:1; min-width:0; }
  .tl-title { font-size:.82rem; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .tl-meta { font-family:'Space Mono',monospace; font-size:.5rem; color:rgba(240,236,228,.3); margin-top:2px; }
  .tl-status-badge { font-family:'Space Mono',monospace; font-size:.48rem; letter-spacing:.08em; flex-shrink:0; }

  /* SPIN */
  .spin { width:14px; height:14px; border-radius:50%; border:2px solid rgba(201,168,76,.2); border-top-color:#c9a84c; animation:spin .7s linear infinite; }
  .spin.white { border-color:rgba(5,5,5,.25); border-top-color:#050505; }
  @keyframes spin { to { transform:rotate(360deg); } }

  @media (max-width:640px) {
    .busy-grid { grid-template-columns:1fr; }
    .streak-hdr { gap:16px; }
    .timeline-item { grid-template-columns:70px 28px 1fr; gap:8px; }
    .tl-date { font-size:.45rem; }
  }
</style>