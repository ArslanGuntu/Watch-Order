<script>
  import { onMount } from 'svelte';
  
  // ── Cursor ──
  let cursor = $state({ x: 0, y: 0, rot: 0 });
  let cursorVisible = $state(true);
  let lastX = 0, lastY = 0;
  
  // ── Scroll ──
  let scrollY = $state(0);
  
  // ── Hero reveal sequence ──
  let reveal = $state(0);
  
  // ── Features ──
  let activeFeature = $state(0);
  
  // ── Guide toggle ──
  let guideMode = $state('release');
  
  // ── Data ──
  const tickerItems = [
    'MCU', 'STAR WARS', 'DRAGON BALL', 'JOHN WICK', 'DUNE', 'BATMAN',
    'ONE PIECE', 'WITCHER', 'INDIANA JONES', 'FAST & FURIOUS',
    'MISSION IMPOSSIBLE', 'JAMES BOND', 'ALIEN', 'PREDATOR',
    'JURASSIC PARK', 'TERMINATOR'
  ];
  
  const franchises = [
    { idx: '01', type: 'FILM FRANCHISE', years: '2008–2024', title: 'Marvel Cinematic Universe', desc: '5 phases. 33 entries. One universe that changed cinema forever.', entries: '33 entries', label: 'lbl-amber', labelText: 'ESSENTIAL' },
    { idx: '02', type: 'SAGA', years: '1977–2024', title: 'Star Wars', desc: 'The saga that defined a generation. Release order vs. timeline — finally solved.', entries: '18 entries', label: 'lbl-blue', labelText: 'COMPLEX' },
    { idx: '03', type: 'ANIME FRANCHISE', years: '1986–2024', title: 'Dragon Ball', desc: 'From DB to Super. Every arc, every transformation, every skip guide.', entries: '21 entries', label: 'lbl-amber', labelText: 'ESSENTIAL' },
    { idx: '04', type: 'FILM FRANCHISE', years: '2014–2023', title: 'John Wick', desc: 'A clean linear saga. Watch in order. No exceptions.', entries: '5 entries', label: 'lbl-green', labelText: 'LINEAR' },
    { idx: '05', type: 'SERIES', years: '2019–2024', title: 'The Witcher', desc: 'Non-linear timelines across multiple series, films and spin-offs.', entries: '8 entries', label: 'lbl-blue', labelText: 'COMPLEX' }
  ];
  
  const features = [
    { num: '01', title: 'Two orders. One guide.', sub: 'Release order vs story timeline — clearly separated, never confused.', img: 'https://image.tmdb.org/t/p/w780/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg', detail: 'Every franchise guide shows you both the order films were released AND the in-universe chronological order. Toggle between them instantly. Know the difference. Choose your path.' },
    { num: '02', title: 'Every entry is labeled.', sub: 'Essential, Optional, Skip, or Watch Last — curated by humans.', img: 'https://i.redd.it/f46xrb44ysn81.jpg', detail: 'No algorithm. No automation. Every single entry in every franchise is reviewed and labeled by our curators. You will always know exactly what matters and what you can skip.' },
    { num: '03', title: 'No spoilers. Just clarity.', sub: 'Context without ruining what comes next.', img: 'https://wallpapers.com/images/hd/dragon-ball-z-4z6kt1zztr1mlz9q.jpg', detail: 'Each entry includes a brief spoiler-free note explaining why it matters, what it sets up, and whether skipping it affects your understanding. Intelligence without ruining the experience.' },
    { num: '04', title: 'Movies. Series. Anime.', sub: 'Every franchise type — one platform.', img: 'https://image.tmdb.org/t/p/w780/fZPSd91yGE9fCcCe6OoQr6E3Bev.jpg', detail: 'MCU to Monsterverse. Star Wars to Star Trek. Dragon Ball to One Piece. We cover film franchises, TV series, and anime with the same obsessive level of curation across all of them.' }
  ];
  
  const guideEntries = [
    { num: '01', title: 'Iron Man', year: '2008', time: '2h 6m', note: 'The genesis. Do not skip under any circumstances.', label: 'lbl-amber', labelText: 'ESSENTIAL' },
    { num: '02', title: 'The Incredible Hulk', year: '2008', time: '1h 52m', note: 'Loosely tied in. Hulk is recast immediately after.', label: 'lbl-blue', labelText: 'OPTIONAL' },
    { num: '03', title: 'Iron Man 2', year: '2010', time: '2h 4m', note: 'Introduces Black Widow and Nick Fury properly.', label: 'lbl-amber', labelText: 'ESSENTIAL' },
    { num: '04', title: 'Thor', year: '2011', time: '1h 55m', note: 'Introduces the Tesseract. Sets up Infinity Stones.', label: 'lbl-amber', labelText: 'ESSENTIAL' },
    { num: '05', title: 'Captain America: The First Avenger', year: '2011', time: '2h 4m', note: 'Essential origin. Directly leads into The Avengers.', label: 'lbl-amber', labelText: 'ESSENTIAL' },
    { num: '06', title: 'The Avengers', year: '2012', time: '2h 23m', note: 'Phase 1 finale. The payoff for everything before it.', label: 'lbl-amber', labelText: 'ESSENTIAL', last: true }
  ];
  
  function onMouseMove(e) {
    const vx = e.clientX - lastX;
    const vy = e.clientY - lastY;
    cursor = {
      x: e.clientX,
      y: e.clientY,
      rot: Math.atan2(vy, vx) * 180 / Math.PI
    };
    lastX = e.clientX;
    lastY = e.clientY;
  }
  
  onMount(() => {
    const timers = [50, 150, 250, 350, 450, 550, 650, 750, 850, 950];
    timers.forEach((t, i) => setTimeout(() => reveal = i + 1, t));
  });
</script>

<svelte:window
  onmousemove={onMouseMove}
  onscroll={() => scrollY = window.scrollY}
  onmouseleave={() => cursorVisible = false}
  onmouseenter={() => cursorVisible = true}
/>

<!-- Custom Cursor -->
<div class="custom-dot" style="left: {cursor.x}px; top: {cursor.y}px; opacity: {cursorVisible ? 1 : 0}"></div>
<div
  class="custom-ring"
  style="left: {cursor.x}px; top: {cursor.y}px; transform: translate(-50%, -50%) rotate({cursor.rot}deg); opacity: {cursorVisible ? 1 : 0}"
></div>

<!-- Grain -->
<div class="grain"></div>

<!-- Navigation -->
<nav class="nav" class:nav-visible={reveal >= 1} class:nav-scrolled={scrollY > 60}>
  <a href="/" class="nav-logo">
    <span class="nav-logo-mark">W</span>
    <span class="nav-logo-text">atch</span>
    <span class="nav-logo-accent">Order</span>
    <span class="nav-logo-dot"></span>
  </a>

  <ul class="nav-links">
    <li><a href="/franchises">Franchises</a></li>
    <li><a href="/anime">Anime</a></li>
    <li><a href="/series">Series</a></li>
    <li><a href="/new">New Guides</a></li>
  </ul>

  <a href="/franchises" class="nav-cta">
    <span>Browse Guides</span>
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" stroke-width="1.4"/></svg>
  </a>
</nav>

<!-- Hero -->
<section class="hero">
  <div class="hero-bg-image"></div>
  <div class="hero-bg-overlay"></div>

  <div class="hero-content">
    <h1 class="hero-title">
      <span class="hero-line-1" class:hero-visible={reveal >= 2}>NEVER</span>
      <span class="hero-line-2" class:hero-visible={reveal >= 3}>watch a franchise</span>
      <span class="hero-line-3" class:hero-visible={reveal >= 4}>IN THE</span>
      <span class="hero-line-4" class:hero-visible={reveal >= 5}>WRONG</span>
      <span class="hero-line-5" class:hero-visible={reveal >= 6}>order again.</span>
    </h1>

    <p class="hero-subtitle" class:hero-visible={reveal >= 7}>
      Every major franchise. Release order and story timeline. Every entry labeled — essential, optional, or skip. One place. Zero confusion.
    </p>

    <div class="hero-actions" class:hero-visible={reveal >= 8}>
      <a href="/franchises" class="btn-primary">
        <span>Browse All Franchises</span>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" stroke-width="1.4"/></svg>
      </a>
      <a href="#how" class="btn-ghost">How it works ↓</a>
    </div>

    <div class="hero-stats" class:hero-visible={reveal >= 9}>
      <div class="hero-stat"><span class="stat-value">340+</span><span class="stat-label">Franchises</span></div>
      <div class="hero-stat"><span class="stat-value">4,800+</span><span class="stat-label">Entries mapped</span></div>
      <div class="hero-stat"><span class="stat-value">2</span><span class="stat-label">Orders per guide</span></div>
      <div class="hero-stat"><span class="stat-value">100%</span><span class="stat-label">Spoiler free</span></div>
    </div>
  </div>

  <div class="hero-vertical-label" class:hero-visible={reveal >= 10}>
    <span>WATCH · ORDER · GUIDE · 340+ FRANCHISES</span>
  </div>

  <div class="scroll-indicator" class:hero-visible={reveal >= 10}>
    <div class="scroll-line"></div>
    <span>Scroll</span>
  </div>
</section>

<!-- Ticker -->
<div class="ticker">
  <div class="ticker-track">
    {#each Array(3) as _}
      {#each tickerItems as item}
        <span class="ticker-item">{item}<span class="ticker-sep">✦</span></span>
      {/each}
    {/each}
  </div>
</div>

<!-- Franchises -->
<section class="franchises-section">
  <div class="section-header">
    <div>
      <div class="section-overtitle">
        <span class="overtitle-bar"></span>
        <span>Featured Guides</span>
      </div>
      <h2 class="section-title">The franchises<br /><em>everyone gets lost in.</em></h2>
    </div>
    <a href="/franchises" class="view-all-link">View all 340+ franchises →</a>
  </div>

  <div class="franchise-list">
    {#each franchises as f}
      <div class="franchise-row">
        <div class="franchise-left">
          <span class="franchise-idx">{f.idx}</span>
          <div><span class="franchise-type">{f.type}</span><span class="franchise-years">{f.years}</span></div>
        </div>
        <div class="franchise-center">
          <span class="franchise-title">{f.title}</span>
          <p class="franchise-desc">{f.desc}</p>
        </div>
        <div class="franchise-right">
          <span class="franchise-entries">{f.entries}</span>
          <span class="label {f.label}">{f.labelText}</span>
          <svg class="franchise-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 10h14M11 5l5 5-5 5" stroke="currentColor" stroke-width="1.4"/></svg>
        </div>
      </div>
    {/each}
  </div>
</section>

<!-- Split -->
<section class="split-section">
  <div class="split-container">
    <div class="split-side">
      <div class="split-badge bad">WITHOUT WATCHORDER</div>
      <h3 class="split-title">The chaos<br /><em>of starting blind.</em></h3>
      <div class="split-list">
        <div class="split-item bad"><span class="split-icon">✗</span><span>Reddit threads with 47 conflicting opinions</span></div>
        <div class="split-item bad"><span class="split-icon">✗</span><span>Accidentally watching a sequel first</span></div>
        <div class="split-item bad"><span class="split-icon">✗</span><span>Major spoilers in watch order guides</span></div>
        <div class="split-item bad"><span class="split-icon">✗</span><span>No idea which films are skippable</span></div>
        <div class="split-item bad"><span class="split-icon">✗</span><span>Wasting 2 hours on filler you did not need</span></div>
        <div class="split-item bad"><span class="split-icon">✗</span><span>Release order vs timeline — zero clarity</span></div>
      </div>
    </div>

    <div class="split-divider">
      <div class="divider-line"></div>
      <div class="divider-circle">VS</div>
      <div class="divider-line"></div>
    </div>

    <div class="split-side">
      <div class="split-badge good">WITH WATCHORDER</div>
      <h3 class="split-title">The clarity<br /><em>of knowing exactly.</em></h3>
      <div class="split-list">
        <div class="split-item good"><span class="split-icon">✓</span><span>One definitive guide. Curated by humans.</span></div>
        <div class="split-item good"><span class="split-icon">✓</span><span>Release order and story timeline separated</span></div>
        <div class="split-item good"><span class="split-icon">✓</span><span>Zero spoilers in every entry note</span></div>
        <div class="split-item good"><span class="split-icon">✓</span><span>Every entry labeled — Essential, Optional, Skip</span></div>
        <div class="split-item good"><span class="split-icon">✓</span><span>Know exactly what to skip and why</span></div>
        <div class="split-item good"><span class="split-icon">✓</span><span>Crystal clear. Instant decisions. No regrets.</span></div>
      </div>
    </div>
  </div>
</section>

<!-- Features -->
<section class="features-section" id="how">
  <div class="features-container">
    <div class="features-tabs">
      <div class="section-overtitle">
        <span class="overtitle-bar"></span>
        <span>What We Do</span>
      </div>
      <h2 class="section-title">Built for<br /><em>franchise fans.</em></h2>

      {#each features as f, i}
        <button class="feature-tab" class:active={activeFeature === i} onclick={() => activeFeature = i}>
          <span class="tab-number">{f.num}</span>
          <div class="tab-content">
            <span class="tab-title">{f.title}</span>
            <span class="tab-sub">{f.sub}</span>
          </div>
          <div class="tab-bar"></div>
        </button>
      {/each}
    </div>

    <div class="features-display">
      {#each features as f, i}
        <div class="feature-panel" class:active={activeFeature === i}>
          <div class="feature-image">
            <img src={f.img} alt={f.title} />
            <div class="feature-image-overlay"></div>
            <div class="feature-image-number">{f.num}</div>
          </div>
          <h3 class="feature-title">{f.title}</h3>
          <p class="feature-detail">{f.detail}</p>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- Guide -->
<section class="guide-section">
  <div class="guide-container">
    <div class="guide-left">
      <div class="section-overtitle">
        <span class="overtitle-bar"></span>
        <span>Live Example</span>
      </div>
      <h2 class="section-title">This is what<br /><em>clarity looks like.</em></h2>
      <p class="guide-desc">Every guide on WatchOrder looks like this. Two order options. Every entry labeled. Brief spoiler-free context. Nothing more, nothing less.</p>
      <div class="guide-toggles">
        <button class="toggle-btn" class:active={guideMode === 'release'} onclick={() => guideMode = 'release'}>Release Order</button>
        <button class="toggle-btn" class:active={guideMode === 'story'} onclick={() => guideMode = 'story'}>Story Timeline</button>
      </div>
      <a href="/franchise/marvel-cinematic-universe" class="btn-primary" style="margin-top: 32px; display: inline-flex;">
        <span>Open Full MCU Guide</span>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" stroke-width="1.4"/></svg>
      </a>
    </div>

    <div class="guide-panel">
      <div class="guide-header">
        <div class="guide-header-left">
          <img src="https://image.tmdb.org/t/p/w92/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg" alt="" class="guide-thumb" />
          <div>
            <div class="guide-title">Marvel Cinematic Universe</div>
            <div class="guide-meta">33 entries · Phase 1–5 · 2008–2024</div>
          </div>
        </div>
        <span class="label lbl-amber">ESSENTIAL</span>
      </div>

      <div class="guide-progress">
        <div class="progress-fill" style="width: 18%"></div>
        <span class="progress-label">Phase 1 of 5</span>
      </div>

      <div class="guide-entries">
        {#each guideEntries as entry}
          <div class="guide-entry">
            <div class="entry-left">
              <span class="entry-number">{entry.num}</span>
              <div class="entry-dot-wrapper">
                <div class="entry-dot lbl-amber"></div>
                {#if !entry.last}
                  <div class="entry-connector"></div>
                {/if}
              </div>
            </div>
            <div class="entry-content">
              <div class="entry-row">
                <span class="entry-title">{entry.title}</span>
                <span class="entry-year">{entry.year}</span>
                <span class="entry-time">{entry.time}</span>
              </div>
              <p class="entry-note">{entry.note}</p>
            </div>
            <span class="label {entry.label}">{entry.labelText}</span>
          </div>
        {/each}
      </div>

      <div class="guide-footer">
        <span>Showing 6 of 33 entries</span>
        <a href="/franchise/marvel-cinematic-universe">See all 33 →</a>
      </div>
    </div>
  </div>
</section>

<style>
  @import "tailwindcss";

  @theme {
    --color-wo-bg: #030303;
    --color-wo-bg-alt: #080808;
    --color-wo-panel: #0e0e0e;
    --color-wo-card: #111;
    --color-wo-surface: #141414;
    --color-wo-surface-2: #1a1a1a;

    --color-wo-text: #f0ece4;
    --color-wo-text-2: rgba(240, 236, 228, 0.65);
    --color-wo-text-3: rgba(240, 236, 228, 0.55);
    --color-wo-text-4: rgba(240, 236, 228, 0.28);
    --color-wo-text-5: rgba(240, 236, 228, 0.2);
    --color-wo-text-6: rgba(240, 236, 228, 0.1);

    --color-wo-gold: #c9a84c;
    --color-wo-gold-light: #e8c46a;
    --color-wo-green: #5fbf8c;
    --color-wo-red: #e74c3c;
    --color-wo-blue: #5dade2;

    --color-wo-border: rgba(255, 255, 255, 0.055);
    --color-wo-border-2: rgba(255, 255, 255, 0.1);
    --color-wo-border-3: rgba(255, 255, 255, 0.18);
  }

  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    background: #030303;
    color: #f0ece4;
    font-family: 'Sora', sans-serif;
    overflow-x: hidden;
    cursor: default;
  }

  /* ── Cursor ── */
  .custom-dot {
    position: fixed;
    z-index: 10000;
    pointer-events: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #c9a84c;
    transform: translate(-50%, -50%);
    transition: left 0.04s linear, top 0.04s linear, opacity 0.2s;
    box-shadow: 0 0 8px #c9a84c;
  }

  .custom-ring {
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    width: 28px;
    height: 28px;
    border: 1px solid rgba(201, 168, 76, 0.45);
    border-radius: 50%;
    transition: left 0.1s ease, top 0.1s ease, opacity 0.2s;
  }

  /* ── Grain ── */
  .grain {
    position: fixed;
    inset: 0;
    z-index: 9998;
    pointer-events: none;
    opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  /* ── Nav ── */
  .nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 500;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 0 48px;
    height: 64px;
    transition: all 0.6s ease;
    opacity: 0;
    transform: translateY(-100%);
    background: transparent;
  }

  .nav.nav-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .nav.nav-scrolled {
    background: rgba(3, 3, 3, 0.92);
    backdrop-filter: blur(24px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.055);
  }

  .nav-logo {
    display: flex;
    align-items: baseline;
    gap: 0;
    justify-self: start;
    text-decoration: none;
  }

  .nav-logo-mark {
    font-family: 'Cormorant Garamond', serif;
    font-size: 2rem;
    font-weight: 700;
    color: #c9a84c;
    line-height: 1;
  }

  .nav-logo-text {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.5rem;
    font-weight: 300;
    color: #f0ece4;
  }

  .nav-logo-accent {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.5rem;
    font-weight: 600;
    font-style: italic;
    color: #f0ece4;
  }

  .nav-logo-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #c9a84c;
    box-shadow: 0 0 8px #c9a84c;
    margin-left: 4px;
    margin-bottom: 2px;
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 36px;
    list-style: none;
    justify-self: center;
  }

  .nav-links a {
    font-family: 'Space Mono', monospace;
    font-size: 0.6rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(240, 236, 228, 0.28);
    text-decoration: none;
    transition: color 0.2s;
  }

  .nav-links a:hover {
    color: #c9a84c;
  }

  .nav-cta {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-self: end;
    font-family: 'Space Mono', monospace;
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #030303;
    background: #c9a84c;
    padding: 9px 20px;
    border-radius: 1px;
    text-decoration: none;
    transition: background 0.2s;
  }

  .nav-cta:hover {
    background: #e8c46a;
  }

  /* ── Hero ── */
  .hero {
    position: relative;
    min-height: 100vh;
    display: flex;
    align-items: flex-end;
    padding: 0 60px 80px;
    overflow: hidden;
    background: #030303;
  }

  .hero-bg-image {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 70%;
    background-image: url('https://image.tmdb.org/t/p/w1280/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg');
    background-size: cover;
    background-position: center right;
    mask-image: linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 30%, rgba(0,0,0,0) 100%);
    -webkit-mask-image: linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 30%, rgba(0,0,0,0) 100%);
    opacity: 0.4;
    z-index: 0;
  }

  .hero-bg-overlay {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 30% 50%, transparent 0%, #030303 90%);
    z-index: 1;
  }

  .hero-content {
    position: relative;
    z-index: 3;
    max-width: 820px;
  }

  .hero-title {
    margin-bottom: 36px;
  }

  .hero-title span {
    display: block;
    opacity: 0;
    transform: translateY(50px) skewY(1.5deg);
    transition: opacity 0.8s ease, transform 0.8s ease;
  }

  .hero-title span.hero-visible {
    opacity: 1;
    transform: translateY(0) skewY(0);
  }

  .hero-line-1,
  .hero-line-3,
  .hero-line-4 {
    font-family: 'Cormorant Garamond', serif;
    font-weight: 700;
    font-size: clamp(4.5rem, 11vw, 11.5rem);
    letter-spacing: -0.02em;
    color: #f0ece4;
    line-height: 0.9;
  }

  .hero-line-2,
  .hero-line-5 {
    font-family: 'Cormorant Garamond', serif;
    font-weight: 300;
    font-size: clamp(2.8rem, 6vw, 6.5rem);
    letter-spacing: -0.02em;
    padding-left: clamp(1.5rem, 5vw, 6rem);
    line-height: 0.9;
  }

  .hero-line-2 {
    color: rgba(240, 236, 228, 0.55);
  }

  .hero-line-4 {
    color: transparent;
    -webkit-text-stroke: 2px rgba(240, 236, 228, 0.18);
  }

  .hero-line-5 {
    color: #c9a84c;
  }

  .hero-subtitle {
    font-size: 0.98rem;
    line-height: 1.8;
    font-weight: 300;
    color: rgba(240, 236, 228, 0.55);
    max-width: 500px;
    margin-bottom: 40px;
    opacity: 0;
    transform: translateY(18px);
    transition: opacity 0.7s ease, transform 0.7s ease;
  }

  .hero-subtitle.hero-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .hero-actions {
    display: flex;
    align-items: center;
    gap: 24px;
    margin-bottom: 40px;
    opacity: 0;
    transform: translateY(18px);
    transition: opacity 0.7s ease, transform 0.7s ease;
    flex-wrap: wrap;
  }

  .hero-actions.hero-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .btn-primary {
    position: relative;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    gap: 0;
    background: #c9a84c;
    clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
    transition: background 0.25s, transform 0.25s;
    text-decoration: none;
    font-family: 'Sora', sans-serif;
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: #030303;
    padding: 15px 28px;
  }

  .btn-primary:hover {
    background: #e8c46a;
    transform: translateY(-2px);
  }

  .btn-primary span {
    position: relative;
    z-index: 1;
  }

  .btn-primary svg {
    margin-left: 12px;
    position: relative;
    z-index: 1;
  }

  .btn-ghost {
    font-family: 'Space Mono', monospace;
    font-size: 0.62rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(240, 236, 228, 0.28);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 2px;
    text-decoration: none;
    transition: color 0.2s, border-color 0.2s;
  }

  .btn-ghost:hover {
    color: #f0ece4;
    border-color: rgba(240, 236, 228, 0.28);
  }

  .hero-stats {
    display: flex;
    align-items: center;
    gap: 0;
    opacity: 0;
    transform: translateY(18px);
    transition: opacity 0.7s ease, transform 0.7s ease;
  }

  .hero-stats.hero-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .hero-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 14px 28px;
    border-right: 1px solid rgba(255, 255, 255, 0.055);
  }

  .hero-stat:first-child {
    border-left: 1px solid rgba(255, 255, 255, 0.055);
  }

  .stat-value {
    font-family: 'Cormorant Garamond', serif;
    font-size: 2rem;
    font-weight: 700;
    color: #f0ece4;
    line-height: 1;
    letter-spacing: -0.02em;
  }

  .stat-label {
    font-family: 'Space Mono', monospace;
    font-size: 0.52rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(240, 236, 228, 0.28);
    margin-top: 4px;
  }

  .hero-vertical-label {
    position: absolute;
    right: 52px;
    top: 50%;
    transform: translateY(-50%) rotate(90deg) translateX(-50%);
    transform-origin: center;
    font-family: 'Space Mono', monospace;
    font-size: 0.5rem;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: rgba(240, 236, 228, 0.1);
    white-space: nowrap;
    z-index: 3;
    opacity: 0;
    transition: opacity 0.8s ease;
  }

  .hero-vertical-label.hero-visible {
    opacity: 1;
  }

  .scroll-indicator {
    position: absolute;
    bottom: 32px;
    right: 52px;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    opacity: 0;
    transition: opacity 0.8s ease;
  }

  .scroll-indicator.hero-visible {
    opacity: 1;
  }

  .scroll-line {
    width: 1px;
    height: 48px;
    background: linear-gradient(to bottom, transparent, #c9a84c);
    animation: scrollDrop 2s ease-in-out infinite;
  }

  @keyframes scrollDrop {
    0%, 100% { transform: scaleY(0); transform-origin: top; }
    50% { transform: scaleY(1); transform-origin: top; }
  }

  .scroll-indicator span {
    font-family: 'Space Mono', monospace;
    font-size: 0.48rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(240, 236, 228, 0.1);
    writing-mode: vertical-lr;
  }

  /* ── Ticker ── */
  .ticker {
    overflow: hidden;
    background: #c9a84c;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding: 11px 0;
  }

  .ticker-track {
    display: flex;
    width: max-content;
    animation: tickerMove 40s linear infinite;
  }

  @keyframes tickerMove {
    from { transform: translateX(0); }
    to { transform: translateX(-33.333%); }
  }

  .ticker-item {
    font-family: 'Space Mono', monospace;
    font-size: 0.72rem;
    letter-spacing: 0.2em;
    color: rgba(3, 3, 3, 0.85);
    padding: 0 28px;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 28px;
  }

  .ticker-sep {
    font-size: 0.45rem;
    opacity: 0.6;
  }

  /* ── Franchises ── */
  .franchises-section {
    padding: 100px 60px;
    background: #080808;
    border-top: 1px solid rgba(255, 255, 255, 0.055);
  }

  .section-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 60px;
    gap: 24px;
    max-width: 1280px;
    margin-left: auto;
    margin-right: auto;
  }

  .section-overtitle {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: 'Space Mono', monospace;
    font-size: 0.6rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #c9a84c;
    margin-bottom: 20px;
  }

  .overtitle-bar {
    width: 22px;
    height: 1px;
    background: #c9a84c;
  }

  .section-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(2.4rem, 4vw, 3.8rem);
    font-weight: 300;
    line-height: 1.08;
    letter-spacing: -0.03em;
    color: #f0ece4;
  }

  .section-title em {
    font-style: italic;
    color: #c9a84c;
    font-weight: 300;
  }

  .view-all-link {
    font-family: 'Space Mono', monospace;
    font-size: 0.58rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(240, 236, 228, 0.28);
    border-bottom: 1px solid rgba(255, 255, 255, 0.055);
    padding-bottom: 2px;
    text-decoration: none;
    transition: color 0.2s, border-color 0.2s;
    white-space: nowrap;
  }

  .view-all-link:hover {
    color: #c9a84c;
    border-color: rgba(201, 168, 76, 0.4);
  }

  .franchise-list {
    max-width: 1280px;
    margin: 0 auto;
  }

  .franchise-row {
    position: relative;
    overflow: hidden;
    display: grid;
    grid-template-columns: 120px 1fr auto 180px 60px;
    align-items: center;
    gap: 20px;
    padding: 24px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.055);
    text-decoration: none;
    transition: padding-left 0.35s ease;
    cursor: none;
  }

  .franchise-row:first-child {
    border-top: 1px solid rgba(255, 255, 255, 0.055);
  }

  .franchise-row:hover {
    padding-left: 8px;
  }

  .franchise-bg {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    transition: opacity 0.4s ease;
    filter: saturate(0.2) brightness(0.18);
  }

  .franchise-bg-mask {
    position: absolute;
    inset: 0;
    background: linear-gradient(to right, #080808 0%, transparent 50%);
    transition: opacity 0.4s ease;
  }

  .franchise-active-bar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    transform: scaleY(0);
    transform-origin: bottom;
    transition: transform 0.3s ease;
  }

  .franchise-row:hover .franchise-active-bar {
    transform: scaleY(1);
  }

  .franchise-left {
    display: flex;
    align-items: center;
    gap: 16px;
    position: relative;
    z-index: 1;
  }

  .franchise-idx {
    font-family: 'Space Mono', monospace;
    font-size: 0.58rem;
    color: rgba(240, 236, 228, 0.1);
    letter-spacing: 0.1em;
    width: 24px;
  }

  .franchise-type {
    font-family: 'Space Mono', monospace;
    font-size: 0.5rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(240, 236, 228, 0.28);
  }

  .franchise-years {
    font-family: 'Space Mono', monospace;
    font-size: 0.5rem;
    color: rgba(240, 236, 228, 0.1);
  }

  .franchise-center {
    position: relative;
    z-index: 1;
  }

  .franchise-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1.4rem, 2.5vw, 2rem);
    font-weight: 400;
    letter-spacing: -0.01em;
    transition: color 0.3s;
    line-height: 1;
    display: block;
  }

  .franchise-row:hover .franchise-title {
    color: #c9a84c;
  }

  .franchise-desc {
    font-family: 'Sora', sans-serif;
    font-size: 0.78rem;
    font-weight: 300;
    color: rgba(240, 236, 228, 0.55);
    line-height: 1.5;
    transition: opacity 0.3s;
    max-width: 500px;
    margin-top: 4px;
  }

  .franchise-row:hover .franchise-desc {
    opacity: 1;
  }

  .franchise-right {
    display: flex;
    align-items: center;
    gap: 16px;
    position: relative;
    z-index: 1;
    justify-content: flex-end;
  }

  .franchise-entries {
    font-family: 'Space Mono', monospace;
    font-size: 0.56rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    transition: color 0.3s;
  }

  .franchise-arrow {
    color: #c9a84c;
    transition: opacity 0.3s, transform 0.3s;
  }

  .franchise-thumb {
    position: absolute;
    right: 64px;
    top: 50%;
    transform: translateY(-50%);
    width: 52px;
    height: 78px;
    border-radius: 3px;
    overflow: hidden;
    transition: opacity 0.3s, transform 0.3s;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
        z-index: 2;
  }

  .franchise-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: saturate(0.7);
  }

  /* ── Labels ── */
  .label {
    font-family: 'Space Mono', monospace;
    font-size: 0.5rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    border: 1px solid;
    border-radius: 1px;
    padding: 3px 8px;
    white-space: nowrap;
  }

  .lbl-amber { color: #c9a84c; border-color: rgba(201, 168, 76, 0.35); background: rgba(201, 168, 76, 0.08); }
  .lbl-blue { color: #5dade2; border-color: rgba(93, 173, 226, 0.35); background: rgba(93, 173, 226, 0.08); }
  .lbl-green { color: #5fbf8c; border-color: rgba(95, 191, 140, 0.35); background: rgba(95, 191, 140, 0.08); }
  .lbl-red { color: #e74c3c; border-color: rgba(231, 76, 60, 0.35); background: rgba(231, 76, 60, 0.08); }

  /* ── Split Section ── */
  .split-section {
    padding: 100px 60px;
    background: #030303;
    border-top: 1px solid rgba(255, 255, 255, 0.055);
  }

  .split-container {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 0;
    max-width: 1200px;
    margin: 0 auto;
    align-items: start;
  }

  .split-side {
    padding: 0 60px;
  }

  .split-badge {
    font-family: 'Space Mono', monospace;
    font-size: 0.56rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    padding: 6px 14px;
    border-radius: 1px;
    display: inline-block;
    margin-bottom: 28px;
  }

  .split-badge.bad { color: #e74c3c; border: 1px solid rgba(231, 76, 60, 0.3); background: rgba(231, 76, 60, 0.08); }
  .split-badge.good { color: #5fbf8c; border: 1px solid rgba(95, 191, 140, 0.3); background: rgba(95, 191, 140, 0.08); }

  .split-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1.8rem, 3vw, 2.8rem);
    font-weight: 300;
    line-height: 1.15;
    letter-spacing: -0.02em;
    color: #f0ece4;
    margin-bottom: 36px;
  }

  .split-title em {
    font-style: italic;
    color: #c9a84c;
  }

  .split-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .split-item {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    font-family: 'Sora', sans-serif;
    font-size: 0.85rem;
    font-weight: 300;
    line-height: 1.5;
    padding: 14px 16px;
    border: 1px solid rgba(255, 255, 255, 0.055);
    border-radius: 1px;
    transition: border-color 0.2s, background 0.2s;
  }

  .split-item.bad { color: rgba(240, 236, 228, 0.55); }
  .split-item.bad:hover { border-color: rgba(231, 76, 60, 0.2); background: rgba(231, 76, 60, 0.04); }
  .split-item.good { color: rgba(240, 236, 228, 0.55); }
  .split-item.good:hover { border-color: rgba(95, 191, 140, 0.2); background: rgba(95, 191, 140, 0.04); }

  .split-icon {
    font-size: 0.9rem;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .split-item.bad .split-icon { color: #e74c3c; }
  .split-item.good .split-icon { color: #5fbf8c; }

  .split-divider {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    padding: 60px 0;
  }

  .divider-line {
    flex: 1;
    width: 1px;
    background: rgba(255, 255, 255, 0.055);
  }

  .divider-circle {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Space Mono', monospace;
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    color: rgba(240, 236, 228, 0.28);
    background: #0e0e0e;
    margin: 20px 0;
  }

  /* ── Features Section ── */
  .features-section {
    padding: 100px 60px;
    background: #080808;
    border-top: 1px solid rgba(255, 255, 255, 0.055);
  }

  .features-container {
    display: grid;
    grid-template-columns: 380px 1fr;
    gap: 80px;
    align-items: start;
    max-width: 1200px;
    margin: 0 auto;
  }

  .feature-tab {
    display: grid;
    grid-template-columns: 52px 1fr 4px;
    align-items: start;
    gap: 16px;
    padding: 22px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.055);
    cursor: none;
    text-align: left;
    transition: background 0.2s;
    width: 100%;
    background: transparent;
    border: none;
    color: inherit;
  }

  .feature-tab:hover {
    background: #0e0e0e;
    padding-left: 8px;
    padding-right: 8px;
  }

  .feature-tab.active {
    background: #0e0e0e;
    padding-left: 8px;
    padding-right: 8px;
  }

  .tab-number {
    font-family: 'Space Mono', monospace;
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    color: rgba(240, 236, 228, 0.1);
    padding-top: 4px;
  }

  .tab-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .tab-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.2rem;
    font-weight: 600;
    color: #f0ece4;
    letter-spacing: -0.01em;
    line-height: 1.2;
  }

  .feature-tab:not(.active) .tab-title {
    color: rgba(240, 236, 228, 0.55);
  }

  .tab-sub {
    font-family: 'Sora', sans-serif;
    font-size: 0.74rem;
    font-weight: 300;
    color: rgba(240, 236, 228, 0.28);
    line-height: 1.5;
  }

  .tab-bar {
    width: 3px;
    align-self: stretch;
    background: #c9a84c;
    border-radius: 2px;
    opacity: 0;
    transition: opacity 0.3s;
  }

  .feature-tab.active .tab-bar {
    opacity: 1;
  }

  .features-display {
    position: relative;
    min-height: 500px;
  }

  .feature-panel {
    position: absolute;
    inset: 0;
    opacity: 0;
    transform: translateX(24px);
    transition: opacity 0.5s ease, transform 0.5s ease;
    pointer-events: none;
  }

  .feature-panel.active {
    opacity: 1;
    transform: translateX(0);
    pointer-events: auto;
  }

  .feature-image {
    position: relative;
    border-radius: 3px;
    overflow: hidden;
    height: 320px;
    margin-bottom: 28px;
  }

  .feature-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: saturate(0.5) brightness(0.45);
  }

  .feature-image-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, #080808 0%, transparent 50%);
  }

  .feature-image-number {
    position: absolute;
    right: 20px;
    bottom: 16px;
    font-family: 'Cormorant Garamond', serif;
    font-size: 5rem;
    font-weight: 700;
    line-height: 1;
    color: transparent;
    -webkit-text-stroke: 1px rgba(201, 168, 76, 0.2);
    letter-spacing: -0.02em;
  }

  .feature-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 2rem;
    font-weight: 600;
    color: #f0ece4;
    margin-bottom: 12px;
    letter-spacing: -0.02em;
  }

  .feature-detail {
    font-family: 'Sora', sans-serif;
    font-size: 0.88rem;
    font-weight: 300;
    line-height: 1.8;
    color: rgba(240, 236, 228, 0.55);
  }

  /* ── Guide Section ── */
  .guide-section {
    padding: 100px 60px;
    background: #080808;
    border-top: 1px solid rgba(255, 255, 255, 0.055);
  }

  .guide-container {
    display: grid;
    grid-template-columns: 380px 1fr;
    gap: 80px;
    align-items: start;
    max-width: 1200px;
    margin: 0 auto;
  }

  .guide-left {
    position: sticky;
    top: 100px;
  }

  .guide-desc {
    font-family: 'Sora', sans-serif;
    font-size: 0.92rem;
    line-height: 1.8;
    font-weight: 300;
    color: rgba(240, 236, 228, 0.55);
    margin-top: 20px;
  }

  .guide-toggles {
    display: flex;
    gap: 8px;
    margin-top: 32px;
  }

  .toggle-btn {
    font-family: 'Space Mono', monospace;
    font-size: 0.56rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 9px 18px;
    border: 1px solid rgba(255, 255, 255, 0.055);
    border-radius: 1px;
    color: rgba(240, 236, 228, 0.28);
    background: transparent;
    transition: all 0.2s;
    cursor: none;
  }

  .toggle-btn.active {
    background: rgba(201, 168, 76, 0.14);
    color: #c9a84c;
    border-color: rgba(201, 168, 76, 0.35);
  }

  .guide-panel {
    background: #0e0e0e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .guide-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 28px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.055);
    background: #141414;
  }

  .guide-header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .guide-thumb {
    width: 40px;
    height: 60px;
    object-fit: cover;
    border-radius: 2px;
    filter: saturate(0.7);
  }

  .guide-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.15rem;
    font-weight: 600;
    color: #f0ece4;
    letter-spacing: -0.01em;
  }

  .guide-meta {
    font-family: 'Space Mono', monospace;
    font-size: 0.52rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(240, 236, 228, 0.28);
    margin-top: 4px;
  }

  .guide-progress {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 28px;
    background: #1a1a1a;
    border-bottom: 1px solid rgba(255, 255, 255, 0.055);
  }

  .progress-fill {
    height: 2px;
    background: #c9a84c;
    border-radius: 1px;
  }

  .progress-label {
    font-family: 'Space Mono', monospace;
    font-size: 0.5rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(240, 236, 228, 0.1);
  }

  .guide-entries {
    padding: 0;
  }

  .guide-entry {
    display: grid;
    grid-template-columns: 60px 1fr auto;
    align-items: start;
    gap: 16px;
    padding: 18px 28px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.055);
    transition: background 0.15s;
  }

  .guide-entry:hover {
    background: #141414;
  }

  .entry-left {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .entry-number {
    font-family: 'Space Mono', monospace;
    font-size: 0.54rem;
    color: rgba(240, 236, 228, 0.1);
    padding-top: 3px;
  }

  .entry-dot-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
  }

  .entry-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1px solid;
  }

  .entry-dot.lbl-amber { background: rgba(201, 168, 76, 0.3); border-color: #c9a84c; }

  .entry-connector {
    width: 1px;
    height: 32px;
    background: rgba(255, 255, 255, 0.055);
    margin-top: 4px;
  }

  .entry-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 5px;
    flex-wrap: wrap;
  }

  .entry-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.1rem;
    font-weight: 600;
    color: #f0ece4;
    letter-spacing: -0.01em;
  }

  .entry-year, .entry-time {
    font-family: 'Space Mono', monospace;
    font-size: 0.52rem;
    color: rgba(240, 236, 228, 0.1);
  }

  .entry-note {
    font-family: 'Sora', sans-serif;
    font-size: 0.78rem;
    font-weight: 300;
    color: rgba(240, 236, 228, 0.55);
    line-height: 1.55;
  }

  .guide-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 28px;
    border-top: 1px solid rgba(255, 255, 255, 0.055);
  }

  .guide-footer span {
    font-family: 'Space Mono', monospace;
    font-size: 0.52rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(240, 236, 228, 0.1);
  }

  .guide-footer a {
    font-family: 'Space Mono', monospace;
    font-size: 0.52rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #c9a84c;
    text-decoration: none;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .guide-footer a:hover {
    opacity: 1;
  }

  /* ── Responsive ── */
  @media (max-width: 1200px) {
    .features-container, .guide-container {
      grid-template-columns: 1fr;
    }
    .guide-left {
      position: static;
    }
    .split-container {
      grid-template-columns: 1fr;
    }
    .split-divider {
      flex-direction: row;
      padding: 24px 0;
    }
    .divider-line {
      height: 1px;
      flex: 1;
    }
    .divider-circle {
      margin: 0 16px;
    }
  }

  @media (max-width: 768px) {
    .franchises-section, .split-section, .features-section, .guide-section {
      padding-left: 24px;
      padding-right: 24px;
    }
    .franchise-row {
      grid-template-columns: 40px 1fr auto;
    }
    .franchise-type, .franchise-years, .franchise-entries {
      display: none;
    }
    .franchise-thumb {
      display: none;
    }
    .guide-entry {
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .entry-left {
      display: none;
    }
  }
</style>