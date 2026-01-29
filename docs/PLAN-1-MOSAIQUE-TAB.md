# Plan 1: Mosaique Tab (Combine 3 Images → 1)

## Overview
Transform 3 full-color images into 1 combined image using Bayer CFA mosaicing technology.

## UI Layout (4-Column Wireframe)

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│  3 Image Upload │   Mosaiqued     │ Combined Image  │  Save As Menu   │
│     Fields      │                 │                 │                 │
├─────────────────┼─────────────────┤                 │  ┌───────────┐  │
│  ┌─────────┐    │  ┌─────────┐    │                 │  │ PNG/JPG/  │  │
│  │ Image 1 │ ──→│  │ Mosaic1 │ ──┐│  ┌─────────┐   │  │  WebP     │  │
│  └─────────┘    │  └─────────┘   ││  │         │   │  └───────────┘  │
│                 │                 ├┼─→│ Combined│ ──│                 │
│  ┌─────────┐    │  ┌─────────┐   ││  │  Image  │   │  Quality: ──●── │
│  │ Image 2 │ ──→│  │ Mosaic2 │ ──┤│  │         │   │                 │
│  └─────────┘    │  └─────────┘   ││  └─────────┘   │  Size: ~XXX KB  │
│                 │                 ││                │                 │
│  ┌─────────┐    │  ┌─────────┐   ││                │  ┌───────────┐  │
│  │ Image 3 │ ──→│  │ Mosaic3 │ ──┘│                │  │   SAVE    │  │
│  └─────────┘    │  └─────────┘    │                │  └───────────┘  │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

**4-Column Layout:**
1. **Upload Fields** - 3 vertical upload slots (drag-drop)
2. **Mosaiqued** - 3 CFA previews (BW/Color toggle above)
3. **Combined Image** - Single merged result
4. **Save As Menu** - Format selector, quality slider, file size estimate, Save button

## Implementation Steps

### 1. HTML Structure
- Header with logo, tab navigation, and Reset button
- 4-column grid layout matching wireframe
- Upload slots with drag-drop + click support
- Mosaic preview panels with BW/Color toggle
- Combined image display (larger, centered)
- Dedicated "Save As" panel with all export controls

### 2. JavaScript Classes
```javascript
BayerMosaicProcessor
├── applyMosaic(imageData) → Uint8Array CFA
├── generateGrayscaleView(cfa) → ImageData
└── generateColorizedView(cfa) → ImageData

ImageCombiner
├── combine(cfaR, cfaG, cfaB) → ImageData
└── extractChannel(combined, 'r'|'g'|'b') → ImageData

FileHandler
├── loadImage(file) → Promise<ImageData>
├── exportToBlob(canvas, format, quality) → Promise<Blob>
└── downloadBlob(blob, filename)
```

### 3. Processing Flow
```
Upload 3 images → Validate dimensions match
↓
Apply RGGB mosaic to each → 3 CFAs
↓
Combine CFAs into RGB channels → Combined image
↓
Display with channel toggle → Export with format/quality options
```

### 4. Bayer Mosaic Algorithm
Port from `backend/app/core/mosaicing.py`:

```javascript
// RGGB pattern:
// Even row: R G R G ...
// Odd row:  G B G B ...

cfa[evenRow][evenCol] = R channel
cfa[evenRow][oddCol]  = G channel
cfa[oddRow][evenCol]  = G channel
cfa[oddRow][oddCol]   = B channel
```

### 5. Export Options
- **Formats:** PNG (lossless), JPG, WebP
- **Quality slider:** 1-100% for JPG/WebP
- **Real-time file size estimate** via `canvas.toBlob()`

## UI/UX Requirements

### Upload Slots
- Drag-drop support with visual feedback (border color change)
- Click to open file picker
- Show thumbnail preview when image loaded
- Slot number badge (1, 2, 3)
- Remove button (X) on hover
- Dimension validation with error message for mismatches

### Mosaic Previews
- Channel badge (R, G, B) with color coding
- BW/Color toggle switch in panel header
- "Awaiting image" placeholder text

### Combined Preview
- Larger display area than individual previews
- Center the image with object-fit: contain

### Save Panel
- Format buttons (PNG highlighted by default)
- Quality slider (hidden for PNG, visible for JPG/WebP)
- File size estimate updates in real-time
- Save button disabled until all 3 images uploaded

## Design Notes

**Use Frontend Design Skill** for:
- Scientific instrument aesthetic
- Dark theme with phosphor green (#00ff9d) accent
- Subtle animations (hover states, loading states)
- Corner decorations and scan line effects
- Responsive breakpoints for smaller screens

## Acceptance Criteria

- [ ] Can upload 3 images via drag-drop or click
- [ ] Shows error if dimensions don't match
- [ ] Displays BW and Color mosaic views
- [ ] Generates combined image when all 3 uploaded
- [ ] Can export as PNG, JPG (with quality), WebP (with quality)
- [ ] File size estimate is reasonably accurate
- [ ] Reset button clears all state
- [ ] Works offline (no external dependencies)
