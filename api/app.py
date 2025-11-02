# api/app.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Optional
import math, random

app = FastAPI(title="CoffeeQuant API", version="1.0.0")

# ---- CORS (optional; keep if you want to call from other origins) ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Health ----
@app.get("/healthz")
def healthz():
    return {"ok": True}

# ---- IUL Vol-Target (excess return) pricing ----
class IULVTRequest(BaseModel):
    s0: float = Field(100, description="Initial index level")
    vt_vol: float = Field(0.12, description="Vol target (ann)")
    alpha: float = Field(1.0, description="Participation")
    cap: float = Field(0.12, description="Cap (e.g., 0.12)")
    floor: float = Field(0.0, description="Floor (e.g., 0.0)")
    tenor_y: float = Field(1.0, description="Tenor in years")
    sims: int = Field(30000, ge=1000, description="Monte Carlo paths")
    r: float = Field(0.02, description="Discount rate for PV")

class IULVTResponse(BaseModel):
    mean_credit: float
    stdev_credit: float
    p5: float
    p50: float
    p95: float
    price_pv: float
    n: int

@app.post("/api/iul/vt_price", response_model=IULVTResponse)
def vt_price(req: IULVTRequest):
    s0 = req.s0
    sigma = req.vt_vol
    T = req.tenor_y
    alpha = req.alpha
    cap = req.cap
    floor = req.floor
    r = req.r
    N = req.sims

    # Risk-neutral EXCESS-RETURN dynamic: S_T = S0 * exp(-0.5*sigma^2*T + sigma*sqrt(T)*Z)
    # Credit = clip(alpha * (S_T/S0 - 1), floor, cap)
    # Monte Carlo
    credits = []
    srT = math.sqrt(T) * sigma
    drift = -0.5 * sigma * sigma * T
    for _ in range(N):
        z = random.gauss(0.0, 1.0)
        st = s0 * math.exp(drift + srT * z)
        rT = (st / s0) - 1.0
        c = max(floor, min(alpha * rT, cap))
        credits.append(c)

    credits.sort()
    n = len(credits)
    mean = sum(credits) / n
    var = sum((x - mean) ** 2 for x in credits) / (n - 1) if n > 1 else 0.0
    stdev = math.sqrt(var)

    def quantile(q: float) -> float:
        if n == 0: return 0.0
        i = max(0, min(n - 1, int(q * (n - 1))))
        return credits[i]

    p5 = quantile(0.05)
    p50 = quantile(0.50)
    p95 = quantile(0.95)

    pv = math.exp(-r * T) * mean

    return IULVTResponse(
        mean_credit=mean,
        stdev_credit=stdev,
        p5=p5,
        p50=p50,
        p95=p95,
        price_pv=pv,
        n=n,
    )

# ---- Static site (mount LAST so /api/* takes precedence) ----
# Serves index.html at "/" and all assets relative to project root.
# If your repo root contains index.html and /statics, this will Just Work™.
app.mount("/", StaticFiles(directory=".", html=True), name="site")
