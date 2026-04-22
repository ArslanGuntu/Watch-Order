<script>
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';

  const TMDB_KEY = '175b19b3ba717bf4f24e37ee4325be7e';
  const BASE = 'https://api.themoviedb.org/3';
  const IMG = 'https://image.tmdb.org/t/p/w200';

  // ── STATE ──
  let me             = $state(null);
  let searchQ        = $state('');
  let searchResults  = $state([]);
  let searchLoading  = $state(false);
  let searchTimer    = null;
  let conversations  = $state([]);
  let activeConv     = $state(null);
  let messages       = $state([]);
  let msgInput       = $state('');
  let sending        = $state(false);
  let msgsEl;
  let realtimeSub    = null;
  let convRealtimeSub = null;

  let typingUsers    = $state(new Map());
  let myTypingTimer  = null;
  let typingChannel  = null;

  let tmdbResults    = $state([]);
  let tmdbLoading    = $state(false);
  let showTmdbPicker = $state(false);
  let tmdbTimer      = null;
  let selectedEntities = $state([]);

  let selectedMovie  = $state(null);
  let showMovieModal = $state(false);

  // ── REPLY STATE ──
  let replyingTo     = $state(null); // { id, content, sender_name, entities }

  // ── DELETE MENU STATE ──
  let deleteMenu     = $state(null); // message object
  let deleteMenuPos  = $state({ x: 0, y: 0 });

  // ── STREAK REQUEST ──
  let processingReq  = $state(null);

  function getInitials(name) {
    return (name ?? '?').slice(0, 2).toUpperCase();
  }

  // ── BOOT ──
  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: { user: authUser } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles').select('id, username').eq('id', session.user.id).single();

    me = {
      id:       session.user.id,
      username: profile?.username || authUser?.email?.split('@')[0] || 'user',
      avatar:   authUser?.user_metadata?.avatar_url || null,
      email:    authUser?.email
    };

    await loadConversations();
    subscribeConversations();
  });

  onDestroy(() => {
    realtimeSub?.unsubscribe();
    convRealtimeSub?.unsubscribe();
    typingChannel?.unsubscribe();
    clearTimeout(searchTimer);
    clearTimeout(tmdbTimer);
    clearTimeout(myTypingTimer);
  });

  // ── TYPING ──
  function subscribeTyping(convId) {
    typingChannel?.unsubscribe();
    typingChannel = supabase
      .channel('typing:' + convId)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.user_id !== me.id) {
          typingUsers.set(payload.payload.user_id, payload.payload.username);
          typingUsers = new Map(typingUsers);
          setTimeout(() => {
            typingUsers.delete(payload.payload.user_id);
            typingUsers = new Map(typingUsers);
          }, 3000);
        }
      })
      .subscribe();
  }

  function sendTyping() {
    if (!activeConv || !me) return;
    clearTimeout(myTypingTimer);
    typingChannel?.send({
      type: 'broadcast', event: 'typing',
      payload: { user_id: me.id, username: me.username }
    });
    myTypingTimer = setTimeout(() => {}, 2000);
  }

  // ── TMDB ──
  function extractTmdbQuery(text) {
    const lastAt   = text.lastIndexOf('@');
    const lastHash = text.lastIndexOf('#');
    const lastTrigger = Math.max(lastAt, lastHash);
    if (lastTrigger === -1) return null;
    const query = text.slice(lastTrigger + 1);
    if (query.length < 2 || query.includes('@') || query.includes('#')) return null;
    return { trigger: text[lastTrigger], query: query.trim(), startIdx: lastTrigger };
  }

  async function searchTmdb(query) {
    if (!query || query.length < 2) { tmdbResults = []; showTmdbPicker = false; return; }
    tmdbLoading = true; showTmdbPicker = true;
    try {
      const [movies, tv] = await Promise.all([
        fetch(`${BASE}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&page=1`).then(r => r.json()),
        fetch(`${BASE}/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&page=1`).then(r => r.json())
      ]);
      const combined = [
        ...(movies.results || []).map(m => ({ ...m, media_type: 'movie' })),
        ...(tv.results || []).map(t => ({ ...t, media_type: 'tv', title: t.name, release_date: t.first_air_date }))
      ].filter(x => x.poster_path).sort((a, b) => b.popularity - a.popularity).slice(0, 6);
      const selIds = new Set(selectedEntities.map(e => e.id));
      tmdbResults = combined.filter(m => !selIds.has(m.id));
    } catch (e) { tmdbResults = []; }
    tmdbLoading = false;
  }

  function handleMsgInput(e) {
    msgInput = e.target.value;
    sendTyping();
    const tmdb = extractTmdbQuery(msgInput);
    if (tmdb) {
      clearTimeout(tmdbTimer);
      tmdbTimer = setTimeout(() => searchTmdb(tmdb.query), 300);
    } else {
      showTmdbPicker = false; tmdbResults = [];
    }
  }

  function addEntityToQueue(movie) {
    if (selectedEntities.length >= 5) return;
    const entity = {
      id: movie.id, tmdb_id: movie.id, title: movie.title,
      poster:     IMG + movie.poster_path,
      backdrop:   movie.backdrop_path ? `https://image.tmdb.org/t/p/w780${movie.backdrop_path}` : null,
      media_type: movie.media_type,
      year:       movie.release_date?.slice(0, 4) || 'N/A',
      rating:     movie.vote_average?.toFixed(1) || 'N/A',
      popularity: movie.popularity || 0, voteCount: movie.vote_count || 0,
      overview:   movie.overview || ''
    };
    selectedEntities = [...selectedEntities, entity];
    const tmdb = extractTmdbQuery(msgInput);
    if (tmdb) msgInput = msgInput.slice(0, tmdb.startIdx).trim();
    showTmdbPicker = false; tmdbResults = [];
  }

  function removeEntityFromQueue(idx) {
    selectedEntities = selectedEntities.filter((_, i) => i !== idx);
  }

  // ── REPLY ──
  function startReply(msg) {
    replyingTo = {
      id:          msg.id,
      content:     msg.content,
      sender_name: msg.user_name,
      entities:    msg.entities
    };
  }

  function cancelReply() { replyingTo = null; }

  // ── DELETE ──
  function openDeleteMenu(e, msg) {
    e.preventDefault();
    e.stopPropagation();
    if (deleteMenu?.id === msg.id) { deleteMenu = null; return; }
    deleteMenu = msg;
    // Position the menu near click, kept inside viewport
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 120);
    deleteMenuPos = { x, y };
  }

  function closeDeleteMenu() { deleteMenu = null; }

  async function deleteForMe(msgId) {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const prev = Array.isArray(msg.deleted_for) ? msg.deleted_for : [];
    const next = [...new Set([...prev, me.id])];
    await supabase.from('messages').update({ deleted_for: next }).eq('id', msgId);
    // Remove from local list immediately
    messages = messages.filter(m => m.id !== msgId);
    closeDeleteMenu();
  }

  async function deleteForEveryone(msgId) {
    await supabase.from('messages').update({
      deleted_for_everyone: true,
      content: 'This message was deleted'
    }).eq('id', msgId);
    messages = messages.map(m =>
      m.id === msgId ? { ...m, deleted_for_everyone: true, content: 'This message was deleted', entities: null } : m
    );
    closeDeleteMenu();
  }

  // ── SEND ──
  async function sendMessage() {
    if (!activeConv || !me || sending) return;
    const text = msgInput.trim();
    if (!text && selectedEntities.length === 0) return;
    sending = true;

    const payload = {
      conversation_id: activeConv.id,
      sender_id:       me.id,
      content:         text || '',
      entities:        selectedEntities.length > 0 ? selectedEntities : null,
      reactions:       {},
      reply_to:        replyingTo?.id || null,
    };

    const { data: newMsg, error } = await supabase
      .from('messages').insert(payload).select().single();

    if (error) { console.error('Send failed:', error); sending = false; return; }

    if (newMsg) {
      // Fetch with reply data
      const { data: full } = await supabase
        .from('messages')
        .select('*, reply_to_msg:reply_to(id, content, sender_id)')
        .eq('id', newMsg.id).single();

      messages = [...messages, {
        ...(full || newMsg),
        user_name:   me.username,
        user_avatar: me.avatar
      }];
      setTimeout(scrollBottom, 30);
    }

    const now = new Date().toISOString();
    const preview = text || (selectedEntities.length > 0 ? `🎬 ${selectedEntities[0].title}` : '');
    await supabase.from('conversations')
      .update({ last_message: preview, last_message_at: now }).eq('id', activeConv.id);
    conversations = conversations.map(c =>
      c.id === activeConv.id ? { ...c, last_message: preview, last_message_at: now } : c
    );

    msgInput = ''; selectedEntities = []; replyingTo = null; sending = false;
  }

  function openMovieModal(entity) { selectedMovie = entity; showMovieModal = true; }

  // ── CONVERSATIONS ──
  async function loadConversations() {
    const { data } = await supabase
      .from('conversations')
      .select('id, user1_id, user2_id, last_message, last_message_at')
      .or(`user1_id.eq.${me.id},user2_id.eq.${me.id}`)
      .order('last_message_at', { ascending: false });
    if (!data) return;

    const otherIds = data.map(c => c.user1_id === me.id ? c.user2_id : c.user1_id);
    const { data: profiles } = await supabase
      .from('profiles').select('id, username').in('id', [...new Set(otherIds)]);
    const pMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

    conversations = data.map(c => {
      const otherId = c.user1_id === me.id ? c.user2_id : c.user1_id;
      const other   = pMap[otherId] ?? { id: otherId, username: 'Unknown' };
      return {
        id: c.id, other_user_id: otherId, other_username: other.username,
        other_avatar: null, last_message: c.last_message ?? '', last_message_at: c.last_message_at
      };
    });
  }

  function subscribeConversations() {
    convRealtimeSub = supabase
      .channel('user-convs-' + me.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, () => loadConversations())
      .subscribe();
  }

  async function openConv(conv) {
    activeConv = conv; messages = []; replyingTo = null; deleteMenu = null;
    realtimeSub?.unsubscribe();
    await fetchMessages();
    subscribeMessages();
    subscribeTyping(conv.id);
  }

  async function startConvWith(userId, username) {
    const { data: existing } = await supabase
      .from('conversations').select('id')
      .or(`and(user1_id.eq.${me.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${me.id})`)
      .maybeSingle();

    let convId = existing?.id;
    if (!convId) {
      const { data: created, error } = await supabase
        .from('conversations')
        .insert({ user1_id: me.id, user2_id: userId, last_message: '', last_message_at: new Date().toISOString() })
        .select('id').single();
      if (error) { console.error(error); return; }
      convId = created?.id;
    }
    if (!convId) return;

    searchQ = ''; searchResults = [];
    await loadConversations();
    const conv = conversations.find(c => c.id === convId) ?? {
      id: convId, other_user_id: userId, other_username: username,
      other_avatar: null, last_message: '', last_message_at: null
    };
    await openConv(conv);
  }

  async function fetchMessages() {
    if (!activeConv) return;
    const { data } = await supabase
      .from('messages')
      .select('*, reply_to_msg:reply_to(id, content, sender_id)')
      .eq('conversation_id', activeConv.id)
      .order('created_at', { ascending: true });

    messages = (data ?? [])
      .filter(m => !(m.deleted_for || []).includes(me.id))
      .map(m => ({
        ...m,
        user_name:   m.sender_id === me.id ? me.username : activeConv?.other_username || 'Unknown',
        user_avatar: m.sender_id === me.id ? me.avatar   : null
      }));

    setTimeout(scrollBottom, 40);
  }

  function subscribeMessages() {
    realtimeSub = supabase
      .channel('conv-' + activeConv.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${activeConv.id}`
      }, async (payload) => {
        if (messages.find(m => m.id === payload.new.id)) return;
        if ((payload.new.deleted_for || []).includes(me.id)) return;

        // Fetch with reply
        const { data: full } = await supabase
          .from('messages')
          .select('*, reply_to_msg:reply_to(id, content, sender_id)')
          .eq('id', payload.new.id).single();

        messages = [...messages, {
          ...(full || payload.new),
          user_name:   payload.new.sender_id === me.id ? me.username : activeConv?.other_username || 'Unknown',
          user_avatar: payload.new.sender_id === me.id ? me.avatar   : null
        }];
        setTimeout(scrollBottom, 30);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${activeConv.id}`
      }, (payload) => {
        // If now deleted for me → remove
        if ((payload.new.deleted_for || []).includes(me.id)) {
          messages = messages.filter(m => m.id !== payload.new.id);
          return;
        }
        messages = messages.map(m =>
          m.id === payload.new.id ? { ...m, ...payload.new } : m
        );
      })
      .subscribe();
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  // ── REACTIONS ──
  const EMOJIS = ['❤️', '😂', '😮', '👍', '🔥', '😢'];

  async function toggleReaction(msgId, emoji) {
    const msg = messages.find(m => m.id === msgId);
    if (!msg || msg.deleted_for_everyone) return;
    const rxns  = { ...(msg.reactions ?? {}) };
    const users = rxns[emoji] ?? [];
    if (users.includes(me.id)) {
      rxns[emoji] = users.filter(u => u !== me.id);
      if (!rxns[emoji].length) delete rxns[emoji];
    } else { rxns[emoji] = [...users, me.id]; }
    messages = messages.map(m => m.id === msgId ? { ...m, reactions: rxns } : m);
    await supabase.from('messages').update({ reactions: rxns }).eq('id', msgId);
  }

  // ── SEARCH ──
  async function doSearch(q) {
    q = q.trim();
    if (!q) { searchResults = []; return; }
    searchLoading = true;
    const { data } = await supabase
      .from('profiles').select('id, username').ilike('username', `%${q}%`)
      .neq('id', me?.id ?? '').limit(10);
    searchResults = data ?? [];
    searchLoading = false;
  }

  function handleSearch(e) {
    searchQ = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(searchQ), 350);
  }

  function scrollBottom() { if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight; }

  const fmtTime = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '';

  function fmtDay(ts) {
    if (!ts) return '';
    const d = new Date(ts), t = new Date();
    if (d.toDateString() === t.toDateString()) return 'Today';
    const y = new Date(t); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month:'short', day:'numeric' });
  }

  function getReplySenderName(senderId) {
    return senderId === me?.id ? 'You' : activeConv?.other_username || 'Unknown';
  }

  // Streak request helpers
  function isStreakReqForMe(msg) {
    return msg.meta?.type === 'streak_request' && msg.sender_id !== me.id;
  }
  function isStreakInfo(msg) {
    return ['streak_accepted','streak_declined','streak_broken'].includes(msg.meta?.type);
  }

  async function acceptStreak(msg) {
    if (!msg.meta?.streak_id || processingReq === msg.id) return;
    processingReq = msg.id;

    const { data: streak } = await supabase.from('streaks').select('*').eq('id', msg.meta.streak_id).single();
    if (!streak) { processingReq = null; return; }

    const startStr = (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0]; })();
    const endDate  = new Date(startStr); endDate.setDate(endDate.getDate() + streak.duration_days - 1);

    await supabase.from('streaks').update({
      partner_status: 'accepted', status: 'active',
      start_date: startStr, end_date: endDate.toISOString().split('T')[0]
    }).eq('id', streak.id);

    // Generate movies for the acceptor
    const GENRE_MAP = { 'Action':28,'Adventure':12,'Animation':16,'Comedy':35,'Crime':80,'Drama':18,
      'Fantasy':14,'Horror':27,'Mystery':9648,'Romance':10749,'Sci-Fi':878,'Thriller':53,'War':10752,'Western':37 };
    const genreIds  = (streak.genres||[]).map(g => GENRE_MAP[g]).filter(Boolean);
    const BUSY_MAP  = { low:1, medium:2, free:3.5 };
    const total     = Math.round((streak.duration_days / 7) * (BUSY_MAP[streak.busyness] || 2));

    const movies = []; const seen = new Set();
    for (let pg = 1; pg <= 5 && movies.length < total*2; pg++) {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}` +
          `&with_genres=${genreIds.join(',')}&sort_by=popularity.desc&vote_count.gte=500&vote_average.gte=5.5&page=${pg}`
        ).then(r=>r.json());
        (res.results||[]).forEach(m=>{ if(!seen.has(m.id)&&m.poster_path){seen.add(m.id);movies.push(m);} });
      } catch(_){}
    }
    const picked = movies.sort(()=>Math.random()-.5).slice(0,total);
    const days   = Array.from({length:streak.duration_days},(_,i)=>i).sort(()=>Math.random()-.5).slice(0,picked.length).sort((a,b)=>a-b);
    const rows   = picked.map((m,i)=>{
      const d = new Date(startStr); d.setDate(d.getDate()+days[i]);
      const ds = d.toISOString().split('T')[0];
      return {
        streak_id: streak.id, user_id: me.id, tmdb_id: m.id, title: m.title,
        poster:   m.poster_path   ? `https://image.tmdb.org/t/p/w300${m.poster_path}`   : null,
        backdrop: m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : null,
        year: (m.release_date||'').slice(0,4), rating: m.vote_average,
        scheduled_date: ds, status: ds === startStr ? 'available' : 'locked',
      };
    });
    await supabase.from('streak_movies').insert(rows);

    await supabase.from('messages').insert({
      conversation_id: activeConv.id, sender_id: me.id,
      content: `✅ @${me.username} accepted the streak! 🔥 Starts tomorrow (${startStr})!`,
      meta: { type: 'streak_accepted', streak_id: streak.id }
    });

    processingReq = null;
    goto('/app/streak');
  }

  async function declineStreak(msg) {
    if (!msg.meta?.streak_id || processingReq === msg.id) return;
    processingReq = msg.id;
    await supabase.from('streaks').update({ partner_status: 'declined' }).eq('id', msg.meta.streak_id);
    await supabase.from('messages').insert({
      conversation_id: activeConv.id, sender_id: me.id,
      content: `❌ @${me.username} declined the streak request.`,
      meta: { type: 'streak_declined', streak_id: msg.meta.streak_id }
    });
    processingReq = null;
  }

  // ── GROUPED MESSAGES ──
  let grouped = $derived.by(() => {
    const out = []; let lastDay = '';
    for (const m of messages) {
      const day = fmtDay(m.created_at);
      if (day !== lastDay) { out.push({ type: 'day', label: day }); lastDay = day; }
      out.push({ type: 'msg', ...m });
    }
    return out;
  });
</script>

<!-- Close delete menu on outside click -->
<svelte:window onclick={() => { if (deleteMenu) closeDeleteMenu(); }} />

<div class="grain"></div>

{#if !me}
  <div class="gate">
    <div class="gate-icon">💬</div>
    <h2>Sign in to chat</h2>
    <p>You need to be signed in to use chat.</p>
    <a href="/signin" class="gate-btn">SIGN IN →</a>
  </div>
{:else}
  <div class="layout">

    <!-- ══ SIDEBAR ══ -->
    <aside class="sidebar">
      <div class="sb-head">
        <!-- 🔥 STREAK BUTTON -->
        <button class="streak-btn" onclick={() => goto('/app/streak')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          Create a Streak
        </button>

        <div class="sb-me">
          {#if me.avatar}
            <img class="av-img" src={me.avatar} alt={me.username} />
          {:else}
            <div class="av gold">{getInitials(me.username)}</div>
          {/if}
          <span class="sb-me-name">@{me.username}</span>
        </div>
        <div class="sb-search-box">
          <svg class="sb-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.3"/>
            <path d="M10 10l2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          <input class="sb-search" type="text" placeholder="Search users by username..."
            value={searchQ} oninput={handleSearch} autocomplete="off" />
        </div>
      </div>

      <div class="sb-body">
        {#if searchQ.trim()}
          <p class="section-lbl">RESULTS</p>
          {#if searchLoading}
            <div class="sb-hint"><div class="spin"></div> Searching…</div>
          {:else if searchResults.length === 0}
            <div class="sb-hint">No users found for "{searchQ}"</div>
          {:else}
            {#each searchResults as u}
              <button class="sb-row" onclick={() => startConvWith(u.id, u.username)}>
                <div class="av teal">{getInitials(u.username)}</div>
                <div class="sb-row-info">
                  <span class="sb-row-name">@{u.username}</span>
                  <span class="sb-row-sub">Tap to open chat</span>
                </div>
              </button>
            {/each}
          {/if}
        {:else}
          <p class="section-lbl">CONVERSATIONS</p>
          {#if conversations.length === 0}
            <div class="sb-hint">Search a username above to start chatting</div>
          {:else}
            {#each conversations as c}
              <button class="sb-row {activeConv?.id === c.id ? 'active' : ''}" onclick={() => openConv(c)}>
                {#if c.other_avatar}
                  <img class="av-img-sm" src={c.other_avatar} alt={c.other_username} />
                {:else}
                  <div class="av">{getInitials(c.other_username)}</div>
                {/if}
                <div class="sb-row-info">
                  <span class="sb-row-name">@{c.other_username}</span>
                  <span class="sb-row-sub">{c.last_message || 'Say hello!'}</span>
                </div>
                {#if c.last_message_at}
                  <span class="sb-row-time">{fmtDay(c.last_message_at)}</span>
                {/if}
              </button>
            {/each}
          {/if}
        {/if}
      </div>
    </aside>

    <!-- ══ CHAT ══ -->
    <section class="chat">
      {#if !activeConv}
        <div class="chat-blank">
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none" style="opacity:.25">
            <path d="M8 14h36v24a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V14z" stroke="#c9a84c" stroke-width="1.5"/>
            <path d="M8 14l18 14 18-14" stroke="#c9a84c" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span class="blank-title">Select a conversation</span>
          <span class="blank-sub">or search a username to start</span>
        </div>
      {:else}

        <!-- Header -->
        <div class="chat-hdr">
          {#if activeConv.other_avatar}
            <img class="av-img" src={activeConv.other_avatar} alt={activeConv.other_username} />
          {:else}
            <div class="av">{getInitials(activeConv.other_username)}</div>
          {/if}
          <div>
            <div class="chat-hdr-name">@{activeConv.other_username}</div>
            <div class="chat-hdr-status"><span class="pulse"></span>Online</div>
          </div>
          <button class="hdr-streak" onclick={() => goto('/app/streak')}>🔥 Streak</button>
        </div>

        <!-- Messages -->
        <div class="msgs" bind:this={msgsEl}>
          {#if messages.length === 0}
            <div class="msgs-empty">No messages yet — say something! 👋</div>
          {/if}

          {#each grouped as item}
            {#if item.type === 'day'}
              <div class="day-sep"><span>{item.label}</span></div>

            {:else if isStreakReqForMe(item)}
              <!-- ── STREAK REQUEST CARD ── -->
              <div class="streak-req">
                <div class="srq-flame">🔥</div>
                <div class="srq-body">
                  <div class="srq-title">Streak Invitation</div>
                  <div class="srq-from">from @{item.user_name}</div>
                  <div class="srq-pills">
                    {#each (item.meta?.genres || []) as g}<span class="srq-pill">{g}</span>{/each}
                    <span class="srq-pill">{item.meta?.duration} days</span>
                  </div>
                  <div class="srq-btns">
                    <button class="srq-accept" disabled={processingReq === item.id}
                      onclick={() => acceptStreak(item)}>
                      {processingReq === item.id ? '…' : '✓ Accept'}
                    </button>
                    <button class="srq-decline" disabled={processingReq === item.id}
                      onclick={() => declineStreak(item)}>✕ Decline</button>
                  </div>
                </div>
              </div>

            {:else if isStreakInfo(item)}
              <!-- ── STREAK INFO BANNER ── -->
              <div class="streak-info {item.meta?.type === 'streak_broken' ? 'sinfo-broken' : item.meta?.type === 'streak_accepted' ? 'sinfo-ok' : 'sinfo-no'}">
                <span>{item.content}</span>
                {#if item.meta?.type === 'streak_accepted'}
                  <button class="sinfo-btn" onclick={() => goto('/app/streak')}>View →</button>
                {/if}
              </div>

            {:else}
              <!-- ── NORMAL MESSAGE ── -->
              {@const mine      = item.sender_id === me.id}
              {@const rxns      = item.reactions ?? {}}
              {@const hasText   = !!(item.content && item.content.trim())}
              {@const hasEnt    = !!(item.entities && item.entities.length > 0)}
              {@const isDeleted = !!item.deleted_for_everyone}

              <div class="msg-row {mine ? 'mine' : 'theirs'}">
                <!-- Avatar -->
                {#if !mine}
                  {#if item.user_avatar}
                    <img class="av-img-sm" src={item.user_avatar} alt={item.user_name} />
                  {:else}
                    <div class="av sm">{getInitials(item.user_name)}</div>
                  {/if}
                {:else}
                  {#if me.avatar}
                    <img class="av-img-sm" src={me.avatar} alt={me.username} />
                  {:else}
                    <div class="av sm">{getInitials(me.username)}</div>
                  {/if}
                {/if}

                <div class="msg-body">
                  <!-- Hover reaction bar -->
                  {#if !isDeleted}
                    <div class="rxn-bar {mine ? 'rxn-l' : 'rxn-r'}">
                      {#each EMOJIS as e}
                        <button class="rxn-pick" onclick={() => toggleReaction(item.id, e)}>{e}</button>
                      {/each}
                    </div>
                  {/if}

                  <!-- Reply button (shows on hover) -->
                  {#if !isDeleted}
                    <button
                      class="reply-btn-hover {mine ? 'reply-left' : 'reply-right'}"
                      onclick={() => startReply(item)}
                      title="Reply"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 10h10a8 8 0 0 1 8 8v2M3 10l6 6M3 10l6-6"/>
                      </svg>
                    </button>
                  {/if}

                  <!-- Message bubble -->
                  {#if hasText || hasEnt || isDeleted}
                    <div
                      class="message-pack {mine ? 'pack-mine' : 'pack-theirs'}"
                      class:pack-deleted={isDeleted}
                      oncontextmenu={(e) => !isDeleted && openDeleteMenu(e, item)}
                    >
                      <!-- Reply preview inside bubble -->
                      {#if item.reply_to_msg && !isDeleted}
                        <div class="reply-preview {mine ? 'rp-mine' : 'rp-theirs'}">
                          <div class="rp-line"></div>
                          <div class="rp-content">
                            <div class="rp-name">{getReplySenderName(item.reply_to_msg.sender_id)}</div>
                            <div class="rp-text">{(item.reply_to_msg.content || '').slice(0,60)}{item.reply_to_msg.content?.length > 60 ? '…' : ''}</div>
                          </div>
                        </div>
                      {/if}

                      {#if hasText}
                        <div class="pack-text" class:text-deleted={isDeleted}>{item.content}</div>
                      {/if}

                      {#if hasEnt && !isDeleted}
                        <div class="pack-entities {hasText ? 'has-text-above' : ''}">
                          <div class="entities-scroll">
                            {#each item.entities as entity, idx}
                              <div class="entity-card" onclick={() => openMovieModal(entity)}>
                                <div class="entity-poster">
                                  <img src={entity.poster} alt={entity.title} loading="lazy" />
                                  <div class="entity-rating">{entity.rating}★</div>
                                </div>
                                <div class="entity-info">
                                  <span class="entity-title">{entity.title}</span>
                                  <span class="entity-meta">{entity.year} • {entity.media_type}</span>
                                </div>
                                {#if item.entities.length > 1}
                                  <div class="entity-count">{idx+1}/{item.entities.length}</div>
                                {/if}
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/if}

                  <!-- Footer: reactions + time + ticks -->
                  <div class="msg-foot {mine ? 'foot-r' : 'foot-l'}">
                    {#each Object.entries(rxns).filter(([,u]) => u.length) as [emoji, users]}
                      <button class="rxn-chip" onclick={() => toggleReaction(item.id, emoji)}>
                        {emoji} {users.length}
                      </button>
                    {/each}
                    <span class="msg-time">{fmtTime(item.created_at)}</span>
                    {#if mine && !isDeleted}
                      <svg width="15" height="9" viewBox="0 0 15 9" fill="none">
                        <path d="M1 4.5l2.5 2.5 4-4M7.5 5.5l2.5-2.5 3 3" stroke="#c9a84c" stroke-width="1.3" stroke-linecap="round"/>
                      </svg>
                    {/if}
                  </div>
                </div>
              </div>
            {/if}
          {/each}

          <!-- Typing indicator -->
          {#if typingUsers.size > 0}
            <div class="typing-row">
              {#if activeConv.other_avatar}
                <img class="av-img-sm" src={activeConv.other_avatar} alt={activeConv.other_username} />
              {:else}
                <div class="av sm">{getInitials(activeConv.other_username)}</div>
              {/if}
              <div class="typing-bubble">
                <div class="typing-dots"><span></span><span></span><span></span></div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Reply bar -->
        {#if replyingTo}
          <div class="reply-bar">
            <div class="rb-left">
              <div class="rb-line"></div>
              <div class="rb-info">
                <div class="rb-to">Replying to {replyingTo.sender_name}</div>
                {#if replyingTo.content}
                  <div class="rb-text">{replyingTo.content.slice(0,60)}{replyingTo.content.length>60?'…':''}</div>
                {/if}
                {#if replyingTo.entities?.length}
                  <div class="rb-ent">🎬 {replyingTo.entities.length} item{replyingTo.entities.length>1?'s':''}</div>
                {/if}
              </div>
            </div>
            <button class="rb-cancel" onclick={cancelReply}>✕</button>
          </div>
        {/if}

        <!-- TMDB picker -->
        {#if showTmdbPicker && tmdbResults.length > 0}
          <div class="tmdb-picker">
            <div class="tmdb-head">
              <div class="tmdb-eyebrow"><span></span><span>SEARCH RESULTS</span></div>
              <button class="tmdb-close" onclick={() => { showTmdbPicker=false; tmdbResults=[]; }}>✕</button>
            </div>
            <div class="tmdb-results">
              {#each tmdbResults as result}
                <button class="tmdb-result" onclick={() => addEntityToQueue(result)}>
                  <div class="tmdb-result-poster">
                    {#if result.poster_path}
                      <img src={IMG+result.poster_path} alt="" loading="lazy"/>
                    {:else}
                      <div class="tmdb-result-poster-empty">{result.title.slice(0,2).toUpperCase()}</div>
                    {/if}
                  </div>
                  <div class="tmdb-result-body">
                    <div class="tmdb-result-title">{result.title}</div>
                    <div class="tmdb-result-meta">
                      {#if result.release_date}<span>{result.release_date.slice(0,4)}</span>{/if}
                      {#if result.vote_average>0}<span>★ {result.vote_average.toFixed(1)}</span>{/if}
                      {#if result.vote_count>0}<span>{result.vote_count.toLocaleString()} votes</span>{/if}
                    </div>
                    {#if result.overview}<div class="tmdb-result-overview">{result.overview.slice(0,80)}...</div>{/if}
                  </div>
                  <div class="tmdb-result-add-btn">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                    </svg>
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Selected queue -->
        {#if selectedEntities.length > 0}
          <div class="selected-queue">
            <div class="selected-head">
              <span>{selectedEntities.length} selected</span>
              <button class="selected-clear" onclick={() => selectedEntities=[]}>Clear all</button>
            </div>
            <div class="selected-scroll">
              {#each selectedEntities as entity, idx}
                <div class="selected-chip">
                  <img src={entity.poster} alt="" />
                  <span>{entity.title}</span>
                  <button onclick={() => removeEntityFromQueue(idx)}>×</button>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Input -->
        <div class="input-bar">
          <textarea class="input-box"
            placeholder={replyingTo ? "Reply…" : "Type message… Use @movie or #series to add"}
            rows="1" value={msgInput}
            oninput={handleMsgInput} onkeydown={handleKey} disabled={sending}
          ></textarea>
          <button class="send" onclick={sendMessage}
            disabled={(!msgInput.trim() && selectedEntities.length===0) || sending}>
            {#if sending}
              <div class="spin white"></div>
            {:else}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            {/if}
          </button>
        </div>

      {/if}
    </section>
  </div>
{/if}

<!-- ── DELETE CONTEXT MENU ── -->
{#if deleteMenu}
  <div
    class="del-menu"
    style="left:{deleteMenuPos.x}px;top:{deleteMenuPos.y}px"
    onclick={(e) => e.stopPropagation()}
  >
    <button class="del-opt" onclick={() => deleteForMe(deleteMenu.id)}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
      Delete for me
    </button>
    {#if deleteMenu.sender_id === me.id && !deleteMenu.deleted_for_everyone}
      <button class="del-opt del-everyone" onclick={() => deleteForEveryone(deleteMenu.id)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
        </svg>
        Delete for everyone
      </button>
    {/if}
    <button class="del-opt del-reply" onclick={() => { startReply(deleteMenu); closeDeleteMenu(); }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 10h10a8 8 0 0 1 8 8v2M3 10l6 6M3 10l6-6"/>
      </svg>
      Reply
    </button>
  </div>
{/if}

<!-- Movie modal -->
{#if showMovieModal && selectedMovie}
  <div class="modal-backdrop" onclick={() => showMovieModal=false}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <button class="modal-close" onclick={() => showMovieModal=false}>×</button>
      {#if selectedMovie.backdrop}
        <div class="modal-backdrop-img" style="background-image:url({selectedMovie.backdrop})"></div>
      {/if}
      <div class="modal-content">
        <img class="modal-poster" src={selectedMovie.poster.replace('w200','w300')} alt={selectedMovie.title} />
        <div class="modal-info">
          <h2>{selectedMovie.title}</h2>
          <div class="modal-meta">
            <span class="modal-year">{selectedMovie.year}</span>
            <span class="modal-rating">{selectedMovie.rating}★</span>
            <span class="modal-type">{selectedMovie.media_type}</span>
          </div>
          <a href="https://www.themoviedb.org/{selectedMovie.media_type}/{selectedMovie.tmdb_id}"
            target="_blank" class="modal-btn">VIEW ON TMDB →</a>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  :global(*){margin:0;padding:0;box-sizing:border-box}
  :global(html,body){height:100%;overflow:hidden;background:#050505;color:#f0ece4;font-family:'Sora',sans-serif}

  .grain{position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:.04;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}

  .gate{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:40px}
  .gate-icon{font-size:2.8rem;opacity:.35}
  .gate h2{font-family:'Cormorant Garamond',serif;font-size:2rem;font-weight:700}
  .gate p{font-size:.88rem;opacity:.4}
  .gate-btn{margin-top:6px;display:inline-block;background:rgba(201,168,76,.14);border:1px solid rgba(201,168,76,.45);color:#c9a84c;font-family:'Space Mono',monospace;font-size:.62rem;letter-spacing:.12em;padding:11px 26px;text-decoration:none;border-radius:30px;transition:.2s}
  .gate-btn:hover{background:rgba(201,168,76,.24)}

  .layout{display:flex;height:100vh}

  /* SIDEBAR */
  .sidebar{width:285px;flex-shrink:0;background:#080808;border-right:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;overflow:hidden}
  .sb-head{padding:14px 14px 12px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}

  /* 🔥 STREAK BUTTON */
  .streak-btn{
    display:flex;align-items:center;gap:8px;width:100%;
    background:linear-gradient(135deg,rgba(201,168,76,.18),rgba(201,168,76,.06));
    border:1px solid rgba(201,168,76,.45);color:#c9a84c;
    font-family:'Space Mono',monospace;font-size:.62rem;letter-spacing:.1em;
    padding:10px 14px;cursor:pointer;border-radius:10px;transition:all .2s;
    margin-bottom:12px;position:relative;overflow:hidden
  }
  .streak-btn:hover{border-color:#c9a84c;transform:translateY(-1px);box-shadow:0 4px 16px rgba(201,168,76,.2)}

  .sb-me{display:flex;align-items:center;gap:10px;margin-bottom:12px}
  .av-img{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid rgba(201,168,76,.3);flex-shrink:0}
  .av-img-sm{width:26px;height:26px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,.1);flex-shrink:0}
  .av{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-size:.55rem;color:rgba(240,236,228,.5);flex-shrink:0}
  .av.gold{background:rgba(201,168,76,.14);border-color:rgba(201,168,76,.35);color:#c9a84c}
  .av.teal{background:rgba(95,191,140,.12);border-color:rgba(95,191,140,.3);color:#5fbf8c}
  .av.sm{width:26px;height:26px;font-size:.46rem}
  .sb-me-name{font-size:.82rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .sb-search-box{position:relative}
  .sb-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:rgba(240,236,228,.25);pointer-events:none}
  .sb-search{width:100%;background:#111;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:8px 12px 8px 30px;color:#f0ece4;font-family:'Sora',sans-serif;font-size:.8rem;outline:none;transition:.2s}
  .sb-search:focus{border-color:rgba(201,168,76,.4)}
  .sb-search::placeholder{color:rgba(240,236,228,.2)}
  .sb-body{flex:1;overflow-y:auto;padding:4px 0 12px}
  .sb-body::-webkit-scrollbar{width:2px}
  .sb-body::-webkit-scrollbar-thumb{background:rgba(201,168,76,.12)}
  .section-lbl{font-family:'Space Mono',monospace;font-size:.5rem;letter-spacing:.16em;color:rgba(240,236,228,.22);padding:10px 14px 5px;text-transform:uppercase}
  .sb-hint{padding:14px;font-family:'Space Mono',monospace;font-size:.6rem;color:rgba(240,236,228,.22);text-align:center;display:flex;align-items:center;justify-content:center;gap:8px}
  .sb-row{display:flex;align-items:center;gap:10px;padding:10px 14px;width:100%;background:none;border:none;cursor:pointer;color:#f0ece4;transition:.14s;text-align:left;position:relative}
  .sb-row:hover{background:rgba(255,255,255,.03)}
  .sb-row.active{background:rgba(201,168,76,.08);border-left:3px solid #c9a84c;padding-left:11px}
  .sb-row-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
  .sb-row-name{font-size:.82rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .sb-row-sub{font-size:.7rem;color:rgba(240,236,228,.32);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .sb-row-time{font-family:'Space Mono',monospace;font-size:.5rem;color:rgba(240,236,228,.22);flex-shrink:0}

  /* CHAT */
  .chat{flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative}
  .chat-blank{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px}
  .blank-title{font-family:'Cormorant Garamond',serif;font-size:1.25rem;font-weight:600;opacity:.35}
  .blank-sub{font-family:'Space Mono',monospace;font-size:.55rem;letter-spacing:.08em;opacity:.18}

  .chat-hdr{display:flex;align-items:center;gap:12px;padding:13px 18px;flex-shrink:0;background:#080808;border-bottom:1px solid rgba(255,255,255,.06)}
  .chat-hdr-name{font-size:.9rem;font-weight:500}
  .chat-hdr-status{font-family:'Space Mono',monospace;font-size:.52rem;color:#5fbf8c;display:flex;align-items:center;gap:5px;margin-top:2px}
  .hdr-streak{margin-left:auto;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.3);color:#c9a84c;font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.08em;padding:6px 14px;cursor:pointer;border-radius:20px;transition:.2s;flex-shrink:0}
  .hdr-streak:hover{background:rgba(201,168,76,.2)}

  .pulse{width:6px;height:6px;border-radius:50%;background:#5fbf8c;animation:pulse 2s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.65)}}

  .msgs{flex:1;overflow-y:auto;padding:18px 18px 8px;display:flex;flex-direction:column;gap:6px}
  .msgs::-webkit-scrollbar{width:3px}
  .msgs::-webkit-scrollbar-thumb{background:rgba(255,255,255,.07);border-radius:2px}
  .msgs-empty{text-align:center;opacity:.2;font-family:'Space Mono',monospace;font-size:.6rem;margin-top:40px}

  .day-sep{text-align:center;position:relative;margin:8px 0;font-family:'Space Mono',monospace;font-size:.5rem;color:rgba(240,236,228,.18);letter-spacing:.1em}
  .day-sep::before{content:'';position:absolute;top:50%;left:0;right:0;height:1px;background:rgba(255,255,255,.05)}
  .day-sep span{background:#050505;position:relative;padding:0 10px}

  /* STREAK REQUEST CARD */
  .streak-req{display:flex;align-items:flex-start;gap:14px;background:linear-gradient(135deg,rgba(201,168,76,.1),rgba(201,168,76,.04));border:1px solid rgba(201,168,76,.35);border-radius:16px;padding:16px 18px;margin:4px 0;position:relative;overflow:hidden}
  .streak-req::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#c9a84c,transparent)}
  .srq-flame{font-size:2rem;line-height:1;flex-shrink:0}
  .srq-body{flex:1}
  .srq-title{font-family:'Cormorant Garamond',serif;font-size:1.2rem;font-weight:700;color:#c9a84c;margin-bottom:2px}
  .srq-from{font-family:'Space Mono',monospace;font-size:.53rem;color:rgba(240,236,228,.4);margin-bottom:8px}
  .srq-pills{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px}
  .srq-pill{background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.25);color:#c9a84c;font-family:'Space Mono',monospace;font-size:.5rem;letter-spacing:.06em;padding:3px 9px;border-radius:20px}
  .srq-btns{display:flex;gap:8px}
  .srq-accept{background:#c9a84c;color:#050505;font-family:'Space Mono',monospace;font-size:.6rem;letter-spacing:.08em;font-weight:700;padding:7px 16px;border:none;cursor:pointer;border-radius:20px;transition:.2s}
  .srq-accept:hover{background:#e8c46a}
  .srq-accept:disabled{opacity:.5;cursor:not-allowed}
  .srq-decline{background:rgba(231,76,60,.1);border:1px solid rgba(231,76,60,.3);color:#e74c3c;font-family:'Space Mono',monospace;font-size:.6rem;letter-spacing:.08em;padding:7px 16px;cursor:pointer;border-radius:20px;transition:.2s}
  .srq-decline:hover{background:rgba(231,76,60,.2)}
  .srq-decline:disabled{opacity:.5;cursor:not-allowed}

  /* STREAK INFO */
  .streak-info{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;margin:3px 0;font-size:.8rem;justify-content:space-between;flex-wrap:wrap}
  .sinfo-ok{background:rgba(95,191,140,.08);border:1px solid rgba(95,191,140,.2);color:#5fbf8c}
  .sinfo-no{background:rgba(231,76,60,.07);border:1px solid rgba(231,76,60,.15);color:#e74c3c}
  .sinfo-broken{background:rgba(231,76,60,.07);border:1px solid rgba(231,76,60,.15);color:#e74c3c}
  .sinfo-btn{background:rgba(95,191,140,.14);border:1px solid rgba(95,191,140,.3);color:#5fbf8c;font-family:'Space Mono',monospace;font-size:.53rem;letter-spacing:.08em;padding:5px 12px;cursor:pointer;border-radius:20px;transition:.2s;flex-shrink:0}
  .sinfo-btn:hover{background:rgba(95,191,140,.24)}

  /* MESSAGES */
  .msg-row{display:flex;align-items:flex-end;gap:7px;position:relative}
  .msg-row.mine{flex-direction:row-reverse}

  .msg-body{display:flex;flex-direction:column;gap:3px;max-width:75%;position:relative}
  .msg-row.mine .msg-body{align-items:flex-end}

  /* Reaction bar */
  .rxn-bar{display:flex;gap:2px;opacity:0;transition:opacity .14s;pointer-events:none}
  .msg-row:hover .rxn-bar{opacity:1;pointer-events:auto}
  .rxn-l{flex-direction:row-reverse}
  .rxn-pick{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:10px;font-size:.8rem;padding:2px 5px;cursor:pointer;transition:.14s;line-height:1}
  .rxn-pick:hover{background:rgba(255,255,255,.16);transform:scale(1.25)}

  /* Reply button on hover */
  .reply-btn-hover{
    position:absolute;top:50%;transform:translateY(-50%);
    background:rgba(30,30,30,.9);border:1px solid rgba(255,255,255,.12);
    border-radius:50%;width:28px;height:28px;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;opacity:0;transition:opacity .15s;color:rgba(240,236,228,.6);z-index:5
  }
  .msg-row:hover .reply-btn-hover{opacity:1}
  .reply-btn-hover:hover{background:rgba(201,168,76,.25);border-color:rgba(201,168,76,.5);color:#c9a84c}
  .reply-left{right:-36px}
  .reply-right{left:-36px}

  /* Message pack */
  .message-pack{display:flex;flex-direction:column;border-radius:18px;overflow:hidden;max-width:100%;min-width:100px;cursor:default}
  .pack-mine{background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.35);border-bottom-right-radius:4px}
  .pack-theirs{background:#141414;border:1px solid rgba(255,255,255,.12);border-bottom-left-radius:4px}
  .pack-deleted{background:rgba(80,80,80,.1)!important;border-color:rgba(255,255,255,.08)!important}

  /* Reply preview inside bubble */
  .reply-preview{display:flex;gap:8px;padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.06)}
  .rp-mine{background:rgba(201,168,76,.12);border-bottom-color:rgba(201,168,76,.18)}
  .rp-theirs{background:rgba(0,0,0,.22)}
  .rp-line{width:3px;background:#c9a84c;border-radius:2px;flex-shrink:0}
  .rp-content{flex:1;min-width:0}
  .rp-name{font-family:'Space Mono',monospace;font-size:.53rem;color:#c9a84c;font-weight:600;margin-bottom:2px}
  .rp-text{font-size:.74rem;color:rgba(240,236,228,.65);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

  .pack-text{padding:11px 15px;font-size:.88rem;line-height:1.55;word-break:break-word;white-space:pre-wrap}
  .text-deleted{color:rgba(240,236,228,.45);font-style:italic}

  .pack-entities{padding:11px;background:rgba(0,0,0,.2)}
  .pack-entities.has-text-above{border-top:1px solid rgba(255,255,255,.06)}
  .pack-mine .pack-entities{background:rgba(201,168,76,.08)}
  .entities-scroll{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
  .entities-scroll::-webkit-scrollbar{display:none}
  .entity-card{flex:0 0 auto;width:130px;background:#0a0808;border:1px solid rgba(201,168,76,.2);border-radius:10px;overflow:hidden;cursor:pointer;transition:all .2s;position:relative}
  .entity-card:hover{transform:translateY(-4px);border-color:rgba(201,168,76,.5);box-shadow:0 8px 24px rgba(201,168,76,.2)}
  .entity-poster{position:relative;width:100%;aspect-ratio:2/3;overflow:hidden}
  .entity-poster img{width:100%;height:100%;object-fit:cover;display:block}
  .entity-rating{position:absolute;top:6px;right:6px;background:rgba(5,5,5,.9);border:1px solid rgba(201,168,76,.4);color:#c9a84c;font-family:'Space Mono',monospace;font-size:.55rem;font-weight:700;padding:3px 6px;border-radius:4px}
  .entity-info{padding:10px}
  .entity-title{font-family:'Cormorant Garamond',serif;font-size:.85rem;font-weight:600;color:#f0ece4;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .entity-meta{font-family:'Space Mono',monospace;font-size:.48rem;color:rgba(240,236,228,.5);text-transform:uppercase;letter-spacing:.08em;margin-top:2px;display:block}
  .entity-count{position:absolute;top:6px;left:6px;background:rgba(201,168,76,.95);color:#050505;font-family:'Space Mono',monospace;font-size:.5rem;font-weight:700;padding:2px 6px;border-radius:4px}

  .msg-foot{display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:0 2px;margin-top:2px}
  .foot-r{justify-content:flex-end}
  .foot-l{justify-content:flex-start}
  .rxn-chip{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;font-size:.7rem;padding:1px 7px;cursor:pointer;transition:.14s;line-height:1.6}
  .rxn-chip:hover{background:rgba(255,255,255,.13)}
  .msg-time{font-family:'Space Mono',monospace;font-size:.48rem;color:rgba(240,236,228,.24)}

  /* REPLY BAR */
  .reply-bar{display:flex;align-items:center;gap:10px;padding:9px 14px;background:#0a0a0a;border-top:1px solid rgba(201,168,76,.2);flex-shrink:0}
  .rb-left{display:flex;gap:10px;flex:1;min-width:0}
  .rb-line{width:3px;background:#c9a84c;border-radius:2px;flex-shrink:0}
  .rb-info{flex:1;min-width:0}
  .rb-to{font-family:'Space Mono',monospace;font-size:.56rem;color:#c9a84c;font-weight:600;letter-spacing:.05em;text-transform:uppercase;margin-bottom:2px}
  .rb-text{font-size:.78rem;color:rgba(240,236,228,.65);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rb-ent{font-size:.66rem;color:rgba(201,168,76,.8);margin-top:2px}
  .rb-cancel{width:26px;height:26px;border-radius:50%;border:none;background:rgba(255,255,255,.1);color:rgba(240,236,228,.55);font-size:.9rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.2s;flex-shrink:0}
  .rb-cancel:hover{background:rgba(231,76,60,.3);color:#e74c3c}

  /* TYPING */
  .typing-row{display:flex;align-items:flex-end;gap:7px;margin-top:4px}
  .typing-bubble{background:#141414;border:1px solid rgba(255,255,255,.07);border-bottom-left-radius:4px;border-radius:16px;padding:12px 16px}
  .typing-dots{display:flex;gap:4px;align-items:center;height:8px}
  .typing-dots span{width:6px;height:6px;background:rgba(201,168,76,.6);border-radius:50%;animation:typingBounce 1.4s ease-in-out infinite}
  .typing-dots span:nth-child(2){animation-delay:.2s}
  .typing-dots span:nth-child(3){animation-delay:.4s}
  @keyframes typingBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-8px)}}

  /* TMDB PICKER */
  .tmdb-picker{position:absolute;bottom:80px;left:14px;right:14px;background:#080808;border:1px solid rgba(255,255,255,.07);border-top:none;max-height:380px;overflow-y:auto;z-index:100}
  .tmdb-head{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;background:#0a0a0a;border-bottom:1px solid rgba(255,255,255,.04)}
  .tmdb-eyebrow{display:flex;align-items:center;gap:12px;font-family:'Space Mono',monospace;font-size:.6rem;letter-spacing:.24em;color:#c9a84c}
  .tmdb-eyebrow span:first-child{width:32px;height:1px;background:#c9a84c}
  .tmdb-close{background:none;border:none;color:rgba(240,236,228,.4);font-size:1rem;cursor:pointer;transition:color .2s;width:24px;height:24px;display:flex;align-items:center;justify-content:center}
  .tmdb-close:hover{color:#c9a84c}
  .tmdb-results{background:#080808}
  .tmdb-result{display:flex;align-items:center;gap:16px;width:100%;padding:14px 20px;background:transparent;border:none;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.04);transition:background .15s;text-align:left}
  .tmdb-result:last-child{border-bottom:none}
  .tmdb-result:hover{background:rgba(255,255,255,.03)}
  .tmdb-result-poster{width:42px;height:62px;overflow:hidden;background:#1a1a1a;flex-shrink:0;position:relative}
  .tmdb-result-poster img{width:100%;height:100%;object-fit:cover;display:block}
  .tmdb-result-poster-empty{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond';font-size:1.2rem;font-weight:700;color:rgba(201,168,76,.3)}
  .tmdb-result-body{flex:1;min-width:0}
  .tmdb-result-title{font-family:'Cormorant Garamond';font-size:1.05rem;font-weight:600;color:#f0ece4;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tmdb-result-meta{display:flex;gap:12px;margin-top:4px;font-family:'Space Mono';font-size:.5rem;letter-spacing:.1em;color:rgba(240,236,228,.28)}
  .tmdb-result-overview{font-size:.76rem;font-weight:300;color:rgba(240,236,228,.25);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tmdb-result-add-btn{width:32px;height:32px;border:1px solid rgba(201,168,76,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .2s;color:#c9a84c}
  .tmdb-result:hover .tmdb-result-add-btn{background:rgba(201,168,76,.12)}

  /* SELECTED QUEUE */
  .selected-queue{background:#080808;border-top:1px solid rgba(201,168,76,.1);padding:12px 14px}
  .selected-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
  .selected-head span{font-family:'Space Mono',monospace;font-size:.55rem;color:#c9a84c;letter-spacing:.1em}
  .selected-clear{background:none;border:none;color:rgba(240,236,228,.4);font-family:'Space Mono',monospace;font-size:.5rem;cursor:pointer;transition:color .2s}
  .selected-clear:hover{color:#e74c3c}
  .selected-scroll{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none}
  .selected-scroll::-webkit-scrollbar{display:none}
  .selected-chip{flex:0 0 auto;display:flex;align-items:center;gap:6px;background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);border-radius:20px;padding:4px 10px 4px 4px}
  .selected-chip img{width:32px;height:48px;object-fit:cover;border-radius:16px}
  .selected-chip span{font-size:.7rem;max-width:100px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .selected-chip button{width:18px;height:18px;border-radius:50%;border:none;background:rgba(255,255,255,.1);color:rgba(240,236,228,.5);font-size:.7rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}
  .selected-chip button:hover{background:#e74c3c;color:#fff}

  /* INPUT */
  .input-bar{display:flex;align-items:flex-end;gap:10px;padding:11px 14px;flex-shrink:0;background:#080808;border-top:1px solid rgba(255,255,255,.06);position:relative}
  .input-box{flex:1;background:#111;border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:10px 16px;color:#f0ece4;font-family:'Sora',sans-serif;font-size:.88rem;outline:none;resize:none;max-height:110px;overflow-y:auto;transition:.2s;scrollbar-width:none;line-height:1.5}
  .input-box:focus{border-color:rgba(201,168,76,.42)}
  .input-box::placeholder{color:rgba(240,236,228,.2)}
  .input-box:disabled{opacity:.5}
  .send{width:40px;height:40px;border-radius:50%;background:#c9a84c;border:none;color:#050505;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.2s;flex-shrink:0}
  .send:hover:not(:disabled){background:#e8c46a;transform:scale(1.06)}
  .send:disabled{opacity:.3;cursor:not-allowed}

  /* ── DELETE CONTEXT MENU ── */
  .del-menu{
    position:fixed;z-index:5000;
    background:#1a1a1a;
    border:1px solid rgba(255,255,255,.12);
    border-radius:12px;padding:6px;
    min-width:190px;
    box-shadow:0 12px 40px rgba(0,0,0,.65);
    animation:delMenuIn .15s ease
  }
  @keyframes delMenuIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
  .del-opt{display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;background:none;border:none;color:#f0ece4;font-size:.82rem;cursor:pointer;border-radius:8px;transition:background .15s;text-align:left}
  .del-opt:hover{background:rgba(255,255,255,.08)}
  .del-everyone{color:#e74c3c}
  .del-everyone:hover{background:rgba(231,76,60,.14)}
  .del-reply{color:#c9a84c}
  .del-reply:hover{background:rgba(201,168,76,.12)}

  /* MODAL */
  .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:2000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(12px);padding:20px}
  .modal{background:#0d0d0d;border:1px solid rgba(201,168,76,.2);border-radius:16px;max-width:420px;width:100%;overflow:hidden;position:relative;box-shadow:0 40px 80px rgba(0,0,0,.8)}
  .modal-close{position:absolute;top:16px;right:16px;width:36px;height:36px;background:rgba(5,5,5,.8);border:1px solid rgba(255,255,255,.1);border-radius:50%;color:#f0ece4;font-size:1.4rem;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center;transition:.2s}
  .modal-close:hover{border-color:#c9a84c;color:#c9a84c}
  .modal-backdrop-img{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.15;filter:blur(20px)}
  .modal-content{position:relative;display:flex;gap:20px;padding:24px}
  .modal-poster{width:140px;height:210px;object-fit:cover;border-radius:8px;border:1px solid rgba(201,168,76,.2);box-shadow:0 20px 40px rgba(0,0,0,.5);flex-shrink:0}
  .modal-info{flex:1;display:flex;flex-direction:column;justify-content:center}
  .modal-info h2{font-family:'Cormorant Garamond',serif;font-size:1.8rem;color:#f0ece4;margin-bottom:12px;line-height:1.1}
  .modal-meta{display:flex;gap:12px;margin-bottom:24px;font-family:'Space Mono',monospace;font-size:.65rem}
  .modal-year{color:rgba(240,236,228,.5)}
  .modal-rating{color:#c9a84c;font-weight:700}
  .modal-type{background:rgba(201,168,76,.15);color:#c9a84c;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.1em}
  .modal-btn{display:inline-flex;align-items:center;gap:8px;background:transparent;border:1px solid rgba(201,168,76,.4);color:#c9a84c;font-family:'Space Mono',monospace;font-size:.6rem;letter-spacing:.14em;padding:12px 24px;text-decoration:none;border-radius:30px;transition:all .2s;width:fit-content}
  .modal-btn:hover{background:rgba(201,168,76,.15);border-color:#c9a84c;transform:translateX(4px)}

  .spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(201,168,76,.2);border-top-color:#c9a84c;animation:spin .7s linear infinite}
  .spin.white{border-color:rgba(5,5,5,.25);border-top-color:#050505}
  @keyframes spin{to{transform:rotate(360deg)}}

  @media(max-width:640px){
    .sidebar{display:none}
    .entity-card{width:110px}
    .message-pack{max-width:85%}
    .modal-content{flex-direction:column;align-items:center;text-align:center}
    .modal-info{align-items:center}
    .reply-btn-hover{display:none}
  }
</style>