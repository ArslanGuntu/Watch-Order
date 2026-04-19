<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import Chat from '$lib/components/Chat.svelte';
  
  let user = $state(null);
  let loading = $state(true);
  
  onMount(async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) {
      goto('/signin');
      return;
    }
    user = u;
    loading = false;
  });
</script>

<svelte:head>
  <title>Live Chat • WatchOrder</title>
</svelte:head>

{#if loading}
  <div class="loading-container">
    <div class="spinner"></div>
    <span>Loading...</span>
  </div>
{:else if user}
  <div class="grain"></div>
  
  <nav class="nav">
    <a class="nav-logo" href="/app">
      <span class="nav-logo-mark">W</span>
      <span class="nav-logo-text">atch</span>
      <span class="nav-logo-accent">Order</span>
    </a>
    <div class="nav-right">
      <a href="/app" class="back-btn">← Back to Guide</a>
    </div>
  </nav>
  
  <main>
    <div class="container">
      <div class="chat-page">
        <div class="chat-page-header">
          <h1>Live Community Chat</h1>
          <p>Join the conversation with fellow movie enthusiasts</p>
        </div>
        
        <div class="chat-full">
          <Chat chatType="global" />
        </div>
      </div>
    </div>
  </main>
{/if}

<style>
  .grain {
    position: fixed;
    inset: 0;
    z-index: 999;
    pointer-events: none;
    opacity: 0.04;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }
  
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    gap: 16px;
    background: #050505;
    color: #c9a84c;
    font-family: "Space Mono";
  }
  
  .spinner {
    width: 32px;
    height: 32px;
    border: 2px solid rgba(201, 168, 76, 0.2);
    border-top-color: #c9a84c;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .nav {
    position: fixed;
    top: 0;
    width: 100%;
    padding: 16px 50px;
    background: rgba(5,5,5,0.95);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255,255,255,0.07);
    z-index: 500;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-sizing: border-box;
  }
  
  .nav-logo {
    display: flex;
    align-items: baseline;
    text-decoration: none;
    cursor: pointer;
  }
  
  .nav-logo-mark {
    font-family: "Cormorant Garamond";
    font-size: 2.2rem;
    color: #c9a84c;
    font-weight: 700;
  }
  
  .nav-logo-text {
    font-family: "Cormorant Garamond";
    font-size: 1.6rem;
    font-weight: 300;
    color: #f0ece4;
  }
  
  .nav-logo-accent {
    font-family: "Cormorant Garamond";
    font-style: italic;
    font-size: 1.6rem;
    font-weight: 600;
    opacity: 0.85;
    color: #f0ece4;
  }
  
  .nav-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  
  .back-btn {
    font-family: "Space Mono";
    font-size: 0.7rem;
    color: #c9a84c;
    text-decoration: none;
    padding: 8px 16px;
    border: 1px solid rgba(201, 168, 76, 0.3);
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .back-btn:hover {
    background: rgba(201, 168, 76, 0.1);
    border-color: #c9a84c;
  }
  
  .container {
    padding: 0 50px;
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .chat-page {
    padding: 120px 0 80px;
  }
  
  .chat-page-header {
    text-align: center;
    margin-bottom: 40px;
  }
  
  .chat-page-header h1 {
    font-family: "Cormorant Garamond";
    font-size: 3rem;
    font-weight: 600;
    color: #c9a84c;
    margin-bottom: 12px;
  }
  
  .chat-page-header p {
    font-family: "Space Mono";
    font-size: 0.8rem;
    color: rgba(240, 236, 228, 0.4);
  }
  
  .chat-full {
    max-width: 800px;
    margin: 0 auto;
  }
  
  .chat-full :global(.chat-container) {
    position: relative;
    bottom: auto;
    right: auto;
  }
  
  .chat-full :global(.chat-window) {
    position: relative;
    bottom: auto;
    right: auto;
    width: 100%;
    height: 600px;
  }
  
  @media (max-width: 768px) {
    .nav { padding: 14px 20px; }
    .container { padding: 0 20px; }
    .chat-page-header h1 { font-size: 2rem; }
    .chat-full :global(.chat-window) { height: 500px; }
  }
</style>