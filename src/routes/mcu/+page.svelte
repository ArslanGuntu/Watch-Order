<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
  <title>MCU Guide · Marvel Cinematic Universe Watch Order</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600;1,700&family=Space+Mono:wght@400;700&family=Sora:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: #050505;
      color: #f0ece4;
      font-family: 'Sora', sans-serif;
      overflow-x: hidden;
    }

    .grain {
      position: fixed; inset: 0; z-index: 999;
      pointer-events: none; opacity: 0.04;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    }

    /* Custom Cursor */
    .custom-dot {
      position: fixed;
      width: 6px;
      height: 6px;
      background: #c9a84c;
      border-radius: 50%;
      pointer-events: none;
      z-index: 10000;
      transform: translate(-50%, -50%);
      transition: left 0.04s linear, top 0.04s linear;
      box-shadow: 0 0 8px #c9a84c;
    }

    .custom-ring {
      position: fixed;
      width: 28px;
      height: 28px;
      border: 1px solid rgba(201,168,76,0.45);
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      transform: translate(-50%, -50%);
      transition: left 0.1s ease, top 0.1s ease;
    }

    .nav {
      position: fixed; top: 0; width: 100%;
      padding: 20px 50px;
      display: flex; justify-content: space-between; align-items: center;
      z-index: 100; transition: 0.4s ease; box-sizing: border-box;
      background: rgba(5,5,5,0.92);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .nav-logo { display: flex; align-items: baseline; cursor: pointer; gap: 0; text-decoration: none; }
    .nav-logo-mark { font-family: 'Cormorant Garamond'; font-size: 2.2rem; color: #c9a84c; font-weight: 700; line-height: 1; }
    .nav-logo-text { font-family: 'Cormorant Garamond'; font-size: 1.6rem; font-weight: 300; color: #f0ece4; }
    .nav-logo-accent { font-family: 'Cormorant Garamond'; font-style: italic; font-size: 1.6rem; font-weight: 600; opacity: 0.85; color: #f0ece4; }
    .nav-logo-dot { width: 5px; height: 5px; background: #c9a84c; border-radius: 50%; margin-left: 5px; box-shadow: 0 0 8px #c9a84c; }

    .back-button {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(20,20,20,0.8);
      border: 1px solid rgba(201,168,76,0.3);
      border-radius: 40px;
      padding: 8px 20px;
      font-family: 'Space Mono';
      font-size: 0.7rem;
      color: #c9a84c;
      cursor: pointer;
      transition: 0.25s;
      text-decoration: none;
      margin-bottom: 20px;
    }
    .back-button:hover {
      border-color: #c9a84c;
      background: rgba(30,30,30,0.9);
    }

    .guide-container { padding-top: 80px; }
    .guide-hero {
      height: 65vh;
      background-size: cover;
      background-position: center 30%;
      position: relative;
      display: flex;
      align-items: flex-end;
    }
    .guide-hero-overlay {
      position: absolute; inset: 0;
      background: linear-gradient(to bottom, rgba(5,5,5,0.15) 0%, rgba(5,5,5,0.65) 55%, rgba(5,5,5,1) 100%);
    }
    .guide-hero-content {
      position: relative; z-index: 2;
      padding: 0 70px 64px;
      max-width: 900px;
    }
    .guide-title {
      font-family: 'Cormorant Garamond';
      font-size: clamp(3rem, 6vw, 5rem);
      font-weight: 700;
      line-height: 1.0;
      margin: 16px 0 20px;
    }
    .guide-meta-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
    .guide-pill {
      font-family: 'Space Mono';
      font-size: 0.6rem;
      letter-spacing: 0.12em;
      border: 1px solid rgba(255,255,255,0.18);
      padding: 5px 12px;
      border-radius: 2px;
      color: rgba(240,236,228,0.65);
    }
    .guide-desc { font-size: 0.95rem; opacity: 0.5; line-height: 1.7; max-width: 680px; }

    .tab-bar {
      display: flex;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      padding: 0 70px;
      position: sticky;
      top: 64px;
      background: rgba(5,5,5,0.96);
      backdrop-filter: blur(12px);
      z-index: 50;
    }
    .tab-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      background: none;
      border: none;
      color: rgba(240,236,228,0.35);
      font-family: 'Space Mono';
      font-size: 0.68rem;
      letter-spacing: 0.12em;
      padding: 20px 24px;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: 0.22s;
    }
    .tab-btn:hover { color: rgba(240,236,228,0.6); }
    .tab-active { color: #c9a84c !important; border-bottom-color: #c9a84c !important; }

    .timeline-section, .history-section, .ratings-section { padding: 70px 70px 120px; }
    .timeline-intro { margin-bottom: 56px; }
    .overtitle {
      display: flex; align-items: center; gap: 14px;
      font-family: 'Space Mono';
      font-size: 0.68rem;
      letter-spacing: 0.2em;
      color: #c9a84c;
      margin-bottom: 20px;
    }
    .overtitle .bar { width: 36px; height: 1px; background: #c9a84c; }

    .timeline-track { position: relative; }
    .timeline-spine {
      position: absolute;
      left: 50%;
      top: 0;
      bottom: 0;
      width: 1px;
      background: linear-gradient(to bottom, transparent, rgba(201,168,76,0.35), rgba(201,168,76,0.12), transparent);
      transform: translateX(-50%);
    }
    .timeline-item {
      display: grid;
      grid-template-columns: 1fr 64px 1fr;
      align-items: start;
      margin-bottom: 56px;
    }
    .timeline-dot { grid-column: 2; display: flex; justify-content: center; padding-top: 24px; }
    .dot-num {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 1px solid rgba(201,168,76,0.4);
      background: #0a0a0a;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Space Mono';
      font-size: 0.65rem;
      color: #c9a84c;
    }
    .tl-card {
      background: #0d0d0d;
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 2px;
      overflow: hidden;
      transition: 0.3s;
    }
    .tl-card:hover { border-color: rgba(201,168,76,0.25); }
    .timeline-item .tl-card { grid-column: 1; margin-right: 28px; }
    .timeline-item-right .tl-card { grid-column: 3; margin-left: 28px; margin-right: 0; }
    .tl-card-poster {
      aspect-ratio: 2/3;
      max-height: 220px;
      overflow: hidden;
      background: #111;
    }
    .tl-card-poster img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .tl-card-body { padding: 20px 22px; }
    .tl-card-year { font-family: 'Space Mono'; font-size: 0.58rem; color: #c9a84c; }
    .tl-card-title { font-family: 'Cormorant Garamond'; font-size: 1.25rem; font-weight: 600; margin: 8px 0; }
    .tl-card-details {
      display: flex;
      gap: 14px;
      font-size: 0.62rem;
      color: rgba(240,236,228,0.45);
      margin-bottom: 8px;
    }
    .tl-card-overview { opacity: 0.5; font-size: 0.78rem; line-height: 1.55; }

    .timeline-end {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 40px 0;
      color: rgba(201,168,76,0.5);
      font-family: 'Space Mono';
      font-size: 0.65rem;
      letter-spacing: 0.14em;
    }
    .end-circle {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 1px solid rgba(201,168,76,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
    }

    /* Trailer Button */
    .trailer-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(201,168,76,0.1);
      border: 1px solid rgba(201,168,76,0.3);
      border-radius: 20px;
      padding: 4px 12px;
      font-family: 'Space Mono';
      font-size: 0.6rem;
      color: #c9a84c;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
      margin-left: 12px;
    }
    .trailer-btn:hover {
      background: rgba(201,168,76,0.2);
      border-color: #c9a84c;
      transform: scale(1.02);
    }
    .trailer-btn svg {
      width: 12px;
      height: 12px;
    }

    /* Essential Badge */
    .essential-badge {
      display: inline-block;
      background: rgba(201,168,76,0.15);
      border: 1px solid rgba(201,168,76,0.3);
      color: #c9a84c;
      font-family: 'Space Mono';
      font-size: 0.55rem;
      padding: 2px 8px;
      border-radius: 4px;
      margin-left: 12px;
    }
    .optional-badge {
      display: inline-block;
      background: rgba(93,173,226,0.1);
      border: 1px solid rgba(93,173,226,0.2);
      color: #5dade2;
      font-family: 'Space Mono';
      font-size: 0.55rem;
      padding: 2px 8px;
      border-radius: 4px;
      margin-left: 12px;
    }

    /* Rating Stars */
    .rating-stars {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      margin-left: 12px;
    }
    .rating-stars svg {
      width: 12px;
      height: 12px;
    }
    .star-filled { fill: #c9a84c; }
    .star-half { fill: #c9a84c; opacity: 0.5; }
    .star-empty { fill: rgba(255,255,255,0.1); }

    @media (max-width: 768px) {
      .nav { padding: 14px 20px; }
      .guide-hero-content { padding: 0 24px 40px; }
      .tab-bar { padding: 0 20px; top: 60px; flex-wrap: wrap; }
      .tab-btn { padding: 16px 12px; font-size: 0.6rem; }
      .timeline-section, .history-section { padding: 40px 20px 80px; }
      .trailer-btn { padding: 2px 8px; font-size: 0.5rem; margin-left: 6px; }
      .essential-badge, .optional-badge { font-size: 0.45rem; padding: 1px 5px; margin-left: 6px; }
    }
  </style>
</head>
<body>
<div class="grain"></div>
<div class="custom-dot" id="cursorDot"></div>
<div class="custom-ring" id="cursorRing"></div>

<nav class="nav">
  <a href="#" class="nav-logo" id="logoHome">
    <span class="nav-logo-mark">W</span>
    <span class="nav-logo-text">atch</span>
    <span class="nav-logo-accent">Order</span>
    <div class="nav-logo-dot"></div>
  </a>
</nav>

<main id="appRoot"></main>

<script>
(function () {
  // COMPLETE MCU Movie Data - The Infinity Saga (2008-2019) - 23 Films through Far From Home
  const mcuMovies = [
    { order: 1, year: 2008, title: 'Iron Man', rating: 7.9, runtime: '2h 6m', director: 'Jon Favreau', essential: true, poster: 'https://image.tmdb.org/t/p/w300/78lPtwv72eTNqFW9COBYI0dWDJa.jpg', trailerKey: '8hYlB38asDY', overview: 'Billionaire industrialist Tony Stark builds a high-tech suit of armor after being held captive. He becomes Iron Man, a superhero dedicated to protecting the world.' },
    { order: 2, year: 2008, title: 'The Incredible Hulk', rating: 6.6, runtime: '1h 52m', director: 'Louis Leterrier', essential: false, poster: 'https://image.tmdb.org/t/p/w300/gKddJUyiP1Xl5VtTTbRrNNSDHdP.jpg', trailerKey: 'xbqNb2PFWKA', overview: 'Bruce Banner, a scientist on the run from the U.S. government, must find a cure for the monster he turns into whenever he loses his temper.' },
    { order: 3, year: 2010, title: 'Iron Man 2', rating: 6.9, runtime: '2h 4m', director: 'Jon Favreau', essential: true, poster: 'https://image.tmdb.org/t/p/w300/6WBeq4fCfn7AN0o21W9qNcRF2l9.jpg', trailerKey: 'wKtcmiBc4jY', overview: 'Tony Stark faces pressure from the government, a rival inventor, and his own declining health as he continues his superhero journey.' },
    { order: 4, year: 2011, title: 'Thor', rating: 7.0, runtime: '1h 55m', director: 'Kenneth Branagh', essential: true, poster: 'https://image.tmdb.org/t/p/w300/prSfAi1xGrhLQNxrSUGqXoZUb4M.jpg', trailerKey: 'JOddpNl4F1E', overview: 'The powerful but arrogant god Thor is cast out of Asgard to live amongst humans in Midgard (Earth), where he soon becomes one of their finest defenders.' },
    { order: 5, year: 2011, title: 'Captain America: The First Avenger', rating: 6.9, runtime: '2h 4m', director: 'Joe Johnston', essential: true, poster: 'https://image.tmdb.org/t/p/w300/vSNxAJTlD0r7wdj61aYaWPqLb7K.jpg', trailerKey: 'JerVrbLldXw', overview: 'Steve Rogers, a rejected military soldier, transforms into Captain America after taking a dose of a "Super-Soldier serum". But being Captain America comes at a price.' },
    { order: 6, year: 2012, title: 'The Avengers', rating: 8.0, runtime: '2h 23m', director: 'Joss Whedon', essential: true, poster: 'https://image.tmdb.org/t/p/w300/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg', trailerKey: 'eOrNdBpGMv8', overview: "Earth's mightiest heroes must come together and learn to fight as a team if they are going to stop the mischievous Loki and his alien army." },
    { order: 7, year: 2013, title: 'Iron Man 3', rating: 7.1, runtime: '2h 10m', director: 'Shane Black', essential: true, poster: 'https://image.tmdb.org/t/p/w300/qhPtAc1TKbMPqNvcdXSOn9Bn7hZ.jpg', trailerKey: 'Ke1Y3P9D0Bc', overview: 'Tony Stark faces a nemesis called the Mandarin and battles his own demons after his world is torn apart by a terrorist attack.' },
    { order: 8, year: 2013, title: 'Thor: The Dark World', rating: 6.8, runtime: '1h 52m', director: 'Alan Taylor', essential: false, poster: 'https://image.tmdb.org/t/p/w300/wp6OxE4poJ4G7c0U2ZqasuiUVcw.jpg', trailerKey: 'npvJ9FTgZbM', overview: 'Thor must team up with his treacherous brother Loki to save Asgard and the universe from the Dark Elves.' },
    { order: 9, year: 2014, title: 'Captain America: The Winter Soldier', rating: 7.7, runtime: '2h 16m', director: 'Anthony & Joe Russo', essential: true, poster: 'https://image.tmdb.org/t/p/w300/tVFRpFw3xTedgPGqxW0AOI8Qhh0.jpg', trailerKey: 'tbayiPxkUzQ', overview: 'Captain America struggles to expose a growing conspiracy within S.H.I.E.L.D. while fighting a mysterious assassin known as the Winter Soldier.' },
    { order: 10, year: 2014, title: 'Guardians of the Galaxy', rating: 8.0, runtime: '2h 1m', director: 'James Gunn', essential: true, poster: 'https://image.tmdb.org/t/p/w300/r7vmZjiyZw9rpJMQJdXpjgiCOk9.jpg', trailerKey: 'd96cjJhvlMA', overview: 'A group of intergalactic criminals must pull together to stop a fanatical warrior from taking control of the universe.' },
    { order: 11, year: 2015, title: 'Avengers: Age of Ultron', rating: 7.3, runtime: '2h 21m', director: 'Joss Whedon', essential: true, poster: 'https://image.tmdb.org/t/p/w300/4ssDuvEDkSArWEdyBl2X5EHvYKU.jpg', trailerKey: 'tmeOjFno6Do', overview: 'The Avengers must assemble once more to defeat the robotic villain Ultron, who is determined to wipe out humanity.' },
    { order: 12, year: 2015, title: 'Ant-Man', rating: 7.3, runtime: '1h 57m', director: 'Peyton Reed', essential: true, poster: 'https://image.tmdb.org/t/p/w300/rQRnQfUl3kfp78nCWq8Ks04vnq1.jpg', trailerKey: 'pWdKf3MneyI', overview: 'A con man armed with a suit that allows him to shrink in size must pull off a heist to save the world.' },
    { order: 13, year: 2016, title: 'Captain America: Civil War', rating: 7.8, runtime: '2h 27m', director: 'Anthony & Joe Russo', essential: true, poster: 'https://image.tmdb.org/t/p/w300/rAGiXaUfPzY7CDEyNKUofk3H4gV.jpg', trailerKey: 'dKrVegVI0Us', overview: 'Political pressure mounts to install a system of accountability for the Avengers, causing a rift between the team members.' },
    { order: 14, year: 2016, title: 'Doctor Strange', rating: 7.5, runtime: '1h 55m', director: 'Scott Derrickson', essential: true, poster: 'https://image.tmdb.org/t/p/w300/uGBVj3bEbCoZbDjjl9wTxcygko1.jpg', trailerKey: 'Lt-U_t2pUHI', overview: 'While on a journey of physical and spiritual healing, a brilliant neurosurgeon is drawn into the world of the mystic arts.' },
    { order: 15, year: 2017, title: 'Guardians of the Galaxy Vol. 2', rating: 7.6, runtime: '2h 16m', director: 'James Gunn', essential: true, poster: 'https://image.tmdb.org/t/p/w300/y4MBh0EjBlMuOzv9axM4qJlmhzz.jpg', trailerKey: 'wUn05hdkhjM', overview: 'The Guardians must fight to keep their newfound family together as they unravel the mystery of Peter Quill\'s true parentage.' },
    { order: 16, year: 2017, title: 'Spider-Man: Homecoming', rating: 7.4, runtime: '2h 13m', director: 'Jon Watts', essential: true, poster: 'https://image.tmdb.org/t/p/w300/c24sv2weTHPsmDa7jEMN0m2P3RT.jpg', trailerKey: 'rk-dF1lIbIg', overview: 'Peter Parker balances his life as an ordinary high school student in Queens with his superhero alter-ego Spider-Man, and finds himself on the trail of a new menace prowling the skies of New York City.' },
    { order: 17, year: 2017, title: 'Thor: Ragnarok', rating: 7.9, runtime: '2h 10m', director: 'Taika Waititi', essential: true, poster: 'https://image.tmdb.org/t/p/w300/rzRwTcFvttcN1ZpX2xv4j3tSdJu.jpg', trailerKey: 'ue80QwXMRHg', overview: 'Thor is imprisoned on the planet Sakaar, and must race against time to return to Asgard and stop Ragnarök, the destruction of his world, at the hands of the powerful and ruthless villain Hela.' },
    { order: 18, year: 2018, title: 'Black Panther', rating: 7.3, runtime: '2h 14m', director: 'Ryan Coogler', essential: true, poster: 'https://image.tmdb.org/t/p/w300/uxzzxijgPIY7slzFvMotPv8wjKA.jpg', trailerKey: 'xjDjIWPwcPU', overview: 'T\'Challa, heir to the hidden but advanced kingdom of Wakanda, must step forward to lead his people into a new future and must confront a challenger from his country\'s past.' },
    { order: 19, year: 2018, title: 'Avengers: Infinity War', rating: 8.4, runtime: '2h 29m', director: 'Anthony & Joe Russo', essential: true, poster: 'https://image.tmdb.org/t/p/w300/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg', trailerKey: '6ZfuNTqbHE8', overview: 'The Avengers and their allies must be willing to sacrifice all in an attempt to defeat the powerful Thanos before his blitz of devastation and ruin puts an end to the universe.' },
    { order: 20, year: 2018, title: 'Ant-Man and the Wasp', rating: 7.0, runtime: '1h 58m', director: 'Peyton Reed', essential: true, poster: 'https://image.tmdb.org/t/p/w300/cFQB7QW8r5w9NZ9V8vXqGKDIrwd.jpg', trailerKey: 'UUkn-enk2RU', overview: 'As Scott Lang balances being both a superhero and a father, Hope van Dyne and Dr. Hank Pym present an urgent new mission that finds the Ant-Man fighting alongside The Wasp to uncover secrets from their past.' },
    { order: 21, year: 2019, title: 'Captain Marvel', rating: 6.8, runtime: '2h 3m', director: 'Anna Boden & Ryan Fleck', essential: true, poster: 'https://image.tmdb.org/t/p/w300/AtsgWhDnHTq68L0lLsUrCnM7TjG.jpg', trailerKey: 'Z1BCujX3pw8', overview: 'Carol Danvers becomes one of the universe\'s most powerful heroes when Earth is caught in the middle of a galactic war between two alien races.' },
    { order: 22, year: 2019, title: 'Avengers: Endgame', rating: 8.4, runtime: '3h 1m', director: 'Anthony & Joe Russo', essential: true, poster: 'https://image.tmdb.org/t/p/w300/or06FN3Dka5tukK1e9sl16pB3iy.jpg', trailerKey: 'TcMBFSGVi1c', overview: 'After the devastating events of Infinity War, the universe is in ruins. With the help of remaining allies, the Avengers assemble once more in order to reverse Thanos\' actions and restore balance to the universe.' },
    { order: 23, year: 2019, title: 'Spider-Man: Far From Home', rating: 7.4, runtime: '2h 9m', director: 'Jon Watts', essential: true, poster: 'https://image.tmdb.org/t/p/w300/lcq8dVxeeOqHvryateEF9uVMWjB.jpg', trailerKey: 'LFoz8ZJWmPs', overview: 'Following the events of Avengers: Endgame, Spider-Man must step up to take on new threats in a world that has changed forever.' }
  ];

  let currentTab = 'watch';
  let cursorX = 0, cursorY = 0;
  let lastX = 0, lastY = 0;
  let cursorVX = 0, cursorVY = 0;

  const appRoot = document.getElementById('appRoot');
  const cursorDot = document.getElementById('cursorDot');
  const cursorRing = document.getElementById('cursorRing');

  // Cursor tracking
  document.addEventListener('mousemove', (e) => {
    cursorX = e.clientX;
    cursorY = e.clientY;
    cursorVX = cursorX - lastX;
    cursorVY = cursorY - lastY;
    lastX = cursorX;
    lastY = cursorY;
    
    cursorDot.style.left = cursorX + 'px';
    cursorDot.style.top = cursorY + 'px';
    
    const angle = Math.atan2(cursorVY, cursorVX) * 180 / Math.PI;
    cursorRing.style.left = cursorX + 'px';
    cursorRing.style.top = cursorY + 'px';
    cursorRing.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
  });

  // Helper function to render star rating
  function renderStars(rating) {
    const fullStars = Math.floor(rating / 2);
    const hasHalf = (rating / 2) - fullStars >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) {
      stars += `<svg viewBox="0 0 24 24" class="star-filled"><polygon points="12 17.27 18.18 21 16.54 13.97 22 9.24 14.81 8.63 12 2 9.19 8.63 2 9.24 7.46 13.97 5.82 21 12 17.27" fill="currentColor"/></svg>`;
    }
    if (hasHalf) {
      stars += `<svg viewBox="0 0 24 24" class="star-half"><polygon points="12 17.27 18.18 21 16.54 13.97 22 9.24 14.81 8.63 12 2 9.19 8.63 2 9.24 7.46 13.97 5.82 21 12 17.27" fill="currentColor"/></svg>`;
    }
    for (let i = 0; i < emptyStars; i++) {
      stars += `<svg viewBox="0 0 24 24" class="star-empty"><polygon points="12 17.27 18.18 21 16.54 13.97 22 9.24 14.81 8.63 12 2 9.19 8.63 2 9.24 7.46 13.97 5.82 21 12 17.27" fill="currentColor"/></svg>`;
    }
    return `<div class="rating-stars">${stars}</div>`;
  }

  function renderWatchTab() {
    const movies = mcuMovies;
    return `<div class="timeline-section">
      <div class="timeline-intro">
        <div class="overtitle"><span class="bar"></span><span>RELEASE ORDER</span></div>
        <p style="opacity:0.5;font-size:0.9rem;margin-top:12px;">The Infinity Saga: Complete Phase 1-3 (2008-2019). Essential films marked for first-time viewers.</p>
      </div>
      <div class="timeline-track">
        <div class="timeline-spine"></div>
        ${movies.map((m, i) => {
          const right = i % 2 !== 0 ? 'timeline-item-right' : '';
          return `<div class="timeline-item ${right}">
            <div class="timeline-dot"><span class="dot-num">${m.order}</span></div>
            <div class="tl-card">
              <div class="tl-card-poster">
                <img src="${m.poster}" alt="${m.title}" loading="lazy" onerror="this.style.display='none'"/>
              </div>
              <div class="tl-card-body">
                <div class="tl-card-year">${m.year}</div>
                <div style="display:flex; align-items:center; flex-wrap:wrap;">
                  <h3 class="tl-card-title" style="margin:8px 0;">${m.title}</h3>
                  <span class="${m.essential ? 'essential-badge' : 'optional-badge'}">${m.essential ? 'ESSENTIAL' : 'OPTIONAL'}</span>
                  ${renderStars(m.rating)}
                  <a href="https://www.youtube.com/watch?v=${m.trailerKey}" target="_blank" class="trailer-btn" onclick="event.stopPropagation();">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    TRAILER
                  </a>
                </div>
                <div class="tl-card-details">
                  <span>${m.runtime}</span>
                  <span>★ ${m.rating}/10</span>
                  <span>🎬 ${m.director}</span>
                </div>
                <p class="tl-card-overview">${m.overview}</p>
              </div>
            </div>
          </div>`;
        }).join('')}
        <div class="timeline-end"><div class="end-circle">✓</div><p>THE INFINITY SAGA COMPLETE</p></div>
      </div>
    </div>`;
  }

  function renderHistoryTab() {
    const byYear = {};
    mcuMovies.forEach(m => {
      if (!byYear[m.year]) byYear[m.year] = [];
      byYear[m.year].push(m);
    });
    const groups = Object.entries(byYear).sort((a,b) => +a[0] - +b[0]);
    
    return `<div class="history-section">
      <div class="timeline-intro">
        <div class="overtitle"><span class="bar"></span><span>RELEASE HISTORY</span></div>
        <p style="opacity:0.5;font-size:0.9rem;margin-top:12px;">Evolution of the MCU across 11 years (2008-2019).</p>
      </div>
      ${groups.map(([year, movies]) => `
        <div class="history-year" style="font-family:'Cormorant Garamond';font-size:2.2rem;font-weight:300;color:rgba(201,168,76,0.6);margin:32px 0 12px;">${year}</div>
        ${movies.map(m => `
          <div class="history-card" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.05);margin-bottom:14px;display:flex;overflow:hidden;">
            <img src="${m.poster}" style="width:72px;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'"/>
            <div style="padding:16px 20px;flex:1;">
              <div style="font-family:'Space Mono';font-size:0.58rem;color:#c9a84c;margin-bottom:4px;">#${m.order}</div>
              <h4 style="font-family:'Cormorant Garamond';font-size:1.2rem;font-weight:600;margin-bottom:6px;">${m.title}</h4>
              <div style="font-size:0.68rem;opacity:0.45;margin-top:4px;">${m.runtime} · ★ ${m.rating} · ${m.director}</div>
              <p style="font-size:0.76rem;opacity:0.4;margin-top:8px;line-height:1.5;">${m.overview.slice(0, 100)}...</p>
            </div>
          </div>
        `).join('')}
      `).join('')}
      <div class="span-bar" style="height:2px;background:rgba(255,255,255,0.06);position:relative;margin-top:24px;"><div class="span-fill" style="position:absolute;height:100%;background:#c9a84c;opacity:0.35;width:100%;"></div></div>
    </div>`;
  }

  function renderGuide() {
    appRoot.innerHTML = `
      <main class="guide-container">
        <div class="guide-hero" style="background-image:url('https://image.tmdb.org/t/p/w1280/or06FN3Dka5tukK1e9sl16pB3iy.jpg')">
          <div class="guide-hero-overlay"></div>
          <div class="guide-hero-content">
            <a href="#" class="back-button" id="backBtn">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L4 8L10 4" stroke="currentColor" stroke-width="1.5"/></svg>
              BACK TO HOME
            </a>
            <div class="overtitle"><span class="bar"></span><span>COMPLETE GUIDE</span></div>
            <h1 class="guide-title">Marvel Cinematic Universe</h1>
            <div class="guide-meta-row">
              <span class="guide-pill">23 FILMS</span>
              <span class="guide-pill">2008–2019</span>
              <span class="guide-pill">THE INFINITY SAGA</span>
            </div>
            <p class="guide-desc">The complete Infinity Saga from Iron Man to Spider-Man: Far From Home. 23 films across 3 phases that built the biggest cinematic universe in history, culminating in Avengers: Endgame.</p>
          </div>
        </div>
        <div class="tab-bar">
          <button class="tab-btn ${currentTab === 'watch' ? 'tab-active' : ''}" data-tab="watch">
            <svg width="13" height="13" viewBox="0 0 14 14"><polygon points="3,2 13,7 3,12" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>
            WATCH ORDER
          </button>
          <button class="tab-btn ${currentTab === 'history' ? 'tab-active' : ''}" data-tab="history">
            <svg width="13" height="13" viewBox="0 0 14 14"><path d="M1 7h12M7 3v8" stroke="currentColor" stroke-width="1.3"/></svg>
            RELEASE HISTORY
          </button>
        </div>
        ${currentTab === 'watch' ? renderWatchTab() : renderHistoryTab()}
      </main>
    `;

    document.getElementById('backBtn')?.addEventListener('click', () => {
      window.location.href = '/';
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentTab = btn.dataset.tab;
        renderGuide();
      });
    });
  }

  renderGuide();
})();
</script>
</body>
</html>