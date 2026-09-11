/* ============================================================
   js/inbox.js
   Dynamic Real-Time Messaging & Enquiries Controller Engine
   ============================================================ */

// Where a non-landlord (property seeker) gets sent instead of the inbox.
const SEEKER_REDIRECT_URL = 'seeker-dashboard.html';

document.addEventListener('DOMContentLoaded', () => {
  // Wait for the partialsLoaded event from main.js so the DOM elements are present
  window.addEventListener('partialsLoaded', initializeInboxModule);

  if (document.getElementById('conversationsList')) {
    initializeInboxModule();
  }
});

let chatConversationsDataset = [];
let activeSelectedThreadId = null;

let currentActiveTabId = 'tabAll';


let pendingAttachments = [];

let activeThreadSeekerInfo = null;

// Small, safe default palette — expand freely, this is just common ones.
const EMOJI_PALETTE = ['😀', '😂', '😍', '👍', '🙏', '🎉', '😢', '😮', '❤️', '🔥', '👏', '🤔', '😊', '🙌', '✅', '📸'];

// Guards so we only ever attach the "click outside closes the emoji
// picker" listener once, no matter how many times a chat thread is opened.
let emojiOutsideClickHandlerAttached = false;

async function initializeInboxModule() {
  const container = document.getElementById('conversationsList');
  if (!container || container.dataset.initialized === "true") return;
  container.dataset.initialized = "true";

  // Landlord-only gate — property seekers never see thread data, not even
  // briefly, because we check before anything is fetched or rendered.
  const isLandlord = await enforceLandlordOnlyAccess();
  if (!isLandlord) return;

  setupTabListeners();
  await loadConversationsFeed();
}

/* ---------- 0. LANDLORD-ONLY ACCESS GUARD ---------- */

async function enforceLandlordOnlyAccess() {
  try {
    const user = window.currentUser || await window.api.get('/users/me');
    window.currentUser = user; // cache so other modules don't re-fetch

    const role = resolveRole(user);

   
    if (role === 'PROPERTY_SEEKER') {
      window.location.href = SEEKER_REDIRECT_URL;
      return false;
    }
    return true;

  } catch (err) {
    console.error('Could not verify landlord access, blocking by default:', err);
    // Fail closed: if we can't confirm who this is, don't show landlord
    // enquiry data.
    window.location.href = SEEKER_REDIRECT_URL;
    return false;
  }
}

function resolveRole(user) {
  const raw = user?.role || user?.userType || user?.accountType || user?.type || '';
  return String(raw).toUpperCase();
}

/* ---------- 1. FETCH LIVE THREADS FROM BACKEND ---------- */
async function loadConversationsFeed() {
  const container = document.getElementById('conversationsList');

  try {
    if (!window.api) throw new Error("api.js framework reference is missing.");

    // Dynamic execution targeting your exact Swagger path: GET /enquiries/threads
    // api.js handles appending the base URL and authorization tokens automatically
    const response = await window.api.get('/enquiries/threads');

    // Normalize data structure depending on how the response object is nested
    chatConversationsDataset = response?.items || response?.data || response || [];

    applyActiveTabFilterAndRender();
    updateTabBadgeIndicators(chatConversationsDataset);

  } catch (err) {
    console.error("Failed to fetch live enquiry threads:", err);
    if (container) {
      container.innerHTML = `<div class="chat-skeleton-loader" style="color:#E53E3E;">Could not connect to live message server: ${err.message}</div>`;
    }
  }
}

function applyActiveTabFilterAndRender() {
  let filtered = [...chatConversationsDataset];
  if (currentActiveTabId === 'tabUnread') {
    filtered = chatConversationsDataset.filter(t => t.isRead === false);
  } else if (currentActiveTabId === 'tabArchive') {
    filtered = chatConversationsDataset.filter(t => t.isArchived === true);
  }
  renderConversationsList(filtered);
}
/* ---------- 2. RENDER THE THREADS IN THE LIST ---------- */

function renderConversationsList(threads) {
  const container = document.getElementById('conversationsList');
  if (!container) return;

  if (threads.length === 0) {
    container.innerHTML = `<div class="chat-skeleton-loader">No active messages or enquiries found.</div>`;
    return;
  }

  container.innerHTML = threads.map(t => {
    
    const seeker = t.seeker || {};
    const property = t.property || {};

    const isUnread = t.isRead === false ? "unread-item" : "";
    const displaySnippet = t.message || t.lastMessage || "No messages recorded.";
    const displayAvatar = seeker.avatarUrl || t.userAvatar || "images/Avatar 4.svg";
    const userName = [seeker.firstName, seeker.lastName].filter(Boolean).join(' ') || t.userName || 'Verified Tenant';
    const propertySubject = property.title || t.propertySubject || 'General Enquiry';

    
    const timestamp = t.createdAt
      ? new Date(t.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })
      : 'Just now';

    return `
      <div class="convo-card-row ${isUnread}" data-id="${t.threadId}">
        <img src="${escapeHtml(displayAvatar)}" class="convo-avatar" alt="">
        <div class="convo-details">
          <div class="convo-meta-header">
            <span class="convo-name">${escapeHtml(userName)}</span>
            <span class="convo-time">${timestamp}</span>
          </div>
          <div class="convo-location">${escapeHtml(propertySubject)}</div>
          <div class="convo-snippet">${escapeHtml(displaySnippet)}</div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.convo-card-row').forEach(row => {
    row.addEventListener('click', () => {
      const threadId = row.dataset.id;
      openActiveChatWindow(threadId);
    });
  });
}

/* ---------- 2b. UPDATE TAB BADGE COUNTS ---------- */
function updateTabBadgeIndicators(threads) {
  const countAllEl = document.getElementById('countAll');
  const countUnreadEl = document.getElementById('countUnread');
  const countArchiveEl = document.getElementById('countArchive');

  const totalCount = threads.length;
  // isRead / isArchived live directly on the thread object — see note
  // in renderConversationsList.
  const unreadCount = threads.filter(t => t.isRead === false).length;
  const archiveCount = threads.filter(t => t.isArchived === true).length;

  if (countAllEl) countAllEl.textContent = `(${totalCount})`;
  if (countUnreadEl) countUnreadEl.textContent = `(${unreadCount})`;
  if (countArchiveEl) countArchiveEl.textContent = `(${archiveCount})`;

  updateSidebarInboxBadge(unreadCount);
}

/* ---------- 2c. SIDEBAR NOTIFICATION BADGE ---------- */

function updateSidebarInboxBadge(unreadCount) {
  const badge = document.getElementById('sidebarInboxBadge');
  if (!badge) return;

  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

/* ---------- 3. FETCH & OPEN SUB-MESSAGE CHAT WINDOW ---------- */
async function openActiveChatWindow(threadId) {
  activeSelectedThreadId = threadId;
  pendingAttachments = [];

  const listView = document.getElementById('conversationsListViewPanel');
  const chatWindow = document.getElementById('chatWindowView');

  if (listView) listView.style.display = 'none';
  if (chatWindow) {
    chatWindow.hidden = false;
    chatWindow.style.display = 'flex';
  }
  if (!chatWindow) return;
  const currentThread = chatConversationsDataset.find(c => String(c.threadId) === String(threadId));
  const seeker = currentThread?.seeker || {};
  const property = currentThread?.property || {};

  activeThreadSeekerInfo = seeker;

  const displayAvatar = seeker.avatarUrl || currentThread?.userAvatar || "images/Avatar 4.svg";
  const userName = [seeker.firstName, seeker.lastName].filter(Boolean).join(' ') || currentThread?.userName || 'Verified Tenant';
  const propertySubject = property.title || currentThread?.propertySubject || 'General Enquiry';

  // Build Chat Shell Window Frame layout
  chatWindow.innerHTML = `
    <div class="chat-header-banner">
      <button type="button" class="chat-back-arrow" id="closeChatBtn">
        <svg style="width:22px; height:22px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <img src="${displayAvatar}" class="convo-avatar" style="margin:0 4px 0 0; width:40px; height:40px;" alt="">
      <div>
        <div class="convo-name">${userName}</div>
        <div style="font-size:12px; color:#64748b; margin-top:2px;">Inquiry: ${propertySubject}</div>
      </div>
    </div>

    <div class="chat-messages-stream" id="chatMessagesStream">
      <div class="chat-skeleton-loader">Opening secure chat stream...</div>
    </div>

    <div class="chat-attachment-preview-tray" id="chatAttachmentTray" hidden></div>
    <div class="chat-send-status" id="chatSendStatus" hidden></div>

    <div class="chat-input-bar-action-tray" style="position:relative;">
      <form class="chat-input-form" id="chatSubmissionForm">
        <input type="file" id="chatAttachmentInput" accept="image/*,.pdf,.doc,.docx" multiple hidden>

        <button type="button" class="chat-action-btn" id="chatAttachBtn" aria-label="Attach File">
          <svg style="width:20px; height:20px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
          </svg>
        </button>

        <button type="button" class="chat-action-btn" id="chatEmojiBtn" aria-label="Insert Emoji">
          <svg style="width:20px; height:20px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
            <line x1="9" y1="9" x2="9.01" y2="9"></line>
            <line x1="15" y1="9" x2="15.01" y2="9"></line>
          </svg>
        </button>

        <input type="text" class="chat-input-field" id="messageInputField" placeholder="Type a message" autocomplete="off">

        <button type="submit" class="chat-action-btn chat-send-btn-pill" aria-label="Send Message"
                style="position:relative !important; z-index:1001 !important; pointer-events:auto !important;">
          <svg style="width:16px; height:16px; transform: rotate(90deg); margin-left: 2px; pointer-events:none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>

      <div class="chat-emoji-picker" id="chatEmojiPicker"
           style="display:none !important; position:absolute !important; bottom:56px; right:8px; z-index:1000; background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:10px; box-shadow:0 10px 30px rgba(15,23,42,0.15); grid-template-columns:repeat(4,1fr); gap:6px; max-width:200px;">
      </div>
    </div>
  `;

  // Initialize tracking buttons inside the active sub-frame window
  document.getElementById('closeChatBtn')?.addEventListener('click', closeChatWindow);
  document.getElementById('chatSubmissionForm')?.addEventListener('submit', handleSendMessageSubmit);
  document.getElementById('chatAttachBtn')?.addEventListener('click', () => {
    document.getElementById('chatAttachmentInput')?.click();
  });
  document.getElementById('chatAttachmentInput')?.addEventListener('change', handleAttachmentSelect);
  document.getElementById('chatEmojiBtn')?.addEventListener('click', toggleEmojiPicker);
  buildEmojiPicker();
  ensureEmojiOutsideClickHandler();

  await loadThreadMessages(threadId);

  // Trigger background thread optimization to clear unread states via PATCH /enquiries/{id}/read
  triggerMarkAsRead(threadId);
}

// Back arrow handler — returns to the conversation list and re-applies
// whichever tab (All / Unread / Archive) was active before this chat was
// opened, instead of always resetting to "All".
function closeChatWindow() {
  const listView = document.getElementById('conversationsListViewPanel');
  const chatWindow = document.getElementById('chatWindowView');

  if (chatWindow) chatWindow.style.display = 'none';
  if (listView) listView.style.display = 'flex';

  pendingAttachments = [];
  activeThreadSeekerInfo = null;

  // Re-sync with the server (loadConversationsFeed internally calls
  // applyActiveTabFilterAndRender, which respects currentActiveTabId).
  loadConversationsFeed();
}

/* ---------- 3b. LOAD (OR RELOAD) A THREAD'S MESSAGES ---------- */
// Pulled out of openActiveChatWindow so it can also be called right after
// sending a message — this is what actually fixes replies "disappearing":
// the UI now always reflects what the server actually saved, instead of
// trusting an optimistic bubble that may never have been persisted.
async function loadThreadMessages(threadId) {
  const stream = document.getElementById('chatMessagesStream');
  try {
    // Dynamic fetch matching your Swagger path: GET /api/v1/enquiries/threads/{threadId}
    const threadData = await window.api.get(`/enquiries/threads/${threadId}`);
    const messages = threadData?.messages || threadData?.data?.messages || threadData || [];
    renderMessageBubbles(messages);
  } catch (err) {
    console.error("Failed to load chat stream text blocks:", err);
    if (stream) {
      stream.innerHTML = `<div class="chat-skeleton-loader" style="color:#E53E3E;">Failed to load messages: ${err.message}</div>`;
    }
  }
}

function renderMessageBubbles(messages) {
  const stream = document.getElementById('chatMessagesStream');
  if (!stream) return;

  if (!messages || messages.length === 0) {
    stream.innerHTML = `<div style="text-align:center; padding:40px; font-size:13px; color:#94a3b8;">No message logs recorded. Send a greeting below!</div>`;
    return;
  }

  stream.innerHTML = messages.map(m => {
    // Real message shape (confirmed via a live GET
    // /enquiries/threads/{threadId} response): senderRole is the
    // reliable field ("LANDLORD" / "PROPERTY_SEEKER") — senderType
    // ("landlord"/"tenant") also works and is kept as a fallback.
    const isOutgoing = m.senderRole === 'LANDLORD'
      || m.senderType?.toLowerCase() === 'landlord'
      || m.sender?.role?.toLowerCase() === 'landlord';
    const directionClass = isOutgoing ? 'bubble-outgoing' : 'bubble-incoming';

    // m.time is backend-supplied but wrong — it's the UTC hour relabeled
    // as local time with no WAT (+1) offset applied (e.g. 23:24 UTC sent
    // as "11:24 PM" instead of the correct "12:24 AM" WAT). Always derive
    // the display time from createdAt with an explicit timeZone instead.
    const timeDisplay = m.createdAt
      ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })
      : '12:00 PM';

    const attachments = m.attachments || m.files || [];
    const attachmentsHtml = attachments.map(att => {
      const url = typeof att === 'string' ? att : (att.url || att.fileUrl || '');
      const name = (typeof att === 'object' && (att.name || att.fileName)) || 'Attachment';
      const isImage = (typeof att === 'object' && (att.type || '').startsWith('image'))
        || /\.(png|jpe?g|gif|webp)$/i.test(url);
      if (!url) return '';
      if (isImage) {
        return `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" class="bubble-attachment-image" alt="${escapeHtml(name)}"></a>`;
      }
      return `<a href="${url}" target="_blank" rel="noopener" class="bubble-attachment-doc">📄 ${escapeHtml(name)}</a>`;
    }).join('');

    const textContent = m.text || m.message || '';

    // Sender's real shape is { name, role, avatar } — NOT firstName/
    // lastName/avatarUrl. Falls back to the message's own full `seeker`
    // object (which DOES use firstName/lastName/avatarUrl) if `sender`
    // is ever missing, then to a generic label as a last resort.
    let senderInfoHtml = '';
    if (!isOutgoing) {
      const sender = m.sender || {};
      const seeker = m.seeker || {};
      const senderAvatar = sender.avatar || seeker.avatarUrl || "images/Avatar 4.svg";
      const senderName = sender.name
        || [seeker.firstName, seeker.lastName].filter(Boolean).join(' ')
        || 'Verified Tenant';
      senderInfoHtml = `
        <div class="bubble-sender-row">
          <img src="${escapeHtml(senderAvatar)}" class="bubble-sender-avatar" alt="">
          <span class="bubble-sender-name">${escapeHtml(senderName)}</span>
        </div>
      `;
    }

    return `
      <div class="chat-bubble-row ${directionClass}">
        <div class="bubble-content">
          ${senderInfoHtml}
          ${textContent ? escapeHtml(textContent) : ''}
          ${attachmentsHtml}
          <div class="chat-bubble-meta">
            <span>${timeDisplay}</span>
            ${isOutgoing ? `
              <svg style="width:12px; height:12px; color:#38bdf8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  stream.scrollTop = stream.scrollHeight;
}
/* ---------- 4. SEND A MESSAGE VIA POST /enquiries ---------- */
async function handleSendMessageSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('messageInputField');
  const sendBtn = document.querySelector('.chat-send-btn-pill');

  const userText = input?.value.trim() || '';
  const filesToSend = [...pendingAttachments];

  if (!userText && filesToSend.length === 0) return;
  if (!activeSelectedThreadId) return;

  input.value = "";
  clearAttachmentPreview();
  hideSendStatus();
  closeEmojiPicker();


  const stream = document.getElementById('chatMessagesStream');
  const localTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });
  const tempId = `temp-${Date.now()}`;
  if (stream) {
    stream.insertAdjacentHTML('beforeend', `
      <div class="chat-bubble-row bubble-outgoing" id="${tempId}">
        <div class="bubble-content">
          ${userText ? escapeHtml(userText) : ''}
          ${filesToSend.length > 0 ? `<div class="bubble-attachment-pending">${filesToSend.map(f => escapeHtml(f.name)).join(', ')} — sending…</div>` : ''}
          <div class="chat-bubble-meta"><span>${localTime}</span></div>
        </div>
      </div>
    `);
    stream.scrollTop = stream.scrollHeight;
  }

  if (sendBtn) sendBtn.disabled = true;

  try {
    if (filesToSend.length > 0) {
     
      const formData = new FormData();
      formData.append('threadId', activeSelectedThreadId);
      formData.append('message', userText);
      filesToSend.forEach(file => formData.append('attachments', file));
      await postEnquiryMultipart('/enquiries', formData);
    } else {
      
      await window.api.post('/enquiries', { threadId: activeSelectedThreadId, message: userText });
    }

    console.log("Live message dispatched cleanly over gateway pipelines.");

    document.getElementById(tempId)?.remove();
    await loadThreadMessages(activeSelectedThreadId);

  } catch (apiErr) {
    console.error("Backend transmission lost:", apiErr);
    document.getElementById(tempId)?.remove();
    showSendStatus(`Message failed to send: ${apiErr.message}. Please try again.`);

    // Restore what they typed/attached so nothing is lost.
    if (input) input.value = userText;
    pendingAttachments = filesToSend;
    renderAttachmentPreview();

  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

async function postEnquiryMultipart(endpoint, formData) {
  const token = localStorage.getItem(CONFIG.TOKEN_KEY);
  const url = CONFIG.USE_MOCK_DATA
    ? `${CONFIG.MOCK_BASE_PATH}${endpoint}`
    : `${CONFIG.BASE_URL}${endpoint}`;

  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { method: 'POST', headers, body: formData });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      message = body.message || message;
    } catch (_) { /* not JSON */ }
    throw new Error(message);
  }

  return response.json();
}

/* ---------- 4b. ATTACHMENTS (IMAGES & DOCUMENTS) ---------- */
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_MB = 10;

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

  e.target.value = ''; // allow re-selecting the same file later
  renderAttachmentPreview();
}

function renderAttachmentPreview() {
  const tray = document.getElementById('chatAttachmentTray');
  if (!tray) return;

  if (pendingAttachments.length === 0) {
    tray.hidden = true;
    tray.innerHTML = '';
    return;
  }

  tray.hidden = false;
  tray.innerHTML = pendingAttachments.map((file, idx) => `
    <span class="attachment-chip">
      ${file.type.startsWith('image/') ? '🖼️' : '📄'} ${escapeHtml(file.name)}
      <button type="button" class="attachment-remove-btn" data-index="${idx}" aria-label="Remove attachment">×</button>
    </span>
  `).join('');

  tray.querySelectorAll('.attachment-remove-btn').forEach(btn => {
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
  const statusEl = document.getElementById('chatSendStatus');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.hidden = false;
  clearTimeout(showSendStatus._timer);
  showSendStatus._timer = setTimeout(hideSendStatus, 5000);
}

function hideSendStatus() {
  const statusEl = document.getElementById('chatSendStatus');
  if (statusEl) statusEl.hidden = true;
}

/* ---------- 4c. EMOJI PICKER ---------- */
function buildEmojiPicker() {
  const picker = document.getElementById('chatEmojiPicker');
  if (!picker) return;

  picker.innerHTML = EMOJI_PALETTE.map(emoji =>
    `<button type="button" class="emoji-option" style="font-size:18px; line-height:1; padding:4px; border:none; background:none; cursor:pointer; border-radius:6px;">${emoji}</button>`
  ).join('');

  picker.querySelectorAll('.emoji-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      insertEmojiAtCursor(btn.textContent);
    });
  });
}


function isEmojiPickerOpen(picker) {
  return picker.style.display === 'grid';
}

function toggleEmojiPicker(e) {
  e?.stopPropagation();
  const picker = document.getElementById('chatEmojiPicker');
  if (!picker) return;

  if (isEmojiPickerOpen(picker)) {
    closeEmojiPicker();
  } else {
    picker.style.setProperty('display', 'grid', 'important');
  }
}

function closeEmojiPicker() {
  const picker = document.getElementById('chatEmojiPicker');
  if (!picker) return;
  picker.style.setProperty('display', 'none', 'important');
}

// Registered once (guarded), not per chat-open, so repeated thread opens
// don't stack up duplicate document-level listeners.
function ensureEmojiOutsideClickHandler() {
  if (emojiOutsideClickHandlerAttached) return;
  emojiOutsideClickHandlerAttached = true;

  document.addEventListener('click', (e) => {
    const picker = document.getElementById('chatEmojiPicker');
    const emojiBtn = document.getElementById('chatEmojiBtn');
    if (!picker || !isEmojiPickerOpen(picker)) return;
    if (picker.contains(e.target) || emojiBtn?.contains(e.target)) return;
    closeEmojiPicker();
  });
}

function insertEmojiAtCursor(emoji) {
  const input = document.getElementById('messageInputField');
  if (!input) return;

  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;

  input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
  const cursorPos = start + emoji.length;
  input.focus();
  input.setSelectionRange(cursorPos, cursorPos);
}

/* ---------- 5. DISPATCH READ EVENTS TRACKERS ---------- */
async function triggerMarkAsRead(threadId) {
  try {
    // Confirmed against Swagger: PATCH /api/v1/enquiries/threads/{threadId}/read-all
    // (the earlier '/enquiries/{id}/read' path doesn't exist on this API).
    if (typeof window.api?.patch === 'function') {
      await window.api.patch(`/enquiries/threads/${threadId}/read-all`);
    } else {
      // api.js doesn't expose a patch() method — fall back to a direct
      // fetch using the same auth/base-URL pattern as postEnquiryMultipart
      // above, so this doesn't depend on api.js being extended.
      await patchRequest(`/enquiries/threads/${threadId}/read-all`);
    }
  } catch (err) {
    console.warn("Read confirmation trace pass bypassed:", err.message);
  }
}

async function patchRequest(endpoint, body) {
  const token = localStorage.getItem(CONFIG.TOKEN_KEY);
  const url = CONFIG.USE_MOCK_DATA
    ? `${CONFIG.MOCK_BASE_PATH}${endpoint}`
    : `${CONFIG.BASE_URL}${endpoint}`;

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errBody = await response.json();
      message = errBody.message || message;
    } catch (_) { /* not JSON */ }
    throw new Error(message);
  }

  try { return await response.json(); } catch (_) { return null; }
}

/* ---------- 6. TAB NAVIGATION SYSTEM FILTERS ---------- */
function setupTabListeners() {
  const tabs = ['tabAll', 'tabUnread', 'tabArchive'];

  tabs.forEach(tabId => {
    const tabElement = document.getElementById(tabId);
    if (!tabElement) return;

    tabElement.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();

      console.log(`Tab change registered: ${tabId}`);

      currentActiveTabId = tabId;

      // Reset active classes across tabs
      tabs.forEach(t => document.getElementById(t)?.classList.remove('active'));
      this.classList.add('active');

      applyActiveTabFilterAndRender();
    });
  });
}

function setupHeaderSearch() {
  const input = document.getElementById('chatSearchInput');
  if (!input) return;

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    const filtered = chatConversationsDataset.filter(t => {
      const seeker = t.seeker || {};
      const name = [seeker.firstName, seeker.lastName].filter(Boolean).join(' ').toLowerCase();
      const property = (t.property?.title || t.propertySubject || '').toLowerCase();
      return name.includes(query) || property.includes(query);
    });
    renderConversationsList(query ? filtered : chatConversationsDataset);
  });
}

/* ---------- SHARED HELPER ---------- */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}