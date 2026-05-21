<svelte:options runes />

<script>
  // @ts-nocheck
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { browser } from '$app/environment';






  const GENRES = ['Horror','Mystery','Fantasy','Sci-Fi','Romance','Thriller','Adventure','Drama','Comedy','Dark Fantasy','Psychological','Supernatural','Post-Apocalyptic','Historical','Paranormal','Crime','Slice of Life','Action'];

  // ── STATE ──
  let me = $state(null);
  let view = $state('gallery');
  let stories = $state([]);
  let currentStory = $state(null);
  let searchQ = $state('');
  let activeGenre = $state('all');
  let submitting = $state(false);
  let profileCache = $state({});

  // Editor
  let editorTitle = $state('');
  let editorDescription = $state('');
  let editorGenre = $state('');
  let editorContent = $state([{ id: uid(), type: 'paragraph', content: '', align: 'left' }]);
  let editorCoverUrl = $state('');
  let editorCoverPreview = $state('');
  let editingStoryId = $state(null);
  let showToolbar = $state(false);
  let activeBlockId = $state(null);
  let fileInputEl = $state(null);
  let inlineImgInputEl = $state(null);
  let pendingInlineBlockId = $state(null);

  // Read
  let readPage = $state(0);
  let readPages = $state([]);
  let storyComments = $state([]);
  let commentInput = $state('');
  let replyingToId = $state(null);
  let replyInput = $state('');
  let userRating = $state(0);
  let ratingHover = $state(0);
  let hasRated = $state(false);
  let favIds = $state(new Set());
  let myStoryIds = $state(new Set());
  let sortMode = $state('hot');
  let toasts = $state([]);

  // Realtime guard
  let skipRealtimeUntil = 0;

  function uid() { return Math.random().toString(36).slice(2,10); }

  /* ── Rich text helpers ── */
  function setHtml(node, html) {
    if (!browser) return {};
    node.innerHTML = html || '';
    return {
      update(newHtml) {
        const next = newHtml || '';
        if (document.activeElement !== node && node.innerHTML !== next) node.innerHTML = next;
      }
    };
  }
  function sanitizeHtml(html) {
    if (!browser || !html) return html || '';
    const allowed = new Set(['b','i','u','s','strong','em','a','code','br','div','span']);
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_ELEMENT);
    const toRemove = [];
    let el;
    while ((el = walker.nextNode())) {
      const tag = el.tagName.toLowerCase();
      if (!allowed.has(tag)) { toRemove.push(el); continue; }
      [...el.attributes].forEach(a => {
        if (tag === 'a' && a.name === 'href') return;
        el.removeAttribute(a.name);
      });
    }
    toRemove.forEach(el => {
      while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
      el.remove();
    });
    return tmp.innerHTML;
  }
  let fmtBar = $state({ show: false, x: 0, y: 0 });
  function showFmtBar() {
    if (typeof window === 'undefined') return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) { fmtBar.show = false; return; }
    const range = sel.getRangeAt(0);
    const canvas = document.querySelector('.ed-canvas');
    if (!canvas || !canvas.contains(range.commonAncestorContainer)) { fmtBar.show = false; return; }
    const rect = range.getBoundingClientRect();
    fmtBar = { show: true, x: rect.left + rect.width / 2, y: rect.top };
  }
  function fmtCode() {
    if (typeof window === 'undefined') return;
    const txt = window.getSelection().toString();
    if (txt) execFmt('insertHTML', '<code>' + txt + '</code>');
  }
  function addLink() {
    if (!browser) return;
    const url = prompt('URL:');
    if (url) execFmt('createLink', url);
  }
  function execFmt(cmd, val = null) {
    if (!browser) return;
    document.execCommand(cmd, false, val);
    fmtBar.show = false;
    const active = document.activeElement;
    if (active?.closest?.('.bw')) active.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function onPastePlain(e) {
    if (!browser) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }

  function toast(msg, type='info') {
    const id = uid();
    toasts = [...toasts, {id, msg, type}];
    setTimeout(() => { toasts = toasts.filter(t => t.id !== id); }, 3400);
  }

  function initials(n) { return (n||'?').trim().split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?'; }

  function fmtDate(ts) {
    if (!ts) return '';
    const diff = (Date.now() - new Date(ts)) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff/60)+'m ago';
    if (diff < 86400) return Math.floor(diff/3600)+'h ago';
    return new Date(ts).toLocaleDateString(undefined, {month:'short',day:'numeric'});
  }

  function wordCount(blocks) {
    return (blocks||[]).reduce((a,b) => a + (b.content||'').split(/\s+/).filter(Boolean).length, 0);
  }

  function autoDesc(blocks) {
    return (blocks||[]).filter(b=>b.type==='paragraph').map(b=>b.content).join(' ').slice(0,400).trim();
  }

  function hotScore(s) { return (s.avg_rating||0)*0.4 + (s.fav_count||0)*0.6; }

  function getDisplayList() {
    let list = [...stories];
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter(s =>
        s.title?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.genre?.toLowerCase().includes(q) ||
        (profileCache[s.author_id]?.username||'').toLowerCase().includes(q)
      );
    }
    if (activeGenre !== 'all') list = list.filter(s => s.genre === activeGenre);
    if (view === 'myStories') list = list.filter(s => myStoryIds.has(s.id));
    if (view === 'favorites') list = list.filter(s => favIds.has(s.id));
    if (sortMode === 'new') list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    else if (sortMode === 'top') list.sort((a,b) => (b.avg_rating||0) - (a.avg_rating||0));
    else list.sort((a,b) => hotScore(b) - hotScore(a));
    return list;
  }

  // ── SUPABASE ──
  async function boot() {
    if (!browser) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: p } = await supabase.from('profiles').select('id,username,avatar_url').eq('id', session.user.id).single();
        me = { id: session.user.id, username: p?.username || session.user.email?.split('@')[0] || 'user', avatar: p?.avatar_url || null };
      }
      await loadStories();
      if (me) await loadMyData();
    } catch(e) {
      console.error('boot error', e);
    }
  }

  async function loadStories() {
    try {
      const { data, error } = await supabase.from('stories').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      stories = data || [];
      const ids = [...new Set((data||[]).map(s=>s.author_id).filter(id => id && !profileCache[id]))];
      if (ids.length) await fetchProfiles(ids);
    } catch(e) {
      console.error('loadStories', e);
    }
  }

  async function fetchProfiles(ids) {
    if (!ids.length) return;
    const { data } = await supabase.from('profiles').select('id,username,avatar_url').in('id', ids);
    const map = {};
    (data||[]).forEach(p => { map[p.id] = p; });
    profileCache = { ...profileCache, ...map };
  }

  async function loadMyData() {
    if (!me) return;
    const [{ data: favs }, { data: mine }] = await Promise.all([
      supabase.from('story_favorites').select('story_id').eq('user_id', me.id),
      supabase.from('stories').select('id').eq('author_id', me.id)
    ]);
    favIds = new Set((favs||[]).map(x => x.story_id));
    myStoryIds = new Set((mine||[]).map(x => x.id));
  }

  async function loadStoryComments(storyId) {
    const { data } = await supabase.from('story_comments').select('*').eq('story_id', storyId).order('created_at', { ascending: true });
    storyComments = data || [];
    const ids = [...new Set((data||[]).map(c=>c.user_id).filter(Boolean))];
    if (ids.length) await fetchProfiles(ids);
  }

  async function checkUserRating(storyId) {
    if (!me) return;
    const { data } = await supabase.from('story_ratings').select('rating').eq('story_id', storyId).eq('user_id', me.id).maybeSingle();
    if (data) { userRating = data.rating; hasRated = true; }
    else { userRating = 0; hasRated = false; }
  }

  async function submitRating(val) {
    if (!me) { toast('Sign in to rate','warn'); return; }
    if (currentStory?.author_id === me.id) { toast("You can't rate your own story",'warn'); return; }
    if (hasRated) { toast('Already rated','warn'); return; }
    await supabase.from('story_ratings').upsert({ story_id: currentStory.id, user_id: me.id, rating: val });
    userRating = val; hasRated = true;
    const { data } = await supabase.from('story_ratings').select('rating').eq('story_id', currentStory.id);
    const avg = data?.length ? data.reduce((a,r) => a+r.rating, 0)/data.length : 0;
    await supabase.from('stories').update({ avg_rating: avg, rating_count: data?.length||0 }).eq('id', currentStory.id);
    stories = stories.map(s => s.id===currentStory.id ? {...s, avg_rating:avg, rating_count:data?.length||0} : s);
    currentStory = {...currentStory, avg_rating:avg, rating_count:data?.length||0};
    toast('Rated!','success');
  }

  async function toggleFav(storyId) {
    if (!me) { toast('Sign in to favorite','warn'); return; }
    skipRealtimeUntil = Date.now() + 3000;
    const already = favIds.has(storyId);
    // Optimistic update
    if (already) {
      favIds.delete(storyId); favIds = new Set(favIds);
      stories = stories.map(s => s.id===storyId ? {...s, fav_count: Math.max(0,(s.fav_count||1)-1)} : s);
      if (currentStory?.id === storyId) currentStory = {...currentStory, fav_count: Math.max(0,(currentStory.fav_count||1)-1)};
      await supabase.from('story_favorites').delete().eq('story_id', storyId).eq('user_id', me.id);
    } else {
      favIds.add(storyId); favIds = new Set(favIds);
      stories = stories.map(s => s.id===storyId ? {...s, fav_count: (s.fav_count||0)+1} : s);
      if (currentStory?.id === storyId) currentStory = {...currentStory, fav_count: (currentStory.fav_count||0)+1};
      await supabase.from('story_favorites').insert({ story_id: storyId, user_id: me.id });
    }
    // Sync DB count
    const { data: favRows } = await supabase.from('story_favorites').select('id', { count: 'exact' }).eq('story_id', storyId);
    const newCount = favRows?.length || 0;
    await supabase.from('stories').update({ fav_count: newCount }).eq('id', storyId);
    stories = stories.map(s => s.id===storyId ? {...s, fav_count: newCount} : s);
    if (currentStory?.id === storyId) currentStory = {...currentStory, fav_count: newCount};
  }

  async function submitComment(parentId=null) {
    if (!me) { toast('Sign in to comment','warn'); return; }
    const text = parentId ? replyInput : commentInput;
    if (!text.trim()) return;
    const { data: inserted } = await supabase.from('story_comments').insert({
      story_id: currentStory.id, user_id: me.id, content: text.trim(), parent_id: parentId||null
    }).select().single();
    if (inserted) {
      storyComments = [...storyComments, inserted];
      profileCache = { ...profileCache, [me.id]: { username: me.username, avatar_url: me.avatar } };
      if (parentId) { replyInput=''; replyingToId=null; }
      else commentInput='';
    }
  }

  async function deleteStory(id) {
    if (!confirm('Delete this story?')) return;
    skipRealtimeUntil = Date.now() + 3000;
    await supabase.from('stories').delete().eq('id', id);
    stories = stories.filter(s => s.id!==id);
    myStoryIds.delete(id); myStoryIds = new Set(myStoryIds);
    toast('Deleted','info');
    if (view==='read') { view='gallery'; currentStory=null; }
  }

  // ── EDITOR ──
  function newStory() {
    editingStoryId = null;
    editorTitle=''; editorDescription=''; editorGenre='';
    editorCoverUrl=''; editorCoverPreview='';
    editorContent=[{ id:uid(), type:'paragraph', content:'', align:'left' }];
    showToolbar=false;
    view='editor';
  }

  function editStory(story) {
    editingStoryId = story.id;
    editorTitle = story.title||'';
    editorDescription = story.description||'';
    editorGenre = story.genre||'';
    editorCoverUrl = story.cover_url||'';
    editorCoverPreview = story.cover_url||'';
    editorContent = (story.blocks?.length ? story.blocks : [{ id:uid(), type:'paragraph', content:'', align:'left' }]);
    showToolbar=false;
    view='editor';
  }

  function navigateTo(target) {
    // Always allow navigation away from editor without losing the edit session
    // But we only change the visual view
    if (view === 'editor') {
      // Save a draft marker — just switch view, editor state persists in $state
    }
    view = target;
  }

  function addBlock(type) {
    const b = { id:uid(), type, content:'', align:'left' };
    if (type==='image') b.src='';
    if (type==='divider') b.style='ornate';
    if (type==='quote') b.author='';
    if (type==='callout') b.icon='📖';
    if (type==='heading') b.level=2;
    if (type==='columns') { b.left=''; b.right=''; }
    if (type==='stats') b.items=[{label:'Stat',value:'?'}];
    if (type==='timeline') b.date='';
    if (type==='dialogue') b.speaker='';
    if (type==='chapter') b.num='I';
    if (type==='document') b.body='';
    editorContent = [...editorContent, b];
    showToolbar=false;
  }

  function removeBlock(id) { editorContent = editorContent.filter(b=>b.id!==id); }

  function moveBlock(id, dir) {
    const arr = [...editorContent];
    const i = arr.findIndex(b=>b.id===id);
    if (i<0) return;
    const j = dir==='up' ? i-1 : i+1;
    if (j<0||j>=arr.length) return;
    [arr[i],arr[j]]=[arr[j],arr[i]];
    editorContent = arr;
  }

  function updateBlock(id, key, val) {
    const idx = editorContent.findIndex(b => b.id === id);
    if (idx !== -1) { editorContent[idx][key] = val; editorContent = editorContent; }
  }

  function handleCoverUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { editorCoverPreview=ev.target.result; editorCoverUrl=ev.target.result; };
    reader.readAsDataURL(file);
  }

  function handleInlineImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !pendingInlineBlockId) return;
    const reader = new FileReader();
    reader.onload = ev => updateBlock(pendingInlineBlockId, 'src', ev.target.result);
    reader.readAsDataURL(file);
    e.target.value='';
  }

  async function publishStory() {
    if (!me) { toast('Sign in first','warn'); return; }
    if (!editorTitle.trim()) { toast('Add a title','warn'); return; }
    if (!editorGenre) { toast('Pick a genre','warn'); return; }
    const hasContent = editorContent.some(b => b.content?.trim()||b.src||b.left||b.right||b.body);
    if (!hasContent) { toast('Write something first!','warn'); return; }
    submitting=true;
    skipRealtimeUntil = Date.now() + 5000;
    const desc = editorDescription.trim() || autoDesc(editorContent);
    const wc = wordCount(editorContent);
    const payload = {
      title: editorTitle.trim(),
      description: desc,
      genre: editorGenre,
      cover_url: editorCoverUrl||null,
      blocks: editorContent,
      author_id: me.id,
      word_count: wc,
    };
    try {
      if (editingStoryId) {
        const { data, error } = await supabase.from('stories').update(payload).eq('id', editingStoryId).select().single();
        if (error) throw error;
        // Update in local list immediately
        stories = stories.map(s => s.id===editingStoryId ? {...s, ...data} : s);
        toast('Story updated!','success');
      } else {
        const { data, error } = await supabase.from('stories').insert({...payload, avg_rating:0, rating_count:0, fav_count:0, view_count:0}).select().single();
        if (error) throw error;
        if (data) {
          // Prepend to local stories immediately — don't wait for realtime
          stories = [data, ...stories];
          myStoryIds.add(data.id);
          myStoryIds = new Set(myStoryIds);
          // Cache author profile
          profileCache = { ...profileCache, [me.id]: { id:me.id, username:me.username, avatar_url:me.avatar } };
        }
        toast('Published!','success');
      }
      view='gallery';
    } catch(e) {
      console.error('publish', e);
      toast('Error: '+(e.message||'unknown'),'warn');
    } finally {
      submitting=false;
    }
  }

  // ── READ ──
  async function openStory(story) {
    currentStory = story;
    readPage=0;
    readPages = paginateBlocks(story.blocks||[]);
    userRating=0; ratingHover=0; hasRated=false;
    await Promise.all([loadStoryComments(story.id), checkUserRating(story.id)]);
    view='read';
    supabase.from('stories').update({ view_count:(story.view_count||0)+1 }).eq('id', story.id);
    stories = stories.map(s => s.id===story.id ? {...s, view_count:(s.view_count||0)+1} : s);
  }

  function paginateBlocks(blocks) {
    const pages = [[]]; let wc=0;
    for (const b of blocks) {
      const bwc=(b.content||'').split(/\s+/).filter(Boolean).length;
      if (wc+bwc>600 && pages[pages.length-1].length>0) { pages.push([]); wc=0; }
      pages[pages.length-1].push(b); wc+=bwc;
    }
    return pages.filter(p=>p.length>0);
  }

  function topComments() { return storyComments.filter(c=>!c.parent_id); }
  function childComments(pid) { return storyComments.filter(c=>c.parent_id===pid); }

  // ── REALTIME ──
  let realtimeCh;
  function subscribeRealtime() {
    if (!browser) return;
    realtimeCh?.unsubscribe();
    realtimeCh = supabase.channel('stories-rt-'+Math.random())
      .on('postgres_changes', { event:'*', schema:'public', table:'stories' }, () => {
        if (Date.now() < skipRealtimeUntil) return;
        loadStories();
      })
      .subscribe();
  }

  onMount(() => {
    boot().then(() => subscribeRealtime());
  });

  onDestroy(() => { realtimeCh?.unsubscribe(); });
</script>

<div class="grain"></div>

<!-- TOASTS -->
<div class="toasts">
  {#each toasts as t (t.id)}
    <div class="toast toast-{t.type}">{t.msg}</div>
  {/each}
</div>

<!-- ══ NAV ══ -->
<nav class="nav">
  <button class="nav-logo" onclick={() => view='gallery'}>
    <span class="logo-s">S</span><span class="logo-rest">criptorium</span><div class="logo-pip"></div>
  </button>

  <div class="nav-center">
    {#if view !== 'editor'}
      <div class="search-wrap">
        <svg class="si" width="13" height="13" viewBox="0 0 14 14" fill="none">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.3"/>
          <path d="M10 10l2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        <input class="search-in" placeholder="Search stories, genres, authors…" bind:value={searchQ} />
      </div>
    {:else}
      <div class="editor-breadcrumb">
        <span class="eb-back" onclick={() => view='gallery'}>← Gallery</span>
        <span class="eb-sep">›</span>
        <span class="eb-cur">{editingStoryId ? 'Editing' : 'New Story'}</span>
        {#if editorTitle}<span class="eb-title">· {editorTitle}</span>{/if}
      </div>
    {/if}
  </div>

  <div class="nav-r">
    {#if me}
      <button class="nt {view==='gallery'?'nt-on':''}" onclick={() => view='gallery'}>Browse</button>
      <button class="nt {view==='myStories'?'nt-on':''}" onclick={() => view='myStories'}>My Stories</button>
      <button class="nt {view==='favorites'?'nt-on':''}" onclick={() => view='favorites'}>Favorites</button>
      <button class="write-btn" onclick={newStory}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Write
      </button>
      <div class="nav-av" title={me.username}>
        {#if me.avatar}
          <img src={me.avatar} alt={me.username} class="nav-av-img" referrerpolicy="no-referrer"/>
        {:else}
          {initials(me.username)}
        {/if}
      </div>
    {:else}
      <a href="/signin" class="write-btn">Sign In</a>
    {/if}
  </div>
</nav>

<!-- ══════════ VIEWS ══════════ -->

{#if view === 'editor'}
<!-- ━━━━━━ EDITOR ━━━━━━ -->
<div class="editor-layout">
  <aside class="ed-sidebar">
    <div class="eds-top">
      <div class="eds-field">
        <label class="eds-label">TITLE <span class="req">✦</span></label>
        <input class="eds-input" placeholder="Your story's name…" bind:value={editorTitle}/>
      </div>
      <div class="eds-field">
        <label class="eds-label">GENRE <span class="req">✦</span></label>
        <div class="gp-wrap">
          {#each GENRES as g}
            <button class="gp {editorGenre===g?'gp-on':''}" onclick={() => editorGenre=g}>{g}</button>
          {/each}
        </div>
      </div>
      <div class="eds-field">
        <label class="eds-label">DESCRIPTION <span class="eds-opt">optional</span></label>
        <textarea class="eds-ta" rows="3" placeholder="Brief synopsis — auto-filled from story if blank" bind:value={editorDescription}></textarea>
      </div>
      <div class="eds-field">
        <label class="eds-label">COVER IMAGE</label>
        {#if editorCoverPreview}
          <div class="cover-prev">
            <img src={editorCoverPreview} alt="cover"/>
            <button class="cover-rm" onclick={() => {editorCoverPreview='';editorCoverUrl='';}}>✕</button>
          </div>
        {:else}
          <button class="cover-upload" onclick={() => fileInputEl?.click()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9l4-4 4 4 5-5 5 5"/><circle cx="8.5" cy="13.5" r="1.5"/></svg>
            Upload Cover
          </button>
          <input bind:this={fileInputEl} type="file" accept="image/*" style="display:none" onchange={handleCoverUpload}/>
        {/if}
      </div>
    </div>
    <div class="eds-meta">
      <span>{wordCount(editorContent)} words</span>
      <span>{editorContent.length} blocks</span>
    </div>
    <button class="pub-btn" disabled={submitting} onclick={publishStory}>
      {#if submitting}<span class="spin-s"></span>{/if}
      {editingStoryId ? '✦ Update Story' : '✦ Publish Story'}
    </button>
  </aside>

  <div class="ed-canvas" onmouseup={showFmtBar}>
    <div class="canvas-body">
      <!-- Cover banner -->
      {#if editorCoverPreview}
        <div class="cv-banner" style="background-image:url({editorCoverPreview})">
          <div class="cv-grad"></div>
          <h1 class="cv-title">{editorTitle||'Untitled'}</h1>
        </div>
      {:else}
        <div class="cv-plain">
          <input class="cv-title-input" placeholder="Your Story Title…" bind:value={editorTitle}/>
          {#if editorGenre}<div class="cv-genre-badge">{editorGenre}</div>{/if}
        </div>
      {/if}

      <!-- BLOCKS -->
      {#each editorContent as block (block.id)}
        <!-- KEY: outer div has big padding so hover zone is wide enough to reach controls -->
        <div
          class="bw"
          role="group"
          data-bid={block.id}
          onmouseenter={() => activeBlockId=block.id}
          onmouseleave={() => activeBlockId=null}
        >
          <!-- Controls — positioned inside bw, so hover on them keeps activeBlockId set -->
          <div class="bc {activeBlockId===block.id?'bc-on':''}">
            <button class="bc-b" title="Up" onclick={() => moveBlock(block.id,'up')}>↑</button>
            <button class="bc-b" title="Down" onclick={() => moveBlock(block.id,'down')}>↓</button>
            <button class="bc-b bc-x" title="Remove" onclick={() => removeBlock(block.id)}>✕</button>
          </div>

          {#if block.type==='paragraph'}
            <div class="ba {activeBlockId===block.id?'ba-on':''}">
              {#each ['left','center','right','justify'] as a}
                <button class="ba-b {block.align===a?'ba-b-on':''}" onclick={() => updateBlock(block.id,'align',a)}>{a[0].toUpperCase()}</button>
              {/each}
            </div>
            <div
              class="b-para"
              style="text-align:{block.align||'left'}"
              contenteditable="true"
              data-placeholder="Begin your tale…"
              use:setHtml={block.content}
              oninput={(e)=>updateBlock(block.id,'content',e.currentTarget.innerHTML)}
              onblur={(e)=>updateBlock(block.id,'content',e.currentTarget.innerHTML)}
              onpaste={onPastePlain}
            ></div>

          {:else if block.type==='heading'}
            <div class="bh-wrap">
              <select class="bh-sel" onchange={(e)=>updateBlock(block.id,'level',+e.target.value)}>
                {#each [1,2,3] as lv}<option value={lv} selected={block.level===lv}>H{lv}</option>{/each}
              </select>
              <div class="b-heading h{block.level||2}" contenteditable="true" data-placeholder="Heading…" bind:innerText={block.content}></div>
            </div>

          {:else if block.type==='quote'}
            <div class="b-quote">
              <span class="bq-glyph">"</span>
              <div class="bq-txt" contenteditable="true" data-placeholder="A memorable quote…" use:setHtml={block.content} oninput={(e)=>updateBlock(block.id,'content',e.currentTarget.innerHTML)} onblur={(e)=>updateBlock(block.id,'content',e.currentTarget.innerHTML)} onpaste={onPastePlain}></div>
              <div class="bq-attr" contenteditable="true" data-placeholder="— Attribution" bind:innerText={block.author}></div>
            </div>

          {:else if block.type==='image'}
            <div class="b-img-wrap">
              {#if block.src}
                <img class="b-img" src={block.src} alt=""/>
                <button class="b-img-chg" onclick={() => {pendingInlineBlockId=block.id; inlineImgInputEl?.click();}}>Change</button>
              {:else}
                <button class="b-img-up" onclick={() => {pendingInlineBlockId=block.id; inlineImgInputEl?.click();}}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9l4-4 4 4 5-5 5 5"/></svg>
                  Insert Image
                </button>
              {/if}
              <input class="b-img-cap" placeholder="Caption…" bind:value={block.content}/>
            </div>

          {:else if block.type==='divider'}
            <div class="b-div-wrap">
              <select class="b-div-sel" onchange={(e)=>updateBlock(block.id,'style',e.target.value)}>
                {#each ['ornate','line','dots','asterisk','runic'] as s}<option value={s} selected={block.style===s}>{s}</option>{/each}
              </select>
              <div class="b-divider">
                {#if !block.style||block.style==='ornate'}❦ · ❦
                {:else if block.style==='dots'}• • •
                {:else if block.style==='asterisk'}* * *
                {:else if block.style==='runic'}ᚦ ᚱ ᚢ ᚦ
                {:else}<hr class="b-hr"/>{/if}
              </div>
            </div>

          {:else if block.type==='callout'}
            <div class="b-callout">
              <div class="bcl-icon" contenteditable="true" bind:innerText={block.icon}></div>
              <div class="bcl-txt" contenteditable="true" data-placeholder="Callout text…" use:setHtml={block.content} oninput={(e)=>updateBlock(block.id,'content',e.currentTarget.innerHTML)} onblur={(e)=>updateBlock(block.id,'content',e.currentTarget.innerHTML)} onpaste={onPastePlain}></div>
            </div>

          {:else if block.type==='letter'}
            <div class="b-letter">
              <div class="bl-txt" contenteditable="true" data-placeholder="Dear reader…" use:setHtml={block.content} oninput={(e)=>updateBlock(block.id,'content',e.currentTarget.innerHTML)} onblur={(e)=>updateBlock(block.id,'content',e.currentTarget.innerHTML)} onpaste={onPastePlain}></div>
            </div>

          {:else if block.type==='redacted'}
            <div class="b-redacted">
              <div class="br-txt" contenteditable="true" data-placeholder="[CLASSIFIED]" bind:innerText={block.content}></div>
              <div class="br-bar">████████████████</div>
            </div>

          {:else if block.type==='document'}
            <div class="b-doc">
              <div class="bdoc-hd">
                <div class="bdoc-stamp">CLASSIFIED</div>
                <div class="bdoc-title" contenteditable="true" data-placeholder="Document Title" bind:innerText={block.content}></div>
              </div>
              <textarea class="bdoc-body" placeholder="Document contents…" bind:value={block.body}></textarea>
            </div>

          {:else if block.type==='dialogue'}
            <div class="b-dialogue">
              <div class="bdl-spk" contenteditable="true" data-placeholder="Character Name" bind:innerText={block.speaker}></div>
              <div class="bdl-txt" contenteditable="true" data-placeholder='"What they said…"' use:setHtml={block.content} oninput={(e)=>updateBlock(block.id,'content',e.currentTarget.innerHTML)} onblur={(e)=>updateBlock(block.id,'content',e.currentTarget.innerHTML)} onpaste={onPastePlain}></div>
            </div>

          {:else if block.type==='timeline'}
            <div class="b-tl">
              <div class="btl-dt" contenteditable="true" data-placeholder="Date / Era" oninput={(e)=>updateBlock(block.id,'date',e.currentTarget.innerText)}>{block.date||''}</div>
              <div class="btl-pip"></div>
              <div class="btl-ev" contenteditable="true" data-placeholder="What happened…" oninput={(e)=>updateBlock(block.id,'content',e.currentTarget.innerText)}>{block.content}</div>
            </div>

          {:else if block.type==='warning'}
            <div class="b-warn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div contenteditable="true" data-placeholder="Content warning…" use:setHtml={block.content} oninput={(e)=>updateBlock(block.id,'content',e.currentTarget.innerHTML)} onblur={(e)=>updateBlock(block.id,'content',e.currentTarget.innerHTML)} onpaste={onPastePlain}></div>
            </div>

          {:else if block.type==='columns'}
            <div class="b-cols">
              <div class="bcol" contenteditable="true" data-placeholder="Left column…" bind:innerText={block.left}></div>
              <div class="bcol-sep"></div>
              <div class="bcol" contenteditable="true" data-placeholder="Right column…" bind:innerText={block.right}></div>
            </div>

          {:else if block.type==='codeblock'}
            <div class="b-code">
              <div class="bcode-hd">CODE</div>
              <textarea class="bcode-body" placeholder="// write your code…" bind:value={block.content}></textarea>
            </div>

          {:else if block.type==='poem'}
            <div class="b-poem">
              <div contenteditable="true" data-placeholder="Verse…" class="bpoem-txt" use:setHtml={block.content} oninput={(e)=>updateBlock(block.id,'content',e.currentTarget.innerHTML)} onblur={(e)=>updateBlock(block.id,'content',e.currentTarget.innerHTML)} onpaste={onPastePlain}></div>
            </div>

          {:else if block.type==='map'}
            <div class="b-map">
              <div contenteditable="true" class="bmap-lbl" data-placeholder="Describe this place…" use:setHtml={block.content} oninput={(e)=>updateBlock(block.id,'content',e.currentTarget.innerHTML)} onblur={(e)=>updateBlock(block.id,'content',e.currentTarget.innerHTML)} onpaste={onPastePlain}></div>
              <svg class="bmap-deco" viewBox="0 0 200 80" width="180" height="70" opacity="0.18"><path d="M10 50 L40 20 L70 40 L100 10 L140 35 L175 20" stroke="#c9a84c" stroke-width="2" fill="none" stroke-dasharray="5 3"/><circle cx="40" cy="20" r="3.5" fill="#c9a84c"/><circle cx="100" cy="10" r="3.5" fill="#c9a84c"/><circle cx="140" cy="35" r="3.5" fill="#c9a84c"/></svg>
            </div>

          {:else if block.type==='chapter'}
            <div class="b-chapter">
              <div class="bch-lbl">CHAPTER</div>
              <div class="bch-num" contenteditable="true" bind:innerText={block.num}></div>
              <div class="bch-title" contenteditable="true" data-placeholder="Chapter Title" bind:innerText={block.content}></div>
            </div>

          {:else if block.type==='highlight'}
            <div class="b-hl">
              <div class="bhl-bar"></div>
              <div contenteditable="true" data-placeholder="Highlighted passage…" class="bhl-txt" use:setHtml={block.content} oninput={(e)=>updateBlock(block.id,'content',e.currentTarget.innerHTML)} onblur={(e)=>updateBlock(block.id,'content',e.currentTarget.innerHTML)} onpaste={onPastePlain}></div>
            </div>

          {:else if block.type==='stats'}
            <div class="b-stats">
              <div class="bst-grid">
                {#each (block.items||[]) as item, si}
                  <div class="bst-cell">
                    <div class="bst-v" contenteditable="true" bind:innerText={item.value}></div>
                    <div class="bst-l" contenteditable="true" bind:innerText={item.label}></div>
                  </div>
                {/each}
              </div>
              <button class="bst-add" onclick={()=>updateBlock(block.id,'items',[...(block.items||[]),{label:'Stat',value:'?'}])}>+ Add</button>
            </div>
          {/if}
        </div>
      {/each}

      <!-- Add Block -->
      <div class="add-row">
        <button class="add-tog" onclick={()=>showToolbar=!showToolbar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {showToolbar ? 'Close' : 'Add Block'}
        </button>
      </div>

      {#if showToolbar}
        <div class="btoolbar">
          {#each [
            ['paragraph','¶ Paragraph'],['heading','Hx Heading'],['quote','❝ Quote'],
            ['image','🖼 Image'],['divider','— Divider'],['callout','📢 Callout'],
            ['letter','✉ Letter'],['redacted','█ Redacted'],['document','📄 Document'],
            ['dialogue','💬 Dialogue'],['timeline','⏱ Timeline'],['warning','⚠ Warning'],
            ['columns','⫸ Two Columns'],['codeblock','</> Code'],['poem','✦ Poem'],
            ['map','🗺 Map'],['chapter','📖 Chapter'],['highlight','🔆 Highlight'],
            ['stats','📊 Stats Block']
          ] as [t,l]}
            <button class="bb" onclick={()=>addBlock(t)}>{l}</button>
          {/each}
        </div>
      {/if}

      <!-- hidden inline image input -->
      <input bind:this={inlineImgInputEl} type="file" accept="image/*" style="display:none" onchange={handleInlineImageUpload}/>
    </div>
  </div>

  <!-- Floating format toolbar -->
  {#if browser && fmtBar.show}
    <div class="fmt-bar" style="left:{fmtBar.x}px;top:{fmtBar.y}px;transform:translate(-50%,-120%)">
      <button class="fmt-b" title="Bold" onclick={()=>execFmt('bold')}><b>B</b></button>
      <button class="fmt-b" title="Italic" onclick={()=>execFmt('italic')}><i>I</i></button>
      <button class="fmt-b" title="Underline" onclick={()=>execFmt('underline')}><u>U</u></button>
      <button class="fmt-b" title="Strikethrough" onclick={()=>execFmt('strikeThrough')}><s>S</s></button>
      <div class="fmt-sep"></div>
      <button class="fmt-b" title="Code" onclick={fmtCode}>&lt;/&gt;</button>
      <button class="fmt-b" title="Link" onclick={addLink}>🔗</button>
    </div>
  {/if}
</div>

{:else if view === 'read' && currentStory}
<!-- ━━━━━━ READ ━━━━━━ -->
<div class="read-layout">
  <div class="read-main">
    <div class="rh" style={currentStory.cover_url?`background-image:url(${currentStory.cover_url})`:'background:#0e0b07'}>
      <div class="rh-ov"></div>
      <div class="rh-body">
        <button class="rh-back" onclick={()=>{view='gallery';currentStory=null;}}>← Back</button>
        <div class="rh-genre">{currentStory.genre||'Story'}</div>
        <h1 class="rh-title">{currentStory.title}</h1>
        <div class="rh-meta">
          {#if currentStory.author_id}
            {@const p=profileCache[currentStory.author_id]}
            <div class="rh-author">
              {#if p?.avatar_url}<img src={p.avatar_url} class="rh-av-img" alt={p.username} referrerpolicy="no-referrer"/>
              {:else}<div class="rh-av">{initials(p?.username||'U')}</div>{/if}
              <span>@{p?.username||'Unknown'}</span>
            </div>
          {/if}
          <span class="dot">·</span><span>{currentStory.word_count||0} words</span>
          <span class="dot">·</span><span>{fmtDate(currentStory.created_at)}</span>
          <span class="dot">·</span><span>{currentStory.view_count||0} reads</span>
        </div>
        {#if currentStory.description}<p class="rh-desc">{currentStory.description}</p>{/if}
        <div class="rh-acts">
          <button class="ra-btn {favIds.has(currentStory.id)?'ra-fav':''}" onclick={()=>toggleFav(currentStory.id)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill={favIds.has(currentStory.id)?'#e05c7a':'none'} stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            {favIds.has(currentStory.id)?'Saved':'Favorite'}
          </button>
          {#if me && currentStory.author_id===me.id}
            <button class="ra-btn" onclick={()=>editStory(currentStory)}>Edit</button>
            <button class="ra-btn ra-del" onclick={()=>deleteStory(currentStory.id)}>Delete</button>
          {/if}
        </div>
      </div>
    </div>

    <!-- Rating strip -->
    {#if me && currentStory.author_id!==me.id}
      <div class="rate-bar">
        <span class="rate-lbl">Rate this story</span>
        <div class="rate-stars">
          {#each [1,2,3,4,5] as s}
            <button class="rstar {s<=(ratingHover||userRating)?'rstar-on':''} {hasRated?'rstar-done':''}"
              onmouseenter={()=>!hasRated&&(ratingHover=s)}
              onmouseleave={()=>ratingHover=0}
              onclick={()=>submitRating(s)}>★</button>
          {/each}
        </div>
        <span class="rate-info">★ {currentStory.avg_rating?currentStory.avg_rating.toFixed(1):'—'} · {currentStory.rating_count||0} ratings</span>
      </div>
    {:else}
      <div class="rate-bar rate-info-bar">
        <span>★ {currentStory.avg_rating?currentStory.avg_rating.toFixed(1):'—'}</span>
        <span class="dot">·</span><span>{currentStory.rating_count||0} ratings</span>
        <span class="dot">·</span><span>♥ {currentStory.fav_count||0}</span>
      </div>
    {/if}

    <!-- Content -->
    <div class="story-body">
      {#if readPages.length===0}
        <p class="s-empty">No content yet.</p>
      {:else}
        {#each (readPages[readPage]||[]) as block (block.id)}
          {#if block.type==='paragraph'}
            <p class="s-p" style="text-align:{block.align||'left'}">{@html block.content}</p>
          {:else if block.type==='heading'}
            <div class="s-h s-h{block.level||2}">{block.content}</div>
          {:else if block.type==='quote'}
            <blockquote class="s-bq"><span class="s-bq-m">"</span><span class="s-bq-t">{@html block.content}</span>{#if block.author}<cite class="s-bq-c">— {block.author}</cite>{/if}</blockquote>
          {:else if block.type==='image'}
            <figure class="s-fig">{#if block.src}<img class="s-img" src={block.src} alt={block.content||''}/>{/if}{#if block.content}<figcaption class="s-cap">{block.content}</figcaption>{/if}</figure>
          {:else if block.type==='divider'}
            <div class="s-div">{#if !block.style||block.style==='ornate'}❦ · ❦{:else if block.style==='dots'}• • •{:else if block.style==='asterisk'}* * *{:else if block.style==='runic'}ᚦ ᚱ ᚢ ᚦ{:else}<hr/>{/if}</div>
          {:else if block.type==='callout'}
            <div class="s-callout"><span>{block.icon||'📖'}</span><span>{@html block.content}</span></div>
          {:else if block.type==='letter'}
            <div class="s-letter">{@html block.content}</div>
          {:else if block.type==='redacted'}
            <div class="s-red"><span>{block.content}</span><span class="s-red-bar">████████████</span></div>
          {:else if block.type==='document'}
            <div class="s-doc"><div class="s-doc-hd"><div class="s-doc-stamp">CLASSIFIED</div><div class="s-doc-t">{block.content}</div></div><div class="s-doc-b">{block.body||''}</div></div>
          {:else if block.type==='dialogue'}
            <div class="s-dl"><div class="s-dl-spk">{block.speaker||''}</div><div class="s-dl-txt">"{@html block.content}"</div></div>
          {:else if block.type==='timeline'}
            <div class="s-tl"><div class="s-tl-dt">{block.date||''}</div><div class="s-tl-pip"></div><div class="s-tl-ev">{block.content}</div></div>
          {:else if block.type==='warning'}
            <div class="s-warn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span>{@html block.content}</span></div>
          {:else if block.type==='columns'}
            <div class="s-cols"><div class="s-col">{block.left}</div><div class="s-col-sep"></div><div class="s-col">{block.right}</div></div>
          {:else if block.type==='codeblock'}
            <pre class="s-code">{block.content}</pre>
          {:else if block.type==='poem'}
            <div class="s-poem">{@html block.content}</div>
          {:else if block.type==='map'}
            <div class="s-map"><div class="s-map-lbl">{@html block.content}</div></div>
          {:else if block.type==='chapter'}
            <div class="s-ch"><div class="s-ch-lbl">CHAPTER</div><div class="s-ch-num">{block.num||'I'}</div><div class="s-ch-t">{block.content}</div></div>
          {:else if block.type==='highlight'}
            <div class="s-hl"><div class="s-hl-bar"></div><div>{@html block.content}</div></div>
          {:else if block.type==='stats'}
            <div class="s-stats">{#each (block.items||[]) as item}<div class="s-st"><div class="s-st-v">{item.value}</div><div class="s-st-l">{item.label}</div></div>{/each}</div>
          {/if}
        {/each}
      {/if}
    </div>

    {#if readPages.length>1}
      <div class="pg-row">
        <button class="pg-btn" disabled={readPage===0} onclick={()=>{readPage--;scrollTo({top:0,behavior:'smooth'});}}>← Prev</button>
        <div class="pg-dots">
          {#each readPages as _,i}
            <button class="pg-dot {i===readPage?'pg-dot-on':''}" onclick={()=>{readPage=i;scrollTo({top:0,behavior:'smooth'});}}></button>
          {/each}
        </div>
        <span class="pg-info">Page {readPage+1} / {readPages.length}</span>
        <button class="pg-btn" disabled={readPage>=readPages.length-1} onclick={()=>{readPage++;scrollTo({top:0,behavior:'smooth'});}}>Next →</button>
      </div>
    {/if}
  </div>

  <!-- Comments sidebar -->
  <aside class="cm-sidebar">
    <div class="cms-hd">
      <div class="cms-hd-line"></div>
      <span>Discussion</span>
      <span class="cms-ct">{storyComments.length}</span>
    </div>

    {#if me}
      <div class="cms-compose">
        <div class="cms-av">
          {#if me.avatar}<img src={me.avatar} class="cms-av-img" alt={me.username} referrerpolicy="no-referrer"/>
          {:else}{initials(me.username)}{/if}
        </div>
        <div class="cms-inp-wrap">
          <textarea class="cms-ta" rows="2" placeholder="Share your thoughts on this story…" bind:value={commentInput}></textarea>
          <div class="cms-compose-bar">
            <span class="cms-hint">Markdown supported</span>
            <button class="cms-post" onclick={()=>submitComment()}>Post Comment</button>
          </div>
        </div>
      </div>
    {:else}
      <a href="/signin" class="cms-signin">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        Sign in to join the discussion
      </a>
    {/if}

    <div class="cms-list">
      {#each topComments() as c (c.id)}
        {@const cp=profileCache[c.user_id]}
        <div class="cmt" class:cmt-replying={replyingToId===c.id}>
          <!-- thread line -->
          <div class="cmt-thread">
            <div class="cmt-thread-line"></div>
          </div>

          <div class="cmt-av-wrap">
            <div class="cmt-av">{#if cp?.avatar_url}<img src={cp.avatar_url} class="cmt-av-img" alt="" referrerpolicy="no-referrer"/>{:else}{initials(cp?.username||'U')}{/if}</div>
          </div>

          <div class="cmt-body">
            <div class="cmt-hd">
              <span class="cmt-name">{cp?.username||'User'}</span>
              {#if currentStory.author_id === c.user_id}<span class="cmt-badge">Author</span>{/if}
              <span class="cmt-dot">·</span>
              <span class="cmt-time">{fmtDate(c.created_at)}</span>
            </div>
            <p class="cmt-txt">{c.content}</p>

            <div class="cmt-actions">
              {#if me}<button class="cmt-act-btn" onclick={()=>{replyingToId=replyingToId===c.id?null:c.id;replyInput='';}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                {replyingToId===c.id?'Cancel':'Reply'}
              </button>{/if}
            </div>

            {#if replyingToId===c.id}
              <div class="cmt-rf">
                <div class="cmt-rf-av">
                  {#if me.avatar}<img src={me.avatar} class="cmt-rf-av-img" alt="" referrerpolicy="no-referrer"/>
                  {:else}{initials(me.username)}{/if}
                </div>
                <div class="cmt-rf-body">
                  <textarea class="cms-ta cms-ta-sm" rows="2" placeholder="Write a reply…" bind:value={replyInput}></textarea>
                  <div class="cmt-rf-acts">
                    <button class="cmt-cancel" onclick={()=>{replyingToId=null;replyInput='';}}>Cancel</button>
                    <button class="cms-post" onclick={()=>submitComment(c.id)}>Reply</button>
                  </div>
                </div>
              </div>
            {/if}

            {#each childComments(c.id) as r (r.id)}
              {@const rp=profileCache[r.user_id]}
              <div class="cmt-nested">
                <div class="cmt-nested-line"></div>
                <div class="cmt-nested-body">
                  <div class="cmt-hd">
                    <span class="cmt-name">{rp?.username||'User'}</span>
                    {#if currentStory.author_id === r.user_id}<span class="cmt-badge">Author</span>{/if}
                    <span class="cmt-dot">·</span>
                    <span class="cmt-time">{fmtDate(r.created_at)}</span>
                  </div>
                  <p class="cmt-txt">{r.content}</p>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
      {#if storyComments.length===0}
        <div class="cms-empty">
          <div class="cms-empty-icon">💬</div>
          <p>No comments yet</p>
          <span>Be the first to share your thoughts</span>
        </div>
      {/if}
    </div>
  </aside>
</div>

{:else}
{@const list = getDisplayList()}
<!-- ━━━━━━ GALLERY / MY STORIES / FAVORITES ━━━━━━ -->
<div class="gl-layout">
  <header class="gl-hero">
    <div class="gl-hero-in">
      <div>
        <div class="gl-ot"><span class="gl-bar"></span>
          {#if view==='myStories'}MY ARCHIVE{:else if view==='favorites'}SAVED STORIES{:else}COMMUNITY ARCHIVE{/if}
        </div>
        <h1 class="gl-title">
          {#if view==='myStories'}Your <em>Stories</em>
          {:else if view==='favorites'}Your <em>Favorites</em>
          {:else}The <em>Scriptorium</em>{/if}
        </h1>
        <p class="gl-sub">{list.length} {view==='myStories'?'authored':view==='favorites'?'saved':'stories in the archive'}</p>
      </div>
      {#if me}
        <button class="gl-write" onclick={newStory}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Begin Writing
        </button>
      {/if}
    </div>
  </header>

  <div class="fl-bar">
    <div class="sort-row">
      {#each [['hot','🔥 Hot'],['new','✨ New'],['top','⭐ Top']] as [s,l]}
        <button class="st {sortMode===s?'st-on':''}" onclick={()=>sortMode=s}>{l}</button>
      {/each}
    </div>
    <div class="gf-row">
      <button class="gf {activeGenre==='all'?'gf-on':''}" onclick={()=>activeGenre='all'}>All</button>
      {#each GENRES as g}
        <button class="gf {activeGenre===g?'gf-on':''}" onclick={()=>activeGenre=g}>{g}</button>
      {/each}
    </div>
  </div>

  {#if list.length===0}
    <div class="gl-empty">
      <div class="gl-empty-icon">📜</div>
      <h3>{view==='myStories'?'Write your first story!':view==='favorites'?'No favorites yet':searchQ?'Nothing found':'The archive awaits…'}</h3>
      {#if view==='myStories'||!me}<button class="gl-empty-btn" onclick={newStory}>Start Writing →</button>{/if}
    </div>
  {:else}
    <div class="story-grid">
      {#each list as story (story.id)}
        {@const author=profileCache[story.author_id]}
        {@const isFav=favIds.has(story.id)}
        {@const isMine=me&&story.author_id===me.id}
        <article class="sc" onclick={()=>openStory(story)}>
          <div class="sc-img-wrap">
            {#if story.cover_url}
              <img class="sc-cover" src={story.cover_url} alt={story.title} loading="lazy"/>
            {:else}
              <div class="sc-nocov">
                <span class="sc-letter">{story.title?.[0]||'S'}</span>
                <div class="sc-nocov-deco"></div>
              </div>
            {/if}
            <div class="sc-gtag">{story.genre||'Story'}</div>
            {#if isMine}<div class="sc-mine">YOURS</div>{/if}
            <div class="sc-rating-pip">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#c9a84c" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <span>{story.avg_rating?story.avg_rating.toFixed(1):'—'}</span>
            </div>
            <div class="sc-hover-ov">
              <button class="sc-read-btn">
                <span>Read Story</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
          <div class="sc-body">
            <h3 class="sc-t">{story.title||'Untitled'}</h3>
            <p class="sc-d">{(story.description||'').slice(0,110)}{(story.description||'').length>110?'…':''}</p>

            <div class="sc-meta-row">
              <div class="sc-author">
                {#if author?.avatar_url}<img class="sc-auth-img" src={author.avatar_url} alt={author.username} referrerpolicy="no-referrer"/>
                {:else}<div class="sc-auth-av">{initials(author?.username||'U')}</div>{/if}
                <span class="sc-auth-name">{author?.username||'Unknown'}</span>
              </div>
              <span class="sc-wc">{story.word_count||0} words</span>
            </div>

            <div class="sc-ft">
              <div class="sc-stats">
                <span class="sc-stat">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  {story.fav_count||0}
                </span>
                <span class="sc-stat">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  {story.view_count||0}
                </span>
              </div>
              <button class="sc-fav {isFav?'sc-fav-on':''}" onclick={(e)=>{e.stopPropagation();toggleFav(story.id);}} aria-label="Favorite">
                <svg width="14" height="14" viewBox="0 0 24 24" fill={isFav?'#e05c7a':'none'} stroke={isFav?'#e05c7a':'currentColor'} stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>
            </div>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</div>
{/if}

<style>
:global(*){margin:0;padding:0;box-sizing:border-box}
:global(html,body){background:#060504;color:#f0ece4;font-family:'EB Garamond',Georgia,serif;overflow-x:hidden;min-height:100vh}

.grain{position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:.035;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}

/* TOASTS */
.toasts{position:fixed;bottom:24px;right:24px;z-index:10000;display:flex;flex-direction:column;gap:10px;pointer-events:none}
.toast{padding:13px 22px;font-family:'Space Mono',monospace;font-size:.7rem;letter-spacing:.06em;border-radius:4px;animation:tin .3s ease;backdrop-filter:blur(14px);pointer-events:auto}
@keyframes tin{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.toast-success{background:rgba(95,191,140,.18);border:1px solid rgba(95,191,140,.55);color:#5fbf8c}
.toast-warn{background:rgba(201,168,76,.14);border:1px solid rgba(201,168,76,.55);color:#c9a84c}
.toast-info{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);color:rgba(240,236,228,.65)}

/* NAV */
.nav{position:fixed;top:0;width:100%;height:64px;padding:0 28px;display:flex;align-items:center;justify-content:space-between;z-index:600;background:rgba(6,5,4,.97);backdrop-filter:blur(24px);border-bottom:1px solid rgba(255,255,255,.07)}
.nav-logo{display:flex;align-items:baseline;background:none;border:none;cursor:pointer;padding:0;gap:0}
.logo-s{font-family:'Cinzel Decorative',serif;font-size:1.7rem;color:#c9a84c;font-weight:700;line-height:1}
.logo-rest{font-family:'Cinzel',serif;font-size:1.1rem;color:#f0ece4;letter-spacing:.04em}
.logo-pip{width:5px;height:5px;background:#c9a84c;border-radius:50%;margin-left:5px;margin-bottom:8px;box-shadow:0 0 10px #c9a84c}
.nav-center{flex:1;display:flex;align-items:center;justify-content:center;padding:0 20px}
.search-wrap{position:relative;width:100%;max-width:440px}
.si{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:rgba(240,236,228,.28);pointer-events:none}
.search-in{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:30px;padding:8px 16px 8px 32px;color:#f0ece4;font-family:'Space Mono',monospace;font-size:.72rem;outline:none;transition:.2s}
.search-in:focus{border-color:rgba(201,168,76,.4)}
.search-in::placeholder{color:rgba(240,236,228,.2)}
.editor-breadcrumb{display:flex;align-items:center;gap:8px;font-family:'Space Mono',monospace;font-size:.6rem}
.eb-back{color:#c9a84c;cursor:pointer;letter-spacing:.08em}
.eb-back:hover{text-decoration:underline}
.eb-sep{color:rgba(240,236,228,.2)}
.eb-cur{color:rgba(240,236,228,.45);letter-spacing:.08em}
.eb-title{color:rgba(240,236,228,.3);letter-spacing:.06em;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav-r{display:flex;align-items:center;gap:8px;flex-shrink:0}
.nt{background:none;border:none;color:rgba(240,236,228,.38);font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.1em;padding:7px 12px;cursor:pointer;border-radius:6px;transition:.2s;white-space:nowrap}
.nt:hover{color:rgba(240,236,228,.72);background:rgba(255,255,255,.05)}
.nt-on{color:#c9a84c;background:rgba(201,168,76,.1)}
.write-btn{display:flex;align-items:center;gap:7px;background:linear-gradient(135deg,rgba(201,168,76,.18),rgba(201,168,76,.05));border:1px solid rgba(201,168,76,.5);color:#c9a84c;font-family:'Space Mono',monospace;font-size:.58rem;letter-spacing:.1em;padding:8px 16px;border-radius:30px;cursor:pointer;transition:all .22s;text-decoration:none;flex-shrink:0}
.write-btn:hover{background:rgba(201,168,76,.26);border-color:#c9a84c;transform:translateY(-1px)}
.nav-av{width:34px;height:34px;border-radius:50%;background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.4);display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-size:.52rem;color:#c9a84c;flex-shrink:0;overflow:hidden}
.nav-av-img{width:100%;height:100%;object-fit:cover;border-radius:50%}

/* SPINNERS */
@keyframes spin{to{transform:rotate(360deg)}}
.spin-s{width:13px;height:13px;border:2px solid rgba(5,5,5,.3);border-top-color:#050505;border-radius:50%;animation:spin .7s linear infinite;display:inline-block;margin-right:6px;vertical-align:middle}

/* ═══════════════════════════════════
   EDITOR
═══════════════════════════════════ */
.editor-layout{display:flex;height:100vh;padding-top:64px;overflow:hidden}

.ed-sidebar{width:290px;flex-shrink:0;background:#080706;border-right:1px solid rgba(255,255,255,.07);display:flex;flex-direction:column;overflow-y:auto;padding-bottom:32px}
.ed-sidebar::-webkit-scrollbar{width:2px}
.ed-sidebar::-webkit-scrollbar-thumb{background:rgba(201,168,76,.15)}
.eds-top{display:flex;flex-direction:column;gap:0}
.eds-field{padding:16px 18px 0}
.eds-label{font-family:'Space Mono',monospace;font-size:.52rem;letter-spacing:.16em;color:rgba(240,236,228,.36);display:block;margin-bottom:7px}
.req{color:#e05c7a;margin-left:3px}
.eds-opt{font-size:.46rem;color:rgba(240,236,228,.22);letter-spacing:.1em;margin-left:6px}
.eds-input{width:100%;background:#111;border:1px solid rgba(255,255,255,.1);color:#f0ece4;font-family:'EB Garamond',serif;font-size:.95rem;padding:9px 12px;outline:none;transition:.2s;border-radius:3px}
.eds-input:focus{border-color:rgba(201,168,76,.45)}
.eds-ta{width:100%;background:#111;border:1px solid rgba(255,255,255,.1);color:#f0ece4;font-family:'EB Garamond',serif;font-size:.88rem;padding:9px 12px;outline:none;resize:vertical;min-height:64px;transition:.2s;border-radius:3px}
.eds-ta:focus{border-color:rgba(201,168,76,.45)}
.gp-wrap{display:flex;flex-wrap:wrap;gap:5px}
.gp{background:none;border:1px solid rgba(255,255,255,.08);color:rgba(240,236,228,.38);font-family:'Space Mono',monospace;font-size:.46rem;letter-spacing:.08em;padding:4px 9px;cursor:pointer;border-radius:12px;transition:.18s}
.gp:hover{border-color:rgba(201,168,76,.3);color:rgba(240,236,228,.65)}
.gp-on{border-color:rgba(201,168,76,.55);color:#c9a84c;background:rgba(201,168,76,.1)}
.cover-prev{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:4px;border:1px solid rgba(255,255,255,.1)}
.cover-prev img{width:100%;height:100%;object-fit:cover;display:block}
.cover-rm{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,.82);border:none;color:#f0ece4;font-size:.75rem;cursor:pointer;display:flex;align-items:center;justify-content:center}
.cover-upload{width:100%;background:rgba(255,255,255,.025);border:1px dashed rgba(255,255,255,.11);color:rgba(240,236,228,.38);font-family:'Space Mono',monospace;font-size:.52rem;letter-spacing:.08em;padding:18px;cursor:pointer;border-radius:4px;display:flex;flex-direction:column;align-items:center;gap:8px;transition:.2s}
.cover-upload:hover{border-color:rgba(201,168,76,.3);color:rgba(201,168,76,.7)}
.eds-meta{display:flex;gap:14px;padding:14px 18px 0;font-family:'Space Mono',monospace;font-size:.5rem;color:rgba(240,236,228,.27)}
.pub-btn{margin:18px;background:#c9a84c;border:none;color:#060504;font-family:'Space Mono',monospace;font-size:.63rem;letter-spacing:.14em;padding:14px 18px;cursor:pointer;font-weight:700;transition:all .22s;border-radius:2px;display:flex;align-items:center;justify-content:center;gap:7px}
.pub-btn:hover:not(:disabled){background:#e0c060;box-shadow:0 6px 22px rgba(201,168,76,.38)}
.pub-btn:disabled{opacity:.45;cursor:not-allowed}

/* Canvas */
.ed-canvas{flex:1;overflow-y:auto;background:#060504;padding-bottom:80px}
.ed-canvas::-webkit-scrollbar{width:3px}
.ed-canvas::-webkit-scrollbar-thumb{background:rgba(255,255,255,.07)}
.canvas-body{max-width:740px;margin:0 auto;padding:0 48px}

.cv-banner{min-height:260px;background-size:cover;background-position:center;position:relative;display:flex;align-items:flex-end;padding:36px;margin-bottom:32px}
.cv-grad{position:absolute;inset:0;background:linear-gradient(to top,rgba(6,5,4,.95) 0%,transparent 60%)}
.cv-title{position:relative;z-index:2;font-family:'Cinzel',serif;font-size:2.4rem;font-weight:600;color:#f0ece4;text-shadow:0 2px 20px rgba(0,0,0,.9)}
.cv-plain{padding:52px 0 24px;position:relative}
.cv-title-input{width:100%;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,.1);color:#f0ece4;font-family:'Cinzel',serif;font-size:2.6rem;font-weight:400;outline:none;padding-bottom:14px;transition:.2s}
.cv-title-input:focus{border-bottom-color:rgba(201,168,76,.4)}
.cv-title-input::placeholder{color:rgba(240,236,228,.15)}
.cv-genre-badge{font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.16em;color:#c9a84c;margin-top:10px}

/* BLOCKS — KEY: extra padding + negative margin trick so hover zone includes controls */
.bw{
  position:relative;
  margin:10px 0;
  /* Extra right padding so mouse can reach the controls without leaving the element */
  padding:4px 72px 4px 56px;
}

.bc{
  position:absolute;
  right:0;
  top:50%;
  transform:translateY(-50%);
  display:flex;
  flex-direction:column;
  gap:3px;
  opacity:0;
  transition:opacity .12s;
  pointer-events:none;
  z-index:10;
}
.bc-on{opacity:1;pointer-events:auto}
.bc-b{width:26px;height:26px;border-radius:4px;background:rgba(20,18,14,.9);border:1px solid rgba(255,255,255,.12);color:rgba(240,236,228,.55);font-size:.65rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s}
.bc-b:hover{background:rgba(201,168,76,.18);border-color:rgba(201,168,76,.5);color:#c9a84c}
.bc-x:hover{background:rgba(231,76,60,.18);border-color:rgba(231,76,60,.5);color:#e74c3c}

.ba{
  position:absolute;
  left:0;
  top:50%;
  transform:translateY(-50%);
  display:flex;
  flex-direction:column;
  gap:3px;
  opacity:0;
  transition:opacity .12s;
  pointer-events:none;
  z-index:10;
}
.ba-on{opacity:1;pointer-events:auto}
.ba-b{width:26px;height:26px;border-radius:4px;background:rgba(20,18,14,.85);border:1px solid rgba(255,255,255,.1);color:rgba(240,236,228,.4);font-size:.52rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s}
.ba-b:hover{border-color:rgba(201,168,76,.4);color:#c9a84c}
.ba-b-on{background:rgba(201,168,76,.14);border-color:rgba(201,168,76,.45);color:#c9a84c}

/* contenteditable placeholder trick */
[contenteditable][data-placeholder]:empty::before{content:attr(data-placeholder);color:rgba(240,236,228,.2);pointer-events:none}

.b-para{font-family:'EB Garamond',serif;font-size:1.12rem;line-height:1.88;color:rgba(240,236,228,.85);outline:none;min-height:26px}
.bh-wrap{display:flex;align-items:baseline;gap:10px}
.bh-sel{background:#111;border:1px solid rgba(255,255,255,.1);color:#c9a84c;font-family:'Space Mono',monospace;font-size:.5rem;padding:3px 7px;cursor:pointer;border-radius:3px}
.b-heading{outline:none;font-family:'Cinzel',serif;font-weight:600;color:#f0ece4;flex:1}
.h1{font-size:2.3rem}.h2{font-size:1.75rem}.h3{font-size:1.3rem}

.b-quote{border-left:3px solid #c9a84c;padding:14px 18px;background:rgba(201,168,76,.04)}
.bq-glyph{font-family:'EB Garamond',serif;font-size:3rem;color:rgba(201,168,76,.35);line-height:1;display:block;margin-bottom:-12px}
.bq-txt{font-family:'EB Garamond',serif;font-size:1.12rem;font-style:italic;color:rgba(240,236,228,.8);outline:none;min-height:28px;line-height:1.7}
.bq-attr{font-family:'Space Mono',monospace;font-size:.6rem;color:rgba(240,236,228,.38);margin-top:8px;outline:none}

.b-img-wrap{display:flex;flex-direction:column;gap:8px;border:1px solid rgba(255,255,255,.08);padding:8px;border-radius:4px}
.b-img{width:100%;max-height:480px;object-fit:cover;display:block;border-radius:3px}
.b-img-up{width:100%;min-height:110px;border:1px dashed rgba(255,255,255,.11);background:rgba(255,255,255,.018);color:rgba(240,236,228,.32);font-family:'Space Mono',monospace;font-size:.58rem;letter-spacing:.08em;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;justify-content:center;transition:.2s;border-radius:3px}
.b-img-up:hover{border-color:rgba(201,168,76,.3);color:rgba(201,168,76,.7)}
.b-img-chg{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:rgba(240,236,228,.5);font-family:'Space Mono',monospace;font-size:.5rem;padding:5px 12px;cursor:pointer;border-radius:20px;width:fit-content}
.b-img-cap{background:transparent;border:none;border-top:1px solid rgba(255,255,255,.06);color:rgba(240,236,228,.38);font-family:'Space Mono',monospace;font-size:.56rem;padding:6px 0;outline:none;width:100%}

.b-div-wrap{display:flex;flex-direction:column;gap:7px}
.b-div-sel{background:#111;border:1px solid rgba(255,255,255,.1);color:rgba(240,236,228,.5);font-family:'Space Mono',monospace;font-size:.5rem;padding:3px 7px;cursor:pointer;width:fit-content;border-radius:3px}
.b-divider{text-align:center;padding:14px 0;color:rgba(201,168,76,.45);font-size:1.2rem;letter-spacing:.3em}
.b-hr{border:none;border-top:1px solid rgba(255,255,255,.11);margin:6px 0}

.b-callout{display:flex;gap:12px;background:rgba(201,168,76,.05);border:1px solid rgba(201,168,76,.18);border-radius:5px;padding:15px}
.bcl-icon{font-size:1.4rem;flex-shrink:0;outline:none}
.bcl-txt{font-family:'EB Garamond',serif;font-size:1rem;line-height:1.6;outline:none;flex:1;color:rgba(240,236,228,.82)}

.b-letter{background:#0e0b07;border:1px solid rgba(201,168,76,.22);border-top:3px solid #c9a84c;padding:22px 26px;font-family:'EB Garamond',serif;font-size:1rem;line-height:1.8}
.bl-txt{outline:none;min-height:40px;color:rgba(240,236,228,.82)}

.b-redacted{position:relative;padding:12px 14px;background:#0b0b0b;border:1px solid rgba(255,255,255,.1)}
.br-txt{outline:none;font-family:'Space Mono',monospace;font-size:.82rem;color:rgba(240,236,228,.6);min-height:26px}
.br-bar{position:absolute;bottom:7px;right:12px;font-family:'Space Mono',monospace;color:rgba(231,76,60,.35);font-size:.65rem;pointer-events:none}

.b-doc{border:1px solid rgba(201,168,76,.22);overflow:hidden}
.bdoc-hd{background:rgba(201,168,76,.07);border-bottom:1px solid rgba(201,168,76,.18);padding:11px 15px;display:flex;align-items:center;gap:12px}
.bdoc-stamp{font-family:'Space Mono',monospace;font-size:.48rem;letter-spacing:.2em;color:#e74c3c;border:1px solid rgba(231,76,60,.4);padding:3px 7px;transform:rotate(-2deg)}
.bdoc-title{font-family:'Space Mono',monospace;font-size:.68rem;letter-spacing:.1em;color:#c9a84c;outline:none;flex:1}
.bdoc-body{width:100%;background:#0b0908;border:none;outline:none;color:rgba(240,236,228,.68);font-family:'Space Mono',monospace;font-size:.76rem;line-height:1.7;padding:15px;resize:vertical;min-height:76px}

.b-dialogue{padding:13px 15px;border-left:3px solid rgba(95,191,140,.45);background:rgba(95,191,140,.04)}
.bdl-spk{font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.1em;color:#5fbf8c;margin-bottom:6px;outline:none}
.bdl-txt{font-family:'EB Garamond',serif;font-size:1.05rem;font-style:italic;color:rgba(240,236,228,.85);outline:none}

.b-tl{display:flex;align-items:baseline;gap:12px;padding:9px 0}
.btl-dt{font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.1em;color:#c9a84c;width:115px;flex-shrink:0;outline:none}
.btl-pip{width:8px;height:8px;border-radius:50%;border:2px solid #c9a84c;flex-shrink:0}
.btl-ev{font-family:'EB Garamond',serif;font-size:1rem;color:rgba(240,236,228,.82);outline:none;flex:1}

.b-warn{display:flex;gap:11px;background:rgba(231,76,60,.07);border:1px solid rgba(231,76,60,.22);border-radius:4px;padding:13px 15px;color:#e74c3c;align-items:flex-start}
.b-warn div{outline:none;flex:1;font-family:'Space Mono',monospace;font-size:.7rem;line-height:1.6}

.b-cols{display:grid;grid-template-columns:1fr 1px 1fr;gap:15px}
.bcol{font-family:'EB Garamond',serif;font-size:1rem;line-height:1.7;outline:none;color:rgba(240,236,228,.82);min-height:40px}
.bcol-sep{background:rgba(255,255,255,.1)}

.b-code{border:1px solid rgba(255,255,255,.1);overflow:hidden;border-radius:4px}
.bcode-hd{padding:7px 15px;background:rgba(255,255,255,.04);font-family:'Space Mono',monospace;font-size:.5rem;letter-spacing:.12em;color:rgba(240,236,228,.38);border-bottom:1px solid rgba(255,255,255,.07)}
.bcode-body{width:100%;background:#0b0b0b;border:none;outline:none;color:#5fbf8c;font-family:'Space Mono',monospace;font-size:.78rem;line-height:1.7;padding:15px;resize:vertical;min-height:76px}

.b-poem{padding:22px;background:rgba(255,255,255,.018);border-left:2px solid rgba(201,168,76,.28)}
.bpoem-txt{font-family:'EB Garamond',serif;font-size:1.1rem;font-style:italic;line-height:2;color:rgba(240,236,228,.82);outline:none;white-space:pre-wrap}

.b-map{background:linear-gradient(135deg,rgba(201,168,76,.05),rgba(6,5,4,.5));border:1px solid rgba(201,168,76,.18);border-radius:4px;padding:18px;position:relative;overflow:hidden;display:flex;align-items:flex-start;gap:16px}
.bmap-lbl{font-family:'Space Mono',monospace;font-size:.72rem;color:#c9a84c;outline:none;min-height:28px;flex:1}
.bmap-deco{flex-shrink:0;opacity:.2}

.b-chapter{text-align:center;padding:36px 18px;border-top:1px solid rgba(201,168,76,.18);border-bottom:1px solid rgba(201,168,76,.18);margin:14px 0}
.bch-lbl{font-family:'Space Mono',monospace;font-size:.5rem;letter-spacing:.3em;color:rgba(201,168,76,.45);margin-bottom:8px}
.bch-num{font-family:'Cinzel Decorative',serif;font-size:2.8rem;color:rgba(201,168,76,.65);line-height:1;outline:none}
.bch-title{font-family:'Cinzel',serif;font-size:1.55rem;font-weight:600;color:#f0ece4;margin-top:10px;outline:none}

.b-hl{display:flex;gap:11px;background:rgba(201,168,76,.07);padding:13px 15px;border-radius:4px}
.bhl-bar{width:4px;background:#c9a84c;border-radius:2px;flex-shrink:0}
.bhl-txt{font-family:'EB Garamond',serif;font-size:1.05rem;font-style:italic;color:rgba(240,236,228,.85);outline:none;flex:1}

.b-stats{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);padding:15px;border-radius:4px}
.bst-grid{display:flex;gap:14px;flex-wrap:wrap}
.bst-cell{flex:1;min-width:72px;text-align:center;background:rgba(255,255,255,.04);padding:13px;border-radius:3px}
.bst-v{font-family:'Cinzel',serif;font-size:1.45rem;color:#c9a84c;outline:none}
.bst-l{font-family:'Space Mono',monospace;font-size:.48rem;letter-spacing:.1em;color:rgba(240,236,228,.38);margin-top:4px;outline:none}
.bst-add{margin-top:10px;background:none;border:1px dashed rgba(255,255,255,.11);color:rgba(240,236,228,.32);font-family:'Space Mono',monospace;font-size:.5rem;padding:5px 12px;cursor:pointer;border-radius:20px;transition:.2s}
.bst-add:hover{border-color:rgba(201,168,76,.3);color:#c9a84c}

.add-row{display:flex;justify-content:center;margin:22px 0 6px}
.add-tog{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.035);border:1px dashed rgba(255,255,255,.12);color:rgba(240,236,228,.32);font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.1em;padding:10px 22px;cursor:pointer;border-radius:28px;transition:.2s}
.add-tog:hover{border-color:rgba(201,168,76,.35);color:#c9a84c}
.btoolbar{display:flex;flex-wrap:wrap;gap:7px;padding:15px;background:#0a0906;border:1px solid rgba(255,255,255,.08);border-radius:8px;margin-bottom:14px}
.bb{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:rgba(240,236,228,.58);font-family:'Space Mono',monospace;font-size:.52rem;letter-spacing:.06em;padding:6px 13px;cursor:pointer;border-radius:18px;transition:all .18s;white-space:nowrap}
.bb:hover{background:rgba(201,168,76,.1);border-color:rgba(201,168,76,.4);color:#c9a84c;transform:translateY(-1px)}

/* ═══════════════════════════════════
   READ
═══════════════════════════════════ */
.read-layout{display:flex;padding-top:64px;min-height:100vh}
.read-main{flex:1;min-width:0}
.rh{min-height:52vh;background-size:cover;background-position:center;position:relative;display:flex;align-items:flex-end}
.rh-ov{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(6,5,4,.25) 0%,rgba(6,5,4,.82) 65%,#060504 100%)}
.rh-body{position:relative;z-index:2;padding:0 56px 44px;max-width:840px}
.rh-back{background:rgba(20,18,12,.82);border:1px solid rgba(201,168,76,.32);border-radius:28px;color:#c9a84c;font-family:'Space Mono',monospace;font-size:.6rem;padding:7px 17px;cursor:pointer;margin-bottom:18px;transition:.2s;display:inline-flex}
.rh-back:hover{border-color:#c9a84c}
.rh-genre{font-family:'Space Mono',monospace;font-size:.58rem;letter-spacing:.2em;color:#c9a84c;margin-bottom:11px}
.rh-title{font-family:'Cinzel',serif;font-size:clamp(2rem,5vw,3.8rem);font-weight:600;line-height:1.05;margin-bottom:14px;color:#f0ece4}
.rh-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-family:'Space Mono',monospace;font-size:.54rem;color:rgba(240,236,228,.38);margin-bottom:13px}
.rh-author{display:flex;align-items:center;gap:7px}
.rh-av{width:20px;height:20px;border-radius:50%;background:rgba(201,168,76,.18);display:flex;align-items:center;justify-content:center;font-size:.4rem;color:#c9a84c;flex-shrink:0}
.rh-av-img{width:20px;height:20px;border-radius:50%;object-fit:cover;flex-shrink:0}
.dot{color:rgba(240,236,228,.2)}
.rh-desc{font-family:'EB Garamond',serif;font-size:1rem;line-height:1.65;color:rgba(240,236,228,.52);max-width:600px;margin-bottom:18px}
.rh-acts{display:flex;gap:9px;flex-wrap:wrap}
.ra-btn{display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.11);color:rgba(240,236,228,.58);font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.08em;padding:7px 15px;cursor:pointer;border-radius:18px;transition:.2s}
.ra-btn:hover{border-color:rgba(201,168,76,.4);color:#c9a84c}
.ra-fav{border-color:rgba(224,92,122,.4);color:#e05c7a;background:rgba(224,92,122,.07)}
.ra-del{border-color:rgba(231,76,60,.3);color:#e74c3c}
.ra-del:hover{background:rgba(231,76,60,.1);border-color:#e74c3c}

.rate-bar{display:flex;align-items:center;gap:13px;padding:14px 56px;background:rgba(201,168,76,.035);border-bottom:1px solid rgba(201,168,76,.1);flex-wrap:wrap}
.rate-info-bar{font-family:'Space Mono',monospace;font-size:.58rem;color:rgba(240,236,228,.38)}
.rate-lbl{font-family:'Space Mono',monospace;font-size:.58rem;letter-spacing:.1em;color:rgba(240,236,228,.38)}
.rate-stars{display:flex;gap:3px}
.rstar{background:none;border:none;font-size:1.5rem;color:rgba(255,255,255,.14);cursor:pointer;transition:all .14s;line-height:1;padding:0}
.rstar:hover,.rstar-on{color:#c9a84c;transform:scale(1.2)}
.rstar-done{cursor:default;pointer-events:none}
.rate-info{font-family:'Space Mono',monospace;font-size:.56rem;color:rgba(240,236,228,.32);margin-left:auto}

.story-body{max-width:700px;margin:0 auto;padding:48px 56px 38px}
.s-empty{font-family:'Space Mono',monospace;font-size:.68rem;color:rgba(240,236,228,.28);text-align:center;padding:60px}
.s-p{font-family:'EB Garamond',serif;font-size:1.15rem;line-height:1.9;color:rgba(240,236,228,.86);margin-bottom:1.4em}
.s-h{font-family:'Cinzel',serif;font-weight:600;color:#f0ece4;margin:2em 0 .8em}
.s-h1{font-size:2.2rem}.s-h2{font-size:1.6rem}.s-h3{font-size:1.25rem}
.s-bq{border-left:3px solid #c9a84c;padding:15px 18px;margin:18px 0;background:rgba(201,168,76,.04)}
.s-bq-m{font-family:'EB Garamond',serif;font-size:2.8rem;color:rgba(201,168,76,.38);line-height:1;display:block;margin-bottom:-12px}
.s-bq-t{font-family:'EB Garamond',serif;font-size:1.12rem;font-style:italic;color:rgba(240,236,228,.82);display:block;line-height:1.7}
.s-bq-c{font-family:'Space Mono',monospace;font-size:.58rem;color:rgba(240,236,228,.38);display:block;margin-top:8px}
.s-fig{margin:22px 0}
.s-img{width:100%;max-height:460px;object-fit:cover;border-radius:3px;display:block}
.s-cap{font-family:'Space Mono',monospace;font-size:.56rem;color:rgba(240,236,228,.32);text-align:center;margin-top:7px;letter-spacing:.06em}
.s-div{text-align:center;padding:18px 0;color:rgba(201,168,76,.48);font-size:1.2rem;letter-spacing:.3em;margin:10px 0}
.s-div hr{border:none;border-top:1px solid rgba(255,255,255,.1)}
.s-callout{display:flex;gap:11px;background:rgba(201,168,76,.055);border:1px solid rgba(201,168,76,.18);border-radius:5px;padding:15px;margin:15px 0;font-family:'EB Garamond',serif;font-size:1rem;color:rgba(240,236,228,.82);align-items:flex-start}
.s-letter{background:#0e0b07;border:1px solid rgba(201,168,76,.22);border-top:3px solid #c9a84c;padding:26px 30px;font-family:'EB Garamond',serif;font-size:1.05rem;line-height:1.8;margin:15px 0;white-space:pre-wrap}
.s-red{position:relative;padding:11px 15px;background:#0b0b0b;border:1px solid rgba(255,255,255,.1);margin:11px 0;display:flex;align-items:center;justify-content:space-between}
.s-red-bar{font-family:'Space Mono',monospace;color:rgba(231,76,60,.35);letter-spacing:.05em}
.s-doc{border:1px solid rgba(201,168,76,.18);margin:15px 0;overflow:hidden}
.s-doc-hd{background:rgba(201,168,76,.055);border-bottom:1px solid rgba(201,168,76,.14);padding:11px 15px;display:flex;gap:12px;align-items:center}
.s-doc-stamp{font-family:'Space Mono',monospace;font-size:.48rem;letter-spacing:.2em;color:#e74c3c;border:1px solid rgba(231,76,60,.4);padding:3px 7px;transform:rotate(-2deg)}
.s-doc-t{font-family:'Space Mono',monospace;font-size:.68rem;letter-spacing:.1em;color:#c9a84c}
.s-doc-b{padding:15px;font-family:'Space Mono',monospace;font-size:.78rem;line-height:1.7;color:rgba(240,236,228,.62);background:#0b0908;white-space:pre-wrap}
.s-dl{padding:13px 15px;border-left:3px solid rgba(95,191,140,.4);background:rgba(95,191,140,.03);margin:11px 0}
.s-dl-spk{font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.1em;color:#5fbf8c;margin-bottom:6px}
.s-dl-txt{font-family:'EB Garamond',serif;font-size:1.05rem;font-style:italic;color:rgba(240,236,228,.85)}
.s-tl{display:flex;align-items:baseline;gap:11px;padding:9px 0;margin:5px 0}
.s-tl-dt{font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.1em;color:#c9a84c;width:115px;flex-shrink:0}
.s-tl-pip{width:8px;height:8px;border-radius:50%;border:2px solid #c9a84c;flex-shrink:0}
.s-tl-ev{font-family:'EB Garamond',serif;font-size:1rem;color:rgba(240,236,228,.82)}
.s-warn{display:flex;gap:11px;background:rgba(231,76,60,.065);border:1px solid rgba(231,76,60,.18);border-radius:4px;padding:11px 15px;color:#e74c3c;font-family:'Space Mono',monospace;font-size:.68rem;line-height:1.5;margin:11px 0;align-items:flex-start}
.s-cols{display:grid;grid-template-columns:1fr 1px 1fr;gap:18px;margin:15px 0}
.s-col{font-family:'EB Garamond',serif;font-size:1rem;line-height:1.7;color:rgba(240,236,228,.82)}
.s-col-sep{background:rgba(255,255,255,.08)}
.s-code{background:#0b0b0b;border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:15px;font-family:'Space Mono',monospace;font-size:.76rem;color:#5fbf8c;line-height:1.7;overflow-x:auto;white-space:pre-wrap;margin:11px 0}
.s-poem{padding:22px 30px;border-left:2px solid rgba(201,168,76,.28);font-family:'EB Garamond',serif;font-size:1.1rem;font-style:italic;line-height:2;color:rgba(240,236,228,.82);white-space:pre-wrap;margin:11px 0}
.s-map{background:linear-gradient(135deg,rgba(201,168,76,.055),rgba(6,5,4,.5));border:1px solid rgba(201,168,76,.18);border-radius:4px;padding:18px;margin:11px 0}
.s-map-lbl{font-family:'Space Mono',monospace;font-size:.72rem;color:#c9a84c}
.s-ch{text-align:center;padding:36px 18px;border-top:1px solid rgba(201,168,76,.18);border-bottom:1px solid rgba(201,168,76,.18);margin:22px 0}
.s-ch-lbl{font-family:'Space Mono',monospace;font-size:.5rem;letter-spacing:.3em;color:rgba(201,168,76,.45)}
.s-ch-num{font-family:'Cinzel Decorative',serif;font-size:2.4rem;color:rgba(201,168,76,.65);line-height:1;margin:7px 0}
.s-ch-t{font-family:'Cinzel',serif;font-size:1.45rem;font-weight:600;color:#f0ece4}
.s-hl{display:flex;gap:11px;background:rgba(201,168,76,.065);padding:13px 15px;border-radius:4px;margin:11px 0;font-family:'EB Garamond',serif;font-size:1.05rem;font-style:italic;color:rgba(240,236,228,.85);align-items:flex-start}
.s-hl-bar{width:4px;background:#c9a84c;border-radius:2px;flex-shrink:0;align-self:stretch}
.s-stats{display:flex;gap:11px;flex-wrap:wrap;margin:15px 0}
.s-st{flex:1;min-width:78px;text-align:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);padding:15px;border-radius:3px}
.s-st-v{font-family:'Cinzel',serif;font-size:1.55rem;color:#c9a84c}
.s-st-l{font-family:'Space Mono',monospace;font-size:.5rem;letter-spacing:.1em;color:rgba(240,236,228,.38);margin-top:4px}

.pg-row{display:flex;align-items:center;gap:14px;justify-content:center;padding:36px 56px 70px;flex-wrap:wrap}
.pg-btn{background:rgba(201,168,76,.07);border:1px solid rgba(201,168,76,.28);color:#c9a84c;font-family:'Space Mono',monospace;font-size:.6rem;letter-spacing:.1em;padding:9px 22px;cursor:pointer;border-radius:2px;transition:.2s}
.pg-btn:hover:not(:disabled){background:rgba(201,168,76,.16);border-color:#c9a84c}
.pg-btn:disabled{opacity:.28;cursor:not-allowed}
.pg-dots{display:flex;gap:5px;align-items:center}
.pg-dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.14);border:none;cursor:pointer;transition:all .18s;padding:0}
.pg-dot-on{background:#c9a84c;width:20px;border-radius:3px;box-shadow:0 0 8px rgba(201,168,76,.5)}
.pg-info{font-family:'Space Mono',monospace;font-size:.54rem;color:rgba(240,236,228,.28);letter-spacing:.1em}

/* ═══════════════════════════════════
   GALLERY
═══════════════════════════════════ */
.gl-layout{padding-top:64px;min-height:100vh}
.gl-hero{padding:56px 56px 36px;background:linear-gradient(180deg,rgba(201,168,76,.04) 0%,transparent 100%);border-bottom:1px solid rgba(255,255,255,.06)}
.gl-hero-in{display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:22px}
.gl-ot{display:flex;align-items:center;gap:11px;font-family:'Space Mono',monospace;font-size:.58rem;letter-spacing:.22em;color:#c9a84c;margin-bottom:12px}
.gl-bar{width:30px;height:1px;background:#c9a84c}
.gl-title{font-family:'Cinzel',serif;font-size:clamp(2.4rem,5vw,3.8rem);font-weight:400;line-height:1;letter-spacing:-.01em}
.gl-title em{font-style:italic;color:rgba(201,168,76,.82);font-family:'EB Garamond',serif}
.gl-sub{font-family:'Space Mono',monospace;font-size:.58rem;color:rgba(240,236,228,.28);margin-top:11px;letter-spacing:.1em}
.gl-write{display:flex;align-items:center;gap:9px;background:#c9a84c;border:none;color:#060504;font-family:'Space Mono',monospace;font-size:.62rem;letter-spacing:.12em;padding:13px 26px;cursor:pointer;font-weight:700;transition:all .22s;border-radius:2px}
.gl-write:hover{background:#e0c060;transform:translateY(-2px);box-shadow:0 8px 24px rgba(201,168,76,.3)}

.fl-bar{padding:18px 56px;display:flex;align-items:center;gap:18px;border-bottom:1px solid rgba(255,255,255,.05);flex-wrap:wrap;background:rgba(6,5,4,.82);position:sticky;top:64px;z-index:40;backdrop-filter:blur(16px)}
.sort-row{display:flex;gap:4px;flex-shrink:0}
.st{background:none;border:1px solid rgba(255,255,255,.08);color:rgba(240,236,228,.38);font-family:'Space Mono',monospace;font-size:.52rem;letter-spacing:.1em;padding:6px 13px;cursor:pointer;border-radius:18px;transition:.2s}
.st:hover{color:rgba(240,236,228,.7);border-color:rgba(255,255,255,.18)}
.st-on{background:rgba(201,168,76,.1);border-color:rgba(201,168,76,.4);color:#c9a84c}
.gf-row{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;padding-bottom:1px}
.gf-row::-webkit-scrollbar{display:none}
.gf{background:none;border:1px solid rgba(255,255,255,.07);color:rgba(240,236,228,.32);font-family:'Space Mono',monospace;font-size:.5rem;letter-spacing:.08em;padding:5px 11px;cursor:pointer;border-radius:13px;transition:.18s;white-space:nowrap;flex-shrink:0}
.gf:hover{color:rgba(240,236,228,.62);border-color:rgba(255,255,255,.18)}
.gf-on{border-color:rgba(201,168,76,.5);color:#c9a84c;background:rgba(201,168,76,.08)}

.story-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:22px;padding:36px 56px 72px}



@media(max-width:768px){
  .nav{padding:0 14px}
  .nav-center{display:none}
  .editor-layout{flex-direction:column;height:auto;overflow:auto}
  .ed-sidebar{width:100%;border-right:none;border-bottom:1px solid rgba(255,255,255,.07);max-height:48vh;overflow-y:auto}
  .canvas-body{padding:0 18px}
  .bw{padding:4px 36px 4px 36px}
  .read-layout{flex-direction:column}
  .cm-sidebar{width:100%;height:auto;position:static;max-height:400px}
  .story-body{padding:28px 18px}
  .rh-body{padding:0 18px 30px}
  .rate-bar{padding:12px 18px}
  .gl-hero{padding:36px 18px 24px}
  .fl-bar{padding:12px 18px}
  .story-grid{padding:22px 16px 56px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
  .pg-row{padding:28px 18px 56px}
}


/* ═══════════════════════════════════
   COMMENTS SIDEBAR — Peak Edition
═══════════════════════════════════ */
.cm-sidebar{width:380px;flex-shrink:0;background:#080706;border-left:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;height:calc(100vh - 64px);position:sticky;top:64px;overflow:hidden}

.cms-hd{padding:22px 22px 16px;border-bottom:1px solid rgba(255,255,255,.05);display:flex;align-items:center;gap:10px;flex-shrink:0}
.cms-hd-line{width:3px;height:18px;background:#c9a84c;border-radius:2px}
.cms-hd span:first-of-type{font-family:'Cinzel',serif;font-size:1rem;font-weight:600;color:#f0ece4;letter-spacing:.02em}
.cms-ct{font-family:'Space Mono',monospace;font-size:.5rem;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.25);color:#c9a84c;padding:2px 8px;border-radius:10px;margin-left:auto}

.cms-compose{display:flex;gap:12px;padding:18px 22px;border-bottom:1px solid rgba(255,255,255,.04);flex-shrink:0}
.cms-av{width:32px;height:32px;border-radius:50%;background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.25);display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-size:.5rem;color:#c9a84c;flex-shrink:0;overflow:hidden}
.cms-av-img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.cms-inp-wrap{flex:1;display:flex;flex-direction:column;gap:8px}
.cms-ta{width:100%;background:#0d0c0a;border:1px solid rgba(255,255,255,.08);color:#f0ece4;font-family:'EB Garamond',serif;font-size:.9rem;padding:11px 13px;outline:none;resize:none;border-radius:6px;transition:.2s;line-height:1.5}
.cms-ta:focus{border-color:rgba(201,168,76,.35);box-shadow:0 0 0 3px rgba(201,168,76,.06)}
.cms-ta::placeholder{color:rgba(240,236,228,.18)}
.cms-ta-sm{font-size:.85rem;padding:9px 11px}
.cms-compose-bar{display:flex;align-items:center;justify-content:space-between}
.cms-hint{font-family:'Space Mono',monospace;font-size:.44rem;color:rgba(240,236,228,.18);letter-spacing:.06em}
.cms-post{background:#c9a84c;border:none;color:#060504;font-family:'Space Mono',monospace;font-size:.54rem;letter-spacing:.1em;padding:7px 16px;cursor:pointer;border-radius:20px;font-weight:700;transition:.2s}
.cms-post:hover{background:#e0c060;transform:translateY(-1px)}

.cms-signin{display:flex;align-items:center;justify-content:center;gap:8px;padding:16px 22px;font-family:'Space Mono',monospace;font-size:.58rem;color:#c9a84c;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.04);transition:.2s}
.cms-signin:hover{background:rgba(201,168,76,.05)}
.cms-signin svg{color:#c9a84c}

.cms-list{flex:1;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:4px}
.cms-list::-webkit-scrollbar{width:3px}
.cms-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.06);border-radius:3px}

.cms-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;text-align:center;gap:8px}
.cms-empty-icon{font-size:2.2rem;opacity:.25;filter:grayscale(1)}
.cms-empty p{font-family:'Cinzel',serif;font-size:1rem;color:rgba(240,236,228,.35);margin:0}
.cms-empty span{font-family:'Space Mono',monospace;font-size:.5rem;color:rgba(240,236,228,.18);letter-spacing:.08em}

/* Comment thread */
.cmt{display:flex;gap:0;padding:14px 10px;border-radius:8px;transition:.15s;position:relative}
.cmt:hover{background:rgba(255,255,255,.02)}
.cmt-replying{background:rgba(201,168,76,.025)}

.cmt-thread{width:14px;flex-shrink:0;display:flex;justify-content:center;padding-top:6px}
.cmt-thread-line{width:2px;height:100%;background:rgba(255,255,255,.04);border-radius:1px}

.cmt-av-wrap{width:32px;flex-shrink:0;display:flex;justify-content:center;padding-top:2px}
.cmt-av{width:28px;height:28px;border-radius:50%;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-size:.46rem;color:#c9a84c;flex-shrink:0;overflow:hidden}
.cmt-av-img{width:100%;height:100%;object-fit:cover;border-radius:50%}

.cmt-body{flex:1;min-width:0;padding-left:10px}
.cmt-hd{display:flex;align-items:center;gap:7px;margin-bottom:5px;flex-wrap:wrap}
.cmt-name{font-family:'Space Mono',monospace;font-size:.58rem;color:#f0ece4;font-weight:600;letter-spacing:.02em}
.cmt-badge{font-family:'Space Mono',monospace;font-size:.4rem;background:rgba(95,191,140,.12);border:1px solid rgba(95,191,140,.3);color:#5fbf8c;padding:1px 6px;border-radius:4px;letter-spacing:.08em}
.cmt-dot{color:rgba(240,236,228,.12);font-size:.5rem}
.cmt-time{font-family:'Space Mono',monospace;font-size:.46rem;color:rgba(240,236,228,.22)}
.cmt-txt{font-family:'EB Garamond',serif;font-size:.92rem;line-height:1.6;color:rgba(240,236,228,.72);word-break:break-word;margin:0}

.cmt-actions{display:flex;gap:8px;margin-top:8px}
.cmt-act-btn{display:flex;align-items:center;gap:5px;background:none;border:none;color:rgba(240,236,228,.25);font-family:'Space Mono',monospace;font-size:.48rem;cursor:pointer;padding:4px 8px;border-radius:4px;transition:.15s;letter-spacing:.06em}
.cmt-act-btn:hover{color:#c9a84c;background:rgba(201,168,76,.06)}
.cmt-act-btn svg{opacity:.7}

/* Reply form */
.cmt-rf{display:flex;gap:10px;margin-top:12px;padding:12px;background:rgba(255,255,255,.02);border-radius:8px;border:1px solid rgba(255,255,255,.04)}
.cmt-rf-av{width:24px;height:24px;border-radius:50%;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-size:.4rem;color:#c9a84c;flex-shrink:0;overflow:hidden}
.cmt-rf-av-img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.cmt-rf-body{flex:1;display:flex;flex-direction:column;gap:8px}
.cmt-rf-acts{display:flex;gap:8px;justify-content:flex-end}
.cmt-cancel{background:none;border:none;color:rgba(240,236,228,.25);font-family:'Space Mono',monospace;font-size:.5rem;cursor:pointer;padding:6px 12px;transition:.2s;border-radius:4px}
.cmt-cancel:hover{color:#e74c3c;background:rgba(231,76,60,.06)}

/* Nested reply */
.cmt-nested{display:flex;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.03)}
.cmt-nested-line{width:2px;min-height:24px;background:rgba(201,168,76,.15);border-radius:1px;flex-shrink:0;margin-left:4px}
.cmt-nested-body{flex:1;min-width:0}

/* ═══════════════════════════════════
   GALLERY CARDS — Peak Edition
═══════════════════════════════════ */
.story-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:26px;padding:40px 56px 80px}

.sc{background:#0c0b09;border:1px solid rgba(255,255,255,.06);cursor:pointer;transition:all .35s cubic-bezier(.22,1,.36,1);overflow:hidden;display:flex;flex-direction:column;position:relative;border-radius:10px}
.sc:hover{border-color:rgba(201,168,76,.25);transform:translateY(-8px);box-shadow:0 28px 60px rgba(0,0,0,.6),0 0 0 1px rgba(201,168,76,.08)}

.sc-img-wrap{position:relative;aspect-ratio:16/10;overflow:hidden;background:#0a0907;flex-shrink:0;border-radius:10px 10px 0 0}
.sc-cover{width:100%;height:100%;object-fit:cover;display:block;transition:transform .6s cubic-bezier(.22,1,.36,1)}
.sc:hover .sc-cover{transform:scale(1.06)}

.sc-nocov{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0c0b09,#16130e);position:relative;overflow:hidden}
.sc-letter{font-family:'Cinzel Decorative',serif;font-size:4.5rem;color:rgba(201,168,76,.12);font-weight:700;position:relative;z-index:2}
.sc-nocov-deco{position:absolute;inset:0;background:radial-gradient(circle at 70% 30%,rgba(201,168,76,.04) 0%,transparent 60%)}

.sc-gtag{position:absolute;top:10px;left:10px;background:rgba(6,5,4,.88);border:1px solid rgba(201,168,76,.25);color:#c9a84c;font-family:'Space Mono',monospace;font-size:.44rem;letter-spacing:.12em;padding:4px 9px;border-radius:6px;backdrop-filter:blur(6px);z-index:3}
.sc-mine{position:absolute;top:10px;right:10px;background:rgba(95,191,140,.12);border:1px solid rgba(95,191,140,.3);color:#5fbf8c;font-family:'Space Mono',monospace;font-size:.4rem;letter-spacing:.1em;padding:3px 8px;border-radius:5px;z-index:3}
.sc-rating-pip{position:absolute;bottom:10px;left:10px;display:flex;align-items:center;gap:5px;background:rgba(6,5,4,.82);border:1px solid rgba(255,255,255,.08);padding:4px 9px;border-radius:20px;backdrop-filter:blur(6px);z-index:3}
.sc-rating-pip span{font-family:'Space Mono',monospace;font-size:.5rem;color:#c9a84c;letter-spacing:.04em}

.sc-hover-ov{position:absolute;inset:0;background:linear-gradient(to top,rgba(6,5,4,.7) 0%,rgba(6,5,4,.2) 50%,transparent 100%);display:flex;align-items:flex-end;justify-content:center;padding-bottom:20px;opacity:0;transition:opacity .3s;backdrop-filter:blur(1px);z-index:2}
.sc:hover .sc-hover-ov{opacity:1}
.sc-read-btn{background:rgba(201,168,76,.18);border:1px solid rgba(201,168,76,.55);color:#c9a84c;font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.12em;padding:10px 22px;cursor:pointer;border-radius:24px;transition:all .22s;display:flex;align-items:center;gap:8px;backdrop-filter:blur(8px)}
.sc-read-btn:hover{background:rgba(201,168,76,.3);transform:translateY(-2px);box-shadow:0 4px 20px rgba(201,168,76,.2)}
.sc-read-btn svg{transition:transform .2s}
.sc-read-btn:hover svg{transform:translateX(3px)}

.sc-body{padding:18px 20px 16px;flex:1;display:flex;flex-direction:column;gap:8px}
.sc-t{font-family:'Cinzel',serif;font-size:1.05rem;font-weight:600;line-height:1.25;color:#f0ece4;letter-spacing:.01em;margin:0}
.sc-d{font-size:.82rem;color:rgba(240,236,228,.38);line-height:1.55;flex:1;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

.sc-meta-row{display:flex;align-items:center;justify-content:space-between;margin-top:2px}
.sc-author{display:flex;align-items:center;gap:7px}
.sc-auth-av{width:20px;height:20px;border-radius:50%;background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.22);display:flex;align-items:center;justify-content:center;font-size:.42rem;color:#c9a84c;flex-shrink:0}
.sc-auth-img{width:20px;height:20px;border-radius:50%;object-fit:cover;flex-shrink:0}
.sc-auth-name{font-family:'Space Mono',monospace;font-size:.52rem;color:rgba(240,236,228,.45);letter-spacing:.02em}
.sc-wc{font-family:'Space Mono',monospace;font-size:.48rem;color:rgba(240,236,228,.22);letter-spacing:.04em}

.sc-ft{display:flex;align-items:center;justify-content:space-between;margin-top:6px;padding-top:10px;border-top:1px solid rgba(255,255,255,.04)}
.sc-stats{display:flex;gap:12px}
.sc-stat{display:flex;align-items:center;gap:4px;font-family:'Space Mono',monospace;font-size:.5rem;color:rgba(240,236,228,.28);transition:.2s}
.sc-stat svg{opacity:.5}
.sc:hover .sc-stat{color:rgba(240,236,228,.4)}
.sc-fav{background:none;border:none;cursor:pointer;color:rgba(240,236,228,.2);transition:all .2s;padding:5px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.sc-fav:hover{color:#e05c7a;background:rgba(224,92,122,.08);transform:scale(1.15)}
.sc-fav-on{color:#e05c7a}
.sc-fav-on:hover{background:rgba(224,92,122,.12)}

.gl-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:38vh;gap:14px;text-align:center;padding:56px}
.gl-empty-icon{font-size:3rem;opacity:.22;filter:grayscale(1)}
.gl-empty h3{font-family:'Cinzel',serif;font-size:1.35rem;font-weight:400;opacity:.4;margin:0}
.gl-empty-btn{margin-top:4px;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.35);color:#c9a84c;font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.1em;padding:10px 24px;cursor:pointer;border-radius:24px;transition:.2s}
.gl-empty-btn:hover{background:rgba(201,168,76,.2);transform:translateY(-1px)}

@media(max-width:768px){
  .cm-sidebar{width:100%;height:auto;position:static;border-left:none;border-top:1px solid rgba(255,255,255,.06)}
  .story-grid{padding:22px 16px 56px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:18px}
  .sc-img-wrap{aspect-ratio:16/9}
}
@media(max-width:480px){
  .story-grid{grid-template-columns:1fr}
}

/* ═══════════════════════════════════
   FLOATING FORMAT TOOLBAR
═══════════════════════════════════ */
.fmt-bar{position:fixed;z-index:900;display:flex;align-items:center;gap:3px;background:#12100d;border:1px solid rgba(201,168,76,.35);padding:5px;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.7),0 0 0 1px rgba(201,168,76,.1);animation:fmtPop .18s cubic-bezier(.22,1,.36,1)}
@keyframes fmtPop{from{opacity:0;transform:translate(-50%,-100%) scale(.92)}to{opacity:1;transform:translate(-50%,-120%) scale(1)}}
.fmt-b{width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:none;border:none;color:rgba(240,236,228,.65);font-family:'Space Mono',monospace;font-size:.72rem;cursor:pointer;border-radius:5px;transition:.15s}
.fmt-b:hover{background:rgba(201,168,76,.15);color:#c9a84c}
.fmt-sep{width:1px;height:18px;background:rgba(255,255,255,.1);margin:0 2px}

/* Rich text render styles in read view */
.s-p :global(b),.s-p :global(strong){color:#f0ece4;font-weight:600}
.s-p :global(i),.s-p :global(em){color:rgba(240,236,228,.9);font-style:italic}
.s-p :global(u){text-decoration-color:rgba(201,168,76,.5);text-underline-offset:3px}
.s-p :global(s){color:rgba(240,236,228,.5)}
.s-p :global(code){background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);color:#c9a84c;padding:1px 5px;border-radius:4px;font-family:'Space Mono',monospace;font-size:.82em}
.s-p :global(a){color:#c9a84c;text-decoration:underline;text-decoration-color:rgba(201,168,76,.4)}

.s-bq-t :global(b),.s-bq-t :global(strong){color:#f0ece4}
.s-bq-t :global(i),.s-bq-t :global(em){color:rgba(240,236,228,.95)}
.s-bq-t :global(code){background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.15);color:#c9a84c;padding:1px 5px;border-radius:4px;font-family:'Space Mono',monospace;font-size:.82em}

.s-dl-txt :global(b),.s-dl-txt :global(strong){color:#f0ece4}
.s-dl-txt :global(i),.s-dl-txt :global(em){color:rgba(240,236,228,.95)}

.s-letter :global(b),.s-letter :global(strong){color:#f0ece4}
.s-letter :global(i),.s-letter :global(em){color:rgba(240,236,228,.95)}
.s-letter :global(u){text-decoration-color:rgba(201,168,76,.4)}

.s-poem :global(b),.s-poem :global(strong){color:#f0ece4}
.s-poem :global(i),.s-poem :global(em){color:rgba(240,236,228,.95)}

.s-hl :global(b),.s-hl :global(strong){color:#f0ece4}
.s-hl :global(i),.s-hl :global(em){color:rgba(240,236,228,.95)}

/* Editor rich text appearance */
.b-para :global(b),.b-para :global(strong){color:#f0ece4}
.b-para :global(i),.b-para :global(em){color:rgba(240,236,228,.95);font-style:italic}
.b-para :global(u){text-decoration-color:rgba(201,168,76,.5);text-underline-offset:3px}
.b-para :global(code){background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);color:#c9a84c;padding:1px 5px;border-radius:4px;font-family:'Space Mono',monospace;font-size:.85em}
.b-para :global(a){color:#c9a84c;text-decoration:underline}

.bq-txt :global(b),.bq-txt :global(strong){color:#f0ece4}
.bq-txt :global(i),.bq-txt :global(em){color:rgba(240,236,228,.95)}

.bdl-txt :global(b),.bdl-txt :global(strong){color:#f0ece4}
.bdl-txt :global(i),.bdl-txt :global(em){color:rgba(240,236,228,.95)}

.bl-txt :global(b),.bl-txt :global(strong){color:#f0ece4}
.bl-txt :global(i),.bl-txt :global(em){color:rgba(240,236,228,.95)}

.bcl-txt :global(b),.bcl-txt :global(strong){color:#f0ece4}
.bcl-txt :global(i),.bcl-txt :global(em){color:rgba(240,236,228,.95)}

.bhl-txt :global(b),.bhl-txt :global(strong){color:#f0ece4}
.bhl-txt :global(i),.bhl-txt :global(em){color:rgba(240,236,228,.95)}

.bpoem-txt :global(b),.bpoem-txt :global(strong){color:#f0ece4}
.bpoem-txt :global(i),.bpoem-txt :global(em){color:rgba(240,236,228,.95)}

.bmap-lbl :global(b),.bmap-lbl :global(strong){color:#c9a84c}
.bmap-lbl :global(i),.bmap-lbl :global(em){color:rgba(201,168,76,.8)}
</style>