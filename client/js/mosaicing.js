/**
 * Bayer RGGB Mosaicing Implementation
 *
 * Exact port from Python backend/app/core/mosaicing.py
 *
 * RGGB Bayer Pattern:
 *   Row 0: R G R G R G ...
 *   Row 1: G B G B G B ...
 *   Row 2: R G R G R G ...
 *   Row 3: G B G B G B ...
 *
 * 50% green, 25% red, 25% blue - matching human visual sensitivity
 */

/**
 * Apply RGGB Bayer pattern mosaicing to an RGB image.
 *
 * @param {ImageData} imageData - Canvas ImageData object (RGBA format)
 * @returns {Uint8Array} Single-channel CFA array
 */
function applyBayerMosaic(imageData) {
    const { width, height, data } = imageData;
    const cfa = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const rgbaIdx = (y * width + x) * 4;
            const cfaIdx = y * width + x;

            // RGGB pattern:
            // Even rows (0, 2, 4...): R at even cols, G at odd cols
            // Odd rows (1, 3, 5...): G at even cols, B at odd cols

            if (y % 2 === 0) {
                // Even row
                if (x % 2 === 0) {
                    // Red channel at (even row, even col)
                    cfa[cfaIdx] = data[rgbaIdx]; // R
                } else {
                    // Green channel at (even row, odd col)
                    cfa[cfaIdx] = data[rgbaIdx + 1]; // G
                }
            } else {
                // Odd row
                if (x % 2 === 0) {
                    // Green channel at (odd row, even col)
                    cfa[cfaIdx] = data[rgbaIdx + 1]; // G
                } else {
                    // Blue channel at (odd row, odd col)
                    cfa[cfaIdx] = data[rgbaIdx + 2]; // B
                }
            }
        }
    }

    return cfa;
}

/**
 * Generate a colorized visualization of the CFA pattern.
 * Shows R pixels in red, G pixels in green, B pixels in blue.
 *
 * @param {Uint8Array} cfa - Single-channel CFA array
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Uint8ClampedArray} RGBA visualization
 */
function generateColorizedView(cfa, width, height) {
    const rgba = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const cfaIdx = y * width + x;
            const rgbaIdx = cfaIdx * 4;
            const value = cfa[cfaIdx];

            // Initialize to black with full alpha
            rgba[rgbaIdx] = 0;     // R
            rgba[rgbaIdx + 1] = 0; // G
            rgba[rgbaIdx + 2] = 0; // B
            rgba[rgbaIdx + 3] = 255; // A

            if (y % 2 === 0 && x % 2 === 0) {
                // Red pixel (even row, even col)
                rgba[rgbaIdx] = value;
            } else if (y % 2 === 1 && x % 2 === 1) {
                // Blue pixel (odd row, odd col)
                rgba[rgbaIdx + 2] = value;
            } else {
                // Green pixel
                rgba[rgbaIdx + 1] = value;
            }
        }
    }

    return rgba;
}

/**
 * Generate grayscale visualization of CFA data.
 *
 * @param {Uint8Array} cfa - Single-channel CFA array
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Uint8ClampedArray} RGBA grayscale visualization
 */
function generateGrayscaleView(cfa, width, height) {
    const rgba = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < cfa.length; i++) {
        const rgbaIdx = i * 4;
        const value = cfa[i];
        rgba[rgbaIdx] = value;     // R
        rgba[rgbaIdx + 1] = value; // G
        rgba[rgbaIdx + 2] = value; // B
        rgba[rgbaIdx + 3] = 255;   // A
    }

    return rgba;
}

/**
 * ============================================================================
 * COMPACT RG-B MODE FUNCTIONS
 * ============================================================================
 *
 * Compact mode drops one G channel (at odd rows, even columns) for 25% storage
 * reduction. The pattern goes from RGGB to RG-B:
 *
 * Standard RGGB:        Compact RG-B (after packing):
 *   R G R G               R G R G  (even rows: full)
 *   G B G B               B B      (odd rows: B only, shifted left)
 *   R G R G               R G R G
 *   G B G B               B B
 *
 * Storage: W×H → 3×W×H/4 (75% of original)
 */

/**
 * Pack standard CFA into compact format by dropping G from odd rows.
 *
 * @param {Uint8Array} cfa - Standard RGGB CFA (W×H)
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Uint8Array} Compact CFA (approximately 3×W×H/4)
 */
function applyCompactPacking(cfa, width, height) {
    const evenRowCount = Math.ceil(height / 2);
    const oddRowCount = Math.floor(height / 2);
    const halfWidth = Math.floor(width / 2);
    const compactSize = evenRowCount * width + oddRowCount * halfWidth;

    const compact = new Uint8Array(compactSize);
    let writeIdx = 0;

    // Write even rows fully (R G R G...)
    for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x++) {
            compact[writeIdx++] = cfa[y * width + x];
        }
    }

    // Write odd rows - B only at odd columns (shifted left to close gaps)
    for (let y = 1; y < height; y += 2) {
        for (let x = 1; x < width; x += 2) {
            compact[writeIdx++] = cfa[y * width + x];
        }
    }

    return compact;
}

/**
 * Expand compact CFA back to standard RGGB format.
 * Missing G values at (odd row, even col) are reconstructed by copying
 * from the nearest G in the row above.
 *
 * @param {Uint8Array} compact - Compact CFA data
 * @param {number} width - Original image width
 * @param {number} height - Original image height
 * @returns {Uint8Array} Expanded CFA (W×H)
 */
function expandCompactCFA(compact, width, height) {
    const cfa = new Uint8Array(width * height);
    const halfWidth = Math.floor(width / 2);

    let readIdx = 0;

    // Read even rows (full width)
    for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x++) {
            cfa[y * width + x] = compact[readIdx++];
        }
    }

    // Read B values into odd rows at odd columns
    for (let y = 1; y < height; y += 2) {
        for (let x = 1; x < width; x += 2) {
            cfa[y * width + x] = compact[readIdx++];
        }
    }

    // Reconstruct G at odd rows, even columns
    // Copy from nearest G in the row above (which is at odd column)
    for (let y = 1; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
            // G positions in even rows are at odd columns
            // Find nearest G: prefer column x+1, fallback to x-1
            if (x + 1 < width) {
                // G is at (y-1, x+1) in the row above
                cfa[y * width + x] = cfa[(y - 1) * width + (x + 1)];
            } else if (x > 0) {
                // Edge case: use G at (y-1, x-1)
                cfa[y * width + x] = cfa[(y - 1) * width + (x - 1)];
            } else {
                // Single column edge case - shouldn't happen in practice
                cfa[y * width + x] = 128;
            }
        }
    }

    return cfa;
}

/**
 * Calculate the compact size for given dimensions.
 *
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {number} Compact data size in bytes
 */
function getCompactSize(width, height) {
    const evenRowCount = Math.ceil(height / 2);
    const oddRowCount = Math.floor(height / 2);
    const halfWidth = Math.floor(width / 2);
    return evenRowCount * width + oddRowCount * halfWidth;
}

/**
 * Generate colorized view for COMPACT mode.
 * Shows REAL pixels in full color, MISSING (reconstructed) G pixels as dim/marked.
 *
 * In compact mode, the G at (odd row, even col) is dropped and reconstructed.
 * This visualization marks those pixels to show what data is actually stored.
 *
 * @param {Uint8Array} cfa - Expanded CFA (after reconstruction)
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Uint8ClampedArray} RGBA visualization with reconstructed pixels marked
 */
function generateCompactColorizedView(cfa, width, height) {
    const rgba = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const cfaIdx = y * width + x;
            const rgbaIdx = cfaIdx * 4;
            const value = cfa[cfaIdx];

            // Check if this is a "dropped" G position (odd row, even col)
            const isDroppedG = (y % 2 === 1) && (x % 2 === 0);

            if (isDroppedG) {
                // Mark reconstructed G pixels with magenta/pink tint
                // This shows they're NOT real data
                rgba[rgbaIdx] = Math.min(255, value * 0.4 + 80);     // R (magenta tint)
                rgba[rgbaIdx + 1] = Math.floor(value * 0.3);         // G (dimmed)
                rgba[rgbaIdx + 2] = Math.min(255, value * 0.4 + 80); // B (magenta tint)
                rgba[rgbaIdx + 3] = 255;
            } else if (y % 2 === 0 && x % 2 === 0) {
                // Red pixel (even row, even col) - REAL
                rgba[rgbaIdx] = value;
                rgba[rgbaIdx + 1] = 0;
                rgba[rgbaIdx + 2] = 0;
                rgba[rgbaIdx + 3] = 255;
            } else if (y % 2 === 1 && x % 2 === 1) {
                // Blue pixel (odd row, odd col) - REAL
                rgba[rgbaIdx] = 0;
                rgba[rgbaIdx + 1] = 0;
                rgba[rgbaIdx + 2] = value;
                rgba[rgbaIdx + 3] = 255;
            } else {
                // Green pixel at (even row, odd col) - REAL
                rgba[rgbaIdx] = 0;
                rgba[rgbaIdx + 1] = value;
                rgba[rgbaIdx + 2] = 0;
                rgba[rgbaIdx + 3] = 255;
            }
        }
    }

    return rgba;
}

/**
 * Generate grayscale view for COMPACT mode.
 * Shows REAL pixels normally, MISSING (reconstructed) G pixels as darker/marked.
 *
 * @param {Uint8Array} cfa - Expanded CFA (after reconstruction)
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Uint8ClampedArray} RGBA grayscale with reconstructed pixels marked
 */
function generateCompactGrayscaleView(cfa, width, height) {
    const rgba = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < width * height; i++) {
        const x = i % width;
        const y = Math.floor(i / width);
        const rgbaIdx = i * 4;
        const value = cfa[i];

        // Check if this is a "dropped" G position (odd row, even col)
        const isDroppedG = (y % 2 === 1) && (x % 2 === 0);

        if (isDroppedG) {
            // Mark reconstructed pixels - show as striped/darker
            const stripe = ((x + y) % 2 === 0) ? 0.5 : 0.7;
            const dimmed = Math.floor(value * stripe);
            rgba[rgbaIdx] = dimmed;
            rgba[rgbaIdx + 1] = dimmed;
            rgba[rgbaIdx + 2] = dimmed;
            rgba[rgbaIdx + 3] = 255;
        } else {
            // Real pixel - show normally
            rgba[rgbaIdx] = value;
            rgba[rgbaIdx + 1] = value;
            rgba[rgbaIdx + 2] = value;
            rgba[rgbaIdx + 3] = 255;
        }
    }

    return rgba;
}

/**
 * Get boolean masks for R, G, B pixel locations in RGGB pattern.
 *
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Object} Object with rMask, gMask, bMask, gAtRRow, gAtBRow arrays
 */
function getBayerMasks(width, height) {
    const size = width * height;
    const rMask = new Uint8Array(size);
    const gMask = new Uint8Array(size);
    const bMask = new Uint8Array(size);
    const gAtRRow = new Uint8Array(size); // G in rows that have R (even rows)
    const gAtBRow = new Uint8Array(size); // G in rows that have B (odd rows)

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;

            if (y % 2 === 0) {
                // Even row
                if (x % 2 === 0) {
                    rMask[idx] = 1;
                } else {
                    gMask[idx] = 1;
                    gAtRRow[idx] = 1;
                }
            } else {
                // Odd row
                if (x % 2 === 0) {
                    gMask[idx] = 1;
                    gAtBRow[idx] = 1;
                } else {
                    bMask[idx] = 1;
                }
            }
        }
    }

    return { rMask, gMask, bMask, gAtRRow, gAtBRow };
}

// Export for use in other modules
window.Mosaicing = {
    applyBayerMosaic,
    generateColorizedView,
    generateGrayscaleView,
    getBayerMasks,
    // Compact RG-B mode functions
    applyCompactPacking,
    expandCompactCFA,
    getCompactSize,
    generateCompactColorizedView,
    generateCompactGrayscaleView
};
