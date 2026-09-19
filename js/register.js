/* Redirect straight to the dashboard if already logged in as a user */
if (MEGATRON_AUTH.isLoggedIn("user")) {
  window.location.href = "dashboard.html";
}

const form = document.getElementById("register-form");
const errorBox = document.getElementById("register-error");
const submitBtn = document.getElementById("register-submit");

function showError(message) {
  errorBox.textContent = message;
  errorBox.style.display = "block";
}

function hideError() {
  errorBox.style.display = "none";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (password.length < 8) {
    showError("Password must be at least 8 characters.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Creating Account...";

  try {

    const data = await MEGATRON_AUTH.register({ name, email, password });
    MEGATRON_AUTH.saveSession("user", data);

    const params = new URLSearchParams(window.location.search);
    window.location.href = params.get("redirect") || "dashboard.html";

  } catch (error) {

    showError(error.message || "Could not create your account.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Create Account";

  }

});
