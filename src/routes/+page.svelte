<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import GrainOverlay from '$lib/components/layout/GrainOverlay.svelte';

  let scrolled = $state(false);
  
  $effect(() => {
    const h = () => { scrolled = window.scrollY > 60; };
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  });
</script>

<svelte:head>
  <title>WatchOrder — The Cinematic Guide</title>
</svelte:head>

<GrainOverlay />

<nav class="fixed top-0 w-full z-[500] flex justify-between items-center px-[50px] py-4 transition-all duration-400 box-border
  {scrolled ? 'bg-[rgba(5,5,5,0.95)] backdrop-blur-[16px] border-b border-white/[0.07]' : ''}">
  <div class="flex items-baseline gap-0">
    <span class="font-['Cormorant_Garamond'] text-[2.2rem] text-[#c9a84c] font-bold leading-none">W</span>
    <span class="font-['Cormorant_Garamond'] text-[1.6rem] font-light text-[#f0ece4]">atch</span>
    <span class="font-['Cormorant_Garamond'] italic text-[1.6rem] font-semibold opacity-85 text-[#f0ece4]">Order</span>
    <div class="w-[5px] h-[5px] bg-[#c9a84c] rounded-full ml-[5px] shadow-[0_0_8px_#c9a84c]"></div>
  </div>
  <div class="flex items-center gap-4">
    <a href="/signin" class="font-['Space_Mono'] text-[0.62rem] tracking-[0.1em] uppercase border border-white/10 text-white/50 px-4 py-2 rounded-sm no-underline hover:border-[#c9a84c]/40 hover:text-[#c9a84c] transition-all">SIGN IN</a>
    <a href="/app" class="font-['Space_Mono'] text-[0.62rem] tracking-[0.1em] uppercase bg-[rgba(201,168,76,0.12)] border border-[#c9a84c]/40 text-[#c9a84c] px-4 py-2 rounded-sm no-underline hover:bg-[rgba(201,168,76,0.22)] transition-all">BROWSE</a>
  </div>
</nav>

<main class="min-h-screen bg-[#050505] text-[#f0ece4] flex flex-col items-start justify-center px-[60px] pt-32 pb-20">
  <div class="max-w-3xl">
    <div class="font-['Space_Mono'] text-[0.55rem] tracking-[0.3em] text-[#c9a84c] uppercase mb-5 flex items-center gap-3">
      <span class="w-8 h-px bg-[#c9a84c]"></span>THE CINEMATIC ORACLE
    </div>
    <h1 class="font-['Cormorant_Garamond'] text-[clamp(3.5rem,7vw,6rem)] font-light leading-[1.02] tracking-[-0.03em] mb-7">
      Every watch order.<br />
      <em class="text-[#c9a84c] font-semibold">Every franchise.</em><br />
      One guide.
    </h1>
    <p class="font-['Sora'] text-[1rem] font-light text-white/45 leading-relaxed max-w-lg mb-10">
      The definitive database of watch orders for movies, anime, and series. Every franchise, every arc, every skip guide.
    </p>
    <div class="flex gap-4 flex-wrap">
      <a href="/app" class="flex items-center gap-3 font-['Space_Mono'] text-[0.72rem] tracking-[0.12em] uppercase bg-[rgba(201,168,76,0.14)] border border-[#c9a84c]/50 text-[#c9a84c] px-8 py-4 rounded-sm no-underline transition-all hover:bg-[rgba(201,168,76,0.24)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(201,168,76,0.2)]">
        BROWSE ALL GUIDES
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" stroke-width="1.5"/></svg>
      </a>
      <a href="/recommendations" class="flex items-center gap-3 font-['Space_Mono'] text-[0.72rem] tracking-[0.12em] uppercase border border-white/15 text-white/55 px-8 py-4 rounded-sm no-underline transition-all hover:border-white/30 hover:text-white/80">
        ✦ GET RECOMMENDATIONS
      </a>
    </div>
  </div>

  <!-- Stats -->
  <div class="flex gap-12 mt-20 flex-wrap">
    {#each [['500K+','Titles Indexed'],['10K+','Franchises Mapped'],['∞','Watch Orders']] as [num, label]}
      <div>
        <div class="font-['Cormorant_Garamond'] text-[2.5rem] font-light text-[#c9a84c]">{num}</div>
        <div class="font-['Space_Mono'] text-[0.55rem] tracking-[0.15em] text-white/30 uppercase mt-1">{label}</div>
      </div>
    {/each}
  </div>
</main>
