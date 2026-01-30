Minra Mosaique - Example Materials
===================================

This folder contains example materials demonstrating the Minra Mosaique plugin.

Setting Up a Material:
1. Create a new Material
2. Open the Material Editor
3. Right-click and search for "Minra" or "Demosaic"
4. Add the "Minra Mosaique" expression node
5. Connect a Texture Object node to the "Combined Texture" input
6. Connect the Image1, Image2, or Image3 outputs to material inputs

Node Properties:
- Algorithm: Select Bilinear (faster) or Malvar-He-Cutler (higher quality)

Inputs:
- Combined Texture: Texture2D containing 3 CFA patterns in RGB channels
- UVs: Optional UV coordinates (uses mesh UVs if not connected)

Outputs:
- Image 1: Demosaiced from R channel CFA
- Image 2: Demosaiced from G channel CFA
- Image 3: Demosaiced from B channel CFA

Example Connections:
- Image1 -> Base Color
- Image2 -> Normal (if storing normal map)
- Image3 -> Roughness/Metallic/AO mask

For Best Performance:
Use the Bake Utility to pre-compute demosaiced textures:
1. Open Window > Minra > Mosaique Bake Utility
2. Select your combined texture
3. Choose algorithm and output folder
4. Click "Bake Textures"
5. Use the baked textures directly (zero runtime cost)

Importing MSQ3 Files:
1. Drag .msq3 file into Content Browser
2. The file imports as a UMSQ3Asset
3. Use the asset in materials like a regular texture

Note: MSQ3 files use WebP compression for each channel. Full WebP decoding
requires integrating a WebP library. For full compatibility, use PNG format.
