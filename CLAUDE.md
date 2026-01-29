# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Minra-Mosaique is a full-stack Bayer CFA (Color Filter Array) simulator for image mosaicing and demosaicing. Users upload images, which are converted to a simulated Bayer mosaic pattern, then reconstructed using various demosaicing algorithms with real-time quality metrics (PSNR/SSIM).

## Development Commands

### Backend (Python/FastAPI)
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Unix
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend (React/Vite)
```bash
cd frontend
npm install
npm run dev      # Dev server on port 5173 (proxies /api to backend)
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

## Architecture

### Data Flow
1. User uploads image via `ImageUploader` component
2. `POST /api/upload` sends image to backend
3. Backend applies RGGB Bayer mosaic, creates CFA (single-channel), generates colorized visualization
4. Demosaics with Malvar-He-Cutler algorithm (default), calculates PSNR/SSIM vs original
5. Returns session ID + base64 data URLs for all images
6. User can switch algorithms → `POST /api/demosaic` re-processes same CFA
7. Export options: `.mosaic` (custom compressed format) or PNG

### Backend Structure (`backend/app/`)
- `main.py` - FastAPI app with CORS, mounts `images` and `export` routers
- `core/mosaicing.py` - `apply_bayer_mosaic()`, colorized view generation
- `core/demosaicing.py` - Three algorithms: nearest_neighbor, bilinear, malvar_he_cutler
- `core/metrics.py` - PSNR (dB) and SSIM calculation using skimage
- `core/mosaic_format.py` - Custom `.mosaic` binary format encode/decode
- `api/routes/images.py` - `/upload`, `/demosaic`, `/session/{id}` endpoints
- `api/routes/export.py` - `/export` endpoint
- `models/schemas.py` - Pydantic request/response models

### Frontend Structure (`frontend/src/`)
- `store/imageStore.ts` - Zustand store (session, images, algorithm, metrics, UI state)
- `hooks/useImageProcessing.ts` - API integration hook (upload, demosaic, export)
- `services/api.ts` - Axios client with `/api` base URL
- `components/` - ThreePanel, ImageUploader, AlgorithmToggle, MosaicViewToggle, ExportControls, QualityMetrics

### Session Storage
Backend stores uploaded images and CFA in an in-memory dict keyed by UUID. Sessions are cleared via `DELETE /api/session/{id}`.

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/upload` | POST | Upload image, returns mosaiced + reconstructed with metrics |
| `/api/demosaic` | POST | Re-demosaic session CFA with different algorithm |
| `/api/export` | POST | Export as `.mosaic` or PNG |
| `/api/session/{id}` | DELETE | Cleanup session memory |

## Demosaicing Algorithms

1. **Nearest Neighbor** - Fast, blocky results. Copies pixels to 2x2 blocks.
2. **Bilinear** - Uses 3x3 kernels, smoother but some color fringing.
3. **Malvar-He-Cutler** - Gradient-corrected 5x5 kernels, best quality (default).

## .mosaic File Format

Custom binary format with 20-byte header containing magic bytes, Bayer pattern, dimensions, JPEG quality, CRC-32, followed by grayscale JPEG-compressed CFA data. See `backend/app/core/mosaic_format.py` for implementation.

## Key Conventions

- **Backend**: Python snake_case, Pydantic validation, HTTPException for errors
- **Frontend**: TypeScript strict mode, CSS Modules, Zustand for state, camelCase
- **Images**: All transferred as base64 data URLs (PNG format)
- **Metrics**: PSNR in dB (higher = better), SSIM 0-1 (1 = identical)
