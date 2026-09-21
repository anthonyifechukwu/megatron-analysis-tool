/*
  Megatron data-service layer
  ---------------------------
  Talks to the Node/Express backend in /backend. No secrets live here —
  only a short-lived access token (kept in localStorage for session
  persistence) and a refresh token used to silently renew it.
*/

const MegatronAPI = {
  baseURL: "https://megatron-analysis-tool.onrender.com/api",

  // ---- token storage ----
  getAccessToken() {
    return localStorage.getItem("megatron_access_token");
  },
  getRefreshToken() {
    return localStorage.getItem("megatron_refresh_token");
  },
  setTokens({ accessToken, refreshToken }) {
    if (accessToken) localStorage.setItem("megatron_access_token", accessToken);
    if (refreshToken) localStorage.setItem("megatron_refresh_token", refreshToken);
  },
  clearTokens() {
    localStorage.removeItem("megatron_access_token");
    localStorage.removeItem("megatron_refresh_token");
  },
  isLoggedIn() {
    return !!this.getAccessToken();
  },

  // ---- core request helper with auto refresh-on-401 ----
  async _request(path, { method = "GET", body, auth = false, retry = true } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (auth) {
      const token = this.getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${this.baseURL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && auth && retry && this.getRefreshToken()) {
      const refreshed = await this._tryRefresh();
      if (refreshed) return this._request(path, { method, body, auth, retry: false });
    }

    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const data = await res.json();
        message = data.error || message;
      } catch {
        /* ignore parse errors */
      }
      throw new Error(message);
    }
    if (res.status === 204) return null;
    return res.json();
  },

  async _tryRefresh() {
    try {
      const data = await this._request("/auth/refresh", {
        method: "POST",
        body: { refreshToken: this.getRefreshToken() },
      });
      this.setTokens(data);
      return true;
    } catch {
      this.clearTokens();
      return false;
    }
  },

  // ---- market data ----
  async getMarkets() {
    return this._request("/markets");
  },
  async getQuote(symbol) {
    return this._request(`/markets/quote?symbol=${encodeURIComponent(symbol)}`);
  },
  async getMarketStatus() {
    return this._request("/markets/status");
  },

  // ---- analysis ----
  async runAnalysis(payload) {
    return this._request("/analysis", { method: "POST", body: payload, auth: this.isLoggedIn() });
  },
  async getDigitDistribution(symbol) {
    return this._request(`/analysis/digits?symbol=${encodeURIComponent(symbol)}`);
  },
  async getPatterns(symbol) {
    return this._request(`/analysis/patterns?symbol=${encodeURIComponent(symbol)}`);
  },

  // ---- auth ----
  async register(name, email, password) {
    const data = await this._request("/auth/register", { method: "POST", body: { name, email, password } });
    this.setTokens(data);
    return data.user;
  },
  async login(email, password) {
    const data = await this._request("/auth/login", { method: "POST", body: { email, password } });
    this.setTokens(data);
    return data.user;
  },
  async logout() {
    try {
      await this._request("/auth/logout", { method: "POST", auth: true });
    } finally {
      this.clearTokens();
    }
  },
  async getCurrentUser() {
    return this._request("/auth/me", { auth: true });
  },

  // ---- watchlist (persistent, replaces/augments localStorage) ----
  async getWatchlist() {
    return this._request("/watchlist", { auth: true });
  },
  async addToWatchlist(symbol, label, note) {
    return this._request("/watchlist", { method: "POST", body: { symbol, label, note }, auth: true });
  },
  async removeFromWatchlist(id) {
    return this._request(`/watchlist/${id}`, { method: "DELETE", auth: true });
  },

  // ---- history (persistent, replaces/augments localStorage) ----
  async getHistory(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this._request(`/history${qs ? `?${qs}` : ""}`, { auth: true });
  },
  async clearHistory() {
    return this._request("/history", { method: "DELETE", auth: true });
  },
  async deleteHistoryItem(id) {
    return this._request(`/history/${id}`, { method: "DELETE", auth: true });
  },

  // ---- preferences ----
  async getPreferences() {
    return this._request("/preferences", { auth: true });
  },
  async updatePreferences(prefs) {
    return this._request("/preferences", { method: "PUT", body: prefs, auth: true });
  },
  async updateProfile(name) {
    return this._request("/preferences/profile", { method: "PUT", body: { name }, auth: true });
  },

  // ---- admin ----
  async adminListUsers(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this._request(`/admin/users${qs ? `?${qs}` : ""}`, { auth: true });
  },
  async adminSetUserStatus(id, status) {
    return this._request(`/admin/users/${id}/status`, { method: "PATCH", body: { status }, auth: true });
  },
  async adminSetUserRole(id, role) {
    return this._request(`/admin/users/${id}/role`, { method: "PATCH", body: { role }, auth: true });
  },
  async adminDeleteUser(id) {
    return this._request(`/admin/users/${id}`, { method: "DELETE", auth: true });
  },
  async adminRecentAnalyses(limit = 50) {
    return this._request(`/admin/analyses?limit=${limit}`, { auth: true });
  },
  async adminSystemStatus() {
    return this._request("/admin/status", { auth: true });
  },
  async adminLogs(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this._request(`/admin/logs${qs ? `?${qs}` : ""}`, { auth: true });
  },
  async adminPlatformStats() {
    return this._request("/admin/stats", { auth: true });
  },
};
