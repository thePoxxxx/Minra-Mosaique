"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .api.routes import images, export


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="API for Bayer CFA mosaicing and demosaicing",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(images.router)
app.include_router(export.router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "name": settings.app_name,
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    """Health check for monitoring."""
    return {"status": "healthy"}
