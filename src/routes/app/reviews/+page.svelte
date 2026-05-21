<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';

  const TMDB_KEY = '175b19b3ba717bf4f24e37ee4325be7e';
  const BASE = 'https://api.themoviedb.org/3';
  const IMG = 'https://image.tmdb.org/t/p/';

  let itemType = $state('');
  let itemId = $state('');
  let qs = $state('');

  let sel = $state(null);
  let loading = $state(true);
  let error = $state(null);
  let reviews = $state([]);
  let comments = $state([]);

  let me = $state(null);
  let showAuthModal = $state(false);
  let activeTab = $state('reviews');

  let newReviewRating = $state(0);
  let newReviewHover = $state(0);
  let newReviewContent = $state('');
  let newCommentContent = $state('');
  let submitting = $state(false);

  let likedReviews = $state(new Set());
  let likedComments = $state(new Set());

  /* ── reply state ── */
  let replyingTo = $state(null);   // comment object or null
  let replyContent = $state('');

  let profileCache = $state({});

  const ACCENT = {
    anime: { color: '#e05c7a', pill: 'anime-pill', tab: 'anime-tab' },
    series: { color: '#5fbf8c', pill: 'series-pill', tab: 'series-tab' },
    franchises: { color: '#c9a84c', pill: '', tab: '' },
    movies: { color: '#c9a84c', pill: '', tab: '' }
  };

  let accent = $derived(sel ? ACCENT[sel.type] : ACCENT.movies);
  let isTV = $derived(sel?.type === 'anime' || sel?.type === 'series');
  let isFr = $derived(sel?.type === 'franchises');
  let isSM = $derived(sel?.type === 'movies');

  /* ── merged rating ── */
  let mergedRating = $derived.by(() => {
    if (!sel) return 0;
    const tmdbR = sel.ratingNum || 0;
    const tmdbV = sel.voteCount || 0;
    const userSum = reviews.reduce((a, r) => a + (+r.rating || 0), 0);
    const totalV = tmdbV + reviews.length;
    if (totalV === 0) return 0;
    return ((tmdbR * tmdbV) + userSum) / totalV;
  });

  let totalVoteCount = $derived((sel?.voteCount || 0) + reviews.length);

  /* ── one review per user ── */
  let myReview = $derived(me ? reviews.find(r => r.user_id === me.id) : null);
  let hasReviewed = $derived(!!myReview);

  /* ── comment tree ── */
  let topComments = $derived(comments.filter(c => !c.parent_id));
  let childComments = $derived.by(() => {
    const map = {};
    comments.filter(c => c.parent_id).forEach(c => {
      if (!map[c.parent_id]) map[c.parent_id] = [];
      map[c.parent_id].push(c);
    });
    return map;
  });

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtR(r) {
    return r > 0 ? (+r).toFixed(1) : '—';
  }

  function getYearRange(parts) {
    const y = (parts || []).map(p => +(p.release_date || p.first_air_date || '').slice(0, 4)).filter(Boolean).sort((a, b) => a - b);
    return y.length ? `${y[0]}–${y[y.length - 1]}` : 'N/A';
  }

  function goBackToApp() {
    sessionStorage.setItem('wo_from_guide', '1');
    window.location.href = '/app';
  }

  function initials(n) {
    return n ? n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '??';
  }

  function fmtDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' && showAuthModal) showAuthModal = false;
  }

  /* ── TMDB loaders ── */
  async function loadFranchise() {
    const colId = String(itemId).replace(/^col_/, '');
    const col = await fetch(`${BASE}/collection/${colId}?api_key=${TMDB_KEY}`).then(r => r.json());
    const parts = (col.parts || []).filter(p => p.release_date).sort((a, b) => a.release_date.localeCompare(b.release_date));
    sel = {
      id: itemId, type: 'franchises',
      title: (col.name || '').replace(/ Collection$/i, ''),
      entries: parts.length, desc: col.overview || '',
      bg: col.backdrop_path ? `${IMG}w1280${col.backdrop_path}` : '',
      poster: col.poster_path ? `${IMG}w500${col.poster_path}` : '',
      years: getYearRange(parts), ratingNum: 0, voteCount: 0, rating: '—'
    };
  }

  async function loadMovie() {
    const m = await fetch(`${BASE}/movie/${itemId}?api_key=${TMDB_KEY}`).then(r => r.json());
    sel = {
      id: itemId, type: 'movies',
      title: m.title || m.original_title || 'Unknown', entries: 1,
      desc: m.overview || '',
      bg: m.backdrop_path ? `${IMG}w1280${m.backdrop_path}` : '',
      poster: m.poster_path ? `${IMG}w500${m.poster_path}` : '',
      years: m.release_date ? m.release_date.slice(0, 4) : 'N/A',
      ratingNum: m.vote_average || 0, voteCount: m.vote_count || 0,
      rating: fmtR(m.vote_average || 0)
    };
  }

  async function loadTV() {
    const sd = await fetch(`${BASE}/tv/${itemId}?api_key=${TMDB_KEY}`).then(r => r.json());
    const seasons = (sd.seasons || []).filter(s => s.season_number > 0);
    sel = {
      id: +itemId, type: itemType,
      title: sd.name || sd.original_name || 'Unknown',
      entries: seasons.length, desc: sd.overview || '',
      bg: sd.backdrop_path ? `${IMG}w1280${sd.backdrop_path}` : '',
      poster: sd.poster_path ? `${IMG}w500${sd.poster_path}` : '',
      years: sd.first_air_date ? sd.first_air_date.slice(0, 4) + (sd.last_air_date && sd.status !== 'Returning Series' ? `–${sd.last_air_date.slice(0, 4)}` : '–') : 'N/A',
      status: sd.status || '',
      ratingNum: sd.vote_average || 0, voteCount: sd.vote_count || 0,
      rating: fmtR(sd.vote_average || 0)
    };
  }

  async function loadItem() {
    try {
      if (itemType === 'franchises') await loadFranchise();
      else if (itemType === 'movies') await loadMovie();
      else if (itemType === 'anime' || itemType === 'series') await loadTV();
      document.title = `${sel.title} · Reviews · WatchOrder`;
      loading = false;
    } catch (e) {
      console.error(e);
      error = 'Could not load.'; loading = false;
    }
  }

  /* ── Supabase data ── */
  async function fetchProfiles(userIds) {
    if (!userIds.length) return;
    const unique = [...new Set(userIds)];
    const { data } = await supabase.from('profiles').select('id, username, avatar_url').in('id', unique);
    const map = {};
    (data || []).forEach(p => { map[p.id] = p; });
    profileCache = { ...profileCache, ...map };
  }

  async function loadReviews() {
    const { data, error: err } = await supabase
      .from('reviews')
      .select('*')
      .eq('item_type', itemType)
      .eq('item_id', String(itemId))
      .order('created_at', { ascending: false });
    if (err) console.error('loadReviews error:', err);
    reviews = data || [];
    const userIds = reviews.map(r => r.user_id).filter(Boolean);
    await fetchProfiles(userIds);
  }

  async function loadComments() {
    const { data, error: err } = await supabase
      .from('comments')
      .select('*')
      .eq('item_type', itemType)
      .eq('item_id', String(itemId))
      .order('created_at', { ascending: true });
    if (err) console.error('loadComments error:', err);
    comments = data || [];
    const userIds = comments.map(c => c.user_id).filter(Boolean);
    await fetchProfiles(userIds);
  }

  async function loadMyLikes() {
    if (!me) return;
    const [{ data: rl }, { data: cl }] = await Promise.all([
      supabase.from('review_likes').select('review_id').eq('user_id', me.id),
      supabase.from('comment_likes').select('comment_id').eq('user_id', me.id)
    ]);
    likedReviews = new Set((rl || []).map(x => x.review_id));
    likedComments = new Set((cl || []).map(x => x.comment_id));
  }

  function getProfile(userId) {
    return profileCache[userId] || { username: 'User', avatar_url: null };
  }

  /* ── submit review (ONE per user) ── */
  async function submitReview() {
    if (!me) return;
    if (hasReviewed) return alert('You already reviewed this. Edit or delete your existing review.');
    if (newReviewRating === 0) return alert('Please select a star rating');
    if (!newReviewContent.trim()) return alert('Please write something');
    submitting = true;

    const { data: inserted, error: err } = await supabase
      .from('reviews')
      .insert({
        item_type: itemType, item_id: String(itemId), user_id: me.id,
        rating: newReviewRating, content: newReviewContent.trim()
      })
      .select()
      .single();

    if (err) {
      console.error('Review insert error:', err);
      alert('Error posting review: ' + (err.message || 'Unknown error'));
    } else if (inserted) {
      reviews = [inserted, ...reviews];
      profileCache = { ...profileCache, [me.id]: { username: me.username, avatar_url: me.avatar } };
      newReviewContent = ''; newReviewRating = 0; newReviewHover = 0;
    }
    submitting = false;
  }

  /* ── submit comment / reply ── */
  async function submitComment(parentId = null) {
    if (!me) return;
    const text = parentId ? replyContent : newCommentContent;
    if (!text.trim()) return;
    submitting = true;

    const { data: inserted, error: err } = await supabase
      .from('comments')
      .insert({
        item_type: itemType, item_id: String(itemId), user_id: me.id,
        content: text.trim(), parent_id: parentId || null
      })
      .select()
      .single();

    if (err) {
      console.error('Comment insert error:', err);
      alert('Error posting: ' + (err.message || 'Unknown error'));
    } else if (inserted) {
      comments = [...comments, inserted];
      profileCache = { ...profileCache, [me.id]: { username: me.username, avatar_url: me.avatar } };
      if (parentId) { replyContent = ''; replyingTo = null; }
      else { newCommentContent = ''; }
    }
    submitting = false;
  }

  function startReply(comment) {
    replyingTo = comment;
    replyContent = '';
  }
  function cancelReply() {
    replyingTo = null;
    replyContent = '';
  }

  async function toggleReviewLike(id) {
    if (!me) { showAuthModal = true; return; }
    const has = likedReviews.has(id);
    if (has) {
      await supabase.from('review_likes').delete().eq('review_id', id).eq('user_id', me.id);
      await supabase.rpc('decrement_review_likes', { rid: id });
      likedReviews.delete(id);
    } else {
      await supabase.from('review_likes').insert({ review_id: id, user_id: me.id });
      await supabase.rpc('increment_review_likes', { rid: id });
      likedReviews.add(id);
    }
    likedReviews = new Set(likedReviews);
    await loadReviews();
  }

  async function toggleCommentLike(id) {
    if (!me) { showAuthModal = true; return; }
    const has = likedComments.has(id);
    if (has) {
      await supabase.from('comment_likes').delete().eq('comment_id', id).eq('user_id', me.id);
      await supabase.rpc('decrement_comment_likes', { cid: id });
      likedComments.delete(id);
    } else {
      await supabase.from('comment_likes').insert({ comment_id: id, user_id: me.id });
      await supabase.rpc('increment_comment_likes', { cid: id });
      likedComments.add(id);
    }
    likedComments = new Set(likedComments);
    await loadComments();
  }

  function subscribe() {
    const ch = supabase.channel('reviews-page-' + itemType + '-' + itemId);
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews' }, (payload) => {
      if (payload.new.item_type === itemType && String(payload.new.item_id) === String(itemId)) loadReviews();
    });
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (payload) => {
      if (payload.new.item_type === itemType && String(payload.new.item_id) === String(itemId)) loadComments();
    });
    ch.subscribe();
    return ch;
  }

  onMount(async () => {
    const url = new URL(window.location.href);
    itemType = url.searchParams.get('type') || '';
    itemId = url.searchParams.get('id') || '';
    qs = `?type=${encodeURIComponent(itemType)}&id=${encodeURIComponent(itemId)}`;

    if (!itemType || !itemId) { error = 'No guide found.'; loading = false; return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: p } = await supabase.from('profiles').select('id, username, avatar_url').eq('id', session.user.id).single();
      me = { id: session.user.id, username: p?.username || 'User', avatar: p?.avatar_url || null };
    }

    await loadItem();
    await Promise.all([loadReviews(), loadComments(), loadMyLikes()]);

    const ch = subscribe();
    return () => { ch.unsubscribe(); };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="grain"></div>

<nav class="nav">
  <a class="nav-logo" href="/app" onclick={(e) => { e.preventDefault(); goBackToApp(); }}>
    <span class="nav-logo-mark">W</span>
    <span class="nav-logo-text">atch</span>
    <span class="nav-logo-accent">Order</span>
    <div class="nav-logo-dot"></div>
  </a>
</nav>

{#if loading}
  <div class="loader">
    <div class="spinner"></div>
    <p>LOADING REVIEWS...</p>
  </div>
{:else if error}
  <div class="error-page">
    <h2>404</h2>
    <p>{error}</p>
    <button class="back-button mt-20" onclick={goBackToApp}>← BACK</button>
  </div>
{:else if sel}
  <main class="guide-container">
    <div class="guide-hero" style="background-image: url('{sel.bg || sel.poster || ''}')">
      <div class="guide-hero-overlay"></div>
      <div class="guide-hero-content">
        <button class="back-button" onclick={goBackToApp}>← BACK</button>
        <div class="overtitle"><span class="bar"></span><span>REVIEWS & DISCUSSION</span></div>
        <h1 class="guide-title">{esc(sel.title)}</h1>
        <div class="guide-meta-row">
          {#if isTV}
            <span class="guide-pill {accent.pill}">{sel.entries} SEASONS</span>
            <span class="guide-pill">{sel.years}</span>
            <span class="guide-pill {accent.pill}">{sel.status}</span>
          {:else if isSM}
            <span class="guide-pill">FILM</span>
            <span class="guide-pill">{sel.years}</span>
          {:else}
            <span class="guide-pill">{sel.entries} FILMS</span>
            <span class="guide-pill">{sel.years}</span>
          {/if}
          <span class="guide-pill merged-pill" title="TMDB: {fmtR(sel.ratingNum)} ({sel.voteCount || 0} votes) + {reviews.length} user review{reviews.length===1?'':'s'}">
            ★ {fmtR(mergedRating)} · {totalVoteCount} votes
          </span>
        </div>
      </div>
    </div>

    <div class="tab-bar">
      {#if isTV}
        <a class="tab-btn" href="guide{qs}">WATCH ORDER</a>
        <a class="tab-btn" href="episodes{qs}">EPISODES</a>
        <a class="tab-btn" href="history{qs}">HISTORY</a>
        <a class="tab-btn" href="ratings{qs}">RATINGS</a>
        <a class="tab-btn tab-active {accent.tab}" href="reviews{qs}">REVIEWS</a>
      {:else if isFr}
        <a class="tab-btn" href="guide{qs}">WATCH ORDER</a>
        <a class="tab-btn" href="history{qs}">HISTORY</a>
        <a class="tab-btn" href="ratings{qs}">RATINGS</a>
        <a class="tab-btn tab-active" href="reviews{qs}">REVIEWS</a>
      {:else}
        <a class="tab-btn" href="guide{qs}">FILM INFO</a>
        <a class="tab-btn" href="ratings{qs}">RATINGS</a>
        <a class="tab-btn tab-active" href="reviews{qs}">REVIEWS</a>
      {/if}
    </div>

    <div class="reviews-section">
      <div class="content-toggle">
        <button class="toggle-btn" class:active={activeTab==='reviews'} class:accent-anime={activeTab==='reviews' && sel.type==='anime'} class:accent-series={activeTab==='reviews' && sel.type==='series'} onclick={()=>activeTab='reviews'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          REVIEWS ({reviews.length})
        </button>
        <button class="toggle-btn" class:active={activeTab==='comments'} class:accent-anime={activeTab==='comments' && sel.type==='anime'} class:accent-series={activeTab==='comments' && sel.type==='series'} onclick={()=>activeTab='comments'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          COMMENTS ({comments.length})
        </button>
      </div>

      {#if activeTab === 'reviews'}
        <div class="add-section">
          {#if !me}
            <button class="add-btn {sel.type}" onclick={()=>showAuthModal=true}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              ADD REVIEW
            </button>
            <p class="helper-text">Sign in to share your thoughts and rate this {isTV ? 'series' : isFr ? 'franchise' : 'film'}</p>
          {:else if hasReviewed}
            <!-- Show user's existing review instead of form -->
            <div class="your-review-badge">⭐ Your Review</div>
            {@const profile = getProfile(myReview.user_id)}
            <div class="review-card your-review-card">
              <div class="review-header">
                <div class="author-info">
                  <div class="author-avatar {sel.type}">{initials(profile.username)}</div>
                  <div class="author-meta">
                    <span class="author-name">@{profile.username || 'User'}</span>
                    <span class="review-date">{fmtDate(myReview.created_at)}</span>
                  </div>
                </div>
                <div class="review-rating" style="color:{accent.color}">★ {fmtR(myReview.rating)}</div>
              </div>
              <p class="review-content">{myReview.content}</p>
            </div>
            <p class="helper-text">You can only review once. Remove your review to post a new one.</p>
          {:else}
            <div class="compose-box">
              <div class="star-input">
                {#each [1,2,3,4,5,6,7,8,9,10] as s}
                  <button class="star-btn {s <= (newReviewHover || newReviewRating) ? 'star-on' : ''}" onmouseenter={()=>newReviewHover=s} onmouseleave={()=>newReviewHover=0} onclick={()=>newReviewRating=s}>★</button>
                {/each}
                <span class="star-label">{newReviewRating ? newReviewRating + '/10' : 'Tap a star'}</span>
              </div>
              <textarea class="compose-textarea" rows="3" placeholder="Write your review..." bind:value={newReviewContent}></textarea>
              <div class="compose-actions">
                <button class="add-btn {sel.type}" disabled={submitting} onclick={submitReview}>
                  {#if submitting}<span class="spin"></span>{:else}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  {/if}
                  POST REVIEW
                </button>
              </div>
            </div>
          {/if}
        </div>

        <div class="content-list">
          {#if reviews.length === 0}
            <div class="empty-state">
              <div class="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
              <h3>No Reviews Yet</h3>
              <p>Be the first to share your thoughts</p>
            </div>
          {:else}
            {#each reviews as review (review.id)}
              {@const profile = getProfile(review.user_id)}
              <div class="review-card">
                <div class="review-header">
                  <div class="author-info">
                    <div class="author-avatar {sel.type}">{initials(profile.username)}</div>
                    <div class="author-meta">
                      <span class="author-name">@{profile.username || 'User'}</span>
                      <span class="review-date">{fmtDate(review.created_at)}</span>
                    </div>
                  </div>
                  <div class="review-rating" style="color:{accent.color}">★ {fmtR(review.rating)}</div>
                </div>
                <p class="review-content">{review.content}</p>
                <div class="review-actions">
                  <button class="action-btn {likedReviews.has(review.id)?'liked':''}" onclick={()=>toggleReviewLike(review.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                    {likedReviews.has(review.id) ? 'Liked' : 'Helpful'} · {review.likes || 0}
                  </button>
                </div>
              </div>
            {/each}
          {/if}
        </div>

      {:else}
        <!-- COMMENTS TAB -->
        <div class="add-section">
          {#if me}
            <div class="compose-box">
              <textarea class="compose-textarea" rows="2" placeholder="Add a comment..." bind:value={newCommentContent}></textarea>
              <div class="compose-actions">
                <button class="add-btn {sel.type}" disabled={submitting} onclick={() => submitComment()}>
                  {#if submitting}<span class="spin"></span>{:else}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  {/if}
                  POST COMMENT
                </button>
              </div>
            </div>
          {:else}
            <button class="add-btn {sel.type}" onclick={()=>showAuthModal=true}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              ADD COMMENT
            </button>
            <p class="helper-text">Sign in to join the discussion</p>
          {/if}
        </div>

        <div class="content-list">
          {#if comments.length === 0}
            <div class="empty-state">
              <div class="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
              <h3>No Comments Yet</h3>
              <p>Start the conversation</p>
            </div>
          {:else}
            {#each topComments as comment (comment.id)}
              {@const profile = getProfile(comment.user_id)}
              {@const replies = childComments[comment.id] || []}

              <!-- TOP-LEVEL COMMENT -->
              <div class="comment-card">
                <div class="comment-header">
                  <div class="author-info">
                    <div class="author-avatar {sel.type}">{initials(profile.username)}</div>
                    <div class="author-meta">
                      <span class="author-name">@{profile.username || 'User'}</span>
                      <span class="comment-date">{fmtDate(comment.created_at)}</span>
                    </div>
                  </div>
                </div>
                <p class="comment-content">{comment.content}</p>
                <div class="comment-actions">
                  <button class="action-btn {likedComments.has(comment.id)?'liked':''}" onclick={()=>toggleCommentLike(comment.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                    {likedComments.has(comment.id) ? 'Liked' : 'Like'} · {comment.likes || 0}
                  </button>
                  {#if me}
                    <button class="action-btn reply-action" onclick={()=>startReply(comment)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      Reply
                    </button>
                  {/if}
                </div>

                <!-- INLINE REPLY FORM -->
                {#if replyingTo?.id === comment.id}
                  <div class="reply-form-box">
                    <div class="reply-line"></div>
                    <div class="reply-input-wrap">
                      <span class="reply-label">Replying to @{profile.username || 'User'}</span>
                      <textarea class="compose-textarea reply-textarea" rows="2" placeholder="Write a reply..." bind:value={replyContent}></textarea>
                      <div class="reply-actions">
                        <button class="reply-cancel" onclick={cancelReply}>Cancel</button>
                        <button class="add-btn {sel.type}" disabled={submitting} onclick={() => submitComment(comment.id)}>
                          {#if submitting}<span class="spin"></span>{:else}Post Reply{/if}
                        </button>
                      </div>
                    </div>
                  </div>
                {/if}
              </div>

              <!-- NESTED REPLIES -->
              {#if replies.length > 0}
                <div class="replies-thread">
                  <div class="thread-line"></div>
                  <div class="replies-list">
                    {#each replies as reply (reply.id)}
                      {@const rProfile = getProfile(reply.user_id)}
                      <div class="comment-card reply-card">
                        <div class="comment-header">
                          <div class="author-info">
                            <div class="author-avatar {sel.type} sm">{initials(rProfile.username)}</div>
                            <div class="author-meta">
                              <span class="author-name">@{rProfile.username || 'User'}</span>
                              <span class="comment-date">{fmtDate(reply.created_at)}</span>
                            </div>
                          </div>
                        </div>
                        <p class="comment-content">{reply.content}</p>
                        <div class="comment-actions">
                          <button class="action-btn {likedComments.has(reply.id)?'liked':''}" onclick={()=>toggleCommentLike(reply.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                            {likedComments.has(reply.id) ? 'Liked' : 'Like'} · {reply.likes || 0}
                          </button>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  </main>
{/if}

{#if showAuthModal}
  <div class="modal-backdrop" onclick={(e)=>{if(e.target===e.currentTarget)showAuthModal=false}}>
    <div class="modal-panel">
      <button class="modal-close" onclick={()=>showAuthModal=false}>✕</button>
      <div class="modal-header">
        <div class="modal-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10,17 15,12 10,7"/><line x1="15" y1="12" x2="3" y2="12"/></svg></div>
        <h2 class="modal-title">Sign In Required</h2>
        <p class="modal-subtitle">Please sign in to {activeTab==='reviews'?'leave a review':'join the discussion'}</p>
      </div>
      <div class="modal-actions">
        <button class="auth-btn primary" onclick={()=>window.location.href='/signin'}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10,17 15,12 10,7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>Sign In</button>
        <button class="auth-btn secondary" onclick={()=>window.location.href='/signup'}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>Sign Up</button>
      </div>
      <div class="divider"><span>or continue with</span></div>
      <button class="google-btn" onclick={()=>window.location.href='/signin'}>
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Sign in with Google
      </button>
    </div>
  </div>
{/if}

<style>
  *{margin:0;padding:0;box-sizing:border-box}
  :global(body){background:#050505;color:#f0ece4;font-family:"Sora",sans-serif;overflow-x:hidden}

  .grain{position:fixed;inset:0;z-index:999;pointer-events:none;opacity:.04;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}

  .nav{position:fixed;top:0;width:100%;padding:16px 50px;display:flex;justify-content:space-between;align-items:center;z-index:500;background:rgba(5,5,5,.95);backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,.07)}
  .nav-logo{display:flex;align-items:baseline;text-decoration:none}
  .nav-logo-mark{font-family:"Cormorant Garamond";font-size:2.2rem;color:#c9a84c;font-weight:700;line-height:1}
  .nav-logo-text{font-family:"Cormorant Garamond";font-size:1.6rem;font-weight:300;color:#f0ece4}
  .nav-logo-accent{font-family:"Cormorant Garamond";font-style:italic;font-size:1.6rem;font-weight:600;opacity:.85;color:#f0ece4}
  .nav-logo-dot{width:5px;height:5px;background:#c9a84c;border-radius:50%;margin-left:5px;box-shadow:0 0 8px #c9a84c}

  @keyframes spin{to{transform:rotate(360deg)}}
  .spinner{width:36px;height:36px;border:2px solid rgba(201,168,76,.1);border-top-color:#c9a84c;border-radius:50%;animation:spin .9s linear infinite}
  .loader{min-height:80vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;color:#c9a84c;font-family:"Space Mono";font-size:.78rem}
  .error-page{min-height:80vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;text-align:center}
  .error-page h2{font-family:"Cormorant Garamond";font-size:3rem;opacity:.4}
  .mt-20{margin-top:20px}

  .guide-container{padding-top:80px}
  .guide-hero{height:50vh;background-size:cover;background-position:center;position:relative;display:flex;align-items:flex-end}
  .guide-hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(5,5,5,.2) 0%,rgba(5,5,5,.7) 60%,#050505 100%)}
  .guide-hero-content{position:relative;z-index:2;padding:0 70px 48px;max-width:900px}
  .guide-title{font-family:"Cormorant Garamond";font-size:clamp(2.5rem,5vw,4rem);font-weight:700;line-height:1;margin:12px 0 16px}
  .guide-meta-row{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;align-items:center}

  .guide-pill{font-family:"Space Mono";font-size:.6rem;letter-spacing:.12em;border:1px solid rgba(255,255,255,.18);padding:5px 12px;border-radius:2px;color:rgba(240,236,228,.65)}
  .anime-pill{border-color:rgba(224,92,122,.4);color:#e05c7a}
  .series-pill{border-color:rgba(95,191,140,.4);color:#5fbf8c}
  .merged-pill{background:rgba(201,168,76,.12);border-color:rgba(201,168,76,.5);color:#c9a84c;font-weight:700;cursor:help}

  .back-button{display:inline-flex;align-items:center;gap:8px;background:rgba(20,20,20,.8);border:1px solid rgba(201,168,76,.3);border-radius:40px;padding:8px 20px;font-family:"Space Mono";font-size:.7rem;color:#c9a84c;cursor:pointer;transition:.25s;margin-bottom:16px;outline:none}
  .back-button:hover{border-color:#c9a84c;background:rgba(30,30,30,.9)}
  .overtitle{display:flex;align-items:center;gap:14px;font-family:"Space Mono";font-size:.68rem;letter-spacing:.2em;color:#c9a84c;margin-bottom:16px}
  .overtitle .bar{width:36px;height:1px;background:#c9a84c}

  .tab-bar{display:flex;border-bottom:1px solid rgba(255,255,255,.07);padding:0 70px;position:sticky;top:64px;background:rgba(5,5,5,.96);backdrop-filter:blur(12px);z-index:50;flex-wrap:wrap}
  .tab-btn{display:inline-flex;align-items:center;color:rgba(240,236,228,.35);font-family:"Space Mono";font-size:.68rem;letter-spacing:.12em;padding:20px 24px;border-bottom:2px solid transparent;margin-bottom:-1px;transition:.22s;text-decoration:none}
  .tab-btn:hover{color:rgba(240,236,228,.6)}
  .tab-active{color:#c9a84c;border-bottom-color:#c9a84c}
  .anime-tab{color:#e05c7a;border-bottom-color:#e05c7a}
  .series-tab{color:#5fbf8c;border-bottom-color:#5fbf8c}

  .reviews-section{padding:70px 70px 120px;max-width:900px;margin:0 auto}
  .content-toggle{display:flex;gap:12px;margin-bottom:32px;border-bottom:1px solid rgba(255,255,255,.06);padding-bottom:20px}
  .toggle-btn{display:flex;align-items:center;gap:8px;background:none;border:none;color:rgba(240,236,228,.35);font-family:"Space Mono";font-size:.7rem;letter-spacing:.1em;padding:10px 20px;cursor:pointer;transition:.25s;border-radius:4px}
  .toggle-btn:hover{color:rgba(240,236,228,.6);background:rgba(255,255,255,.03)}
  .toggle-btn.active{color:#c9a84c;background:rgba(201,168,76,.1)}
  .toggle-btn.accent-anime{color:#e05c7a;background:rgba(224,92,122,.1)}
  .toggle-btn.accent-series{color:#5fbf8c;background:rgba(95,191,140,.1)}

  .add-section{background:linear-gradient(135deg,rgba(201,168,76,.08),rgba(201,168,76,.02));border:1px solid rgba(201,168,76,.2);border-radius:8px;padding:32px;text-align:center;margin-bottom:40px}
  .compose-box{text-align:left;display:flex;flex-direction:column;gap:14px}
  .star-input{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
  .star-btn{background:none;border:none;color:rgba(255,255,255,.15);font-size:1.6rem;cursor:pointer;transition:.15s;padding:0 2px;line-height:1}
  .star-btn:hover{transform:scale(1.2)}
  .star-on{color:#c9a84c;text-shadow:0 0 8px rgba(201,168,76,.4)}
  .star-label{font-family:"Space Mono";font-size:.65rem;color:rgba(240,236,228,.4);margin-left:10px;letter-spacing:.1em}
  .compose-textarea{width:100%;background:#0a0a0a;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:12px 14px;color:#f0ece4;font-family:"Sora",sans-serif;font-size:.9rem;outline:none;resize:vertical;transition:.2s}
  .compose-textarea:focus{border-color:rgba(201,168,76,.5)}
  .compose-actions{display:flex;justify-content:flex-end}

  .add-btn{display:inline-flex;align-items:center;gap:10px;background:linear-gradient(135deg,rgba(201,168,76,.2),rgba(201,168,76,.08));border:1px solid rgba(201,168,76,.5);border-radius:40px;padding:14px 32px;font-family:"Space Mono";font-size:.75rem;letter-spacing:.12em;color:#c9a84c;cursor:pointer;transition:all .3s ease}
  .add-btn:hover{border-color:#c9a84c;background:linear-gradient(135deg,rgba(201,168,76,.3),rgba(201,168,76,.12));transform:translateY(-2px);box-shadow:0 8px 24px rgba(201,168,76,.2)}
  .add-btn.anime{background:linear-gradient(135deg,rgba(224,92,122,.2),rgba(224,92,122,.08));border-color:rgba(224,92,122,.5);color:#e05c7a}
  .add-btn.anime:hover{border-color:#e05c7a;background:linear-gradient(135deg,rgba(224,92,122,.3),rgba(224,92,122,.12));box-shadow:0 8px 24px rgba(224,92,122,.2)}
  .add-btn.series{background:linear-gradient(135deg,rgba(95,191,140,.2),rgba(95,191,140,.08));border-color:rgba(95,191,140,.5);color:#5fbf8c}
  .add-btn.series:hover{border-color:#5fbf8c;background:linear-gradient(135deg,rgba(95,191,140,.3),rgba(95,191,140,.12));box-shadow:0 8px 24px rgba(95,191,140,.2)}
  .helper-text{font-size:.8rem;color:rgba(240,236,228,.4);margin-top:8px}

  /* YOUR REVIEW BADGE */
  .your-review-badge{font-family:"Space Mono";font-size:.7rem;letter-spacing:.14em;color:#c9a84c;margin-bottom:14px}
  .your-review-card{border-color:rgba(201,168,76,.3)!important;background:rgba(201,168,76,.05)!important}

  .content-list{display:flex;flex-direction:column;gap:0}
  .empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center;background:#0d0d0d;border:1px dashed rgba(255,255,255,.06);border-radius:8px;margin-bottom:16px}
  .empty-icon{width:80px;height:80px;border-radius:50%;background:rgba(201,168,76,.05);border:1px solid rgba(201,168,76,.2);display:flex;align-items:center;justify-content:center;color:rgba(201,168,76,.4);margin-bottom:20px}
  .empty-state h3{font-family:"Cormorant Garamond";font-size:1.4rem;font-weight:600;color:rgba(240,236,228,.8);margin-bottom:8px}
  .empty-state p{font-size:.9rem;color:rgba(240,236,228,.4);max-width:300px}

  .review-card,.comment-card{background:#0d0d0d;border:1px solid rgba(255,255,255,.06);border-radius:6px;padding:24px;transition:border-color .2s;margin-bottom:16px}
  .review-card:hover,.comment-card:hover{border-color:rgba(201,168,76,.2)}
  .review-header,.comment-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
  .author-info{display:flex;align-items:center;gap:12px}
  .author-avatar{width:44px;height:44px;border-radius:50%;background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.3);display:flex;align-items:center;justify-content:center;font-family:"Space Mono";font-size:.9rem;color:#c9a84c;flex-shrink:0}
  .author-avatar.sm{width:34px;height:34px;font-size:.75rem}
  .author-avatar.anime{background:rgba(224,92,122,.15);border-color:rgba(224,92,122,.3);color:#e05c7a}
  .author-avatar.series{background:rgba(95,191,140,.15);border-color:rgba(95,191,140,.3);color:#5fbf8c}
  .author-meta{display:flex;flex-direction:column;gap:4px}
  .author-name{font-family:"Cormorant Garamond";font-size:1.1rem;font-weight:600;color:#f0ece4}
  .review-date,.comment-date{font-family:"Space Mono";font-size:.55rem;color:rgba(240,236,228,.35)}
  .review-rating{font-family:"Space Mono";font-size:1.2rem;font-weight:700}
  .review-content,.comment-content{font-size:.95rem;line-height:1.7;color:rgba(240,236,228,.75);margin-bottom:20px}
  .review-actions,.comment-actions{display:flex;gap:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,.06);align-items:center;flex-wrap:wrap}
  .action-btn{display:flex;align-items:center;gap:6px;background:none;border:none;color:rgba(240,236,228,.4);font-family:"Space Mono";font-size:.6rem;letter-spacing:.08em;cursor:pointer;transition:.2s;padding:4px 8px;border-radius:4px}
  .action-btn:hover{color:#c9a84c;background:rgba(201,168,76,.08)}
  .action-btn.liked{color:#c9a84c;background:rgba(201,168,76,.12)}
  .reply-action{color:rgba(240,236,228,.5)}
  .reply-action:hover{color:#5fbf8c;background:rgba(95,191,140,.08)}

  /* REPLY THREADING */
  .replies-thread{display:flex;gap:0;margin-bottom:16px;margin-left:22px}
  .thread-line{width:2px;background:rgba(255,255,255,.08);border-radius:1px;flex-shrink:0;margin-right:16px}
  .replies-list{flex:1;display:flex;flex-direction:column;gap:12px}
  .reply-card{margin-bottom:0!important;background:#0a0a0a!important;border-color:rgba(255,255,255,.05)!important;padding:18px!important}
  .reply-card:hover{border-color:rgba(201,168,76,.15)!important}

  .reply-form-box{display:flex;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,.06)}
  .reply-line{width:3px;background:linear-gradient(180deg,#c9a84c,transparent);border-radius:2px;flex-shrink:0;opacity:.5}
  .reply-input-wrap{flex:1;display:flex;flex-direction:column;gap:10px}
  .reply-label{font-family:"Space Mono";font-size:.55rem;color:rgba(201,168,76,.7);letter-spacing:.08em}
  .reply-textarea{background:#0a0a0a!important}
  .reply-actions{display:flex;gap:10px;justify-content:flex-end;align-items:center}
  .reply-cancel{background:none;border:none;color:rgba(240,236,228,.4);font-family:"Space Mono";font-size:.6rem;letter-spacing:.08em;cursor:pointer;padding:8px 14px;transition:.2s}
  .reply-cancel:hover{color:#e74c3c}

  .modal-backdrop{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.88);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;animation:backdropIn .3s ease}
  @keyframes backdropIn{from{opacity:0}to{opacity:1}}
  .modal-panel{position:relative;width:100%;max-width:420px;background:#0a0a0a;border:1px solid rgba(201,168,76,.25);border-radius:12px;padding:40px 36px;animation:modalIn .35s cubic-bezier(.16,1,.3,1)}
  @keyframes modalIn{from{opacity:0;transform:scale(.94) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
  .modal-close{position:absolute;top:16px;right:16px;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(5,5,5,.7);color:rgba(240,236,228,.7);font-size:1.1rem;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.2s;line-height:1}
  .modal-close:hover{border-color:#c9a84c;color:#c9a84c}
  .modal-header{text-align:center;margin-bottom:32px}
  .modal-icon{width:64px;height:64px;border-radius:50%;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.3);display:flex;align-items:center;justify-content:center;color:#c9a84c;margin:0 auto 20px}
  .modal-title{font-family:"Cormorant Garamond";font-size:1.8rem;font-weight:600;margin-bottom:8px}
  .modal-subtitle{font-size:.85rem;color:rgba(240,236,228,.5);line-height:1.5}
  .modal-actions{display:flex;flex-direction:column;gap:12px;margin-bottom:24px}
  .auth-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:14px 24px;border-radius:8px;font-family:"Space Mono";font-size:.75rem;letter-spacing:.1em;cursor:pointer;transition:all .25s ease;border:none}
  .auth-btn.primary{background:linear-gradient(135deg,rgba(201,168,76,.25),rgba(201,168,76,.1));color:#c9a84c;border:1px solid rgba(201,168,76,.5)}
  .auth-btn.primary:hover{background:linear-gradient(135deg,rgba(201,168,76,.35),rgba(201,168,76,.15));border-color:#c9a84c}
  .auth-btn.secondary{background:transparent;color:rgba(240,236,228,.6);border:1px solid rgba(255,255,255,.15)}
  .auth-btn.secondary:hover{border-color:rgba(255,255,255,.3);color:#f0ece4}
  .divider{position:relative;text-align:center;margin-bottom:24px}
  .divider::before{content:"";position:absolute;top:50%;left:0;right:0;height:1px;background:rgba(255,255,255,.1)}
  .divider span{position:relative;background:#0a0a0a;padding:0 16px;font-family:"Space Mono";font-size:.6rem;color:rgba(240,236,228,.4);letter-spacing:.1em}
  .google-btn{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;padding:14px 24px;background:#fff;border:none;border-radius:8px;font-family:"Space Mono";font-size:.75rem;color:#333;cursor:pointer;transition:all .25s ease}
  .google-btn:hover{background:#f5f5f5;transform:translateY(-1px)}

  .spin{width:14px;height:14px;border:2px solid rgba(255,255,255,.2);border-top-color:currentColor;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}

  @media(max-width:768px){
    .nav{padding:14px 20px}
    .guide-hero-content{padding:0 24px 32px}
    .tab-bar{padding:0 20px;top:60px}
    .tab-btn{padding:16px 10px;font-size:.58rem}
    .reviews-section{padding:40px 20px 80px}
    .add-section{padding:24px}
    .review-card,.comment-card{padding:20px}
    .replies-thread{margin-left:12px}
    .thread-line{margin-right:10px}
    .modal-panel{padding:32px 24px}
    .empty-state{padding:40px 20px}
  }
</style>