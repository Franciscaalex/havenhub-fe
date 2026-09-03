function setupModerationForm(modalElement, onApprove, onReject) {
  if (!modalElement) return;

  const textarea = modalElement.querySelector("textarea");
  const fieldContainer = textarea?.closest(".modal__field");
  const rejectBtn = modalElement.querySelector(".btn--reject");
  const approveBtn = modalElement.querySelector(".btn--approve");

  textarea?.addEventListener("input", () => {
    fieldContainer?.classList.remove("has-error");
  });

  approveBtn?.addEventListener("click", async () => {
    if (typeof onApprove === "function") {
      await onApprove();
    }
  });

  rejectBtn?.addEventListener("click", async () => {
    const reason = textarea?.value.trim();

    if (!reason) {
      fieldContainer?.classList.add("has-error");
      if (typeof window.showToast === "function") {
        window.showToast("Rejection reason is required.", "error");
      }
      return;
    }

    if (typeof onReject === "function") {
      await onReject(reason);
    }
  });
}

window.HavenHubModeration = { setupModerationForm };
