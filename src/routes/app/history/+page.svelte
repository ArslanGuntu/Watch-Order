<script>
// @ts-nocheck
import {{ onMount }} from 'svelte';
import GuideHero from '$lib/components/guide/GuideHero.svelte';
import GuideTabBar from '$lib/components/guide/GuideTabBar.svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';
import GrainOverlay from '$lib/components/layout/GrainOverlay.svelte';
import {{ accentColor }} from '$lib/utils';

const BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = '175b19b3ba717bf4f24e37ee4325be7e';
const IMG = 'https://image.tmdb.org/t/p/';

let itemType = $state('');
let itemId = $state('');
let qs = $state('');
let sel = $state(null);
let guideEntries = $state([]);
let loading = $state(true);
let error = $state(null);

function fmtR(r) {{ return r > 0 ? r.toFixed(1) : '—'; }}
function acC(t) {{ return t === 'anime' ? '#e05c7a' : t === 'series' ? '#5fbf8c' : '#c9a84c'; }}
function getYR(parts) {{
  const y = (parts||[]).map(p=>+(p.release_date||p.first_air_date||'').slice(0,4)).filter(Boolean).sort((a,b)=>a-b);
  return y.length ? y[0]+'–'+y[y.length-1] : 'N/A';
}}
function goBack() {{ if (window.history.length>1) window.history.back(); else window.location.href='/app'; }}

async function loadItem() {{
  try {{
    const isTV = itemType==='anime'||itemType==='series';
    if (itemType==='franchises') {{
      const cid = String(itemId).replace(/^col_/,'');
      const col = await fetch(BASE+'/collection/'+cid+'?api_key='+TMDB_KEY).then(r=>r.json());
      const parts = (col.parts||[]).filter(p=>p.release_date).sort((a,b)=>a.release_date.localeCompare(b.release_date));
      sel = {{id:itemId,type:'franchises',title:(col.name||'').replace(/ Collection$/i,''),entries:parts.length,desc:col.overview||'',bg:col.backdrop_path?IMG+'w1280'+col.backdrop_path:'',poster:col.poster_path?IMG+'w500'+col.poster_path:'',years:getYR(parts),ratingNum:0,rating:'—'}};
      const dets = await Promise.all(parts.map(p=>fetch(BASE+'/movie/'+p.id+'?api_key='+TMDB_KEY+'&append_to_response=credits').then(r=>r.json()).catch(()=>null)));
      guideEntries = dets.filter(Boolean).sort((a,b)=>(a.release_date||'').localeCompare(b.release_date||'')).map((m,i)=>({{...m,order:i+1,year:(m.release_date||'').slice(0,4),posterUrl:m.poster_path?IMG+'w300'+m.poster_path:'',rating:fmtR(m.vote_average||0),ratingNum:m.vote_average||0,runtime:m.runtime?(Math.floor(m.runtime/60))+'h '+(m.runtime%60)+'m':'N/A',director:(m.credits?.crew||[]).find(c=>c.job==='Director')?.name||'Unknown'}}));
    }} else if (itemType==='movies') {{
      const m = await fetch(BASE+'/movie/'+itemId+'?api_key='+TMDB_KEY+'&append_to_response=credits').then(r=>r.json());
      sel = {{id:itemId,type:'movies',title:m.title||m.original_title||'Unknown',entries:1,desc:m.overview||'',bg:m.backdrop_path?IMG+'w1280'+m.backdrop_path:'',poster:m.poster_path?IMG+'w500'+m.poster_path:'',years:m.release_date?m.release_date.slice(0,4):'N/A',ratingNum:m.vote_average||0,rating:fmtR(m.vote_average||0)}};
      guideEntries = [{{...m,order:1,year:(m.release_date||'').slice(0,4),posterUrl:m.poster_path?IMG+'w300'+m.poster_path:'',rating:fmtR(m.vote_average||0),ratingNum:m.vote_average||0,runtime:m.runtime?(Math.floor(m.runtime/60))+'h '+(m.runtime%60)+'m':'N/A',director:(m.credits?.crew||[]).find(c=>c.job==='Director')?.name||'Unknown'}}];
    }} else if (isTV) {{
      const sd = await fetch(BASE+'/tv/'+itemId+'?api_key='+TMDB_KEY+'&append_to_response=credits').then(r=>r.json());
      const seasons = (sd.seasons||[]).filter(s=>s.season_number>0);
      sel = {{id:+itemId,type:itemType,title:sd.name||sd.original_name||'Unknown',entries:seasons.length,desc:sd.overview||'',bg:sd.backdrop_path?IMG+'w1280'+sd.backdrop_path:'',poster:sd.poster_path?IMG+'w500'+sd.poster_path:'',years:sd.first_air_date?sd.first_air_date.slice(0,4)+(sd.last_air_date&&sd.status!=='Returning Series'?'–'+sd.last_air_date.slice(0,4):'–'):'N/A',status:sd.status||'',ratingNum:sd.vote_average||0,rating:fmtR(sd.vote_average||0)}};
      guideEntries = seasons.map((s,i)=>({{...s,order:i+1,year:(s.air_date||'').slice(0,4),posterUrl:s.poster_path?IMG+'w300'+s.poster_path:(sd.poster_path?IMG+'w300'+sd.poster_path:''),title:s.name||'Season '+s.season_number,overview:s.overview||sd.overview||'',ratingNum:s.vote_average||0,rating:fmtR(s.vote_average||0),runtime:sd.episode_run_time?.[0]?'~'+sd.episode_run_time[0]+'m/ep':'N/A',episode_count:s.episode_count||0}}));
    }}
    document.title = (sel?.title||'')+' · HISTORY · WatchOrder';
    loading = false;
  }} catch(e) {{ console.error(e); error='Could not load.'; loading=false; }}
}}

let acColor = $derived(acC(sel?.type));

onMount(() => {{
  const url = new URL(window.location.href);
  itemType = url.searchParams.get('type')||'';
  itemId = url.searchParams.get('id')||'';
  qs = '?type='+encodeURIComponent(itemType)+'&id='+encodeURIComponent(itemId);
  if (!itemType||!itemId) {{ error='No guide found.'; loading=false; }} else loadItem();
}});
</script>

<GrainOverlay />
<nav class="fixed top-0 w-full z-[500] flex items-center px-[50px] py-4 bg-[rgba(5,5,5,0.95)] backdrop-blur-[16px] border-b border-white/[0.07]">
  <a class="flex items-baseline no-underline" href="/app" onclick={{(e)=>{{e.preventDefault();goBack();}}}}>
    <span class="font-['Cormorant_Garamond'] text-[2.2rem] text-[#c9a84c] font-bold leading-none">W</span>
    <span class="font-['Cormorant_Garamond'] text-[1.6rem] font-light text-[#f0ece4]">atch</span>
    <span class="font-['Cormorant_Garamond'] italic text-[1.6rem] font-semibold opacity-85 text-[#f0ece4]">Order</span>
    <div class="w-[5px] h-[5px] bg-[#c9a84c] rounded-full ml-[5px] shadow-[0_0_8px_#c9a84c]"></div>
  </a>
</nav>

{{#if loading}}
  <div class="min-h-screen flex flex-col items-center justify-center gap-5">
    <Spinner size="lg"/><p class="font-['Space_Mono'] text-[0.78rem] tracking-[0.15em] text-[#c9a84c]">LOADING HISTORY...</p>
  </div>
{{:else if error}}
  <div class="min-h-screen flex flex-col items-center justify-center gap-4 text-center">
    <h2 class="font-['Cormorant_Garamond'] text-5xl opacity-40">404</h2>
    <p class="text-white/50">{{error}}</p>
    <button class="font-['Space_Mono'] text-[0.65rem] border border-white/20 text-white/50 bg-transparent px-6 py-3 rounded-sm cursor-pointer hover:border-[#c9a84c]/40 hover:text-[#c9a84c] transition-all mt-5" onclick={{goBack}}>← BACK</button>
  </div>
{{:else if sel}}
  <main class="pt-[72px]">
    <GuideHero {{sel}} />
    <GuideTabBar type={{sel.type}} {{qs}} active="history" />
    <section class="px-[70px] py-16 pb-[120px] max-w-[1400px] mx-auto">
      <div class="flex items-center gap-3 font-['Space_Mono'] text-[0.68rem] tracking-[0.2em] mb-10" style="color:{{acColor}}">
        <span class="w-9 h-px" style="background:{{acColor}}"></span>HISTORY
      </div>
      {{#each guideEntries as m}}
        <div class="flex overflow-hidden bg-[#0d0d0d] border border-white/[0.05] mb-3 transition-all hover:border-[rgba(201,168,76,0.15)]">
          {{#if m.posterUrl}}<img src={{m.posterUrl}} alt="" loading="lazy" class="w-[72px] object-cover flex-shrink-0 opacity-80"/>{{/if}}
          <div class="flex-1 px-5 py-4">
            <div class="font-['Space_Mono'] text-[0.55rem] mb-1" style="color:{{acColor}}">{{m.order ? '#'+m.order : ''}}</div>
            <h4 class="font-['Cormorant_Garamond'] text-[1.15rem] font-semibold mb-1.5">{{m.title||m.name||''}}</h4>
            <div class="font-['Space_Mono'] text-[0.55rem] text-white/35 flex gap-3 mb-2 flex-wrap">
              {{#if m.runtime}}<span>{{m.runtime}}</span>{{/if}}
              {{#if m.ratingNum>0}}<span>★ {{m.rating}}</span>{{/if}}
              {{#if m.year}}<span>{{m.year}}</span>{{/if}}
            </div>
            <p class="text-[0.76rem] text-white/38 leading-relaxed line-clamp-2">{{(m.overview||'').slice(0,120)}}{{(m.overview||'').length>120?'...':''}}</p>
          </div>
        </div>
      {{/each}}
    </section>
  </main>
{{/if}}
