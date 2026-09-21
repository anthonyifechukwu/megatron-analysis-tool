/*
  MEGATRON AUTH CLIENT
  Shared by every page that needs to call the real backend (register,
  login, admin login, and any page that requires being logged in).

  User and admin sessions are stored completely separately (different
  localStorage keys) so logging into the admin panel in one tab can
  never interfere with a regular user session in another tab of the
  same browser, or vice versa.
*/

const MEGATRON_API_BASE = (() => {
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (isLocal) return "http://localhost:5000/api";
  return "https://megatron-analysis-tool.onrender.com/api"; // <-- replace after deploying
})();

const MEGATRON_AUTH = {

  // ---------- storage (scope = "user" or "admin") ----------

  _keys(scope) {
    return {
      access: `megatron_${scope}_access`,
      refresh: `megatron_${scope}_refresh`,
      user: `megatron_${scope}_user`,
    };
  },

  saveSession(scope, { accessToken, refreshToken, user }) {
    const k = this._keys(scope);
    localStorage.setItem(k.access, accessToken);
    localStorage.setItem(k.refresh, refreshToken);
    localStorage.setItem(k.user, JSON.stringify(user));
  },

  getUser(scope) {
    try {
      return JSON.parse(localStorage.getItem(this._keys(scope).user)) || null;
    } catch (e) {
      return null;
    }
  },

  getAccessToken(scope) {
    return localStorage.getItem(this._keys(scope).access);
  },

  getRefreshToken(scope) {
    return localStorage.getItem(this._keys(scope).refresh);
  },

  isLoggedIn(scope) {
    return Boolean(this.getAccessToken(scope));
  },

  clearSession(scope) {
    const k = this._keys(scope);
    localStorage.removeItem(k.access);
    localStorage.removeItem(k.refresh);
    localStorage.removeItem(k.user);
  },

  logout(scope, redirectTo) {
    this.clearSession(scope);
    window.location.href = redirectTo;
  },

  // ---------- requests ----------

  async request(path, { method = "GET", body, scope = null, retried = false } = {}) {

    const headers = { "Content-Type": "application/json" };

    if (scope) {
      const token = this.getAccessToken(scope);
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response;

    try {
      response = await fetch(`${MEGATRON_API_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error("The server took too long to respond. Please try again.");
      }
      throw new Error("Could not reach the server. Please check your connection.");
    } finally {
      clearTimeout(timeoutId);
    }

    let data = {};
    try {
      data = await response.json();
    } catch (e) {
      data = {};
    }

    // Access tokens are short-lived (15m) — if one just expired, try to
    // silently refresh it once and replay the original request, so the
    // person doesn't get logged out just for leaving a tab open a while.
    if (response.status === 401 && scope && !retried && this.getRefreshToken(scope)) {
      const refreshed = await this._tryRefresh(scope);
      if (refreshed) {
        return this.request(path, { method, body, scope, retried: true });
      }
    }

    if (response.status === 401) {
      this.clearSession(scope);
      throw new Error(data.error || "Please log in again.");
    }

    if (!response.ok && response.status !== 304) {
      throw new Error(data.error || "Something went wrong. Please try again.");
    }

    return data;
  },

  async _tryRefresh(scope) {
    try {
      const refreshToken = this.getRefreshToken(scope);
      const res = await fetch(`${MEGATRON_API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      const k = this._keys(scope);
      localStorage.setItem(k.access, data.accessToken);
      localStorage.setItem(k.refresh, data.refreshToken);
      return true;
    } catch (e) {
      return false;
    }
  },

  // ---------- auth endpoints ----------

  register(payload) {
    return this.request("/auth/register", { method: "POST", body: payload });
  },

  login(payload) {
    return this.request("/auth/login", { method: "POST", body: payload });
  },

  // ---------- guards ----------

  requireLogin(scope, loginPage) {
    if (!this.isLoggedIn(scope)) {
      window.location.href = loginPage;
      return false;
    }
    return true;
  },

};
