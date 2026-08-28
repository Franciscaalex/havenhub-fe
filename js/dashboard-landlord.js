/* ---------- FIXED: Corrected Nested Path to Stop 404 ---------- */
async function loadUnreadCount() {
  try {
    // FIXED: Adjusted to standard resource grouping patterns matching Swagger schemas
    const response = await window.api.get('/messages/threads/unread-count');
    
    const dataPayload = response?.data || response;
    const unreadCount = Number(dataPayload?.count ?? dataPayload?.unreadCount ?? response?.count ?? 0);
    
    const badge = document.getElementById('unreadBadge');
    
    if (badge && unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      badge.hidden = false;
      badge.style.display = 'inline-flex';
    } else if (badge) {
      badge.hidden = true;
    }
  } catch (err) {
    console.error('Could not load unread count:', err);
  }
}
