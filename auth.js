(() => {
  "use strict";
  const SESSION_KEY = "board-auth-ok";
  const USERNAME = "admin";
  const PASSWORD = "33773377";

  function unlock() {
    document.body.classList.remove("locked");
    document.body.classList.add("authenticated");
    const login = document.getElementById("login-screen");
    if (login) login.setAttribute("aria-hidden", "true");
  }

  function init() {
    if (sessionStorage.getItem(SESSION_KEY) === "1") {
      unlock();
      return;
    }
    const form = document.getElementById("login-form");
    const error = document.getElementById("login-error");
    const login = document.getElementById("login-screen");
    if (login) login.removeAttribute("aria-hidden");
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const username = document.getElementById("login-username").value.trim();
      const password = document.getElementById("login-password").value;
      if (username === USERNAME && password === PASSWORD) {
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
