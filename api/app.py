# api/app.py
from pathlib import Path
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# ---- App + CORS ----
app = FastAPI(title="CoffeeQuant API", docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Static + index routing ----
ROOT = Path(__file__).resolve().parents[1]   # project root
STATICS_DIR = ROOT / "statics"
INDEX_HTML = ROOT / "index.html"
FAVICON = ROOT / "favicon.ico"

# Serve /statics/* from the statics folder
app.mount("/statics", StaticFiles(directory=str(STATICS_DIR)), name="statics")

# Health endpoints for GFE + custom
@app.get("/_ah/health", include_in_schema=False)
def gae_health():
    return PlainTextResponse("ok")

@app.get("/healthz", include_in_schema=False)
def healthz():
    return {"ok": True}

# Favicon
@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    if FAVICON.exists():
        return FileResponse(str(FAVICON))
    return PlainTextResponse("", status_code=204)

# Root -> index.html (serves your site)
@app.get("/", include_in_schema=False)
def index():
    if INDEX_HTML.exists():
        return FileResponse(str(INDEX_HTML))
    return PlainTextResponse("index.html not found", status_code=404)

# ---- IUL VT endpoint (kept simple and robust) ----
class VTReq(BaseModel):
    s0: float = Field(100.0, description="Start level")
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
    details: dict

# Lazy import numpy only when needed
def _price_iul_vt(req: VTReq) -> VTRsp:
    import numpy as np

    rng = np.random.default_rng(req.seed)
    T = req.years
    sig = req.vt_vol

    # Q-drift for excess return = -0.5 * sigma^2
    z = rng.standard_normal(req.n_paths)
    rt = np.exp(-0.5 * sig * sig * T + sig * np.sqrt(T) * z) - 1.0  # excess return
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
    try:
        return _price_iul_vt(req)
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=400)

