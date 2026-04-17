<script lang="ts">
  import { goto } from '$app/navigation';
  import GrainOverlay from '$lib/components/layout/GrainOverlay.svelte';

  // ─── DATA ──────────────────────────────────────────────────────────────────

  interface McuFilm {
    order: number;
    year: number;
    title: string;
    rating: number;
    runtime: string;
    director: string;
    essential: boolean;
    poster: string;
    trailerKey: string;
    overview: string;
  }

  const mcuMovies: McuFilm[] = [
    { order: 1, year: 2008, title: 'Iron Man', rating: 7.9, runtime: '2h 6m', director: 'Jon Favreau', essential: true, poster: 'https://image.tmdb.org/t/p/w300/78lPtwv72eTNqFW9COBYI0dWDJa.jpg', trailerKey: '8hYlB38asDY', overview: 'Billionaire industrialist Tony Stark builds a high-tech suit of armor after being held captive. He becomes Iron Man, a superhero dedicated to protecting the world.' },
    { order: 2, year: 2008, title: 'The Incredible Hulk', rating: 6.6, runtime: '1h 52m', director: 'Louis Leterrier', essential: false, poster: 'https://image.tmdb.org/t/p/w300/gKddJUyiP1Xl5VtTTbRrNNSDHdP.jpg', trailerKey: 'xbqNb2PFWKA', overview: 'Bruce Banner, a scientist on the run from the U.S. government, must find a cure for the monster he turns into whenever he loses his temper.' },
    { order: 3, year: 2010, title: 'Iron Man 2', rating: 6.9, runtime: '2h 4m', director: 'Jon Favreau', essential: true, poster: 'https://image.tmdb.org/t/p/w300/6WBeq4fCfn7AN0o21W9qNcRF2l9.jpg', trailerKey: 'wKtcmiBc4jY', overview: 'Tony Stark faces pressure from the government, a rival inventor, and his own declining health as he continues his superhero journey.' },
    { order: 4, year: 2011, title: 'Thor', rating: 7.0, runtime: '1h 55m', director: 'Kenneth Branagh', essential: true, poster: 'https://image.tmdb.org/t/p/w300/prSfAi1xGrhLQNxrSUGqXoZUb4M.jpg', trailerKey: 'JOddpNl4F1E', overview: 'The powerful but arrogant god Thor is cast out of Asgard to live amongst humans in Midgard (Earth), where he soon becomes one of their finest defenders.' },
    { order: 5, year: 2011, title: 'Captain America: The First Avenger', rating: 6.9, runtime: '2h 4m', director: 'Joe Johnston', essential: true, poster: 'https://image.tmdb.org/t/p/w300/vSNxAJTlD0r7wdj61aYaWPqLb7K.jpg', trailerKey: 'JerVrbLldXw', overview: 'Steve Rogers transforms into Captain America after taking a Super-Soldier serum, but being Captain America comes at a price.' },
    { order: 6, year: 2012, title: 'The Avengers', rating: 8.0, runtime: '2h 23m', director: 'Joss Whedon', essential: true, poster: 'https://image.tmdb.org/t/p/w300/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg', trailerKey: 'eOrNdBpGMv8', overview: "Earth's mightiest heroes must come together and learn to fight as a team if they are going to stop the mischievous Loki and his alien army." },
    { order: 7, year: 2013, title: 'Iron Man 3', rating: 7.1, runtime: '2h 10m', director: 'Shane Black', essential: true, poster: 'https://image.tmdb.org/t/p/w300/qhPtAc1TKbMPqNvcdXSOn9Bn7hZ.jpg', trailerKey: 'Ke1Y3P9D0Bc', overview: 'Tony Stark faces a nemesis called the Mandarin and battles his own demons after his world is torn apart by a terrorist attack.' },
    { order: 8, year: 2013, title: 'Thor: The Dark World', rating: 6.8, runtime: '1h 52m', director: 'Alan Taylor', essential: false, poster: 'https://image.tmdb.org/t/p/w300/wp6OxE4poJ4G7c0U2ZqasuiUVcw.jpg', trailerKey: 'npvJ9FTgZbM', overview: 'Thor must team up with his treacherous brother Loki to save Asgard and the universe from the Dark Elves.' },
    { order: 9, year: 2014, title: 'Captain America: The Winter Soldier', rating: 7.7, runtime: '2h 16m', director: 'Anthony & Joe Russo', essential: true, poster: 'https://image.tmdb.org/t/p/w300/tVFRpFw3xTedgPGqxW0AOI8Qhh0.jpg', trailerKey: 'tbayiPxkUzQ', overview: 'Captain America struggles to expose a growing conspiracy within S.H.I.E.L.D. while fighting a mysterious assassin known as the Winter Soldier.' },
    { order: 10, year: 2014, title: 'Guardians of the Galaxy', rating: 8.0, runtime: '2h 1m', director: 'James Gunn', essential: true, poster: 'https://image.tmdb.org/t/p/w300/r7vmZjiyZw9rpJMQJdXpjgiCOk9.jpg', trailerKey: 'd96cjJhvlMA', overview: 'A group of intergalactic criminals must pull together to stop a fanatical warrior from taking control of the universe.' },
    { order: 11, year: 2015, title: 'Avengers: Age of Ultron', rating: 7.3, runtime: '2h 21m', director: 'Joss Whedon', essential: true, poster: 'https://image.tmdb.org/t/p/w300/4ssDuvEDkSArWEdyBl2X5EHvYKU.jpg', trailerKey: 'tmeOjFno6Do', overview: 'The Avengers must assemble once more to defeat the robotic villain Ultron, who is determined to wipe out humanity.' },
    { order: 12, year: 2015, title: 'Ant-Man', rating: 7.3, runtime: '1h 57m', director: 'Peyton Reed', essential: true, poster: 'https://image.tmdb.org/t/p/w300/rQRnQfUl3kfp78nCWq8Ks04vnq1.jpg', trailerKey: 'pWdKf3MneyI', overview: 'A con man armed with a suit that allows him to shrink in size must pull off a heist to save the world.' },
    { order: 13, year: 2016, title: 'Captain America: Civil War', rating: 7.8, runtime: '2h 27m', director: 'Anthony & Joe Russo', essential: true, poster: 'https://image.tmdb.org/t/p/w300/rAGiXaUfPzY7CDEyNKUofk3H4gV.jpg', trailerKey: 'dKrVegVI0Us', overview: 'Political pressure mounts to install a system of accountability for the Avengers, causing a rift between the team members.' },
    { order: 14, year: 2016, title: 'Doctor Strange', rating: 7.5, runtime: '1h 55m', director: 'Scott Derrickson', essential: true, poster: 'https://image.tmdb.org/t/p/w300/uGBVj3bEbCoZbDjjl9wTxcygko1.jpg', trailerKey: 'Lt-U_t2pUHI', overview: 'While on a journey of physical and spiritual healing, a brilliant neurosurgeon is drawn into the world of the mystic arts.' },
    { order: 15, year: 2017, title: 'Guardians of the Galaxy Vol. 2', rating: 7.6, runtime: '2h 16m', director: 'James Gunn', essential: true, poster: 'https://image.tmdb.org/t/p/w300/y4MBh0EjBlMuOzv9axM4qJlmhzz.jpg', trailerKey: 'wUn05hdkhjM', overview: "The Guardians must fight to keep their newfound family together as they unravel the mystery of Peter Quill's true parentage." },
    { order: 16, year: 2017, title: 'Spider-Man: Homecoming', rating: 7.4, runtime: '2h 13m', director: 'Jon Watts', essential: true, poster: 'https://image.tmdb.org/t/p/w300/c24sv2weTHPsmDa7jEMN0m2P3RT.jpg', trailerKey: 'rk-dF1lIbIg', overview: 'Peter Parker, with the help of his mentor Tony Stark, tries to balance his life as an ordinary high school student in Queens while fighting crime.' },
    { order: 17, year: 2017, title: 'Thor: Ragnarok', rating: 7.9, runtime: '2h 10m', director: 'Taika Waititi', essential: true, poster: 'https://image.tmdb.org/t/p/w300/rzRwTcFvttcN1ZpX2xv4j3tSdJu.jpg', trailerKey: 'ue80QwXMRHg', overview: 'Imprisoned on the planet Sakaar, Thor must race against time to return to Asgard and stop Ragnarök, the destruction of his home world.' },
    { order: 18, year: 2018, title: 'Black Panther', rating: 7.3, runtime: '2h 14m', director: 'Ryan Coogler', essential: true, poster: 'https://image.tmdb.org/t/p/w300/uxzzxijgPIY7slzFvMotPv8wjKA.jpg', trailerKey: 'xjDjIWPwcPU', overview: "T'Challa, after the death of his father, the King of Wakanda, returns home to the isolated, technologically advanced African nation to succeed to the throne." },
    { order: 19, year: 2018, title: 'Avengers: Infinity War', rating: 8.4, runtime: '2h 29m', director: 'Anthony & Joe Russo', essential: true, poster: 'https://image.tmdb.org/t/p/w300/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg', trailerKey: '6ZfuNTqbHE8', overview: 'The Avengers and their allies must be willing to sacrifice all in an attempt to defeat the powerful Thanos before his blitz of devastation and ruin puts an end to the universe.' },
    { order: 20, year: 2018, title: 'Ant-Man and the Wasp', rating: 7.1, runtime: '1h 58m', director: 'Peyton Reed', essential: true, poster: 'https://image.tmdb.org/t/p/w300/rv1AWImgx386ULjcf62VYaW8zSt.jpg', trailerKey: 'TglOP_bn0KY', overview: "As Scott Lang balances being both a superhero and a father, Hope van Dyne and Dr. Hank Pym present an urgent new mission that finds the Ant-Man fighting alongside The Wasp." },
    { order: 21, year: 2019, title: 'Captain Marvel', rating: 6.9, runtime: '2h 4m', director: 'Anna Boden & Ryan Fleck', essential: true, poster: 'https://image.tmdb.org/t/p/w300/AtsgWhDnHTq68L0lLsUrCnM7TjG.jpg', trailerKey: 'Z1BCujX3pw8', overview: 'Carol Danvers becomes one of the universe\'s most powerful heroes when Earth is caught in the middle of a galactic war between two alien races.' },
    { order: 22, year: 2019, title: 'Avengers: Endgame', rating: 8.4, runtime: '3h 2m', director: 'Anthony & Joe Russo', essential: true, poster: 'https://image.tmdb.org/t/p/w300/or06FN3Dka5tukK1e9sl16pB3iy.jpg', trailerKey: 'TcMBFSGVi1c', overview: 'After the devastating events of Infinity War, the universe is in ruins. With the help of remaining allies, the Avengers assemble once more to reverse Thanos\' actions.' },
    { order: 23, year: 2019, title: 'Spider-Man: Far From Home', rating: 7.9, runtime: '2h 9m', director: 'Jon Watts', essential: true, poster: 'https://image.tmdb.org/t/p/w300/lcq8dVxeeOqHvvgcte707K0KjE3.jpg', trailerKey: 'Zt1eraj8bqM', overview: 'Following the events of Endgame, Peter Parker goes on a school trip to Europe. He tries to leave his superhero duties behind but reluctantly agrees to help Nick Fury uncover the mystery of several elemental creature attacks.' },
  ];

  // ─── STATE ────────────────────────────────────────────────────────────────

  type Tab = 'watch' | 'history';
  let currentTab = $state<Tab>('watch');

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  function ratingStars(rating: number): { full: number; half: boolean; empty: number } {
    const outOf5 = rating / 2;
    const full = Math.floor(outOf5);
    const half = outOf5 - full >= 0.4;
    const empty = 5 - full - (half ? 1 : 0);
    return { full, half, empty };
  }

  // Group movies by year for history tab
  let byYear = $derived(() => {
    const groups: Record<number, McuFilm[]> = {};
    for (const m of mcuMovies) {
      if (!groups[m.year]) groups[m.year] = [];
      groups[m.year].push(m);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => +a - +b)
      .map(([year, films]) => ({ year: +year, films }));
  });
</script>

<svelte:head>
  <title>MCU Guide · Marvel Cinematic Universe Watch Order</title>
</svelte:head>

<GrainOverlay />

<!-- ── NAV ──────────────────────────────────────────────────────────────── -->
<nav class="fixed top-0 w-full z-[100] flex items-center px-[50px] py-5 bg-[rgba(5,5,5,0.92)] backdrop-blur-[16px] border-b border-white/[0.07] box-border">
  <a href="/" class="flex items-baseline gap-0 no-underline">
    <span class="font-['Cormorant_Garamond'] text-[2.2rem] text-[#c9a84c] font-bold leading-none">W</span>
    <span class="font-['Cormorant_Garamond'] text-[1.6rem] font-light text-[#f0ece4]">atch</span>
    <span class="font-['Cormorant_Garamond'] italic text-[1.6rem] font-semibold opacity-85 text-[#f0ece4]">Order</span>
    <div class="w-[5px] h-[5px] bg-[#c9a84c] rounded-full ml-[5px] shadow-[0_0_8px_#c9a84c]"></div>
  </a>
</nav>

<!-- ── HERO ──────────────────────────────────────────────────────────────── -->
<main class="pt-[72px]">
  <div
    class="h-[55vh] bg-cover bg-center relative flex items-end"
    style="background-image: url('https://image.tmdb.org/t/p/w1280/or06FN3Dka5tukK1e9sl16pB3iy.jpg')"
  >
    <div class="absolute inset-0 bg-gradient-to-b from-[rgba(5,5,5,0.2)] via-[rgba(5,5,5,0.65)] to-[#050505]"></div>
    <div class="relative z-10 px-[70px] pb-12 max-w-[900px]">
      <button
        class="font-['Space_Mono'] text-[0.6rem] tracking-[0.1em] uppercase text-white/40 bg-transparent border border-white/10 px-4 py-2 rounded-sm cursor-pointer mb-5 transition-all hover:text-white/70 hover:border-white/20"
        onclick={() => goto('/')}
      >← BACK TO HOME</button>
      <div class="flex items-center gap-3 mb-3">
        <div class="w-8 h-px bg-[#c9a84c]"></div>
        <span class="font-['Space_Mono'] text-[0.52rem] tracking-[0.2em] uppercase text-[#c9a84c]">COMPLETE GUIDE</span>
      </div>
      <h1 class="font-['Cormorant_Garamond'] text-[clamp(2.5rem,5vw,4rem)] font-bold leading-none mb-4">Marvel Cinematic Universe</h1>
      <div class="flex gap-2.5 flex-wrap mb-4">
        {#each ['23 FILMS', '2008–2019', 'THE INFINITY SAGA'] as pill}
          <span class="font-['Space_Mono'] text-[0.6rem] tracking-[0.12em] border border-white/18 px-3 py-1 rounded-sm text-white/55">{pill}</span>
        {/each}
      </div>
      <p class="font-['Sora'] text-[0.88rem] font-light text-white/45 leading-relaxed max-w-xl">
        The complete Infinity Saga from Iron Man to Spider-Man: Far From Home. 23 films across 3 phases that built the biggest cinematic universe in history.
      </p>
    </div>
  </div>

  <!-- ── TABS ─────────────────────────────────────────────────────────────── -->
  <div class="flex sticky top-[64px] z-50 bg-[rgba(5,5,5,0.96)] backdrop-blur-sm border-b border-white/[0.07] px-[70px]">
    {#each [{ id: 'watch', label: 'WATCH ORDER' }, { id: 'history', label: 'RELEASE HISTORY' }] as tab}
      <button
        class="flex items-center gap-2 bg-transparent border-none font-['Space_Mono'] text-[0.68rem] tracking-[0.12em] px-6 py-5 cursor-pointer border-b-2 -mb-px transition-all duration-200
               {currentTab === tab.id ? 'text-[#c9a84c] border-[#c9a84c]' : 'text-white/35 border-transparent hover:text-white/60'}"
        onclick={() => currentTab = tab.id as Tab}
      >{tab.label}</button>
    {/each}
  </div>

  <!-- ── WATCH ORDER TAB ───────────────────────────────────────────────────── -->
  {#if currentTab === 'watch'}
    <section class="px-[70px] py-[70px] pb-[120px]">
      <div class="mb-14">
        <div class="flex items-center gap-3.5 font-['Space_Mono'] text-[0.68rem] tracking-[0.2em] text-[#c9a84c] mb-5">
          <span class="w-9 h-px bg-[#c9a84c]"></span>
          RELEASE ORDER
        </div>
        <p class="text-white/50 text-[0.9rem] mt-3">The Infinity Saga: Complete Phase 1–3 (2008–2019). Essential films marked for first-time viewers.</p>
      </div>

      <!-- Timeline -->
      <div class="relative">
        <!-- Center spine -->
        <div class="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[rgba(201,168,76,0.35)] to-transparent -translate-x-1/2 hidden md:block"></div>

        {#each mcuMovies as m, i}
          {@const right = i % 2 !== 0}
          {@const stars = ratingStars(m.rating)}

          <div class="grid md:grid-cols-[1fr_64px_1fr] items-start mb-14">
            <!-- Left slot (content or empty) -->
            {#if !right}
              <div class="tl-card group bg-[#0d0d0d] border border-white/[0.06] rounded-sm overflow-hidden transition-all duration-300 hover:border-[#c9a84c]/20 hover:-translate-y-0.5 md:mr-8">
                <div class="relative h-[160px] overflow-hidden">
                  <img
                    src={m.poster}
                    alt={m.title}
                    loading="lazy"
                    class="w-full h-full object-cover opacity-70 transition-all duration-500 group-hover:opacity-90 group-hover:scale-105"
                    onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div class="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] to-transparent"></div>
                </div>
                <div class="p-5">
                  <div class="font-['Space_Mono'] text-[0.55rem] text-[#c9a84c]/70 mb-1">{m.year}</div>
                  <div class="flex items-center flex-wrap gap-2 mb-2">
                    <h3 class="font-['Cormorant_Garamond'] text-[1.2rem] font-semibold">{m.title}</h3>
                    <span class="font-['Space_Mono'] text-[0.5rem] px-2 py-0.5 rounded-sm {m.essential ? 'bg-[rgba(201,168,76,0.12)] border border-[#c9a84c]/30 text-[#c9a84c]' : 'bg-[rgba(93,173,226,0.1)] border border-[rgba(93,173,226,0.2)] text-[#5dade2]'}">
                      {m.essential ? 'ESSENTIAL' : 'OPTIONAL'}
                    </span>
                    <!-- Stars -->
                    <div class="flex items-center gap-0.5 ml-1">
                      {#each Array(stars.full) as _}<svg viewBox="0 0 24 24" class="w-3 h-3 text-[#c9a84c]"><polygon points="12 17.27 18.18 21 16.54 13.97 22 9.24 14.81 8.63 12 2 9.19 8.63 2 9.24 7.46 13.97 5.82 21 12 17.27" fill="currentColor"/></svg>{/each}
                      {#if stars.half}<svg viewBox="0 0 24 24" class="w-3 h-3 text-[#c9a84c] opacity-50"><polygon points="12 17.27 18.18 21 16.54 13.97 22 9.24 14.81 8.63 12 2 9.19 8.63 2 9.24 7.46 13.97 5.82 21 12 17.27" fill="currentColor"/></svg>{/if}
                      {#each Array(stars.empty) as _}<svg viewBox="0 0 24 24" class="w-3 h-3 text-white/10"><polygon points="12 17.27 18.18 21 16.54 13.97 22 9.24 14.81 8.63 12 2 9.19 8.63 2 9.24 7.46 13.97 5.82 21 12 17.27" fill="currentColor"/></svg>{/each}
                    </div>
                    <a
                      href="https://www.youtube.com/watch?v={m.trailerKey}"
                      target="_blank"
                      rel="noopener noreferrer"
                      onclick={(e) => e.stopPropagation()}
                      class="font-['Space_Mono'] text-[0.5rem] tracking-[0.08em] border border-white/15 text-white/45 px-2 py-0.5 rounded-sm no-underline hover:border-[#c9a84c]/40 hover:text-[#c9a84c] transition-all flex items-center gap-1 ml-1"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      TRAILER
                    </a>
                  </div>
                  <div class="font-['Space_Mono'] text-[0.55rem] text-white/35 flex gap-3 mb-3">
                    <span>{m.runtime}</span>
                    <span>★ {m.rating}/10</span>
                    <span>🎬 {m.director}</span>
                  </div>
                  <p class="text-[0.78rem] text-white/40 leading-relaxed line-clamp-3">{m.overview}</p>
                </div>
              </div>
            {:else}
              <div></div>
            {/if}

            <!-- Center dot -->
            <div class="flex justify-center pt-6 col-start-2">
              <div class="w-11 h-11 rounded-full border border-[#c9a84c]/40 bg-[#0a0a0a] flex items-center justify-center font-['Space_Mono'] text-[0.65rem] text-[#c9a84c]">
                {m.order}
              </div>
            </div>

            <!-- Right slot -->
            {#if right}
              <div class="tl-card group bg-[#0d0d0d] border border-white/[0.06] rounded-sm overflow-hidden transition-all duration-300 hover:border-[#c9a84c]/20 hover:-translate-y-0.5 md:ml-8">
                <div class="relative h-[160px] overflow-hidden">
                  <img
                    src={m.poster}
                    alt={m.title}
                    loading="lazy"
                    class="w-full h-full object-cover opacity-70 transition-all duration-500 group-hover:opacity-90 group-hover:scale-105"
                    onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div class="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] to-transparent"></div>
                </div>
                <div class="p-5">
                  <div class="font-['Space_Mono'] text-[0.55rem] text-[#c9a84c]/70 mb-1">{m.year}</div>
                  <div class="flex items-center flex-wrap gap-2 mb-2">
                    <h3 class="font-['Cormorant_Garamond'] text-[1.2rem] font-semibold">{m.title}</h3>
                    <span class="font-['Space_Mono'] text-[0.5rem] px-2 py-0.5 rounded-sm {m.essential ? 'bg-[rgba(201,168,76,0.12)] border border-[#c9a84c]/30 text-[#c9a84c]' : 'bg-[rgba(93,173,226,0.1)] border border-[rgba(93,173,226,0.2)] text-[#5dade2]'}">
                      {m.essential ? 'ESSENTIAL' : 'OPTIONAL'}
                    </span>
                    <div class="flex items-center gap-0.5 ml-1">
                      {#each Array(stars.full) as _}<svg viewBox="0 0 24 24" class="w-3 h-3 text-[#c9a84c]"><polygon points="12 17.27 18.18 21 16.54 13.97 22 9.24 14.81 8.63 12 2 9.19 8.63 2 9.24 7.46 13.97 5.82 21 12 17.27" fill="currentColor"/></svg>{/each}
                      {#if stars.half}<svg viewBox="0 0 24 24" class="w-3 h-3 text-[#c9a84c] opacity-50"><polygon points="12 17.27 18.18 21 16.54 13.97 22 9.24 14.81 8.63 12 2 9.19 8.63 2 9.24 7.46 13.97 5.82 21 12 17.27" fill="currentColor"/></svg>{/if}
                      {#each Array(stars.empty) as _}<svg viewBox="0 0 24 24" class="w-3 h-3 text-white/10"><polygon points="12 17.27 18.18 21 16.54 13.97 22 9.24 14.81 8.63 12 2 9.19 8.63 2 9.24 7.46 13.97 5.82 21 12 17.27" fill="currentColor"/></svg>{/each}
                    </div>
                    <a
                      href="https://www.youtube.com/watch?v={m.trailerKey}"
                      target="_blank"
                      rel="noopener noreferrer"
                      onclick={(e) => e.stopPropagation()}
                      class="font-['Space_Mono'] text-[0.5rem] tracking-[0.08em] border border-white/15 text-white/45 px-2 py-0.5 rounded-sm no-underline hover:border-[#c9a84c]/40 hover:text-[#c9a84c] transition-all flex items-center gap-1 ml-1"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      TRAILER
                    </a>
                  </div>
                  <div class="font-['Space_Mono'] text-[0.55rem] text-white/35 flex gap-3 mb-3">
                    <span>{m.runtime}</span>
                    <span>★ {m.rating}/10</span>
                    <span>🎬 {m.director}</span>
                  </div>
                  <p class="text-[0.78rem] text-white/40 leading-relaxed line-clamp-3">{m.overview}</p>
                </div>
              </div>
            {:else}
              <div></div>
            {/if}
          </div>
        {/each}

        <!-- End marker -->
        <div class="flex flex-col items-center gap-3 pt-8">
          <div class="w-12 h-12 rounded-full border border-[#5fbf8c]/50 bg-[rgba(95,191,140,0.1)] flex items-center justify-center text-[#5fbf8c] text-lg">✓</div>
          <p class="font-['Space_Mono'] text-[0.62rem] tracking-[0.15em] text-white/30 uppercase">The Infinity Saga Complete</p>
        </div>
      </div>
    </section>

  <!-- ── HISTORY TAB ────────────────────────────────────────────────────────── -->
  {:else}
    <section class="px-[70px] py-[70px] pb-[120px]">
      <div class="mb-14">
        <div class="flex items-center gap-3.5 font-['Space_Mono'] text-[0.68rem] tracking-[0.2em] text-[#c9a84c] mb-5">
          <span class="w-9 h-px bg-[#c9a84c]"></span>
          RELEASE HISTORY
        </div>
        <p class="text-white/50 text-[0.9rem] mt-3">Evolution of the MCU across 11 years (2008–2019).</p>
      </div>

      {#each byYear() as group}
        <div class="font-['Cormorant_Garamond'] text-[2.2rem] font-light text-[rgba(201,168,76,0.6)] mt-8 mb-3">{group.year}</div>
        {#each group.films as m}
          <div class="flex overflow-hidden bg-[#0d0d0d] border border-white/[0.05] mb-3.5 transition-all hover:border-[#c9a84c]/15">
            <img
              src={m.poster}
              alt={m.title}
              class="w-[72px] object-cover flex-shrink-0 opacity-80"
              onerror={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              loading="lazy"
            />
            <div class="flex-1 px-5 py-4">
              <div class="font-['Space_Mono'] text-[0.58rem] text-[#c9a84c] mb-1">#{m.order}</div>
              <h4 class="font-['Cormorant_Garamond'] text-[1.2rem] font-semibold mb-1.5">{m.title}</h4>
              <div class="font-['Space_Mono'] text-[0.58rem] text-white/35 flex gap-3 mb-2">
                <span>{m.runtime}</span>
                <span>★ {m.rating}</span>
                <span>🎬 {m.director}</span>
              </div>
              <p class="text-[0.76rem] text-white/40 leading-relaxed line-clamp-2">{m.overview}</p>
            </div>
          </div>
        {/each}
      {/each}
    </section>
  {/if}
</main>
