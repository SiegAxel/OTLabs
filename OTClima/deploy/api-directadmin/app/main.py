import base64
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.config.settings import settings
from app.routes import auth, admin, clients, company, technicians, work_orders


class SwaggerAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        swagger_paths = ["/docs", "/redoc", "/openapi.json", "/docs/oauth2-redirect"]
        
        if request.url.path in swagger_paths:
            if not settings.DEBUG:
                auth_header = request.headers.get("Authorization")
                
                if not auth_header or not auth_header.startswith("Basic "):
                    return JSONResponse(
                        status_code=401,
                        headers={"WWW-Authenticate": 'Basic realm="Swagger"'},
                        content={"detail": "Authentication required"}
                    )
                
                try:
                    encoded = auth_header.split(" ")[1]
                    decoded = base64.b64decode(encoded).decode("utf-8")
                    username, password = decoded.split(":", 1)
                    
                    if username != settings.SWAGGER_USER or password != settings.SWAGGER_PASSWORD:
                        return JSONResponse(
                            status_code=401,
                            headers={"WWW-Authenticate": 'Basic realm="Swagger"'},
                            content={"detail": "Invalid credentials"}
                        )
                except Exception:
                    return JSONResponse(
                        status_code=401,
                        headers={"WWW-Authenticate": 'Basic realm="Swagger"'},
                        content={"detail": "Invalid authentication format"}
                    )
        
        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.db.connection import init_db
    init_db()
    yield


app = FastAPI(
    title="API OTLabs",
    version=settings.API_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

app.add_middleware(SwaggerAuthMiddleware)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(company.router, prefix="/api/v1", tags=["company"])
app.include_router(clients.router, prefix="/api/v1/clients", tags=["clients"])
app.include_router(technicians.router, prefix="/api/v1/technicians", tags=["technicians"])
app.include_router(work_orders.router, prefix="/api/v1/work-orders", tags=["work-orders"])


@app.get("/health")
def health_check():
    return {"status": "healthy"}
