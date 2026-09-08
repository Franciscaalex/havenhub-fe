/* thread.js */

(function () {
  const API_BASE = 'https://havenhub-be.onrender.com/api/v1';

  const TOKEN_STORAGE_KEY = 'havenhub_token';
  const USER_STORAGE_KEY = 'havenhub_user';

  function getToken() {
    try { return localStorage.getItem(TOKEN_STORAGE_KEY); } catch (e) { return null; }
  }

  function decodeJwt(token) {
    try {
      const payload = token.split('.')[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decodeURIComponent(escape(json)));
    } catch (e) {
      return null;
    }
  }

  function getCurrentUser() {
    try {
      const cached = localStorage.getItem(USER_STORAGE_KEY);
      if (cached) return JSON.parse(cached);
    } catch (e) { /* ignore */ }
    const token = getToken();
    if (token) {
      const claims = decodeJwt(token);
      if (claims) return { id: claims.sub || claims.id || claims.userId, role: claims.role };
    }
    return null;
  }

  async function apiFetch(path, options = {}) {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    if (res.status === 401) throw new Error('You need to be signed in to view your messages.');
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        message = body.message || message;
      } catch (e) { /* body wasn't JSON */ }
      throw new Error(message);
    }
    if (res.status === 204) return null;
    try { return await res.json(); } catch (e) { return null; }
  }

  function unwrap(response) {
    if (response && typeof response === 'object' && 'data' in response) return response.data;
    return response;
  }

  function pick(obj, keys, fallback) {
    if (!obj) return fallback;
    for (const k of keys) {
      const v = k.split('.').reduce((o, p) => (o == null ? undefined : o[p]), obj);
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return fallback;
  }

  function fmtClockTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return typeof value === 'string' ? value : '';
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function fmtRelativeTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const min = Math.round(diffMs / 60000);
    if (min < 1) return 'Just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.round(hr / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // ---- normalizers (defensive against unknown field names, see notes above) ----

  function normalizeMessage(raw, currentUserId) {
    const senderId = pick(raw, ['senderId', 'sender.id', 'userId', 'createdBy', 'authorId'], null);
    const explicitIsMine = pick(raw, ['isMine', 'isOwn', 'fromMe'], null);
    return {
      id: pick(raw, ['id', '_id', 'enquiryId'], `m-${Math.random().toString(36).slice(2)}`),
      text: pick(raw, ['message', 'text', 'content', 'body'], ''),
      ts: pick(raw, ['createdAt', 'timestamp', 'sentAt', 'date'], null),
      senderId,
      isMine: explicitIsMine !== null ? !!explicitIsMine : (senderId != null && currentUserId != null ? String(senderId) === String(currentUserId) : false),
    };
  }

  function normalizeThreadDetail(raw, currentUserId) {
    const payload = unwrap(raw);
    const rawMessages = Array.isArray(payload)
      ? payload
      : pick(payload, ['messages', 'enquiries', 'items', 'thread.messages'], []);

    const messages = (rawMessages || []).map((m) => normalizeMessage(m, currentUserId));
    const firstRaw = Array.isArray(payload) ? payload[0] : payload;
    const property = pick(payload, ['property', 'listing'], null) || (firstRaw && pick(firstRaw, ['property', 'listing'], null));
    const otherParty = pick(payload, ['landlord', 'owner', 'agent', 'otherParty', 'recipient'], null)
      || (firstRaw && pick(firstRaw, ['landlord', 'owner', 'agent', 'otherParty', 'recipient'], null));

    return {
      threadId: pick(payload, ['id', 'threadId'], null),
      propertyId: pick(payload, ['propertyId', 'property.id'], null) || (firstRaw && pick(firstRaw, ['propertyId', 'property.id'], null)),
      propertyTitle: pick(property, ['title', 'name'], null) || pick(payload, ['propertyTitle'], null) || 'Property enquiry',
      propertyAddress: pick(property, ['address', 'location'], ''),
      contactName: pick(otherParty, ['name', 'fullName'], null) || [pick(otherParty, ['firstName'], ''), pick(otherParty, ['lastName'], '')].join(' ').trim() || 'Landlord',
      messages,
    };
  }

  function normalizeThreadSummary(raw, currentUserId) {
    const property = pick(raw, ['property', 'listing'], null);
    const otherParty = pick(raw, ['landlord', 'owner', 'agent', 'otherParty', 'recipient'], null);
    const lastMessage = pick(raw, ['lastMessage', 'latestMessage'], null);

    const lastText = pick(lastMessage, ['message', 'text', 'content'], null) ?? pick(raw, ['lastMessageText', 'preview', 'message'], '');
    const lastAt = pick(lastMessage, ['createdAt', 'timestamp'], null) ?? pick(raw, ['lastMessageAt', 'updatedAt', 'createdAt'], null);
    const lastSenderId = pick(lastMessage, ['senderId', 'sender.id'], null) ?? pick(raw, ['lastMessageSenderId'], null);
    const lastIsMine = pick(lastMessage, ['isMine'], null) ?? (lastSenderId != null && currentUserId != null ? String(lastSenderId) === String(currentUserId) : null);

    const unreadCount = pick(raw, ['unreadCount'], null);
    const isUnread = pick(raw, ['isUnread', 'unread', 'hasUnread'], null) ?? (typeof unreadCount === 'number' ? unreadCount > 0 : false);

    const status = pick(raw, ['status'], '');
    const archived = pick(raw, ['archived', 'isArchived'], null) ?? String(status).toUpperCase() === 'ARCHIVED';

    return {
      id: pick(raw, ['id', 'threadId', '_id'], null),
      contactName: pick(otherParty, ['name', 'fullName'], null) || [pick(otherParty, ['firstName'], ''), pick(otherParty, ['lastName'], '')].join(' ').trim() || 'Landlord',
      propertyTitle: pick(property, ['title', 'name'], null) || pick(raw, ['propertyTitle'], '') || 'Property enquiry',
      lastMessageText: lastText || '',
      lastMessageAt: lastAt,
      lastMessageIsMine: !!lastIsMine,
      isUnread: !!isUnread,
      archived: !!archived,
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    const currentUser = getCurrentUser();
    const currentUserId = currentUser ? currentUser.id : null;

    // ---- list panel elements ----
    const listContainer = document.getElementById('seekerConversationsList');
    const tabAll = document.getElementById('seekerTabAll');
    const tabUnread = document.getElementById('seekerTabUnread');
    const tabArchive = document.getElementById('seekerTabArchive');
    const countAll = document.getElementById('seekerCountAll');
    const countUnread = document.getElementById('seekerCountUnread');
    const countArchive = document.getElementById('seekerCountArchive');

    // ---- chat panel elements ----
    const placeholder = document.getElementById('chatWindowPlaceholder');
    const threadOpen = document.getElementById('threadOpen');
    const backBtn = document.getElementById('seekerBackBtn');
    const avatarWrap = document.getElementById('threadAvatarWrap');
    const nameEl = document.getElementById('threadName');
    const propertyEl = document.getElementById('threadProperty');
    const messagesContainer = document.getElementById('messagesContainer');
    const form = document.getElementById('messageForm');
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const threadSearch = document.getElementById('threadSearch');

    const state = {
      tab: 'all',
      threads: [],
      sessionArchivedIds: new Set(),
      selectedId: null,
      openThreadMessages: [],
      openThreadPropertyId: null,
    };

    if (!getToken()) {
      listContainer.innerHTML = `<div class="conversations-empty">You're not signed in, so your messages can't be loaded. Please log in and try again.</div>`;
      return;
    }

    // ------------------------------ list panel ------------------------------

    async function loadThreads() {
      listContainer.innerHTML = `<div class="chat-skeleton-loader">Syncing secure connection channels...</div>`;
      try {
        const raw = await apiFetch('/enquiries/threads');
        const payload = unwrap(raw);
        const list = Array.isArray(payload) ? payload : pick(payload, ['threads', 'items'], []);
        state.threads = (list || []).map((t) => normalizeThreadSummary(t, currentUserId));
        renderList();
      } catch (err) {
        console.error('Could not load conversations:', err);
        listContainer.innerHTML = `<div class="conversations-empty">Couldn't load your messages: ${escapeHtml(err.message)}</div>`;
      }
    }

    function visibleThreads() {
      let items = state.threads.filter((t) => !(state.sessionArchivedIds.has(t.id) || t.archived) || state.tab === 'archive');

      if (state.tab === 'unread') items = items.filter((t) => t.isUnread && !t.archived && !state.sessionArchivedIds.has(t.id));
      else if (state.tab === 'archive') items = items.filter((t) => t.archived || state.sessionArchivedIds.has(t.id));

      return items.slice().sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
    }

    function updateCounts() {
      const active = state.threads.filter((t) => !(t.archived || state.sessionArchivedIds.has(t.id)));
      countAll.textContent = `(${active.length})`;
      countUnread.textContent = `(${active.filter((t) => t.isUnread).length})`;
      countArchive.textContent = `(${state.threads.filter((t) => t.archived || state.sessionArchivedIds.has(t.id)).length})`;
    }

    function renderList() {
      updateCounts();
      const items = visibleThreads();

      if (!items.length) {
        listContainer.innerHTML = `<div class="conversations-empty">No conversations here.</div>`;
        return;
      }

      listContainer.innerHTML = '';
      items.forEach((item) => {
        const div = document.createElement('div');
        div.className = `conversation-item ${item.isUnread ? 'unread' : ''} ${item.id === state.selectedId ? 'selected' : ''}`;

        const previewPrefix = item.lastMessageIsMine ? 'You: ' : '';
        div.innerHTML = `
          ${window.AvenHubUI.avatarHTML(item.contactName, '#3D6FB4', 48)}
          <div class="conversation-details">
            <div class="conversation-top-row">
              <h4>${escapeHtml(item.contactName)}</h4>
              <span style="display:flex; align-items:center;">
                <span class="conversation-time">${escapeHtml(fmtRelativeTime(item.lastMessageAt))}</span>
                ${item.isUnread ? '<span class="unread-indicator"></span>' : ''}
              </span>
            </div>
            <p class="conversation-property">${escapeHtml(item.propertyTitle)}</p>
            <p class="conversation-preview">${escapeHtml(previewPrefix + item.lastMessageText || 'No messages yet')}</p>
          </div>
          ${state.tab !== 'archive' ? `<button type="button" class="conversation-archive-btn" data-id="${item.id}" title="Archive conversation" aria-label="Archive conversation">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M21 8H3v13h18V8z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M1 3h22v5H1z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 12h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          </button>` : ''}
        `;

        div.addEventListener('click', (e) => {
          if (e.target.closest('.conversation-archive-btn')) return;
          openThread(item.id);
        });

        const archiveBtn = div.querySelector('.conversation-archive-btn');
        if (archiveBtn) {
          archiveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            archiveThread(item.id);
          });
        }

        listContainer.appendChild(div);
      });
    }

    async function archiveThread(id) {
      const confirmed = window.confirm('Archive this conversation? This calls the API\u2019s delete endpoint for this enquiry.');
      if (!confirmed) return;
      try {
        await apiFetch(`/enquiries/${encodeURIComponent(id)}`, { method: 'DELETE' });
        state.sessionArchivedIds.add(id);
        if (state.selectedId === id) closeThread();
        renderList();
      } catch (err) {
        alert(`Couldn't archive this conversation: ${err.message}`);
      }
    }

    [tabAll, tabUnread, tabArchive].forEach((tab) => {
      tab.addEventListener('click', () => {
        [tabAll, tabUnread, tabArchive].forEach((b) => b.classList.remove('active'));
        tab.classList.add('active');
        if (tab === tabUnread) state.tab = 'unread';
        else if (tab === tabArchive) state.tab = 'archive';
        else state.tab = 'all';
        renderList();
      });
    });

    // ------------------------------ chat panel ------------------------------

    function closeThread() {
      state.selectedId = null;
      threadOpen.hidden = true;
      placeholder.style.display = 'flex';
      document.querySelector('.seeker-list-panel')?.classList.remove('is-hidden-mobile');
    }

    async function openThread(id) {
      state.selectedId = id;
      placeholder.style.display = 'none';
      threadOpen.hidden = false;
      document.querySelector('.seeker-list-panel')?.classList.add('is-hidden-mobile');
      renderList(); // refresh selected highlight

      messagesContainer.innerHTML = '<div class="conversations-empty">Loading conversation…</div>';
      nameEl.textContent = '';
      propertyEl.textContent = '';

      try {
        const raw = await apiFetch(`/enquiries/threads/${encodeURIComponent(id)}`);
        const thread = normalizeThreadDetail(raw, currentUserId);

        state.openThreadPropertyId = thread.propertyId;
        state.openThreadMessages = thread.messages;

        avatarWrap.innerHTML = window.AvenHubUI
          .avatarHTML(thread.contactName, '#3D6FB4', 40)
          .replace('class="avatar"', 'class="avatar thread-avatar"');
        nameEl.textContent = thread.contactName;
        propertyEl.textContent = [thread.propertyTitle, thread.propertyAddress].filter(Boolean).join(' — ');

        renderMessages(state.openThreadMessages);

        // Mark read locally + on the server; failures here shouldn't block the UI.
        const localThread = state.threads.find((t) => t.id === id);
        if (localThread) localThread.isUnread = false;
        updateCounts();
        apiFetch(`/enquiries/threads/${encodeURIComponent(id)}/read-all`, { method: 'PATCH' }).catch(() => {});
      } catch (err) {
        console.error('Could not load thread:', err);
        messagesContainer.innerHTML = `<div class="conversations-empty">Couldn't load this conversation: ${escapeHtml(err.message)}</div>`;
      }
    }

    function renderMessages(messages, highlight) {
      messagesContainer.innerHTML = '<div class="date-divider">Conversation</div>';

      if (!messages.length) {
        const empty = document.createElement('div');
        empty.className = 'conversations-empty';
        empty.textContent = 'No messages yet — say hello below.';
        messagesContainer.appendChild(empty);
        return;
      }

      const q = (highlight || '').trim().toLowerCase();

      messages
        .slice()
        .sort((a, b) => new Date(a.ts || 0) - new Date(b.ts || 0))
        .forEach((msg) => {
          const bubble = document.createElement('div');
          bubble.className = `bubble ${msg.isMine ? 'outgoing' : 'incoming'}`;

          const text = escapeHtml(msg.text);
          if (q && text.toLowerCase().includes(q)) bubble.classList.add('bubble-highlight');

          const check = msg.isMine
            ? `<svg class="bubble-check" width="13" height="13" viewBox="0 0 24 24" fill="none" style="display:inline-block; vertical-align:-2px;"><path d="M2 13l5 5L22 4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
            : '';

          bubble.innerHTML = `${text}<span class="bubble-time">${escapeHtml(fmtClockTime(msg.ts))}${check}</span>`;
          messagesContainer.appendChild(bubble);
        });

      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    if (backBtn) backBtn.addEventListener('click', closeThread);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text || !state.selectedId) return;

      input.disabled = true;
      sendBtn.disabled = true;

      const optimistic = { id: `pending-${Date.now()}`, text, ts: new Date().toISOString(), isMine: true, senderId: currentUserId };
      state.openThreadMessages = [...state.openThreadMessages, optimistic];
      renderMessages(state.openThreadMessages);
      input.value = '';

      try {
        if (!state.openThreadPropertyId) throw new Error('Missing property reference for this thread — cannot send.');
        const raw = await apiFetch('/enquiries', {
          method: 'POST',
          body: JSON.stringify({ propertyId: state.openThreadPropertyId, message: text }),
        });
        const saved = normalizeMessage(unwrap(raw) || {}, currentUserId);
        optimistic.id = saved.id || optimistic.id;
        optimistic.ts = saved.ts || optimistic.ts;
        renderMessages(state.openThreadMessages);

        const localThread = state.threads.find((t) => t.id === state.selectedId);
        if (localThread) {
          localThread.lastMessageText = text;
          localThread.lastMessageAt = optimistic.ts;
          localThread.lastMessageIsMine = true;
        }
        renderList();
      } catch (err) {
        console.error('Failed to send message:', err);
        state.openThreadMessages = state.openThreadMessages.filter((m) => m.id !== optimistic.id);
        renderMessages(state.openThreadMessages);
        alert(`Failed to send message: ${err.message}`);
        input.value = text;
      } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
      }
    });

    let threadSearchDebounce;
    threadSearch.addEventListener('input', (e) => {
      clearTimeout(threadSearchDebounce);
      const val = e.target.value;
      threadSearchDebounce = setTimeout(() => renderMessages(state.openThreadMessages, val), 150);
    });

    loadThreads();
  });
})();