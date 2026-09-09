/* thread.js — property seeker messaging (mirrors inbox.js's feature set,
   but strictly for PROPERTY_SEEKER accounts) */

(function () {
  const API_BASE = 'https://havenhub-be.onrender.com/api/v1';

  // Where a landlord gets sent instead of this seeker inbox — the inverse
  // of inbox.js's SEEKER_REDIRECT_URL. Adjust if your landlord home page
  // has a different filename.
  const LANDLORD_REDIRECT_URL = 'landlord-dashboard.html';

  const TOKEN_STORAGE_KEY = 'auth_token';
  const USER_STORAGE_KEY = 'havenhub_user';

  
  const EMOJI_PALETTE = ['😀', '😂', '😍', '👍', '🙏', '🎉', '😢', '😮', '❤️', '🔥', '👏', '🤔', '😊', '🙌', '✅', '📸'];
  const MAX_ATTACHMENTS = 5;
  const MAX_ATTACHMENT_MB = 10;

  let pendingAttachments = [];
  let emojiOutsideClickHandlerAttached = false;

  function getToken() {
    try { return localStorage.getItem(TOKEN_STORAGE_KEY); } catch (e) { return null; }
  }

  // function decodeJwt(token) {
  //   try {
  //     const payload = token.split('.')[1];
  //     const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  //     return JSON.parse(decodeURIComponent(escape(json)));
  //   } catch (e) {
  //     return null;
  //   }
  // }

    function decodeJwt(token) {
    try {
      // Clean off any tracking hashes or trailing dashes appended to the raw token string
      const cleanToken = token.split('--')[0];
      const payload = cleanToken.split('.')[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decodeURIComponent(escape(json)));
    } catch (e) {
      console.error("JWT Decoding failed:", e);
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

  // Separate from apiFetch because FormData needs the browser to set its
  // own multipart Content-Type (with boundary) — same reasoning as
  // inbox.js's postEnquiryMultipart.
  async function apiFetchMultipart(path, formData) {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        message = body.message || message;
      } catch (e) { /* not JSON */ }
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

  function avatarHtml(name, color, size) {
    if (window.AvenHubUI && typeof window.AvenHubUI.avatarHTML === 'function') {
      return window.AvenHubUI.avatarHTML(name, color, size);
    }
    const initials = (name || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
    return `<div class="avatar" style="background:${color};width:${size}px;height:${size}px;">${initials}</div>`;
  }

  // ---- normalizers ----

  function normalizeMessage(raw, currentUserId) {
    const senderId = pick(raw, ['senderId', 'sender.id', 'userId', 'createdBy', 'authorId'], null);
    const explicitIsMine = pick(raw, ['isMine', 'isOwn', 'fromMe'], null);
    return {
      id: pick(raw, ['id', '_id', 'enquiryId'], `m-${Math.random().toString(36).slice(2)}`),
      text: pick(raw, ['message', 'text', 'content', 'body'], ''),
      ts: pick(raw, ['createdAt', 'timestamp', 'sentAt', 'date'], null),
      senderId,
      isMine: explicitIsMine !== null ? !!explicitIsMine : (senderId != null && currentUserId != null ? String(senderId) === String(currentUserId) : false),
      attachments: pick(raw, ['attachments', 'files'], []),
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

  document.addEventListener('DOMContentLoaded', async () => {
    // ---------- SEEKER-ONLY ACCESS GUARD ----------
    // Mirrors inbox.js's enforceLandlordOnlyAccess, inverted: this page is
    // for PROPERTY_SEEKER accounts only. Landlords get redirected before
    // any thread data is fetched or rendered.
    const isSeeker = await enforceSeekerOnlyAccess();
    if (!isSeeker) return;

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

    // ---- NEW: emoji + attachment elements ----
    // These IDs are NOT yet in your thread.html — add matching markup for
    // whichever of these you want active (paperclip button, hidden file
    // input, attachment tray, emoji button, emoji picker container),
    // following the same shape as inbox.js's dynamically-built chat bar.
    const emojiBtn = document.getElementById('chatEmojiBtn');
    const emojiPicker = document.getElementById('chatEmojiPicker');
    const attachBtn = document.getElementById('chatAttachBtn');
    const attachmentInput = document.getElementById('chatAttachmentInput');
    const attachmentTray = document.getElementById('chatAttachmentTray');
    const sendStatusEl = document.getElementById('chatSendStatus');

    if (!listContainer) {
      console.error('thread.js: #seekerConversationsList not found in the DOM — cannot render the conversation list.');
      return;
    }

    [
      ['seekerTabAll', tabAll], ['seekerTabUnread', tabUnread], ['seekerTabArchive', tabArchive],
      ['seekerCountAll', countAll], ['seekerCountUnread', countUnread], ['seekerCountArchive', countArchive],
      ['chatWindowPlaceholder', placeholder], ['threadOpen', threadOpen], ['threadAvatarWrap', avatarWrap],
      ['threadName', nameEl], ['threadProperty', propertyEl], ['messagesContainer', messagesContainer],
      ['messageForm', form], ['messageInput', input], ['sendBtn', sendBtn],
    ].forEach(([id, el]) => {
      if (!el) console.error(`thread.js: #${id} not found in the DOM — related functionality will be skipped.`);
    });
    [
      ['chatEmojiBtn', emojiBtn], ['chatEmojiPicker', emojiPicker], ['chatAttachBtn', attachBtn],
      ['chatAttachmentInput', attachmentInput], ['chatAttachmentTray', attachmentTray], ['chatSendStatus', sendStatusEl],
    ].forEach(([id, el]) => {
      if (!el) console.warn(`thread.js: #${id} not found — this new feature (emoji/attachments) needs matching HTML added to thread.html.`);
    });

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
      if (countAll) countAll.textContent = `(${active.length})`;
      if (countUnread) countUnread.textContent = `(${active.filter((t) => t.isUnread).length})`;
      if (countArchive) countArchive.textContent = `(${state.threads.filter((t) => t.archived || state.sessionArchivedIds.has(t.id)).length})`;
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

        const previewText = item.lastMessageText
          ? (item.lastMessageIsMine ? 'You: ' : '') + item.lastMessageText
          : 'No messages yet';

        div.innerHTML = `
          ${avatarHtml(item.contactName, '#3D6FB4', 48)}
          <div class="conversation-details">
            <div class="conversation-top-row">
              <h4>${escapeHtml(item.contactName)}</h4>
              <span style="display:flex; align-items:center;">
                <span class="conversation-time">${escapeHtml(fmtRelativeTime(item.lastMessageAt))}</span>
                ${item.isUnread ? '<span class="unread-indicator"></span>' : ''}
              </span>
            </div>
            <p class="conversation-property">${escapeHtml(item.propertyTitle)}</p>
            <p class="conversation-preview">${escapeHtml(previewText)}</p>
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
      if (!tab) return;
      tab.addEventListener('click', () => {
        [tabAll, tabUnread, tabArchive].forEach((b) => b && b.classList.remove('active'));
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
      if (threadOpen) threadOpen.hidden = true;
      if (placeholder) placeholder.style.display = 'flex';
      document.querySelector('.seeker-list-panel')?.classList.remove('is-hidden-mobile');
    }

    async function openThread(id) {
      if (!threadOpen || !messagesContainer) {
        console.error('thread.js: cannot open a thread — the chat panel markup is missing from this page.');
        return;
      }

      state.selectedId = id;
      pendingAttachments = [];
      renderAttachmentPreview();
      closeEmojiPicker();
      if (placeholder) placeholder.style.display = 'none';
      threadOpen.hidden = false;
      document.querySelector('.seeker-list-panel')?.classList.add('is-hidden-mobile');
      renderList(); // refresh selected highlight

      messagesContainer.innerHTML = '<div class="conversations-empty">Loading conversation…</div>';
      if (nameEl) nameEl.textContent = '';
      if (propertyEl) propertyEl.textContent = '';

      try {
        const raw = await apiFetch(`/enquiries/threads/${encodeURIComponent(id)}`);
        const thread = normalizeThreadDetail(raw, currentUserId);

        state.openThreadPropertyId = thread.propertyId;
        state.openThreadMessages = thread.messages;

        if (avatarWrap) {
          avatarWrap.innerHTML = avatarHtml(thread.contactName, '#3D6FB4', 40)
            .replace('class="avatar"', 'class="avatar thread-avatar"');
        }
        if (nameEl) nameEl.textContent = thread.contactName;
        if (propertyEl) propertyEl.textContent = [thread.propertyTitle, thread.propertyAddress].filter(Boolean).join(' — ');

        renderMessages(state.openThreadMessages);

        const localThread = state.threads.find((t) => t.id === id);
        if (localThread) localThread.isUnread = false;
        updateCounts();
        apiFetch(`/enquiries/threads/${encodeURIComponent(id)}/read-all`, { method: 'PATCH' }).catch(() => {});
      } catch (err) {
        console.error('Could not load thread:', err);
        messagesContainer.innerHTML = `<div class="conversations-empty">Couldn't load this conversation: ${escapeHtml(err.message)}</div>`;
      }
    }

    function messageAttachmentsHtml(attachments) {
      return (attachments || []).map((att) => {
        const url = typeof att === 'string' ? att : (att.url || att.fileUrl || '');
        const name = (typeof att === 'object' && (att.name || att.fileName)) || 'Attachment';
        const isImage = (typeof att === 'object' && (att.type || '').startsWith('image')) || /\.(png|jpe?g|gif|webp)$/i.test(url);
        if (!url) return '';
        if (isImage) return `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" class="bubble-attachment-image" alt="${escapeHtml(name)}"></a>`;
        return `<a href="${url}" target="_blank" rel="noopener" class="bubble-attachment-doc">📄 ${escapeHtml(name)}</a>`;
      }).join('');
    }

    function renderMessages(messages, highlight) {
      if (!messagesContainer) return;
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

          bubble.innerHTML = `${text}${messageAttachmentsHtml(msg.attachments)}<span class="bubble-time">${escapeHtml(fmtClockTime(msg.ts))}${check}</span>`;
          messagesContainer.appendChild(bubble);
        });

      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    if (backBtn) backBtn.addEventListener('click', closeThread);

    if (form && input && sendBtn) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        const filesToSend = [...pendingAttachments];
        if ((!text && filesToSend.length === 0) || !state.selectedId) return;

        input.disabled = true;
        sendBtn.disabled = true;
        closeEmojiPicker();

        const optimistic = {
          id: `pending-${Date.now()}`,
          text,
          ts: new Date().toISOString(),
          isMine: true,
          senderId: currentUserId,
          attachments: filesToSend.map((f) => ({ name: f.name, type: f.type })),
        };
        state.openThreadMessages = [...state.openThreadMessages, optimistic];
        renderMessages(state.openThreadMessages);
        input.value = '';
        clearAttachmentPreview();

        try {
          if (!state.openThreadPropertyId) throw new Error('Missing property reference for this thread — cannot send.');

          let raw;
          if (filesToSend.length > 0) {
            // Swagger confirms POST /enquiries takes propertyId + message —
            // attachments aren't in that documented schema either, so this
            // assumes an `attachments` multipart field the same way
            // inbox.js does. Confirm with the backend if uploads fail.
            const formData = new FormData();
            formData.append('propertyId', state.openThreadPropertyId);
            formData.append('message', text);
            filesToSend.forEach((file) => formData.append('attachments', file));
            raw = await apiFetchMultipart('/enquiries', formData);
          } else {
            raw = await apiFetch('/enquiries', {
              method: 'POST',
              body: JSON.stringify({ propertyId: state.openThreadPropertyId, message: text }),
            });
          }

          const saved = normalizeMessage(unwrap(raw) || {}, currentUserId);
          optimistic.id = saved.id || optimistic.id;
          optimistic.ts = saved.ts || optimistic.ts;
          if (saved.attachments && saved.attachments.length) optimistic.attachments = saved.attachments;
          renderMessages(state.openThreadMessages);

          const localThread = state.threads.find((t) => t.id === state.selectedId);
          if (localThread) {
            localThread.lastMessageText = text || (filesToSend.length ? '📎 Attachment' : '');
            localThread.lastMessageAt = optimistic.ts;
            localThread.lastMessageIsMine = true;
          }
          renderList();
        } catch (err) {
          console.error('Failed to send message:', err);
          state.openThreadMessages = state.openThreadMessages.filter((m) => m.id !== optimistic.id);
          renderMessages(state.openThreadMessages);
          showSendStatus(`Failed to send message: ${err.message}`);
          input.value = text;
          pendingAttachments = filesToSend;
          renderAttachmentPreview();
        } finally {
          input.disabled = false;
          sendBtn.disabled = false;
          input.focus();
        }
      });
    } else {
      console.error('thread.js: message form, input, or send button missing — replying is disabled on this page.');
    }

    if (threadSearch) {
      let threadSearchDebounce;
      threadSearch.addEventListener('input', (e) => {
        clearTimeout(threadSearchDebounce);
        const val = e.target.value;
        threadSearchDebounce = setTimeout(() => renderMessages(state.openThreadMessages, val), 150);
      });
    }

    // ---------- ATTACHMENTS ----------
    if (attachBtn && attachmentInput) {
      attachBtn.addEventListener('click', () => attachmentInput.click());
      attachmentInput.addEventListener('change', handleAttachmentSelect);
    }

    function handleAttachmentSelect(e) {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        if (pendingAttachments.length >= MAX_ATTACHMENTS) {
          showSendStatus(`You can attach up to ${MAX_ATTACHMENTS} files per message.`);
          break;
        }
        if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
          showSendStatus(`"${file.name}" is over ${MAX_ATTACHMENT_MB}MB and was skipped.`);
          continue;
        }
        pendingAttachments.push(file);
      }
      e.target.value = '';
      renderAttachmentPreview();
    }

    function renderAttachmentPreview() {
      if (!attachmentTray) return;
      if (pendingAttachments.length === 0) {
        attachmentTray.hidden = true;
        attachmentTray.innerHTML = '';
        return;
      }
      attachmentTray.hidden = false;
      attachmentTray.innerHTML = pendingAttachments.map((file, idx) => `
        <span class="attachment-chip">
          ${file.type.startsWith('image/') ? '🖼️' : '📄'} ${escapeHtml(file.name)}
          <button type="button" class="attachment-remove-btn" data-index="${idx}" aria-label="Remove attachment">×</button>
        </span>
      `).join('');
      attachmentTray.querySelectorAll('.attachment-remove-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          pendingAttachments.splice(Number(btn.dataset.index), 1);
          renderAttachmentPreview();
        });
      });
    }

    function clearAttachmentPreview() {
      pendingAttachments = [];
      renderAttachmentPreview();
    }

    function showSendStatus(message) {
      if (!sendStatusEl) { console.warn(message); return; }
      sendStatusEl.textContent = message;
      sendStatusEl.hidden = false;
      clearTimeout(showSendStatus._timer);
      showSendStatus._timer = setTimeout(() => { sendStatusEl.hidden = true; }, 5000);
    }

    // ---------- EMOJI PICKER ----------
    // Same !important-forced display toggling as the fixed inbox.js — this
    // avoids the exact bug we found there (an external CSS rule silently
    // keeping the picker permanently visible regardless of the hidden
    // attribute or a plain style assignment).
    if (emojiPicker) {
      emojiPicker.innerHTML = EMOJI_PALETTE.map((emoji) =>
        `<button type="button" class="emoji-option" style="font-size:18px; line-height:1; padding:4px; border:none; background:none; cursor:pointer; border-radius:6px;">${emoji}</button>`
      ).join('');
      emojiPicker.querySelectorAll('.emoji-option').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          insertEmojiAtCursor(btn.textContent);
        });
      });
    }

    if (emojiBtn) {
      emojiBtn.addEventListener('click', toggleEmojiPicker);
      ensureEmojiOutsideClickHandler();
    }

    function isEmojiPickerOpen() {
      return !!emojiPicker && emojiPicker.style.display === 'grid';
    }

    function toggleEmojiPicker(e) {
      e?.stopPropagation();
      if (!emojiPicker) return;
      if (isEmojiPickerOpen()) closeEmojiPicker();
      else emojiPicker.style.setProperty('display', 'grid', 'important');
    }

    function closeEmojiPicker() {
      if (!emojiPicker) return;
      emojiPicker.style.setProperty('display', 'none', 'important');
    }

    function ensureEmojiOutsideClickHandler() {
      if (emojiOutsideClickHandlerAttached) return;
      emojiOutsideClickHandlerAttached = true;
      document.addEventListener('click', (e) => {
        if (!isEmojiPickerOpen()) return;
        if (emojiPicker.contains(e.target) || emojiBtn?.contains(e.target)) return;
        closeEmojiPicker();
      });
    }

    function insertEmojiAtCursor(emoji) {
      if (!input) return;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
      const cursorPos = start + emoji.length;
      input.focus();
      input.setSelectionRange(cursorPos, cursorPos);
    }

        // ---------- PROGRAMMATIC MESSAGING PIPELINE ----------
    async function sendMessageToLandlord(threadId, text, files = []) {
      if (!threadId) {
        console.error("Cannot send message: Missing thread ID allocation context.");
        return;
      }

      try {
        let rawResponse;

        if (files.length > 0) {
          const formData = new FormData();
          formData.append('message', text);
          if (state.openThreadPropertyId) {
            formData.append('propertyId', state.openThreadPropertyId);
          }
          files.forEach((file) => formData.append('attachments', file));
          rawResponse = await apiFetchMultipart(`/enquiries/threads/${encodeURIComponent(threadId)}`, formData);
        } else {
          rawResponse = await apiFetch(`/enquiries/threads/${encodeURIComponent(threadId)}`, {
            method: 'POST',
            body: JSON.stringify({ message: text }),
          });
        }

        const savedMessage = normalizeMessage(unwrap(rawResponse) || {}, currentUserId);

        if (state.selectedId === threadId) {
          state.openThreadMessages.push(savedMessage);
          renderMessages(state.openThreadMessages);
        }

        const localThreadSummary = state.threads.find((t) => t.id === threadId);
        if (localThreadSummary) {
          localThreadSummary.lastMessageText = text || (files.length ? '📎 Attachment' : '');
          localThreadSummary.lastMessageAt = savedMessage.ts || new Date().toISOString();
          localThreadSummary.lastMessageIsMine = true;
          renderList();
        }

      } catch (error) {
        console.error("Failed to transmit message pipeline stream:", error);
        alert(`Message delivery failure: ${error.message}`);
      }
    }

        // ---------- URL PARAMETER INITIALIZATION PIPELINE ----------
    async function initializeFromUrlParams() {
      const urlParams = new URLSearchParams(window.location.search);
      const propertyId = urlParams.get('propertyId');
      const landlordId = urlParams.get('landlordId');

      if (!propertyId) return; // Not navigating from a property link; continue normal flow

      state.openThreadPropertyId = propertyId;

      // 1. Look through existing threads to see if we already have an open conversation
      const existingThread = state.threads.find(t => String(t.propertyId) === String(propertyId));

      if (existingThread) {
        // Conversation already exists; open it up immediately
        openThread(existingThread.id);
      } else {
        // 2. New interaction: Prepare the UI panels for a fresh conversation
        if (placeholder) placeholder.style.display = 'none';
        if (threadOpen) threadOpen.hidden = false;
        if (messagesContainer) {
          messagesContainer.innerHTML = '<div class="conversations-empty">Initiating fresh connection thread... Send a message below to start your conversation with the landlord.</div>';
        }
        
        // Populate header elements with fallback titles until first transmission completes
        if (nameEl) nameEl.textContent = "Landlord Partner";
        if (propertyEl) propertyEl.innerHTML = `<strong>New Inquiry Channel</strong>`;
        
        // Assign a mock state ID to avoid network collisions before a message is created
        state.selectedId = `new-channel-${Date.now()}`;
        state.openThreadMessages = [];
      }
    }

    loadThreads();
  });

  function enforceSeekerOnlyAccess() {
    const role = (localStorage.getItem('selectedRole') || '').toUpperCase().trim();
    if (role !== 'PROPERTY_SEEKER') {
      window.location.href = LANDLORD_REDIRECT_URL;
      return false;
    }
    return true;
  }
})();