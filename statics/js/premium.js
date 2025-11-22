// statics/js/premium.js
// Minimal helper for premium gating and Stripe checkout
(function(){
  const log = (...args) => console.log('[CQ_PREMIUM]', ...args);

  const state = {
    statusLoaded: false,
    premium: false,
    premiumUntil: null,
  };

  async function fetchStatus() {
    if (!window.CQAuth) {
      log('CQAuth not ready');
      return null;
    }
    const token = window.CQAuth.getToken();
    try {
      const res = await fetch('/api/user/subscription/status', {
        headers: {
          'accept': 'application/json',
          ...(token ? { 'authorization': 'Bearer ' + token } : {})
        }
      });
      if (!res.ok) {
        log('status HTTP', res.status);
        return null;
      }
      const data = await res.json();
      state.statusLoaded = true;
      state.premium = !!data.premium;
      state.premiumUntil = data.premium_until || null;
      return data;
    } catch (e) {
      log('status error', e);
      return null;
    }
  }

  async function requirePremium(options) {
    // options: { redirectToPremium: true/false }
    if (!state.statusLoaded) {
      await fetchStatus();
    }
    if (!state.premium) {
      if (options && options.redirectToPremium) {
        window.location.href = '/statics/Tools/premium.html';
      }
      return false;
    }
    return true;
  }

  async function beginCheckout() {
    if (!window.CQAuth || !window.CQAuth.getUser()) {
      alert('Please sign in with Google first.');
      return;
    }
    try {
      const token = window.CQAuth.getToken();
      const res = await fetch('/api/payments/create-checkout-session', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json',
          ...(token ? { 'authorization': 'Bearer ' + token } : {})
        },
        body: JSON.stringify({
          success_url: window.location.origin + '/statics/Tools/checkout.html?success=1',
          cancel_url: window.location.origin + '/statics/Tools/checkout.html?success=0'
        })
      });
      if (!res.ok) {
        const text = await res.text();
        console.error('Checkout error', text);
        alert('Could not start checkout (server error).');
        return;
      }
      const data = await res.json();
      if (!data.checkout_url) {
        alert('Checkout URL missing from server response.');
        return;
      }
      window.location.href = data.checkout_url;
    } catch (err) {
      console.error('Checkout failed', err);
      alert('Could not start checkout (network error).');
    }
  }

  function hookPremiumPage() {
    const statusEl = document.getElementById('cqPremiumStatus');
    const btn = document.getElementById('cqUpgradeBtn');
    if (!statusEl || !btn) return;

    // initial text
    statusEl.textContent = 'Checking your subscription…';

    btn.addEventListener('click', function(){
      beginCheckout();
    });

    // After auth is ready, refresh status
    if (window.CQAuth && window.CQAuth.onReady) {
      window.CQAuth.onReady(async function(user){
        if (!user) {
          statusEl.textContent = 'Sign in with Google to upgrade.';
          btn.disabled = true;
          return;
        }
        btn.disabled = false;
        const data = await fetchStatus();
        if (data && data.premium) {
          statusEl.textContent = 'You already have CoffeeQuant Premium 🎉';
          btn.disabled = true;
        } else {
          statusEl.textContent = 'Signed in. Ready to upgrade.';
        }
      });
    }
  }

  // expose a small API
  window.CQPremium = {
    requirePremium,
    fetchStatus,
    isPremium: () => !!state.premium,
  };

  // Auto-hook when DOM ready
  document.addEventListener('DOMContentLoaded', hookPremiumPage);
})();

