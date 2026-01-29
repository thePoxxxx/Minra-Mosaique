"""Image quality metrics implementation."""
import numpy as np
from skimage.metrics import structural_similarity


def calculate_psnr(original: np.ndarray, reconstructed: np.ndarray) -> float:
    """
    Calculate Peak Signal-to-Noise Ratio (PSNR).

    PSNR measures the ratio between the maximum possible signal power
    and the power of corrupting noise. Higher values indicate better quality.

    Typical values:
    - 30-40 dB: Good quality
    - 40-50 dB: Excellent quality
    - > 50 dB: Near-perfect

    Args:
        original: Original RGB image (H, W, 3), dtype uint8
        reconstructed: Reconstructed RGB image (H, W, 3), dtype uint8

    Returns:
        PSNR in decibels (dB)
    """
    original = original.astype(np.float64)
    reconstructed = reconstructed.astype(np.float64)

    mse = np.mean((original - reconstructed) ** 2)

    if mse == 0:
        return float('inf')  # Identical images

    max_pixel = 255.0
    psnr = 20 * np.log10(max_pixel / np.sqrt(mse))

    return float(round(psnr, 2))


def calculate_ssim(original: np.ndarray, reconstructed: np.ndarray) -> float:
    """
    Calculate Structural Similarity Index (SSIM).

    SSIM measures the perceived quality of an image by comparing
    luminance, contrast, and structure. Values range from -1 to 1,
    where 1 indicates identical images.

    Args:
        original: Original RGB image (H, W, 3), dtype uint8
        reconstructed: Reconstructed RGB image (H, W, 3), dtype uint8

    Returns:
        SSIM value between 0 and 1 (typically)
    """
    # Determine appropriate win_size based on image dimensions
    min_dim = min(original.shape[0], original.shape[1])
    win_size = min(7, min_dim if min_dim % 2 == 1 else min_dim - 1)
    if win_size < 3:
        win_size = 3

    ssim_value = structural_similarity(
        original,
        reconstructed,
        channel_axis=2,
        data_range=255,
        win_size=win_size
    )

    return round(float(ssim_value), 4)


def calculate_metrics(original: np.ndarray, reconstructed: np.ndarray) -> dict:
    """
    Calculate all quality metrics.

    Args:
        original: Original RGB image
        reconstructed: Reconstructed RGB image

    Returns:
        Dictionary with 'psnr' and 'ssim' values
    """
    return {
        "psnr": calculate_psnr(original, reconstructed),
        "ssim": calculate_ssim(original, reconstructed)
    }
