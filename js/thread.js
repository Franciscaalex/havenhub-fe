document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const threadId = urlParams.get('id');
  
  if (!threadId) {
    const container = document.getElementById('messagesContainer');
    if (container) container.innerHTML = '<div class="conversations-empty">No thread ID provided in URL.</div>';
    return;
  }

  const avatarEl = document.getElementById('threadAvatar');
  const nameEl = document.getElementById('threadName');
  const propertyEl = document.getElementById('propertyEl');
  const container = document.getElementById('messagesContainer');
  const form = document.getElementById('messageForm');
  const input = document.getElementById('messageInput');

  async function loadThreadData() {
    try {
      // FIX: Added the critical /api/v1 namespace prefix to match your server routing
      const response = await window.api.get(`/api/v1/messages/threads/${threadId}`);
      
      // Defensively checks for either an wrapper or directly nested layout keys
      const dataPayload = response.data || response;
      const messages = dataPayload.items || [];
      const user = dataPayload.user || { name: 'Chat Participant', avatar: '', property: '' };

      if (avatarEl && user.avatar) avatarEl.src = user.avatar;
      if (nameEl) nameEl.textContent = user.name;
      if (propertyEl) propertyEl.textContent = user.property;

      renderMessages(messages);
    } catch (err) {
      console.error('Could not load thread:', err);
      if (container) {
        container.innerHTML = `<div class="conversations-empty">Error loading messages: ${err.message}</div>`;
      }
    }
  }

  function renderMessages(messages) {
    if (!container) return;
    container.innerHTML = '<div class="date-divider">Today</div>';

    messages.forEach(msg => {
      const bubble = document.createElement('div');
      
      const directionClass = msg.isMine ? 'outgoing' : 'incoming';
      bubble.className = `bubble ${directionClass}`;
      bubble.innerHTML = `
        ${msg.text}
        <span class="bubble-time">${msg.time ?? ''}</span>
      `;
      container.appendChild(bubble);
    });

    container.scrollTop = container.scrollHeight;
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.disabled = true;

      try {
        // FIX: Added /api/v1 prefix here as well
        await window.api.post(`/api/v1/messages/threads/${threadId}`, { text });
        input.value = '';
        await loadThreadData(); 
      } catch (err) {
        console.error('Failed to send message:', err);
        alert(`Failed to send message: ${err.message}`);
      } finally {
        input.disabled = false;
        input.focus();
      }
    });
  }
  loadThreadData();
});
