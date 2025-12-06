(function () {
  const log = (...args) => console.log("[CQ_AUTH]", ...args);
  const $ = (sel, root = document) => root.querySelector(sel);

  const state = {
    clientId: null,
    user: null,
    token: null,
    isPremium: false,
  };

  // SPECIAL: your address is always premium
  const ALWAYS_PREMIUM_EMAIL = "animesh.saxena@gmail.com";

  function applyPremiumFlag() {
    if (!state.user) {
      state.isPremium = false;
      return;
    }
    if (state.user.email === ALWAYS_PREMIUM_EMAIL) {
      state.isPremium = true;
      return;
    }
    // otherwise: depends on backend flag in `user.is_premium`
    if (state.user.is_premium) {
      state.isPremium = true;
    } else {
      state.isPremium = false;
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem("cq_session");
      if (!raw) return;
      const data = JSON.parse(raw);
      state.user = data.user || null;
      state.token = data.token || null;
      applyPremiumFlag();
      log("Loaded session", state.user);
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
      localStorage.setItem(
        "cq_session",
        JSON.stringify({
          user: state.user,
          token: state.token,
        })
      );
    } catch (e) {
      console.warn("[CQ_AUTH] Failed to save session", e);
    }
  }

  function updateUI() {
    const label = $("#cqAuthLabel");
    const signInBtn = $("#cqSignInBtn");
    const signOutBtn = $("#cqSignOutBtn");

    if (state.user) {
      label.textContent = `Signed in as ${state.user.email}`;
      signInBtn.style.display = "none";
      signOutBtn.style.display = "inline-flex";
      document.body.classList.add("cq-has-session");
    } else {
      label.textContent = "Not signed in";
      signInBtn.style.display = "inline-flex";
      signOutBtn.style.display = "none";
      document.body.classList.remove("cq-has-session");
    }

    // Update global state so premium.js sees it
    window.CQ_AUTH_STATE = {
      user: state.user,
      token: state.token,
      isPremium: state.isPremium,
    };
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
        console.error("[CQ_AUTH] Login failed", data);
        return;
      }

      state.user = data.user || null;
      state.token = data.token || null;
      applyPremiumFlag();
      saveSession();
      updateUI();
      log("Signed in", state.user);
    } catch (e) {
      console.error("[CQ_AUTH] Credential error", e);
    }
  }

  function handleCredentialResponse(response) {
    if (!response || !response.credential) return;
    sendCredential(response.credential);
  }

  function signOut() {
    state.user = null;
    state.token = null;
    state.isPremium = false;

    saveSession();
    if (window.google?.accounts?.id) {
      google.accounts.id.disableAutoSelect();
    }
    updateUI();
    log("Signed out");
  }

  window.handleCredentialResponse = handleCredentialResponse;

  function initGoogle() {
    if (!window.google?.accounts?.id) {
      console.error("[CQ_AUTH] GIS SDK missing");
      return;
    }

    state.clientId = window.CQ_GOOGLE_CLIENT_ID || null;
    if (!state.clientId) {
      console.error("Missing Google client ID");
      return;
    }

    google.accounts.id.initialize({
      client_id: state.clientId,
      callback: handleCredentialResponse,
      auto_select: false,
      use_fedcm_for_prompt: false,
    });

    google.accounts.id.renderButton(document.getElementById("gSignInBtn"), {
      type: "standard",
      theme: "outline",
      size: "medium",
      shape: "pill",
    });

    $("#cqSignInBtn").onclick = () => {
      google.accounts.id.prompt();
    };

    $("#cqSignOutBtn").onclick = () => {
      signOut();
    };

    log("Google Identity initialized");
  }

  function onReady() {
    loadSession();
    updateUI();

    let tries = 0;
    const iv = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(iv);
        initGoogle();
      } else if (++tries > 15) {
        clearInterval(iv);
        console.warn("GIS never ready");
      }
    }, 300);
  }

  (document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", onReady)
    : onReady());

  // Export global session for other scripts
  window.CQ_AUTH_STATE = state;
  window.CQAuth = {
    getUser: () => state.user,
    getToken: () => state.token,
    isPremium: () => state.isPremium,
    signOut,
  };
})();
