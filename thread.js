/* thread.js */

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const threadId = urlParams.get('id') || 'conv-1'; 

  const avatarEl = document.getElementById('threadAvatar');
  const nameEl = document.getElementById('threadName');
  const propertyEl = document.getElementById('threadProperty');
  const container = document.getElementById('messagesContainer');
  const form = document.getElementById('messageForm');
  const input = document.getElementById('messageInput');

  async function loadThreadData() {
    try {
      const response = await window.MessagingService.getThreadMessages(threadId);
      const { user, messages } = response.data;

      if (avatarEl) avatarEl.src = user.avatar;
      if (nameEl) nameEl.textContent = user.name;
      if (propertyEl) propertyEl.textContent = user.property;

      renderMessages(messages);
    } catch (err) {
      container.innerHTML = `<div class="conversations-empty">Error loading messages: ${err.message}</div>`;
    }
  }

  function renderMessages(messages) {
    container.innerHTML = `<div class="date-divider">Today</div>`;

    messages.forEach(msg => {
      const bubble = document.createElement('div');
      bubble.className = `bubble ${msg.isOutgoing ? 'outgoing' : 'incoming'}`;
      bubble.innerHTML = `
        ${msg.text}
        <span class="bubble-time">${msg.time}</span>
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
        await window.MessagingService.sendMessage(threadId, text);
        input.value = '';
        await loadThreadData(); // Refresh UI with newly appended message
      } catch (err) {
        alert(`Failed to send message: ${err.message}`);
      } finally {
        input.disabled = false;
        input.focus();
      }
    });
  }

  loadThreadData();
});