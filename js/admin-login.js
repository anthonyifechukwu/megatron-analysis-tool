if (MEGATRON_AUTH.isLoggedIn("admin")) {
  window.location.href = "admin.html";
}

const form = document.getElementById("admin-login-form");
const errorBox = document.getElementById("admin-login-error");
const submitBtn = document.getElementById("admin-login-submit");

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

    if (data.user.role !== "admin") {
      showError("This account does not have admin access.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign In to Admin Panel";
      return;
    }

    MEGATRON_AUTH.saveSession("admin", data);
    window.location.href = "admin.html";

  } catch (error) {

    showError(error.message || "Invalid email or password.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Sign In to Admin Panel";

  }

});
