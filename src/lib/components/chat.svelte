<script>
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabase';
  
  let { chatType = 'global', entityId = null } = $props();
  
  let user = $state(null);
  let messages = $state([]);
  let newMessage = $state('');
  let isLoading = $state(true);
  let chatOpen = $state(false);
  let unreadCount = $state(0);
  let channel = $state(null);
  
  onMount(async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    user = u;
    
    if (user) {
      await loadMessages();
      subscribeToMessages();
    }
  });
  
  async function loadMessages() {
    isLoading = true;
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_type', chatType)
      .order('created_at', { ascending: true })
      .limit(100);
    
    if (entityId) {
      query = query.eq('entity_id', entityId);
    }
    
    const { data, error } = await query;
    
    if (!error && data) {
      messages = data;
      markAsRead();
    }
    isLoading = false;
  }
  
  function subscribeToMessages() {
    let filter = `chat_type=eq.${chatType}`;
    if (entityId) {
      filter = `and(chat_type=eq.${chatType},entity_id=eq.${entityId})`;
    }
    
    channel = supabase
      .channel(`chat:${chatType}:${entityId || 'global'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: filter
        },
        (payload) => {
          const newMsg = payload.new;
          if (newMsg.user_id !== user?.id) {
            messages = [...messages, newMsg];
            if (!chatOpen) {
              unreadCount++;
            }
          } else if (newMsg.user_id === user?.id) {
            messages = [...messages, newMsg];
          }
        }
      )
      .subscribe();
  }
  
  async function sendMessage() {
    if (!newMessage.trim() || !user) return;
    
    const message = {
      chat_type: chatType,
      entity_id: entityId,
      user_id: user.id,
      user_email: user.email,
      user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
      user_avatar: user.user_metadata?.avatar_url || null,
      content: newMessage.trim(),
      created_at: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('chat_messages')
      .insert([message]);
    
    if (!error) {
      newMessage = '';
    }
  }
  
  function markAsRead() {
    unreadCount = 0;
  }
  
  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  
  onDestroy(() => {
    if (channel) {
      supabase.removeChannel(channel);
    }
  });
</script>

{#if user}
  <div class="chat-container">
    <button class="chat-toggle" onclick={() => { chatOpen = !chatOpen; if (chatOpen) markAsRead(); }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.5" fill="none"/>
      </svg>
      {#if unreadCount > 0}
        <span class="unread-badge">{unreadCount}</span>
      {/if}
    </button>
    
    {#if chatOpen}
      <div class="chat-window">
        <div class="chat-header">
          <div class="chat-header-info">
            <div class="chat-header-icon">💬</div>
            <div>
              <h3>
                {chatType === 'global' ? 'Global Chat' : 
                 chatType === 'movie' ? 'Movie Discussion' : 
                 'Franchise Discussion'}
              </h3>
              <p>{messages.length} messages • Live</p>
            </div>
          </div>
          <button class="chat-close" onclick={() => chatOpen = false}>×</button>
        </div>
        
        <div class="chat-messages">
          {#if isLoading}
            <div class="chat-loading">
              <div class="spinner-sm"></div>
              <span>Loading messages...</span>
            </div>
          {:else if messages.length === 0}
            <div class="chat-empty">
              <span class="chat-empty-icon">💭</span>
              <p>No messages yet</p>
              <span class="chat-empty-sub">Be the first to start the conversation!</span>
            </div>
          {:else}
            {#each messages as msg (msg.id)}
              <div class="chat-message {msg.user_id === user.id ? 'own-message' : ''}">
                <div class="message-avatar">
                  {#if msg.user_avatar}
                    <img src={msg.user_avatar} alt={msg.user_name} />
                  {:else}
                    <div class="message-avatar-initials">
                      {msg.user_name?.slice(0, 2).toUpperCase() || '?'}
                    </div>
                  {/if}
                </div>
                <div class="message-content">
                  <div class="message-header">
                    <span class="message-name">{msg.user_name}</span>
                    <span class="message-time">{formatTime(msg.created_at)}</span>
                  </div>
                  <div class="message-text">{msg.content}</div>
                </div>
              </div>
            {/each}
          {/if}
        </div>
        
        <div class="chat-input-area">
          <textarea
            class="chat-input"
            placeholder="Type a message..."
            bind:value={newMessage}
            onkeydown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          ></textarea>
          <button class="chat-send" onclick={sendMessage} disabled={!newMessage.trim()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="1.5" fill="none"/>
            </svg>
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .chat-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 1000;
  }
  
  .chat-toggle {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #c9a84c, #a07830);
    border: none;
    cursor: pointer;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #050505;
    transition: all 0.3s ease;
    box-shadow: 0 4px 20px rgba(201, 168, 76, 0.4);
  }
  
  .chat-toggle:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 28px rgba(201, 168, 76, 0.6);
  }
  
  .unread-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #e74c3c;
    color: white;
    font-family: "Space Mono";
    font-size: 0.65rem;
    font-weight: bold;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pulse 1s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }
  
  .chat-window {
    position: absolute;
    bottom: 72px;
    right: 0;
    width: 360px;
    height: 520px;
    background: #0d0d0d;
    border: 1px solid rgba(201, 168, 76, 0.2);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.25s ease;
  }
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .chat-header {
    background: linear-gradient(135deg, rgba(201, 168, 76, 0.1), rgba(160, 120, 48, 0.05));
    padding: 16px;
    border-bottom: 1px solid rgba(201, 168, 76, 0.15);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .chat-header-info {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  
  .chat-header-icon {
    font-size: 28px;
  }
  
  .chat-header h3 {
    font-family: "Sora";
    font-size: 0.9rem;
    font-weight: 600;
    color: #c9a84c;
    margin: 0;
  }
  
  .chat-header p {
    font-family: "Space Mono";
    font-size: 0.55rem;
    color: rgba(240, 236, 228, 0.3);
    margin: 4px 0 0;
  }
  
  .chat-close {
    background: none;
    border: none;
    color: rgba(240, 236, 228, 0.4);
    font-size: 28px;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  
  .chat-close:hover {
    color: #c9a84c;
  }
  
  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .chat-messages::-webkit-scrollbar {
    width: 4px;
  }
  
  .chat-messages::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
  }
  
  .chat-messages::-webkit-scrollbar-thumb {
    background: rgba(201, 168, 76, 0.3);
    border-radius: 2px;
  }
  
  .chat-message {
    display: flex;
    gap: 12px;
    animation: messageFade 0.3s ease;
  }
  
  @keyframes messageFade {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .message-avatar {
    flex-shrink: 0;
  }
  
  .message-avatar img,
  .message-avatar-initials {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }
  
  .message-avatar-initials {
    background: rgba(201, 168, 76, 0.15);
    border: 1px solid rgba(201, 168, 76, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "Space Mono";
    font-size: 0.65rem;
    font-weight: bold;
    color: #c9a84c;
  }
  
  .message-content {
    flex: 1;
  }
  
  .message-header {
    display: flex;
    gap: 8px;
    align-items: baseline;
    margin-bottom: 4px;
  }
  
  .message-name {
    font-family: "Sora";
    font-size: 0.75rem;
    font-weight: 600;
    color: #c9a84c;
  }
  
  .message-time {
    font-family: "Space Mono";
    font-size: 0.55rem;
    color: rgba(240, 236, 228, 0.25);
  }
  
  .message-text {
    font-family: "Sora";
    font-size: 0.8rem;
    color: rgba(240, 236, 228, 0.8);
    line-height: 1.4;
    word-wrap: break-word;
  }
  
  .own-message {
    flex-direction: row-reverse;
  }
  
  .own-message .message-content {
    text-align: right;
  }
  
  .own-message .message-header {
    justify-content: flex-end;
  }
  
  .own-message .message-text {
    background: rgba(201, 168, 76, 0.08);
    padding: 8px 12px;
    border-radius: 12px;
    border-bottom-right-radius: 4px;
  }
  
  .chat-input-area {
    padding: 16px;
    border-top: 1px solid rgba(201, 168, 76, 0.1);
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }
  
  .chat-input {
    flex: 1;
    background: rgba(20, 20, 20, 0.8);
    border: 1px solid rgba(201, 168, 76, 0.2);
    border-radius: 8px;
    padding: 10px 12px;
    font-family: "Sora";
    font-size: 0.8rem;
    color: #f0ece4;
    resize: none;
    min-height: 40px;
    max-height: 100px;
    transition: all 0.2s;
  }
  
  .chat-input:focus {
    outline: none;
    border-color: #c9a84c;
    background: rgba(10, 10, 10, 0.95);
  }
  
  .chat-input::placeholder {
    color: rgba(240, 236, 228, 0.2);
  }
  
  .chat-send {
    background: rgba(201, 168, 76, 0.1);
    border: 1px solid rgba(201, 168, 76, 0.3);
    border-radius: 8px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #c9a84c;
    transition: all 0.2s;
  }
  
  .chat-send:hover:not(:disabled) {
    background: rgba(201, 168, 76, 0.2);
    border-color: #c9a84c;
    transform: scale(1.05);
  }
  
  .chat-send:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .chat-loading,
  .chat-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px 20px;
    text-align: center;
  }
  
  .chat-empty-icon {
    font-size: 48px;
    opacity: 0.3;
  }
  
  .chat-empty p {
    font-family: "Sora";
    font-size: 0.85rem;
    color: rgba(240, 236, 228, 0.3);
    margin: 0;
  }
  
  .chat-empty-sub {
    font-family: "Space Mono";
    font-size: 0.6rem;
    color: rgba(240, 236, 228, 0.2);
  }
  
  .spinner-sm {
    width: 20px;
    height: 20px;
    border: 1.5px solid rgba(201, 168, 76, 0.2);
    border-top-color: #c9a84c;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>