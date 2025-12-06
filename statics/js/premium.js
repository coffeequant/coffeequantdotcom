// statics/js/premium.js
// Handles premium status + Stripe checkout flow on Premium.html (and anywhere else)

(function () {
  const $ = (sel) => document.querySelector(sel);

  function log(...args) {
    console.log("[CQ_PREMIUM]", ...args);
  }

  async function fetchJSON(url, options = {}) {
    const resp = await fetch(url, {
      credentials: "include",
      ...options,
    });

    let data = null;
    const text = await resp.text().catch(() => "");

    try {
      if (text) data = JSON.parse(text);
    } catch (e) {
      // not JSON, keep as text
    }

    if (!resp.ok) {
      const detail =
        (data && (data.detail || data.error || JSON.stringify(data))) ||
        text ||
        `HTTP ${resp.status}`;
      const err = new Error(detail);
      err.status = resp.status;
      err.raw = text;
      throw err;
    }

    return data !== null ? data : {};
  }

  async function getMe() {
    try {
      const data = await fetchJSON("/api/user/me", { method: "GET" });
      return data;
    } catch (e) {
      log("Error fetching /api/user/me:", e);
      return { ok: false, user: null, is_premium: false };
    }
  }

  async function initPremiumPage() {
    const msgEl = $("#cqPremiumMsg");
    const btnEl = $("#cqSubscribeBtn");

    if (!msgEl || !btnEl) {
      log("Premium elements not found on page");
      return;
    }

    msgEl.textContent = "Checking your access…";

    const me = await getMe();

    if (!me.ok || !me.user) {
      msgEl.textContent = "Please sign in with Google first.";
      btnEl.disabled = false;
    } else if (me.is_premium) {
      msgEl.textContent = "You already have premium access. All premium Labs and Tools are unlocked.";
      btnEl.disabled = true;
      btnEl.textContent = "Premium active";
      btnEl.classList.add("cq-btn-disabled");
    } else {
      msgEl.textContent = "Signed in. Click subscribe to unlock all premium Labs and Tools.";
      btnEl.disabled = false;
    }

    btnEl.addEventListener("click", async (e) => {
      e.preventDefault();
      await handleSubscribeClick(btnEl, msgEl);
    });
  }

  async function handleSubscribeClick(btnEl, msgEl) {
    msgEl = msgEl || $("#cqPremiumMsg");
    btnEl = btnEl || $("#cqSubscribeBtn");

    if (!msgEl || !btnEl) return;

    // Re-check login status just before starting Stripe
    const me = await getMe();

    if (!me.ok || !me.user) {
      msgEl.textContent = "Please sign in with Google first.";
      return;
    }

    if (me.is_premium) {
      msgEl.textContent = "You already have premium access — no need to subscribe again.";
      btnEl.disabled = true;
      btnEl.textContent = "Premium active";
      btnEl.classList.add("cq-btn-disabled");
      return;
    }

    btnEl.disabled = true;
    btnEl.textContent = "Connecting to Stripe…";
    msgEl.textContent = "Creating secure Stripe checkout session…";

    try {
      const originPath = window.location.pathname || "/";

      const data = await fetchJSON("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ originPath }),
      });

      if (!data.ok || !data.checkout_url) {
        throw new Error("Server did not return a Stripe checkout URL.");
      }

      msgEl.textContent = "Redirecting to Stripe…";
      window.location.href = data.checkout_url;
    } catch (err) {
      console.error("[CQ_PREMIUM] Stripe error:", err);
      msgEl.textContent = `Stripe error: ${err.message || "Unexpected server response"}`;
      btnEl.disabled = false;
      btnEl.textContent = "Subscribe";
    }
  }

  window.addEventListener("DOMContentLoaded", initPremiumPage);
})();
