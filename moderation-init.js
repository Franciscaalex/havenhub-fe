document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.querySelector(".listings-table tbody");
  const table = document.querySelector(".listings-table");
  const modal = document.getElementById("moderationOverlay");

  if (!tableBody || !table) return;

  const headerCells = table.querySelectorAll("thead th");

  const hasPriorityColumn = Array.from(headerCells).some(
    (th) => th.textContent.trim().toLowerCase() === "priority",
  );

  const columnCount = headerCells.length;

  try {
    const response = await window.api.get(
      "/properties?page=1&limit=10&sortBy=newest&status=PENDING_REVIEW",
    );

    const listings = Array.isArray(response.items) ? response.items : [];

    if (listings.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="${columnCount}">No pending properties found.</td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = listings
      .map((listing) => renderPropertyRow(listing, hasPriorityColumn))
      .join("");

    setupListingActions(listings, modal);
  } catch (error) {
    console.error("Failed to load pending properties:", error);

    tableBody.innerHTML = `
      <tr>
        <td colspan="${columnCount}">
          Unable to load properties. Please try again.
        </td>
      </tr>
    `;

    if (typeof window.showToast === "function") {
      window.showToast("Could not load properties. Try refreshing.", "error");
    }
  }
});

/* =========================================================
   RENDER LISTING ROW
   ========================================================= */

function renderPropertyRow(listing, hasPriorityColumn) {
  const ownerName = listing.landlord
    ? `${listing.landlord.firstName || ""} ${listing.landlord.lastName || ""}`.trim()
    : "Unknown";

  const ownerRole = listing.landlord?.role
    ? listing.landlord.role.charAt(0) +
      listing.landlord.role.slice(1).toLowerCase()
    : "";

  const location = [listing.location, listing.city, listing.state]
    .filter(Boolean)
    .join(", ");

  const price = listing.price
    ? `${listing.currency || "₦"} ${Number(listing.price).toLocaleString()}`
    : "—";

  const submitted = formatRelativeTime(listing.createdAt);
  const priority = getPriority(listing);

  return `
    <tr data-listing-id="${escapeHtml(listing.id)}">

      <td>
        <p class="property-name">
          ${escapeHtml(listing.title || "Untitled property")}
        </p>

        <p class="property-price">
          ${escapeHtml(price)}
        </p>
      </td>

      <td>
        <p class="owner-name">
          ${escapeHtml(ownerName)}
        </p>

        <p class="owner-role">
          ${escapeHtml(ownerRole)}
        </p>
      </td>

      <td>
        ${escapeHtml(location || "—")}
      </td>

      <td>
        ${escapeHtml(submitted)}
      </td>

      ${
        hasPriorityColumn
          ? `
            <td>
              <span class="priority priority-${priority.toLowerCase()}">
                ${escapeHtml(priority)}
              </span>
            </td>
          `
          : ""
      }

      <td>
        <button
          class="btn-action"
          type="button"
          aria-label="Review ${escapeHtml(listing.title || "property")}"
        >
          ⋮
        </button>
      </td>

    </tr>
  `;
}

/* =========================================================
   LISTING ACTIONS / MODAL
   ========================================================= */

function setupListingActions(listings, modal) {
  if (!modal) {
    console.warn("Moderation modal was not found.");
    return;
  }

  const tableBody = document.querySelector(".listings-table tbody");

  tableBody.querySelectorAll(".btn-action").forEach((button) => {
    button.addEventListener("click", () => {
      const row = button.closest("tr");
      const listingId = row?.dataset.listingId;

      const listing = listings.find((item) => item.id === listingId);

      if (!listing) {
        console.error("Listing not found:", listingId);
        return;
      }

      openModerationModal(modal, listing);
    });
  });
}

function openModerationModal(modal, listing) {
  const title = modal.querySelector(".modal__title");
  const subtitle = modal.querySelector(".modal__subtitle");
  const textarea = modal.querySelector("#moderationReason");
  const cancelBtn = modal.querySelector(".btn--ghost");

  if (title) {
    title.textContent = "Review listing";
  }

  if (subtitle) {
    subtitle.textContent = listing.title || "Review this property listing";
  }

  if (textarea) {
    textarea.value = "";
  }

  modal.style.display = "flex";

  /* Remove old listeners by cloning the cancel button */
  if (cancelBtn) {
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.replaceWith(newCancelBtn);

    newCancelBtn.addEventListener("click", () => {
      closeModerationModal(modal);
    });
  }

  if (window.HavenHubModeration?.setupModerationForm) {
    const formModal = modal.querySelector(".modal");

    window.HavenHubModeration.setupModerationForm(
      formModal,

      async () => {
        await approveListing(listing.id, modal);
      },

      async (reason) => {
        await rejectListing(listing.id, reason, modal);
      },
    );
  }
}

function closeModerationModal(modal) {
  modal.style.display = "none";

  const textarea = modal.querySelector("#moderationReason");

  if (textarea) {
    textarea.value = "";
  }

  const field = modal.querySelector(".modal__field");

  if (field) {
    field.classList.remove("has-error");
  }
}

/* =========================================================
   APPROVE
   ========================================================= */

async function approveListing(listingId, modal) {
  console.log("Approving listing:", listingId);

  try {
    await window.api.patch(
      `/properties/${encodeURIComponent(listingId)}/status`,
      {
        status: "APPROVED",
      },
    );

    closeModerationModal(modal);

    removeListingFromTable(listingId);

    if (typeof window.showToast === "function") {
      window.showToast("Listing approved successfully.", "success");
    }
  } catch (error) {
    console.error("Failed to approve listing:", error);

    if (typeof window.showToast === "function") {
      window.showToast(error.message || "Could not approve listing.", "error");
    }
  }
}

/* =========================================================
   REJECT
   ========================================================= */

async function rejectListing(listingId, reason, modal) {
  console.log("Rejecting listing:", listingId, reason);

  try {
    /*
     * IMPORTANT:
     * Replace this endpoint if your backend documentation
     * specifies a different moderation endpoint.
     */
    await window.api.patch(
      `/properties/${encodeURIComponent(listingId)}/status`,
      {
        status: "REJECTED",
        rejectionReason: reason,
      },
    );

    closeModerationModal(modal);

    removeListingFromTable(listingId);

    if (typeof window.showToast === "function") {
      window.showToast("Listing rejected successfully.", "success");
    }
  } catch (error) {
    console.error("Failed to reject listing:", error);

    if (typeof window.showToast === "function") {
      window.showToast(error.message || "Could not reject listing.", "error");
    }
  }
}

/* =========================================================
   REMOVE AFTER SUCCESS
   ========================================================= */

function removeListingFromTable(listingId) {
  const row = document.querySelector(
    `tr[data-listing-id="${CSS.escape(listingId)}"]`,
  );

  if (row) {
    row.remove();
  }

  const tableBody = document.querySelector(".listings-table tbody");
  const remainingRows = tableBody?.querySelectorAll("tr[data-listing-id]");

  if (remainingRows && remainingRows.length === 0 && tableBody) {
    const columnCount = document.querySelectorAll(
      ".listings-table thead th",
    ).length;

    tableBody.innerHTML = `
      <tr>
        <td colspan="${columnCount}">
          No pending properties found.
        </td>
      </tr>
    `;
  }
}

/* =========================================================
   HELPERS
   ========================================================= */

function getPriority(listing) {
  if (listing.priority) {
    return listing.priority;
  }

  return "Low";
}

function formatRelativeTime(dateString) {
  if (!dateString) return "—";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const now = new Date();
  const diffMs = Math.max(0, now - date);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  return `${diffDays}d ago`;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}
