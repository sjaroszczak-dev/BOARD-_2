(() => {
  "use strict";
  const SESSION_KEY = "board-auth-ok";
  // Dane logowania nie są przechowywane w kodzie w postaci jawnej.
  // Przechowywany jest wyłącznie skrót SHA-256 ciągu "login:hasło".
  const CREDENTIALS_HASH = "1712f529cbef499328936f6a06c5bd654e357085287b047d7ab940635540a17c";

  async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  // Usuwa ewentualny login/hasło, które mogłyby trafić do adresu URL
  // (np. przez autouzupełnianie przeglądarki lub zapisaną starą wersję strony).
  function sanitizeUrl() {
    if (!location.search) return;
    if (window.history && typeof window.history.replaceState === "function") {
      window.history.replaceState(null, "", location.pathname + location.hash);
    }
  }

  function unlock() {
    document.body.classList.remove("locked");
    document.body.classList.add("authenticated");
    const login = document.getElementById("login-screen");
    if (login) login.setAttribute("aria-hidden", "true");
  }

  function lock() {
    sessionStorage.removeItem(SESSION_KEY);
    document.body.classList.remove("authenticated");
    document.body.classList.add("locked");
    const login = document.getElementById("login-screen");
    const form = document.getElementById("login-form");
    const error = document.getElementById("login-error");
    if (login) login.removeAttribute("aria-hidden");
    if (error) error.hidden = true;
    if (form) form.reset();
  }

  function init() {
    sanitizeUrl();
    const logoutButton = document.getElementById("logout-button");
    if (logoutButton) {
      logoutButton.addEventListener("click", () => {
        lock();
      });
    }
    if (sessionStorage.getItem(SESSION_KEY) === "1") {
      unlock();
      return;
    }
    const form = document.getElementById("login-form");
    const error = document.getElementById("login-error");
    const login = document.getElementById("login-screen");
    if (login) login.removeAttribute("aria-hidden");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const username = document.getElementById("login-username").value.trim();
      const password = document.getElementById("login-password").value;
      const hash = await sha256Hex(`${username}:${password}`);
      sanitizeUrl();
      if (hash === CREDENTIALS_HASH) {
        sessionStorage.setItem(SESSION_KEY, "1");
        if (error) error.hidden = true;
        unlock();
      } else if (error) {
        error.hidden = false;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
