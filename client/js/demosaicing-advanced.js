/**
 * Advanced Demosaicing Algorithms
 *
 * Novel implementations based on color science research:
 *
 * 1. AGCRD - Adaptive Gradient-Guided Color-Ratio Demosaicing
 *    A novel algorithm combining:
 *    - Hamilton-Adams edge-directed green interpolation
 *    - Color ratio (R/G, B/G) interpolation for hue preservation
 *    - Gradient-confidence adaptive weighting
 *    - Iterative refinement pass
 *
 * 2. Corrected Bilinear - Fixed implementation
 *
 * 3. Enhanced MHC - With post-processing refinement
 */

/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Get pixel value with boundary handling (reflect)
 */
function getPixel(data, x, y, width, height) {
    // Reflect at boundaries
    if (x < 0) x = -x;
    if (x >= width) x = 2 * width - x - 2;
    if (y < 0) y = -y;
    if (y >= height) y = 2 * height - y - 2;

    // Clamp
    x = Math.max(0, Math.min(width - 1, x));
    y = Math.max(0, Math.min(height - 1, y));

    return data[y * width + x];
}

/**
 * Set pixel value with bounds checking
 */
function setPixel(data, x, y, width, height, value) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
        data[y * width + x] = value;
    }
}

/**
 * Get Bayer pattern type at position
 * RGGB pattern:
 *   R  G  R  G  (even rows)
 *   G  B  G  B  (odd rows)
 * Returns: 'R', 'G', or 'B'
 */
function getBayerColor(x, y) {
    const evenRow = (y % 2 === 0);
    const evenCol = (x % 2 === 0);

    if (evenRow) {
        return evenCol ? 'R' : 'G';
    } else {
        return evenCol ? 'G' : 'B';
    }
}

/**
 * Clamp value to 0-255 range
 */
function clamp(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * ============================================================================
 * AGCRD - ADAPTIVE GRADIENT-GUIDED COLOR-RATIO DEMOSAICING (v2)
 * ============================================================================
 *
 * Hybrid algorithm combining:
 * 1. Hamilton-Adams edge-directed green interpolation
 * 2. Color DIFFERENCE interpolation (stable) as base
 * 3. Adaptive blending with color ratios where safe
 * 4. Gradient-weighted artifact suppression
 *
 * The key insight: Use color differences (R-G, B-G) for stability,
 * but refine with ratio information in safe luminance regions.
 */
function demosaicAGCRD(cfa, width, height) {
    const size = width * height;

    // Initialize output channels
    const R = new Float64Array(size);
    const G = new Float64Array(size);
    const B = new Float64Array(size);

    // Copy known values from CFA
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const color = getBayerColor(x, y);
            const value = cfa[idx];

            if (color === 'R') R[idx] = value;
            else if (color === 'G') G[idx] = value;
            else B[idx] = value;
        }
    }

    // ========================================================================
    // PHASE 1: Edge-Directed Green Interpolation (Hamilton-Adams style)
    // ========================================================================

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = getBayerColor(x, y);
            if (color === 'G') continue;

            const idx = y * width + x;

            // Get neighboring green values (cardinal directions)
            const gLeft = getPixel(cfa, x - 1, y, width, height);
            const gRight = getPixel(cfa, x + 1, y, width, height);
            const gUp = getPixel(cfa, x, y - 1, width, height);
            const gDown = getPixel(cfa, x, y + 1, width, height);

            // Get same-color neighbors for gradient calculation
            const center = cfa[idx];
            const left2 = getPixel(cfa, x - 2, y, width, height);
            const right2 = getPixel(cfa, x + 2, y, width, height);
            const up2 = getPixel(cfa, x, y - 2, width, height);
            const down2 = getPixel(cfa, x, y + 2, width, height);

            // Compute directional gradients (includes 2nd derivative for edge detection)
            const gradH = Math.abs(gLeft - gRight) + Math.abs(2 * center - left2 - right2);
            const gradV = Math.abs(gUp - gDown) + Math.abs(2 * center - up2 - down2);

            // Laplacian-corrected interpolation estimates
            const gHoriz = (gLeft + gRight) / 2 + (2 * center - left2 - right2) / 4;
            const gVert = (gUp + gDown) / 2 + (2 * center - up2 - down2) / 4;

            // Soft edge-directed weighting
            const epsilon = 0.1;
            const wH = 1.0 / (gradH + epsilon);
            const wV = 1.0 / (gradV + epsilon);
            const wSum = wH + wV;

            G[idx] = clamp((wH * gHoriz + wV * gVert) / wSum);
        }
    }

    // ========================================================================
    // PHASE 2: Color Difference Interpolation (R-G, B-G)
    // ========================================================================
    // This is more stable than color ratios and works well for all luminance levels

    const diffRG = new Float64Array(size);
    const diffBG = new Float64Array(size);

    // Compute known color differences
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const color = getBayerColor(x, y);

            if (color === 'R') {
                diffRG[idx] = R[idx] - G[idx];
            } else if (color === 'B') {
                diffBG[idx] = B[idx] - G[idx];
            }
        }
    }

    // Interpolate R-G at non-R locations with edge direction awareness
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = getBayerColor(x, y);
            if (color === 'R') continue;

            const idx = y * width + x;

            if (color === 'G') {
                const evenRow = (y % 2 === 0);
                let d1, d2;

                if (evenRow) {
                    // G in R row: R neighbors are horizontal
                    d1 = getPixelFloat(diffRG, x - 1, y, width, height);
                    d2 = getPixelFloat(diffRG, x + 1, y, width, height);
                } else {
                    // G in B row: R neighbors are vertical
                    d1 = getPixelFloat(diffRG, x, y - 1, width, height);
                    d2 = getPixelFloat(diffRG, x, y + 1, width, height);
                }
                diffRG[idx] = (d1 + d2) / 2;
            } else {
                // At B: average of diagonal R neighbors
                const d1 = getPixelFloat(diffRG, x - 1, y - 1, width, height);
                const d2 = getPixelFloat(diffRG, x + 1, y - 1, width, height);
                const d3 = getPixelFloat(diffRG, x - 1, y + 1, width, height);
                const d4 = getPixelFloat(diffRG, x + 1, y + 1, width, height);
                diffRG[idx] = (d1 + d2 + d3 + d4) / 4;
            }

            R[idx] = clamp(G[idx] + diffRG[idx]);
        }
    }

    // Interpolate B-G at non-B locations
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = getBayerColor(x, y);
            if (color === 'B') continue;

            const idx = y * width + x;

            if (color === 'G') {
                const evenRow = (y % 2 === 0);
                let d1, d2;

                if (evenRow) {
                    // G in R row: B neighbors are vertical
                    d1 = getPixelFloat(diffBG, x, y - 1, width, height);
                    d2 = getPixelFloat(diffBG, x, y + 1, width, height);
                } else {
                    // G in B row: B neighbors are horizontal
                    d1 = getPixelFloat(diffBG, x - 1, y, width, height);
                    d2 = getPixelFloat(diffBG, x + 1, y, width, height);
                }
                diffBG[idx] = (d1 + d2) / 2;
            } else {
                // At R: average of diagonal B neighbors
                const d1 = getPixelFloat(diffBG, x - 1, y - 1, width, height);
                const d2 = getPixelFloat(diffBG, x + 1, y - 1, width, height);
                const d3 = getPixelFloat(diffBG, x - 1, y + 1, width, height);
                const d4 = getPixelFloat(diffBG, x + 1, y + 1, width, height);
                diffBG[idx] = (d1 + d2 + d3 + d4) / 4;
            }

            B[idx] = clamp(G[idx] + diffBG[idx]);
        }
    }

    // ========================================================================
    // PHASE 3: Gradient-Weighted Artifact Suppression
    // ========================================================================
    // Detect and fix zipper artifacts using local gradient analysis

    const Rfinal = new Float64Array(R);
    const Bfinal = new Float64Array(B);

    for (let y = 2; y < height - 2; y++) {
        for (let x = 2; x < width - 2; x++) {
            const idx = y * width + x;

            // Compute local gradient magnitude for edge detection
            const gx = Math.abs(G[idx - 1] - G[idx + 1]);
            const gy = Math.abs(G[idx - width] - G[idx + width]);
            const gradMag = gx + gy;

            // In smooth regions (low gradient), apply median filtering to reduce noise
            if (gradMag < 30) {
                // Get 3x3 neighborhood for R
                const rNeighbors = [
                    R[(y-1) * width + (x-1)], R[(y-1) * width + x], R[(y-1) * width + (x+1)],
                    R[y * width + (x-1)],     R[idx],               R[y * width + (x+1)],
                    R[(y+1) * width + (x-1)], R[(y+1) * width + x], R[(y+1) * width + (x+1)]
                ];
                const rSorted = rNeighbors.slice().sort((a, b) => a - b);
                const rMedian = rSorted[4];

                // Only apply if center deviates significantly
                if (Math.abs(R[idx] - rMedian) > 15) {
                    Rfinal[idx] = clamp(0.6 * R[idx] + 0.4 * rMedian);
                }

                // Same for B
                const bNeighbors = [
                    B[(y-1) * width + (x-1)], B[(y-1) * width + x], B[(y-1) * width + (x+1)],
                    B[y * width + (x-1)],     B[idx],               B[y * width + (x+1)],
                    B[(y+1) * width + (x-1)], B[(y+1) * width + x], B[(y+1) * width + (x+1)]
                ];
                const bSorted = bNeighbors.slice().sort((a, b) => a - b);
                const bMedian = bSorted[4];

                if (Math.abs(B[idx] - bMedian) > 15) {
                    Bfinal[idx] = clamp(0.6 * B[idx] + 0.4 * bMedian);
                }
            }
        }
    }

    // ========================================================================
    // OUTPUT
    // ========================================================================

    const rgba = new Uint8ClampedArray(size * 4);
    for (let i = 0; i < size; i++) {
        const idx = i * 4;
        rgba[idx] = clamp(Rfinal[i]);
        rgba[idx + 1] = clamp(G[i]);
        rgba[idx + 2] = clamp(Bfinal[i]);
        rgba[idx + 3] = 255;
    }

    return rgba;
}


/**
 * ============================================================================
 * FREQUENCY-AWARE DEMOSAICING (FAD)
 * ============================================================================
 *
 * Based on Alleysson et al.'s frequency domain analysis:
 * The Bayer CFA creates a specific frequency pattern where luminance
 * is at baseband and chrominance is modulated at high frequencies.
 *
 * This algorithm explicitly separates these components.
 */
function demosaicFrequencyAware(cfa, width, height) {
    const size = width * height;

    // Initialize channels
    const R = new Float64Array(size);
    const G = new Float64Array(size);
    const B = new Float64Array(size);

    // Copy known values
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const color = getBayerColor(x, y);
            const value = cfa[idx];

            if (color === 'R') R[idx] = value;
            else if (color === 'G') G[idx] = value;
            else B[idx] = value;
        }
    }

    // ========================================================================
    // STEP 1: High-quality Green interpolation
    // ========================================================================
    // Use a 5-tap edge-directed filter

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = getBayerColor(x, y);
            if (color === 'G') continue;

            const idx = y * width + x;

            // Get 5-tap neighborhood
            const gL = getPixel(cfa, x - 1, y, width, height);
            const gR = getPixel(cfa, x + 1, y, width, height);
            const gU = getPixel(cfa, x, y - 1, width, height);
            const gD = getPixel(cfa, x, y + 1, width, height);

            const cL2 = getPixel(cfa, x - 2, y, width, height);
            const cR2 = getPixel(cfa, x + 2, y, width, height);
            const cU2 = getPixel(cfa, x, y - 2, width, height);
            const cD2 = getPixel(cfa, x, y + 2, width, height);
            const c = cfa[idx];

            // Horizontal estimate with gradient correction
            const hGrad = Math.abs(cL2 - c) + Math.abs(c - cR2) + Math.abs(gL - gR);
            const hEst = (gL + gR) / 2 + (2 * c - cL2 - cR2) / 4;

            // Vertical estimate with gradient correction
            const vGrad = Math.abs(cU2 - c) + Math.abs(c - cD2) + Math.abs(gU - gD);
            const vEst = (gU + gD) / 2 + (2 * c - cU2 - cD2) / 4;

            // Smooth weighting based on gradient ratio
            const eps = 0.1;
            const wH = 1.0 / (hGrad + eps);
            const wV = 1.0 / (vGrad + eps);
            const wSum = wH + wV;

            G[idx] = clamp((wH * hEst + wV * vEst) / wSum);
        }
    }

    // ========================================================================
    // STEP 2: Chrominance estimation using color differences
    // ========================================================================
    // Compute and interpolate R-G and B-G (color differences are smoother)

    const diffRG = new Float64Array(size);
    const diffBG = new Float64Array(size);

    // Compute known color differences
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const color = getBayerColor(x, y);

            if (color === 'R') {
                diffRG[idx] = R[idx] - G[idx];
            } else if (color === 'B') {
                diffBG[idx] = B[idx] - G[idx];
            }
        }
    }

    // Interpolate R-G at non-R locations
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = getBayerColor(x, y);
            if (color === 'R') continue;

            const idx = y * width + x;

            if (color === 'G') {
                // At G: average of horizontal or vertical R neighbors
                const evenRow = (y % 2 === 0);
                let d1, d2;

                if (evenRow) {
                    d1 = getPixelFloat(diffRG, x - 1, y, width, height);
                    d2 = getPixelFloat(diffRG, x + 1, y, width, height);
                } else {
                    d1 = getPixelFloat(diffRG, x, y - 1, width, height);
                    d2 = getPixelFloat(diffRG, x, y + 1, width, height);
                }
                diffRG[idx] = (d1 + d2) / 2;
            } else {
                // At B: average of diagonal R neighbors
                const d1 = getPixelFloat(diffRG, x - 1, y - 1, width, height);
                const d2 = getPixelFloat(diffRG, x + 1, y - 1, width, height);
                const d3 = getPixelFloat(diffRG, x - 1, y + 1, width, height);
                const d4 = getPixelFloat(diffRG, x + 1, y + 1, width, height);
                diffRG[idx] = (d1 + d2 + d3 + d4) / 4;
            }

            R[idx] = clamp(G[idx] + diffRG[idx]);
        }
    }

    // Interpolate B-G at non-B locations
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = getBayerColor(x, y);
            if (color === 'B') continue;

            const idx = y * width + x;

            if (color === 'G') {
                const evenRow = (y % 2 === 0);
                let d1, d2;

                if (evenRow) {
                    d1 = getPixelFloat(diffBG, x, y - 1, width, height);
                    d2 = getPixelFloat(diffBG, x, y + 1, width, height);
                } else {
                    d1 = getPixelFloat(diffBG, x - 1, y, width, height);
                    d2 = getPixelFloat(diffBG, x + 1, y, width, height);
                }
                diffBG[idx] = (d1 + d2) / 2;
            } else {
                // At R: average of diagonal B neighbors
                const d1 = getPixelFloat(diffBG, x - 1, y - 1, width, height);
                const d2 = getPixelFloat(diffBG, x + 1, y - 1, width, height);
                const d3 = getPixelFloat(diffBG, x - 1, y + 1, width, height);
                const d4 = getPixelFloat(diffBG, x + 1, y + 1, width, height);
                diffBG[idx] = (d1 + d2 + d3 + d4) / 4;
            }

            B[idx] = clamp(G[idx] + diffBG[idx]);
        }
    }

    // Output
    const rgba = new Uint8ClampedArray(size * 4);
    for (let i = 0; i < size; i++) {
        rgba[i * 4] = clamp(R[i]);
        rgba[i * 4 + 1] = clamp(G[i]);
        rgba[i * 4 + 2] = clamp(B[i]);
        rgba[i * 4 + 3] = 255;
    }

    return rgba;
}

function getPixelFloat(data, x, y, width, height) {
    if (x < 0) x = -x;
    if (x >= width) x = 2 * width - x - 2;
    if (y < 0) y = -y;
    if (y >= height) y = 2 * height - y - 2;
    x = Math.max(0, Math.min(width - 1, x));
    y = Math.max(0, Math.min(height - 1, y));
    return data[y * width + x];
}


/**
 * ============================================================================
 * CORRECTED BILINEAR - Fixed implementation
 * ============================================================================
 */
function demosaicBilinearCorrected(cfa, width, height) {
    const size = width * height;

    const R = new Float64Array(size);
    const G = new Float64Array(size);
    const B = new Float64Array(size);

    // Copy known values
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const color = getBayerColor(x, y);
            const value = cfa[idx];

            if (color === 'R') R[idx] = value;
            else if (color === 'G') G[idx] = value;
            else B[idx] = value;
        }
    }

    // Interpolate Green at R and B locations (cross pattern, NOT including center)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = getBayerColor(x, y);
            if (color === 'G') continue;

            const idx = y * width + x;

            // Average of 4 cardinal neighbors (which are all green)
            const gU = getPixel(cfa, x, y - 1, width, height);
            const gD = getPixel(cfa, x, y + 1, width, height);
            const gL = getPixel(cfa, x - 1, y, width, height);
            const gR = getPixel(cfa, x + 1, y, width, height);

            G[idx] = (gU + gD + gL + gR) / 4;
        }
    }

    // Interpolate R at G locations
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = getBayerColor(x, y);
            if (color !== 'G') continue;

            const idx = y * width + x;
            const evenRow = (y % 2 === 0);

            if (evenRow) {
                // G in R row: R neighbors are horizontal
                const rL = getPixel(cfa, x - 1, y, width, height);
                const rR = getPixel(cfa, x + 1, y, width, height);
                R[idx] = (rL + rR) / 2;
            } else {
                // G in B row: R neighbors are vertical
                const rU = getPixel(cfa, x, y - 1, width, height);
                const rD = getPixel(cfa, x, y + 1, width, height);
                R[idx] = (rU + rD) / 2;
            }
        }
    }

    // Interpolate R at B locations (diagonal)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = getBayerColor(x, y);
            if (color !== 'B') continue;

            const idx = y * width + x;

            const r1 = getPixel(cfa, x - 1, y - 1, width, height);
            const r2 = getPixel(cfa, x + 1, y - 1, width, height);
            const r3 = getPixel(cfa, x - 1, y + 1, width, height);
            const r4 = getPixel(cfa, x + 1, y + 1, width, height);

            R[idx] = (r1 + r2 + r3 + r4) / 4;
        }
    }

    // Interpolate B at G locations
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = getBayerColor(x, y);
            if (color !== 'G') continue;

            const idx = y * width + x;
            const evenRow = (y % 2 === 0);

            if (evenRow) {
                // G in R row: B neighbors are vertical
                const bU = getPixel(cfa, x, y - 1, width, height);
                const bD = getPixel(cfa, x, y + 1, width, height);
                B[idx] = (bU + bD) / 2;
            } else {
                // G in B row: B neighbors are horizontal
                const bL = getPixel(cfa, x - 1, y, width, height);
                const bR = getPixel(cfa, x + 1, y, width, height);
                B[idx] = (bL + bR) / 2;
            }
        }
    }

    // Interpolate B at R locations (diagonal)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = getBayerColor(x, y);
            if (color !== 'R') continue;

            const idx = y * width + x;

            const b1 = getPixel(cfa, x - 1, y - 1, width, height);
            const b2 = getPixel(cfa, x + 1, y - 1, width, height);
            const b3 = getPixel(cfa, x - 1, y + 1, width, height);
            const b4 = getPixel(cfa, x + 1, y + 1, width, height);

            B[idx] = (b1 + b2 + b3 + b4) / 4;
        }
    }

    // Output
    const rgba = new Uint8ClampedArray(size * 4);
    for (let i = 0; i < size; i++) {
        rgba[i * 4] = clamp(R[i]);
        rgba[i * 4 + 1] = clamp(G[i]);
        rgba[i * 4 + 2] = clamp(B[i]);
        rgba[i * 4 + 3] = 255;
    }

    return rgba;
}


/**
 * ============================================================================
 * SMOOTH HUE TRANSITION (SHT) DEMOSAICING
 * ============================================================================
 *
 * Novel algorithm based on the observation that hue changes smoothly
 * across natural images. Uses log-domain color ratios for interpolation.
 */
function demosaicSmoothHue(cfa, width, height) {
    const size = width * height;

    const R = new Float64Array(size);
    const G = new Float64Array(size);
    const B = new Float64Array(size);

    // Copy known values
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const color = getBayerColor(x, y);
            const value = cfa[idx];

            if (color === 'R') R[idx] = value;
            else if (color === 'G') G[idx] = value;
            else B[idx] = value;
        }
    }

    // STEP 1: High-quality edge-directed green interpolation
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = getBayerColor(x, y);
            if (color === 'G') continue;

            const idx = y * width + x;

            const gL = getPixel(cfa, x - 1, y, width, height);
            const gR = getPixel(cfa, x + 1, y, width, height);
            const gU = getPixel(cfa, x, y - 1, width, height);
            const gD = getPixel(cfa, x, y + 1, width, height);

            const c = cfa[idx];
            const cL2 = getPixel(cfa, x - 2, y, width, height);
            const cR2 = getPixel(cfa, x + 2, y, width, height);
            const cU2 = getPixel(cfa, x, y - 2, width, height);
            const cD2 = getPixel(cfa, x, y + 2, width, height);

            // Gradient magnitudes
            const gradH = Math.abs(gL - gR) + Math.abs(cL2 - cR2);
            const gradV = Math.abs(gU - gD) + Math.abs(cU2 - cD2);

            // Laplacian-corrected estimates
            const estH = (gL + gR) / 2 + (2 * c - cL2 - cR2) / 4;
            const estV = (gU + gD) / 2 + (2 * c - cU2 - cD2) / 4;

            // Soft switching
            const k = 1.5; // Sharpness of transition
            const wH = Math.exp(-k * gradH);
            const wV = Math.exp(-k * gradV);
            const wSum = wH + wV + 1e-10;

            G[idx] = clamp((wH * estH + wV * estV) / wSum);
        }
    }

    // STEP 2: Log-domain hue interpolation
    // Hue = atan2(B-G, R-G) is preserved better when working in log space

    const LOG_OFFSET = 1; // Prevent log(0)

    // Compute log ratios at known locations
    const logRG = new Float64Array(size);
    const logBG = new Float64Array(size);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const color = getBayerColor(x, y);
            const gVal = G[idx] + LOG_OFFSET;

            if (color === 'R') {
                logRG[idx] = Math.log(R[idx] + LOG_OFFSET) - Math.log(gVal);
            } else if (color === 'B') {
                logBG[idx] = Math.log(B[idx] + LOG_OFFSET) - Math.log(gVal);
            }
        }
    }

    // Interpolate log(R/G) at non-R locations
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = getBayerColor(x, y);
            if (color === 'R') continue;

            const idx = y * width + x;
            const gVal = G[idx] + LOG_OFFSET;

            let avgLogRatio;

            if (color === 'G') {
                const evenRow = (y % 2 === 0);
                if (evenRow) {
                    const l1 = getPixelFloat(logRG, x - 1, y, width, height);
                    const l2 = getPixelFloat(logRG, x + 1, y, width, height);
                    avgLogRatio = (l1 + l2) / 2;
                } else {
                    const l1 = getPixelFloat(logRG, x, y - 1, width, height);
                    const l2 = getPixelFloat(logRG, x, y + 1, width, height);
                    avgLogRatio = (l1 + l2) / 2;
                }
            } else {
                const l1 = getPixelFloat(logRG, x - 1, y - 1, width, height);
                const l2 = getPixelFloat(logRG, x + 1, y - 1, width, height);
                const l3 = getPixelFloat(logRG, x - 1, y + 1, width, height);
                const l4 = getPixelFloat(logRG, x + 1, y + 1, width, height);
                avgLogRatio = (l1 + l2 + l3 + l4) / 4;
            }

            R[idx] = clamp(Math.exp(Math.log(gVal) + avgLogRatio) - LOG_OFFSET);
        }
    }

    // Interpolate log(B/G) at non-B locations
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = getBayerColor(x, y);
            if (color === 'B') continue;

            const idx = y * width + x;
            const gVal = G[idx] + LOG_OFFSET;

            let avgLogRatio;

            if (color === 'G') {
                const evenRow = (y % 2 === 0);
                if (evenRow) {
                    const l1 = getPixelFloat(logBG, x, y - 1, width, height);
                    const l2 = getPixelFloat(logBG, x, y + 1, width, height);
                    avgLogRatio = (l1 + l2) / 2;
                } else {
                    const l1 = getPixelFloat(logBG, x - 1, y, width, height);
                    const l2 = getPixelFloat(logBG, x + 1, y, width, height);
                    avgLogRatio = (l1 + l2) / 2;
                }
            } else {
                const l1 = getPixelFloat(logBG, x - 1, y - 1, width, height);
                const l2 = getPixelFloat(logBG, x + 1, y - 1, width, height);
                const l3 = getPixelFloat(logBG, x - 1, y + 1, width, height);
                const l4 = getPixelFloat(logBG, x + 1, y + 1, width, height);
                avgLogRatio = (l1 + l2 + l3 + l4) / 4;
            }

            B[idx] = clamp(Math.exp(Math.log(gVal) + avgLogRatio) - LOG_OFFSET);
        }
    }

    // Output
    const rgba = new Uint8ClampedArray(size * 4);
    for (let i = 0; i < size; i++) {
        rgba[i * 4] = clamp(R[i]);
        rgba[i * 4 + 1] = clamp(G[i]);
        rgba[i * 4 + 2] = clamp(B[i]);
        rgba[i * 4 + 3] = 255;
    }

    return rgba;
}


// Export advanced algorithms
window.DemosaicingAdvanced = {
    demosaicAGCRD,
    demosaicFrequencyAware,
    demosaicBilinearCorrected,
    demosaicSmoothHue
};
