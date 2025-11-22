// statics/js/auth.js
(function(){
  const log = (...args) => console.log("[CQ_AUTH]", ...args);
  const $ = (sel, root=document) => root.querySelector(sel);

  const state = {
    clientId: null,
    user: null,
    token: null,
  };

  function loadSession() {
    try {
      const raw = localStorage.getItem("cq_session");
      if (!raw) return;
      const data = JSON.parse(raw);
      state.user = data.user || null;
      state.token = data.token || null;
      log("Loaded session from localStorage", state.user);
    } catch (e) {
      console.warn("[CQ_AUTH] Failed to parse session", e);
    }
  }

  function saveSession() {
    try {
      if (!state.user || !state.token) {
        localStorage.removeItem("cq_session");
        return;
      }
      localStorage.setItem("cq_session", JSON.stringify({
        user: state.user,
        token: state.token,
      }));
    } catch (e) {
      console.warn("[CQ_AUTH] Failed to save session", e);
    }
  }

  function updateUI() {
    const label = $("#cqAuthLabel");
    const signInBtn = $("#cqSignInBtn");
    const signOutBtn = $("#cqSignOutBtn");

    if (state.user) {
      const name = state.user.email || state.user.name || "User";
      if (label) label.textContent = `Signed in as ${name}`;
      if (signInBtn) signInBtn.style.display = "none";
      if (signOutBtn) signOutBtn.style.display = "inline-flex";
      document.body.classList.add("cq-has-session");
    } else {
      if (label) label.textContent = "Not signed in";
      if (signInBtn) signInBtn.style.display = "inline-flex";
      if (signOutBtn) signOutBtn.style.display = "none";
      document.body.classList.remove("cq-has-session");
    }
  }

  async function sendCredential(credential) {
    try {
      const res = await fetch("/api/auth/google/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!data.ok) {
        console.error("[CQ_AUTH] Login failed on server", data);
        return;
      }
      state.user = data.user || null;
      state.token = data.token || null;
      saveSession();
      updateUI();
      log("Signed in", state.user);
    } catch (e) {
      console.error("[CQ_AUTH] Error sending credential", e);
    }
  }

  function handleCredentialResponse(response) {
    if (!response || !response.credential) {
      console.error("[CQ_AUTH] No credential in response", response);
      return;
    }
    sendCredential(response.credential);
  }

  // Expose globally because GIS can invoke a string callback
  window.handleCredentialResponse = handleCredentialResponse;

  function signOut() {
    state.user = null;
    state.token = null;
    saveSession();
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
    updateUI();
    log("Signed out");
  }

  function initGoogle() {
    if (!window.google || !google.accounts || !google.accounts.id) {
      console.error("[CQ_AUTH] Google Identity Services SDK not loaded");
      return;
    }

    state.clientId = window.CQ_GOOGLE_CLIENT_ID || null;
    if (!state.clientId) {
      console.error("[CQ_AUTH] CQ_GOOGLE_CLIENT_ID missing on window");
      return;
    }

    google.accounts.id.initialize({
      client_id: state.clientId,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: false, // keeps FedCM noise down
    });

    const container = document.getElementById("gSignInBtn");
    if (container) {
      container.style.display = "inline-block";
      google.accounts.id.renderButton(container, {
        type: "standard",
        theme: "outline",
        size: "medium",
        text: "continue_with",
        shape: "pill",
      });
    }

    const signInBtn = $("#cqSignInBtn");
    if (signInBtn) {
      signInBtn.addEventListener("click", (e) => {
        e.preventDefault();
        google.accounts.id.prompt();
      });
    }

    const signOutBtn = $("#cqSignOutBtn");
    if (signOutBtn) {
      signOutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        signOut();
      });
    }

    log("Google Identity initialized");
  }

  function onReady() {
    loadSession();
    updateUI();

    // GIS may not be ready immediately when DOMContentLoaded fires.
    // Try once, then retry a bit later if needed.
    if (window.google && google.accounts && google.accounts.id) {
      initGoogle();
    } else {
      const maxTries = 20;
      let n = 0;
      const iv = setInterval(() => {
        if (window.google && google.accounts && google.accounts.id) {
          clearInterval(iv);
          initGoogle();
        } else if (++n > maxTries) {
          clearInterval(iv);
          console.warn("[CQ_AUTH] GIS never became ready");
        }
      }, 300);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }

  // Small API if you want to use it later
  window.CQAuth = {
    getUser: () => state.user,
    getToken: () => state.token,
    signOut,
  };
})();
