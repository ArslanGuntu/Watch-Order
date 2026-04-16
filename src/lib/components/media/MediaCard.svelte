<script lang="ts">
  import type { MediaItem } from '$lib/types';
  import { accentColor } from '$lib/utils';

  interface Props {
    item: MediaItem;
    href: string;
  }

  let { item, href }: Props = $props();

  const acColor = accentColor(item.type);

  const metaClass: Record<string, string> = {
    franchises: 'text-[#c9a84c] border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.08)]',
    movies: 'text-[#c9a84c] border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.08)]',
    anime: 'text-[#e05c7a] border-[rgba(224,92,122,0.3)] bg-[rgba(224,92,122,0.08)]',
    series: 'text-[#5fbf8c] border-[rgba(95,191,140,0.3)] bg-[rgba(95,191,140,0.08)]',
  };
</script>

<a
  {href}
  class="group relative bg-[#0a0a0a] border border-white/[0.06] rounded-sm overflow-hidden
         flex flex-col cursor-pointer transition-all duration-300 no-underline text-[#f0ece4]
         hover:border-white/[0.14] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
>
  <!-- Poster -->
  <div class="relative w-full aspect-[2/3] overflow-hidden bg-[#111]">
    {#if item.poster}
      <img
        src={item.poster}
        alt={item.title}
        loading="lazy"
        class="w-full h-full object-cover opacity-80 transition-all duration-500 group-hover:opacity-100 group-hover:scale-105"
      />
    {:else}
      <div class="w-full h-full flex items-center justify-center opacity-10 text-5xl">🎬</div>
    {/if}

    <!-- Label badge -->
    <div
      class="absolute top-3 left-3 font-['Space_Mono'] text-[0.48rem] tracking-[0.18em] uppercase
             px-2 py-1 rounded-sm border {metaClass[item.type]}"
    >
      {item.label}
    </div>
  </div>

  <!-- Info -->
  <div class="p-4 flex flex-col gap-1 flex-1">
    <div class="flex items-center gap-2 flex-wrap">
      <span
        class="font-['Space_Mono'] text-[0.48rem] tracking-[0.14em] uppercase border px-2 py-0.5 rounded-sm {metaClass[item.type]}"
      >
        {item.type === 'franchises'
          ? `${item.entries} FILMS`
          : item.type === 'movies'
          ? 'FILM'
          : item.entries > 1
          ? `${item.entries} SEASONS`
          : '1 SEASON'}
      </span>
      <span class="font-['Space_Mono'] text-[0.48rem] text-white/30">{item.years}</span>
    </div>

    <h3 class="font-['Cormorant_Garamond'] text-base font-semibold leading-tight mt-1 tracking-[-0.01em]">
      {item.title}
    </h3>

    <p class="text-[0.72rem] text-white/40 leading-relaxed line-clamp-2 mt-1">
      {item.desc}
    </p>

    <div
      class="mt-auto pt-3 flex items-center gap-1.5 font-['Space_Mono'] text-[0.58rem] tracking-[0.1em] uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      style="color: {acColor}"
    >
      VIEW GUIDE
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" stroke-width="1.5"/>
      </svg>
    </div>
  </div>
</a>
