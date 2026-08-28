

// ===== SIGNUP & LOGIN HANDLER =====
document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signupForm");

  if (signupForm) {
    signupForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const firstName = document.getElementById("firstName").value;
      const lastName = document.getElementById("lastName").value;
      const email = document.getElementById("signupEmail").value;
      const password = document.getElementById("signupPassword").value;
      const termsAccepted = document.getElementById("terms").checked;
      const statusEl = document.getElementById("signupStatus");

      if (!termsAccepted) {
        statusEl.textContent = "You must accept the terms and conditions.";
        return;
      }

      try {
        statusEl.textContent = "Creating your account...";

        const data = await api.post("/auth/register", {
          firstName,
          lastName,
          email,
          password,
        });

        if (data.token) {
          api.setToken(data.token, data.expiresIn || 3600);
        }

        statusEl.textContent = "Account created! Redirecting...";
        window.location.href = "login.html";

      } catch (error) {
        console.error("Signup error:", error);
        statusEl.textContent = error.message || "Signup failed. Please try again.";
      }
    });
  }
});


// ===== LOGIN FORM HANDLER =====
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const email = document.getElementById("loginEmail").value;
      const password = document.getElementById("loginPassword").value;
      const statusEl = document.getElementById("loginStatus");

      try {
        statusEl.textContent = "Logging in...";

        const data = await api.post("/auth/login", { email, password });

        api.setToken(data.token, data.expiresIn || 3600);

        statusEl.textContent = "Login successful! Redirecting...";
        window.location.href = "/dashboard.html";

      } catch (error) {
        console.error("Login error:", error);
        statusEl.textContent = error.message || "Login failed. Please check your credentials.";
      }
    });
  }
});