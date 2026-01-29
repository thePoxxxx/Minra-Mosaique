/**
 * Custom .mosai2 File Format Implementation
 *
 * A dual-stream compact format that stores even rows and B values separately.
 * This format ONLY supports compact RG-B mode (no standard RGGB option).
 *
 * The data is stored as two separate JPEG-compressed regions:
 * 1. Even rows (R G R G...): Full width, contains R and G pixels
 * 2. B values only: Half width, extracted from odd rows
 *
 * This separation may improve compression since each region has
 * more uniform characteristics.
 *
 * File Structure (28-byte header + dual JPEG data):
 * ─────────────────────────────────────────────────────────────
 * Offset  Size  Field
 * 0x00    4B    Magic "MOS2"
 * 0x04    1B    Version (0x01)
 * 0x05    1B    Pattern (0=RGGB, others reserved)
 * 0x06    2B    Original Width (little-endian)
 * 0x08    2B    Original Height (little-endian)
 * 0x0A    1B    JPEG Quality (1-100)
 * 0x0B    1B    Reserved (0x00)
 * 0x0C    4B    Even rows JPEG length (little-endian)
 * 0x10    4B    B values JPEG length (little-endian)
 * 0x14    4B    CRC-32 checksum of combined JPEG data
 * 0x18    N     Even rows grayscale JPEG (W × evenRowCount)
 * 0x18+N  M     B values grayscale JPEG (W/2 × oddRowCount)
 */

const MOSAI2_MAGIC = [0x4D, 0x4F, 0x53, 0x32]; // "MOS2"
const MOSAI2_VERSION = 0x01;
const MOSAI2_HEADER_SIZE = 28;

/**
 * CRC-32 lookup table (same as mosaic-format.js)
 */
const CRC32_TABLE_V2 = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let crc = i;
        for (let j = 0; j < 8; j++) {
            crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
        }
        table[i] = crc;
    }
    return table;
})();

/**
 * Calculate CRC-32 checksum
 */
function calculateCRC32_v2(data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
        crc = CRC32_TABLE_V2[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Encode single-channel data to grayscale JPEG.
 */
function encodeGrayscaleJPEG_v2(data, width, height, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const imageData = ctx.createImageData(width, height);
    for (let i = 0; i < data.length; i++) {
        const idx = i * 4;
        const value = data[i];
        imageData.data[idx] = value;     // R
        imageData.data[idx + 1] = value; // G
        imageData.data[idx + 2] = value; // B
        imageData.data[idx + 3] = 255;   // A
    }
    ctx.putImageData(imageData, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', quality / 100);
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

/**
 * Detect image format from magic bytes.
 */
function detectFormat_v2(data) {
    if (data.length < 4) return 'jpeg';

    // JPEG: 0xFF 0xD8
    if (data[0] === 0xFF && data[1] === 0xD8) return 'jpeg';

    // PNG: 0x89 0x50 0x4E 0x47
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) return 'png';

    // WebP: RIFF....WEBP
    if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) {
        if (data.length >= 12 && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
            return 'webp';
        }
    }

    return 'jpeg'; // fallback
}

/**
 * Decode grayscale image (JPEG, PNG, or WebP) to single-channel data.
 */
function decodeGrayscaleJPEG_v2(imageData) {
    return new Promise((resolve, reject) => {
        const format = detectFormat_v2(imageData);
        let mimeType;
        switch (format) {
            case 'png': mimeType = 'image/png'; break;
            case 'webp': mimeType = 'image/webp'; break;
            default: mimeType = 'image/jpeg';
        }

        const blob = new Blob([imageData], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            const data = new Uint8Array(img.width * img.height);

            for (let i = 0; i < data.length; i++) {
                data[i] = imageData.data[i * 4]; // Extract R channel
            }

            URL.revokeObjectURL(url);
            resolve({
                data: data,
                width: img.width,
                height: img.height
            });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to decode JPEG'));
        };
        img.src = url;
    });
}

/**
 * Extract even rows from full CFA data.
 * Returns: R G R G R G... for rows 0, 2, 4, ...
 *
 * @param {Uint8Array} cfa - Full RGGB CFA (W×H)
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array} Even rows data (W × evenRowCount)
 */
function extractEvenRows(cfa, width, height) {
    const evenRowCount = Math.ceil(height / 2);
    const evenData = new Uint8Array(width * evenRowCount);

    let writeIdx = 0;
    for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x++) {
            evenData[writeIdx++] = cfa[y * width + x];
        }
    }

    return evenData;
}

/**
 * Extract B values from odd rows.
 * Returns: B B B B... extracted from positions (1,1), (1,3), (3,1), (3,3), ...
 *
 * @param {Uint8Array} cfa - Full RGGB CFA (W×H)
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array} B values (W/2 × oddRowCount)
 */
function extractBValues(cfa, width, height) {
    const oddRowCount = Math.floor(height / 2);
    const halfWidth = Math.floor(width / 2);
    const bData = new Uint8Array(halfWidth * oddRowCount);

    let writeIdx = 0;
    for (let y = 1; y < height; y += 2) {
        for (let x = 1; x < width; x += 2) {
            bData[writeIdx++] = cfa[y * width + x];
        }
    }

    return bData;
}

/**
 * Reconstruct full CFA from even rows and B values.
 *
 * @param {Uint8Array} evenData - Even rows (W × evenRowCount)
 * @param {Uint8Array} bData - B values (W/2 × oddRowCount)
 * @param {number} width - Original width
 * @param {number} height - Original height
 * @returns {Uint8Array} Full CFA (W×H) with G reconstructed
 */
function reconstructCFA(evenData, bData, width, height) {
    const cfa = new Uint8Array(width * height);
    const halfWidth = Math.floor(width / 2);

    // Place even rows
    let readIdx = 0;
    for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x++) {
            cfa[y * width + x] = evenData[readIdx++];
        }
    }

    // Place B values at odd rows, odd columns
    readIdx = 0;
    for (let y = 1; y < height; y += 2) {
        for (let x = 1; x < width; x += 2) {
            cfa[y * width + x] = bData[readIdx++];
        }
    }

    // Reconstruct G at odd rows, even columns (copy from nearest G above)
    for (let y = 1; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
            if (x + 1 < width) {
                // G is at (y-1, x+1) in the row above
                cfa[y * width + x] = cfa[(y - 1) * width + (x + 1)];
            } else if (x > 0) {
                // Edge case: use G at (y-1, x-1)
                cfa[y * width + x] = cfa[(y - 1) * width + (x - 1)];
            } else {
                cfa[y * width + x] = 128; // Fallback
            }
        }
    }

    return cfa;
}

/**
 * Encode grayscale data using specified format (JPEG or WebP).
 */
function encodeGrayscale_v2(data, width, height, quality, format) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const imageData = ctx.createImageData(width, height);
    for (let i = 0; i < data.length; i++) {
        const idx = i * 4;
        const value = data[i];
        imageData.data[idx] = value;     // R
        imageData.data[idx + 1] = value; // G
        imageData.data[idx + 2] = value; // B
        imageData.data[idx + 3] = 255;   // A
    }
    ctx.putImageData(imageData, 0, 0);

    const mimeType = format === 'webp' ? 'image/webp' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(mimeType, quality / 100);
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

/**
 * Encode CFA data to .mosai2 format.
 *
 * This format ONLY supports compact mode - it stores even rows and B values
 * as separate compressed streams for potentially better compression.
 *
 * @param {Uint8Array} cfaData - Full RGGB CFA array (W×H)
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {Object} options - Encoding options
 * @param {number} options.quality - Compression quality (1-100), default 85
 * @param {string} options.baseCompression - 'jpeg' or 'webp', default 'jpeg'
 * @returns {Uint8Array} Complete .mosai2 file data
 */
function encodeMosai2(cfaData, width, height, options = {}) {
    const quality = options.quality || 85;
    const baseCompression = options.baseCompression || 'jpeg';

    // Extract the two data regions
    const evenData = extractEvenRows(cfaData, width, height);
    const bData = extractBValues(cfaData, width, height);

    // Calculate dimensions for encoding
    const evenRowCount = Math.ceil(height / 2);
    const oddRowCount = Math.floor(height / 2);
    const halfWidth = Math.floor(width / 2);

    // Encode each region using selected format
    const evenEncoded = encodeGrayscale_v2(evenData, width, evenRowCount, quality, baseCompression);
    const bEncoded = encodeGrayscale_v2(bData, halfWidth, oddRowCount, quality, baseCompression);

    console.log(`Mosai2 encoding: ${baseCompression.toUpperCase()} (even: ${evenEncoded.length}B, B: ${bEncoded.length}B)`);

    // Use encoded data (keeping variable names for minimal changes below)
    const evenJpeg = evenEncoded;
    const bJpeg = bEncoded;

    // Combine JPEG data for CRC calculation
    const combinedJpeg = new Uint8Array(evenJpeg.length + bJpeg.length);
    combinedJpeg.set(evenJpeg, 0);
    combinedJpeg.set(bJpeg, evenJpeg.length);
    const crc = calculateCRC32_v2(combinedJpeg);

    // Create file buffer
    const totalSize = MOSAI2_HEADER_SIZE + evenJpeg.length + bJpeg.length;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Write header
    bytes[0] = MOSAI2_MAGIC[0]; // M
    bytes[1] = MOSAI2_MAGIC[1]; // O
    bytes[2] = MOSAI2_MAGIC[2]; // S
    bytes[3] = MOSAI2_MAGIC[3]; // 2

    bytes[4] = MOSAI2_VERSION;
    bytes[5] = 0; // Pattern (RGGB)

    view.setUint16(6, width, true);   // Original width
    view.setUint16(8, height, true);  // Original height

    bytes[10] = quality;
    bytes[11] = 0; // Reserved

    view.setUint32(12, evenJpeg.length, true);  // Even rows JPEG length
    view.setUint32(16, bJpeg.length, true);     // B values JPEG length
    view.setUint32(20, crc, true);              // CRC-32

    // Write JPEG data
    bytes.set(evenJpeg, MOSAI2_HEADER_SIZE);
    bytes.set(bJpeg, MOSAI2_HEADER_SIZE + evenJpeg.length);

    return bytes;
}

/**
 * Decode .mosai2 format to CFA data.
 *
 * @param {Uint8Array} mosai2Data - Complete .mosai2 file data
 * @returns {Promise<{cfaData: Uint8Array, width: number, height: number, quality: number}>}
 */
async function decodeMosai2(mosai2Data) {
    // Validate minimum size
    if (mosai2Data.length < MOSAI2_HEADER_SIZE) {
        throw new Error('Invalid .mosai2 file: too small');
    }

    const view = new DataView(mosai2Data.buffer, mosai2Data.byteOffset, mosai2Data.byteLength);

    // Validate magic
    if (mosai2Data[0] !== MOSAI2_MAGIC[0] ||
        mosai2Data[1] !== MOSAI2_MAGIC[1] ||
        mosai2Data[2] !== MOSAI2_MAGIC[2] ||
        mosai2Data[3] !== MOSAI2_MAGIC[3]) {
        throw new Error('Invalid .mosai2 file: bad magic');
    }

    // Read header
    const version = mosai2Data[4];
    if (version !== MOSAI2_VERSION) {
        throw new Error(`Unsupported .mosai2 version: ${version}`);
    }

    const pattern = mosai2Data[5];
    const width = view.getUint16(6, true);
    const height = view.getUint16(8, true);
    const quality = mosai2Data[10];

    const evenJpegLength = view.getUint32(12, true);
    const bJpegLength = view.getUint32(16, true);
    const storedCRC = view.getUint32(20, true);

    // Validate file size
    const expectedSize = MOSAI2_HEADER_SIZE + evenJpegLength + bJpegLength;
    if (mosai2Data.length < expectedSize) {
        throw new Error('Invalid .mosai2 file: truncated');
    }

    // Extract JPEG data
    const evenJpeg = mosai2Data.slice(MOSAI2_HEADER_SIZE, MOSAI2_HEADER_SIZE + evenJpegLength);
    const bJpeg = mosai2Data.slice(MOSAI2_HEADER_SIZE + evenJpegLength, MOSAI2_HEADER_SIZE + evenJpegLength + bJpegLength);

    // Validate CRC
    const combinedJpeg = new Uint8Array(evenJpegLength + bJpegLength);
    combinedJpeg.set(evenJpeg, 0);
    combinedJpeg.set(bJpeg, evenJpegLength);
    const calculatedCRC = calculateCRC32_v2(combinedJpeg);

    if (calculatedCRC !== storedCRC) {
        throw new Error('Invalid .mosai2 file: CRC mismatch');
    }

    // Decode both JPEG streams
    const [evenDecoded, bDecoded] = await Promise.all([
        decodeGrayscaleJPEG_v2(evenJpeg),
        decodeGrayscaleJPEG_v2(bJpeg)
    ]);

    // Reconstruct full CFA
    const cfaData = reconstructCFA(evenDecoded.data, bDecoded.data, width, height);

    return {
        cfaData: cfaData,
        width: width,
        height: height,
        pattern: pattern,
        quality: quality
    };
}

/**
 * Get file size statistics for .mosai2 format.
 *
 * @param {Uint8Array} cfaData - Original full CFA
 * @param {Uint8Array} mosai2Data - Encoded .mosai2 data
 * @param {number} width
 * @param {number} height
 * @returns {Object} Size statistics
 */
function getMosai2Stats(cfaData, mosai2Data, width, height) {
    const originalSize = width * height; // Full CFA size
    const compactSize = Mosaicing.getCompactSize(width, height); // Theoretical compact size
    const compressedSize = mosai2Data.length;

    return {
        originalSize: originalSize,
        compactSize: compactSize,
        compressedSize: compressedSize,
        compactRatio: (compactSize / originalSize * 100).toFixed(1),
        compressionRatio: (originalSize / compressedSize).toFixed(2),
        savingsPercent: ((1 - compressedSize / originalSize) * 100).toFixed(1)
    };
}

// Export for use in other modules
window.MosaicFormat2 = {
    MOSAI2_HEADER_SIZE,
    encodeMosai2,
    decodeMosai2,
    getMosai2Stats,
    extractEvenRows,
    extractBValues,
    reconstructCFA
};
