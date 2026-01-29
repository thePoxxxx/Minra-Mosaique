"""Image processing API routes."""
import uuid
from typing import Dict, Any

from fastapi import APIRouter, UploadFile, File, HTTPException

from ...core.mosaicing import apply_bayer_mosaic, generate_colorized_view
from ...core.demosaicing import demosaic
from ...core.metrics import calculate_metrics
from ...utils.image_utils import load_image_from_bytes, image_to_data_url
from ...models.schemas import (
    UploadResponse,
    OriginalImageResponse,
    MosaicedImageResponse,
    ReconstructedImageResponse,
    MetricsResponse,
    DemosaicRequest,
    DemosaicResponse,
)


router = APIRouter(prefix="/api", tags=["images"])

# In-memory session storage
# In production, use Redis or similar
sessions: Dict[str, Dict[str, Any]] = {}


@router.post("/upload", response_model=UploadResponse)
async def upload_image(file: UploadFile = File(...)):
    """
    Upload an image and process it through mosaicing and initial demosaicing.

    Returns:
        - Original image
        - Mosaiced image (both grayscale and colorized views)
        - Initial reconstruction using Malvar-He-Cutler algorithm
        - Quality metrics (PSNR, SSIM)
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        # Read and decode image
        contents = await file.read()
        original_image = load_image_from_bytes(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load image: {str(e)}")

    height, width = original_image.shape[:2]

    # Apply Bayer mosaicing
    cfa = apply_bayer_mosaic(original_image)

    # Generate visualization views
    colorized = generate_colorized_view(cfa)

    # Initial demosaic with Malvar-He-Cutler
    reconstructed = demosaic(cfa, "malvar_he_cutler")

    # Calculate metrics
    metrics = calculate_metrics(original_image, reconstructed)

    # Generate session ID and store data
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "original": original_image,
        "cfa": cfa,
        "width": width,
        "height": height,
    }

    # Convert images to data URLs
    original_data_url = image_to_data_url(original_image)
    grayscale_data_url = image_to_data_url(cfa)
    colorized_data_url = image_to_data_url(colorized)
    reconstructed_data_url = image_to_data_url(reconstructed)

    return UploadResponse(
        session_id=session_id,
        original=OriginalImageResponse(
            width=width,
            height=height,
            data_url=original_data_url
        ),
        mosaiced=MosaicedImageResponse(
            grayscale_data_url=grayscale_data_url,
            colorized_data_url=colorized_data_url
        ),
        reconstructed=ReconstructedImageResponse(
            data_url=reconstructed_data_url,
            metrics=MetricsResponse(**metrics)
        )
    )


@router.post("/demosaic", response_model=DemosaicResponse)
async def demosaic_image(request: DemosaicRequest):
    """
    Apply demosaicing algorithm to a previously uploaded image.

    Args:
        request: Contains session_id and algorithm choice

    Returns:
        Reconstructed image and quality metrics
    """
    session = sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    cfa = session["cfa"]
    original = session["original"]

    # Apply demosaicing
    try:
        reconstructed = demosaic(cfa, request.algorithm.value)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Calculate metrics
    metrics = calculate_metrics(original, reconstructed)

    # Convert to data URL
    reconstructed_data_url = image_to_data_url(reconstructed)

    return DemosaicResponse(
        reconstructed_data_url=reconstructed_data_url,
        metrics=MetricsResponse(**metrics)
    )


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and free memory."""
    if session_id in sessions:
        del sessions[session_id]
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="Session not found")
