<script>
  import { supabase } from '$lib/supabase'
  import { goto } from '$app/navigation'

  let email = $state('')
  let password = $state('')
  let mode = $state('signin')
  let loading = $state(false)
  let errorMsg = $state('')
  let showPassword = $state(false)

  async function handleAuth() {
    loading = true
    errorMsg = ''
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        alert('Check your email to confirm your account!')
        mode = 'signin'
        email = ''
        password = ''
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        goto('/app')
      }
    } catch (e) {
      errorMsg = e.message
    } finally {
      loading = false
    }
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/app` }
    })
    if (error) errorMsg = error.message
  }

  function toggleMode() {
    mode = mode === 'signin' ? 'signup' : 'signin'
    errorMsg = ''
    email = ''
    password = ''
  }
</script>

<div class="auth-wrapper">
  <div class="auth-container">
    <!-- Logo -->
    <div class="auth-logo">
      <span class="logo-mark">W</span>
      <span class="logo-text">atch</span>
      <span class="logo-accent">Order</span>
      <div class="logo-dot"></div>
    </div>

    <!-- Header -->
    <div class="auth-header">
      <h1>{mode === 'signin' ? 'Welcome back' : 'Create account'}</h1>
      <p>{mode === 'signin' ? 'Sign in to continue your watch journey' : 'Start tracking your franchises today'}</p>
    </div>

    <!-- Error Message -->
    {#if errorMsg}
      <div class="auth-error">
        <span class="error-icon">⚠️</span>
        <span>{errorMsg}</span>
      </div>
    {/if}

    <!-- Form -->
    <form onsubmit={(e) => { e.preventDefault(); handleAuth() }}>
      <div class="input-group">
        <label>Email</label>
        <input type="email" bind:value={email} placeholder="your@email.com" required autocomplete="email"/>
      </div>

      <div class="input-group">
        <label>Password</label>
        <div class="password-wrapper">
          <input type={showPassword ? 'text' : 'password'} bind:value={password} placeholder="••••••••" required autocomplete="current-password"/>
          <button type="button" class="toggle-password" onclick={() => showPassword = !showPassword}>
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {#if mode === 'signin'}
        <div class="forgot-link">
          <a href="/forgot-password">Forgot password?</a>
        </div>
      {/if}

      <button type="submit" class="auth-btn-primary" disabled={loading}>
        {loading ? 'Loading...' : (mode === 'signin' ? 'Sign in' : 'Create account')}
      </button>
    </form>

    <!-- Divider -->
    <div class="auth-divider">
      <span></span>
      <span>or</span>
      <span></span>
    </div>

    <!-- Social Login -->
    <button class="auth-btn-google" onclick={signInWithGoogle}>
      <span>G</span>
      Continue with Google
    </button>

    <!-- Toggle Mode -->
    <div class="auth-footer">
      <p>
        {mode === 'signin' ? "Don't have an account?" : "Already have an account?"}
        <button type="button" class="toggle-mode" onclick={toggleMode}>
          {mode === 'signin' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </div>
  </div>
</div>

<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  .auth-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #050505;
  }

  .auth-container {
    width: 100%;
    max-width: 420px;
    margin: 20px;
    padding: 40px 36px;
    background: #0a0a0a;
    border: 1px solid rgba(201, 168, 76, 0.2);
    border-radius: 16px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  }

  /* Logo */
  .auth-logo {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0;
    margin-bottom: 32px;
  }

  .logo-mark {
    font-size: 2rem;
    font-weight: 700;
    color: #c9a84c;
    line-height: 1;
  }

  .logo-text {
    font-size: 1.5rem;
    font-weight: 300;
    color: #f0ece4;
  }

  .logo-accent {
    font-size: 1.5rem;
    font-weight: 600;
    font-style: italic;
    color: #f0ece4;
  }

  .logo-dot {
    width: 6px;
    height: 6px;
    background: #c9a84c;
    border-radius: 50%;
    margin-left: 5px;
    margin-bottom: 4px;
  }

  /* Header */
  .auth-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .auth-header h1 {
    font-size: 1.8rem;
    font-weight: 600;
    color: #f0ece4;
    margin-bottom: 8px;
  }

  .auth-header p {
    font-size: 0.85rem;
    color: rgba(240, 236, 228, 0.5);
  }

  /* Error */
  .auth-error {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(231, 76, 60, 0.1);
    border: 1px solid rgba(231, 76, 60, 0.3);
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 24px;
    color: #e74c3c;
    font-size: 0.8rem;
  }

  /* Form */
  form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .input-group label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(240, 236, 228, 0.5);
  }

  .input-group input {
    width: 100%;
    padding: 12px 14px;
    background: #111;
    border: 1px solid rgba(201, 168, 76, 0.2);
    border-radius: 8px;
    color: #f0ece4;
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .input-group input:focus {
    outline: none;
    border-color: #c9a84c;
  }

  .input-group input::placeholder {
    color: rgba(240, 236, 228, 0.2);
  }

  .password-wrapper {
    position: relative;
  }

  .password-wrapper input {
    padding-right: 60px;
  }

  .toggle-password {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: rgba(240, 236, 228, 0.5);
    font-size: 0.7rem;
    cursor: pointer;
    padding: 4px 8px;
  }

  .toggle-password:hover {
    color: #c9a84c;
  }

  .forgot-link {
    text-align: right;
    margin-top: -8px;
  }

  .forgot-link a {
    font-size: 0.7rem;
    color: rgba(240, 236, 228, 0.4);
    text-decoration: none;
  }

  .forgot-link a:hover {
    color: #c9a84c;
  }

  .auth-btn-primary {
    width: 100%;
    padding: 12px;
    background: #c9a84c;
    border: none;
    border-radius: 8px;
    color: #050505;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 8px;
  }

  .auth-btn-primary:hover:not(:disabled) {
    background: #e8c46a;
  }

  .auth-btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Divider */
  .auth-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 28px 0 20px;
  }

  .auth-divider span:first-child,
  .auth-divider span:last-child {
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
  }

  .auth-divider span:nth-child(2) {
    font-size: 0.7rem;
    color: rgba(240, 236, 228, 0.3);
    text-transform: uppercase;
  }

  /* Google Button */
  .auth-btn-google {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #f0ece4;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .auth-btn-google:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(201, 168, 76, 0.3);
  }

  .auth-btn-google span {
    font-size: 1.1rem;
    font-weight: bold;
  }

  /* Footer */
  .auth-footer {
    text-align: center;
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .auth-footer p {
    font-size: 0.8rem;
    color: rgba(240, 236, 228, 0.4);
  }

  .toggle-mode {
    background: transparent;
    border: none;
    color: #c9a84c;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    margin-left: 6px;
    font-size: 0.8rem;
  }

  .toggle-mode:hover {
    text-decoration: underline;
  }

  /* Responsive */
  @media (max-width: 500px) {
    .auth-container {
      padding: 32px 24px;
      margin: 16px;
    }
    .auth-header h1 {
      font-size: 1.5rem;
    }
  }
</style>