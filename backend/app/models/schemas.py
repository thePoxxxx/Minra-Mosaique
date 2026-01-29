"""Pydantic schemas for API request/response models."""
from enum import Enum
from pydantic import BaseModel, Field


class AlgorithmType(str, Enum):
    """Demosaicing algorithm types."""
    NEAREST_NEIGHBOR = "nearest_neighbor"
    BILINEAR = "bilinear"
    MALVAR_HE_CUTLER = "malvar_he_cutler"


class ExportFormat(str, Enum):
    """Export file format types."""
    MOSAIC = "mosaic"
    PNG = "png"


class OriginalImageResponse(BaseModel):
    """Response model for original image data."""
    width: int
    height: int
    data_url: str


class MosaicedImageResponse(BaseModel):
    """Response model for mosaiced image data."""
    grayscale_data_url: str
    colorized_data_url: str


class MetricsResponse(BaseModel):
    """Response model for quality metrics."""
    psnr: float
    ssim: float


class ReconstructedImageResponse(BaseModel):
    """Response model for reconstructed image."""
    data_url: str
    metrics: MetricsResponse


class UploadResponse(BaseModel):
    """Response model for image upload endpoint."""
    session_id: str
    original: OriginalImageResponse
    mosaiced: MosaicedImageResponse
    reconstructed: ReconstructedImageResponse


class DemosaicRequest(BaseModel):
    """Request model for demosaic endpoint."""
    session_id: str
    algorithm: AlgorithmType


class DemosaicResponse(BaseModel):
    """Response model for demosaic endpoint."""
    reconstructed_data_url: str
    metrics: MetricsResponse


class ExportRequest(BaseModel):
    """Request model for export endpoint."""
    session_id: str
    format: ExportFormat
    quality: int = Field(default=85, ge=1, le=100)
