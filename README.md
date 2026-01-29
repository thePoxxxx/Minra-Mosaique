# Image DeMosaique

A web-based Bayer CFA (Color Filter Array) simulator demonstrating image mosaicing and demosaicing algorithms.

## Features

- **RGGB Bayer Mosaicing**: Converts RGB images to single-channel CFA data
- **Three Demosaicing Algorithms**:
  - Nearest Neighbor (fast, blocky)
  - Bilinear Interpolation (smooth, some artifacts)
  - Malvar-He-Cutler (gradient-corrected, best quality)
- **Real-time Algorithm Comparison**: Toggle between algorithms instantly
- **Quality Metrics**: PSNR and SSIM measurements
- **Custom .mosaic Format**: Single-channel file with JPEG compression
- **Three-Panel Visualization**: Original, Mosaiced, and Reconstructed side-by-side

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate
# Activate (Unix/Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

Open http://localhost:5173 in your browser.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload image, returns mosaiced + reconstructed |
| `/api/demosaic` | POST | Apply demosaicing with specified algorithm |
| `/api/export` | POST | Download mosaiced image (.mosaic or .png) |

## .mosaic File Format

Custom binary format with 20-byte header:

| Offset | Size | Field |
|--------|------|-------|
| 0x00 | 4B | Magic "MOSA" |
| 0x04 | 1B | Version |
| 0x05 | 1B | Bayer Pattern |
| 0x06 | 2B | Width |
| 0x08 | 2B | Height |
| 0x0A | 1B | JPEG Quality |
| 0x0B | 1B | Reserved |
| 0x0C | 4B | Data Length |
| 0x10 | 4B | CRC-32 |
| 0x14 | N | JPEG Data |

## Algorithms

### Malvar-He-Cutler

Gradient-corrected linear interpolation using four 5x5 convolution kernels. Reference: *"High-quality linear interpolation for demosaicing of Bayer-patterned color images"* (ICASSP 2004).

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Zustand
- **Backend**: Python, FastAPI, NumPy, OpenCV, Pillow
- **Metrics**: scikit-image (SSIM)

## License

MIT
