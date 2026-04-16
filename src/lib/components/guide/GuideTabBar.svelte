<script lang="ts">
  import type { ContentType } from '$lib/types';
  import { accentColor } from '$lib/utils';

  interface Props {
    type: ContentType;
    qs: string;         // e.g. "?type=series&id=1399"
    active: 'guide' | 'episodes' | 'history' | 'ratings' | 'reviews';
  }

  let { type, qs, active }: Props = $props();

  const isTV = type === 'anime' || type === 'series';
  const isFr = type === 'franchises';
  const isMv = type === 'movies';
  const acColor = accentColor(type);

  const tabBase = `font-['Space_Mono'] text-[0.62rem] tracking-[0.12em] uppercase px-5 py-4
                   border-b-2 border-transparent text-white/35 no-underline transition-all duration-200
                   hover:text-white/65`;
  const tabActive = `text-white border-b-2`;
</script>

<div class="flex sticky top-[72px] z-[400] bg-[#050505]/95 backdrop-blur-sm border-b border-white/[0.06] px-[70px] overflow-x-auto">
  {#if isTV}
    <a class="{tabBase} {active === 'guide' ? tabActive : ''}"
       style={active === 'guide' ? `color: ${acColor}; border-color: ${acColor}` : ''}
       href="guide{qs}">WATCH ORDER</a>
    <a class="{tabBase} {active === 'episodes' ? tabActive : ''}"
       style={active === 'episodes' ? `color: ${acColor}; border-color: ${acColor}` : ''}
       href="episodes{qs}">EPISODES</a>
    <a class="{tabBase} {active === 'history' ? tabActive : ''}"
       style={active === 'history' ? `color: ${acColor}; border-color: ${acColor}` : ''}
       href="history{qs}">HISTORY</a>
    <a class="{tabBase} {active === 'ratings' ? tabActive : ''}"
       style={active === 'ratings' ? `color: ${acColor}; border-color: ${acColor}` : ''}
       href="ratings{qs}">RATINGS</a>
    <a class="{tabBase} {active === 'reviews' ? tabActive : ''}"
       style={active === 'reviews' ? `color: ${acColor}; border-color: ${acColor}` : ''}
       href="reviews{qs}">REVIEWS</a>
  {:else if isFr}
    <a class="{tabBase} {active === 'guide' ? tabActive : ''}"
       style={active === 'guide' ? `color: ${acColor}; border-color: ${acColor}` : ''}
       href="guide{qs}">WATCH ORDER</a>
    <a class="{tabBase} {active === 'history' ? tabActive : ''}"
       style={active === 'history' ? `color: ${acColor}; border-color: ${acColor}` : ''}
       href="history{qs}">HISTORY</a>
    <a class="{tabBase} {active === 'ratings' ? tabActive : ''}"
       style={active === 'ratings' ? `color: ${acColor}; border-color: ${acColor}` : ''}
       href="ratings{qs}">RATINGS</a>
    <a class="{tabBase} {active === 'reviews' ? tabActive : ''}"
       style={active === 'reviews' ? `color: ${acColor}; border-color: ${acColor}` : ''}
       href="reviews{qs}">REVIEWS</a>
  {:else}
    <!-- Single movie -->
    <a class="{tabBase} {active === 'guide' ? tabActive : ''}"
       style={active === 'guide' ? `color: ${acColor}; border-color: ${acColor}` : ''}
       href="guide{qs}">FILM INFO</a>
    <a class="{tabBase} {active === 'ratings' ? tabActive : ''}"
       style={active === 'ratings' ? `color: ${acColor}; border-color: ${acColor}` : ''}
       href="ratings{qs}">RATINGS</a>
    <a class="{tabBase} {active === 'reviews' ? tabActive : ''}"
       style={active === 'reviews' ? `color: ${acColor}; border-color: ${acColor}` : ''}
       href="reviews{qs}">REVIEWS</a>
  {/if}
</div>
