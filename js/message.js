/* app.js  */

document.addEventListener('DOMContentLoaded', () => {
  let currentTab = 'all';
  let searchQuery = '';

  const listContainer = document.getElementById('conversationsList');
  const tabAll = document.getElementById('tabAll');
  const tabUnread = document.getElementById('tabUnread');
  const tabArchive = document.getElementById('tabArchive');
  const searchInput = document.querySelector('.search-input');

  async function loadConversations() {
    listContainer.innerHTML = `<div class="conversations-empty">Loading conversations...</div>`;

    try {
      const response = await window.MessagingService.getConversations(currentTab, searchQuery);
      const conversations = response.data;
      const counts = response.counts;

      // Update counters
      if (tabAll) tabAll.textContent = `All (${counts.all})`;
      if (tabUnread) tabUnread.textContent = `Unread (${counts.unread})`;
      if (tabArchive) tabArchive.textContent = `Archive (${counts.archive})`;

      if (!conversations || conversations.length === 0) {
        listContainer.innerHTML = `<div class="conversations-empty">No conversations found.</div>`;
        return;
      }

      listContainer.innerHTML = '';

      conversations.forEach(item => {
        const lastMsg = item.messages[item.messages.length - 1];
        const div = document.createElement('div');
        div.className = `conversation-item ${item.isUnread ? 'unread' : ''}`;

        div.innerHTML = `
          <img src="${item.avatar}" alt="${item.name}" class="conversation-avatar">
          <div class="conversation-details">
            <div class="conversation-top-row">
              <h4>${item.name}</h4>
              <span class="conversation-time">${lastMsg ? lastMsg.time : ''}</span>
            </div>
            <p class="conversation-property">${item.propertyTitle}</p>
            <p class="conversation-preview">${lastMsg ? lastMsg.text : 'No messages'}</p>
          </div>
        `;

        div.addEventListener('click', async () => {
          if (item.isUnread) {
            await window.MessagingService.markAsRead(item.id);
          }
          window.location.href = `thread.html?id=${item.id}`;
        });

        listContainer.appendChild(div);
      });
    } catch (err) {
      listContainer.innerHTML = `<div class="conversations-empty">Error: ${err.message}</div>`;
    }
  }

  [tabAll, tabUnread, tabArchive].forEach(tab => {
    if (!tab) return;
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');

      if (e.target.id === 'tabUnread') currentTab = 'unread';
      else if (e.target.id === 'tabArchive') currentTab = 'archive';
      else currentTab = 'all';

      loadConversations();
    });
  });

  // Handle Search Input
  let debounceTimer;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      searchQuery = e.target.value;
      debounceTimer = setTimeout(loadConversations, 200);
    });
  }

  loadConversations();
});
