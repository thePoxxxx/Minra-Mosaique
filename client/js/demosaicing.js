/**
 * Demosaicing Algorithms Implementation
 *
 * Exact port from Python backend/app/core/demosaicing.py
 *
 * Includes:
 * - Nearest Neighbor
 * - Bilinear Interpolation
 * - Malvar-He-Cutler (gradient-corrected)
 */

/**
 * 2D Convolution with reflect boundary handling.
 * Equivalent to scipy.ndimage.convolve with mode='reflect'
 *
 * @param {Float64Array} input - Input array
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number[][]} kernel - 2D kernel array
 * @returns {Float64Array} Convolved output
 */
function convolve2D(input, width, height, kernel) {
    const kSize = kernel.length;
    const kHalf = Math.floor(kSize / 2);
    const output = new Float64Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;

            for (let ky = 0; ky < kSize; ky++) {
                for (let kx = 0; kx < kSize; kx++) {
                    // Reflect boundary handling
                    let ny = y + ky - kHalf;
                    let nx = x + kx - kHalf;

                    // Reflect at boundaries
                    if (ny < 0) ny = -ny;
                    if (ny >= height) ny = 2 * height - ny - 2;
                    if (nx < 0) nx = -nx;
                    if (nx >= width) nx = 2 * width - nx - 2;

                    // Clamp to valid range
                    ny = Math.max(0, Math.min(height - 1, ny));
                    nx = Math.max(0, Math.min(width - 1, nx));

                    sum += input[ny * width + nx] * kernel[ky][kx];
                }
            }

            output[y * width + x] = sum;
        }
    }

    return output;
}

/**
 * Nearest Neighbor demosaicing.
 * Copies each 2x2 Bayer block's color values to all four pixels.
 *
 * @param {Uint8Array} cfa - Single-channel CFA array
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Uint8ClampedArray} RGBA image
 */
function demosaicNearestNeighbor(cfa, width, height) {
    const rgba = new Uint8ClampedArray(width * height * 4);

    // Process 2x2 blocks
    for (let y = 0; y < height - 1; y += 2) {
        for (let x = 0; x < width - 1; x += 2) {
            // RGGB block:
            // R  G1
            // G2 B
            const r = cfa[y * width + x];
            const g1 = cfa[y * width + x + 1];
            const g2 = cfa[(y + 1) * width + x];
            const b = cfa[(y + 1) * width + x + 1];

            // Average the two green values
            const g = Math.round((g1 + g2) / 2);

            // Fill entire 2x2 block with same color
            for (let dy = 0; dy < 2; dy++) {
                for (let dx = 0; dx < 2; dx++) {
                    const idx = ((y + dy) * width + (x + dx)) * 4;
                    rgba[idx] = r;
                    rgba[idx + 1] = g;
                    rgba[idx + 2] = b;
                    rgba[idx + 3] = 255;
                }
            }
        }
    }

    // Handle edge cases for odd dimensions
    if (height % 2 === 1) {
        for (let x = 0; x < width; x++) {
            const srcIdx = ((height - 2) * width + x) * 4;
            const dstIdx = ((height - 1) * width + x) * 4;
            rgba[dstIdx] = rgba[srcIdx];
            rgba[dstIdx + 1] = rgba[srcIdx + 1];
            rgba[dstIdx + 2] = rgba[srcIdx + 2];
            rgba[dstIdx + 3] = 255;
        }
    }
    if (width % 2 === 1) {
        for (let y = 0; y < height; y++) {
            const srcIdx = (y * width + width - 2) * 4;
            const dstIdx = (y * width + width - 1) * 4;
            rgba[dstIdx] = rgba[srcIdx];
            rgba[dstIdx + 1] = rgba[srcIdx + 1];
            rgba[dstIdx + 2] = rgba[srcIdx + 2];
            rgba[dstIdx + 3] = 255;
        }
    }

    return rgba;
}

/**
 * Bilinear interpolation demosaicing.
 * Interpolates missing color values using averages of neighboring pixels.
 *
 * @param {Uint8Array} cfa - Single-channel CFA array
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Uint8ClampedArray} RGBA image
 */
function demosaicBilinear(cfa, width, height) {
    const size = width * height;
    const cfaFloat = new Float64Array(cfa);

    // Get masks
    const masks = Mosaicing.getBayerMasks(width, height);

    // Kernels for bilinear interpolation
    // Green at R/B locations (cross pattern)
    const kernelGatRB = [
        [0, 1, 0],
        [1, 4, 1],
        [0, 1, 0]
    ].map(row => row.map(v => v / 4));

    // R/B at G locations - horizontal neighbors
    const kernelRBhoriz = [
        [0, 0, 0],
        [1, 0, 1],
        [0, 0, 0]
    ].map(row => row.map(v => v / 2));

    // R/B at G locations - vertical neighbors
    const kernelRBvert = [
        [0, 1, 0],
        [0, 0, 0],
        [0, 1, 0]
    ].map(row => row.map(v => v / 2));

    // R at B or B at R locations (diagonal)
    const kernelRBatBR = [
        [1, 0, 1],
        [0, 0, 0],
        [1, 0, 1]
    ].map(row => row.map(v => v / 4));

    // Initialize output channels
    const R = new Float64Array(size);
    const G = new Float64Array(size);
    const B = new Float64Array(size);

    // Copy known values
    for (let i = 0; i < size; i++) {
        if (masks.rMask[i]) R[i] = cfaFloat[i];
        if (masks.gMask[i]) G[i] = cfaFloat[i];
        if (masks.bMask[i]) B[i] = cfaFloat[i];
    }

    // Green at R and B locations
    const Ginterp = convolve2D(cfaFloat, width, height, kernelGatRB);
    for (let i = 0; i < size; i++) {
        if (masks.rMask[i]) G[i] = Ginterp[i];
        if (masks.bMask[i]) G[i] = Ginterp[i];
    }

    // Create masked CFA for R and B convolutions
    const cfaR = new Float64Array(size);
    const cfaB = new Float64Array(size);
    for (let i = 0; i < size; i++) {
        cfaR[i] = masks.rMask[i] ? cfaFloat[i] : 0;
        cfaB[i] = masks.bMask[i] ? cfaFloat[i] : 0;
    }

    // R at G locations
    const Rhoriz = convolve2D(cfaR, width, height, kernelRBhoriz);
    const Rvert = convolve2D(cfaR, width, height, kernelRBvert);
    for (let i = 0; i < size; i++) {
        if (masks.gAtRRow[i]) R[i] = Rhoriz[i] * 2;
        if (masks.gAtBRow[i]) R[i] = Rvert[i] * 2;
    }

    // B at G locations
    const Bhoriz = convolve2D(cfaB, width, height, kernelRBhoriz);
    const Bvert = convolve2D(cfaB, width, height, kernelRBvert);
    for (let i = 0; i < size; i++) {
        if (masks.gAtBRow[i]) B[i] = Bhoriz[i] * 2;
        if (masks.gAtRRow[i]) B[i] = Bvert[i] * 2;
    }

    // R at B and B at R (diagonal)
    const Rdiag = convolve2D(cfaR, width, height, kernelRBatBR);
    const Bdiag = convolve2D(cfaB, width, height, kernelRBatBR);
    for (let i = 0; i < size; i++) {
        if (masks.bMask[i]) R[i] = Rdiag[i] * 4;
        if (masks.rMask[i]) B[i] = Bdiag[i] * 4;
    }

    // Create RGBA output
    const rgba = new Uint8ClampedArray(size * 4);
    for (let i = 0; i < size; i++) {
        const idx = i * 4;
        rgba[idx] = Math.max(0, Math.min(255, Math.round(R[i])));
        rgba[idx + 1] = Math.max(0, Math.min(255, Math.round(G[i])));
        rgba[idx + 2] = Math.max(0, Math.min(255, Math.round(B[i])));
        rgba[idx + 3] = 255;
    }

    return rgba;
}

/**
 * Malvar-He-Cutler gradient-corrected linear demosaicing.
 *
 * Uses four 5x5 kernels that exploit cross-channel correlation
 * for improved edge preservation.
 *
 * Reference: H.S. Malvar, L. He, and R. Cutler,
 * "High-quality linear interpolation for demosaicing of Bayer-patterned
 * color images," ICASSP 2004.
 *
 * @param {Uint8Array} cfa - Single-channel CFA array
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Uint8ClampedArray} RGBA image
 */
function demosaicMalvarHeCutler(cfa, width, height) {
    const size = width * height;
    const cfaFloat = new Float64Array(cfa);

    // Define the four Malvar-He-Cutler kernels (all divided by 8)

    // Kernel for G at R and B locations
    const GR_GB = [
        [ 0,  0, -1,  0,  0],
        [ 0,  0,  2,  0,  0],
        [-1,  2,  4,  2, -1],
        [ 0,  0,  2,  0,  0],
        [ 0,  0, -1,  0,  0]
    ].map(row => row.map(v => v / 8));

    // Kernel for R at G in B row, B at G in R row (horizontal neighbors)
    const Rg_RB_Bg_BR = [
        [ 0,    0,  0.5,  0,    0],
        [ 0,   -1,    0, -1,    0],
        [-1,    4,    5,  4,   -1],
        [ 0,   -1,    0, -1,    0],
        [ 0,    0,  0.5,  0,    0]
    ].map(row => row.map(v => v / 8));

    // Kernel for R at G in R row, B at G in B row (transpose)
    const Rg_BR_Bg_RB = Rg_RB_Bg_BR[0].map((_, i) =>
        Rg_RB_Bg_BR.map(row => row[i])
    );

    // Kernel for R at B and B at R locations
    const Rb_BB_Br_RR = [
        [ 0,    0, -1.5,  0,    0],
        [ 0,    2,    0,  2,    0],
        [-1.5,  0,    6,  0, -1.5],
        [ 0,    2,    0,  2,    0],
        [ 0,    0, -1.5,  0,    0]
    ].map(row => row.map(v => v / 8));

    // Get masks
    const masks = Mosaicing.getBayerMasks(width, height);

    // Initialize output channels
    const R = new Float64Array(size);
    const G = new Float64Array(size);
    const B = new Float64Array(size);

    // Copy known values from CFA
    for (let i = 0; i < size; i++) {
        if (masks.rMask[i]) R[i] = cfaFloat[i];
        if (masks.gMask[i]) G[i] = cfaFloat[i];
        if (masks.bMask[i]) B[i] = cfaFloat[i];
    }

    // Interpolate G at R and B locations
    const Ginterpolated = convolve2D(cfaFloat, width, height, GR_GB);
    for (let i = 0; i < size; i++) {
        if (masks.rMask[i]) G[i] = Ginterpolated[i];
        if (masks.bMask[i]) G[i] = Ginterpolated[i];
    }

    // Interpolate R at G in B row (horizontal R neighbors)
    // and B at G in R row (horizontal B neighbors)
    const RBatGhoriz = convolve2D(cfaFloat, width, height, Rg_RB_Bg_BR);
    for (let i = 0; i < size; i++) {
        if (masks.gAtBRow[i]) R[i] = RBatGhoriz[i];
        if (masks.gAtRRow[i]) B[i] = RBatGhoriz[i];
    }

    // Interpolate R at G in R row (vertical R neighbors)
    // and B at G in B row (vertical B neighbors)
    const RBatGvert = convolve2D(cfaFloat, width, height, Rg_BR_Bg_RB);
    for (let i = 0; i < size; i++) {
        if (masks.gAtRRow[i]) R[i] = RBatGvert[i];
        if (masks.gAtBRow[i]) B[i] = RBatGvert[i];
    }

    // Interpolate R at B locations and B at R locations
    const RBatBR = convolve2D(cfaFloat, width, height, Rb_BB_Br_RR);
    for (let i = 0; i < size; i++) {
        if (masks.bMask[i]) R[i] = RBatBR[i];
        if (masks.rMask[i]) B[i] = RBatBR[i];
    }

    // Create RGBA output with clamping
    const rgba = new Uint8ClampedArray(size * 4);
    for (let i = 0; i < size; i++) {
        const idx = i * 4;
        rgba[idx] = Math.max(0, Math.min(255, Math.round(R[i])));
        rgba[idx + 1] = Math.max(0, Math.min(255, Math.round(G[i])));
        rgba[idx + 2] = Math.max(0, Math.min(255, Math.round(B[i])));
        rgba[idx + 3] = 255;
    }

    return rgba;
}

/**
 * Demosaic using specified algorithm.
 *
 * @param {Uint8Array} cfa - Single-channel CFA array
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {string} algorithm - Algorithm name
 * @returns {Uint8ClampedArray} RGBA image
 */
function demosaic(cfa, width, height, algorithm = 'malvar_he_cutler') {
    switch (algorithm) {
        case 'nearest_neighbor':
            return demosaicNearestNeighbor(cfa, width, height);
        case 'bilinear':
            return demosaicBilinear(cfa, width, height);
        case 'malvar_he_cutler':
            return demosaicMalvarHeCutler(cfa, width, height);
        // Advanced algorithms from demosaicing-advanced.js
        case 'agcrd':
            return window.DemosaicingAdvanced.demosaicAGCRD(cfa, width, height);
        case 'frequency_aware':
            return window.DemosaicingAdvanced.demosaicFrequencyAware(cfa, width, height);
        case 'bilinear_corrected':
            return window.DemosaicingAdvanced.demosaicBilinearCorrected(cfa, width, height);
        case 'smooth_hue':
            return window.DemosaicingAdvanced.demosaicSmoothHue(cfa, width, height);
        default:
            throw new Error(`Unknown algorithm: ${algorithm}`);
    }
}

// Export for use in other modules
window.Demosaicing = {
    demosaic,
    demosaicNearestNeighbor,
    demosaicBilinear,
    demosaicMalvarHeCutler
};
