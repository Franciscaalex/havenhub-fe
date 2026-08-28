(function () {
  "use strict";

  let modalEl = null;
  // Grabs the ID context straight from the URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const propertyId = urlParams.get('propertyId') || urlParams.get('id');

  function buildModal() {
    const wrap = document.createElement("div");
    wrap.className = "inquire-overlay";
    wrap.id = "inquireOverlay";
    wrap.innerHTML = `
      <div class="inquire-modal" role="dialog" aria-modal="true" aria-labelledby="inquireTitle">
        <div class="inquire-header">
          <h2 id="inquireTitle">Inquire Now</h2>
          <button type="button" class="inquire-close" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="inquire-property">
          <img id="inquirePropertyImg" src="" alt="">
          <div class="inquire-property-info">
            <div class="inquire-property-name" id="inquirePropertyName"></div>
            <div class="inquire-property-location" id="inquirePropertyLocation"></div>
            <span class="status-badge" id="inquirePropertyStatus"></span>
          </div>
        </div>

        <form id="inquireForm">
          <label class="inquire-label" for="inquireMessage">Message</label>
          <textarea id="inquireMessage" rows="4" placeholder="Hi, I'm interested in this property..." required></textarea>
          <p class="inquire-disclaimer" id="inquireStatus">Your information is shared securely with the landlord.</p>

          <div class="inquire-actions">
            <button type="button" class="clear-btn inquire-cancel">Cancel</button>
            <button type="submit" id="inquireSubmitBtn" class="apply-btn inquire-send">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Send message
            </button>
          </div>
        </form>

        <div class="inquire-success" id="inquireSuccess" hidden>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="green" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>
          <h3>Message sent</h3>
          <p>The landlord will get back to you shortly.</p>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    const closeBtn = wrap.querySelector(".inquire-close");
    const cancelBtn = wrap.querySelector(".inquire-cancel");
    const form = wrap.querySelector("#inquireForm");

    function close() {
      wrap.classList.remove("open");
      document.body.style.overflow = "";
    }

    closeBtn.addEventListener("click", close);
    cancelBtn.addEventListener("click", close);
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && wrap.classList.contains("open")) close();
    });

    // Integrated and corrected API validation logic (Snippet 1)
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const message = document.getElementById('inquireMessage').value.trim();
      const statusEl = document.getElementById('inquireStatus');
      const submitBtn = document.getElementById('inquireSubmitBtn');
      if (!message) return;

      if (submitBtn) submitBtn.disabled = true;

      try {
        // FIX: Corrected base path URL namespace for HavenHub live backend environment
        const thread = await window.api.post('/api/v1/messages/threads', { propertyId, message });
        
        // Show success layout changes dynamically
        form.hidden = true;
        wrap.querySelector("#inquireSuccess").hidden = false;

        // Redirects directly to the messaging UI utilizing your response tracking key
        setTimeout(() => {
          close();
          const threadId = thread?.data?.id || thread?.id;
          window.location.href = `thread.html?id=${threadId}`;
        }, 1200);

      } catch (err) {
        if (submitBtn) submitBtn.disabled = false;
        if (statusEl) { 
          statusEl.textContent = `Error: ${err.message}`; 
          statusEl.style.color = "red";
        }
      }
    });

    return wrap;
  }

  window.openInquireModal = function (property) {
    if (!modalEl) modalEl = buildModal();

    modalEl.querySelector("#inquirePropertyImg").src = property.img || "";
    modalEl.querySelector("#inquirePropertyName").textContent = property.title || property.address || "";
    modalEl.querySelector("#inquirePropertyLocation").textContent = property.address || "";

    const statusEl = modalEl.querySelector("#inquirePropertyStatus");
    statusEl.textContent = property.status || "Available";
    statusEl.className = "status-badge " + (property.status === "Rented" ? "rented" : "available");

    modalEl.classList.add("open");
    document.body.style.overflow = "hidden";
    modalEl.querySelector("#inquireMessage").focus();
  };
})();
