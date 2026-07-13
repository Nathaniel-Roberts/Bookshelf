import time
from collections import defaultdict, deque

from fastapi import APIRouter, HTTPException, Request, status

from app.auth import create_access_token, verify_password
from app.schemas.auth import LoginRequest, LoginResponse

router = APIRouter()

# In-process sliding-window rate limit on failed logins. The app runs as a
# single uvicorn worker, so no shared store is needed.
_WINDOW_SECONDS = 60
_MAX_FAILURES = 5
_failures: dict[str, deque[float]] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    # nginx fronts the backend, so the direct peer is the proxy; trust its
    # X-Forwarded-For over the socket address.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rate_limited(ip: str) -> bool:
    now = time.monotonic()
    window = _failures[ip]
    while window and now - window[0] > _WINDOW_SECONDS:
        window.popleft()
    if not window:
        del _failures[ip]
        return False
    return len(window) >= _MAX_FAILURES


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, http_request: Request):
    ip = _client_ip(http_request)
    if _rate_limited(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Try again in a minute.",
        )
    if not verify_password(request.password):
        _failures[ip].append(time.monotonic())
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")
    _failures.pop(ip, None)
    return LoginResponse(token=create_access_token())
