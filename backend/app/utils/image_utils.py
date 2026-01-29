"""Image utility functions."""
import base64
from io import BytesIO

import numpy as np
from PIL import Image


def image_to_data_url(image: np.ndarray, format: str = 'PNG') -> str:
    """
    Convert a numpy array image to a data URL.

    Args:
        image: Image as numpy array (H, W) for grayscale or (H, W, 3) for RGB
        format: Image format ('PNG' or 'JPEG')

    Returns:
        Data URL string (e.g., "data:image/png;base64,...")
    """
    # Determine mode based on array shape
    if image.ndim == 2:
        mode = 'L'  # Grayscale
    elif image.ndim == 3 and image.shape[2] == 3:
        mode = 'RGB'
    elif image.ndim == 3 and image.shape[2] == 4:
        mode = 'RGBA'
    else:
        raise ValueError(f"Unsupported image shape: {image.shape}")

    # Convert to PIL Image
    pil_image = Image.fromarray(image.astype(np.uint8), mode=mode)

    # Save to buffer
    buffer = BytesIO()
    pil_image.save(buffer, format=format)
    buffer.seek(0)

    # Encode to base64
    b64_data = base64.b64encode(buffer.getvalue()).decode('utf-8')

    # Create data URL
    mime_type = f"image/{format.lower()}"
    return f"data:{mime_type};base64,{b64_data}"


def data_url_to_image(data_url: str) -> np.ndarray:
    """
    Convert a data URL to a numpy array image.

    Args:
        data_url: Data URL string

    Returns:
        Image as numpy array
    """
    # Parse data URL
    if not data_url.startswith('data:'):
        raise ValueError("Invalid data URL")

    # Extract base64 data
    header, b64_data = data_url.split(',', 1)
    image_data = base64.b64decode(b64_data)

    # Load with PIL
    pil_image = Image.open(BytesIO(image_data))

    return np.array(pil_image)


def load_image_from_bytes(data: bytes) -> np.ndarray:
    """
    Load an image from bytes.

    Args:
        data: Raw image bytes (PNG, JPEG, etc.)

    Returns:
        RGB image as numpy array (H, W, 3)
    """
    pil_image = Image.open(BytesIO(data))

    # Convert to RGB if necessary
    if pil_image.mode != 'RGB':
        pil_image = pil_image.convert('RGB')

    return np.array(pil_image)


def save_image_to_bytes(image: np.ndarray, format: str = 'PNG', quality: int = 95) -> bytes:
    """
    Save an image to bytes.

    Args:
        image: Image as numpy array
        format: Image format ('PNG' or 'JPEG')
        quality: JPEG quality (1-100), ignored for PNG

    Returns:
        Image as bytes
    """
    if image.ndim == 2:
        mode = 'L'
    elif image.ndim == 3 and image.shape[2] == 3:
        mode = 'RGB'
    else:
        raise ValueError(f"Unsupported image shape: {image.shape}")

    pil_image = Image.fromarray(image.astype(np.uint8), mode=mode)

    buffer = BytesIO()
    if format.upper() == 'JPEG':
        pil_image.save(buffer, format='JPEG', quality=quality)
    else:
        pil_image.save(buffer, format='PNG')

    return buffer.getvalue()
