# api/app.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import numpy as np
import math

# --------------------------
# FastAPI app (must be named `app`)
# --------------------------
app = FastAPI(title="CoffeeQuant API", version="1.0.0")

# CORS (loose for now; restrict to your domain later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # e.g. ["https://coffee.coffeequant.com"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------
# Models (Py3.9 compatible: use Optional[...] not `| None`)
# --------------------------
class VTReq(BaseModel):
    s0: float = Field(100.0, description="Starting level (index = 100)")
    vt_vol: float = Field(0.10, description="Vol target (annualized, e.g. 0.10 = 10%)")
    alpha: float = Field(1.0, description="Participation on excess return")
    cap: float = Field(0.10, description="Credit cap (e.g. 0.10 = +10%)")
    floor: float = Field(0.00, description="Credit floor (e.g. 0.00 = 0%)")
    years: int = Field(1, description="Annual reset tenor used for PV")
    rf: float = Field(0.04, description="Risk-free for PV")
    trials: int = Field(20000, description="Monte Carlo paths (1k–200k)")
    seed: Optional[int] = Field(None, description="Random seed (optional)")

# --------------------------
# Health / Ping
# --------------------------
@app.get("/healthz")
def healthz():
    return {"ok": True, "service": "coffeequant", "version": "1.0.0"}

@app.get("/api/ping")
def ping():
    return {"ok": True}

# --------------------------
# IUL vol-target excess return crediting (Monte Carlo)
# --------------------------
@app.post("/api/iul/vt_price")
def vt_price(req: VTReq):
    """
    Risk-neutral excess-return dynamic for vol-target index:
      S_T/S_0 = exp(-0.5*sigma^2*T + sigma*sqrt(T)*Z)
    Annual reset credit:
      credit = clip(alpha * (S_T/S_0 - 1), floor, cap)
    Returns KPIs + a downsample of credits for front-end histogram.
    """
    # Sanitize
    T   = float(max(1, req.years))       # years >= 1 for simple PV
    sig = float(max(1e-6, req.vt_vol))
    N   = int(max(1000, min(req.trials, 200000)))
    cap = float(req.cap)
    flr = float(req.floor)
    alp = float(req.alpha)
    rf  = float(req.rf)

    # RNG
    rng = np.random.default_rng(req.seed)

    # Monte Carlo under Q for excess return
    Z = rng.standard_normal(N)
    ST_over_S0 = np.exp(-0.5 * sig * sig * T + sig * math.sqrt(T) * Z)
    R_T = ST_over_S0 - 1.0

    # Crediting rule
    credits = np.clip(alp * R_T, flr, cap)

    # KPIs
    mean_credit = float(np.mean(credits))
    pv = float(mean_credit * math.exp(-rf * T))
    # Hook: you can compute a fair policy charge / spread from pv if you want
    fair_spread = None

    # Downsample for UI histogram to keep payload small
    keep = min(N, 5000)
    idx = rng.choice(N, size=keep, replace=False)
    credits_small = credits[idx].astype(float).tolist()

    return {
        "ok": True,
        "mean_credit": mean_credit,
        "pv": pv,
        "fair_spread": fair_spread,
        "credits": credits_small
    }

