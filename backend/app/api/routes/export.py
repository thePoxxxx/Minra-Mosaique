"""Export API routes."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from ...core.mosaic_format import encode_mosaic
from ...utils.image_utils import save_image_to_bytes
from ...models.schemas import ExportRequest, ExportFormat
from .images import sessions


router = APIRouter(prefix="/api", tags=["export"])


@router.post("/export")
async def export_mosaiced(request: ExportRequest):
    """
    Export the mosaiced image in the specified format.

    Formats:
        - mosaic: Custom .mosaic format (20-byte header + grayscale JPEG)
        - png: Standard PNG (lossless, grayscale)

    Args:
        request: Contains session_id, format, and quality (for .mosaic)

    Returns:
        Binary file download
    """
    session = sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    cfa = session["cfa"]

    if request.format == ExportFormat.MOSAIC:
        # Custom .mosaic format
        try:
            data = encode_mosaic(cfa, pattern='RGGB', quality=request.quality)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

        return Response(
            content=data,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": "attachment; filename=image.mosaic"
            }
        )

    elif request.format == ExportFormat.PNG:
        # Standard PNG export
        try:
            data = save_image_to_bytes(cfa, format='PNG')
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

        return Response(
            content=data,
            media_type="image/png",
            headers={
                "Content-Disposition": "attachment; filename=mosaiced.png"
            }
        )

    else:
        raise HTTPException(status_code=400, detail=f"Unknown format: {request.format}")
