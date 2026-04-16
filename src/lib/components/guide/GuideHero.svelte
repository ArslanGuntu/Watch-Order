<script lang="ts">
  import { goto } from '$app/navigation';
  import type { SelectedItem } from '$lib/types';
  import { accentColor, accentClass } from '$lib/utils';

  interface Props {
    sel: SelectedItem;
  }

  let { sel }: Props = $props();

  const ac = accentClass(sel.type);
  const acColor = accentColor(sel.type);
  const isTV = sel.type === 'anime' || sel.type === 'series';
  const isFr = sel.type === 'franchises';

  const pillClass = `font-['Space_Mono'] text-[0.6rem] tracking-[0.12em] border px-3 py-1 rounded-sm`;
  const acPillStyle = `color: ${acColor}; border-color: ${acColor}55; background: ${acColor}14`;
  const defaultPillStyle = `color: rgba(240,236,228,0.55); border-color: rgba(255,255,255,0.18)`;
</script>

<div
  class="h-[50vh] bg-cover bg-center relative flex items-end"
  style="background-image: url('{sel.bg || sel.poster || ''}')"
>
  <!-- Gradient overlay -->
  <div class="absolute inset-0 bg-gradient-to-b from-[rgba(5,5,5,0.2)] via-[rgba(5,5,5,0.7)] to-[#050505]"></div>

  <!-- Content -->
  <div class="relative z-10 px-[70px] pb-12 max-w-[900px]">
    <button
      class="font-['Space_Mono'] text-[0.6rem] tracking-[0.1em] uppercase text-white/40
             bg-none border border-white/10 px-4 py-2 rounded-sm cursor-pointer mb-5
             transition-all duration-200 hover:text-white/70 hover:border-white/20"
      onclick={() => goto('/app')}
    >
      ← BACK
    </button>

    <div class="flex items-center gap-3 mb-3">
      <div class="w-8 h-px" style="background: {acColor}"></div>
      <span class="font-['Space_Mono'] text-[0.52rem] tracking-[0.2em] uppercase" style="color: {acColor}">
        {sel.type === 'anime' ? 'ANIME' : sel.type === 'series' ? 'SERIES' : sel.type === 'franchises' ? 'FILM FRANCHISE' : 'FILM'}
      </span>
    </div>

    <h1 class="font-['Cormorant_Garamond'] text-[clamp(2.5rem,5vw,4rem)] font-bold leading-none mb-4 tracking-[-0.02em]">
      {sel.title}
    </h1>

    <div class="flex gap-2.5 flex-wrap mb-3">
      {#if isTV}
        <span class={pillClass} style={acPillStyle}>{sel.entries} SEASONS</span>
        <span class={pillClass} style={defaultPillStyle}>{sel.years || ''}</span>
        {#if sel.status}
          <span class={pillClass} style={acPillStyle}>{sel.status}</span>
        {/if}
      {:else if isFr}
        <span class={pillClass} style={defaultPillStyle}>{sel.entries} FILMS</span>
        <span class={pillClass} style={defaultPillStyle}>{sel.years || ''}</span>
      {:else}
        <span class={pillClass} style={defaultPillStyle}>FILM</span>
        <span class={pillClass} style={defaultPillStyle}>{sel.years || ''}</span>
        {#if sel.ratingNum && sel.ratingNum > 0}
          <span class={pillClass} style={defaultPillStyle}>★ {sel.rating}</span>
        {/if}
      {/if}
    </div>

    {#if sel.desc}
      <p class="text-[0.88rem] text-white/45 leading-relaxed font-['Sora'] font-light max-w-xl line-clamp-3">
        {sel.desc}
      </p>
    {/if}
  </div>
</div>
