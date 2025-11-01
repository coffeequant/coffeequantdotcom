# api/app.py
# ------------------------------------------------------------
# CoffeeQuant IUL API + Local Static Server (FastAPI + Uvicorn)
# ------------------------------------------------------------
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from starlette.staticfiles import StaticFiles
import os, math, random, statistics

# ============================================================
# App
# ============================================================
app = FastAPI(title="CoffeeQuant IUL API", version="0.1")

# CORS — keep permissive for dev; restrict to your domain later
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],         # e.g. ["https://coffee.coffeequant.com"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths (repo layout assumptions)
# repo_root/
#   ├─ index.html
#   ├─ statics/...
#   └─ api/app.py   (this file)
REPO_ROOT   = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
STATICS_DIR = os.path.join(REPO_ROOT, "statics")
INDEX_PATH  = os.path.join(REPO_ROOT, "index.html")

# Mount /statics for local dev (in production App Engine can serve via app.yaml)
if os.path.isdir(STATICS_DIR):
    app.mount("/statics", StaticFiles(directory=STATICS_DIR), name="statics")

# Favicon (optional)
@app.get("/favicon.ico")
def favicon():
    path = os.path.join(STATICS_DIR, "favicon.ico")
    if os.path.exists(path):
        return FileResponse(path)
    return PlainTextResponse("", status_code=204)

# Simple health
@app.get("/api/health")
def health():
    return {"ok": True}

# ============================================================
# IUL Vol-Target pricing models
# ============================================================
class VTRequest(BaseModel):
    s0: float = Field(100, description="Initial index level")
    tenor_years: float = Field(1.0, description="Years to crediting date")
    vt_vol: float = Field(0.10, description="Annual vol target (e.g., 0.10 = 10%)")
    cap: Optional[float] = Field(None, description="Annual cap (e.g., 0.095 for 9.5%); None = uncapped")
    participation: float = Field(1.0, description="Participation rate")
    floor: float = Field(0.0, description="Credit floor (e.g., 0.00)")
    sims: int = Field(20000, description="Monte Carlo paths")

class VTPathResult(BaseModel):
    mean_credit: float
    p5: float
    p50: float
    p95: float
    hit_cap_ratio: float
    hit_floor_ratio: float
    raw_moments: dict

class VTPriceResponse(BaseModel):
    req: VTRequest
    est_fair_cost: float
    credit_stats: VTPathResult

def mc_credit_distribution(
    s0: float, T: float, sigma: float,
    participation: float, cap: Optional[float], floor: float, sims: int
):
    """
    Risk-neutral one-step GBM on a vol-target 'excess return' index:
    S_T = S0 * exp( -0.5*sigma^2*T + sigma*sqrt(T)*Z ),  Z ~ N(0,1)
    Credit = min(max(participation*(S_T/S0 - 1), floor), cap)
    """
    sqrtT = math.sqrt(T)
    mu = -0.5 * sigma * sigma * T
    stdev = sigma * sqrtT
    credits = []
    hit_cap = hit_floor = 0

    for _ in range(max(1, sims)):
        z = random.gauss(0.0, 1.0)
        ST = s0 * math.exp(mu + stdev * z)
        excess = (ST / s0) - 1.0
        cred = participation * excess
        if cap is not None:
            cred = min(cred, cap)
        cred = max(cred, floor)
        if cap is not None and cred >= cap - 1e-12:
            hit_cap += 1
        if cred <= floor + 1e-12:
            hit_floor += 1
        credits.append(cred)

    credits.sort()
    n = len(credits)
    mean = sum(credits) / n
    p5  = credits[int(0.05 * (n - 1))]
    p50 = credits[int(0.50 * (n - 1))]
    p95 = credits[int(0.95 * (n - 1))]
    stdev_ = statistics.pstdev(credits) if n > 1 else 0.0

    return {
        "mean": mean, "p5": p5, "p50": p50, "p95": p95,
        "hit_cap_ratio": hit_cap / n,
        "hit_floor_ratio": hit_floor / n,
        "stdev": stdev_
    }

def rough_fair_cost(mean_credit: float) -> float:
    # Transparent proxy: expected credit ≈ economic cost of the option sleeve
    # (Add issuer margins/admin/hedge buffers later.)
    return mean_credit

@app.post("/api/iul/vt_price", response_model=VTPriceResponse)
def vt_price(req: VTRequest):
    stats = mc_credit_distribution(
        s0=req.s0, T=req.tenor_years, sigma=req.vt_vol,
        participation=req.participation, cap=req.cap, floor=req.floor, sims=req.sims
    )
    resp = VTPriceResponse(
        req=req,
        est_fair_cost=rough_fair_cost(stats["mean"]),
        credit_stats=VTPathResult(
            mean_credit=stats["mean"],
            p5=stats["p5"], p50=stats["p50"], p95=stats["p95"],
            hit_cap_ratio=stats["hit_cap_ratio"],
            hit_floor_ratio=stats["hit_floor_ratio"],
            raw_moments={"stdev": stats["stdev"]}
        )
    )
    return resp

class BlendPiece(BaseModel):
    name: str
    weight: float
    vt_vol: float
    cap: Optional[float] = None
    participation: float = 1.0
    floor: float = 0.0

class BlendRequest(BaseModel):
    s0: float = 100
    tenor_years: float = 1.0
    pieces: List[BlendPiece]
    sims: int = 20000

class BlendResponse(BaseModel):
    req: BlendRequest
    weighted_mean_credit: float
    components: List[VTPriceResponse]

@app.post("/api/iul/blend", response_model=BlendResponse)
def iul_blend(req: BlendRequest):
    # Independent sleeve approximation for distribution tools (fast and transparent)
    comps: List[VTPriceResponse] = []
    weighted = 0.0
    for p in req.pieces:
        vt_req = VTRequest(
            s0=req.s0, tenor_years=req.tenor_years, vt_vol=p.vt_vol,
            cap=p.cap, participation=p.participation, floor=p.floor, sims=req.sims
        )
        pr: VTPriceResponse = vt_price(vt_req)  # reuse same logic
        comps.append(pr)
        weighted += p.weight * pr.credit_stats.mean_credit
    return BlendResponse(req=req, weighted_mean_credit=weighted, components=comps)

# ============================================================
# SPA catch-all for LOCAL DEV ONLY
# (In production, app.yaml serves /statics and / via static handlers,
# and routes /api/* here. Keeping this route still works but app.yaml
# will usually intercept first.)
# ============================================================
@app.get("/{full_path:path}")
def spa(full_path: str):
    """
    Serve index.html for any non-/api path in local dev.
    Order matters: this is placed last so it does NOT shadow /api/*.
    """
    if os.path.exists(INDEX_PATH):
        return FileResponse(INDEX_PATH)
    return JSONResponse({"error": "index.html not found"}, status_code=404)

