<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';

  const TMDB_KEY = '175b19b3ba717bf4f24e37ee4325be7e';
  const BASE     = 'https://api.themoviedb.org/3';
  const IMG_W300 = 'https://image.tmdb.org/t/p/w300';
  const IMG_W780 = 'https://image.tmdb.org/t/p/w780';

  let me             = $state(null);
  let step           = $state(1);
  let isTemporary    = $state(false);
  let selectedGenres = $state([]);

  let durationPreset = $state(null);
  let durationCustom = $state('');
  let durationError  = $state('');

  let selectedBusyness = $state(null);

  let partnerSearchQ  = $state('');
  let partnerResults  = $state([]);
  let partnerLoading  = $state(false);
  let partnerTimer    = null;
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

  let myStreaks        = $state([]);
  let showInviteOverlay = $state(false);
  let processingInvite  = $state(false);

  let realtimeSub        = null;
  let streakMoviesSub    = null;
  let showKickedPopup    = $state(false);
  let kickedPartnerName  = $state('');
  let pollInterval       = null;

  const TODAY = new Date().toISOString().split('T')[0];

  const ALL_GENRES = [
    { id: 28,    name: 'Action',    emoji: '💥' },
    { id: 12,    name: 'Adventure', emoji: '🗺️' },
    { id: 16,    name: 'Animation', emoji: '🎨' },
    { id: 35,    name: 'Comedy',    emoji: '😂' },
    { id: 80,    name: 'Crime',     emoji: '🔫' },
    { id: 18,    name: 'Drama',     emoji: '🎭' },
    { id: 14,    name: 'Fantasy',   emoji: '🧙' },
    { id: 27,    name: 'Horror',    emoji: '👻' },
    { id: 9648,  name: 'Mystery',   emoji: '🔍' },
    { id: 10749, name: 'Romance',   emoji: '💕' },
    { id: 878,   name: 'Sci-Fi',    emoji: '🚀' },
    { id: 53,    name: 'Thriller',  emoji: '😱' },
    { id: 10752, name: 'War',       emoji: '⚔️' },
    { id: 37,    name: 'Western',   emoji: '🤠' },
  ];

  const DURATION_PRESETS = [
    { label: '10 days',  value: 10,  desc: 'Quick burst' },
    { label: '2 weeks',  value: 14,  desc: 'Short run'   },
    { label: '1 month',  value: 30,  desc: 'Steady pace' },
    { label: '2 months', value: 60,  desc: 'Long haul'   },
    { label: '100 days', value: 100, desc: 'Epic journey' },
  ];

  const BUSYNESS_OPTIONS = [
    { id: 'low',    label: 'Very Busy',     sub: '1 film / week',    icon: '🧳', perWeek: 1   },
    { id: 'medium', label: 'Somewhat Free', sub: '2 films / week',   icon: '⏱️', perWeek: 2   },
    { id: 'free',   label: "I\'m Free!",    sub: '3–4 films / week', icon: '🍿', perWeek: 3.5 },
  ];

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
    // Show all available movies scheduled for today or earlier (unlocked)
    return streakMovies.filter(m => m.status === 'available' && m.scheduled_date <= TODAY);
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

  function statusIcon(s) {
    if (s === 'watched')   return '✓';
    if (s === 'missed')    return '✗';
    if (s === 'available') return '▶';
    return '🔒';
  }

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

    const url = new URL(window.location.href);
    const inviteStreakId = url.searchParams.get('invite');
    if (inviteStreakId) {
      const { data: inviteStreak } = await supabase
        .from('streaks').select('*').eq('id', inviteStreakId).single();
      if (inviteStreak && inviteStreak.partner_id === me.id && inviteStreak.status === 'pending') {
        const { data: creator } = await supabase
          .from('profiles').select('username').eq('id', inviteStreak.creator_id).single();
        activeStreak = { ...inviteStreak, creator_name: creator?.username || 'Someone' };
        showInviteOverlay = true;
      }
    }
  });

  onDestroy(() => {
    realtimeSub?.unsubscribe();
    streakMoviesSub?.unsubscribe();
    clearTimeout(partnerTimer);
    clearInterval(pollInterval);
  });

  async function checkExistingStreak() {
    streakLoading = true;

    const { data: allStreaks } = await supabase
      .from('streaks')
      .select('*')
      .or(`creator_id.eq.${me.id},partner_id.eq.${me.id}`)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: false });

    myStreaks = allStreaks || [];
    streakLoading = false;

    // Check for pending invite where I'm the partner
    const pendingInvite = myStreaks.find(s => s.partner_id === me.id && s.status === 'pending');
    if (pendingInvite) {
      const { data: creator } = await supabase
        .from('profiles').select('username').eq('id', pendingInvite.creator_id).single();
      activeStreak = { ...pendingInvite, creator_name: creator?.username || 'Someone' };
      showInviteOverlay = true;
      subscribeStreak(pendingInvite.id); // still subscribe so we get kick notifications
      return;
    }

    if (myStreaks.length > 0) {
      activeStreak = myStreaks[0];
      await loadStreakMovies(activeStreak.id);
      subscribeStreak(activeStreak.id);
    } else {
      activeStreak = null;
      streakMovies = [];
      createdStreak = null;
      showInviteOverlay = false;
    }

    const { data: broken } = await supabase
      .from('streaks')
      .select('genres, busyness, duration_days')
      .or(`creator_id.eq.${me.id},partner_id.eq.${me.id}`)
      .in('status', ['broken', 'completed'])
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
    myStreaks = myStreaks.map(s => s.id === activeStreak.id ? activeStreak : s);
    streakMovies = streakMovies.map(m => missed.find(mm => mm.id === m.id) ? { ...m, status: 'missed' } : m);

    if (activeStreak.conversation_id) {
      await supabase.from('messages').insert({
        conversation_id: activeStreak.conversation_id,
        sender_id: me.id,
        content: '💔 Your streak is broken! You missed a movie.',
        meta: { type: 'streak_broken', streak_id: activeStreak.id }
      });
    }
  }

  async function syncMoviesFromPartner(streakId) {
    // The partner inserted their own movies. We (the host) copy them.
    const { data: partnerMovies } = await supabase
      .from('streak_movies')
      .select('*')
      .eq('streak_id', streakId)
      .neq('user_id', me.id)
      .order('scheduled_date', { ascending: true });

    if (!partnerMovies || partnerMovies.length === 0) return false;

    const myRows = partnerMovies.map(m => ({
      streak_id:      m.streak_id,
      user_id:        me.id,
      tmdb_id:        m.tmdb_id,
      title:          m.title,
      poster:         m.poster,
      backdrop:       m.backdrop,
      year:           m.year,
      rating:         m.rating,
      scheduled_date: m.scheduled_date,
      status:         m.status,
    }));

    const { error } = await supabase.from('streak_movies').insert(myRows);
    if (error) { console.error('Sync failed:', error); return false; }

    await loadStreakMovies(streakId);
    return true;
  }

  function startPollingMovies(streakId) {
    clearInterval(pollInterval);
    let attempts = 0;
    pollInterval = setInterval(async () => {
      await loadStreakMovies(streakId);
      if (streakMovies.length > 0) {
        clearInterval(pollInterval);
        pollInterval = null;
        return;
      }
      // Partner may have inserted their movies; copy them
      const synced = await syncMoviesFromPartner(streakId);
      if (synced) {
        clearInterval(pollInterval);
        pollInterval = null;
        return;
      }
      if (++attempts >= 20) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    }, 1000);
  }

  function subscribeStreak(streakId) {
    realtimeSub?.unsubscribe();
    streakMoviesSub?.unsubscribe();

    realtimeSub = supabase
      .channel('streak-' + streakId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streaks', filter: `id=eq.${streakId}` }, async (p) => {
        const prev = { ...activeStreak };
        activeStreak = { ...activeStreak, ...p.new };
        myStreaks = myStreaks.map(s => s.id === p.new.id ? { ...s, ...p.new } : s);

        // Partner accepted → dismiss waiting screen for creator
        if (p.new.status === 'active' && prev?.status === 'pending') {
          createdStreak = null;
          waitingPartner = false;
          // Partner inserts only their own movies (RLS). We must copy them.
          startPollingMovies(streakId);
        }

        // I (the partner) was kicked by the creator
        if (
          p.new.partner_status === 'kicked' &&
          prev?.partner_id === me.id &&
          (p.new.partner_id === null || p.new.partner_id !== me.id)
        ) {
          kickedPartnerName = '';
          showKickedPopup = true;
          myStreaks = myStreaks.filter(s => s.id !== streakId);
          activeStreak = myStreaks.length > 0 ? myStreaks[0] : null;
          showInviteOverlay = false;
          realtimeSub?.unsubscribe();
          streakMoviesSub?.unsubscribe();
          clearInterval(pollInterval);
          if (activeStreak) {
            await loadStreakMovies(activeStreak.id);
            subscribeStreak(activeStreak.id);
          } else {
            streakMovies = [];
          }
        }
      })
      .subscribe();

    // Watch for new streak_movies rows — fire when partner inserts movies for both users
    streakMoviesSub = supabase
      .channel('streak-movies-' + streakId + '-' + (me?.id || ''))
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'streak_movies',
        filter: `streak_id=eq.${streakId}`
      }, async (p) => {
        // ALWAYS reload on any insert for this streak.
        // The partner inserts only their own rows (RLS). We copy them via polling.
        await loadStreakMovies(streakId);
        if (pollInterval && streakMovies.length > 0) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      })
      .subscribe();
  }

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

  function toggleGenre(g) {
    const idx = selectedGenres.findIndex(s => s.id === g.id);
    if (idx >= 0) {
      selectedGenres = selectedGenres.filter(s => s.id !== g.id);
    } else {
      if (selectedGenres.length < 3) selectedGenres = [...selectedGenres, g];
    }
  }

  function isGenreSelected(g) { return selectedGenres.some(s => s.id === g.id); }

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

  async function fetchMoviesForStreak(genreIds, total) {
    const movies = []; const seen = new Set();
    const genreParam = genreIds.length > 0 ? `&with_genres=${genreIds.join(',')}` : '';
    for (let page = 1; page <= 6 && movies.length < total * 3; page++) {
      try {
        const res = await fetch(
          `${BASE}/discover/movie?api_key=${TMDB_KEY}` +
          `${genreParam}&sort_by=popularity.desc&vote_count.gte=200&vote_average.gte=5.0&page=${page}`
        ).then(r => r.json());
        (res.results || []).forEach(m => {
          if (!seen.has(m.id) && m.poster_path) { seen.add(m.id); movies.push(m); }
        });
      } catch (_) {}
    }
    // Fallback to trending if not enough movies
    if (movies.length < total) {
      try {
        const res = await fetch(`${BASE}/trending/movie/week?api_key=${TMDB_KEY}`).then(r => r.json());
        (res.results || []).forEach(m => {
          if (!seen.has(m.id) && m.poster_path) { seen.add(m.id); movies.push(m); }
        });
      } catch (_) {}
    }
    const sorted = [...movies].sort((a, b) => b.popularity - a.popularity);
    const top    = sorted.slice(0, Math.floor(sorted.length * 0.4));
    const mid    = sorted.slice(Math.floor(sorted.length * 0.4));
    const mixed  = [];
    const actualTotal = Math.min(total, movies.length);
    for (let i = 0; i < actualTotal; i++) {
      const useTp = Math.random() < 0.45 && top.length > 0;
      const pool  = useTp ? top : (mid.length > 0 ? mid : top);
      if (!pool.length) break;
      const idx = Math.floor(Math.random() * pool.length);
      mixed.push(pool.splice(idx, 1)[0]);
    }
    return mixed;
  }

  function distributeDates(count, duration, startDateStr) {
    const days = Array.from({ length: duration }, (_, i) => i);
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

  async function createStreak() {
    if (creating) return;

    const { data: currentStreaks } = await supabase
      .from('streaks').select('id')
      .or(`creator_id.eq.${me.id},partner_id.eq.${me.id}`)
      .in('status', ['active', 'pending']);

    if ((currentStreaks || []).length >= 3) {
      alert('You can only have 3 active streaks at a time.');
      myStreaks = currentStreaks || [];
      return;
    }

    creating = true;
    const duration = getDuration();
    const bOpt     = BUSYNESS_OPTIONS.find(b => b.id === selectedBusyness);
    const total    = Math.max(3, Math.round((duration / 7) * (bOpt?.perWeek || 2)));
    const genreIds = selectedGenres.map(g => g.id);
    const startStr = new Date().toISOString().split('T')[0]; // start TODAY
    const endStr   = (() => { const d = new Date(startStr); d.setDate(d.getDate() + duration - 1); return d.toISOString().split('T')[0]; })();

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

    if (!selectedPartner) {
      const movies = await fetchMoviesForStreak(genreIds, total);
      const dates  = distributeDates(movies.length, duration, startStr);
      const rows   = movies.slice(0, dates.length).map((m, i) => ({
        streak_id: streak.id, user_id: me.id, tmdb_id: m.id, title: m.title,
        poster:   m.poster_path   ? IMG_W300 + m.poster_path   : null,
        backdrop: m.backdrop_path ? IMG_W780 + m.backdrop_path : null,
        year: (m.release_date || '').slice(0, 4), rating: m.vote_average,
        scheduled_date: dates[i],
        status: dates[i] <= startStr ? 'available' : 'locked',
      }));
      await supabase.from('streak_movies').insert(rows);
    }

    if (selectedPartner && convId) {
      await supabase.from('messages').insert({
        conversation_id: convId,
        sender_id: me.id,
        content: `🔥 @${me.username} invited you to a Movie Streak! ${duration} days · ${selectedGenres.map(g=>g.name).join(', ')} · ${bOpt?.label}`,
        meta: {
          type: 'streak_request', streak_id: streak.id,
          from_user: me.id, from_name: me.username,
          genres: selectedGenres.map(g => g.name), duration, busyness: selectedBusyness,
        }
      });
    }

    createdStreak  = streak;
    activeStreak   = streak;
    myStreaks      = [streak, ...myStreaks];
    waitingPartner = !!selectedPartner;
    creating       = false;

    if (!selectedPartner) await loadStreakMovies(streak.id);
    subscribeStreak(streak.id);
  }

  async function cancelStreak() {
    if (!activeStreak) return;
    if (!confirm('Cancel this streak? This cannot be undone.')) return;

    const streakId = activeStreak.id;
    const convId   = activeStreak.conversation_id;

    realtimeSub?.unsubscribe();
    realtimeSub = null;
    streakMoviesSub?.unsubscribe();
    clearInterval(pollInterval);

    const { error } = await supabase
      .from('streaks').update({ status: 'declined', partner_status: 'declined' }).eq('id', streakId);

    if (error) { console.error('Cancel failed:', error); alert('Failed to cancel: ' + error.message); return; }

    if (convId) {
      await supabase.from('messages').insert({
        conversation_id: convId, sender_id: me.id,
        content: `🚫 @${me.username} cancelled the streak.`,
        meta: { type: 'streak_cancelled', streak_id: streakId }
      });
    }

    myStreaks = myStreaks.filter(s => s.id !== streakId);

    if (myStreaks.length > 0) {
      activeStreak = myStreaks[0];
      await loadStreakMovies(activeStreak.id);
      subscribeStreak(activeStreak.id);
    } else {
      activeStreak = null; streakMovies = []; createdStreak = null; showInviteOverlay = false;
    }
  }

  // Generate movies for BOTH users on accept
  async function acceptInvite() {
    if (!activeStreak || processingInvite) return;
    processingInvite = true;

    const streak = activeStreak;
    // Use TODAY as start so movies are immediately visible
    const startStr = new Date().toISOString().split('T')[0];
    const endDate  = new Date(startStr);
    endDate.setDate(endDate.getDate() + streak.duration_days - 1);

    // 1. Update streak status
    const { error: streakErr } = await supabase.from('streaks').update({
      partner_status: 'accepted',
      status: 'active',
      start_date: startStr,
      end_date: endDate.toISOString().split('T')[0]
    }).eq('id', streak.id);

    if (streakErr) {
      console.error('Streak update failed:', streakErr);
      processingInvite = false;
      return;
    }

    // 2. Genre IDs
    const GENRE_MAP = {
      'Action':28,'Adventure':12,'Animation':16,'Comedy':35,'Crime':80,'Drama':18,
      'Fantasy':14,'Horror':27,'Mystery':9648,'Romance':10749,'Sci-Fi':878,'Thriller':53,'War':10752,'Western':37
    };
    const genreIds = (streak.genres || []).map(g => GENRE_MAP[g]).filter(Boolean);
    const BUSY_MAP = { low: 1, medium: 2, free: 3.5 };
    const total    = Math.max(4, Math.round((streak.duration_days / 7) * (BUSY_MAP[streak.busyness] || 2)));

    // 3. Fetch movies with 3 fallback strategies
    const movies = [];
    const seen   = new Set();

    // Strategy A: by genre
    if (genreIds.length > 0) {
      for (let pg = 1; pg <= 4 && movies.length < total * 2; pg++) {
        try {
          const r = await fetch(
            `${BASE}/discover/movie?api_key=${TMDB_KEY}&with_genres=${genreIds.join(',')}&sort_by=popularity.desc&vote_count.gte=100&page=${pg}`
          ).then(r => r.json());
          (r.results || []).filter(m => m.poster_path).forEach(m => {
            if (!seen.has(m.id)) { seen.add(m.id); movies.push(m); }
          });
        } catch (_) {}
      }
    }

    // Strategy B: popular (no genre filter)
    for (let pg = 1; pg <= 3 && movies.length < total * 2; pg++) {
      try {
        const r = await fetch(
          `${BASE}/discover/movie?api_key=${TMDB_KEY}&sort_by=popularity.desc&vote_count.gte=500&page=${pg}`
        ).then(r => r.json());
        (r.results || []).filter(m => m.poster_path).forEach(m => {
          if (!seen.has(m.id)) { seen.add(m.id); movies.push(m); }
        });
      } catch (_) {}
    }

    // Strategy C: trending
    if (movies.length < total) {
      try {
        const r = await fetch(`${BASE}/trending/movie/week?api_key=${TMDB_KEY}`).then(r => r.json());
        (r.results || []).filter(m => m.poster_path).forEach(m => {
          if (!seen.has(m.id)) { seen.add(m.id); movies.push(m); }
        });
      } catch (_) {}
    }

    // 4. Pick movies mixing popular and mid-tier
    const sorted   = [...movies].sort((a, b) => b.popularity - a.popularity);
    const topPool  = [...sorted.slice(0, Math.ceil(sorted.length * 0.4))];
    const midPool  = [...sorted.slice(Math.ceil(sorted.length * 0.4))];
    const picked   = [];
    const needed   = Math.min(total, movies.length);

    for (let i = 0; i < needed; i++) {
      const useTop = Math.random() < 0.4 && topPool.length > 0;
      const pool   = useTop ? topPool : (midPool.length > 0 ? midPool : topPool);
      if (!pool.length) break;
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }

    // 5. Distribute dates — day 0 = today (available), rest are locked future days
    const offsets = Array.from({ length: streak.duration_days }, (_, i) => i);
    for (let i = offsets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [offsets[i], offsets[j]] = [offsets[j], offsets[i]];
    }
    const chosen = offsets.slice(0, picked.length).sort((a, b) => a - b);

    // 6. Build DB rows for a user
    function buildRows(userId) {
      return picked.map((m, i) => {
        const d = new Date(startStr);
        d.setDate(d.getDate() + chosen[i]);
        const ds = d.toISOString().split('T')[0];
        return {
          streak_id:      streak.id,
          user_id:        userId,
          tmdb_id:        m.id,
          title:          m.title,
          poster:         m.poster_path   ? `${IMG_W300}${m.poster_path}`   : null,
          backdrop:       m.backdrop_path ? `${IMG_W780}${m.backdrop_path}` : null,
          year:           (m.release_date || '').slice(0, 4),
          rating:         m.vote_average,
          scheduled_date: ds,
          status:         ds <= startStr ? 'available' : 'locked',
        };
      });
    }

    // 7. Insert ONLY my rows (RLS prevents inserting for creator)
    if (picked.length > 0) {
      const { error: insErr } = await supabase
        .from('streak_movies')
        .insert(buildRows(me.id));
      if (insErr) {
        console.error('Insert error:', insErr);
      }
    }

    // 8. Send chat notification
    if (streak.conversation_id) {
      await supabase.from('messages').insert({
        conversation_id: streak.conversation_id,
        sender_id:       me.id,
        content:         `✅ @${me.username} joined the streak! 🔥 ${picked.length} movies are ready!`,
        meta:            { type: 'streak_accepted', streak_id: streak.id }
      });
    }

    // 9. Update local state immediately
    showInviteOverlay  = false;
    const updatedStreak = { ...streak, status: 'active', start_date: startStr, partner_status: 'accepted' };
    activeStreak = updatedStreak;
    myStreaks    = myStreaks.map(s => s.id === streak.id ? updatedStreak : s);

    // 10. Reload movies from DB to confirm insert worked
    await loadStreakMovies(streak.id);
    subscribeStreak(streak.id);
    processingInvite = false;
  }

  async function declineInvite() {
    if (!activeStreak || processingInvite) return;
    processingInvite = true;

    await supabase.from('streaks').update({ partner_status: 'declined', status: 'declined' }).eq('id', activeStreak.id);

    if (activeStreak.conversation_id) {
      await supabase.from('messages').insert({
        conversation_id: activeStreak.conversation_id,
        sender_id: me.id,
        content: `❌ @${me.username} declined the streak request.`,
        meta: { type: 'streak_declined', streak_id: activeStreak.id }
      });
    }

    myStreaks = myStreaks.filter(s => s.id !== activeStreak.id);
    activeStreak = myStreaks.length > 0 ? myStreaks[0] : null;
    showInviteOverlay = false;
    processingInvite = false;

    if (activeStreak) {
      await loadStreakMovies(activeStreak.id);
      subscribeStreak(activeStreak.id);
    }
  }

  async function switchStreak(streak) {
    activeStreak = streak;
    showInviteOverlay = streak.partner_id === me.id && streak.status === 'pending';
    streakMovies = [];
    if (!showInviteOverlay) {
      await loadStreakMovies(streak.id);
      subscribeStreak(streak.id);
    }
  }

  async function startSolo() {
    if (!activeStreak) return;
    const duration = activeStreak.duration_days;
    const bOpt     = BUSYNESS_OPTIONS.find(b => b.id === activeStreak.busyness);
    const total    = Math.max(4, Math.round((duration / 7) * (bOpt?.perWeek || 2)));
    const genreIds = ALL_GENRES.filter(g => (activeStreak.genres || []).includes(g.name)).map(g => g.id);
    const startStr = new Date().toISOString().split('T')[0];
    const endDate  = new Date(startStr); endDate.setDate(endDate.getDate() + duration - 1);

    // Update DB
    await supabase.from('streaks').update({
      status: 'active', partner_id: null, partner_status: 'kicked',
      start_date: startStr, end_date: endDate.toISOString().split('T')[0],
    }).eq('id', activeStreak.id);

    // Fetch & insert movies
    const movies = await fetchMoviesForStreak(genreIds, total);
    const dates  = distributeDates(movies.length, duration, startStr);
    const rows   = movies.slice(0, dates.length).map((m, i) => ({
      streak_id: activeStreak.id, user_id: me.id, tmdb_id: m.id, title: m.title,
      poster:   m.poster_path   ? IMG_W300 + m.poster_path   : null,
      backdrop: m.backdrop_path ? IMG_W780 + m.backdrop_path : null,
      year: (m.release_date || '').slice(0, 4), rating: m.vote_average,
      scheduled_date: dates[i], status: dates[i] <= startStr ? 'available' : 'locked',
    }));
    await supabase.from('streak_movies').insert(rows);

    // Update state immediately
    const updatedStreak = { ...activeStreak, status: 'active', start_date: startStr, partner_id: null, partner_status: 'kicked' };
    activeStreak = updatedStreak;
    myStreaks = myStreaks.map(s => s.id === updatedStreak.id ? updatedStreak : s);
    createdStreak = null;
    waitingPartner = false;
    await loadStreakMovies(activeStreak.id);
    subscribeStreak(activeStreak.id);
  }

  // ONLY host (creator) can kick partner
  async function kickPartner() {
    if (!activeStreak) return;
    if (activeStreak.creator_id !== me.id) return; // guard: only creator

    // Get partner username for the popup
    let partnerUsername = 'your partner';
    if (activeStreak.partner_id) {
      const { data: partnerProfile } = await supabase
        .from('profiles').select('username').eq('id', activeStreak.partner_id).single();
      partnerUsername = partnerProfile?.username || 'your partner';
    }

    await supabase.from('streaks').update({ partner_id: null, partner_status: 'kicked' }).eq('id', activeStreak.id);
    activeStreak = { ...activeStreak, partner_id: null, partner_status: 'kicked' };
    myStreaks = myStreaks.map(s => s.id === activeStreak.id ? activeStreak : s);

    // Show kicked popup
    kickedPartnerName = partnerUsername;
    showKickedPopup = true;

    if (activeStreak.status === 'pending') await startSolo();
  }

  async function markWatched(movie) {
    if (movie.status !== 'available') return;
    const now = new Date().toISOString();
    await supabase.from('streak_movies').update({ status: 'watched', watched_at: now }).eq('id', movie.id);
    streakMovies = streakMovies.map(m => m.id === movie.id ? { ...m, status: 'watched', watched_at: now } : m);
    if (streakMovies.filter(m => m.status !== 'watched').length === 0) {
      await supabase.from('streaks').update({ status: 'completed' }).eq('id', activeStreak.id);
      activeStreak = { ...activeStreak, status: 'completed' };
      myStreaks = myStreaks.map(s => s.id === activeStreak.id ? activeStreak : s);
    }
  }

  function restartFromTaste() {
    if (!previousTaste) return;
    selectedGenres   = ALL_GENRES.filter(g => (previousTaste.genres || []).includes(g.name));
    selectedBusyness = previousTaste.busyness || null;
    const preset     = DURATION_PRESETS.find(p => p.value === previousTaste.duration_days);
    if (preset) { durationPreset = preset.value; durationCustom = ''; }
    else { durationPreset = null; durationCustom = String(previousTaste.duration_days || ''); }
    activeStreak = null; createdStreak = null; step = 1;
  }

  function startFresh() {
    activeStreak = null; createdStreak = null;
    selectedGenres = []; selectedBusyness = null;
    durationPreset = null; durationCustom = '';
    step = 1;
  }

  // Progress percent for active streak
  let progressPercent = $derived.by(() => {
    if (!activeStreak?.duration_days) return 0;
    const day = streakDay();
    return Math.min(100, Math.round((day / activeStreak.duration_days) * 100));
  });

</script>

<div class="grain"></div>

<!-- NAV -->
<nav class="nav">
  <button class="nav-back" onclick={() => goto('/app/chat')}>
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    BACK TO CHAT
  </button>

  <div class="nav-logo">
    <span class="logo-flame">🔥</span>
    <span class="logo-text">Streak</span>
    <span class="logo-mode">{isTemporary ? 'TEMP' : 'LIVE'}</span>
  </div>

  {#if myStreaks.length > 0}
    <div class="nav-count">
      <span>{myStreaks.length}</span>/3
    </div>
  {:else}
    <div style="width:80px"></div>
  {/if}
</nav>

<main class="page">

  {#if streakLoading}
    <div class="full-center">
      <div class="loader">
        <div class="loader-ring"></div>
        <div class="loader-ring r2"></div>
        <span class="loader-icon">🔥</span>
      </div>
    </div>

  {:else if activeStreak && !createdStreak}

    <!-- STREAK TABS -->
    {#if myStreaks.length > 1}
      <div class="streak-tabs">
        {#each myStreaks as s}
          <button class="stab {activeStreak?.id === s.id ? 'stab-active' : ''}" onclick={() => switchStreak(s)}>
            <span class="stab-fire">🔥</span>
            <span class="stab-label">{s.genres?.[0] || 'Streak'}</span>
            {#if s.partner_id === me.id && s.status === 'pending'}
              <span class="stab-dot"></span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}

    <!-- BROKEN -->
    {#if activeStreak.status === 'broken'}
      <div class="status-screen">
        <div class="ss-icon-wrap ss-broken">
          <div class="ss-ring"></div>
          <span class="ss-icon">💔</span>
        </div>
        <h1 class="ss-title">Streak Broken</h1>
        <p class="ss-sub">You missed a movie. Your streak ended on day {Math.max(0, streakDay() - 1)}.</p>
        <div class="ss-genre-tags">
          {#each (activeStreak.genres || []) as g}
            <span class="ss-gtag">{g}</span>
          {/each}
        </div>
        <div class="ss-actions">
          {#if hasPrevTaste}
            <button class="btn-primary" onclick={restartFromTaste}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Restart from My Taste
            </button>
          {/if}
          <button class="btn-secondary" onclick={startFresh}>Start Fresh</button>
          <button class="btn-danger" onclick={cancelStreak}>Remove Streak</button>
        </div>
      </div>

    <!-- COMPLETED -->
    {:else if activeStreak.status === 'completed'}
      <div class="status-screen">
        <div class="ss-icon-wrap ss-complete">
          <div class="ss-ring"></div>
          <span class="ss-icon">🏆</span>
        </div>
        <h1 class="ss-title">Streak Complete!</h1>
        <p class="ss-sub">You watched all {watchedCount()} movies over {activeStreak.duration_days} days. Legendary!</p>
        <div class="ss-actions">
          {#if hasPrevTaste}
            <button class="btn-primary" onclick={restartFromTaste}>🔁 Go Again (Same Taste)</button>
          {/if}
          <button class="btn-secondary" onclick={startFresh}>New Streak</button>
          <button class="btn-danger" onclick={cancelStreak}>Remove</button>
        </div>
      </div>

    <!-- WAITING (creator) -->
    {:else if activeStreak.status === 'pending' && activeStreak.creator_id === me.id}
      <div class="status-screen">
        <div class="ss-icon-wrap ss-pending">
          <div class="ss-ring ss-ring-pulse"></div>
          <span class="ss-icon">📨</span>
        </div>
        <h1 class="ss-title">Waiting for Partner</h1>
        <p class="ss-sub">Streak invitation sent. Once <strong>@{activeStreak.partner_id ? 'your partner' : '...'}</strong> accepts, the streak starts automatically.</p>
        <div class="ss-genre-tags">
          {#each (activeStreak.genres || []) as g}
            <span class="ss-gtag">{g}</span>
          {/each}
          <span class="ss-gtag dur">{activeStreak.duration_days} days</span>
        </div>
        <div class="ss-actions">
          <button class="btn-primary" onclick={kickPartner}>
            🚀 Start Solo (Kick Partner)
          </button>
          <button class="btn-danger" onclick={cancelStreak}>Cancel Streak</button>
        </div>
      </div>

    <!-- ACTIVE (or pending invite for me) -->
    {:else if activeStreak.status === 'active' || (activeStreak.status === 'pending' && activeStreak.partner_id === me.id)}
      <div class="active-layout" class:blurred={showInviteOverlay}>

        <!-- HERO STATS PANEL -->
        <div class="hero-panel">
          <div class="hero-bg">
            {#if streakMovies.find(m => m.status === 'available' || m.status === 'watched')?.backdrop}
              <div class="hero-backdrop" style="background-image:url({streakMovies.find(m=>m.backdrop)?.backdrop})"></div>
              <div class="hero-backdrop-fade"></div>
            {/if}
            <div class="hero-particles">
              {#each Array(6) as _, i}
                <div class="particle p{i}">🔥</div>
              {/each}
            </div>
          </div>

          <div class="hero-content">
            <div class="hero-left">
              <div class="hero-day-wrap">
                <div class="hero-day-label">DAY</div>
                <div class="hero-day-num">{streakDay()}</div>
                <div class="hero-day-of">of {activeStreak.duration_days}</div>
              </div>
              <div class="hero-fire">🔥</div>
            </div>

            <div class="hero-right">
              <div class="hero-stats-grid">
                <div class="hstat">
                  <div class="hstat-n">{watchedCount()}</div>
                  <div class="hstat-l">Watched</div>
                </div>
                <div class="hstat">
                  <div class="hstat-n">{totalCount() - watchedCount()}</div>
                  <div class="hstat-l">Left</div>
                </div>
                <div class="hstat">
                  <div class="hstat-n">{Math.max(0, activeStreak.duration_days - streakDay() + 1)}</div>
                  <div class="hstat-l">Days Left</div>
                </div>
              </div>

              <!-- Progress bar -->
              <div class="hero-progress-wrap">
                <div class="hero-progress-bar">
                  <div class="hero-progress-fill" style="width:{progressPercent}%"></div>
                  <div class="hero-progress-glow" style="left:{progressPercent}%"></div>
                </div>
                <span class="hero-progress-label">{progressPercent}% complete</span>
              </div>

              <!-- Genre tags -->
              <div class="hero-genres">
                {#each (activeStreak.genres || []) as g}
                  <span class="hero-gtag">{g}</span>
                {/each}
                {#if activeStreak.is_temporary}
                  <span class="hero-gtag temp">⚡ TEMP</span>
                {/if}
              </div>
            </div>
          </div>

          <!-- Actions in hero -->
          <div class="hero-actions">
            {#if activeStreak.creator_id === me.id && activeStreak.partner_id}
              <button class="hero-kick" onclick={kickPartner}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Kick Partner
              </button>
            {/if}
            <button class="hero-cancel" onclick={cancelStreak}>✕ Cancel</button>
          </div>
        </div>

        <!-- TODAY'S MOVIES -->
        {#if todaysMovies().length > 0}
          <div class="section">
            <div class="section-hdr">
              <div class="section-eyebrow">WATCH TODAY</div>
              <div class="section-dot"></div>
            </div>
            <div class="today-cards">
              {#each todaysMovies() as movie}
                <div class="today-card">
                  {#if movie.backdrop}
                    <div class="tc-bg" style="background-image:url({movie.backdrop})"></div>
                    <div class="tc-bg-fade"></div>
                  {/if}
                  <div class="tc-body">
                    <div class="tc-left">
                      {#if movie.poster}
                        <img class="tc-poster" src={movie.poster} alt={movie.title} />
                      {:else}
                        <div class="tc-poster-ph">🎬</div>
                      {/if}
                      <div class="tc-info">
                        <div class="tc-title">{movie.title}</div>
                        <div class="tc-meta">
                          <span>{movie.year}</span>
                          <span class="tc-dot-sep">·</span>
                          <span class="tc-rating">★ {movie.rating?.toFixed(1)}</span>
                        </div>
                        <div class="tc-badge-today">TODAY</div>
                      </div>
                    </div>
                    <button class="tc-watched" onclick={() => markWatched(movie)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      Mark Watched
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <div class="no-today">
            <span>📅</span>
            <span>No movies scheduled today. Enjoy the break!</span>
          </div>
        {/if}

        <!-- FULL SCHEDULE -->
        <div class="section">
          <div class="section-hdr">
            <div class="section-eyebrow">FULL SCHEDULE</div>
            <div class="section-count">{totalCount()} movies</div>
          </div>
          <div class="timeline">
            {#each streakMovies as movie, idx}
              <div class="tl-item" class:tl-locked={movie.status === 'locked'}>
                <div class="tl-spine">
                  <div class="tl-node" style="background:{statusColor(movie.status)};border-color:{statusColor(movie.status)}">
                    <span class="tl-node-icon">{statusIcon(movie.status)}</span>
                  </div>
                  {#if idx < streakMovies.length - 1}
                    <div class="tl-line" class:tl-line-done={movie.status === 'watched'}></div>
                  {/if}
                </div>
                <div class="tl-card">
                  <div class="tl-date-badge">{movie.scheduled_date}</div>
                  {#if movie.status !== 'locked'}
                    {#if movie.poster}
                      <img class="tl-poster" src={movie.poster} alt={movie.title} />
                    {/if}
                    <div class="tl-info">
                      <div class="tl-title">{movie.title}</div>
                      <div class="tl-meta">{movie.year} · ★ {movie.rating?.toFixed(1)}</div>
                    </div>
                    <div class="tl-status-pill" style="color:{statusColor(movie.status)};background:{statusColor(movie.status)}18;border-color:{statusColor(movie.status)}40">
                      {movie.status.toUpperCase()}
                    </div>
                  {:else}
                    <div class="tl-lock-icon">🔒</div>
                    <div class="tl-info">
                      <div class="tl-title locked-text">Unlocks on {movie.scheduled_date}</div>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- INVITE OVERLAY -->
      {#if showInviteOverlay}
        {@const inviteBusyness = BUSYNESS_OPTIONS.find(x => x.id === activeStreak.busyness)}
        <div class="invite-overlay">
          <div class="invite-card">
            <div class="ic-aura"></div>
            <div class="ic-header">
              <div class="ic-fire-wrap">
                <div class="ic-fire-ring r1"></div>
                <div class="ic-fire-ring r2"></div>
                <span class="ic-fire">🔥</span>
              </div>
              <div class="ic-from-badge">FROM @{activeStreak.creator_name || 'Someone'}</div>
            </div>
            <div class="ic-title">Streak Invitation</div>
            <p class="ic-sub">You've been invited to join a movie streak challenge!</p>
            <div class="ic-details">
              <div class="ic-detail">
                <span class="ic-detail-label">GENRES</span>
                <div class="ic-pills">
                  {#each (activeStreak.genres || []) as g}
                    <span class="ic-pill">{g}</span>
                  {/each}
                </div>
              </div>
              <div class="ic-detail">
                <span class="ic-detail-label">DURATION</span>
                <span class="ic-detail-val">{activeStreak.duration_days} days</span>
              </div>
              {#if inviteBusyness}
                <div class="ic-detail">
                  <span class="ic-detail-label">PACE</span>
                  <span class="ic-detail-val">{inviteBusyness.icon} {inviteBusyness.sub}</span>
                </div>
              {/if}
            </div>
            <div class="ic-btns">
              <button class="ic-decline" disabled={processingInvite} onclick={declineInvite}>
                {processingInvite ? '…' : '✕  Decline'}
              </button>
              <button class="ic-accept" disabled={processingInvite} onclick={acceptInvite}>
                {#if processingInvite}
                  <div class="spin-sm"></div> Joining…
                {:else}
                  🔥  Join Streak
                {/if}
              </button>
            </div>
          </div>
        </div>
      {/if}
    {/if}

  {:else if createdStreak}
    <!-- CREATED STATE -->
    <div class="status-screen">
      <div class="ss-icon-wrap {waitingPartner ? 'ss-pending' : 'ss-complete'}">
        <div class="ss-ring {waitingPartner ? 'ss-ring-pulse' : ''}"></div>
        <span class="ss-icon">{waitingPartner ? '📨' : '🎬'}</span>
      </div>
      <h1 class="ss-title">{waitingPartner ? 'Invitation Sent!' : 'Streak Started!'}</h1>
      {#if waitingPartner}
        <p class="ss-sub">Sent to @{selectedPartner?.username}. Once they accept, the streak kicks off automatically!</p>
        <div class="ss-actions">
          <button class="btn-primary" onclick={startSolo}>🚀 Start Solo Now</button>
          <button class="btn-secondary" onclick={() => goto('/app/chat')}>Back to Chat</button>
          <button class="btn-danger" onclick={cancelStreak}>Cancel Streak</button>
        </div>
      {:else}
        <p class="ss-sub">Your streak is live! Come back tomorrow for your first film.</p>
        <div class="ss-actions">
          <button class="btn-primary" onclick={() => createdStreak = null}>🔥 View My Streak</button>
          <button class="btn-danger" onclick={cancelStreak}>Cancel Streak</button>
        </div>
      {/if}
    </div>

  {:else}
    <!-- WIZARD -->
    <div class="wizard">

      <!-- WIZARD HEADER -->
      <div class="wiz-header">
        <div class="wiz-title-group">
          <h1 class="wiz-big-title">New Streak</h1>
          <div class="wiz-type-toggle">
            <button class="wtype {!isTemporary ? 'wtype-on' : ''}" onclick={() => isTemporary = false}>
              🔥 Real
            </button>
            <button class="wtype {isTemporary ? 'wtype-on' : ''}" onclick={() => isTemporary = true}>
              ⚡ Temp
            </button>
          </div>
        </div>
        {#if isTemporary}
          <p class="wiz-temp-note">Temporary streaks won't affect your taste profile</p>
        {/if}
        {#if myStreaks.length > 0}
          <div class="wiz-limit">
            <div class="wiz-limit-dots">
              {#each [0,1,2] as i}
                <div class="wld {i < myStreaks.length ? 'wld-on' : ''}"></div>
              {/each}
            </div>
            <span>{myStreaks.length}/3 active streaks</span>
          </div>
        {/if}
      </div>

      <!-- STEP PROGRESS -->
      <div class="step-progress">
        {#each ['Genre','Duration','Pace','Partner'] as label, i}
          {@const s = i + 1}
          <div class="sp-item">
            <div class="sp-dot {step > s ? 'sp-done' : step === s ? 'sp-cur' : ''}">
              {step > s ? '✓' : s}
            </div>
            <div class="sp-label {step === s ? 'sp-label-cur' : ''}">{label}</div>
          </div>
          {#if i < 3}
            <div class="sp-line {step > s ? 'sp-line-done' : ''}"></div>
          {/if}
        {/each}
      </div>

      <!-- STEP CARDS -->
      <div class="step-card">
        {#if step === 1}
          <!-- GENRE STEP -->
          <div class="step-eyebrow">STEP 1 OF 4</div>
          <h2 class="step-title">What's your vibe?</h2>
          <p class="step-desc">Pick up to 3 genres for your streak</p>
          <div class="genres-grid">
            {#each ALL_GENRES as g}
              {@const sel = isGenreSelected(g)}
              {@const disabled = !sel && selectedGenres.length >= 3}
              <button
                class="genre-btn {sel ? 'genre-sel' : ''} {disabled ? 'genre-dis' : ''}"
                onclick={() => toggleGenre(g)}
              >
                <span class="genre-emoji">{g.emoji}</span>
                <span class="genre-name">{g.name}</span>
                {#if sel}
                  <span class="genre-check">✓</span>
                {/if}
              </button>
            {/each}
          </div>
          <div class="sel-hint">{selectedGenres.length}/3 selected</div>

        {:else if step === 2}
          <!-- DURATION STEP -->
          <div class="step-eyebrow">STEP 2 OF 4</div>
          <h2 class="step-title">How long?</h2>
          <p class="step-desc">10 days minimum, 100 days maximum</p>
          <div class="presets-grid">
            {#each DURATION_PRESETS as p}
              <button
                class="preset-card {durationPreset === p.value ? 'preset-sel' : ''}"
                onclick={() => { durationPreset = p.value; durationCustom = ''; durationError = ''; }}
              >
                <div class="preset-label">{p.label}</div>
                <div class="preset-desc">{p.desc}</div>
              </button>
            {/each}
          </div>
          <div class="or-divider"><span>or enter custom</span></div>
          <div class="custom-input-row">
            <input
              class="custom-inp"
              type="number" min="10" max="100"
              placeholder="e.g. 45"
              value={durationCustom}
              oninput={(e) => { durationCustom = e.target.value; durationPreset = null; durationError = ''; }}
            />
            <span class="custom-unit">days</span>
          </div>
          {#if durationError}
            <p class="field-err">{durationError}</p>
          {/if}
          {#if getDuration()}
            <div class="duration-preview">
              <span class="dp-label">Your streak:</span>
              <strong class="dp-val">{getDuration()} days</strong>
              <span class="dp-end">— ends {(() => {
                const d = new Date(); d.setDate(d.getDate() + getDuration());
                return d.toLocaleDateString([], { month:'short', day:'numeric', year:'numeric' });
              })()}</span>
            </div>
          {/if}

        {:else if step === 3}
          <!-- PACE STEP -->
          <div class="step-eyebrow">STEP 3 OF 4</div>
          <h2 class="step-title">How busy are you?</h2>
          <p class="step-desc">Sets how many movies per week you'll get</p>
          <div class="busy-cards">
            {#each BUSYNESS_OPTIONS as b}
              <button
                class="busy-card {selectedBusyness === b.id ? 'busy-sel' : ''}"
                onclick={() => selectedBusyness = b.id}
              >
                <div class="bc-icon">{b.icon}</div>
                <div class="bc-body">
                  <div class="bc-label">{b.label}</div>
                  <div class="bc-sub">{b.sub}</div>
                </div>
                {#if selectedBusyness === b.id}
                  <div class="bc-check">✓</div>
                {/if}
              </button>
            {/each}
          </div>
          {#if selectedBusyness && getDuration()}
            {@const bOpt = BUSYNESS_OPTIONS.find(b => b.id === selectedBusyness)}
            {@const total = Math.round((getDuration() / 7) * bOpt.perWeek)}
            <div class="duration-preview">
              ~<strong class="dp-val">{total} movies</strong>
              <span class="dp-end">over {getDuration()} days</span>
            </div>
          {/if}

        {:else if step === 4}
          <!-- PARTNER STEP -->
          <div class="step-eyebrow">STEP 4 OF 4</div>
          <h2 class="step-title">Invite a partner?</h2>
          <p class="step-desc">Optional — you can always streak solo</p>

          {#if selectedPartner}
            <div class="sel-partner-card">
              <div class="sp-avatar">{selectedPartner.username.slice(0,2).toUpperCase()}</div>
              <div class="sp-info">
                <div class="sp-name">@{selectedPartner.username}</div>
                <div class="sp-sub">Will receive an invite in chat</div>
              </div>
              <button class="sp-remove" onclick={() => selectedPartner = null}>✕</button>
            </div>
          {:else}
            {#if conversations.length > 0}
              <p class="partner-section-label">FROM YOUR CHATS</p>
              <div class="conv-grid">
                {#each conversations.slice(0, 6) as c}
                  <button class="conv-chip" onclick={() => selectPartner(c)}>
                    <div class="cc-av">{c.username.slice(0,2).toUpperCase()}</div>
                    <span>@{c.username}</span>
                  </button>
                {/each}
              </div>
            {/if}
            <p class="partner-section-label">SEARCH BY USERNAME</p>
            <div class="partner-search-wrap">
              <svg class="ps-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.3"/>
                <path d="M10 10l2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              <input class="partner-search" type="text" placeholder="Search users..."
                value={partnerSearchQ} oninput={handlePartnerSearch} autocomplete="off" />
            </div>
            {#if partnerLoading}
              <div class="p-loading"><div class="spin-sm"></div> Searching...</div>
            {:else if partnerResults.length > 0}
              <div class="p-results">
                {#each partnerResults as u}
                  <button class="p-result" onclick={() => selectPartner(u)}>
                    <div class="pr-av">{u.username.slice(0,2).toUpperCase()}</div>
                    <span>@{u.username}</span>
                    <span class="pr-add">+ Add</span>
                  </button>
                {/each}
              </div>
            {:else if partnerSearchQ.trim() && !partnerLoading}
              <p class="p-empty">No users found</p>
            {/if}
          {/if}
          <div class="solo-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            If your partner doesn't accept, you can start solo anytime
          </div>
        {/if}
      </div>

      <!-- NAVIGATION -->
      <div class="wiz-nav">
        {#if step > 1}
          <button class="wiz-back" onclick={prevStep}>← Back</button>
        {:else}
          <div></div>
        {/if}
        {#if step < 4}
          <button
            class="wiz-next {canNext() ? '' : 'wiz-btn-dis'}"
            disabled={!canNext()}
            onclick={nextStep}
          >
            Next →
          </button>
        {:else}
          <button
            class="wiz-generate {(creating || myStreaks.length >= 3) ? 'wiz-btn-dis' : ''}"
            disabled={creating || myStreaks.length >= 3}
            onclick={createStreak}
          >
            {#if creating}
              <div class="spin-sm white"></div> Generating…
            {:else if myStreaks.length >= 3}
              🔒 Limit Reached (3/3)
            {:else}
              🔥 Generate Streak
            {/if}
          </button>
        {/if}
      </div>

      {#if hasPrevTaste && step === 1}
        <button class="restart-taste-btn" onclick={restartFromTaste}>
          ↺ Restart from my previous taste
        </button>
      {/if}
    </div>
  {/if}

</main>

<!-- KICKED PARTNER POPUP -->
{#if showKickedPopup}
  <div class="kicked-overlay" onclick={() => showKickedPopup = false}>
    <div class="kicked-card" onclick={(e) => e.stopPropagation()}>
      {#if kickedPartnerName}
        <!-- Creator kicked partner -->
        <div class="kicked-icon">👟</div>
        <h2 class="kicked-title">Partner Removed</h2>
        <p class="kicked-sub">
          <strong>@{kickedPartnerName}</strong> has been removed from this streak.
          Your streak continues solo!
        </p>
      {:else}
        <!-- You were kicked -->
        <div class="kicked-icon">😔</div>
        <h2 class="kicked-title">You Were Removed</h2>
        <p class="kicked-sub">
          The host has removed you from this streak. It happens — you can always start your own!
        </p>
      {/if}
      <button class="kicked-gotit" onclick={() => showKickedPopup = false}>
        Got it 👍
      </button>
    </div>
  </div>
{/if}

<style>
  :global(*){margin:0;padding:0;box-sizing:border-box}
  :global(html,body){background:#050505;color:#f0ece4;font-family:'Sora',sans-serif;min-height:100vh}

  .grain{position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:.04;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}

  /* NAV */
  .nav{
    position:fixed;top:0;left:0;right:0;z-index:500;height:58px;
    padding:0 20px;display:flex;align-items:center;justify-content:space-between;
    background:rgba(5,5,5,.95);backdrop-filter:blur(20px);
    border-bottom:1px solid rgba(201,168,76,.12);
  }
  .nav-back{
    display:flex;align-items:center;gap:7px;background:none;
    border:1px solid rgba(255,255,255,.1);color:rgba(240,236,228,.5);
    font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.1em;
    padding:7px 14px;cursor:pointer;border-radius:20px;transition:.2s;
  }
  .nav-back:hover{border-color:rgba(201,168,76,.4);color:#c9a84c}
  .nav-logo{display:flex;align-items:center;gap:8px}
  .logo-flame{font-size:1.4rem}
  .logo-text{font-family:'Cormorant Garamond',serif;font-size:1.5rem;font-weight:700;color:#f0ece4}
  .logo-mode{font-family:'Space Mono',monospace;font-size:.5rem;letter-spacing:.14em;
    background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.3);color:#c9a84c;
    padding:3px 8px;border-radius:20px;margin-left:4px}
  .nav-count{font-family:'Space Mono',monospace;font-size:.6rem;color:rgba(201,168,76,.7);
    display:flex;align-items:center;gap:3px;background:rgba(201,168,76,.08);
    border:1px solid rgba(201,168,76,.2);padding:4px 10px;border-radius:20px}
  .nav-count span{color:#c9a84c;font-weight:700;font-size:.7rem}

  /* PAGE */
  .page{padding:78px 0 60px;min-height:100vh}
  .full-center{height:80vh;display:flex;align-items:center;justify-content:center}

  /* LOADER */
  .loader{position:relative;width:80px;height:80px;display:flex;align-items:center;justify-content:center}
  .loader-ring{position:absolute;inset:0;border-radius:50%;border:2px solid transparent;border-top-color:rgba(201,168,76,.6);animation:spin .8s linear infinite}
  .loader-ring.r2{inset:8px;border-top-color:rgba(201,168,76,.3);animation:spin 1.2s linear infinite reverse}
  .loader-icon{font-size:2rem;animation:pulse 1.5s ease-in-out infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}

  /* STATUS SCREENS */
  .status-screen{max-width:520px;margin:60px auto;text-align:center;padding:24px}
  .ss-icon-wrap{position:relative;width:100px;height:100px;margin:0 auto 28px;display:flex;align-items:center;justify-content:center}
  .ss-ring{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(201,168,76,.3)}
  .ss-ring-pulse{animation:ringPulse 2s ease-in-out infinite}
  @keyframes ringPulse{0%,100%{transform:scale(1);opacity:.4}50%{transform:scale(1.15);opacity:.9}}
  .ss-broken .ss-ring{border-color:rgba(231,76,60,.3)}
  .ss-complete .ss-ring{border-color:rgba(95,191,140,.3)}
  .ss-pending .ss-ring{border-color:rgba(93,173,226,.3)}
  .ss-icon{font-size:3.5rem;position:relative;z-index:1}
  .ss-title{font-family:'Cormorant Garamond',serif;font-size:2.8rem;font-weight:700;margin-bottom:10px}
  .ss-sub{font-size:.9rem;opacity:.5;line-height:1.7;margin-bottom:24px}
  .ss-genre-tags{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin-bottom:24px}
  .ss-gtag{background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.25);color:#c9a84c;
    font-family:'Space Mono',monospace;font-size:.52rem;letter-spacing:.06em;padding:4px 11px;border-radius:20px}
  .ss-gtag.dur{background:rgba(95,191,140,.1);border-color:rgba(95,191,140,.25);color:#5fbf8c}
  .ss-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}

  .btn-primary{
    display:inline-flex;align-items:center;gap:8px;
    background:rgba(201,168,76,.18);border:1px solid rgba(201,168,76,.5);color:#c9a84c;
    font-family:'Space Mono',monospace;font-size:.62rem;letter-spacing:.1em;
    padding:12px 22px;cursor:pointer;border-radius:30px;transition:.2s;
  }
  .btn-primary:hover{background:rgba(201,168,76,.28);transform:translateY(-1px)}
  .btn-secondary{background:transparent;border:1px solid rgba(255,255,255,.12);color:rgba(240,236,228,.5);font-family:'Space Mono',monospace;font-size:.62rem;letter-spacing:.1em;padding:12px 22px;cursor:pointer;border-radius:30px;transition:.2s}
  .btn-secondary:hover{border-color:rgba(255,255,255,.25);color:#f0ece4}
  .btn-danger{background:rgba(231,76,60,.1);border:1px solid rgba(231,76,60,.3);color:#e74c3c;font-family:'Space Mono',monospace;font-size:.62rem;letter-spacing:.1em;padding:12px 22px;cursor:pointer;border-radius:30px;transition:.2s}
  .btn-danger:hover{background:rgba(231,76,60,.2)}

  /* STREAK TABS */
  .streak-tabs{
    display:flex;gap:8px;overflow-x:auto;padding:16px 20px 0;
    max-width:900px;margin:0 auto;scrollbar-width:none;
  }
  .streak-tabs::-webkit-scrollbar{display:none}
  .stab{
    flex:0 0 auto;display:flex;align-items:center;gap:7px;
    background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);
    color:rgba(240,236,228,.55);font-family:'Space Mono',monospace;
    font-size:.58rem;letter-spacing:.06em;padding:8px 16px;
    cursor:pointer;border-radius:20px;transition:.2s;position:relative;
  }
  .stab:hover{border-color:rgba(201,168,76,.3);color:#c9a84c}
  .stab-active{background:rgba(201,168,76,.14);border-color:#c9a84c;color:#c9a84c}
  .stab-fire{font-size:.9rem}
  .stab-dot{width:7px;height:7px;border-radius:50%;background:#e74c3c;box-shadow:0 0 6px #e74c3c;flex-shrink:0}

  /* ACTIVE LAYOUT */
  .active-layout{max-width:900px;margin:0 auto;padding:24px 20px 60px;transition:filter .3s}
  .active-layout.blurred{filter:blur(10px);pointer-events:none;user-select:none}

  /* HERO PANEL */
  .hero-panel{
    position:relative;border-radius:24px;overflow:hidden;
    background:#0a0a0a;border:1px solid rgba(201,168,76,.2);
    margin-bottom:28px;
  }
  .hero-bg{position:absolute;inset:0;z-index:0}
  .hero-backdrop{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.12}
  .hero-backdrop-fade{position:absolute;inset:0;background:linear-gradient(135deg,#0a0a0a 40%,transparent)}
  .hero-particles{position:absolute;inset:0;overflow:hidden;pointer-events:none}
  .particle{position:absolute;font-size:.7rem;opacity:.15;animation:floatP 8s ease-in-out infinite}
  .p0{top:10%;left:5%;animation-delay:0s}
  .p1{top:20%;right:8%;animation-delay:1.3s}
  .p2{top:60%;left:3%;animation-delay:2.6s}
  .p3{bottom:15%;right:5%;animation-delay:3.9s}
  .p4{top:40%;left:50%;animation-delay:5.2s}
  .p5{bottom:30%;left:70%;animation-delay:0.7s}
  @keyframes floatP{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-12px) rotate(15deg)}}

  .hero-content{position:relative;z-index:1;display:flex;align-items:center;gap:28px;padding:28px 28px 20px}
  .hero-left{display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0}
  .hero-day-wrap{text-align:center;background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);border-radius:16px;padding:16px 20px}
  .hero-day-label{font-family:'Space Mono',monospace;font-size:.46rem;letter-spacing:.2em;color:rgba(201,168,76,.6);margin-bottom:2px}
  .hero-day-num{font-family:'Cormorant Garamond',serif;font-size:3.5rem;font-weight:700;color:#c9a84c;line-height:1}
  .hero-day-of{font-family:'Space Mono',monospace;font-size:.5rem;color:rgba(201,168,76,.5);letter-spacing:.1em;margin-top:2px}
  .hero-fire{font-size:2rem;animation:fireWobble 2s ease-in-out infinite}
  @keyframes fireWobble{0%,100%{transform:scale(1) rotate(-5deg)}50%{transform:scale(1.15) rotate(5deg)}}

  .hero-right{flex:1;display:flex;flex-direction:column;gap:14px}
  .hero-stats-grid{display:flex;gap:12px}
  .hstat{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px 16px;flex:1;text-align:center}
  .hstat-n{font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:700;color:#c9a84c}
  .hstat-l{font-family:'Space Mono',monospace;font-size:.45rem;color:rgba(240,236,228,.3);letter-spacing:.1em;margin-top:2px}

  .hero-progress-wrap{display:flex;align-items:center;gap:12px}
  .hero-progress-bar{flex:1;height:6px;background:rgba(255,255,255,.08);border-radius:3px;position:relative;overflow:visible}
  .hero-progress-fill{height:100%;background:linear-gradient(90deg,#c9a84c,#e8c46a);border-radius:3px;transition:width .5s ease;position:relative}
  .hero-progress-fill::after{content:'';position:absolute;right:0;top:50%;transform:translateY(-50%);width:10px;height:10px;border-radius:50%;background:#e8c46a;box-shadow:0 0 8px rgba(232,196,106,.8)}
  .hero-progress-label{font-family:'Space Mono',monospace;font-size:.5rem;color:rgba(201,168,76,.7);flex-shrink:0}

  .hero-genres{display:flex;gap:6px;flex-wrap:wrap}
  .hero-gtag{background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);color:#c9a84c;font-family:'Space Mono',monospace;font-size:.5rem;letter-spacing:.06em;padding:3px 9px;border-radius:20px}
  .hero-gtag.temp{background:rgba(93,173,226,.1);border-color:rgba(93,173,226,.2);color:#5dade2}

  .hero-actions{position:relative;z-index:1;display:flex;gap:8px;padding:0 28px 20px;justify-content:flex-end}
  .hero-kick{display:flex;align-items:center;gap:6px;background:rgba(231,76,60,.1);border:1px solid rgba(231,76,60,.25);color:#e74c3c;font-family:'Space Mono',monospace;font-size:.54rem;letter-spacing:.08em;padding:7px 14px;cursor:pointer;border-radius:20px;transition:.2s}
  .hero-kick:hover{background:rgba(231,76,60,.2)}
  .hero-cancel{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(240,236,228,.45);font-family:'Space Mono',monospace;font-size:.54rem;letter-spacing:.08em;padding:7px 14px;cursor:pointer;border-radius:20px;transition:.2s}
  .hero-cancel:hover{background:rgba(231,76,60,.12);border-color:rgba(231,76,60,.25);color:#e74c3c}

  /* SECTIONS */
  .section{margin-bottom:28px}
  .section-hdr{display:flex;align-items:center;gap:12px;margin-bottom:14px}
  .section-eyebrow{font-family:'Space Mono',monospace;font-size:.54rem;letter-spacing:.2em;color:rgba(201,168,76,.7)}
  .section-dot{width:24px;height:2px;background:linear-gradient(90deg,#c9a84c,transparent);border-radius:1px}
  .section-count{margin-left:auto;font-family:'Space Mono',monospace;font-size:.5rem;color:rgba(240,236,228,.25)}

  .no-today{display:flex;align-items:center;gap:10px;padding:20px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:14px;margin-bottom:28px;font-family:'Space Mono',monospace;font-size:.62rem;color:rgba(240,236,228,.3);letter-spacing:.06em}

  /* TODAY CARDS */
  .today-cards{display:flex;flex-direction:column;gap:10px}
  .today-card{position:relative;border-radius:16px;overflow:hidden;background:#0d0d0d;border:1px solid rgba(201,168,76,.2);box-shadow:0 4px 20px rgba(201,168,76,.06)}
  .tc-bg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.15}
  .tc-bg-fade{position:absolute;inset:0;background:linear-gradient(135deg,#0d0d0d 50%,transparent)}
  .tc-body{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px}
  .tc-left{display:flex;align-items:center;gap:14px}
  .tc-poster{width:54px;height:80px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,.1);flex-shrink:0;box-shadow:0 4px 12px rgba(0,0,0,.4)}
  .tc-poster-ph{width:54px;height:80px;border-radius:8px;border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:1.5rem;background:rgba(255,255,255,.03)}
  .tc-info{display:flex;flex-direction:column;gap:4px}
  .tc-title{font-family:'Cormorant Garamond',serif;font-size:1.15rem;font-weight:600;color:#f0ece4}
  .tc-meta{display:flex;align-items:center;gap:6px;font-family:'Space Mono',monospace;font-size:.52rem;color:rgba(240,236,228,.4)}
  .tc-dot-sep{opacity:.4}
  .tc-rating{color:#c9a84c}
  .tc-badge-today{font-family:'Space Mono',monospace;font-size:.46rem;letter-spacing:.14em;background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.3);color:#c9a84c;padding:3px 8px;border-radius:20px;width:fit-content;margin-top:2px}
  .tc-watched{
    display:flex;align-items:center;gap:8px;flex-shrink:0;
    background:rgba(95,191,140,.12);border:1px solid rgba(95,191,140,.4);
    color:#5fbf8c;font-family:'Space Mono',monospace;font-size:.58rem;
    letter-spacing:.08em;padding:11px 18px;cursor:pointer;border-radius:20px;transition:.2s;
  }
  .tc-watched:hover{background:rgba(95,191,140,.22);transform:translateY(-1px)}

  /* TIMELINE */
  .timeline{display:flex;flex-direction:column;gap:0}
  .tl-item{display:flex;gap:0;align-items:stretch}
  .tl-spine{display:flex;flex-direction:column;align-items:center;width:48px;flex-shrink:0}
  .tl-node{
    width:28px;height:28px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    border:2px solid;flex-shrink:0;
    font-size:.6rem;font-weight:700;color:#050505;
    box-shadow:0 0 0 3px rgba(255,255,255,.04);
    margin-top:8px;z-index:1;position:relative;
  }
  .tl-node-icon{font-size:.65rem}
  .tl-line{flex:1;width:2px;background:rgba(255,255,255,.07);margin:4px 0;min-height:16px}
  .tl-line.tl-line-done{background:rgba(95,191,140,.3)}
  .tl-card{
    flex:1;display:flex;align-items:center;gap:12px;
    background:#0d0d0d;border:1px solid rgba(255,255,255,.07);
    border-radius:12px;padding:10px 14px;margin:5px 0;
    transition:.2s;min-height:60px;
  }
  .tl-card:hover{border-color:rgba(255,255,255,.12)}
  .tl-locked .tl-card{opacity:.4}
  .tl-date-badge{font-family:'Space Mono',monospace;font-size:.44rem;color:rgba(240,236,228,.3);letter-spacing:.05em;flex-shrink:0;min-width:70px}
  .tl-poster{width:32px;height:48px;object-fit:cover;border-radius:4px;border:1px solid rgba(255,255,255,.08);flex-shrink:0}
  .tl-lock-icon{font-size:1rem;flex-shrink:0}
  .tl-info{flex:1;min-width:0}
  .tl-title{font-size:.8rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tl-title.locked-text{color:rgba(240,236,228,.35);font-style:italic}
  .tl-meta{font-family:'Space Mono',monospace;font-size:.46rem;color:rgba(240,236,228,.3);margin-top:2px}
  .tl-status-pill{font-family:'Space Mono',monospace;font-size:.44rem;letter-spacing:.1em;padding:3px 8px;border-radius:4px;border:1px solid;flex-shrink:0}

  /* INVITE OVERLAY */
  .invite-overlay{
    position:fixed;inset:0;z-index:1000;
    display:flex;align-items:center;justify-content:center;
    background:rgba(5,5,5,.88);backdrop-filter:blur(12px);
    padding:20px;
  }
  .invite-card{
    position:relative;background:#0c0c0c;
    border:1px solid rgba(201,168,76,.4);border-radius:24px;
    padding:0;max-width:440px;width:100%;
    box-shadow:0 32px 80px rgba(0,0,0,.8),0 0 0 1px rgba(201,168,76,.08);
    overflow:hidden;
    animation:inviteIn .3s cubic-bezier(.34,1.56,.64,1);
  }
  @keyframes inviteIn{from{opacity:0;transform:scale(.9) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
  .ic-aura{
    position:absolute;top:-60%;left:-20%;width:140%;height:140%;
    background:radial-gradient(ellipse at 50% 0%,rgba(201,168,76,.12),transparent 65%);
    pointer-events:none;
  }
  .ic-header{
    position:relative;z-index:1;
    display:flex;flex-direction:column;align-items:center;
    padding:32px 32px 0;gap:12px;
  }
  .ic-fire-wrap{position:relative;width:70px;height:70px;display:flex;align-items:center;justify-content:center}
  .ic-fire-ring{position:absolute;inset:0;border-radius:50%;border:1.5px solid;animation:ringAnim 2s ease-in-out infinite}
  .ic-fire-ring.r1{border-color:rgba(201,168,76,.5)}
  .ic-fire-ring.r2{inset:8px;border-color:rgba(201,168,76,.25);animation-delay:.4s;animation-direction:reverse}
  @keyframes ringAnim{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.12);opacity:1}}
  .ic-fire{font-size:2.4rem;position:relative;z-index:1}
  .ic-from-badge{
    background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.25);
    color:rgba(201,168,76,.8);font-family:'Space Mono',monospace;
    font-size:.5rem;letter-spacing:.12em;padding:4px 12px;border-radius:20px;
  }
  .ic-title{position:relative;z-index:1;font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:700;color:#f0ece4;text-align:center;padding:0 32px;margin-top:8px}
  .ic-sub{position:relative;z-index:1;font-size:.8rem;color:rgba(240,236,228,.45);text-align:center;padding:0 32px;margin-top:6px;line-height:1.6}
  .ic-details{position:relative;z-index:1;padding:20px 32px;display:flex;flex-direction:column;gap:14px;border-top:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06);margin:20px 0 0}
  .ic-detail{display:flex;align-items:center;gap:12px}
  .ic-detail-label{font-family:'Space Mono',monospace;font-size:.5rem;letter-spacing:.14em;color:rgba(240,236,228,.3);width:70px;flex-shrink:0}
  .ic-detail-val{font-size:.82rem;color:rgba(240,236,228,.7)}
  .ic-pills{display:flex;gap:6px;flex-wrap:wrap}
  .ic-pill{background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.25);color:#c9a84c;font-family:'Space Mono',monospace;font-size:.5rem;letter-spacing:.06em;padding:4px 10px;border-radius:20px}
  .ic-btns{position:relative;z-index:1;display:flex;gap:10px;padding:20px 32px 28px}
  .ic-decline{
    flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
    color:rgba(240,236,228,.5);font-family:'Space Mono',monospace;font-size:.6rem;
    letter-spacing:.08em;padding:13px;cursor:pointer;border-radius:30px;transition:.2s;
  }
  .ic-decline:hover{background:rgba(231,76,60,.15);border-color:rgba(231,76,60,.3);color:#e74c3c}
  .ic-decline:disabled{opacity:.4;cursor:not-allowed}
  .ic-accept{
    flex:2;display:flex;align-items:center;justify-content:center;gap:8px;
    background:linear-gradient(135deg,rgba(201,168,76,.25),rgba(201,168,76,.15));
    border:1px solid #c9a84c;color:#c9a84c;
    font-family:'Space Mono',monospace;font-size:.62rem;letter-spacing:.1em;font-weight:700;
    padding:13px;cursor:pointer;border-radius:30px;transition:.2s;
  }
  .ic-accept:hover:not(:disabled){background:rgba(201,168,76,.35);transform:translateY(-2px);box-shadow:0 8px 24px rgba(201,168,76,.25)}
  .ic-accept:disabled{opacity:.4;cursor:not-allowed}

  /* WIZARD */
  .wizard{max-width:680px;margin:0 auto;padding:32px 20px 60px}
  .wiz-header{margin-bottom:28px}
  .wiz-title-group{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
  .wiz-big-title{font-family:'Cormorant Garamond',serif;font-size:2.8rem;font-weight:700}
  .wiz-type-toggle{display:flex;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:3px;gap:2px}
  .wtype{background:none;border:none;color:rgba(240,236,228,.4);font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.08em;padding:6px 14px;cursor:pointer;border-radius:17px;transition:.2s}
  .wtype-on{background:rgba(201,168,76,.18);color:#c9a84c}
  .wiz-temp-note{font-family:'Space Mono',monospace;font-size:.56rem;color:rgba(93,173,226,.6);letter-spacing:.06em;margin-bottom:8px}
  .wiz-limit{display:flex;align-items:center;gap:10px;font-family:'Space Mono',monospace;font-size:.54rem;color:rgba(240,236,228,.3)}
  .wiz-limit-dots{display:flex;gap:4px}
  .wld{width:8px;height:8px;border-radius:50%;border:1px solid rgba(255,255,255,.15);transition:.2s}
  .wld-on{background:#c9a84c;border-color:#c9a84c;box-shadow:0 0 6px rgba(201,168,76,.4)}

  /* STEP PROGRESS */
  .step-progress{display:flex;align-items:center;justify-content:center;gap:0;margin-bottom:28px;flex-wrap:nowrap}
  .sp-item{display:flex;flex-direction:column;align-items:center;gap:5px}
  .sp-dot{
    width:34px;height:34px;border-radius:50%;
    border:2px solid rgba(255,255,255,.1);background:#0d0d0d;
    display:flex;align-items:center;justify-content:center;
    font-family:'Space Mono',monospace;font-size:.6rem;color:rgba(240,236,228,.3);
    transition:.3s;
  }
  .sp-done{border-color:#5fbf8c;background:rgba(95,191,140,.12);color:#5fbf8c}
  .sp-cur{border-color:#c9a84c;background:rgba(201,168,76,.15);color:#c9a84c;box-shadow:0 0 0 4px rgba(201,168,76,.12)}
  .sp-label{font-family:'Space Mono',monospace;font-size:.46rem;letter-spacing:.12em;color:rgba(240,236,228,.2);text-transform:uppercase}
  .sp-label-cur{color:#c9a84c}
  .sp-line{flex:1;max-width:50px;height:2px;background:rgba(255,255,255,.07);margin-bottom:16px;transition:.3s}
  .sp-line-done{background:rgba(95,191,140,.4)}

  /* STEP CARD */
  .step-card{background:#0d0d0d;border:1px solid rgba(255,255,255,.07);border-radius:20px;padding:32px;margin-bottom:22px}
  .step-eyebrow{font-family:'Space Mono',monospace;font-size:.5rem;letter-spacing:.2em;color:rgba(201,168,76,.6);margin-bottom:10px}
  .step-title{font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:700;margin-bottom:6px}
  .step-desc{font-size:.82rem;opacity:.38;margin-bottom:24px}

  /* GENRES */
  .genres-grid{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
  .genre-btn{
    display:flex;align-items:center;gap:7px;
    background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);
    color:rgba(240,236,228,.65);font-family:'Space Mono',monospace;
    font-size:.6rem;letter-spacing:.06em;padding:9px 14px;
    cursor:pointer;border-radius:20px;transition:.2s;position:relative;
  }
  .genre-btn:hover:not(.genre-dis){border-color:rgba(201,168,76,.4);color:#c9a84c;background:rgba(201,168,76,.06)}
  .genre-sel{background:rgba(201,168,76,.14)!important;border-color:#c9a84c!important;color:#c9a84c!important}
  .genre-dis{opacity:.28;cursor:not-allowed}
  .genre-emoji{font-size:.95rem}
  .genre-name{}
  .genre-check{font-size:.65rem;font-weight:700}
  .sel-hint{font-family:'Space Mono',monospace;font-size:.52rem;color:rgba(240,236,228,.25);letter-spacing:.1em}

  /* DURATION */
  .presets-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(105px,1fr));gap:8px;margin-bottom:18px}
  .preset-card{
    background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
    border-radius:12px;padding:14px 12px;cursor:pointer;transition:.2s;text-align:center;
  }
  .preset-card:hover{border-color:rgba(201,168,76,.35);background:rgba(201,168,76,.05)}
  .preset-sel{background:rgba(201,168,76,.12)!important;border-color:#c9a84c!important}
  .preset-label{font-family:'Space Mono',monospace;font-size:.62rem;color:#f0ece4;letter-spacing:.06em;margin-bottom:4px}
  .preset-desc{font-size:.66rem;color:rgba(240,236,228,.3)}
  .or-divider{text-align:center;position:relative;margin:18px 0;font-family:'Space Mono',monospace;font-size:.5rem;color:rgba(240,236,228,.2);letter-spacing:.12em}
  .or-divider::before{content:'';position:absolute;top:50%;left:0;right:0;height:1px;background:rgba(255,255,255,.06)}
  .or-divider span{background:#0d0d0d;position:relative;padding:0 12px}
  .custom-input-row{display:flex;align-items:center;gap:10px}
  .custom-inp{flex:1;background:#111;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:12px 16px;color:#f0ece4;font-family:'Sora',sans-serif;font-size:1rem;outline:none;transition:.2s}
  .custom-inp:focus{border-color:rgba(201,168,76,.45)}
  .custom-unit{font-family:'Space Mono',monospace;font-size:.62rem;color:rgba(240,236,228,.4)}
  .field-err{color:#e74c3c;font-family:'Space Mono',monospace;font-size:.58rem;margin-top:8px}
  .duration-preview{margin-top:14px;background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.15);border-radius:8px;padding:12px 16px;font-size:.82rem;color:rgba(240,236,228,.55)}
  .dp-label{opacity:.6;margin-right:6px}
  .dp-val{color:#c9a84c;font-weight:700}
  .dp-end{opacity:.5;margin-left:6px}

  /* BUSYNESS */
  .busy-cards{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
  .busy-card{
    display:flex;align-items:center;gap:16px;
    background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);
    border-radius:14px;padding:18px;cursor:pointer;transition:.22s;position:relative;
    text-align:left;
  }
  .busy-card:hover{border-color:rgba(201,168,76,.3);background:rgba(201,168,76,.04)}
  .busy-sel{background:rgba(201,168,76,.1)!important;border-color:#c9a84c!important}
  .bc-icon{font-size:2rem;width:48px;flex-shrink:0;text-align:center}
  .bc-body{flex:1}
  .bc-label{font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:600;margin-bottom:3px}
  .bc-sub{font-family:'Space Mono',monospace;font-size:.52rem;color:rgba(240,236,228,.38);letter-spacing:.05em}
  .bc-check{position:absolute;right:16px;top:50%;transform:translateY(-50%);width:22px;height:22px;border-radius:50%;background:#c9a84c;color:#050505;font-size:.65rem;font-weight:700;display:flex;align-items:center;justify-content:center}

  /* PARTNER */
  .partner-section-label{font-family:'Space Mono',monospace;font-size:.5rem;letter-spacing:.14em;color:rgba(240,236,228,.22);margin-bottom:8px;margin-top:14px}
  .conv-grid{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px}
  .conv-chip{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);color:rgba(240,236,228,.7);font-size:.76rem;padding:7px 14px;border-radius:20px;cursor:pointer;transition:.2s}
  .conv-chip:hover{border-color:rgba(201,168,76,.3);color:#c9a84c}
  .cc-av{width:24px;height:24px;border-radius:50%;background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.25);color:#c9a84c;font-family:'Space Mono',monospace;font-size:.44rem;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .partner-search-wrap{position:relative;margin-bottom:10px}
  .ps-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:rgba(240,236,228,.25);pointer-events:none}
  .partner-search{width:100%;background:#111;border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:10px 16px 10px 34px;color:#f0ece4;font-family:'Sora',sans-serif;font-size:.85rem;outline:none;transition:.2s}
  .partner-search:focus{border-color:rgba(201,168,76,.4)}
  .partner-search::placeholder{color:rgba(240,236,228,.2)}
  .p-loading{padding:10px;font-family:'Space Mono',monospace;font-size:.58rem;color:rgba(240,236,228,.28);display:flex;align-items:center;gap:8px}
  .p-results{background:#111;border:1px solid rgba(255,255,255,.07);border-radius:10px;overflow:hidden;margin-bottom:10px}
  .p-result{display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;background:none;border:none;border-bottom:1px solid rgba(255,255,255,.05);color:#f0ece4;cursor:pointer;transition:.14s;text-align:left;font-size:.82rem}
  .p-result:last-child{border-bottom:none}
  .p-result:hover{background:rgba(201,168,76,.06)}
  .pr-av{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-size:.48rem;color:rgba(240,236,228,.5);flex-shrink:0}
  .pr-add{margin-left:auto;font-family:'Space Mono',monospace;font-size:.5rem;color:rgba(201,168,76,.6);letter-spacing:.08em}
  .p-empty{font-family:'Space Mono',monospace;font-size:.58rem;color:rgba(240,236,228,.22);margin:8px 0}
  .sel-partner-card{display:flex;align-items:center;gap:12px;background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.25);border-radius:14px;padding:14px 16px;margin-bottom:14px}
  .sp-avatar{width:38px;height:38px;border-radius:50%;background:rgba(201,168,76,.18);border:1px solid rgba(201,168,76,.4);color:#c9a84c;font-family:'Space Mono',monospace;font-size:.52rem;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .sp-info{flex:1}
  .sp-name{font-size:.88rem;font-weight:500;color:#f0ece4}
  .sp-sub{font-family:'Space Mono',monospace;font-size:.52rem;color:rgba(240,236,228,.35);margin-top:2px}
  .sp-remove{background:none;border:none;color:rgba(240,236,228,.35);font-size:1rem;cursor:pointer;transition:.2s;padding:4px}
  .sp-remove:hover{color:#e74c3c}
  .solo-note{display:flex;align-items:flex-start;gap:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:11px 14px;font-size:.76rem;color:rgba(240,236,228,.35);line-height:1.5;margin-top:14px}
  .solo-note svg{flex-shrink:0;margin-top:1px;opacity:.5}

  /* WIZ NAV */
  .wiz-nav{display:flex;justify-content:space-between;align-items:center;margin-top:4px}
  .wiz-back{background:none;border:1px solid rgba(255,255,255,.1);color:rgba(240,236,228,.45);font-family:'Space Mono',monospace;font-size:.6rem;letter-spacing:.08em;padding:12px 22px;cursor:pointer;border-radius:30px;transition:.2s}
  .wiz-back:hover{border-color:rgba(255,255,255,.22);color:#f0ece4}
  .wiz-next{background:rgba(201,168,76,.16);border:1px solid rgba(201,168,76,.5);color:#c9a84c;font-family:'Space Mono',monospace;font-size:.62rem;letter-spacing:.1em;padding:13px 28px;cursor:pointer;border-radius:30px;transition:.2s}
  .wiz-next:hover:not(.wiz-btn-dis){background:rgba(201,168,76,.26)}
  .wiz-generate{display:flex;align-items:center;gap:10px;background:#c9a84c;color:#050505;font-family:'Space Mono',monospace;font-size:.62rem;letter-spacing:.1em;font-weight:700;padding:13px 28px;border:none;cursor:pointer;border-radius:30px;transition:.2s}
  .wiz-generate:hover:not(.wiz-btn-dis){background:#e8c46a;transform:translateY(-2px);box-shadow:0 8px 24px rgba(201,168,76,.3)}
  .wiz-btn-dis{opacity:.32;cursor:not-allowed;pointer-events:none}

  .restart-taste-btn{width:100%;margin-top:16px;background:rgba(93,173,226,.07);border:1px solid rgba(93,173,226,.18);color:#5dade2;font-family:'Space Mono',monospace;font-size:.58rem;letter-spacing:.1em;padding:12px;cursor:pointer;border-radius:10px;transition:.2s}
  .restart-taste-btn:hover{background:rgba(93,173,226,.14)}

  /* SPINNERS */
  .spin-sm{width:12px;height:12px;border-radius:50%;border:2px solid rgba(201,168,76,.2);border-top-color:#c9a84c;animation:spin .7s linear infinite;display:inline-block}
  .spin-sm.white{border-color:rgba(5,5,5,.25);border-top-color:#050505}

  /* KICKED POPUP */
  .kicked-overlay{
    position:fixed;inset:0;z-index:2000;
    display:flex;align-items:center;justify-content:center;
    background:rgba(5,5,5,.8);backdrop-filter:blur(10px);
    padding:20px;
  }
  .kicked-card{
    background:#0d0d0d;border:1px solid rgba(231,76,60,.35);
    border-radius:20px;padding:36px 32px;max-width:380px;width:100%;
    text-align:center;
    box-shadow:0 20px 60px rgba(0,0,0,.7),0 0 0 1px rgba(231,76,60,.1);
    animation:inviteIn .25s cubic-bezier(.34,1.56,.64,1);
  }
  .kicked-icon{font-size:3rem;margin-bottom:16px;display:block}
  .kicked-title{font-family:'Cormorant Garamond',serif;font-size:1.8rem;font-weight:700;color:#f0ece4;margin-bottom:10px}
  .kicked-sub{font-size:.84rem;color:rgba(240,236,228,.5);line-height:1.7;margin-bottom:28px}
  .kicked-sub strong{color:rgba(240,236,228,.85)}
  .kicked-gotit{
    background:rgba(201,168,76,.18);border:1px solid rgba(201,168,76,.5);color:#c9a84c;
    font-family:'Space Mono',monospace;font-size:.62rem;letter-spacing:.12em;
    padding:13px 32px;cursor:pointer;border-radius:30px;transition:.2s;
  }
  .kicked-gotit:hover{background:rgba(201,168,76,.3);transform:translateY(-1px)}

  @media(max-width:640px){
    .hero-content{flex-direction:column;gap:16px;padding:20px 16px 14px}
    .hero-stats-grid{width:100%}
    .hero-actions{padding:0 16px 16px}
    .active-layout{padding:16px 12px 40px}
    .busy-cards{gap:8px}
    .ic-btns{flex-direction:column;padding:16px 20px 24px}
    .invite-card{border-radius:16px}
    .wiz-nav{gap:8px}
  }
</style>