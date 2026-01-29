"""Custom .mosaic file format implementation.

File Structure (20-byte header + JPEG data):
    Offset  Size  Field
    0x00    4B    Magic "MOSA"
    0x04    1B    Version (0x01)
    0x05    1B    Pattern (0=RGGB, 1=BGGR, 2=GRBG, 3=GBRG)
    0x06    2B    Width (uint16, little-endian)
    0x08    2B    Height (uint16, little-endian)
    0x0A    1B    JPEG Quality (1-100)
    0x0B    1B    Reserved
    0x0C    4B    JPEG data length (uint32, little-endian)
    0x10    4B    CRC-32 checksum
    0x14    N     Grayscale JPEG compressed data
"""
import struct
import zlib
from io import BytesIO

import numpy as np
from PIL import Image


MOSAIC_MAGIC = b'MOSA'
MOSAIC_VERSION = 0x01
HEADER_SIZE = 20

BAYER_PATTERNS = {
    'RGGB': 0,
    'BGGR': 1,
    'GRBG': 2,
    'GBRG': 3
}

PATTERN_NAMES = {v: k for k, v in BAYER_PATTERNS.items()}


def encode_mosaic(
    cfa_data: np.ndarray,
    pattern: str = 'RGGB',
    quality: int = 85
) -> bytes:
    """
    Encode CFA data to .mosaic format.

    Args:
        cfa_data: 2D numpy array (H, W), single-channel CFA data
        pattern: Bayer pattern string ('RGGB', 'BGGR', 'GRBG', 'GBRG')
        quality: JPEG compression quality (1-100)

    Returns:
        Binary data for .mosaic file
    """
    if cfa_data.ndim != 2:
        raise ValueError("CFA data must be 2D array")

    if not 1 <= quality <= 100:
        raise ValueError("Quality must be between 1 and 100")

    height, width = cfa_data.shape

    if width > 65535 or height > 65535:
        raise ValueError("Image dimensions must be <= 65535")

    # Compress as grayscale JPEG
    img = Image.fromarray(cfa_data.astype(np.uint8), mode='L')
    jpeg_buffer = BytesIO()
    img.save(jpeg_buffer, format='JPEG', quality=quality)
    jpeg_data = jpeg_buffer.getvalue()

    # Calculate CRC-32
    crc = zlib.crc32(jpeg_data) & 0xFFFFFFFF

    # Get pattern ID
    pattern_id = BAYER_PATTERNS.get(pattern.upper(), 0)

    # Build header (20 bytes)
    # Format: 4s = 4-byte string, B = unsigned char, H = unsigned short, I = unsigned int
    header = struct.pack(
        '<4sBBHHBBII',
        MOSAIC_MAGIC,           # 4B: magic
        MOSAIC_VERSION,         # 1B: version
        pattern_id,             # 1B: pattern
        width,                  # 2B: width
        height,                 # 2B: height
        quality,                # 1B: quality
        0,                      # 1B: reserved
        len(jpeg_data),         # 4B: JPEG length
        crc                     # 4B: CRC-32
    )

    return header + jpeg_data


def decode_mosaic(data: bytes) -> tuple[np.ndarray, str, dict]:
    """
    Decode .mosaic format to CFA data.

    Args:
        data: Binary data from .mosaic file

    Returns:
        Tuple of (cfa_array, pattern_string, metadata_dict)

    Raises:
        ValueError: If file is invalid or corrupted
    """
    if len(data) < HEADER_SIZE:
        raise ValueError("File too small to be a valid .mosaic file")

    # Parse header
    magic = data[0:4]
    if magic != MOSAIC_MAGIC:
        raise ValueError(f"Invalid .mosaic file: bad magic number (got {magic!r})")

    # Unpack header fields
    (version, pattern_id, width, height,
     quality, reserved, jpeg_len, stored_crc) = struct.unpack(
        '<BBHHBBII', data[4:HEADER_SIZE]
    )

    if version != MOSAIC_VERSION:
        raise ValueError(f"Unsupported .mosaic version: {version}")

    # Verify we have enough data
    expected_size = HEADER_SIZE + jpeg_len
    if len(data) < expected_size:
        raise ValueError(f"File truncated: expected {expected_size} bytes, got {len(data)}")

    # Extract JPEG data
    jpeg_data = data[HEADER_SIZE:HEADER_SIZE + jpeg_len]

    # Verify CRC
    computed_crc = zlib.crc32(jpeg_data) & 0xFFFFFFFF
    if computed_crc != stored_crc:
        raise ValueError("CRC mismatch: file may be corrupted")

    # Decompress JPEG
    try:
        img = Image.open(BytesIO(jpeg_data))
        cfa = np.array(img)
    except Exception as e:
        raise ValueError(f"Failed to decode JPEG data: {e}")

    # Get pattern name
    pattern = PATTERN_NAMES.get(pattern_id, 'RGGB')

    metadata = {
        'version': version,
        'width': width,
        'height': height,
        'quality': quality,
        'jpeg_size': jpeg_len,
    }

    return cfa, pattern, metadata


def get_mosaic_info(data: bytes) -> dict:
    """
    Get metadata from a .mosaic file without fully decoding it.

    Args:
        data: Binary data from .mosaic file

    Returns:
        Dictionary with file metadata
    """
    if len(data) < HEADER_SIZE:
        raise ValueError("File too small")

    magic = data[0:4]
    if magic != MOSAIC_MAGIC:
        raise ValueError("Invalid .mosaic file")

    (version, pattern_id, width, height,
     quality, reserved, jpeg_len, crc) = struct.unpack(
        '<BBHHBBII', data[4:HEADER_SIZE]
    )

    return {
        'version': version,
        'pattern': PATTERN_NAMES.get(pattern_id, 'RGGB'),
        'width': width,
        'height': height,
        'quality': quality,
        'compressed_size': jpeg_len,
        'total_size': HEADER_SIZE + jpeg_len,
    }
