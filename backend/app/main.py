import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.database import engine
from app.init_db import init_db
from app.routers import auth, books, copies, history, loans, lookup, series, settings
from app.services.covers import covers_path
from app.services.notifications import check_overdue_and_notify

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)

OVERDUE_CHECK_INTERVAL = 24 * 3600


async def _overdue_loop():
    while True:
        try:
            result = await check_overdue_and_notify()
            if result["sent"]:
                logger.info("Sent overdue webhook for %s loan(s)", result["overdue"])
        except Exception as exc:
            logger.warning("Overdue check failed: %s", exc)
        await asyncio.sleep(OVERDUE_CHECK_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    overdue_task = asyncio.create_task(_overdue_loop())
    yield
    overdue_task.cancel()
    await engine.dispose()


app = FastAPI(title="Bookshelf API", version="0.1.0", lifespan=lifespan)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(books.router, prefix="/api/books", tags=["books"])
app.include_router(series.router, prefix="/api/series", tags=["series"])
app.include_router(copies.router, prefix="/api/copies", tags=["copies"])
app.include_router(loans.router, prefix="/api/loans", tags=["loans"])
app.include_router(lookup.router, prefix="/api/lookup", tags=["lookup"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(history.router, prefix="/api/history", tags=["history"])

# Locally cached cover images (see app/services/covers.py)
app.mount("/api/covers", StaticFiles(directory=covers_path()), name="covers")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
