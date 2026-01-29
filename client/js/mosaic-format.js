/**
 * Custom .mosaic File Format Implementation
 *
 * A single-channel image format using JPEG compression for the CFA data.
 *
 * File Structure (20-byte header + JPEG data):
 * ─────────────────────────────────────────────────────
 * Offset  Size  Field
 * 0x00    4B    Magic "MOSA"
 * 0x04    1B    Version (0x01)
 * 0x05    1B    Pattern (0=RGGB, 1=BGGR, 2=GRBG, 3=GBRG)
 * 0x06    2B    Width (little-endian)
 * 0x08    2B    Height (little-endian)
 * 0x0A    1B    JPEG Quality (1-100)
 * 0x0B    1B    Mode (0=Standard RGGB, 1=Compact RG-B)
 * 0x0C    4B    JPEG data length (little-endian)
 * 0x10    4B    CRC-32 checksum of JPEG data
 * 0x14    N     Grayscale JPEG data (single channel)
 */

const MOSAIC_MAGIC = [0x4D, 0x4F, 0x53, 0x41]; // "MOSA"
const MOSAIC_VERSION = 0x01;
const HEADER_SIZE = 20;

// Bayer pattern constants
const PATTERN = {
    RGGB: 0,
    BGGR: 1,
    GRBG: 2,
    GBRG: 3
};

// Mosaic mode constants
const MODE = {
    STANDARD: 0,  // Full RGGB pattern
    COMPACT: 1    // RG-B (one G dropped, 25% smaller)
};

/**
 * CRC-32 lookup table
 */
const CRC32_TABLE = (() => {
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
function calculateCRC32(data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
        crc = CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Compression type constants
const COMPRESSION = {
    JPEG: 'jpeg',
    PNG: 'png',
    WEBP: 'webp',
    MICRO: 'micro'  // Novel Bayer-planar encoding for small files
};

// ============================================
// MICRO FORMAT: Bayer-Planar Delta Encoding
// ============================================
//
// Novel compression specifically optimized for small CFA images.
// Key insight: In Bayer pattern, same-color pixels are correlated
// but not adjacent. By separating into color planes, we get:
// 1. Smooth data within each plane (adjacent pixels now same color)
// 2. Small delta values that compress extremely well
// 3. Minimal header overhead (8 bytes vs PNG's ~67+ bytes)
//
// Format:
// - Magic: "uCFA" (4 bytes) - micro CFA
// - Width: 16-bit LE (2 bytes)
// - Height: 16-bit LE (2 bytes)
// - Data: DEFLATE-compressed planar CFA
//
// Planar layout: [R plane][G1 plane][G2 plane][B plane]
// Each plane is (W/2)×(H/2), delta-encoded row by row

const MICRO_MAGIC = [0x75, 0x43, 0x46, 0x41]; // "uCFA"
const MICRO_HEADER_SIZE = 8;

/**
 * Separate CFA into 4 color planes (R, G1, G2, B).
 * Each plane is quarter resolution with highly correlated pixels.
 *
 * RGGB pattern:
 * R  G1 R  G1   →  R plane: all R pixels (even row, even col)
 * G2 B  G2 B       G1 plane: all G at odd cols (even row, odd col)
 * R  G1 R  G1      G2 plane: all G at even cols (odd row, even col)
 * G2 B  G2 B       B plane: all B pixels (odd row, odd col)
 *
 * @param {Uint8Array} cfaData - Full CFA data (W×H)
 * @param {number} width
 * @param {number} height
 * @returns {{r: Uint8Array, g1: Uint8Array, g2: Uint8Array, b: Uint8Array, planeW: number, planeH: number}}
 */
function separateBayerPlanes(cfaData, width, height) {
    const planeW = Math.ceil(width / 2);
    const planeH = Math.ceil(height / 2);
    const planeSize = planeW * planeH;

    const r = new Uint8Array(planeSize);
    const g1 = new Uint8Array(planeSize);
    const g2 = new Uint8Array(planeSize);
    const b = new Uint8Array(planeSize);

    for (let py = 0; py < planeH; py++) {
        for (let px = 0; px < planeW; px++) {
            const planeIdx = py * planeW + px;

            // Map to CFA coordinates
            const cfaY = py * 2;
            const cfaX = px * 2;

            // R: even row, even col
            if (cfaY < height && cfaX < width) {
                r[planeIdx] = cfaData[cfaY * width + cfaX];
            }

            // G1: even row, odd col
            if (cfaY < height && cfaX + 1 < width) {
                g1[planeIdx] = cfaData[cfaY * width + cfaX + 1];
            }

            // G2: odd row, even col
            if (cfaY + 1 < height && cfaX < width) {
                g2[planeIdx] = cfaData[(cfaY + 1) * width + cfaX];
            }

            // B: odd row, odd col
            if (cfaY + 1 < height && cfaX + 1 < width) {
                b[planeIdx] = cfaData[(cfaY + 1) * width + cfaX + 1];
            }
        }
    }

    return { r, g1, g2, b, planeW, planeH };
}

/**
 * Recombine 4 color planes back into CFA.
 *
 * @param {{r: Uint8Array, g1: Uint8Array, g2: Uint8Array, b: Uint8Array}} planes
 * @param {number} width - Original CFA width
 * @param {number} height - Original CFA height
 * @returns {Uint8Array} Reconstructed CFA
 */
function combineBayerPlanes(planes, width, height) {
    const { r, g1, g2, b } = planes;
    const planeW = Math.ceil(width / 2);
    const cfa = new Uint8Array(width * height);

    for (let py = 0; py < Math.ceil(height / 2); py++) {
        for (let px = 0; px < planeW; px++) {
            const planeIdx = py * planeW + px;

            const cfaY = py * 2;
            const cfaX = px * 2;

            // R: even row, even col
            if (cfaY < height && cfaX < width) {
                cfa[cfaY * width + cfaX] = r[planeIdx];
            }

            // G1: even row, odd col
            if (cfaY < height && cfaX + 1 < width) {
                cfa[cfaY * width + cfaX + 1] = g1[planeIdx];
            }

            // G2: odd row, even col
            if (cfaY + 1 < height && cfaX < width) {
                cfa[(cfaY + 1) * width + cfaX] = g2[planeIdx];
            }

            // B: odd row, odd col
            if (cfaY + 1 < height && cfaX + 1 < width) {
                cfa[(cfaY + 1) * width + cfaX + 1] = b[planeIdx];
            }
        }
    }

    return cfa;
}

/**
 * Apply delta encoding to a plane (horizontal prediction).
 * First pixel of each row stored as-is, rest as difference from previous.
 *
 * @param {Uint8Array} plane - Input plane
 * @param {number} width - Plane width
 * @param {number} height - Plane height
 * @returns {Uint8Array} Delta-encoded plane
 */
function deltaEncode(plane, width, height) {
    const encoded = new Uint8Array(plane.length);

    for (let y = 0; y < height; y++) {
        const rowStart = y * width;

        // First pixel: store as-is
        encoded[rowStart] = plane[rowStart];

        // Rest: store delta from previous (wrapped to 0-255)
        for (let x = 1; x < width; x++) {
            const curr = plane[rowStart + x];
            const prev = plane[rowStart + x - 1];
            // Store difference, wrapped to unsigned byte
            encoded[rowStart + x] = (curr - prev + 256) & 0xFF;
        }
    }

    return encoded;
}

/**
 * Reverse delta encoding.
 *
 * @param {Uint8Array} encoded - Delta-encoded plane
 * @param {number} width - Plane width
 * @param {number} height - Plane height
 * @returns {Uint8Array} Original plane
 */
function deltaDecode(encoded, width, height) {
    const plane = new Uint8Array(encoded.length);

    for (let y = 0; y < height; y++) {
        const rowStart = y * width;

        // First pixel: copy as-is
        plane[rowStart] = encoded[rowStart];

        // Rest: add delta to previous
        for (let x = 1; x < width; x++) {
            const delta = encoded[rowStart + x];
            const prev = plane[rowStart + x - 1];
            plane[rowStart + x] = (prev + delta) & 0xFF;
        }
    }

    return plane;
}

/**
 * Compress data using DEFLATE via CompressionStream API.
 * Falls back to uncompressed if API not available.
 *
 * @param {Uint8Array} data - Data to compress
 * @returns {Promise<Uint8Array>} Compressed data
 */
async function deflateCompress(data) {
    // Check for CompressionStream support
    if (typeof CompressionStream === 'undefined') {
        console.warn('CompressionStream not supported, using uncompressed');
        return data;
    }

    try {
        const stream = new CompressionStream('deflate-raw');
        const writer = stream.writable.getWriter();
        writer.write(data);
        writer.close();

        const chunks = [];
        const reader = stream.readable.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        // Combine chunks
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result;
    } catch (err) {
        console.warn('DEFLATE compression failed, using uncompressed:', err);
        return data;
    }
}

/**
 * Decompress DEFLATE data.
 *
 * @param {Uint8Array} compressed - Compressed data
 * @returns {Promise<Uint8Array>} Decompressed data
 */
async function deflateDecompress(compressed) {
    if (typeof DecompressionStream === 'undefined') {
        console.warn('DecompressionStream not supported');
        return compressed;
    }

    try {
        const stream = new DecompressionStream('deflate-raw');
        const writer = stream.writable.getWriter();
        writer.write(compressed);
        writer.close();

        const chunks = [];
        const reader = stream.readable.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result;
    } catch (err) {
        console.warn('DEFLATE decompression failed:', err);
        throw new Error('Failed to decompress micro format data');
    }
}

/**
 * Encode CFA data using Micro format (Bayer-planar delta encoding).
 * Optimized for small files where JPEG/PNG overhead is too high.
 *
 * @param {Uint8Array} cfaData - Full CFA data
 * @param {number} width
 * @param {number} height
 * @returns {Promise<Uint8Array>} Micro-encoded data
 */
async function encodeMicro(cfaData, width, height) {
    // Separate into color planes
    const planes = separateBayerPlanes(cfaData, width, height);
    const { planeW, planeH } = planes;

    // Delta-encode each plane
    const rDelta = deltaEncode(planes.r, planeW, planeH);
    const g1Delta = deltaEncode(planes.g1, planeW, planeH);
    const g2Delta = deltaEncode(planes.g2, planeW, planeH);
    const bDelta = deltaEncode(planes.b, planeW, planeH);

    // Concatenate planes
    const planeSize = planeW * planeH;
    const combined = new Uint8Array(planeSize * 4);
    combined.set(rDelta, 0);
    combined.set(g1Delta, planeSize);
    combined.set(g2Delta, planeSize * 2);
    combined.set(bDelta, planeSize * 3);

    // Compress with DEFLATE
    const compressed = await deflateCompress(combined);

    // Build micro format file
    const totalSize = MICRO_HEADER_SIZE + compressed.length;
    const result = new Uint8Array(totalSize);
    const view = new DataView(result.buffer);

    // Write header
    result[0] = MICRO_MAGIC[0]; // 'u'
    result[1] = MICRO_MAGIC[1]; // 'C'
    result[2] = MICRO_MAGIC[2]; // 'F'
    result[3] = MICRO_MAGIC[3]; // 'A'
    view.setUint16(4, width, true);
    view.setUint16(6, height, true);

    // Write compressed data
    result.set(compressed, MICRO_HEADER_SIZE);

    return result;
}

/**
 * Decode Micro format back to CFA data.
 *
 * @param {Uint8Array} microData - Micro format file data
 * @returns {Promise<{cfaData: Uint8Array, width: number, height: number}>}
 */
async function decodeMicro(microData) {
    // Validate header
    if (microData.length < MICRO_HEADER_SIZE) {
        throw new Error('Invalid micro format: too small');
    }

    if (microData[0] !== MICRO_MAGIC[0] ||
        microData[1] !== MICRO_MAGIC[1] ||
        microData[2] !== MICRO_MAGIC[2] ||
        microData[3] !== MICRO_MAGIC[3]) {
        throw new Error('Invalid micro format: bad magic');
    }

    const view = new DataView(microData.buffer, microData.byteOffset, microData.byteLength);
    const width = view.getUint16(4, true);
    const height = view.getUint16(6, true);

    // Decompress
    const compressed = microData.slice(MICRO_HEADER_SIZE);
    const combined = await deflateDecompress(compressed);

    // Split into planes
    const planeW = Math.ceil(width / 2);
    const planeH = Math.ceil(height / 2);
    const planeSize = planeW * planeH;

    const rDelta = combined.slice(0, planeSize);
    const g1Delta = combined.slice(planeSize, planeSize * 2);
    const g2Delta = combined.slice(planeSize * 2, planeSize * 3);
    const bDelta = combined.slice(planeSize * 3, planeSize * 4);

    // Delta-decode each plane
    const r = deltaDecode(rDelta, planeW, planeH);
    const g1 = deltaDecode(g1Delta, planeW, planeH);
    const g2 = deltaDecode(g2Delta, planeW, planeH);
    const b = deltaDecode(bDelta, planeW, planeH);

    // Recombine into CFA
    const cfaData = combineBayerPlanes({ r, g1, g2, b }, width, height);

    return { cfaData, width, height };
}

/**
 * Check if data is in Micro format.
 *
 * @param {Uint8Array} data
 * @returns {boolean}
 */
function isMicroFormat(data) {
    return data.length >= 4 &&
           data[0] === MICRO_MAGIC[0] &&
           data[1] === MICRO_MAGIC[1] &&
           data[2] === MICRO_MAGIC[2] &&
           data[3] === MICRO_MAGIC[3];
}

/**
 * Create grayscale ImageData from CFA data
 */
function createGrayscaleImageData(cfaData, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const imageData = ctx.createImageData(width, height);
    for (let i = 0; i < cfaData.length; i++) {
        const idx = i * 4;
        const value = cfaData[i];
        imageData.data[idx] = value;     // R
        imageData.data[idx + 1] = value; // G
        imageData.data[idx + 2] = value; // B
        imageData.data[idx + 3] = 255;   // A
    }
    ctx.putImageData(imageData, 0, 0);

    return { canvas, ctx, imageData };
}

/**
 * Encode single-channel CFA data to grayscale JPEG.
 *
 * @param {Uint8Array} cfaData - Single-channel CFA array
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} quality - JPEG quality (1-100)
 * @returns {Uint8Array} JPEG encoded data
 */
function encodeGrayscaleJPEG(cfaData, width, height, quality) {
    const { canvas } = createGrayscaleImageData(cfaData, width, height);

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
 * Encode single-channel CFA data to grayscale PNG.
 *
 * @param {Uint8Array} cfaData - Single-channel CFA array
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Uint8Array} PNG encoded data
 */
function encodeGrayscalePNG(cfaData, width, height) {
    const { canvas } = createGrayscaleImageData(cfaData, width, height);

    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

/**
 * Encode single-channel CFA data to grayscale WebP.
 *
 * @param {Uint8Array} cfaData - Single-channel CFA array
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} quality - WebP quality (1-100)
 * @returns {Uint8Array} WebP encoded data
 */
function encodeGrayscaleWebP(cfaData, width, height, quality) {
    const { canvas } = createGrayscaleImageData(cfaData, width, height);

    const dataUrl = canvas.toDataURL('image/webp', quality / 100);
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

/**
 * Encode with adaptive compression - tries multiple formats and picks smallest.
 * Now includes Micro format for optimal small file compression.
 *
 * @param {Uint8Array} cfaData - Single-channel CFA array
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} quality - Quality (1-100) for lossy formats
 * @param {string} baseCompression - Base lossy format: 'jpeg' or 'webp'
 * @param {boolean} isCompact - Whether data is in compact mode (skip micro for compact)
 * @returns {Promise<{data: Uint8Array, format: string}>} Smallest encoded data and format used
 */
async function encodeAdaptive(cfaData, width, height, quality, baseCompression, isCompact = false) {
    const candidates = [];

    // Try PNG (lossless, good for small files)
    const pngData = encodeGrayscalePNG(cfaData, width, height);
    candidates.push({ data: pngData, format: COMPRESSION.PNG });

    // Try the base lossy compression
    let lossyData;
    if (baseCompression === COMPRESSION.WEBP) {
        lossyData = encodeGrayscaleWebP(cfaData, width, height, quality);
    } else {
        lossyData = encodeGrayscaleJPEG(cfaData, width, height, quality);
    }
    candidates.push({ data: lossyData, format: baseCompression });

    // Try Micro format (only for non-compact standard CFA data)
    // Micro works best for small images and is lossless
    if (!isCompact && width * height < 2000000) { // Under ~2MP
        try {
            const microData = await encodeMicro(cfaData, width, height);
            candidates.push({ data: microData, format: COMPRESSION.MICRO });
        } catch (err) {
            console.warn('Micro encoding failed:', err);
        }
    }

    // Find smallest
    let best = candidates[0];
    for (const candidate of candidates) {
        if (candidate.data.length < best.data.length) {
            best = candidate;
        }
    }

    console.log(`Adaptive compression comparison:
  PNG: ${pngData.length} bytes
  ${baseCompression.toUpperCase()}: ${lossyData.length} bytes
  ${!isCompact && width * height < 2000000 ? `MICRO: ${candidates.find(c => c.format === COMPRESSION.MICRO)?.data.length || 'N/A'} bytes` : 'MICRO: skipped'}
  → Selected: ${best.format.toUpperCase()} (${best.data.length} bytes)`);

    return best;
}

/**
 * Detect compression format from data magic bytes.
 *
 * @param {Uint8Array} data - Encoded image data
 * @returns {string} Detected format: 'jpeg', 'png', 'webp', or 'micro'
 */
function detectCompressionFormat(data) {
    if (data.length < 4) return COMPRESSION.JPEG; // fallback

    // Micro format: starts with "uCFA"
    if (data[0] === MICRO_MAGIC[0] && data[1] === MICRO_MAGIC[1] &&
        data[2] === MICRO_MAGIC[2] && data[3] === MICRO_MAGIC[3]) {
        return COMPRESSION.MICRO;
    }

    // JPEG: starts with 0xFF 0xD8
    if (data[0] === 0xFF && data[1] === 0xD8) {
        return COMPRESSION.JPEG;
    }

    // PNG: starts with 0x89 0x50 0x4E 0x47 (‰PNG)
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
        return COMPRESSION.PNG;
    }

    // WebP: starts with RIFF....WEBP
    if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) {
        // Check for WEBP at offset 8
        if (data.length >= 12 && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
            return COMPRESSION.WEBP;
        }
    }

    return COMPRESSION.JPEG; // fallback
}

/**
 * Decode grayscale image (JPEG, PNG, or WebP) back to single-channel data.
 * Auto-detects format from magic bytes.
 *
 * @param {Uint8Array} imageData - Encoded image data
 * @returns {Promise<{data: Uint8Array, width: number, height: number}>}
 */
function decodeGrayscaleImage(imageData) {
    return new Promise((resolve, reject) => {
        // Detect format for correct MIME type
        const format = detectCompressionFormat(imageData);
        let mimeType;
        switch (format) {
            case COMPRESSION.PNG:
                mimeType = 'image/png';
                break;
            case COMPRESSION.WEBP:
                mimeType = 'image/webp';
                break;
            default:
                mimeType = 'image/jpeg';
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

            const canvasData = ctx.getImageData(0, 0, img.width, img.height);
            const cfaData = new Uint8Array(img.width * img.height);

            // Extract just the red channel (R=G=B in grayscale)
            for (let i = 0; i < cfaData.length; i++) {
                cfaData[i] = canvasData.data[i * 4];
            }

            URL.revokeObjectURL(url);
            resolve({
                data: cfaData,
                width: img.width,
                height: img.height
            });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to decode image'));
        };
        img.src = url;
    });
}

// Legacy alias for backwards compatibility
const decodeGrayscaleJPEG = decodeGrayscaleImage;

/**
 * Encode CFA data to .mosaic format.
 *
 * @param {Uint8Array} cfaData - Single-channel CFA array (standard or compact)
 * @param {number} width - Original image width
 * @param {number} height - Original image height
 * @param {Object} options - Encoding options
 * @param {number} options.quality - Compression quality (1-100), default 85
 * @param {number} options.pattern - Bayer pattern (0=RGGB), default 0
 * @param {boolean} options.compactMode - If true, data is compact RG-B format
 * @param {boolean} options.adaptive - If true, auto-select smallest format (PNG vs lossy vs micro)
 * @param {string} options.baseCompression - Base lossy format: 'jpeg' or 'webp', default 'jpeg'
 * @returns {Promise<Uint8Array>} Complete .mosaic file data
 */
async function encodeMosaic(cfaData, width, height, options = {}) {
    const quality = options.quality || 85;
    const pattern = options.pattern || PATTERN.RGGB;
    const compactMode = options.compactMode || false;
    const adaptive = options.adaptive !== false; // Default to true
    const baseCompression = options.baseCompression || COMPRESSION.JPEG;

    let encodedData;
    let usedFormat;

    // Prepare data dimensions
    let encodeWidth, encodeHeight, dataToEncode;

    if (compactMode) {
        // Compact mode: data is smaller than W×H
        // Reshape to a rectangle for encoding
        const dataLength = cfaData.length;
        encodeWidth = width;
        encodeHeight = Math.ceil(dataLength / width);

        // Create padded data to fill the rectangle
        dataToEncode = new Uint8Array(encodeWidth * encodeHeight);
        dataToEncode.set(cfaData);
        // Padding bytes remain 0
    } else {
        // Standard mode: W×H data
        encodeWidth = width;
        encodeHeight = height;
        dataToEncode = cfaData;
    }

    // Encode with selected method
    if (adaptive) {
        // Try multiple formats, pick smallest (including Micro for small images)
        const result = await encodeAdaptive(dataToEncode, encodeWidth, encodeHeight, quality, baseCompression, compactMode);
        encodedData = result.data;
        usedFormat = result.format;
    } else {
        // Use specified base compression only
        if (baseCompression === COMPRESSION.WEBP) {
            encodedData = encodeGrayscaleWebP(dataToEncode, encodeWidth, encodeHeight, quality);
        } else if (baseCompression === COMPRESSION.PNG) {
            encodedData = encodeGrayscalePNG(dataToEncode, encodeWidth, encodeHeight);
        } else {
            encodedData = encodeGrayscaleJPEG(dataToEncode, encodeWidth, encodeHeight, quality);
        }
        usedFormat = baseCompression;
    }

    // Log compression choice
    console.log(`Mosaic encoding: ${usedFormat.toUpperCase()} selected (${encodedData.length} bytes)`);

    // Use encodedData instead of jpegData from here
    const jpegData = encodedData; // Keep variable name for minimal changes below

    // Calculate CRC-32 of JPEG data
    const crc = calculateCRC32(jpegData);

    // Create header + JPEG data
    const totalSize = HEADER_SIZE + jpegData.length;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Write header
    // Magic "MOSA"
    bytes[0] = MOSAIC_MAGIC[0];
    bytes[1] = MOSAIC_MAGIC[1];
    bytes[2] = MOSAIC_MAGIC[2];
    bytes[3] = MOSAIC_MAGIC[3];

    // Version
    bytes[4] = MOSAIC_VERSION;

    // Pattern
    bytes[5] = pattern;

    // Width (little-endian 16-bit) - always original dimensions
    view.setUint16(6, width, true);

    // Height (little-endian 16-bit) - always original dimensions
    view.setUint16(8, height, true);

    // Quality
    bytes[10] = quality;

    // Mode flag (was reserved byte)
    bytes[11] = compactMode ? MODE.COMPACT : MODE.STANDARD;

    // JPEG data length (little-endian 32-bit)
    view.setUint32(12, jpegData.length, true);

    // CRC-32 (little-endian 32-bit)
    view.setUint32(16, crc, true);

    // Copy JPEG data
    bytes.set(jpegData, HEADER_SIZE);

    return bytes;
}

/**
 * Decode .mosaic format to CFA data.
 *
 * @param {Uint8Array} mosaicData - Complete .mosaic file data
 * @returns {Promise<{cfaData: Uint8Array, width: number, height: number, pattern: number, quality: number, compactMode: boolean}>}
 */
async function decodeMosaic(mosaicData) {
    // Validate minimum size
    if (mosaicData.length < HEADER_SIZE) {
        throw new Error('Invalid .mosaic file: too small');
    }

    const view = new DataView(mosaicData.buffer, mosaicData.byteOffset, mosaicData.byteLength);

    // Validate magic
    if (mosaicData[0] !== MOSAIC_MAGIC[0] ||
        mosaicData[1] !== MOSAIC_MAGIC[1] ||
        mosaicData[2] !== MOSAIC_MAGIC[2] ||
        mosaicData[3] !== MOSAIC_MAGIC[3]) {
        throw new Error('Invalid .mosaic file: bad magic');
    }

    // Read header
    const version = mosaicData[4];
    if (version !== MOSAIC_VERSION) {
        throw new Error(`Unsupported .mosaic version: ${version}`);
    }

    const pattern = mosaicData[5];
    const width = view.getUint16(6, true);
    const height = view.getUint16(8, true);
    const quality = mosaicData[10];
    const modeFlag = mosaicData[11];  // Was reserved byte
    const jpegLength = view.getUint32(12, true);
    const storedCRC = view.getUint32(16, true);

    const isCompact = (modeFlag === MODE.COMPACT);

    // Validate file size
    if (mosaicData.length < HEADER_SIZE + jpegLength) {
        throw new Error('Invalid .mosaic file: truncated');
    }

    // Extract encoded data
    const encodedData = mosaicData.slice(HEADER_SIZE, HEADER_SIZE + jpegLength);

    // Validate CRC
    const calculatedCRC = calculateCRC32(encodedData);
    if (calculatedCRC !== storedCRC) {
        throw new Error('Invalid .mosaic file: CRC mismatch');
    }

    // Detect format and decode accordingly
    const format = detectCompressionFormat(encodedData);
    let cfaData;

    if (format === COMPRESSION.MICRO) {
        // Micro format: Bayer-planar delta encoding
        const decoded = await decodeMicro(encodedData);
        cfaData = decoded.cfaData;

        // Micro format doesn't need compact expansion - it stores full CFA
        if (isCompact) {
            console.warn('Micro format used with compact flag - ignoring compact flag');
        }
    } else {
        // Standard image formats (JPEG/PNG/WebP)
        const decoded = await decodeGrayscaleJPEG(encodedData);

        if (isCompact) {
            // Compact mode: extract only the compact data size, then expand
            const compactSize = Mosaicing.getCompactSize(width, height);

            // Take only the first compactSize bytes (rest is padding)
            const compactData = decoded.data.slice(0, compactSize);

            // Expand back to full RGGB CFA
            cfaData = Mosaicing.expandCompactCFA(compactData, width, height);
        } else {
            // Standard mode: validate dimensions match
            if (decoded.width !== width || decoded.height !== height) {
                console.warn('Dimension mismatch in .mosaic file, using header values');
            }
            cfaData = decoded.data;
        }
    }

    return {
        cfaData: cfaData,
        width: width,
        height: height,
        pattern: pattern,
        quality: quality,
        compactMode: isCompact
    };
}

/**
 * Get file size comparison statistics.
 *
 * @param {Uint8Array} cfaData - Original CFA data
 * @param {Uint8Array} mosaicData - Encoded .mosaic data
 * @returns {Object} Size statistics
 */
function getSizeStats(cfaData, mosaicData) {
    const originalSize = cfaData.length;
    const compressedSize = mosaicData.length;
    const ratio = originalSize / compressedSize;
    const savings = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    return {
        originalSize,
        compressedSize,
        ratio: ratio.toFixed(2),
        savingsPercent: savings
    };
}

// Export for use in other modules
window.MosaicFormat = {
    PATTERN,
    MODE,
    COMPRESSION,
    HEADER_SIZE,
    MICRO_HEADER_SIZE,
    encodeMosaic,
    decodeMosaic,
    getSizeStats,
    calculateCRC32,
    detectCompressionFormat,
    encodeAdaptive,
    // Micro format functions
    encodeMicro,
    decodeMicro,
    isMicroFormat,
    // Planar utilities
    separateBayerPlanes,
    combineBayerPlanes
};
