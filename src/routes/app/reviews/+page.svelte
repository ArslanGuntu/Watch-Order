<script>
// @ts-nocheck

  import { onMount } from 'svelte';
  
  const TMDB_KEY = '175b19b3ba717bf4f24e37ee4325be7e';
  const BASE = 'https://api.themoviedb.org/3';
  const IMG = 'https://image.tmdb.org/t/p/';
  
  let itemType = $state('');
  let itemId = $state('');
  let qs = $state('');
  
  let sel = $state(null);
  let loading = $state(true);
  let error = $state(null);
  
  // Empty arrays - no mock data
  let reviews = $state([]);
  let comments = $state([]);
  
  let showAuthModal = $state(false);
  let activeTab = $state('reviews'); // 'reviews' or 'comments'
  
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  
  function fmtR(r) {
    return r > 0 ? r.toFixed(1) : '—';
  }
  
  function accentCol(t) {
    return t === 'anime' ? '#e05c7a' : t === 'series' ? '#5fbf8c' : '#c9a84c';
  }
  
  function getYearRange(parts) {
    const y = (parts || []).map(p => +(p.release_date || p.first_air_date || '').slice(0, 4)).filter(Boolean).sort((a, b) => a - b);
    return y.length ? `${y[0]}–${y[y.length - 1]}` : 'N/A';
  }
  
  function goBackToApp() {
    sessionStorage.setItem('wo_from_guide', '1');
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/app';
    }
  }
  
  function initials(n) {
    return n ? n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '??';
  }
  
  function openAuthModal() {
    showAuthModal = true;
    document.body.style.overflow = 'hidden';
  }
  
  function closeAuthModal() {
    showAuthModal = false;
    document.body.style.overflow = '';
  }
  
  function goToSignIn() {
    window.location.href = '/signin';
  }
  
  function goToSignUp() {
    window.location.href = '/signup';
  }
  
  async function loadItem() {
    try {
      const isTV = itemType === 'anime' || itemType === 'series';
      const isFr = itemType === 'franchises';
      
      if (isFr) {
        const colId = String(itemId).replace(/^col_/, '');
        const col = await fetch(`${BASE}/collection/${colId}?api_key=${TMDB_KEY}`).then(r => r.json());
        const parts = (col.parts || []).filter(p => p.release_date).sort((a, b) => a.release_date.localeCompare(b.release_date));
        
        sel = {
          id: itemId,
          type: 'franchises',
          title: (col.name || '').replace(/ Collection$/i, ''),
          entries: parts.length,
          desc: col.overview || '',
          bg: col.backdrop_path ? `${IMG}w1280${col.backdrop_path}` : '',
          poster: col.poster_path ? `${IMG}w500${col.poster_path}` : '',
          years: getYearRange(parts),
          ratingNum: 0,
          rating: '—'
        };
        
      } else if (itemType === 'movies') {
        const m = await fetch(`${BASE}/movie/${itemId}?api_key=${TMDB_KEY}`).then(r => r.json());
        
        sel = {
          id: itemId,
          type: 'movies',
          title: m.title || m.original_title || 'Unknown',
          entries: 1,
          desc: m.overview || '',
          bg: m.backdrop_path ? `${IMG}w1280${m.backdrop_path}` : '',
          poster: m.poster_path ? `${IMG}w500${m.poster_path}` : '',
          years: m.release_date ? m.release_date.slice(0, 4) : 'N/A',
          ratingNum: m.vote_average || 0,
          rating: fmtR(m.vote_average || 0)
        };
        
      } else if (isTV) {
        const sd = await fetch(`${BASE}/tv/${itemId}?api_key=${TMDB_KEY}`).then(r => r.json());
        const seasons = (sd.seasons || []).filter(s => s.season_number > 0);
        
        sel = {
          id: +itemId,
          type: itemType,
          title: sd.name || sd.original_name || 'Unknown',
          entries: seasons.length,
          desc: sd.overview || '',
          bg: sd.backdrop_path ? `${IMG}w1280${sd.backdrop_path}` : '',
          poster: sd.poster_path ? `${IMG}w500${sd.poster_path}` : '',
          posterUrl: sd.poster_path ? `${IMG}w300${sd.poster_path}` : '',
          years: sd.first_air_date ? sd.first_air_date.slice(0, 4) + (sd.last_air_date && sd.status !== 'Returning Series' ? '–' + sd.last_air_date.slice(0, 4) : '–') : 'N/A',
          status: sd.status || '',
          ratingNum: sd.vote_average || 0,
          rating: fmtR(sd.vote_average || 0)
        };
      }
      
      document.title = sel.title + ' · Reviews · WatchOrder';
      loading = false;
    } catch (e) {
      console.error(e);
      error = 'Could not load.';
      loading = false;
    }
  }
  
  function handleKeydown(e) {
    if (e.key === 'Escape' && showAuthModal) {
      closeAuthModal();
    }
  }
  
  // Derived values
  let ac = $derived(sel?.type === 'anime' ? 'anime' : sel?.type === 'series' ? 'series' : '');
  let isTV = $derived(sel?.type === 'anime' || sel?.type === 'series');
  let isFr = $derived(sel?.type === 'franchises');
  let isSM = $derived(sel?.type === 'movies');
  let acColor = $derived(accentCol(sel?.type));
  
  onMount(() => {
    const url = new URL(window.location.href);
    itemType = url.searchParams.get('type') || '';
    itemId = url.searchParams.get('id') || '';
    qs = '?type=' + encodeURIComponent(itemType) + '&id=' + encodeURIComponent(itemId);
    
    if (!itemType || !itemId) {
      error = 'No guide found.';
      loading = false;
    } else {
      loadItem();
    }
    
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="grain"></div>

<nav class="nav">
  <a class="nav-logo" href="/" onclick={(e) => { e.preventDefault(); goBackToApp(); }}>
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
    <button class="back-button" style="margin-top:20px" onclick={goBackToApp}>← BACK</button>
  </div>
{:else if sel}
  <main class="guide-container">
    <div class="guide-hero" style="background-image: url('{sel.bg || sel.poster || ''}')">
      <div class="guide-hero-overlay"></div>
      <div class="guide-hero-content">
        <button class="back-button" onclick={goBackToApp}>← BACK</button>
        <div class="overtitle">
          <span class="bar"></span>
          <span>REVIEWS & DISCUSSION</span>
        </div>
        <h1 class="guide-title">{sel.title}</h1>
        <div class="guide-meta-row">
          {#if isTV}
            <span class="guide-pill {ac}-pill">{sel.entries} SEASONS</span>
            <span class="guide-pill">{sel.years || ''}</span>
            <span class="guide-pill {ac}-pill">{sel.status || ''}</span>
          {:else if isSM}
            <span class="guide-pill">FILM</span>
            <span class="guide-pill">{sel.years || ''}</span>
            {#if sel.ratingNum > 0}
              <span class="guide-pill">★ {sel.rating}</span>
            {/if}
          {:else}
            <span class="guide-pill">{sel.entries} FILMS</span>
            <span class="guide-pill">{sel.years || ''}</span>
          {/if}
        </div>
      </div>
    </div>
    
    <!-- Tabs -->
    <div class="tab-bar">
      {#if isTV}
        <a class="tab-btn" href="guide{qs}">WATCH ORDER</a>
        <a class="tab-btn" href="episodes{qs}">EPISODES</a>
        <a class="tab-btn" href="history{qs}">HISTORY</a>
        <a class="tab-btn" href="ratings{qs}">RATINGS</a>
        <a class="tab-btn tab-active {ac}-tab" href="reviews{qs}">REVIEWS</a>
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
      <!-- Toggle between Reviews and Comments -->
      <div class="content-toggle">
        <button 
          class="toggle-btn {activeTab === 'reviews' ? 'active' : ''} {ac}"
          onclick={() => activeTab = 'reviews'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          REVIEWS ({reviews.length})
        </button>
        <button 
          class="toggle-btn {activeTab === 'comments' ? 'active' : ''} {ac}"
          onclick={() => activeTab = 'comments'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          COMMENTS ({comments.length})
        </button>
      </div>
      
      <!-- Add Button -->
      <div class="add-section">
        {#if activeTab === 'reviews'}
          <button class="add-btn {ac}" onclick={openAuthModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            ADD REVIEW
          </button>
          <p class="helper-text">Share your thoughts and rate this {isTV ? 'series' : isFr ? 'franchise' : 'film'}</p>
        {:else}
          <button class="add-btn {ac}" onclick={openAuthModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            ADD COMMENT
          </button>
          <p class="helper-text">Join the discussion and ask questions</p>
        {/if}
      </div>
      
      <!-- Content List -->
      <div class="content-list">
        {#if activeTab === 'reviews'}
          {#if reviews.length === 0}
            <div class="empty-state">
              <div class="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <h3>No Reviews Yet</h3>
              <p>Be the first to share your thoughts on this {isTV ? 'series' : isFr ? 'franchise' : 'film'}</p>
            </div>
          {:else}
            {#each reviews as review}
              <div class="review-card">
                <div class="review-header">
                  <div class="author-info">
                    <div class="author-avatar {ac}">
                      {initials(review.author)}
                    </div>
                    <div class="author-meta">
                      <span class="author-name">{review.author}</span>
                      <span class="review-date">{review.date}</span>
                    </div>
                  </div>
                  <div class="review-rating" style="color: {acColor}">
                    ★ {review.rating.toFixed(1)}
                  </div>
                </div>
                <p class="review-content">{review.content}</p>
                <div class="review-actions">
                  <button class="action-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                    </svg>
                    {review.likes} Helpful
                  </button>
                  <button class="action-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    {review.replies} Replies
                  </button>
                </div>
              </div>
            {/each}
          {/if}
        {:else}
          {#if comments.length === 0}
            <div class="empty-state">
              <div class="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h3>No Comments Yet</h3>
              <p>Start the conversation by adding the first comment</p>
            </div>
          {:else}
            {#each comments as comment}
              <div class="comment-card">
                <div class="comment-header">
                  <div class="author-info">
                    <div class="author-avatar {ac}">
                      {initials(comment.author)}
                    </div>
                    <div class="author-meta">
                      <span class="author-name">{comment.author}</span>
                      <span class="comment-date">{comment.date}</span>
                    </div>
                  </div>
                </div>
                <p class="comment-content">{comment.content}</p>
                <div class="comment-actions">
                  <button class="action-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                    </svg>
                    {comment.likes} Likes
                  </button>
                  <button class="action-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    Reply
                  </button>
                  <button class="action-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    {comment.replies} Replies
                  </button>
                </div>
              </div>
            {/each}
          {/if}
        {/if}
      </div>
    </div>
  </main>
{/if}

<!-- Auth Modal -->
{#if showAuthModal}
  <div class="modal-backdrop" class:closing={!showAuthModal} onclick={(e) => { if (e.target === e.currentTarget) closeAuthModal(); }}>
    <div class="modal-panel" class:closing={!showAuthModal}>
      <button class="modal-close" onclick={closeAuthModal}>✕</button>
      
      <div class="modal-header">
        <div class="modal-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
            <polyline points="10,17 15,12 10,7"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
        </div>
        <h2 class="modal-title">Sign In Required</h2>
        <p class="modal-subtitle">Please sign in or create an account to {activeTab === 'reviews' ? 'leave a review' : 'join the discussion'}</p>
      </div>
      
      <div class="modal-actions">
        <button class="auth-btn primary" onclick={goToSignIn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
            <polyline points="10,17 15,12 10,7"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
          Sign In
        </button>
        
        <button class="auth-btn secondary" onclick={goToSignUp}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          Sign Up
        </button>
      </div>
      
      <div class="divider">
        <span>or continue with</span>
      </div>
      
      <button class="google-btn" onclick={goToSignIn}>
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      </button>
    </div>
  </div>
{/if}

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  :global(body) {
    background: #050505;
    color: #f0ece4;
    font-family: "Sora", sans-serif;
    overflow-x: hidden;
  }

  .grain {
    position: fixed;
    inset: 0;
    z-index: 999;
    pointer-events: none;
    opacity: 0.04;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  .nav {
    position: fixed;
    top: 0;
    width: 100%;
    padding: 16px 50px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 500;
    box-sizing: border-box;
    background: rgba(5, 5, 5, 0.95);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .nav-logo {
    display: flex;
    align-items: baseline;
    gap: 0;
    text-decoration: none;
  }

  .nav-logo-mark {
    font-family: "Cormorant Garamond";
    font-size: 2.2rem;
    color: #c9a84c;
    font-weight: 700;
    line-height: 1;
  }

  .nav-logo-text {
    font-family: "Cormorant Garamond";
    font-size: 1.6rem;
    font-weight: 300;
    color: #f0ece4;
  }

  .nav-logo-accent {
    font-family: "Cormorant Garamond";
    font-style: italic;
    font-size: 1.6rem;
    font-weight: 600;
    opacity: 0.85;
    color: #f0ece4;
  }

  .nav-logo-dot {
    width: 5px;
    height: 5px;
    background: #c9a84c;
    border-radius: 50%;
    margin-left: 5px;
    box-shadow: 0 0 8px #c9a84c;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 2px solid rgba(201, 168, 76, 0.1);
    border-top-color: #c9a84c;
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }

  .loader {
    min-height: 80vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    color: #c9a84c;
    font-family: "Space Mono";
    font-size: 0.78rem;
  }

  .error-page {
    min-height: 80vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    text-align: center;
  }

  .error-page h2 {
    font-family: "Cormorant Garamond";
    font-size: 3rem;
    opacity: 0.4;
  }

  .guide-container {
    padding-top: 80px;
  }

  .guide-hero {
    height: 50vh;
    background-size: cover;
    background-position: center;
    position: relative;
    display: flex;
    align-items: flex-end;
  }

  .guide-hero-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(5, 5, 5, 0.2) 0%, rgba(5, 5, 5, 0.7) 60%, rgba(5, 5, 5, 1) 100%);
  }

  .guide-hero-content {
    position: relative;
    z-index: 2;
    padding: 0 70px 48px;
    max-width: 900px;
  }

  .guide-title {
    font-family: "Cormorant Garamond";
    font-size: clamp(2.5rem, 5vw, 4rem);
    font-weight: 700;
    line-height: 1;
    margin: 12px 0 16px;
  }

  .guide-meta-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .guide-pill {
    font-family: "Space Mono";
    font-size: 0.6rem;
    letter-spacing: 0.12em;
    border: 1px solid rgba(255, 255, 255, 0.18);
    padding: 5px 12px;
    border-radius: 2px;
    color: rgba(240, 236, 228, 0.65);
  }

  .guide-pill.anime-pill {
    border-color: rgba(224, 92, 122, 0.4);
    color: #e05c7a;
  }

  .guide-pill.series-pill {
    border-color: rgba(95, 191, 140, 0.4);
    color: #5fbf8c;
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(20, 20, 20, 0.8);
    border: 1px solid rgba(201, 168, 76, 0.3);
    border-radius: 40px;
    padding: 8px 20px;
    font-family: "Space Mono";
    font-size: 0.7rem;
    color: #c9a84c;
    cursor: pointer;
    transition: 0.25s;
    margin-bottom: 16px;
    text-decoration: none;
    outline: none;
  }

  .back-button:hover {
    border-color: #c9a84c;
    background: rgba(30, 30, 30, 0.9);
  }

  .overtitle {
    display: flex;
    align-items: center;
    gap: 14px;
    font-family: "Space Mono";
    font-size: 0.68rem;
    letter-spacing: 0.2em;
    color: #c9a84c;
    margin-bottom: 16px;
  }

  .overtitle .bar {
    width: 36px;
    height: 1px;
    background: #c9a84c;
  }

  .tab-bar {
    display: flex;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    padding: 0 70px;
    position: sticky;
    top: 64px;
    background: rgba(5, 5, 5, 0.96);
    backdrop-filter: blur(12px);
    z-index: 50;
    flex-wrap: wrap;
  }

  .tab-btn {
    display: inline-flex;
    align-items: center;
    color: rgba(240, 236, 228, 0.35);
    font-family: "Space Mono";
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    padding: 20px 24px;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: 0.22s;
    text-decoration: none;
  }

  .tab-btn:hover {
    color: rgba(240, 236, 228, 0.6);
  }

  .tab-active {
    color: #c9a84c !important;
    border-bottom-color: #c9a84c !important;
  }

  .tab-active.anime-tab {
    color: #e05c7a !important;
    border-bottom-color: #e05c7a !important;
  }

  .tab-active.series-tab {
    color: #5fbf8c !important;
    border-bottom-color: #5fbf8c !important;
  }

  .reviews-section {
    padding: 70px 70px 120px;
    max-width: 900px;
    margin: 0 auto;
  }

  .content-toggle {
    display: flex;
    gap: 12px;
    margin-bottom: 32px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding-bottom: 20px;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    color: rgba(240, 236, 228, 0.35);
    font-family: "Space Mono";
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    padding: 10px 20px;
    cursor: pointer;
    transition: 0.25s;
    border-radius: 4px;
  }

  .toggle-btn:hover {
    color: rgba(240, 236, 228, 0.6);
    background: rgba(255, 255, 255, 0.03);
  }

  .toggle-btn.active {
    color: #c9a84c;
    background: rgba(201, 168, 76, 0.1);
  }

  .toggle-btn.active.anime {
    color: #e05c7a;
    background: rgba(224, 92, 122, 0.1);
  }

  .toggle-btn.active.series {
    color: #5fbf8c;
    background: rgba(95, 191, 140, 0.1);
  }

  .add-section {
    background: linear-gradient(135deg, rgba(201, 168, 76, 0.08), rgba(201, 168, 76, 0.02));
    border: 1px solid rgba(201, 168, 76, 0.2);
    border-radius: 8px;
    padding: 32px;
    text-align: center;
    margin-bottom: 40px;
  }

  .add-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: linear-gradient(135deg, rgba(201, 168, 76, 0.2), rgba(201, 168, 76, 0.08));
    border: 1px solid rgba(201, 168, 76, 0.5);
    border-radius: 40px;
    padding: 14px 32px;
    font-family: "Space Mono";
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    color: #c9a84c;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-bottom: 12px;
  }

  .add-btn:hover {
    border-color: #c9a84c;
    background: linear-gradient(135deg, rgba(201, 168, 76, 0.3), rgba(201, 168, 76, 0.12));
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(201, 168, 76, 0.2);
  }

  .add-btn.anime {
    background: linear-gradient(135deg, rgba(224, 92, 122, 0.2), rgba(224, 92, 122, 0.08));
    border-color: rgba(224, 92, 122, 0.5);
    color: #e05c7a;
  }

  .add-btn.anime:hover {
    border-color: #e05c7a;
    background: linear-gradient(135deg, rgba(224, 92, 122, 0.3), rgba(224, 92, 122, 0.12));
    box-shadow: 0 8px 24px rgba(224, 92, 122, 0.2);
  }

  .add-btn.series {
    background: linear-gradient(135deg, rgba(95, 191, 140, 0.2), rgba(95, 191, 140, 0.08));
    border-color: rgba(95, 191, 140, 0.5);
    color: #5fbf8c;
  }

  .add-btn.series:hover {
    border-color: #5fbf8c;
    background: linear-gradient(135deg, rgba(95, 191, 140, 0.3), rgba(95, 191, 140, 0.12));
    box-shadow: 0 8px 24px rgba(95, 191, 140, 0.2);
  }

  .helper-text {
    font-size: 0.8rem;
    color: rgba(240, 236, 228, 0.4);
  }

  .content-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Empty State Styles */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
    background: #0d0d0d;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    border-style: dashed;
  }

  .empty-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: rgba(201, 168, 76, 0.05);
    border: 1px solid rgba(201, 168, 76, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(201, 168, 76, 0.4);
    margin-bottom: 20px;
  }

  .empty-state h3 {
    font-family: "Cormorant Garamond";
    font-size: 1.4rem;
    font-weight: 600;
    color: rgba(240, 236, 228, 0.8);
    margin-bottom: 8px;
  }

  .empty-state p {
    font-size: 0.9rem;
    color: rgba(240, 236, 228, 0.4);
    max-width: 300px;
  }

  .review-card, .comment-card {
    background: #0d0d0d;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    padding: 24px;
    transition: border-color 0.2s;
  }

  .review-card:hover, .comment-card:hover {
    border-color: rgba(201, 168, 76, 0.2);
  }

  .review-header, .comment-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  .author-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .author-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(201, 168, 76, 0.15);
    border: 1px solid rgba(201, 168, 76, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "Space Mono";
    font-size: 0.9rem;
    color: #c9a84c;
    flex-shrink: 0;
  }

  .author-avatar.anime {
    background: rgba(224, 92, 122, 0.15);
    border-color: rgba(224, 92, 122, 0.3);
    color: #e05c7a;
  }

  .author-avatar.series {
    background: rgba(95, 191, 140, 0.15);
    border-color: rgba(95, 191, 140, 0.3);
    color: #5fbf8c;
  }

  .author-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .author-name {
    font-family: "Cormorant Garamond";
    font-size: 1.1rem;
    font-weight: 600;
    color: #f0ece4;
  }

  .review-date, .comment-date {
    font-family: "Space Mono";
    font-size: 0.55rem;
    color: rgba(240, 236, 228, 0.35);
  }

  .review-rating {
    font-family: "Space Mono";
    font-size: 1.2rem;
    font-weight: 700;
  }

  .review-content, .comment-content {
    font-size: 0.95rem;
    line-height: 1.7;
    color: rgba(240, 236, 228, 0.75);
    margin-bottom: 20px;
  }

  .review-actions, .comment-actions {
    display: flex;
    gap: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: rgba(240, 236, 228, 0.4);
    font-family: "Space Mono";
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    cursor: pointer;
    transition: 0.2s;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .action-btn:hover {
    color: #c9a84c;
    background: rgba(201, 168, 76, 0.08);
  }

  /* Modal Styles */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9000;
    background: rgba(0, 0, 0, 0.88);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: backdropIn 0.3s ease;
  }

  @keyframes backdropIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-backdrop.closing {
    animation: backdropOut 0.25s ease forwards;
  }

  @keyframes backdropOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }

  .modal-panel {
    position: relative;
    width: 100%;
    max-width: 420px;
    background: #0a0a0a;
    border: 1px solid rgba(201, 168, 76, 0.25);
    border-radius: 12px;
    padding: 40px 36px;
    animation: modalIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .modal-panel.closing {
    animation: modalOut 0.25s ease forwards;
  }

  @keyframes modalIn {
    from { opacity: 0; transform: scale(0.94) translateY(20px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  @keyframes modalOut {
    from { opacity: 1; transform: scale(1); }
    to { opacity: 0; transform: scale(0.96); }
  }

  .modal-close {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(5, 5, 5, 0.7);
    color: rgba(240, 236, 228, 0.7);
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: 0.2s;
    line-height: 1;
  }

  .modal-close:hover {
    border-color: #c9a84c;
    color: #c9a84c;
  }

  .modal-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .modal-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(201, 168, 76, 0.1);
    border: 1px solid rgba(201, 168, 76, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c9a84c;
    margin: 0 auto 20px;
  }

  .modal-title {
    font-family: "Cormorant Garamond";
    font-size: 1.8rem;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .modal-subtitle {
    font-size: 0.85rem;
    color: rgba(240, 236, 228, 0.5);
    line-height: 1.5;
  }

  .modal-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
  }

  .auth-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 14px 24px;
    border-radius: 8px;
    font-family: "Space Mono";
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    cursor: pointer;
    transition: all 0.25s ease;
    border: none;
  }

  .auth-btn.primary {
    background: linear-gradient(135deg, rgba(201, 168, 76, 0.25), rgba(201, 168, 76, 0.1));
    color: #c9a84c;
    border: 1px solid rgba(201, 168, 76, 0.5);
  }

  .auth-btn.primary:hover {
    background: linear-gradient(135deg, rgba(201, 168, 76, 0.35), rgba(201, 168, 76, 0.15));
    border-color: #c9a84c;
  }

  .auth-btn.secondary {
    background: transparent;
    color: rgba(240, 236, 228, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .auth-btn.secondary:hover {
    border-color: rgba(255, 255, 255, 0.3);
    color: #f0ece4;
  }

  .divider {
    position: relative;
    text-align: center;
    margin-bottom: 24px;
  }

  .divider::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
  }

  .divider span {
    position: relative;
    background: #0a0a0a;
    padding: 0 16px;
    font-family: "Space Mono";
    font-size: 0.6rem;
    color: rgba(240, 236, 228, 0.4);
    letter-spacing: 0.1em;
  }

  .google-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    padding: 14px 24px;
    background: #fff;
    border: none;
    border-radius: 8px;
    font-family: "Space Mono";
    font-size: 0.75rem;
    color: #333;
    cursor: pointer;
    transition: all 0.25s ease;
  }

  .google-btn:hover {
    background: #f5f5f5;
    transform: translateY(-1px);
  }

  @media (max-width: 768px) {
    .nav {
      padding: 14px 20px;
    }
    .guide-hero-content {
      padding: 0 24px 32px;
    }
    .tab-bar {
      padding: 0 20px;
      top: 60px;
    }
    .tab-btn {
      padding: 16px 10px;
      font-size: 0.58rem;
    }
    .reviews-section {
      padding: 40px 20px 80px;
    }
    .add-section {
      padding: 24px;
    }
    .review-card, .comment-card {
      padding: 20px;
    }
    .modal-panel {
      padding: 32px 24px;
    }
    .empty-state {
      padding: 40px 20px;
    }
  }
</style>