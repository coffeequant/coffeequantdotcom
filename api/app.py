"""
CoffeeQuant backend API

- Serves the static SPA (index.html + /statics/*)
- Google Sign-In callback stub (returns a demo session token)
- IUL / vol-target Monte Carlo endpoint
- Stripe scaffolding for future subscriptions
"""

import os
import datetime as dt
from pathlib import Path
from typing import Optional, Dict, Any

import stripe
from fastapi import FastAPI, Request, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .auth import router as auth_router  # your existing auth router (for future use)

# ----------------- Stripe config (scaffolding) -----------------

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")

# Yearly subscription price (Stripe Price ID)
STRIPE_PRICE_ID = os.environ.get("STRIPE_PRICE_ID", "")

# Webhook secret for Stripe (used by /api/billing/webhook)
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

# VERY simple in-memory subscription store (dev only).
# Replace with Firestore / DB in production.
_SUBS_DB: Dict[str, Dict[str, Any]] = {}

# ----------------- FastAPI app + CORS -----------------

app = FastAPI(title="CoffeeQuant API", docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # you can tighten this to your domains later
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Auth / user helpers -----------------


class CQUser(BaseModel):
    sub: str
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None


def get_user_from_token(authorization: Optional[str] = Header(default=None)) -> CQUser:
    """
    SUPER simple placeholder. In production you should verify the token (e.g. JWT).
    For now we reuse the demo session token.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header")

    token = parts[1]

    # Demo path: any client that has 'demo-session-token' is treated as a valid user.
    if token == "demo-session-token":
        return CQUser(
            sub="demo-user-123",
            email="demo@coffeequant.com",
            name="CoffeeQuant Demo",
            picture="https://www.gravatar.com/avatar?d=identicon",
        )

    # For now deny everything else.
    raise HTTPException(status_code=401, detail="Unknown token")


# ----------------- Google Identity callback stub -----------------


class GoogleCallbackPayload(BaseModel):
    # Matches the "credential" field from Google Identity Services
    credential: str


@app.post("/api/auth/google/callback")
async def google_auth_callback(payload: GoogleCallbackPayload, request: Request):
    """
    Minimal stub: accepts a Google ID token from the browser,
    pretends to validate it, and returns a session token + user payload.

    Later you can plug in:
      google.oauth2.id_token.verify_oauth2_token(...)
    """
    id_token_str = payload.credential  # noqa: F841  # not used yet

    fake_user = {
        "sub": "demo-user-123",
        "email": "demo@coffeequant.com",
        "name": "CoffeeQuant Demo",
        "picture": "https://www.gravatar.com/avatar?d=identicon",
    }

    return {
        "ok": True,
        "user": fake_user,
        "token": "demo-session-token",
    }


# ----------------- Static / index routing -----------------

ROOT = Path(__file__).resolve().parents[1]   # project root
STATICS_DIR = ROOT / "statics"
INDEX_HTML = ROOT / "index.html"
FAVICON = ROOT / "favicon.ico"

# Serve /statics/* from the statics folder
app.mount("/statics", StaticFiles(directory=str(STATICS_DIR)), name="statics")

# Include any extra auth routes you already have
app.include_router(auth_router)


@app.get("/_ah/health", include_in_schema=False)
def gae_health():
    """Health check for App Engine."""
    return PlainTextResponse("ok")


@app.get("/healthz", include_in_schema=False)
def healthz():
    """Simple health endpoint for curl / monitors."""
    return {"ok": True}


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    if FAVICON.exists():
        return FileResponse(str(FAVICON))
    return PlainTextResponse("", status_code=204)


@app.get("/", include_in_schema=False)
def index():
    if INDEX_HTML.exists():
        return FileResponse(str(INDEX_HTML))
    return PlainTextResponse("index.html not found", status_code=404)


# ----------------- IUL vol-target endpoint -----------------


class VTReq(BaseModel):
    s0: float = Field(100.0, description="Start level (unused for pure ER, kept for future)")
    vt_vol: float = Field(0.10, description="Annual vol target (e.g., 0.10)")
    years: float = Field(1.0, description="Maturity in years")
    n_paths: int = Field(20000, description="Monte Carlo paths")
    cap: float = Field(0.10, description="Cap per period")
    floor: float = Field(0.00, description="Floor per period")
    alpha: float = Field(1.0, description="Participation")
    seed: Optional[int] = Field(None, description="Random seed")


class VTRsp(BaseModel):
    ok: bool
    mean_credit: float
    stdev_credit: float
    details: Dict[str, Any]


def _price_iul_vt(req: VTReq) -> VTRsp:
    """Monte Carlo on excess-return vol-target index with cap/floor."""
    import numpy as np

    rng = np.random.default_rng(req.seed)
    T = req.years
    sig = req.vt_vol

    # Risk-neutral excess return: drift = -0.5 * sigma^2
    z = rng.standard_normal(req.n_paths)
    rt = np.exp(-0.5 * sig * sig * T + sig * (T ** 0.5) * z) - 1.0  # excess return
    credit = np.clip(req.alpha * rt, req.floor, req.cap)

    return VTRsp(
        ok=True,
        mean_credit=float(np.mean(credit)),
        stdev_credit=float(np.std(credit, ddof=1)),
        details={
            "paths": req.n_paths,
            "years": T,
            "vt_vol": sig,
            "cap": req.cap,
            "floor": req.floor,
            "alpha": req.alpha,
        },
    )


@app.post("/api/iul/vt_price", response_model=VTRsp)
def vt_price(req: VTReq):
    """Public API used by IULLab.html."""
    try:
        return _price_iul_vt(req)
    except Exception as e:  # pragma: no cover
        return JSONResponse({"ok": False, "error": str(e)}, status_code=400)


# ----------------- Stripe subscription scaffolding -----------------

class CheckoutReq(BaseModel):
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None
    price_id: Optional[str] = None


@app.post("/api/billing/checkout")
def create_checkout_session(
    req: CheckoutReq,
    user: CQUser = Depends(get_user_from_token),
):
    """
    Creates a Stripe Checkout session for yearly subscription.

    Front-end will redirect the browser to the 'url' returned here.
    """
    if not stripe.api_key or not (STRIPE_PRICE_ID or req.price_id):
        raise HTTPException(
            status_code=500,
            detail="Stripe not configured on server",
        )

    price_id = req.price_id or STRIPE_PRICE_ID

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer_email=user.email,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=req.success_url
            or "https://coffee.coffeequant.com/?billing=success",
            cancel_url=req.cancel_url
            or "https://coffee.coffeequant.com/?billing=cancel",
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Optional: optimistic mark in memory
    _SUBS_DB[user.email] = {
        "status": "pending",
        "updated_at": dt.datetime.utcnow().isoformat(),
    }

    return {"id": session.id, "url": session.url}


@app.get("/api/me/subscription")
def me_subscription(user: CQUser = Depends(get_user_from_token)):
    """
    Returns a very simple subscription status for the logged-in user.

    For now uses an in-memory store keyed by email. Replace with DB later.
    """
    sub = _SUBS_DB.get(user.email)
    if not sub:
        return {"active": False, "status": "none"}
    return {"active": sub.get("status") == "active", **sub}


@app.post("/api/billing/webhook")
async def stripe_webhook(request: Request):
    """
    Stripe webhook endpoint.

    In production, register this URL in the Stripe dashboard and set
    STRIPE_WEBHOOK_SECRET in App Engine env vars.
    """
    if not STRIPE_WEBHOOK_SECRET:
        # If not configured, you probably don't want this endpoint live
        raise HTTPException(status_code=400, detail="Webhook secret not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {e}")

    etype = event.get("type")
    data = event.get("data", {}).get("object", {})

    # Typical flow: on checkout.session.completed, activate subscription
    if etype == "checkout.session.completed":
        email = data.get("customer_email")
        if email:
            _SUBS_DB[email] = {
                "status": "active",
                "updated_at": dt.datetime.utcnow().isoformat(),
                "source": "stripe",
            }

    # You can add more event handling here (invoice.payment_failed, etc.)
    return {"received": True}

