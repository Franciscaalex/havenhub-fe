document.addEventListener('DOMContentLoaded', loadThreads);

async function loadThreads() {
  const container = document.getElementById('threadList'); // adjust to match teammate's actual container ID
  if (!container) return;

  try {
    // ASSUMPTION — endpoint not yet confirmed
    const response = await window.api.get('/messages/threads');
    const threads = response.items || [];

    if (threads.length === 0) {
      container.innerHTML = `<p class="inbox-empty">No messages yet.</p>`;
      return;
    }

    container.innerHTML = threads.map(t => `
      <a href="thread.html?id=${t.id}" class="inbox-thread-row ${t.unread ? 'is-unread' : ''}">
        <img src="${t.participantAvatar ?? 'images/Avatar 4.svg'}" alt="" class="inbox-thread-avatar">
        <div class="inbox-thread-body">
          <span class="inbox-thread-name">${t.participantName ?? 'Unknown'}</span>
          <span class="inbox-thread-preview">${t.lastMessage ?? ''}</span>
        </div>
        <span class="inbox-thread-time">${t.lastMessageTime ?? ''}</span>
      </a>
    `).join('');
  } catch (err) {
    container.innerHTML = `<p class="inbox-empty error-text" style="display:block;">Could not load messages: ${err.message}</p>`;
  }
}