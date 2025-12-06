import os
import json
import base64
import secrets
import math
import random
from pathlib import Path
from typing import Optional, Dict, Any

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import (
    FileResponse, HTMLResponse, JSONResponse, PlainTextResponse
)
from pydantic import BaseModel

# -----------------------------------------------------------------------------
#   OPTIONAL STRIPE
# -----------------------------------------------------------------------------
try:
    import stripe as stripe_lib
except ImportError:
    stripe_lib = None

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_PRICE_ID_YEARLY = os.getenv("STRIPE_PRICE_ID_YEARLY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:8000")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

if stripe_lib and STRIPE_SECRET_KEY:
    stripe_lib.api_key = STRIPE_SECRET_KEY

# -----------------------------------------------------------------------------
#   FASTAPI APP
# -----------------------------------------------------------------------------
app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "statics"
INDEX_FILE = BASE_DIR / "index.html"

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://coffee.coffeequant.com",
        "http://coffee.coffeequant.com",
        "https://coffeequant.appspot.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/statics", StaticFiles(directory=str(STATIC_DIR)), name="statics")

# -----------------------------------------------------------------------------
#   SIMPLE SESSION STORE
# -----------------------------------------------------------------------------
SESSIONS: Dict[str, Dict[str, Any]] = {}
PREMIUM_OVERRIDE = {"animesh.saxena@gmail.com"}

def _decode_jwt_noverify(token: str) -> Optional[dict]:
    """Decode payload of Google JWT WITHOUT verifying (signature verified client-side)."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        payload_b64 = parts[1]
        padding = "=" * (-len(payload_b64) % 4)
        data = base64.urlsafe_b64decode(payload_b64 + padding)
        return json.loads(data.decode("utf-8"))
    except Exception:
        return None

def _new_session(user: dict) -> str:
    token = secrets.token_hex(32)
    SESSIONS[token] = {
        "user": user,
        "is_premium": user.get("is_premium", False)
    }
    return token

def _get_session(request: Request) -> Optional[Dict[str, Any]]:
    tok = request.cookies.get("cq_session")
    if not tok:
        tok = request.headers.get("X-CQ-Session")
    if not tok:
        return None
    return SESSIONS.get(tok)

# -----------------------------------------------------------------------------
#   ROOT
# -----------------------------------------------------------------------------
@app.get("/", response_class=HTMLResponse)
async def root():
    if INDEX_FILE.exists():
        return FileResponse(str(INDEX_FILE))
    return PlainTextResponse("index.html not found", status_code=404)

@app.get("/healthz")
async def healthz():
    return {"ok": True}

# -----------------------------------------------------------------------------
#   GOOGLE SIGN-IN CALLBACK
# -----------------------------------------------------------------------------
class GoogleCredential(BaseModel):
    credential: str

from google.oauth2 import id_token
from google.auth.transport import requests as grequests

@app.post("/api/auth/google/callback")
async def google_callback(request: Request):
    data = await request.json()
    credential = data.get("credential")

    if not credential:
        raise HTTPException(status_code=400, detail="Missing credential")

    try:
        payload = id_token.verify_oauth2_token(
            credential,
            grequests.Request(),
            GOOGLE_CLIENT_ID
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Google token invalid: {e}")

    email = payload.get("email", "").lower()
    name = payload.get("name", "")
    picture = payload.get("picture", "")
    sub = payload.get("sub", "")

    # premium override
    is_premium = email in PREMIUM_OVERRIDE

    # Create session token
    token = secrets.token_hex(32)
    SESSIONS[token] = {
        "user": {
            "email": email,
            "name": name,
            "picture": picture,
            "sub": sub,
            "is_premium": is_premium,
        },
        "is_premium": is_premium
    }

    response = JSONResponse({
        "ok": True,
        "user": SESSIONS[token]["user"],
        "token": token,
    })
    response.set_cookie("cq_session", token, httponly=False)
    return response

# -----------------------------------------------------------------------------
#   LOGOUT
# -----------------------------------------------------------------------------
@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    tok = request.cookies.get("cq_session")
    if tok and tok in SESSIONS:
        del SESSIONS[tok]
    response.delete_cookie("cq_session")
    return {"ok": True}

# -----------------------------------------------------------------------------
#   USER SELF LOOKUP
# -----------------------------------------------------------------------------
@app.get("/api/user/me")
async def user_me(request: Request):
    sess = _get_session(request)
    if not sess:
        return {"ok": False, "user": None, "is_premium": False}
    return {
        "ok": True,
        "user": sess["user"],
        "is_premium": sess.get("is_premium", False),
    }

# -----------------------------------------------------------------------------
#   STRIPE CHECKOUT
# -----------------------------------------------------------------------------
class CheckoutReq(BaseModel):
    originPath: Optional[str] = None

@app.post("/api/stripe/create-checkout")
async def create_checkout(req: CheckoutReq, request: Request):
    if not (stripe_lib and STRIPE_SECRET_KEY and STRIPE_PRICE_ID_YEARLY):
        raise HTTPException(status_code=500, detail="Stripe not configured")

    sess = _get_session(request)
    if not sess:
        raise HTTPException(status_code=401, detail="Please sign in")

    email = sess["user"].get("email")
    origin = req.originPath or "/"

    success_url = (
        f"{FRONTEND_BASE_URL}/statics/Tools/PremiumSuccess.html"
        f"?session_id={{CHECKOUT_SESSION_ID}}&origin={origin}"
    )
    cancel_url = f"{FRONTEND_BASE_URL}/statics/Tools/PremiumCancel.html"

    try:
        ck = stripe_lib.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": STRIPE_PRICE_ID_YEARLY, "quantity": 1}],
            customer_email=email,
            success_url=success_url,
            cancel_url=cancel_url,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stripe error: {e}")

    return {"ok": True, "checkout_url": ck.url}

# -----------------------------------------------------------------------------
#   STRIPE WEBHOOK
# -----------------------------------------------------------------------------
@app.post("/api/stripe/webhook")
async def stripe_webhook(request: Request):
    if not (stripe_lib and STRIPE_WEBHOOK_SECRET):
        raise HTTPException(status_code=500, detail="Webhook not configured")

    payload = await request.body()
    sig = request.headers.get("stripe-signature")

    try:
        event = stripe_lib.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {e}")

    if event["type"] == "checkout.session.completed":
        sess_obj = event["data"]["object"]
        email = sess_obj.get("customer_email")

        if email:
            for _, s in SESSIONS.items():
                if s["user"].get("email") == email:
                    s["is_premium"] = True

    return {"ok": True}

# -----------------------------------------------------------------------------
#   PREMIUM CHECK
# -----------------------------------------------------------------------------
def _require_premium(request: Request):
    sess = _get_session(request)
    if not sess:
        raise HTTPException(status_code=401, detail="Sign in required")

    email = sess["user"].get("email")
    if email in PREMIUM_OVERRIDE:
        return

    if not sess.get("is_premium"):
        raise HTTPException(status_code=402, detail="Premium subscription required")

# -----------------------------------------------------------------------------
#   VOL-TARGET IUL ENGINE (PREMIUM)
# -----------------------------------------------------------------------------
class VTReq(BaseModel):
    s0: float = 100.0
    vt_vol: float = 0.10
    cap: float = 0.12
    floor: float = -0.05
    participation: float = 1.0
    years: int = 1
    n_paths: int = 20000
    seed: Optional[int] = None

@app.post("/api/iul/vt_price")
async def vt_price(req: VTReq, request: Request):
    _require_premium(request)

    rng = random.Random(req.seed)
    credits = []
    s0 = req.s0
    sigma = req.vt_vol
    cap = req.cap
    floor = req.floor
    alpha = req.participation
    T = float(req.years)

    for _ in range(req.n_paths):
        z = rng.gauss(0.0, 1.0)
        sT = s0 * math.exp(-0.5 * sigma * sigma * T + sigma * math.sqrt(T) * z)
        rT = sT / s0 - 1.0
        credit = max(alpha * rT, floor)
        credit = min(credit, cap)
        credits.append(credit)

    n = len(credits)
    mean = sum(credits) / n
    var = sum((c - mean) ** 2 for c in credits) / n
    sd = math.sqrt(var)

    p_floor = sum(1 for c in credits if c <= floor + 1e-12) / n
    p_cap = sum(1 for c in credits if c >= cap - 1e-12) / n

    return {
        "ok": True,
        "mean_credit": mean,
        "stdev_credit": sd,
        "p_floor": p_floor,
        "p_cap": p_cap,
        "sample": credits[:1000],
        "n_paths": n,
    }
