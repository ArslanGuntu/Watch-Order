<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';

  // ── State ────────────────────────────────────────────────────────────────
  let me = $state(null);
  let profile = $state(null);
  let loading = $state(true);

  let editingName = $state(false);
  let newUsername = $state('');
  let savingName = $state(false);
  let showAvatarPicker = $state(false);
  let savingAvatar = $state(false);
  let uploadingAvatar = $state(false);
  let fileInput = null;

  const DEFAULT_AVATARS = [
    { id: 'flame', emoji: '🔥', bg: 'linear-gradient(135deg,#c9a84c,#e8c46a)' },
    { id: 'star', emoji: '⭐', bg: 'linear-gradient(135deg,#5fbf8c,#3aa870)' },
    { id: 'ghost', emoji: '👻', bg: 'linear-gradient(135deg,#5dade2,#2e86c1)' },
    { id: 'crown', emoji: '👑', bg: 'linear-gradient(135deg,#c9a84c,#a07830)' },
    { id: 'robot', emoji: '🤖', bg: 'linear-gradient(135deg,#e74c3c,#c0392b)' },
    { id: 'alien', emoji: '👾', bg: 'linear-gradient(135deg,#9b59b6,#8e44ad)' },
    { id: 'ninja', emoji: '🥷', bg: 'linear-gradient(135deg,#2c3e50,#4a4a4a)' },
    { id: 'wolf', emoji: '🐺', bg: 'linear-gradient(135deg,#7f8c8d,#5d6d7e)' },
  ];

  let activeStreak = $state(null);
  let loggedMovies = $state([]);
  let favorites = $state([]);
  let notifications = $state([]);
  let activeTab = $state('overview');
  let genreTaste = $state([]);

  const XP_PER_MOVIE = 100;
  const XP_PER_FAV = 50;
  const XP_PER_STREAK_DAY = 100;
  const XP_PER_LEVEL = 10000;

  const BADGES = [
    { id: 'first_log', icon: '🎬', name: 'First Watch', desc: 'Log your first movie', req: (s) => s.logged >= 1 },
    { id: 'cinephile', icon: '🎞️', name: 'Cinephile', desc: 'Log 10+ movies', req: (s) => s.logged >= 10 },
    { id: 'obsessed', icon: '🍿', name: 'Obsessed', desc: 'Log 50+ movies', req: (s) => s.logged >= 50 },
    { id: 'legend', icon: '🏆', name: 'Legend', desc: 'Log 100+ movies', req: (s) => s.logged >= 100 },
    { id: 'fav_5', icon: '❤️', name: 'Taste Maker', desc: '5+ favorites saved', req: (s) => s.favs >= 5 },
    { id: 'streak_fire', icon: '🔥', name: 'On Fire', desc: 'Start a streak', req: (s) => s.streaks >= 1 },
    { id: 'streak_hero', icon: '⚔️', name: 'Streak Hero', desc: 'Complete a streak', req: (s) => s.completedStreaks >= 1 },
    { id: 'social', icon: '🤝', name: 'Social Watcher', desc: 'Join a partner streak', req: (s) => s.partnerStreaks >= 1 },
    { id: 'genre_master', icon: '🧠', name: 'Genre Master', desc: 'Watch 3+ genres', req: (s) => s.genres >= 3 },
    { id: 'night_owl', icon: '🦉', name: 'Night Owl', desc: 'Active after midnight (flavor)', req: () => false },
  ];

  let xpStats = $state({ logged: 0, favs: 0, streaks: 0, completedStreaks: 0, partnerStreaks: 0, genres: 0 });
  let totalXP = $derived(xpStats.logged * XP_PER_MOVIE + xpStats.favs * XP_PER_FAV + xpStats.streaks * XP_PER_STREAK_DAY);
  let level = $derived(Math.floor(totalXP / XP_PER_LEVEL) + 1);
  let levelProgress = $derived(((totalXP % XP_PER_LEVEL) / XP_PER_LEVEL) * 100);
  let earnedBadges = $derived(BADGES.filter(b => b.req(xpStats)));
  let unreadNotifs = $derived(notifications.filter(n => !n.read).length);

  let avatarDisplay = $derived.by(() => {
    if (!profile) return null;
    if (profile.avatar_url && profile.avatar_url.startsWith('http')) return { type: 'img', src: profile.avatar_url };
    const da = DEFAULT_AVATARS.find(a => a.id === profile.avatar_url);
    if (da) return { type: 'emoji', ...da };
    return null;
  });

  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { goto('/signin'); return; }
    me = session.user;

    await Promise.all([
      loadProfile(),
      loadStreak(),
      loadLoggedMovies(),
      loadFavorites(),
      loadNotifications(),
    ]);
    loading = false;
  });

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', me.id).single();
    profile = data || { id: me.id, username: me.email?.split('@')[0] || 'User', avatar_url: null };
    newUsername = profile.username;
  }

  async function loadStreak() {
    const { data } = await supabase
      .from('streaks').select('*')
      .or(`creator_id.eq.${me.id},partner_id.eq.${me.id}`)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle();
    activeStreak = data;
    if (data) {
      xpStats.streaks += Math.max(0, Math.floor((new Date() - new Date(data.start_date || data.created_at)) / 86400000));
    }
    const { count: cCount } = await supabase.from('streaks').select('id', { count: 'exact', head: true })
      .or(`creator_id.eq.${me.id},partner_id.eq.${me.id}`).eq('status', 'completed');
    xpStats.completedStreaks = cCount || 0;
    const { count: pCount } = await supabase.from('streaks').select('id', { count: 'exact', head: true })
      .eq('partner_id', me.id).neq('status', 'declined');
    xpStats.partnerStreaks = pCount || 0;
  }

  async function loadLoggedMovies() {
    const { data, count } = await supabase.from('logged_movies').select('*', { count: 'exact' })
      .eq('user_id', me.id).order('created_at', { ascending: false }).limit(20);
    loggedMovies = data || [];
    xpStats.logged = count || 0;
  }

  async function loadFavorites() {
    const { data, count } = await supabase.from('favorites').select('*', { count: 'exact' })
      .eq('user_id', me.id).order('created_at', { ascending: false }).limit(50);
    favorites = data || [];
    xpStats.favs = count || 0;

    const gCounts = {};
    const { data: streakData } = await supabase.from('streaks').select('taste_snapshot, genres')
      .or(`creator_id.eq.${me.id},partner_id.eq.${me.id}`).limit(10);
    (streakData || []).forEach(s => {
      const gs = s.genres || s.taste_snapshot?.genres || [];
      gs.forEach(g => { gCounts[g] = (gCounts[g] || 0) + 2; });
    });
    (favorites || []).forEach(f => {
      if (f.type === 'anime') gCounts['Animation'] = (gCounts['Animation'] || 0) + 1;
    });
    const sorted = Object.entries(gCounts).sort((a,b) => b[1]-a[1]).slice(0, 5);
    genreTaste = sorted.map(([name, count]) => ({ name, count }));
    xpStats.genres = sorted.length;
  }

  async function loadNotifications() {
    const { data: msgs } = await supabase.from('messages').select('*')
      .order('created_at', { ascending: false }).limit(30);
    const myConvIds = new Set();
    const { data: convs } = await supabase.from('conversations').select('id')
      .or(`user1_id.eq.${me.id},user2_id.eq.${me.id}`);
    (convs || []).forEach(c => myConvIds.add(c.id));

    const relevant = (msgs || []).filter(m =>
      m.sender_id !== me.id && myConvIds.has(m.conversation_id) && m.meta?.type
    );
    const seen = new Set();
    notifications = relevant.filter(n => {
      const key = `${n.meta?.type}-${n.meta?.streak_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(n => ({
      id: n.id,
      type: n.meta?.type || 'message',
      content: n.content,
      at: n.created_at,
      read: false,
      icon: n.meta?.type === 'streak_request' ? '🔥' :
            n.meta?.type === 'streak_accepted' ? '✅' :
            n.meta?.type === 'streak_broken' ? '💔' :
            n.meta?.type === 'streak_cancelled' ? '🚫' : '💬',
    }));
  }

  function toggleNotifRead(id) {
    notifications = notifications.map(n =>
      n.id === id ? { ...n, read: !n.read } : n
    );
  }

  async function saveAvatar(avatarId) {
    savingAvatar = true;
    await supabase.from('profiles').update({ avatar_url: avatarId }).eq('id', me.id);
    profile = { ...profile, avatar_url: avatarId };
    savingAvatar = false;
    showAvatarPicker = false;
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadingAvatar = true;
    showAvatarPicker = false;
    const ext = file.name.split('.').pop();
    const path = `avatars/${me.id}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', me.id);
      profile = { ...profile, avatar_url: publicUrl };
    }
    uploadingAvatar = false;
  }

  async function saveName() {
    if (!newUsername.trim() || savingName) return;
    savingName = true;
    await supabase.from('profiles').update({ username: newUsername.trim() }).eq('id', me.id);
    profile = { ...profile, username: newUsername.trim() };
    editingName = false;
    savingName = false;
  }

  function streakDay(s) {
    if (!s?.start_date) return 0;
    return Math.floor((new Date() - new Date(s.start_date)) / 86400000) + 1;
  }

  function timeAgo(ts) {
    const diff = (Date.now() - new Date(ts)) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff/60) + 'm ago';
    if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
    return Math.floor(diff/86400) + 'd ago';
  }
</script>

<div class="grain"></div>
<input type="file" accept="image/*" style="display:none" bind:this={fileInput} onchange={handleFileUpload} />

<!-- NAV -->
<nav class="nav">
  <button class="nav-back" onclick={() => goto('/app/chat')}>
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    BACK
  </button>
  <div class="nav-logo">
    <span class="logo-mark">W</span><span class="logo-rest">atchOrder</span>
  </div>
  {#if unreadNotifs > 0}
    <button class="notif-badge-btn" onclick={() => activeTab = 'notifications'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <span>{unreadNotifs}</span>
    </button>
  {:else}
    <div style="width:60px"></div>
  {/if}
</nav>

<main class="page">
  {#if loading}
    <div class="full-center">
      <div class="loader">
        <div class="loader-ring"></div>
        <div class="loader-ring r2"></div>
        <span class="loader-icon">✦</span>
      </div>
    </div>
  {:else}

  <!-- PROFILE HERO -->
  <div class="profile-hero">
    <div class="hero-bg-mesh"></div>
    <div class="hero-orb o1"></div>
    <div class="hero-orb o2"></div>
    <div class="hero-orb o3"></div>

    <div class="profile-identity">
      <!-- AVATAR -->
      <div class="avatar-wrap">
        {#if uploadingAvatar}
          <div class="avatar-shell loading">
            <div class="avatar-spinner"></div>
          </div>
        {:else if avatarDisplay?.type === 'img'}
          <div class="avatar-shell">
            <img src={avatarDisplay.src} alt="avatar" class="avatar-img" referrerpolicy="no-referrer" />
          </div>
        {:else if avatarDisplay?.type === 'emoji'}
          <div class="avatar-shell emoji-shell" style="background:{avatarDisplay.bg}">
            <span class="avatar-emoji">{avatarDisplay.emoji}</span>
          </div>
        {:else}
          <div class="avatar-shell emoji-shell" style="background:linear-gradient(135deg,#c9a84c,#a07830)">
            <span class="avatar-emoji">{(profile?.username || 'U').slice(0,2).toUpperCase()}</span>
          </div>
        {/if}
        <button class="avatar-edit-btn" onclick={() => showAvatarPicker = true} title="Change avatar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <div class="avatar-level-ring" style="--pct:{levelProgress}%"></div>
      </div>

      <!-- NAME + EDIT -->
      <div class="identity-text">
        {#if editingName}
          <div class="name-edit-row">
            <input class="name-input" value={newUsername} oninput={(e) => newUsername = e.target.value} onkeydown={(e) => e.key === 'Enter' && saveName()} autofocus />
            <button class="name-save" onclick={saveName} disabled={savingName}>{savingName ? '…' : '✓'}</button>
            <button class="name-cancel" onclick={() => { editingName = false; newUsername = profile.username; }}>✕</button>
          </div>
        {:else}
          <div class="name-row">
            <h1 class="profile-name">@{profile?.username}</h1>
            <button class="name-rename-btn" onclick={() => editingName = true} title="Rename">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              RENAME
            </button>
          </div>
        {/if}
        <div class="profile-email">{me?.email}</div>

        <!-- XP LEVEL BAR -->
        <div class="xp-inline">
          <div class="xp-level-tag">LVL {level}</div>
          <div class="xp-bar-wrap">
            <div class="xp-bar-fill" style="width:{levelProgress}%"></div>
          </div>
          <div class="xp-num">{totalXP} / {level * XP_PER_LEVEL} XP</div>
        </div>
      </div>

      <!-- QUICK STATS -->
      <div class="quick-stats">
        <div class="qs-item"><div class="qs-val">{xpStats.logged}</div><div class="qs-label">Logged</div></div>
        <div class="qs-div"></div>
        <div class="qs-item"><div class="qs-val">{xpStats.favs}</div><div class="qs-label">Favorites</div></div>
        <div class="qs-div"></div>
        <div class="qs-item"><div class="qs-val">{earnedBadges.length}</div><div class="qs-label">Badges</div></div>
        <div class="qs-div"></div>
        <div class="qs-item"><div class="qs-val">{xpStats.completedStreaks}</div><div class="qs-label">Streaks Done</div></div>
      </div>
    </div>
  </div>

  <!-- TAB BAR -->
  <div class="tab-bar">
    <button class="tab-btn {activeTab === 'overview' ? 'tab-active' : ''}" onclick={() => activeTab = 'overview'}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      Overview
    </button>
    <button class="tab-btn {activeTab === 'notifications' ? 'tab-active' : ''}" onclick={() => activeTab = 'notifications'}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      Notifications
      {#if unreadNotifs > 0}<span class="tab-badge">{unreadNotifs}</span>{/if}
    </button>
    <button class="tab-btn {activeTab === 'xp' ? 'tab-active' : ''}" onclick={() => activeTab = 'xp'}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      XP & Badges
    </button>
  </div>

  <!-- ── OVERVIEW TAB (REBUILT) ── -->
  {#if activeTab === 'overview'}
  <div class="overview-wrap">
    <!-- STREAK -->
    <section class="panel streak-panel">
      {#if activeStreak}
        <div class="streak-live">
          <div class="streak-top">
            <div class="streak-badge">
              <span class="live-dot"></span>
              ACTIVE STREAK
            </div>
            <button class="panel-link" onclick={() => goto('/app/streak')}>Open →</button>
          </div>
          <div class="streak-core">
            <div class="streak-day-pill">
              <span class="sdl">DAY</span>
              <span class="sdn">{streakDay(activeStreak)}</span>
              <span class="sdo">of {activeStreak.duration_days}</span>
            </div>
            <div class="streak-meta">
              <div class="meta-row">
                <div class="meta-cell">
                  <span class="mcn">{activeStreak.duration_days}</span>
                  <span class="mcl">Total</span>
                </div>
                <div class="meta-cell">
                  <span class="mcn">{Math.max(0, activeStreak.duration_days - streakDay(activeStreak) + 1)}</span>
                  <span class="mcl">Left</span>
                </div>
                <div class="meta-cell">
                  <span class="mcn">{activeStreak.status === 'pending' ? '⏳' : '🔥'}</span>
                  <span class="mcl">Status</span>
                </div>
              </div>
              {#if activeStreak.status === 'active' && activeStreak.duration_days}
                {@const pct = Math.min(100, Math.round(streakDay(activeStreak) / activeStreak.duration_days * 100))}
                <div class="meta-progress">
                  <div class="mp-track"><div class="mp-fill" style="width:{pct}%"></div></div>
                  <span class="mp-label">{pct}%</span>
                </div>
              {/if}
              <div class="meta-tags">
                {#each (activeStreak.genres || []) as g}<span class="mtag">{g}</span>{/each}
                {#if activeStreak.is_temporary}<span class="mtag temp">⚡ Temp</span>{/if}
              </div>
            </div>
            <div class="streak-fire">🔥</div>
          </div>
        </div>
      {:else}
        <div class="streak-empty">
          <div class="se-emoji">🔥</div>
          <div class="se-title">No Active Streak</div>
          <div class="se-desc">Start a streak and watch movies daily with friends.</div>
          <button class="se-action" onclick={() => goto('/app/streak')}>Create Streak</button>
        </div>
      {/if}
    </section>

    <!-- LOGGED MOVIES -->
    <section class="panel">
      <div class="panel-head">
        <div class="panel-label"><span class="dot gold"></span>Logged Movies</div>
        <button class="panel-link" onclick={() => goto('/app/logged')}>See all →</button>
      </div>
      {#if loggedMovies.length === 0}
        <div class="empty-box">
          <div class="eb-icon">🎬</div>
          <div class="eb-text">Nothing logged yet</div>
          <button class="eb-btn" onclick={() => goto('/app/logged')}>Log a Movie</button>
        </div>
      {:else}
        <div class="movie-strip">
          {#each loggedMovies as movie}
            <a class="movie-tile" href="/app/guide?type={movie.type}&id={movie.tmdb_id}">
              {#if movie.poster}
                <img src={movie.poster} alt={movie.title} loading="lazy" />
              {:else}
                <div class="tile-ph">{movie.title.slice(0,2).toUpperCase()}</div>
              {/if}
              <div class="tile-info">
                <div class="ti-title">{movie.title}</div>
                <div class="ti-rating">★ {movie.rating?.toFixed(1) || '—'}</div>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </section>

    <!-- BOTTOM GRID: Taste + Favorites -->
    <div class="bottom-grid">
      <section class="panel">
        <div class="panel-head">
          <div class="panel-label"><span class="dot red"></span>Your Taste</div>
          <button class="panel-link" onclick={() => goto('/app/favorites')}>Edit →</button>
        </div>
        {#if genreTaste.length === 0}
          <div class="empty-box compact">
            <div class="eb-icon">🎭</div>
            <div class="eb-text">No taste profile yet</div>
            <button class="eb-btn" onclick={() => goto('/app/logged')}>Log Movies</button>
          </div>
        {:else}
          <div class="taste-list">
            {#each genreTaste as g, i}
              <div class="taste-item">
                <span class="tname">{g.name}</span>
                <div class="tbar"><div class="tbar-fill" style="width:{Math.min(100, (g.count / (genreTaste[0]?.count || 1)) * 100)}%;--d:{i * 0.08}s"></div></div>
                <span class="tcount">{g.count}</span>
              </div>
            {/each}
          </div>
          <button class="taste-btn" onclick={() => goto('/app/favorites')}>❤ Explore Favorites</button>
        {/if}
      </section>

      <section class="panel">
        <div class="panel-head">
          <div class="panel-label"><span class="dot red"></span>Favorites</div>
          <button class="panel-link" onclick={() => goto('/app/favorites')}>See all →</button>
        </div>
        {#if favorites.length === 0}
          <div class="empty-box compact">
            <div class="eb-icon">❤️</div>
            <div class="eb-text">No favorites saved</div>
            <button class="eb-btn" onclick={() => goto('/app/favorites')}>Add Favorites</button>
          </div>
        {:else}
          <div class="fav-grid">
            {#each favorites.slice(0, 9) as fav}
              <a class="fav-cell" href="/app/guide?type={fav.type}&id={fav.tmdb_id}">
                {#if fav.poster}
                  <img src={fav.poster} alt={fav.title} loading="lazy" />
                {:else}
                  <div class="fav-ph">{fav.title.slice(0,2)}</div>
                {/if}
                <span class="fav-heart">♥</span>
              </a>
            {/each}
          </div>
        {/if}
      </section>
    </div>
  </div>
  {/if}

  <!-- ── NOTIFICATIONS TAB ── -->
  {#if activeTab === 'notifications'}
  <div class="tab-content">
    <div class="notif-header-row">
      <h2 class="tab-title">Notifications</h2>
      <button class="panel-link" onclick={() => goto('/app/notifications')}>SEE ALL →</button>
    </div>
    {#if notifications.length === 0}
      <div class="big-empty"><div class="be-icon">🔔</div><div class="be-title">All clear!</div><div class="be-sub">No notifications yet. Start watching with friends to get alerts.</div></div>
    {:else}
      <div class="notif-list">
        {#each notifications.slice(0, 20) as notif}
          <div class="notif-item {notif.read ? '' : 'notif-unread'}" onclick={() => toggleNotifRead(notif.id)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleNotifRead(notif.id)}>
            <div class="notif-icon-wrap">{notif.icon}</div>
            <div class="notif-body">
              <div class="notif-content">{notif.content}</div>
              <div class="notif-time">{timeAgo(notif.at)} · {notif.read ? 'Read' : 'Click to mark read'}</div>
            </div>
            {#if !notif.read}<div class="notif-dot"></div>{/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
  {/if}

  <!-- ── XP & BADGES TAB ── -->
  {#if activeTab === 'xp'}
  <div class="tab-content">
    <h2 class="tab-title">XP & Badges</h2>
    <div class="xp-big-card">
      <div class="xp-bg-mesh"></div>
      <div class="xp-level-display">
        <div class="xp-level-circle">
          <svg viewBox="0 0 120 120" class="xp-circle-svg">
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(201,168,76,0.12)" stroke-width="8"/>
            <circle cx="60" cy="60" r="52" fill="none" stroke="#c9a84c" stroke-width="8" stroke-dasharray="326.7" stroke-dashoffset={326.7 - (326.7 * levelProgress / 100)} stroke-linecap="round" transform="rotate(-90 60 60)"/>
          </svg>
          <div class="xp-level-inner"><div class="xp-level-num">{level}</div><div class="xp-level-txt">LEVEL</div></div>
        </div>
        <div class="xp-stats-col">
          <div class="xp-stat-row"><span class="xp-stat-label">Total XP</span><span class="xp-stat-val gold">{totalXP.toLocaleString()}</span></div>
          <div class="xp-stat-row"><span class="xp-stat-label">Movies Logged</span><span class="xp-stat-val">{xpStats.logged} × 50 = <span class="gold">{xpStats.logged * 50} XP</span></span></div>
          <div class="xp-stat-row"><span class="xp-stat-label">Favorites</span><span class="xp-stat-val">{xpStats.favs} × 20 = <span class="gold">{xpStats.favs * 20} XP</span></span></div>
          <div class="xp-stat-row"><span class="xp-stat-label">Streak Days</span><span class="xp-stat-val">{xpStats.streaks} × 10 = <span class="gold">{xpStats.streaks * 10} XP</span></span></div>
          <div class="xp-next-row"><span>{XP_PER_LEVEL - (totalXP % XP_PER_LEVEL)} XP to Level {level + 1}</span><div class="xp-mini-bar"><div class="xp-mini-fill" style="width:{levelProgress}%"></div></div></div>
        </div>
      </div>
    </div>

    <div class="badges-section">
      <div class="badges-eyebrow">EARNED BADGES · {earnedBadges.length}/{BADGES.length}</div>
      <div class="badges-grid">
        {#each BADGES as badge}
          {@const earned = badge.req(xpStats)}
          <div class="badge-card {earned ? 'badge-earned' : 'badge-locked'}">
            <div class="badge-icon">{badge.icon}</div>
            <div class="badge-name">{badge.name}</div>
            <div class="badge-desc">{badge.desc}</div>
            {#if earned}<div class="badge-check">✓</div>{:else}<div class="badge-lock">🔒</div>{/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
  {/if}

  {/if}
</main>

<!-- AVATAR PICKER OVERLAY -->
{#if showAvatarPicker}
  <div class="overlay" onclick={() => showAvatarPicker = false}>
    <div class="avatar-picker-card" onclick={(e) => e.stopPropagation()}>
      <div class="apc-header">
        <h3 class="apc-title">Choose Your Avatar</h3>
        <button class="apc-close" onclick={() => showAvatarPicker = false}>✕</button>
      </div>
      <div class="apc-grid">
        {#each DEFAULT_AVATARS as av}
          <button class="apc-option {profile?.avatar_url === av.id ? 'apc-sel' : ''}" onclick={() => saveAvatar(av.id)} disabled={savingAvatar}>
            <div class="apc-avatar" style="background:{av.bg}">{av.emoji}</div>
            <div class="apc-name">{av.id}</div>
          </button>
        {/each}
      </div>
      <div class="apc-divider"><span>or upload your own</span></div>
      <button class="apc-upload" onclick={() => fileInput?.click()}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
        Upload from Device
      </button>
    </div>
  </div>
{/if}

<style>
  :global(*){margin:0;padding:0;box-sizing:border-box}
  :global(html,body){background:#050505;color:#f0ece4;font-family:'Sora',sans-serif;min-height:100vh;overflow-x:hidden}

  .grain{position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:.035;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}

  .nav{position:fixed;top:0;left:0;right:0;z-index:500;height:58px;padding:0 20px;
    display:flex;align-items:center;justify-content:space-between;
    background:rgba(5,5,5,.95);backdrop-filter:blur(20px);
    border-bottom:1px solid rgba(201,168,76,.1)}
  .nav-back{display:flex;align-items:center;gap:6px;background:none;
    border:1px solid rgba(255,255,255,.1);color:rgba(240,236,228,.45);
    font-family:'Space Mono',monospace;font-size:.54rem;letter-spacing:.12em;
    padding:7px 14px;cursor:pointer;border-radius:20px;transition:.2s}
  .nav-back:hover{border-color:rgba(201,168,76,.4);color:#c9a84c}
  .nav-logo{display:flex;align-items:baseline;gap:0}
  .logo-mark{font-family:'Cormorant Garamond',serif;font-size:1.5rem;font-weight:700;color:#c9a84c}
  .logo-rest{font-family:'Cormorant Garamond',serif;font-size:1.2rem;color:#f0ece4;opacity:.7}
  .notif-badge-btn{display:flex;align-items:center;gap:6px;background:rgba(201,168,76,.1);
    border:1px solid rgba(201,168,76,.3);color:#c9a84c;font-family:'Space Mono',monospace;
    font-size:.56rem;padding:7px 12px;border-radius:20px;cursor:pointer;transition:.2s}
  .notif-badge-btn:hover{background:rgba(201,168,76,.2)}
  .notif-badge-btn span{font-weight:700}

  .page{padding:72px 0 80px;max-width:1100px;margin:0 auto;padding-left:20px;padding-right:20px}
  .full-center{height:80vh;display:flex;align-items:center;justify-content:center}
  .loader{position:relative;width:80px;height:80px;display:flex;align-items:center;justify-content:center}
  .loader-ring{position:absolute;inset:0;border-radius:50%;border:2px solid transparent;border-top-color:rgba(201,168,76,.6);animation:spin .8s linear infinite}
  .loader-ring.r2{inset:8px;border-top-color:rgba(201,168,76,.25);animation-duration:1.3s;animation-direction:reverse}
  .loader-icon{font-size:1.8rem;color:#c9a84c;animation:pulse 1.5s ease-in-out infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}

  /* PROFILE HERO */
  .profile-hero{position:relative;overflow:hidden;border-radius:24px;background:#080808;border:1px solid rgba(201,168,76,.18);padding:40px 32px;margin-bottom:28px}
  .hero-bg-mesh{position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 20% 0%,rgba(201,168,76,.08) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 90% 100%,rgba(95,191,140,.05) 0%,transparent 50%);pointer-events:none}
  .hero-orb{position:absolute;border-radius:50%;filter:blur(60px);pointer-events:none;animation:orbDrift 8s ease-in-out infinite}
  .o1{width:300px;height:300px;background:rgba(201,168,76,.07);top:-100px;left:-80px}
  .o2{width:200px;height:200px;background:rgba(95,191,140,.05);bottom:-60px;right:10%;animation-delay:2.5s;animation-direction:reverse}
  .o3{width:150px;height:150px;background:rgba(93,173,226,.04);top:20%;right:-50px;animation-delay:5s}
  @keyframes orbDrift{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,-15px)}}

  .profile-identity{position:relative;z-index:1;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:28px}

  /* AVATAR */
  .avatar-wrap{position:relative;flex-shrink:0}
  .avatar-shell{width:90px;height:90px;border-radius:50%;border:2px solid rgba(201,168,76,.3);overflow:hidden;position:relative}
  .avatar-shell.loading{display:flex;align-items:center;justify-content:center;background:#111}
  .avatar-spinner{width:28px;height:28px;border:2px solid rgba(201,168,76,.2);border-top-color:#c9a84c;border-radius:50%;animation:spin .7s linear infinite}
  .emoji-shell{display:flex;align-items:center;justify-content:center}
  .avatar-img{width:100%;height:100%;object-fit:cover;display:block}
  .avatar-emoji{font-size:2.4rem;line-height:1}
  .avatar-edit-btn{position:absolute;bottom:0;right:0;width:26px;height:26px;border-radius:50%;background:#0d0d0d;border:1px solid rgba(201,168,76,.4);color:#c9a84c;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.2s;z-index:2}
  .avatar-edit-btn:hover{background:#c9a84c;color:#050505}
  .avatar-level-ring{position:absolute;inset:-4px;border-radius:50%;border:2px solid transparent;background:conic-gradient(#c9a84c var(--pct), rgba(255,255,255,.06) var(--pct)) border-box;-webkit-mask:linear-gradient(#fff 0 0) padding-box,linear-gradient(#fff 0 0);-webkit-mask-composite:destination-out;mask-composite:exclude;pointer-events:none}

  /* IDENTITY TEXT */
  .identity-text{display:flex;flex-direction:column;gap:8px;min-width:0}
  .name-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .profile-name{font-family:'Cormorant Garamond',serif;font-size:2.2rem;font-weight:700;color:#f0ece4;line-height:1}
  .name-rename-btn{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:rgba(240,236,228,.35);font-family:'Space Mono',monospace;font-size:.48rem;letter-spacing:.12em;padding:5px 10px;border-radius:20px;cursor:pointer;transition:.2s}
  .name-rename-btn:hover{border-color:rgba(201,168,76,.4);color:#c9a84c}
  .name-edit-row{display:flex;align-items:center;gap:8px}
  .name-input{background:#111;border:1px solid rgba(201,168,76,.4);border-radius:8px;padding:8px 14px;color:#f0ece4;font-family:'Sora',sans-serif;font-size:1.1rem;outline:none;width:220px}
  .name-save{background:#c9a84c;border:none;color:#050505;font-family:'Space Mono',monospace;font-size:.6rem;font-weight:700;padding:8px 14px;border-radius:8px;cursor:pointer;transition:.2s}
  .name-save:hover{background:#e8c46a}
  .name-cancel{background:none;border:1px solid rgba(255,255,255,.1);color:rgba(240,236,228,.4);font-size:.8rem;width:32px;height:32px;border-radius:8px;cursor:pointer;transition:.2s}
  .name-cancel:hover{border-color:#e74c3c;color:#e74c3c}
  .profile-email{font-family:'Space Mono',monospace;font-size:.52rem;color:rgba(240,236,228,.28);letter-spacing:.06em}

  /* XP INLINE */
  .xp-inline{display:flex;align-items:center;gap:10px;margin-top:4px}
  .xp-level-tag{font-family:'Space Mono',monospace;font-size:.52rem;letter-spacing:.1em;background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.35);color:#c9a84c;padding:3px 10px;border-radius:20px}
  .xp-bar-wrap{flex:1;max-width:180px;height:4px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden}
  .xp-bar-fill{height:100%;background:linear-gradient(90deg,#c9a84c,#e8c46a);border-radius:2px;transition:width .6s ease}
  .xp-num{font-family:'Space Mono',monospace;font-size:.5rem;color:rgba(201,168,76,.6)}

  /* QUICK STATS */
  .quick-stats{display:flex;align-items:center;gap:0;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:16px 20px;flex-shrink:0}
  .qs-item{display:flex;flex-direction:column;align-items:center;gap:3px;padding:0 18px}
  .qs-val{font-family:'Cormorant Garamond',serif;font-size:1.7rem;font-weight:700;color:#c9a84c;line-height:1}
  .qs-label{font-family:'Space Mono',monospace;font-size:.46rem;letter-spacing:.1em;color:rgba(240,236,228,.3)}
  .qs-div{width:1px;height:36px;background:rgba(255,255,255,.07)}

  /* TAB BAR */
  .tab-bar{display:flex;gap:4px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:4px;margin-bottom:24px}
  .tab-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;background:none;border:none;color:rgba(240,236,228,.4);font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.08em;padding:10px 16px;border-radius:9px;cursor:pointer;transition:.2s;position:relative}
  .tab-btn:hover{color:rgba(240,236,228,.7)}
  .tab-active{background:rgba(201,168,76,.15);color:#c9a84c!important;border:1px solid rgba(201,168,76,.25)}
  .tab-badge{width:18px;height:18px;border-radius:50%;background:#e74c3c;color:#fff;font-size:.48rem;display:flex;align-items:center;justify-content:center;font-weight:700}

  /* ── OVERVIEW TAB ── */
  .overview-wrap{display:flex;flex-direction:column;gap:20px}

  .panel{background:#0a0a0a;border:1px solid rgba(255,255,255,.07);border-radius:20px;padding:24px}
  .panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
  .panel-label{display:flex;align-items:center;gap:8px;font-family:'Space Mono',monospace;font-size:.52rem;letter-spacing:.18em;color:rgba(240,236,228,.4);text-transform:uppercase}
  .dot{width:6px;height:6px;border-radius:50%}
  .dot.gold{background:#c9a84c;box-shadow:0 0 8px rgba(201,168,76,.5)}
  .dot.red{background:#e74c3c;box-shadow:0 0 8px rgba(231,76,60,.5)}
  .panel-link{background:none;border:1px solid rgba(201,168,76,.25);color:rgba(201,168,76,.7);font-family:'Space Mono',monospace;font-size:.5rem;letter-spacing:.1em;padding:5px 12px;border-radius:20px;cursor:pointer;transition:.2s}
  .panel-link:hover{background:rgba(201,168,76,.1);color:#c9a84c}

  /* Streak */
  .streak-panel{background:linear-gradient(180deg,#0a0a0a,#0c0b08);border-color:rgba(201,168,76,.18)}
  .streak-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
  .streak-badge{display:flex;align-items:center;gap:8px;font-family:'Space Mono',monospace;font-size:.52rem;letter-spacing:.18em;color:rgba(240,236,228,.4)}
  .live-dot{width:7px;height:7px;border-radius:50%;background:#e74c3c;box-shadow:0 0 8px #e74c3c;animation:pulse 1.5s ease-in-out infinite}
  .streak-core{display:flex;align-items:center;gap:24px}
  .streak-day-pill{flex-shrink:0;text-align:center;background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);border-radius:16px;padding:16px 22px;min-width:95px}
  .sdl{font-family:'Space Mono',monospace;font-size:.44rem;letter-spacing:.2em;color:rgba(201,168,76,.6);display:block;margin-bottom:2px}
  .sdn{font-family:'Cormorant Garamond',serif;font-size:2.8rem;font-weight:700;color:#c9a84c;line-height:1;display:block}
  .sdo{font-family:'Space Mono',monospace;font-size:.48rem;color:rgba(201,168,76,.5);letter-spacing:.1em}
  .streak-meta{flex:1;min-width:0;display:flex;flex-direction:column;gap:12px}
  .meta-row{display:flex;gap:10px}
  .meta-cell{flex:1;text-align:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 6px}
  .mcn{font-family:'Cormorant Garamond',serif;font-size:1.5rem;font-weight:700;color:#c9a84c;line-height:1;display:block}
  .mcl{font-family:'Space Mono',monospace;font-size:.42rem;color:rgba(240,236,228,.3);letter-spacing:.08em;margin-top:3px;display:block}
  .meta-progress{display:flex;align-items:center;gap:10px}
  .mp-track{flex:1;height:5px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden}
  .mp-fill{height:100%;background:linear-gradient(90deg,#c9a84c,#e8c46a);border-radius:3px;transition:width .5s ease}
  .mp-label{font-family:'Space Mono',monospace;font-size:.46rem;color:rgba(201,168,76,.6);flex-shrink:0;min-width:32px;text-align:right}
  .meta-tags{display:flex;gap:6px;flex-wrap:wrap}
  .mtag{background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);color:#c9a84c;font-family:'Space Mono',monospace;font-size:.48rem;letter-spacing:.06em;padding:3px 10px;border-radius:20px}
  .mtag.temp{background:rgba(93,173,226,.1);border-color:rgba(93,173,226,.2);color:#5dade2}
  .streak-fire{flex-shrink:0;font-size:2.2rem;animation:fireWobble 2.5s ease-in-out infinite;padding:0 10px}
  @keyframes fireWobble{0%,100%{transform:scale(1) rotate(-2deg)}50%{transform:scale(1.08) rotate(2deg)}}

  .streak-empty{display:flex;flex-direction:column;align-items:center;padding:28px 0;gap:10px;text-align:center}
  .se-emoji{font-size:2.2rem;opacity:.35}
  .se-title{font-family:'Cormorant Garamond',serif;font-size:1.2rem;font-weight:600;color:rgba(240,236,228,.4)}
  .se-desc{font-size:.75rem;color:rgba(240,236,228,.22);max-width:280px;line-height:1.5}
  .se-action{background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.4);color:#c9a84c;font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.1em;padding:10px 22px;border-radius:30px;cursor:pointer;transition:.2s;margin-top:4px}
  .se-action:hover{background:rgba(201,168,76,.25)}

  /* Movie Strip */
  .movie-strip{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin;scrollbar-color:rgba(201,168,76,.2) transparent}
  .movie-strip::-webkit-scrollbar{height:4px}
  .movie-strip::-webkit-scrollbar-thumb{background:rgba(201,168,76,.2);border-radius:2px}
  .movie-tile{position:relative;flex:0 0 88px;height:132px;border-radius:10px;overflow:hidden;background:#111;border:1px solid rgba(255,255,255,.07);cursor:pointer;transition:.2s;text-decoration:none;display:block}
  .movie-tile:hover{transform:translateY(-3px);border-color:rgba(201,168,76,.3)}
  .movie-tile img{width:100%;height:100%;object-fit:cover;opacity:.82;display:block;transition:opacity .3s}
  .movie-tile:hover img{opacity:1}
  .tile-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:1.2rem;font-weight:700;color:rgba(201,168,76,.25)}
  .tile-info{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.92));padding:14px 6px 6px;opacity:0;transition:.2s}
  .movie-tile:hover .tile-info{opacity:1}
  .ti-title{font-size:.58rem;font-weight:600;color:#f0ece4;line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .ti-rating{font-family:'Space Mono',monospace;font-size:.46rem;color:#c9a84c;margin-top:3px}

  /* Bottom Grid */
  .bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}

  /* Taste */
  .taste-list{display:flex;flex-direction:column;gap:10px;margin-bottom:16px}
  .taste-item{display:flex;align-items:center;gap:10px}
  .tname{font-family:'Space Mono',monospace;font-size:.52rem;color:rgba(240,236,228,.6);letter-spacing:.06em;width:90px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tbar{flex:1;height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden}
  .tbar-fill{height:100%;background:linear-gradient(90deg,#e74c3c,#c0392b);border-radius:3px;animation:barGrow .7s ease-out forwards;animation-delay:var(--d,0s)}
  @keyframes barGrow{from{width:0}to{}}
  .tcount{font-family:'Space Mono',monospace;font-size:.48rem;color:rgba(240,236,228,.3);width:22px;text-align:right;flex-shrink:0}
  .taste-btn{width:100%;background:rgba(231,76,60,.1);border:1px solid rgba(231,76,60,.25);color:#e74c3c;font-family:'Space Mono',monospace;font-size:.54rem;letter-spacing:.1em;padding:10px;border-radius:10px;cursor:pointer;transition:.2s}
  .taste-btn:hover{background:rgba(231,76,60,.18)}

  /* Favorites Grid */
  .fav-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
  .fav-cell{position:relative;aspect-ratio:2/3;border-radius:8px;overflow:hidden;background:#111;border:1px solid rgba(255,255,255,.07);cursor:pointer;display:block;text-decoration:none;transition:.2s}
  .fav-cell:hover{transform:scale(1.03);border-color:rgba(231,76,60,.35)}
  .fav-cell img{width:100%;height:100%;object-fit:cover;opacity:.85;display:block;transition:.3s}
  .fav-cell:hover img{opacity:1}
  .fav-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:1rem;font-weight:700;color:rgba(231,76,60,.25)}
  .fav-cell .fav-heart{position:absolute;bottom:4px;right:4px;width:18px;height:18px;border-radius:50%;background:rgba(231,76,60,.9);color:#fff;font-size:.55rem;display:flex;align-items:center;justify-content:center}

  /* Empty States */
  .empty-box{display:flex;flex-direction:column;align-items:center;padding:24px 0;gap:10px;text-align:center}
  .empty-box.compact{padding:14px 0}
  .eb-icon{font-size:1.8rem;opacity:.35}
  .eb-text{font-family:'Cormorant Garamond',serif;font-size:1rem;color:rgba(240,236,228,.35)}
  .eb-btn{background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.3);color:#c9a84c;font-family:'Space Mono',monospace;font-size:.52rem;letter-spacing:.1em;padding:8px 16px;border-radius:20px;cursor:pointer;transition:.2s}
  .eb-btn:hover{background:rgba(201,168,76,.22)}

  /* TAB CONTENT */
  .tab-content{max-width:820px;margin:0 auto}
  .tab-title{font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:700;margin-bottom:24px}
  .notif-header-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}

  /* NOTIFICATIONS */
  .notif-list{display:flex;flex-direction:column;gap:8px}
  .notif-item{display:flex;align-items:flex-start;gap:14px;background:#0d0d0d;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:16px;position:relative;transition:.2s;cursor:pointer;user-select:none}
  .notif-item:hover{border-color:rgba(255,255,255,.15);background:rgba(255,255,255,.02)}
  .notif-unread{border-color:rgba(201,168,76,.15);background:rgba(201,168,76,.03)}
  .notif-unread:hover{border-color:rgba(201,168,76,.3);background:rgba(201,168,76,.06)}
  .notif-icon-wrap{font-size:1.4rem;flex-shrink:0;width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.04);border-radius:10px}
  .notif-body{flex:1;min-width:0}
  .notif-content{font-size:.82rem;color:rgba(240,236,228,.7);line-height:1.5}
  .notif-time{font-family:'Space Mono',monospace;font-size:.46rem;color:rgba(240,236,228,.25);letter-spacing:.06em;margin-top:5px}
  .notif-dot{width:7px;height:7px;border-radius:50%;background:#c9a84c;box-shadow:0 0 6px rgba(201,168,76,.6);flex-shrink:0;margin-top:6px}

  .big-empty{display:flex;flex-direction:column;align-items:center;padding:80px 0;gap:14px;text-align:center}
  .be-icon{font-size:3rem;opacity:.3}
  .be-title{font-family:'Cormorant Garamond',serif;font-size:1.8rem;color:rgba(240,236,228,.4)}
  .be-sub{font-size:.8rem;color:rgba(240,236,228,.22);max-width:340px;line-height:1.7}

  /* XP CARD */
  .xp-big-card{position:relative;background:#0a0a0a;border:1px solid rgba(201,168,76,.2);border-radius:24px;padding:32px;margin-bottom:32px;overflow:hidden}
  .xp-bg-mesh{position:absolute;inset:0;background:radial-gradient(ellipse 70% 80% at 10% 50%,rgba(201,168,76,.07),transparent 60%);pointer-events:none}
  .xp-level-display{position:relative;z-index:1;display:flex;align-items:center;gap:40px}
  .xp-level-circle{position:relative;width:130px;height:130px;flex-shrink:0}
  .xp-circle-svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(0deg)}
  .xp-level-inner{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .xp-level-num{font-family:'Cormorant Garamond',serif;font-size:3rem;font-weight:700;color:#c9a84c;line-height:1}
  .xp-level-txt{font-family:'Space Mono',monospace;font-size:.44rem;letter-spacing:.18em;color:rgba(201,168,76,.5)}
  .xp-stats-col{flex:1;display:flex;flex-direction:column;gap:12px}
  .xp-stat-row{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,.03);border-radius:10px}
  .xp-stat-label{font-family:'Space Mono',monospace;font-size:.52rem;color:rgba(240,236,228,.35);letter-spacing:.06em}
  .xp-stat-val{font-family:'Space Mono',monospace;font-size:.6rem;color:rgba(240,236,228,.6)}
  .xp-stat-val .gold,.gold{color:#c9a84c;font-weight:700}
  .xp-next-row{display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.12);border-radius:10px;font-family:'Space Mono',monospace;font-size:.52rem;color:rgba(201,168,76,.7)}
  .xp-mini-bar{flex:1;height:4px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden}
  .xp-mini-fill{height:100%;background:#c9a84c;border-radius:2px;transition:width .6s ease}

  /* BADGES */
  .badges-eyebrow{font-family:'Space Mono',monospace;font-size:.54rem;letter-spacing:.18em;color:rgba(240,236,228,.3);margin-bottom:16px}
  .badges-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
  .badge-card{position:relative;background:#0a0a0a;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:20px 16px;text-align:center;transition:.2s;overflow:hidden}
  .badge-earned{border-color:rgba(201,168,76,.3);background:rgba(201,168,76,.04)}
  .badge-earned:hover{border-color:#c9a84c;transform:translateY(-3px)}
  .badge-locked{opacity:.35}
  .badge-icon{font-size:2rem;margin-bottom:8px;display:block}
  .badge-name{font-family:'Cormorant Garamond',serif;font-size:1rem;font-weight:600;margin-bottom:4px}
  .badge-desc{font-family:'Space Mono',monospace;font-size:.44rem;color:rgba(240,236,228,.3);letter-spacing:.04em;line-height:1.5}
  .badge-check{position:absolute;top:8px;right:8px;width:18px;height:18px;border-radius:50%;background:#c9a84c;color:#050505;font-size:.55rem;font-weight:700;display:flex;align-items:center;justify-content:center}
  .badge-lock{position:absolute;top:8px;right:8px;font-size:.7rem;opacity:.5}

  /* AVATAR PICKER */
  .overlay{position:fixed;inset:0;z-index:1000;background:rgba(5,5,5,.88);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:20px}
  .avatar-picker-card{background:#0c0c0c;border:1px solid rgba(201,168,76,.3);border-radius:24px;padding:32px;max-width:480px;width:100%;animation:popIn .25s cubic-bezier(.34,1.56,.64,1)}
  @keyframes popIn{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
  .apc-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
  .apc-title{font-family:'Cormorant Garamond',serif;font-size:1.6rem;font-weight:700}
  .apc-close{background:none;border:1px solid rgba(255,255,255,.1);color:rgba(240,236,228,.4);width:28px;height:28px;border-radius:50%;cursor:pointer;transition:.2s;font-size:.9rem}
  .apc-close:hover{border-color:#e74c3c;color:#e74c3c}
  .apc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
  .apc-option{background:none;border:2px solid rgba(255,255,255,.08);border-radius:14px;padding:12px 8px;cursor:pointer;transition:.2s;display:flex;flex-direction:column;align-items:center;gap:6px}
  .apc-option:hover{border-color:rgba(201,168,76,.4)}
  .apc-sel{border-color:#c9a84c!important;background:rgba(201,168,76,.1)}
  .apc-avatar{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.6rem}
  .apc-name{font-family:'Space Mono',monospace;font-size:.44rem;color:rgba(240,236,228,.35);letter-spacing:.06em;text-transform:capitalize}
  .apc-divider{text-align:center;position:relative;font-family:'Space Mono',monospace;font-size:.5rem;color:rgba(240,236,228,.2);letter-spacing:.12em;margin-bottom:16px}
  .apc-divider::before{content:'';position:absolute;top:50%;left:0;right:0;height:1px;background:rgba(255,255,255,.06)}
  .apc-divider span{background:#0c0c0c;position:relative;padding:0 14px}
  .apc-upload{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;background:rgba(255,255,255,.04);border:1px dashed rgba(255,255,255,.15);color:rgba(240,236,228,.5);font-family:'Space Mono',monospace;font-size:.58rem;letter-spacing:.08em;padding:14px;border-radius:12px;cursor:pointer;transition:.2s}
  .apc-upload:hover{background:rgba(201,168,76,.08);border-color:rgba(201,168,76,.3);color:#c9a84c}

  @media(max-width:900px){
    .profile-identity{grid-template-columns:auto 1fr;grid-template-rows:auto auto}
    .quick-stats{grid-column:1/-1;justify-content:center}
    .bottom-grid{grid-template-columns:1fr}
    .streak-core{gap:16px}
    .streak-fire{display:none}
  }
  @media(max-width:600px){
    .profile-identity{grid-template-columns:1fr;text-align:center}
    .avatar-wrap{margin:0 auto}
    .name-row{justify-content:center}
    .xp-inline{justify-content:center}
    .profile-email{text-align:center}
    .quick-stats{flex-wrap:wrap}
    .xp-level-display{flex-direction:column;align-items:flex-start;gap:20px}
    .badges-grid{grid-template-columns:repeat(2,1fr)}
    .apc-grid{grid-template-columns:repeat(4,1fr)}
    .streak-core{flex-direction:column;align-items:stretch;text-align:center}
    .streak-day-pill{margin:0 auto}
    .meta-progress{max-width:300px;margin:0 auto;width:100%}
    .meta-tags{justify-content:center}
    .movie-tile{flex:0 0 80px;height:120px}
    .bottom-grid{grid-template-columns:1fr}
  }
</style>