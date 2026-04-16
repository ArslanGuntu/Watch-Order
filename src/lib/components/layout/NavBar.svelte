<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { watchlist } from '$lib/stores/watchlist.svelte';

  interface Props {
    showWatchlist?: boolean;
    showGuide?: boolean;
    onWatchlistClick?: () => void;
  }

  let { showWatchlist = false, showGuide = false, onWatchlistClick }: Props = $props();

  let scrolled = $state(false);

  $effect(() => {
    const handler = () => { scrolled = window.scrollY > 40; };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  });
</script>

<nav
  class="fixed top-0 w-full z-[500] flex justify-between items-center px-[50px] py-4 transition-all duration-400 box-border
         {scrolled ? 'bg-[rgba(5,5,5,0.95)] backdrop-blur-[16px] border-b border-white/[0.07]' : ''}"
>
  <a class="flex items-baseline gap-0 cursor-pointer no-underline" href="/">
    <span class="font-['Cormorant_Garamond'] text-[2.2rem] text-[#c9a84c] font-bold leading-none">W</span>
    <span class="font-['Cormorant_Garamond'] text-[1.6rem] font-light text-[#f0ece4]">atch</span>
    <span class="font-['Cormorant_Garamond'] italic text-[1.6rem] font-semibold opacity-85 text-[#f0ece4]">Order</span>
    <div class="w-[5px] h-[5px] bg-[#c9a84c] rounded-full ml-[5px] shadow-[0_0_8px_#c9a84c]"></div>
  </a>

  <div class="flex items-center gap-4">
    {#if showWatchlist}
      <button
        class="flex items-center gap-2 bg-none border border-white/10 text-[rgba(240,236,228,0.6)] font-['Space_Mono'] text-[0.6rem] tracking-[0.1em] uppercase px-4 py-2 rounded-sm cursor-pointer transition-all duration-200 hover:border-[#c9a84c]/50 hover:text-[#c9a84c]"
        onclick={onWatchlistClick}
      >
        📋 <span>WATCHLIST</span>
        {#if watchlist.count > 0}
          <span class="bg-[#c9a84c] text-black text-[0.5rem] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {watchlist.count}
          </span>
        {/if}
      </button>
    {/if}

    {#if showGuide}
      <button
        class="flex items-center gap-2 bg-none border border-white/10 text-[rgba(240,236,228,0.6)] font-['Space_Mono'] text-[0.6rem] tracking-[0.1em] uppercase px-4 py-2 rounded-sm cursor-pointer transition-all duration-200 hover:border-[#c9a84c]/50 hover:text-[#c9a84c]"
        onclick={() => goto('/app')}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <span>GUIDES</span>
      </button>
    {/if}

    <span class="font-['Space_Mono'] text-[0.52rem] tracking-[0.2em] text-[rgba(240,236,228,0.28)] uppercase whitespace-nowrap">
      ✦ CINEMATIC ORACLE ✦
    </span>
  </div>
</nav>
