"""Demosaicing algorithms implementation."""
import numpy as np
from scipy.ndimage import convolve

from .mosaicing import get_bayer_masks


def demosaic_nearest_neighbor(cfa: np.ndarray) -> np.ndarray:
    """
    Nearest neighbor demosaicing.

    Simple algorithm that copies each 2x2 Bayer block's color values
    to all four pixels in that block.

    Args:
        cfa: Single-channel CFA array (H, W), dtype uint8

    Returns:
        Reconstructed RGB image (H, W, 3), dtype uint8
    """
    h, w = cfa.shape
    rgb = np.zeros((h, w, 3), dtype=np.uint8)

    # Process 2x2 blocks
    for y in range(0, h - 1, 2):
        for x in range(0, w - 1, 2):
            # RGGB block:
            # R  G1
            # G2 B
            r = cfa[y, x]
            g1 = cfa[y, x + 1]
            g2 = cfa[y + 1, x]
            b = cfa[y + 1, x + 1]

            # Average the two green values
            g = (int(g1) + int(g2)) // 2

            # Fill entire 2x2 block with same color
            rgb[y:y+2, x:x+2] = [r, g, b]

    # Handle edge cases for odd dimensions
    if h % 2 == 1:
        rgb[-1, :] = rgb[-2, :]
    if w % 2 == 1:
        rgb[:, -1] = rgb[:, -2]

    return rgb


def demosaic_bilinear(cfa: np.ndarray) -> np.ndarray:
    """
    Bilinear interpolation demosaicing.

    Interpolates missing color values using averages of neighboring
    pixels with the same color.

    Args:
        cfa: Single-channel CFA array (H, W), dtype uint8

    Returns:
        Reconstructed RGB image (H, W, 3), dtype uint8
    """
    h, w = cfa.shape
    cfa_float = cfa.astype(np.float64)

    # Get masks for each color position
    R_mask, G_mask, B_mask = get_bayer_masks(h, w)

    # Kernels for bilinear interpolation
    # Green at R/B locations (cross pattern)
    kernel_G_at_RB = np.array([
        [0, 1, 0],
        [1, 4, 1],
        [0, 1, 0]
    ], dtype=np.float64) / 4

    # R/B at G locations - horizontal neighbors
    kernel_RB_horiz = np.array([
        [0, 0, 0],
        [1, 0, 1],
        [0, 0, 0]
    ], dtype=np.float64) / 2

    # R/B at G locations - vertical neighbors
    kernel_RB_vert = np.array([
        [0, 1, 0],
        [0, 0, 0],
        [0, 1, 0]
    ], dtype=np.float64) / 2

    # R at B or B at R locations (diagonal pattern)
    kernel_RB_at_BR = np.array([
        [1, 0, 1],
        [0, 0, 0],
        [1, 0, 1]
    ], dtype=np.float64) / 4

    # Initialize output channels
    R = np.zeros_like(cfa_float)
    G = np.zeros_like(cfa_float)
    B = np.zeros_like(cfa_float)

    # Copy known values
    R[R_mask] = cfa_float[R_mask]
    G[G_mask] = cfa_float[G_mask]
    B[B_mask] = cfa_float[B_mask]

    # Green at R and B locations
    G_interp = convolve(cfa_float, kernel_G_at_RB, mode='reflect')
    G[R_mask] = G_interp[R_mask]
    G[B_mask] = G_interp[B_mask]

    # Separate G locations by row type
    G_at_R_row = np.zeros((h, w), dtype=bool)  # G in rows that have R
    G_at_B_row = np.zeros((h, w), dtype=bool)  # G in rows that have B
    G_at_R_row[0::2, 1::2] = True
    G_at_B_row[1::2, 0::2] = True

    # R at G locations
    R_horiz = convolve(cfa_float * R_mask, kernel_RB_horiz, mode='reflect')
    R_vert = convolve(cfa_float * R_mask, kernel_RB_vert, mode='reflect')
    # In R rows, R neighbors are horizontal; in B rows, R neighbors are vertical
    R[G_at_R_row] = R_horiz[G_at_R_row] * 2  # Multiply by 2 to correct for mask
    R[G_at_B_row] = R_vert[G_at_B_row] * 2

    # B at G locations
    B_horiz = convolve(cfa_float * B_mask, kernel_RB_horiz, mode='reflect')
    B_vert = convolve(cfa_float * B_mask, kernel_RB_vert, mode='reflect')
    # In B rows, B neighbors are horizontal; in R rows, B neighbors are vertical
    B[G_at_B_row] = B_horiz[G_at_B_row] * 2
    B[G_at_R_row] = B_vert[G_at_R_row] * 2

    # R at B locations and B at R locations (diagonal)
    R_diag = convolve(cfa_float * R_mask, kernel_RB_at_BR, mode='reflect')
    B_diag = convolve(cfa_float * B_mask, kernel_RB_at_BR, mode='reflect')
    R[B_mask] = R_diag[B_mask] * 4  # Correct for mask
    B[R_mask] = B_diag[R_mask] * 4

    # Stack and clip
    rgb = np.stack([R, G, B], axis=-1)
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)

    return rgb


def demosaic_malvar_he_cutler(cfa: np.ndarray) -> np.ndarray:
    """
    Malvar-He-Cutler gradient-corrected linear demosaicing.

    This algorithm improves upon bilinear interpolation by using
    gradient-adaptive 5x5 kernels that exploit cross-channel correlation.

    Reference: H.S. Malvar, L. He, and R. Cutler,
    "High-quality linear interpolation for demosaicing of Bayer-patterned
    color images," ICASSP 2004.

    Args:
        cfa: Single-channel CFA array (H, W), dtype uint8

    Returns:
        Reconstructed RGB image (H, W, 3), dtype uint8
    """
    h, w = cfa.shape
    cfa_float = cfa.astype(np.float64)

    # Define the four Malvar-He-Cutler kernels (all divided by 8)

    # Kernel for G at R and B locations
    GR_GB = np.array([
        [ 0,  0, -1,  0,  0],
        [ 0,  0,  2,  0,  0],
        [-1,  2,  4,  2, -1],
        [ 0,  0,  2,  0,  0],
        [ 0,  0, -1,  0,  0]
    ], dtype=np.float64) / 8

    # Kernel for R at G in B row, B at G in R row (horizontal neighbors)
    Rg_RB_Bg_BR = np.array([
        [ 0,    0,  0.5,  0,    0],
        [ 0,   -1,    0, -1,    0],
        [-1,    4,    5,  4,   -1],
        [ 0,   -1,    0, -1,    0],
        [ 0,    0,  0.5,  0,    0]
    ], dtype=np.float64) / 8

    # Kernel for R at G in R row, B at G in B row (vertical neighbors)
    # This is the transpose of the previous kernel
    Rg_BR_Bg_RB = Rg_RB_Bg_BR.T

    # Kernel for R at B locations and B at R locations
    Rb_BB_Br_RR = np.array([
        [ 0,    0, -1.5,  0,    0],
        [ 0,    2,    0,  2,    0],
        [-1.5,  0,    6,  0, -1.5],
        [ 0,    2,    0,  2,    0],
        [ 0,    0, -1.5,  0,    0]
    ], dtype=np.float64) / 8

    # Get masks
    R_mask, G_mask, B_mask = get_bayer_masks(h, w)

    # Separate G locations by row type
    G_at_R_row = np.zeros((h, w), dtype=bool)
    G_at_B_row = np.zeros((h, w), dtype=bool)
    G_at_R_row[0::2, 1::2] = True  # G in rows with R (even rows)
    G_at_B_row[1::2, 0::2] = True  # G in rows with B (odd rows)

    # Initialize output channels
    R = np.zeros_like(cfa_float)
    G = np.zeros_like(cfa_float)
    B = np.zeros_like(cfa_float)

    # Copy known values from CFA
    R[R_mask] = cfa_float[R_mask]
    G[G_mask] = cfa_float[G_mask]
    B[B_mask] = cfa_float[B_mask]

    # Interpolate G at R and B locations
    G_interpolated = convolve(cfa_float, GR_GB, mode='reflect')
    G[R_mask] = G_interpolated[R_mask]
    G[B_mask] = G_interpolated[B_mask]

    # Interpolate R at G in B row (horizontal R neighbors)
    # and B at G in R row (horizontal B neighbors)
    RB_at_G_horiz = convolve(cfa_float, Rg_RB_Bg_BR, mode='reflect')
    R[G_at_B_row] = RB_at_G_horiz[G_at_B_row]
    B[G_at_R_row] = RB_at_G_horiz[G_at_R_row]

    # Interpolate R at G in R row (vertical R neighbors)
    # and B at G in B row (vertical B neighbors)
    RB_at_G_vert = convolve(cfa_float, Rg_BR_Bg_RB, mode='reflect')
    R[G_at_R_row] = RB_at_G_vert[G_at_R_row]
    B[G_at_B_row] = RB_at_G_vert[G_at_B_row]

    # Interpolate R at B locations and B at R locations
    RB_at_BR = convolve(cfa_float, Rb_BB_Br_RR, mode='reflect')
    R[B_mask] = RB_at_BR[B_mask]
    B[R_mask] = RB_at_BR[R_mask]

    # Stack and clip to valid range
    rgb = np.stack([R, G, B], axis=-1)
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)

    return rgb


# Algorithm dispatcher
DEMOSAIC_ALGORITHMS = {
    "nearest_neighbor": demosaic_nearest_neighbor,
    "bilinear": demosaic_bilinear,
    "malvar_he_cutler": demosaic_malvar_he_cutler,
}


def demosaic(cfa: np.ndarray, algorithm: str = "malvar_he_cutler") -> np.ndarray:
    """
    Demosaic a CFA image using the specified algorithm.

    Args:
        cfa: Single-channel CFA array (H, W)
        algorithm: One of "nearest_neighbor", "bilinear", "malvar_he_cutler"

    Returns:
        Reconstructed RGB image (H, W, 3)
    """
    if algorithm not in DEMOSAIC_ALGORITHMS:
        raise ValueError(f"Unknown algorithm: {algorithm}. "
                        f"Available: {list(DEMOSAIC_ALGORITHMS.keys())}")

    return DEMOSAIC_ALGORITHMS[algorithm](cfa)
