# Minra Mosaique - Game Engine Plugins

GPU-accelerated Bayer demosaicing nodes for Unity Shader Graph and Unreal Material Editor. Decode combined CFA images into 3 separate texture outputs.

## Overview

Minra Mosaique encodes 3 full-color images into a single file using Bayer CFA (Color Filter Array) mosaicing. Each input image is converted to a single-channel CFA using the RGGB pattern, and the 3 CFAs are stored in the R, G, B channels of one output image.

This plugin provides nodes to reverse this process: extract each channel as a CFA and apply demosaicing to reconstruct the original images.

## Features

| Feature | Specification |
|---------|---------------|
| **Unity Target** | Shader Graph (URP/HDRP) |
| **Unreal Target** | Custom Material Expression |
| **Input Formats** | PNG (RGB channels) + MSQ3 |
| **Processing Modes** | Runtime (GPU shader) + Editor-time baking |
| **Algorithms** | Bilinear (fast) / Malvar-He-Cutler (high quality) |
| **Outputs** | 3 generic images (Image 1, Image 2, Image 3) |

## Installation

### Unity (UPM Package)

1. Open Package Manager (Window > Package Manager)
2. Click "+" > "Add package from disk..."
3. Navigate to `Unity/MinraMosaique/package.json`
4. Click "Open"

Or add to `manifest.json`:
```json
{
  "dependencies": {
    "com.minra.mosaique": "file:path/to/MinraMosaique/Unity/MinraMosaique"
  }
}
```

### Unreal Engine

1. Copy the `Unreal/MinraMosaique` folder to your project's `Plugins` directory
2. Restart Unreal Editor
3. Enable the plugin in Edit > Plugins > Minra Mosaique

## Usage

### Unity Shader Graph

1. Create or open a Shader Graph
2. Right-click > Create Node > Minra > Minra Mosaique
3. Connect your combined texture to "Combined Texture"
4. Use Image1, Image2, Image3 outputs in your material

### Unreal Material Editor

1. Open a Material
2. Right-click > search "Minra Mosaique"
3. Add the node and connect inputs
4. Route outputs to material channels

## Algorithms

### Bilinear (Default)
- **Neighborhood:** 3x3
- **Performance:** Fast
- **Quality:** Good for most use cases
- **Tooltip:** "Fast 3x3 interpolation. Good quality for most use cases. Lower GPU cost."

### Malvar-He-Cutler (MHC)
- **Neighborhood:** 5x5
- **Performance:** Moderate
- **Quality:** Excellent edge preservation
- **Tooltip:** "High-quality 5x5 gradient-corrected interpolation. Better edge preservation at higher GPU cost."

## Baking (Zero Runtime Cost)

For optimal performance, pre-compute demosaiced textures:

**Unity:**
1. Select your MinraDemosaicTexture asset
2. In the Inspector, click "Bake to Textures"
3. Choose output folder
4. Use baked textures directly

**Unreal:**
1. Window > Minra > Mosaique Bake Utility
2. Assign combined texture
3. Select algorithm and output path
4. Click "Bake Textures"

## MSQ3 Format

Custom binary format for efficient storage:

```
Header (14 bytes):
├── Magic: "MSQ3" (4 bytes)
├── Version: uint8 (1 byte)
├── Width: uint32 LE (4 bytes)
├── Height: uint32 LE (4 bytes)
└── Quality: uint8 (1 byte)

Data:
├── R channel: [size:uint32][WebP blob]
├── G channel: [size:uint32][WebP blob]
└── B channel: [size:uint32][WebP blob]
```

**Note:** MSQ3 uses WebP compression. Full decoding requires integrating a WebP library. For guaranteed compatibility, use PNG format.

## Project Structure

```
MinraMosaique/
├── Unity/
│   └── MinraMosaique/          # UPM package
│       ├── Runtime/            # Shaders and scripts
│       └── Editor/             # Import and bake tools
├── Unreal/
│   └── MinraMosaique/          # UE plugin
│       ├── Source/             # C++ modules
│       └── Shaders/            # USF shaders
└── Shared/
    └── Documentation/          # Algorithm reference
```

## Error Handling

Invalid inputs display a magenta checkerboard fallback texture with console warning:
> "Minra Mosaique: Invalid input texture. Expected combined Bayer CFA image."

## License

Copyright Minra. See LICENSE for details.

## References

- Malvar, H.S., He, L., Cutler, R. (2004). "High-Quality Linear Interpolation for Demosaicing of Bayer-Patterned Color Images."
- Bayer, B.E. (1976). "Color imaging array." U.S. Patent 3,971,065.
