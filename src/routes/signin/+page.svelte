<script>
  import { goto } from '$app/navigation';
  
  let email = $state('');
  let password = $state('');
  let loading = $state(false);
  let error = $state('');
  
  function goBack() {
    goto('/app');
  }
  
  async function handleSubmit(e) {
    e.preventDefault();
    error = '';
    if (!email || !password) { error = 'Please fill in all fields'; return; }
    loading = true;
    setTimeout(() => { loading = false; }, 1500);
  }
  
  function handleGoogleSignIn() {
    console.log('Google sign in');
  }
</script>

<div class="fixed inset-0 z-[999] pointer-events-none opacity-[0.04]"
  style="background-image:url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")">
</div>

<nav class="fixed top-0 w-full z-[500] flex items-center px-[50px] py-4">
  <a class="flex items-baseline gap-0 no-underline" href="/" onclick={(e) => { e.preventDefault(); goBack(); }}>
    <span class="font-['Cormorant_Garamond'] text-[2.2rem] text-[#c9a84c] font-bold leading-none">W</span>
    <span class="font-['Cormorant_Garamond'] text-[1.6rem] font-light text-[#f0ece4]">atch</span>
    <span class="font-['Cormorant_Garamond'] italic text-[1.6rem] font-semibold opacity-85 text-[#f0ece4]">Order</span>
    <div class="w-[5px] h-[5px] bg-[#c9a84c] rounded-full ml-[5px] shadow-[0_0_8px_#c9a84c]"></div>
  </a>
</nav>

<main class="min-h-screen flex items-center justify-center px-5 pt-[100px] pb-10 relative overflow-hidden bg-[#050505]">
  <div class="absolute font-['Cormorant_Garamond'] text-[15vw] font-bold text-[rgba(201,168,76,0.03)] whitespace-nowrap pointer-events-none select-none z-[1] top-1/2 -translate-y-1/2">
    WATCHORDER
  </div>

  <div class="bg-[#0a0a0a] border border-[rgba(201,168,76,0.2)] rounded-xl p-12 w-full max-w-[420px] relative z-10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
    <div class="text-center mb-8">
      <h1 class="font-['Cormorant_Garamond'] text-[2.2rem] font-bold mb-2 text-[#f0ece4]">Welcome Back</h1>
      <p class="text-[rgba(240,236,228,0.5)] text-[0.9rem]">Sign in to continue tracking your watch journey</p>
    </div>

    {#if error}
      <div class="bg-[rgba(231,76,60,0.1)] border border-[rgba(231,76,60,0.3)] text-[#e74c3c] px-4 py-3 rounded-md flex items-center gap-2.5 mb-6 font-['Space_Mono'] text-[0.75rem]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {error}
      </div>
    {/if}

    <form onsubmit={handleSubmit} class="flex flex-col gap-5 mb-6">
      <div class="flex flex-col gap-2 relative">
        <label class="font-['Space_Mono'] text-[0.65rem] tracking-[0.1em] text-[rgba(240,236,228,0.6)] uppercase" for="email">Email or Username</label>
        <input type="text" id="email" bind:value={email} placeholder="Enter your email" autocomplete="email" disabled={loading}
          class="bg-[#111] border border-white/10 rounded-md px-4 py-3.5 text-[#f0ece4] font-['Sora'] text-[0.95rem] outline-none transition-all focus:border-[rgba(201,168,76,0.5)] focus:bg-[#141414] placeholder:text-[rgba(240,236,228,0.3)] disabled:opacity-60 disabled:cursor-not-allowed" />
      </div>

      <div class="flex flex-col gap-2 relative">
        <label class="font-['Space_Mono'] text-[0.65rem] tracking-[0.1em] text-[rgba(240,236,228,0.6)] uppercase" for="password">Password</label>
        <input type="password" id="password" bind:value={password} placeholder="Enter your password" autocomplete="current-password" disabled={loading}
          class="bg-[#111] border border-white/10 rounded-md px-4 py-3.5 text-[#f0ece4] font-['Sora'] text-[0.95rem] outline-none transition-all focus:border-[rgba(201,168,76,0.5)] focus:bg-[#141414] placeholder:text-[rgba(240,236,228,0.3)] disabled:opacity-60" />
        <a href="/forgot-password" class="absolute right-0 top-0 font-['Space_Mono'] text-[0.6rem] text-[#c9a84c] no-underline opacity-70 hover:opacity-100 transition-opacity">Forgot password?</a>
      </div>

      <button type="submit" disabled={loading}
        class="flex items-center justify-center gap-2.5 w-full py-4 bg-gradient-to-br from-[rgba(201,168,76,0.25)] to-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.5)] rounded-lg text-[#c9a84c] font-['Space_Mono'] text-[0.75rem] tracking-[0.12em] cursor-pointer transition-all mt-2 hover:from-[rgba(201,168,76,0.35)] hover:to-[rgba(201,168,76,0.15)] hover:border-[#c9a84c] hover:-translate-y-px disabled:opacity-70 disabled:cursor-not-allowed">
        {#if loading}
          <div class="w-4 h-4 border-2 border-[rgba(201,168,76,0.2)] border-t-[#c9a84c] rounded-full animate-spin"></div>
          <span>SIGNING IN...</span>
        {:else}
          <span>SIGN IN</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        {/if}
      </button>
    </form>

    <div class="relative text-center mb-6">
      <div class="absolute top-1/2 left-0 right-0 h-px bg-white/10"></div>
      <span class="relative bg-[#0a0a0a] px-4 font-['Space_Mono'] text-[0.6rem] text-[rgba(240,236,228,0.4)] tracking-[0.1em]">or continue with</span>
    </div>

    <button onclick={handleGoogleSignIn} disabled={loading}
      class="flex items-center justify-center gap-3 w-full py-3.5 bg-transparent border border-white/15 rounded-lg text-[rgba(240,236,228,0.8)] font-['Space_Mono'] text-[0.75rem] cursor-pointer transition-all mb-6 hover:bg-white/5 hover:border-white/25 disabled:opacity-60 disabled:cursor-not-allowed">
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Sign in with Google
    </button>

    <div class="text-center pt-6 border-t border-white/[0.06]">
      <p class="text-[rgba(240,236,228,0.5)] text-[0.9rem]">
        Don't have an account? <a href="/signup" class="text-[#c9a84c] no-underline font-semibold hover:opacity-80 transition-opacity">Create one</a>
      </p>
    </div>
  </div>
</main>
