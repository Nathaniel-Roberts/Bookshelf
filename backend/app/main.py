from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database import engine
from app.init_db import init_db
from app.routers import auth, books, copies, history, loans, lookup, series, settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
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


@app.get("/api/health")
async def health():
    return {"status": "ok"}
