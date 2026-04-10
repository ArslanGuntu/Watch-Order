<script>
  import { goto } from '$app/navigation';
  
  let email = $state('');
  let password = $state('');
  let loading = $state(false);
  let error = $state('');
  
  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      goto('/app');
    }
  }
  
  async function handleSubmit(e) {
    e.preventDefault();
    error = '';
    
    if (!email || !password) {
      error = 'Please fill in all fields';
      return;
    }
    
    loading = true;
    
    // Simulate API call - replace with actual auth
    setTimeout(() => {
      loading = false;
      // On success: goto('/app');
      // For now just show error demo:
      // error = 'Invalid credentials';
    }, 1500);
  }
  
  function handleGoogleSignIn() {
    // Implement Google OAuth here
    console.log('Google sign in clicked');
  }
</script>

<div class="grain"></div>

<nav class="nav">
  <a class="nav-logo" href="/" onclick={(e) => { e.preventDefault(); goBack(); }}>
    <span class="nav-logo-mark">W</span>
    <span class="nav-logo-text">atch</span>
    <span class="nav-logo-accent">Order</span>
    <div class="nav-logo-dot"></div>
  </a>
</nav>

<main class="auth-container">
  <div class="auth-card">
    <div class="auth-header">
      <h1>Welcome Back</h1>
      <p>Sign in to continue tracking your watch journey</p>
    </div>
    
    {#if error}
      <div class="error-banner">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {error}
      </div>
    {/if}
    
    <form onsubmit={handleSubmit} class="auth-form">
      <div class="input-group">
        <label for="email">Email or Username</label>
        <input 
          type="text" 
          id="email"
          bind:value={email}
          placeholder="Enter your email"
          autocomplete="email"
          disabled={loading}
        />
      </div>
      
      <div class="input-group">
        <label for="password">Password</label>
        <input 
          type="password" 
          id="password"
          bind:value={password}
          placeholder="Enter your password"
          autocomplete="current-password"
          disabled={loading}
        />
        <a href="/forgot-password" class="forgot-link">Forgot password?</a>
      </div>
      
      <button type="submit" class="submit-btn" disabled={loading}>
        {#if loading}
          <div class="spinner-sm"></div>
          <span>SIGNING IN...</span>
        {:else}
          <span>SIGN IN</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        {/if}
      </button>
    </form>
    
    <div class="divider">
      <span>or continue with</span>
    </div>
    
    <button class="google-btn" onclick={handleGoogleSignIn} disabled={loading}>
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Sign in with Google
    </button>
    
    <div class="auth-footer">
      <p>Don't have an account? <a href="/signup">Sign up</a></p>
    </div>
  </div>
  
  <div class="auth-background-text">WATCH ORDER</div>
</main>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  :global(body) {
    background: #050505;
    color: #f0ece4;
    font-family: "Sora", sans-serif;
    overflow-x: hidden;
    min-height: 100vh;
  }

  .grain {
    position: fixed;
    inset: 0;
    z-index: 999;
    pointer-events: none;
    opacity: 0.04;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  .nav {
    position: fixed;
    top: 0;
    width: 100%;
    padding: 16px 50px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 500;
    box-sizing: border-box;
    background: rgba(5, 5, 5, 0.95);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .nav-logo {
    display: flex;
    align-items: baseline;
    gap: 0;
    text-decoration: none;
    cursor: pointer;
  }

  .nav-logo-mark {
    font-family: "Cormorant Garamond";
    font-size: 2.2rem;
    color: #c9a84c;
    font-weight: 700;
    line-height: 1;
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

  .nav-logo-dot {
    width: 5px;
    height: 5px;
    background: #c9a84c;
    border-radius: 50%;
    margin-left: 5px;
    box-shadow: 0 0 8px #c9a84c;
  }

  .auth-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 100px 20px 40px;
    position: relative;
    overflow: hidden;
  }

  .auth-card {
    background: #0a0a0a;
    border: 1px solid rgba(201, 168, 76, 0.2);
    border-radius: 12px;
    padding: 48px;
    width: 100%;
    max-width: 420px;
    position: relative;
    z-index: 10;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .auth-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .auth-header h1 {
    font-family: "Cormorant Garamond";
    font-size: 2.2rem;
    font-weight: 700;
    margin-bottom: 8px;
    color: #f0ece4;
  }

  .auth-header p {
    color: rgba(240, 236, 228, 0.5);
    font-size: 0.9rem;
  }

  .error-banner {
    background: rgba(231, 76, 60, 0.1);
    border: 1px solid rgba(231, 76, 60, 0.3);
    color: #e74c3c;
    padding: 12px 16px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 24px;
    font-size: 0.85rem;
    font-family: "Space Mono";
    font-size: 0.75rem;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 24px;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    position: relative;
  }

  .input-group label {
    font-family: "Space Mono";
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    color: rgba(240, 236, 228, 0.6);
    text-transform: uppercase;
  }

  .input-group input {
    background: #111;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 14px 16px;
    color: #f0ece4;
    font-family: "Sora", sans-serif;
    font-size: 0.95rem;
    transition: all 0.2s;
    outline: none;
  }

  .input-group input:focus {
    border-color: rgba(201, 168, 76, 0.5);
    background: #141414;
  }

  .input-group input::placeholder {
    color: rgba(240, 236, 228, 0.3);
  }

  .input-group input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .forgot-link {
    position: absolute;
    right: 0;
    top: 0;
    font-family: "Space Mono";
    font-size: 0.6rem;
    color: #c9a84c;
    text-decoration: none;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .forgot-link:hover {
    opacity: 1;
  }

  .submit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 16px;
    background: linear-gradient(135deg, rgba(201, 168, 76, 0.25), rgba(201, 168, 76, 0.1));
    border: 1px solid rgba(201, 168, 76, 0.5);
    border-radius: 8px;
    color: #c9a84c;
    font-family: "Space Mono";
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    cursor: pointer;
    transition: all 0.25s ease;
    margin-top: 8px;
  }

  .submit-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(201, 168, 76, 0.35), rgba(201, 168, 76, 0.15));
    border-color: #c9a84c;
    transform: translateY(-1px);
  }

  .submit-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .spinner-sm {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(201, 168, 76, 0.2);
    border-top-color: #c9a84c;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .divider {
    position: relative;
    text-align: center;
    margin-bottom: 24px;
  }

  .divider::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
  }

  .divider span {
    position: relative;
    background: #0a0a0a;
    padding: 0 16px;
    font-family: "Space Mono";
    font-size: 0.6rem;
    color: rgba(240, 236, 228, 0.4);
    letter-spacing: 0.1em;
  }

  .google-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    padding: 14px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: rgba(240, 236, 228, 0.8);
    font-family: "Space Mono";
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.25s ease;
    margin-bottom: 24px;
  }

  .google-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .google-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .auth-footer {
    text-align: center;
    padding-top: 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .auth-footer p {
    color: rgba(240, 236, 228, 0.5);
    font-size: 0.9rem;
  }

  .auth-footer a {
    color: #c9a84c;
    text-decoration: none;
    font-weight: 600;
    transition: opacity 0.2s;
  }

  .auth-footer a:hover {
    opacity: 0.8;
  }

  .auth-background-text {
    position: absolute;
    font-family: "Cormorant Garamond";
    font-size: 15vw;
    font-weight: 700;
    color: rgba(201, 168, 76, 0.03);
    white-space: nowrap;
    pointer-events: none;
    user-select: none;
    z-index: 1;
  }

  @media (max-width: 768px) {
    .nav {
      padding: 14px 20px;
    }
    
    .auth-card {
      padding: 32px 24px;
    }
    
    .auth-header h1 {
      font-size: 1.8rem;
    }
    
    .auth-background-text {
      font-size: 20vw;
    }
  }
</style>