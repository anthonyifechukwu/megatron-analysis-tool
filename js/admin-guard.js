/*
  ADMIN AUTH GUARD — include on admin.html only.
  Must load AFTER js/auth-client.js.
*/

if (!MEGATRON_AUTH.isLoggedIn("admin")) {
  window.location.href = "admin-login.html";
  throw new Error("Redirecting to admin login.");
}

const adminGuardUser = MEGATRON_AUTH.getUser("admin");

if (!adminGuardUser || adminGuardUser.role !== "admin") {
  MEGATRON_AUTH.clearSession("admin");
  window.location.href = "admin-login.html";
  throw new Error("Not an admin account — redirecting.");
}
