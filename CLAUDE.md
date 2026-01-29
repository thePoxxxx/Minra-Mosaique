# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Guidelines

**IMPORTANT:** When working on UI/UX improvements or building new interface components, **heavily involve the Frontend Design skill** (`/frontend-design`). This ensures:
- High design quality with distinctive aesthetics
- Proper implementation of the scientific instrument theme
- Production-grade, polished interfaces
- Avoidance of generic AI aesthetics

## Implementation Plans

Reference these plans for future development:
- `docs/PLAN-1-MOSAIQUE-TAB.md` - Combine 3 images into 1 (4-column layout)
- `docs/PLAN-2-DEMOSAIQUE-TAB.md` - Split 1 image into 3 (3-column layout)

## Project Overview

Minra-Mosaique is a standalone web tool for combining and splitting images using Bayer CFA (Color Filter Array) mosaicing technology. It encodes 3 full-color images into 1 file and reconstructs them back to 3 separate images.

**Key concept:** Each input image is converted to a single-channel CFA using the RGGB Bayer pattern. The 3 CFAs are then stored in the R, G, B channels of one output image. To recover the images, extract each channel as a CFA and apply demosaicing.

## File Structure

```
Minra-Mosaique/
├── index.html          # Single standalone HTML file (no backend required)
├── CLAUDE.md           # Project documentation
├── backend/            # DEPRECATED (legacy testing ground)
└── frontend/           # DEPRECATED (legacy testing ground)
```

## How to Use

1. Open `index.html` directly in any modern browser
2. No server, build step, or installation required

### Mosaique Tab (Combine 3 → 1)
1. Upload 3 images of the same dimensions
2. Each image is converted to a Bayer CFA (grayscale preview shown)
3. CFAs are combined into RGB channels of one image
4. Export as PNG (lossless) or MSQ3 (per-channel compressed)

### De-Mosaique Tab (Split 1 → 3)
1. Upload a combined image (PNG) or MSQ3 file
2. R, G, B channels are extracted as CFAs
3. Select demosaicing algorithm (NN / Bilinear / Malvar-He-Cutler)
4. Save reconstructed images individually or all at once

## Technical Details

### Bayer Pattern (RGGB)
```
Even rows: R G R G R G ...
Odd rows:  G B G B G B ...
```
- 50% green, 25% red, 25% blue (matches human visual sensitivity)

### Export Formats

| Format | Compression | Color Bleed | Use Case |
|--------|-------------|-------------|----------|
| PNG | Lossless | None | Archival, maximum quality |
| MSQ3 | Per-channel WebP | None | Smaller files, adjustable quality |
| J2K | Per-channel JPEG 2000 | None | Experimental, per-channel lossless (fallback) |

**Why per-channel formats instead of JPEG?**
JPEG uses chroma subsampling (4:2:0) which stores color at half resolution. When CFAs are stored in RGB channels and JPEG-compressed, the G and B channels get "smeared", causing color bleed during demosaicing. MSQ3 and J2K compress each channel separately as grayscale images, avoiding this issue entirely.

**Note on J2K:** True JPEG 2000 encoding requires an external library (OpenJPEG.js). The current implementation uses a fallback mode with per-channel PNG compression to demonstrate the concept. This can be upgraded to true J2K with OpenJPEG.js when needed.

### MSQ3 File Format

Custom binary format for storing 3 CFA channels with per-channel WebP compression.

```
Header (14 bytes):
├── Magic: "MSQ3" (4 bytes)
├── Version: uint8 (1 byte)
├── Width: uint32 LE (4 bytes)
├── Height: uint32 LE (4 bytes)
└── Quality: uint8 (1 byte)

Data:
├── R channel size: uint32 LE (4 bytes)
├── R channel data: WebP blob
├── G channel size: uint32 LE (4 bytes)
├── G channel data: WebP blob
├── B channel size: uint32 LE (4 bytes)
└── B channel data: WebP blob
```

### J2K File Format (Experimental)

Custom binary format for storing 3 CFA channels with per-channel compression (PNG fallback or JPEG 2000).

```
Header (15 bytes):
├── Magic: "J2K3" (4 bytes)
├── Version: uint8 (1 byte)
├── Width: uint32 LE (4 bytes)
├── Height: uint32 LE (4 bytes)
├── Quality: uint8 (1 byte)
└── Flags: uint8 (1 byte) - 0=PNG fallback, 1=true J2K

Data:
├── R channel size: uint32 LE (4 bytes)
├── R channel data: PNG or JP2 blob
├── G channel size: uint32 LE (4 bytes)
├── G channel data: PNG or JP2 blob
├── B channel size: uint32 LE (4 bytes)
└── B channel data: PNG or JP2 blob
```

### Demosaicing Algorithms

| Algorithm | Quality | Speed | Technique |
|-----------|---------|-------|-----------|
| Nearest Neighbor (NN) | Low | Fast | Copy 2x2 blocks |
| Bilinear | Medium | Medium | 3x3 interpolation |
| Malvar-He-Cutler (MHC) | High | Slower | 5x5 gradient-corrected kernels |

### JavaScript Classes

```javascript
BayerMosaicProcessor
├── applyMosaic(imageData)              // RGB → CFA
├── generateGrayscaleView(cfa, w, h)    // CFA → grayscale canvas
└── generateColorizedView(cfa, w, h)    // CFA → colorized canvas

ImageCombiner
├── combine(cfaR, cfaG, cfaB, w, h)     // 3 CFAs → RGB canvas
└── extractChannel(imageData, channel)  // RGB → single CFA

Demosaicing
├── nearestNeighbor(cfa, w, h)          // Fast, blocky
├── bilinear(cfa, w, h)                 // Smooth, some fringing
├── malvarHeCutler(cfa, w, h)           // Best quality
└── demosaic(cfa, w, h, algorithm)      // Dispatcher

FileHandler
├── loadImage(file)                      // File → ImageData
├── exportToBlob(canvas, format, quality)
└── downloadBlob(blob, filename)

MSQ3Format
├── encode(cfaR, cfaG, cfaB, w, h, q)   // 3 CFAs → MSQ3 blob
├── decode(file)                         // MSQ3 file → 3 CFAs
└── isMSQ3File(file)                     // Check file extension

J2KFormat
├── encode(cfaR, cfaG, cfaB, w, h, q)   // 3 CFAs → J2K blob (PNG fallback)
├── decode(file)                         // J2K file → 3 CFAs
└── isJ2KFile(file)                      // Check file extension

ZoomController
├── zoomIn() / zoomOut() / reset()      // Zoom controls
└── updateTransform()                    // Apply zoom/pan transforms
```

### Image Zoom

All image panels have a zoom button (⌕) that opens a full-screen modal for detailed inspection:
- **Scroll wheel:** Zoom in/out
- **Click and drag:** Pan around the image
- **Keyboard shortcuts:** `+`/`-` to zoom, `0` to reset, `Esc` to close
- **Zoom range:** 25% to 800%
- Displays image dimensions and current zoom level

## Key Conventions

- **Single file:** All HTML, CSS, and JavaScript are embedded in `index.html`
- **No dependencies:** Works offline, no CDN or external scripts
- **Browser-only:** All processing happens client-side using Canvas API
- **Dark theme:** Scientific instrument aesthetic with phosphor green (#00ff9d) accent

## Legacy Backend/Frontend

The `backend/` and `frontend/` directories contain the original Python/React implementation used for testing and development. They are no longer actively maintained but serve as reference for the algorithms.

### Legacy Commands (if needed)
```bash
# Backend (Python/FastAPI)
cd backend && python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (React/Vite)
cd frontend && npm install && npm run dev
```
