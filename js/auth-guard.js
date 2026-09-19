/*
  AUTH GUARD — include on every page that requires a real account
  (dashboard, analyzer, markets, charts, history, patterns, probability,
  profile, settings, signals, ai-analysis).

  Must load AFTER js/auth-client.js and BEFORE any page script that
  assumes the person is logged in.
*/

if (!MEGATRON_AUTH.isLoggedIn("user")) {

  const thisPage = window.location.pathname.split("/").pop();
  window.location.href = `login.html?redirect=${encodeURIComponent(thisPage)}`;

  // Throwing stops the rest of the page's scripts from running while
  // the redirect takes effect.
  throw new Error("Redirecting to login — no account session found.");

}

// Make the logged-in user's info easy for any page script to use, e.g.
// to show their name in the nav or greet them by name.
const MEGATRON_CURRENT_USER = MEGATRON_AUTH.getUser("user");

// Add a real logout button and show the real user's initials, on every
// protected page automatically — avoids having to hand-edit the same
// topbar markup across 11 separate HTML files.
document.addEventListener("DOMContentLoaded", () => {

  const topActions = document.querySelector(".top-actions");
  if (!topActions) return;

  // Replace the placeholder "AI" avatar text with the real user's initials
  const avatar = topActions.querySelector(".avatar");
  if (avatar && MEGATRON_CURRENT_USER && MEGATRON_CURRENT_USER.name) {
    const initials = MEGATRON_CURRENT_USER.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join("");
    avatar.textContent = initials || "?";
    avatar.title = MEGATRON_CURRENT_USER.name;
  }

  // Add a real logout button if one isn't already there
  if (!document.getElementById("real-logout-btn")) {
    const btn = document.createElement("button");
    btn.className = "btn btn-ghost";
    btn.id = "real-logout-btn";
    btn.style.fontSize = "12px";
    btn.style.marginLeft = "8px";
    btn.textContent = "Logout";
    btn.addEventListener("click", () => {
      MEGATRON_AUTH.logout("user", "login.html");
    });
    topActions.appendChild(btn);
  }

});
