# api/auth.py
from datetime import datetime, timedelta
from typing import Optional, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from google.oauth2 import id_token
from google.auth.transport import requests as grequests

router = APIRouter(prefix="/api", tags=["auth"])

# TODO: put the real client_id here or load from env
GOOGLE_CLIENT_ID = "58596950813-89s7vbdb1lnhom1t93mc979lgp5143eo.apps.googleusercontent.com"


class User(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    is_subscribed: bool = False
    sub_expiry: Optional[datetime] = None


# TEMP: in-memory KV store; replace with Firestore / Datastore later
_users: Dict[str, User] = {}


class GoogleLoginRequest(BaseModel):
    id_token: str  # raw JWT from Google


def _verify_google_token(id_token_str: str) -> User:
    try:
        idinfo = id_token.verify_oauth2_token(
            id_token_str,
            grequests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google ID token")

    if idinfo.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="Wrong issuer")

    email = idinfo.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="No email in token")

    name = idinfo.get("name") or email.split("@")[0]

    user = _users.get(email)
    if not user:
        user = User(email=email, name=name, is_subscribed=False, sub_expiry=None)
        _users[email] = user
    else:
        # keep existing subscription; just refresh name if changed
        user.name = name

    return user


@router.post("/auth/google")
def login_google(req: GoogleLoginRequest):
    user = _verify_google_token(req.id_token)

    # Check active subscription
    active = bool(user.is_subscribed and user.sub_expiry and user.sub_expiry > datetime.utcnow())

    return {
        "ok": True,
        "user": {
            "email": user.email,
            "name": user.name,
            "is_subscribed": active,
            "sub_expiry": user.sub_expiry.isoformat() if user.sub_expiry else None,
        },
    }


class SubscriptionRequest(BaseModel):
    email: EmailStr


@router.post("/subscription/mock-upgrade")
def mock_upgrade(req: SubscriptionRequest):
    # For now: mark this user as subscribed for 1 year (demo).
    user = _users.get(req.email)
    if not user:
        user = User(email=req.email, name=req.email.split("@")[0])
        _users[req.email] = user

    user.is_subscribed = True
    user.sub_expiry = datetime.utcnow() + timedelta(days=365)

    return {
        "ok": True,
        "message": "Subscription activated for 1 year (mock).",
        "user": {
            "email": user.email,
            "name": user.name,
            "is_subscribed": True,
            "sub_expiry": user.sub_expiry.isoformat(),
        },
    }


@router.get("/subscription/status")
def subscription_status(email: EmailStr):
    user = _users.get(email)
    if not user:
        return {"ok": True, "is_subscribed": False, "sub_expiry": None}

    active = bool(user.is_subscribed and user.sub_expiry and user.sub_expiry > datetime.utcnow())
    return {
        "ok": True,
        "is_subscribed": active,
        "sub_expiry": user.sub_expiry.isoformat() if user.sub_expiry else None,
    }

