"""Bayer RGGB mosaicing implementation."""
import numpy as np


def apply_bayer_mosaic(rgb_image: np.ndarray) -> np.ndarray:
    """
    Apply RGGB Bayer pattern mosaicing to an RGB image.

    The Bayer pattern is:
        Row 0: R G R G R G ...
        Row 1: G B G B G B ...
        Row 2: R G R G R G ...
        Row 3: G B G B G B ...

    This gives 50% green, 25% red, 25% blue - matching human visual sensitivity.

    Args:
        rgb_image: Input RGB image as numpy array (H, W, 3), dtype uint8

    Returns:
        Single-channel CFA array (H, W), dtype uint8
    """
    if rgb_image.ndim != 3 or rgb_image.shape[2] != 3:
        raise ValueError("Input must be an RGB image with shape (H, W, 3)")

    h, w = rgb_image.shape[:2]
    cfa = np.zeros((h, w), dtype=np.uint8)

    # RGGB pattern:
    # Even rows (0, 2, 4...): R at even cols, G at odd cols
    # Odd rows (1, 3, 5...): G at even cols, B at odd cols

    # Red channel at (even row, even col)
    cfa[0::2, 0::2] = rgb_image[0::2, 0::2, 0]

    # Green channel at (even row, odd col) and (odd row, even col)
    cfa[0::2, 1::2] = rgb_image[0::2, 1::2, 1]
    cfa[1::2, 0::2] = rgb_image[1::2, 0::2, 1]

    # Blue channel at (odd row, odd col)
    cfa[1::2, 1::2] = rgb_image[1::2, 1::2, 2]

    return cfa


def generate_colorized_view(cfa: np.ndarray) -> np.ndarray:
    """
    Generate a colorized visualization of the CFA pattern.

    Shows R pixels in red, G pixels in green, B pixels in blue.
    This helps visualize the Bayer pattern structure.

    Args:
        cfa: Single-channel CFA array (H, W), dtype uint8

    Returns:
        RGB visualization (H, W, 3), dtype uint8
    """
    h, w = cfa.shape
    colorized = np.zeros((h, w, 3), dtype=np.uint8)

    # Red pixels (even row, even col) -> red channel
    colorized[0::2, 0::2, 0] = cfa[0::2, 0::2]

    # Green pixels (even row, odd col) and (odd row, even col) -> green channel
    colorized[0::2, 1::2, 1] = cfa[0::2, 1::2]
    colorized[1::2, 0::2, 1] = cfa[1::2, 0::2]

    # Blue pixels (odd row, odd col) -> blue channel
    colorized[1::2, 1::2, 2] = cfa[1::2, 1::2]

    return colorized


def get_bayer_masks(height: int, width: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Generate boolean masks for R, G, and B pixel locations in RGGB pattern.

    Args:
        height: Image height
        width: Image width

    Returns:
        Tuple of (R_mask, G_mask, B_mask), each (H, W) boolean array
    """
    R_mask = np.zeros((height, width), dtype=bool)
    G_mask = np.zeros((height, width), dtype=bool)
    B_mask = np.zeros((height, width), dtype=bool)

    # RGGB pattern
    R_mask[0::2, 0::2] = True
    G_mask[0::2, 1::2] = True
    G_mask[1::2, 0::2] = True
    B_mask[1::2, 1::2] = True

    return R_mask, G_mask, B_mask
