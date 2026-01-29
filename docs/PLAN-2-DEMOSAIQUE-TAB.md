# Plan 2: De-Mosaique Tab (Split 1 Image → 3)

## Overview
Extract and reconstruct 3 full-color images from 1 combined image using demosaicing algorithms.

## UI Layout (3-Column Wireframe)

```
┌─────────────────┬─────────────────────────┬─────────────────────────┐
│   Upload JPG    │     Show Mosaique       │   Show Reconstructions  │
│                 │                         │                         │
│  ┌─────────┐    │  ┌─────────┐            │  ┌─────────┐            │
│  │         │    │  │ R Chan  │ ──────────→│  │ Recon 1 │  [Save]    │
│  │Combined │    │  └─────────┘            │  └─────────┘            │
│  │  Image  │ ──┤│                         │                         │
│  │         │   ││  ┌─────────┐            │  ┌─────────┐            │
│  │         │   │├─→│ G Chan  │ ──────────→│  │ Recon 2 │  [Save]    │
│  └─────────┘   ││  └─────────┘            │  └─────────┘            │
│                ││                         │                         │
│                ││  ┌─────────┐            │  ┌─────────┐            │
│                │└─→│ B Chan  │ ──────────→│  │ Recon 3 │  [Save]    │
│                │   └─────────┘            │  └─────────┘            │
│                │                          │                         │
│                │  [Algorithm: NN/BL/MHC]  │  [Save All]             │
└─────────────────┴─────────────────────────┴─────────────────────────┘
```

**3-Column Layout:**
1. **Upload JPG** - Single upload slot for combined image
2. **Show Mosaique** - 3 extracted CFA channels (R/G/B) + Algorithm selector
3. **Show Reconstructions** - 3 demosaiced full-color images with individual save buttons

## Implementation Steps

### 1. HTML Structure
- Tab bar to switch between Mosaique/De-Mosaique
- Single upload dropzone for combined image
- Channel separation display (3 CFA panels showing R/G/B extraction)
- Algorithm toggle (NN / Bilinear / Malvar-He-Cutler)
- 3 reconstructed image panels with individual [Save] buttons
- "Save All" button at bottom

### 2. Channel Extraction
```javascript
function extractChannelsAsCFA(imageData) {
    cfaR[i] = data[i * 4];     // R channel → Image 1 CFA
    cfaG[i] = data[i * 4 + 1]; // G channel → Image 2 CFA
    cfaB[i] = data[i * 4 + 2]; // B channel → Image 3 CFA
}
```

### 3. Demosaicing Algorithms
Port from `backend/app/core/demosaicing.py`:

| Algorithm | Quality | Speed | Technique |
|-----------|---------|-------|-----------|
| Nearest Neighbor | Low | Fast | Copy 2x2 blocks |
| Bilinear | Medium | Medium | 3x3 convolution kernels |
| Malvar-He-Cutler | High | Slower | 5x5 gradient-corrected kernels |

#### Nearest Neighbor
```javascript
// Process 2x2 blocks
for (y = 0; y < height; y += 2) {
    for (x = 0; x < width; x += 2) {
        r = cfa[y][x]           // Red pixel
        g = (cfa[y][x+1] + cfa[y+1][x]) / 2  // Average greens
        b = cfa[y+1][x+1]       // Blue pixel
        // Fill entire 2x2 block with [r, g, b]
    }
}
```

#### Bilinear Interpolation
- Green at R/B locations: 4-neighbor average (cross pattern)
- R at G locations: 2-neighbor average (horizontal or vertical)
- B at G locations: 2-neighbor average (horizontal or vertical)
- R at B and B at R: 4-neighbor diagonal average

#### Malvar-He-Cutler (Best Quality)
Uses gradient-corrected 5x5 kernels that exploit cross-channel correlation:
- Kernel for G at R/B locations
- Kernel for R at G in B row, B at G in R row (horizontal)
- Kernel for R at G in R row, B at G in B row (vertical)
- Kernel for R at B and B at R locations (diagonal)

### 4. Processing Flow
```
Upload combined image → Extract R/G/B as CFAs
↓
Display CFA previews (grayscale)
↓
Select algorithm → Demosaic each CFA
↓
Display 3 reconstructed full-color images
↓
Save individually or all at once
```

### 5. Real-Time Algorithm Switching
- User selects algorithm → Re-run demosaicing on all 3 CFAs
- Update reconstructed image displays immediately
- No re-upload required

## UI/UX Requirements

### Upload Slot
- Single large dropzone
- Accepts any image format (PNG, JPG, WebP)
- Shows thumbnail preview when loaded
- Dimension info displayed below

### Channel Previews
- Color-coded badges (R = red, G = green, B = blue)
- Grayscale display of each CFA
- Visual flow arrows to reconstructions

### Algorithm Selector
- 3 buttons: NN, Bilinear, MHC
- MHC selected by default (best quality)
- Switching triggers immediate re-processing

### Reconstruction Previews
- Individual [Save] button for each image
- Numbered badges (Image 1, Image 2, Image 3)
- [Save All] button downloads all 3 as PNGs

## Design Notes

**Use Frontend Design Skill** for:
- Consistent styling with Mosaique tab
- Algorithm button group styling
- Visual connection between columns (flow indicators)
- Loading/processing states during demosaicing
- Responsive layout for tablet/mobile

## Acceptance Criteria

- [ ] Can upload combined image via drag-drop or click
- [ ] Extracts and displays R, G, B channels as CFAs
- [ ] Demosaics using selected algorithm
- [ ] Algorithm switch updates reconstructions in real-time
- [ ] Can save individual reconstructed images
- [ ] Can save all 3 images at once
- [ ] MHC produces visibly better quality than NN
- [ ] Works offline (no external dependencies)

## Algorithm Comparison (Expected Results)

When testing with the same combined image:

| Algorithm | Visual Quality | Artifacts |
|-----------|---------------|-----------|
| Nearest Neighbor | Blocky, pixelated | Visible 2x2 grid pattern |
| Bilinear | Smooth but soft | Color fringing at edges |
| Malvar-He-Cutler | Sharp, natural | Minimal artifacts |

## Performance Considerations

- NN is O(n) - fastest
- Bilinear is O(n) with more operations per pixel
- MHC is O(n) but with 5x5 kernel lookups per pixel
- For large images (4000x3000), MHC may take 1-2 seconds
- Consider adding a processing indicator for large images
