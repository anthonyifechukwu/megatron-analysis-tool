if (MEGATRON_AUTH.isLoggedIn("user")) {
  window.location.href = "dashboard.html";
}

const form = document.getElementById("login-form");
const errorBox = document.getElementById("login-error");
const submitBtn = document.getElementById("login-submit");

function showError(message) {
  errorBox.textContent = message;
  errorBox.style.display = "block";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.style.display = "none";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  submitBtn.disabled = true;
  submitBtn.textContent = "Signing In...";

  try {

    const data = await MEGATRON_AUTH.login({ email, password });
    MEGATRON_AUTH.saveSession("user", data);

    const params = new URLSearchParams(window.location.search);
    window.location.href = params.get("redirect") || "dashboard.html";

  } catch (error) {

    showError(error.message || "Invalid email or password.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Sign In";

  }

});
