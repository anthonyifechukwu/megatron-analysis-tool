/* ADMIN PANEL — real data, real actions, wired to /api/admin/* */

document.getElementById("admin-name-badge").textContent = adminGuardUser.name || adminGuardUser.email;

document.getElementById("admin-logout-btn").addEventListener("click", () => {
  MEGATRON_AUTH.logout("admin", "admin-login.html");
});

/* ---------- TABS ---------- */

document.querySelectorAll(".admin-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".admin-panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add("active");
  });
});

/* ---------- STATS ---------- */

async function loadStats() {
  try {
    const data = await MEGATRON_AUTH.request("/admin/stats", { scope: "admin" });
    document.getElementById("stat-total-users").textContent = data.users.total;
    document.getElementById("stat-active-users").textContent = data.users.active;
    document.getElementById("stat-total-analyses").textContent = data.analyses.total;
    document.getElementById("stat-24h-analyses").textContent = data.analyses.last24h;
  } catch (error) {
    console.error("Could not load stats:", error.message);
  }
}

/* ---------- USERS ---------- */

let allUsers = [];

async function loadUsers(query) {

  const tbody = document.getElementById("users-tbody");
  tbody.innerHTML = `<tr class="loading-row"><td colspan="6">Loading users...</td></tr>`;

  try {

    const path = query ? `/admin/users?q=${encodeURIComponent(query)}` : "/admin/users";
    const data = await MEGATRON_AUTH.request(path, { scope: "admin" });
    allUsers = data.items || [];
    renderUsers(allUsers);

  } catch (error) {
    tbody.innerHTML = `<tr class="loading-row"><td colspan="6" style="color:#ff8a94">${escapeHTML(error.message)}</td></tr>`;
  }

}

function renderUsers(users) {

  const tbody = document.getElementById("users-tbody");

  if (users.length === 0) {
    tbody.innerHTML = `<tr class="loading-row"><td colspan="6">No users found.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  users.forEach(user => {

    const tr = document.createElement("tr");
    const joined = new Date(user.createdAt).toLocaleDateString();
    const isSelf = user.id === adminGuardUser.id || user.email === adminGuardUser.email;

    tr.innerHTML = `
      <td>${escapeHTML(user.name)}</td>
      <td>${escapeHTML(user.email)}</td>
      <td><span class="role-badge ${user.role}">${user.role.toUpperCase()}</span></td>
      <td><span class="status-pill ${user.status}">${user.status.toUpperCase()}</span></td>
      <td>${joined}</td>
      <td>
        <div class="row-actions">
          ${user.role === "admin"
            ? `<button data-action="demote" data-id="${user.id}">Remove Admin</button>`
            : `<button data-action="promote" data-id="${user.id}">Make Admin</button>`}
          ${user.status === "active"
            ? `<button data-action="suspend" data-id="${user.id}">Suspend</button>`
            : `<button data-action="activate" data-id="${user.id}">Activate</button>`}
          ${!isSelf ? `<button data-action="delete" data-id="${user.id}" class="danger">Delete</button>` : ""}
        </div>
      </td>
    `;

    tbody.appendChild(tr);

  });

}

document.getElementById("users-tbody").addEventListener("click", async (e) => {

  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const { action, id } = btn.dataset;
  const user = allUsers.find(u => u.id === id);
  if (!user) return;

  try {

    if (action === "promote") {
      if (!confirm(`Give ${user.name} admin access?`)) return;
      await MEGATRON_AUTH.request(`/admin/users/${id}/role`, { method: "PATCH", scope: "admin", body: { role: "admin" } });
    }

    if (action === "demote") {
      if (!confirm(`Remove admin access from ${user.name}?`)) return;
      await MEGATRON_AUTH.request(`/admin/users/${id}/role`, { method: "PATCH", scope: "admin", body: { role: "user" } });
    }

    if (action === "suspend") {
      if (!confirm(`Suspend ${user.name}? They won't be able to log in.`)) return;
      await MEGATRON_AUTH.request(`/admin/users/${id}/status`, { method: "PATCH", scope: "admin", body: { status: "suspended" } });
    }

    if (action === "activate") {
      await MEGATRON_AUTH.request(`/admin/users/${id}/status`, { method: "PATCH", scope: "admin", body: { status: "active" } });
    }

    if (action === "delete") {
      if (!confirm(`Permanently delete ${user.name}'s account? This can't be undone.`)) return;
      await MEGATRON_AUTH.request(`/admin/users/${id}`, { method: "DELETE", scope: "admin" });
    }

    await loadUsers(document.getElementById("user-search").value.trim());
    await loadStats();

  } catch (error) {
    alert(error.message || "Action failed.");
  }

});

let searchTimer;
document.getElementById("user-search").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadUsers(e.target.value.trim()), 300);
});

/* ---------- SYSTEM STATUS ---------- */

async function loadStatus() {

  try {

    const data = await MEGATRON_AUTH.request("/admin/status", { scope: "admin" });

    document.getElementById("db-status-content").innerHTML = `
      <span class="status-pill ${data.database.connected ? "active" : "suspended"}">
        ${data.database.connected ? "CONNECTED" : "DISCONNECTED"}
      </span>
    `;

    const invalidList = (data.deriv.invalidSymbols || []).length > 0
      ? `<p style="color:#ffc85b;font-size:12px;margin-top:10px">Rejected by Deriv: ${data.deriv.invalidSymbols.join(", ")}</p>`
      : "";

    document.getElementById("deriv-status-content").innerHTML = `
      <span class="status-pill ${data.deriv.connected ? "active" : "suspended"}">
        ${data.deriv.connected ? "CONNECTED" : "DISCONNECTED"}
      </span>
      <p style="font-size:12px;color:#7188aa;margin-top:10px">
        Tracking ${data.deriv.symbols.length} symbols, ${data.deriv.reconnectAttempts} reconnect attempts
      </p>
      ${invalidList}
    `;

    const uptimeMins = Math.floor(data.uptimeSeconds / 60);
    document.getElementById("server-status-content").innerHTML = `
      <p style="font-size:13px">Uptime: <strong>${uptimeMins} minutes</strong></p>
      <p style="font-size:12px;color:#7188aa">Last checked: ${new Date(data.timestamp).toLocaleTimeString()}</p>
    `;

  } catch (error) {
    document.getElementById("db-status-content").innerHTML = `<span style="color:#ff8a94">${escapeHTML(error.message)}</span>`;
  }

}

/* ---------- LOGS ---------- */

async function loadLogs() {

  const container = document.getElementById("logs-container");
  container.innerHTML = "Loading logs...";

  try {

    const level = document.getElementById("log-level-filter").value;
    const path = level ? `/admin/logs?level=${level}` : "/admin/logs";
    const data = await MEGATRON_AUTH.request(path, { scope: "admin" });

    if ((data.items || []).length === 0) {
      container.innerHTML = `<p style="color:#7188aa;font-size:13px">No logs yet.</p>`;
      return;
    }

    container.innerHTML = data.items.map(log => `
      <div class="log-line">
        <span class="lvl ${log.level}">${log.level.toUpperCase()}</span>
        <span style="color:#7188aa">${new Date(log.createdAt).toLocaleString()}</span>
        <span>${escapeHTML(log.message)}</span>
      </div>
    `).join("");

  } catch (error) {
    container.innerHTML = `<span style="color:#ff8a94">${escapeHTML(error.message)}</span>`;
  }

}

document.getElementById("refresh-logs-btn").addEventListener("click", loadLogs);
document.getElementById("log-level-filter").addEventListener("change", loadLogs);

/* ---------- HELPERS ---------- */

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

/* ---------- INIT ---------- */

loadStats();
loadUsers();
loadStatus();
loadLogs();
