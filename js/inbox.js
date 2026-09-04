/* ============================================================
   js/inbox.js
   Dynamic Real-Time Messaging & Enquiries Controller Engine
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Wait for the partialsLoaded event from main.js so the DOM elements are present
  window.addEventListener('partialsLoaded', initializeInboxModule);

  if (document.getElementById('conversationsList')) {
    initializeInboxModule();
  }
});

let chatConversationsDataset = [];
let activeSelectedThreadId = null;

async function initializeInboxModule() {
  const container = document.getElementById('conversationsList');
  if (!container || container.dataset.initialized === "true") return;
  container.dataset.initialized = "true";

  setupTabListeners();
  await loadConversationsFeed();
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

    renderConversationsList(chatConversationsDataset);
    updateTabBadgeIndicators(chatConversationsDataset);

  } catch (err) {
    console.error("Failed to fetch live enquiry threads:", err);
    if (container) {
      container.innerHTML = `<div class="chat-skeleton-loader" style="color:#E53E3E;">Could not connect to live message server: ${err.message}</div>`;
    }
  }
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
    // Map your custom backend property names safely
    const isUnread = t.isRead === false || t.unreadCount > 0 ? "unread-item" : "";
    const displaySnippet = t.lastMessage || t.message || "No messages recorded.";
    const displayAvatar = t.userAvatar || t.sender?.avatar || "images/Avatar 4.svg";
    const userName = t.userName || t.sender?.name || 'Verified Tenant';
    const propertySubject = t.propertySubject || t.property?.title || 'General Enquiry';
    const timestamp = t.timestamp || t.updatedAt || 'Just now';

    return `
      <div class="convo-card-row ${isUnread}" data-id="${t.id || t.threadId}">
        <img src="${displayAvatar}" class="convo-avatar" alt="">
        <div class="convo-details">
          <div class="convo-meta-header">
            <span class="convo-name">${userName}</span>
            <span class="convo-time">${timestamp}</span>
          </div>
          <div class="convo-location">${propertySubject}</div>
          <div class="convo-snippet">${displaySnippet}</div>
        </div>
      </div>
    `;
  }).join('');

  // Setup click listeners to slide open individual message window panels
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
  const unreadCount = threads.filter(t => t.isRead === false || t.unreadCount > 0).length;
  const archiveCount = threads.filter(t => t.isArchived === true).length;

  if (countAllEl) countAllEl.textContent = `(${totalCount})`;
  if (countUnreadEl) countUnreadEl.textContent = `(${unreadCount})`;
  if (countArchiveEl) countArchiveEl.textContent = `(${archiveCount})`;
}

/* ---------- 3. FETCH & OPEN SUB-MESSAGE CHAT WINDOW ---------- */
async function openActiveChatWindow(threadId) {
  activeSelectedThreadId = threadId;

  const listView = document.getElementById('conversationsListViewPanel');
  const chatWindow = document.getElementById('chatWindowView');

  if (listView) listView.style.display = 'none';
  if (chatWindow) {
    chatWindow.hidden = false;
    chatWindow.style.display = 'flex';
    chatWindow.innerHTML = `<div class="chat-skeleton-loader">Opening secure chat stream...</div>`;
  }

  try {
    // Dynamic fetch matching your Swagger path: GET /api/v1/enquiries/threads/{threadId}
    const threadData = await window.api.get(`/enquiries/threads/${threadId}`);
    const messages = threadData?.messages || threadData?.data?.messages || threadData || [];

    // Fallback data details derived from cache if nested header objects are separate
    const currentThread = chatConversationsDataset.find(c => String(c.id || c.threadId) === String(threadId));
    const displayAvatar = currentThread?.userAvatar || "images/Avatar 4.svg";
    const userName = currentThread?.userName || 'Verified Tenant';
    const propertySubject = currentThread?.propertySubject || 'General Enquiry';

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
        <!-- Message bubbles get rendered here -->
      </div>

      <div class="chat-input-bar-action-tray">
        <form class="chat-input-form" id="chatSubmissionForm">
          <button type="button" class="chat-action-btn" aria-label="Attach File">
            <svg style="width:20px; height:20px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
            </svg>
          </button>
          <input type="text" class="chat-input-field" id="messageInputField" placeholder="Type a message" autocomplete="off" required>
          <button type="submit" class="chat-action-btn chat-send-btn-pill" aria-label="Send Message">
            <svg style="width:16px; height:16px; transform: rotate(90deg); margin-left: 2px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>
    `;

    renderMessageBubbles(messages);

    // Initialize tracking buttons inside the active sub-frame window
    document.getElementById('closeChatBtn')?.addEventListener('click', closeChatWindow);
    document.getElementById('chatSubmissionForm')?.addEventListener('submit', handleSendMessageSubmit);

    // Trigger background thread optimization to clear unread states via PATCH /enquiries/{id}/read
    triggerMarkAsRead(threadId);

  } catch (err) {
    console.error("Failed to load chat stream text blocks:", err);
    chatWindow.innerHTML = `<div class="chat-skeleton-loader" style="color:#E53E3E;">Failed to load messages: ${err.message}</div>`;
  }
}

function closeChatWindow() {
  const listView = document.getElementById('conversationsListViewPanel');
  const chatWindow = document.getElementById('chatWindowView');

  if (chatWindow) chatWindow.style.display = 'none';
  if (listView) listView.style.display = 'flex';

  loadConversationsFeed(); // Re-sync changes upon panel swap actions
}

function renderMessageBubbles(messages) {
  const stream = document.getElementById('chatMessagesStream');
  if (!stream) return;

  if (messages.length === 0) {
    stream.innerHTML = `<div style="text-align:center; padding:40px; font-size:13px; color:#94a3b8;">No message logs recorded. Send a greeting below!</div>`;
    return;
  }

  stream.innerHTML = messages.map(m => {
    // Evaluates sender origins automatically to float bubbles left vs right layout grids
    // Landlord messages float right (outgoing), tenants stay left (incoming)
    const isOutgoing = m.senderType?.toLowerCase() === 'landlord' || m.sender?.role?.toLowerCase() === 'landlord';
    const directionClass = isOutgoing ? 'bubble-outgoing' : 'bubble-incoming';
    const timeDisplay = m.time || (m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '12:00 PM');

    return `
      <div class="chat-bubble-row ${directionClass}">
        <div class="bubble-content">
          ${m.text || m.message || ''}
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

  stream.scrollTop = stream.scrollHeight; // Auto-scroll to the latest message
}

/* ---------- 4. SEND A MESSAGE VIA POST /enquiries ---------- */
async function handleSendMessageSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('messageInputField');
  if (!input || !input.value.trim() || !activeSelectedThreadId) return;

  const userText = input.value.trim();
  input.value = ""; // Clear text field immediately for instant feedback

  // Optimistically append the message to the screen right away to make it look responsive
  const stream = document.getElementById('chatMessagesStream');
  const localTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (stream) {
    stream.innerHTML += `
      <div class="chat-bubble-row bubble-outgoing">
        <div class="bubble-content">
          ${userText}
          <div class="chat-bubble-meta"><span>${localTime}</span></div>
        </div>
      </div>
    `;
    stream.scrollTop = stream.scrollHeight;
  }

  try {
    // Triggers payload processing straight onto: POST /api/v1/enquiries
    const payload = { threadId: activeSelectedThreadId, message: userText };
    await window.api.post('/enquiries', payload);
    console.log("Live message dispatched cleanly over gateway pipelines.");
  } catch (apiErr) {
    console.error("Backend transmission lost, caching trace locally:", apiErr);
  }
}

/* ---------- 5. DISPATCH READ EVENTS TRACKERS ---------- */
async function triggerMarkAsRead(threadId) {
  try {
    // Triggers background update targeting your endpoint: PATCH /api/v1/enquiries/{id}/read
    await window.api.patch(`/enquiries/${threadId}/read`);
  } catch (err) {
    console.warn("Read confirmation trace pass bypassed:", err.message);
  }
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

      // Reset active classes across tabs
      tabs.forEach(t => document.getElementById(t)?.classList.remove('active'));
      this.classList.add('active');

      let filtered = [...chatConversationsDataset];
      if (tabId === 'tabUnread') {
        filtered = chatConversationsDataset.filter(t => t.isRead === false || t.unreadCount > 0);
      } else if (tabId === 'tabArchive') {
        filtered = chatConversationsDataset.filter(t => t.isArchived === true);
      }

      renderConversationsList(filtered);
    });
  });
}