/**
 * Image Quality Metrics Implementation
 *
 * Exact port from Python backend/app/core/metrics.py
 *
 * Includes:
 * - PSNR (Peak Signal-to-Noise Ratio)
 * - SSIM (Structural Similarity Index)
 */

/**
 * Calculate Peak Signal-to-Noise Ratio (PSNR).
 *
 * PSNR measures the ratio between the maximum possible signal power
 * and the power of corrupting noise. Higher values indicate better quality.
 *
 * Typical values:
 * - 30-40 dB: Good quality
 * - 40-50 dB: Excellent quality
 * - > 50 dB: Near-perfect
 *
 * @param {Uint8ClampedArray} original - Original RGBA image data
 * @param {Uint8ClampedArray} reconstructed - Reconstructed RGBA image data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {number} PSNR in decibels (dB)
 */
function calculatePSNR(original, reconstructed, width, height) {
    let sumSquaredError = 0;
    const size = width * height;

    for (let i = 0; i < size; i++) {
        const idx = i * 4;
        // Only compare RGB channels, not alpha
        for (let c = 0; c < 3; c++) {
            const diff = original[idx + c] - reconstructed[idx + c];
            sumSquaredError += diff * diff;
        }
    }

    const mse = sumSquaredError / (size * 3);

    if (mse === 0) {
        return Infinity; // Identical images
    }

    const maxPixel = 255.0;
    const psnr = 20 * Math.log10(maxPixel / Math.sqrt(mse));

    return Math.round(psnr * 100) / 100;
}

/**
 * Calculate Structural Similarity Index (SSIM).
 *
 * SSIM measures the perceived quality of an image by comparing
 * luminance, contrast, and structure. Values range from -1 to 1,
 * where 1 indicates identical images.
 *
 * This is a JavaScript implementation of the SSIM algorithm matching
 * skimage.metrics.structural_similarity behavior.
 *
 * @param {Uint8ClampedArray} original - Original RGBA image data
 * @param {Uint8ClampedArray} reconstructed - Reconstructed RGBA image data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {number} SSIM value between 0 and 1
 */
function calculateSSIM(original, reconstructed, width, height) {
    // Constants (same as skimage defaults)
    const K1 = 0.01;
    const K2 = 0.03;
    const L = 255; // Dynamic range
    const C1 = (K1 * L) ** 2;
    const C2 = (K2 * L) ** 2;

    // Determine window size based on image dimensions
    const minDim = Math.min(width, height);
    let winSize = Math.min(7, minDim % 2 === 1 ? minDim : minDim - 1);
    if (winSize < 3) winSize = 3;

    const halfWin = Math.floor(winSize / 2);

    // Calculate SSIM for each color channel separately and average
    let totalSSIM = 0;

    for (let channel = 0; channel < 3; channel++) {
        let channelSSIM = 0;
        let windowCount = 0;

        // Slide window over image
        for (let y = halfWin; y < height - halfWin; y++) {
            for (let x = halfWin; x < width - halfWin; x++) {
                // Calculate statistics within window
                let sumOrig = 0;
                let sumRecon = 0;
                let sumOrigSq = 0;
                let sumReconSq = 0;
                let sumOrigRecon = 0;
                const n = winSize * winSize;

                for (let wy = -halfWin; wy <= halfWin; wy++) {
                    for (let wx = -halfWin; wx <= halfWin; wx++) {
                        const idx = ((y + wy) * width + (x + wx)) * 4 + channel;
                        const origVal = original[idx];
                        const reconVal = reconstructed[idx];

                        sumOrig += origVal;
                        sumRecon += reconVal;
                        sumOrigSq += origVal * origVal;
                        sumReconSq += reconVal * reconVal;
                        sumOrigRecon += origVal * reconVal;
                    }
                }

                // Calculate means
                const meanOrig = sumOrig / n;
                const meanRecon = sumRecon / n;

                // Calculate variances and covariance
                const varOrig = (sumOrigSq / n) - (meanOrig * meanOrig);
                const varRecon = (sumReconSq / n) - (meanRecon * meanRecon);
                const covar = (sumOrigRecon / n) - (meanOrig * meanRecon);

                // SSIM formula
                const numerator = (2 * meanOrig * meanRecon + C1) * (2 * covar + C2);
                const denominator = (meanOrig * meanOrig + meanRecon * meanRecon + C1) *
                                   (varOrig + varRecon + C2);

                channelSSIM += numerator / denominator;
                windowCount++;
            }
        }

        // Average SSIM for this channel
        if (windowCount > 0) {
            totalSSIM += channelSSIM / windowCount;
        }
    }

    // Average across all 3 channels
    const ssim = totalSSIM / 3;

    return Math.round(ssim * 10000) / 10000;
}

/**
 * Calculate all quality metrics.
 *
 * @param {Uint8ClampedArray} original - Original RGBA image data
 * @param {Uint8ClampedArray} reconstructed - Reconstructed RGBA image data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Object} Object with 'psnr' and 'ssim' values
 */
function calculateMetrics(original, reconstructed, width, height) {
    return {
        psnr: calculatePSNR(original, reconstructed, width, height),
        ssim: calculateSSIM(original, reconstructed, width, height)
    };
}

// Export for use in other modules
window.Metrics = {
    calculatePSNR,
    calculateSSIM,
    calculateMetrics
};
