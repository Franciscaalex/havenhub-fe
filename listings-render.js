/*
 * Connects moderation table actions to the review modal
 * and submits approve/reject actions through window.api.
 */

document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("moderationOverlay");
  const modal = document.getElementById("moderationModal");
  const tableBody = document.querySelector(".listings-table tbody");

  if (!overlay || !modal || !tableBody) {
    console.warn("Moderation UI elements not found.");
    return;
  }

  const titleEl = modal.querySelector(".modal__title");
  const textarea = modal.querySelector("textarea");
  const fieldContainer = textarea?.closest(".modal__field");
  const cancelBtn = modal.querySelector(".btn--ghost");
  const approveBtn = modal.querySelector(".btn--approve");
  const rejectBtn = modal.querySelector(".btn--reject");

  let currentListingId = null;

  function openModal(listingId, propertyName) {
    if (!listingId) {
      console.error("No listing ID found.");
      return;
    }

    currentListingId = listingId;

    if (titleEl) {
      titleEl.textContent = `Review ${propertyName}`;
    }

    if (textarea) {
      textarea.value = "";
    }

    fieldContainer?.classList.remove("has-error");

    overlay.style.display = "flex";
  }

  function closeModal() {
    overlay.style.display = "none";
    currentListingId = null;
  }

  function removeCurrentRow() {
    if (!currentListingId) return;

    const row = tableBody.querySelector(
      `tr[data-listing-id="${CSS.escape(currentListingId)}"]`,
    );

    row?.remove();
  }

  // Open modal when the ⋮ button is clicked.
  tableBody.addEventListener("click", (event) => {
    const button = event.target.closest(".btn-action");

    if (!button) return;

    const row = button.closest("tr");

    if (!row) return;

    const listingId = row.dataset.listingId;

    const propertyName =
      row.querySelector(".property-name")?.textContent.trim() || "listing";

    openModal(listingId, propertyName);
  });

  // Close modal.
  cancelBtn?.addEventListener("click", closeModal);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeModal();
    }
  });

  // Approve listing.
  approveBtn?.addEventListener("click", async () => {
    if (!currentListingId) {
      showToast("No listing selected.", "error");
      return;
    }

    approveBtn.disabled = true;

    try {
      await window.api.patch(`/properties/${currentListingId}/status`, {
        status: "APPROVED",
      });

      showToast("Listing approved.", "success");

      removeCurrentRow();
      closeModal();
    } catch (error) {
      console.error("Failed to approve listing:", error);

      showToast(error.message || "Could not approve listing.", "error");
    } finally {
      approveBtn.disabled = false;
    }
  });

  // Reject listing.
  rejectBtn?.addEventListener("click", async () => {
    if (!currentListingId) {
      showToast("No listing selected.", "error");
      return;
    }

    const reason = textarea?.value.trim() || "";

    if (!reason) {
      fieldContainer?.classList.add("has-error");

      showToast("Rejection reason is required.", "error");

      textarea?.focus();

      return;
    }

    rejectBtn.disabled = true;

    try {
      await window.api.patch(`/properties/${currentListingId}/status`, {
        status: "REJECTED",
        rejectionReason: reason,
      });

      showToast("Listing rejected.", "success");

      removeCurrentRow();
      closeModal();
    } catch (error) {
      console.error("Failed to reject listing:", error);

      showToast(error.message || "Could not reject listing.", "error");
    } finally {
      rejectBtn.disabled = false;
    }
  });
});
