// Minra Mosaique - Malvar-He-Cutler Demosaicing Shader
// High-quality 5x5 gradient-corrected interpolation
// Better edge preservation at higher GPU cost

#ifndef MINRA_MHC_DEMOSAIC_INCLUDED
#define MINRA_MHC_DEMOSAIC_INCLUDED

#include "ChannelExtract.hlsl"

// Bayer RGGB Pattern:
// Even rows: R G R G R G ...
// Odd rows:  G B G B G B ...

// Sample CFA value with mirror reflection boundary handling
float SampleCFAMirror(Texture2D tex, int2 pos, int2 texSize, int channel)
{
    // Mirror reflection at boundaries
    if (pos.x < 0) pos.x = -pos.x;
    if (pos.y < 0) pos.y = -pos.y;
    if (pos.x >= texSize.x) pos.x = 2 * texSize.x - pos.x - 2;
    if (pos.y >= texSize.y) pos.y = 2 * texSize.y - pos.y - 2;

    // Final clamp for safety
    pos = clamp(pos, int2(0, 0), texSize - int2(1, 1));

    return GetCFAValue(tex, pos, channel);
}

// Malvar-He-Cutler demosaicing for a single channel
// Uses 5x5 gradient-corrected kernels for high-quality interpolation
float3 MHCDemosaic(Texture2D tex, int2 pos, int2 texSize, int channel)
{
    bool evenRow = (pos.y & 1) == 0;
    bool evenCol = (pos.x & 1) == 0;

    float R, G, B;

    // Sample 5x5 neighborhood
    float p[5][5];
    for (int dy = -2; dy <= 2; dy++)
    {
        for (int dx = -2; dx <= 2; dx++)
        {
            p[dy + 2][dx + 2] = SampleCFAMirror(tex, pos + int2(dx, dy), texSize, channel);
        }
    }

    // Shorthand for common positions
    float c = p[2][2];  // Center

    // Cross neighbors
    float n = p[1][2];  // North
    float s = p[3][2];  // South
    float w = p[2][1];  // West
    float e = p[2][3];  // East

    // Diagonal neighbors
    float nw = p[1][1];
    float ne = p[1][3];
    float sw = p[3][1];
    float se = p[3][3];

    // Extended cross (2 pixels away)
    float n2 = p[0][2];
    float s2 = p[4][2];
    float w2 = p[2][0];
    float e2 = p[2][4];

    // Extended diagonal (for some kernels)
    float nw2_h = p[1][0];  // 2 west of north
    float ne2_h = p[1][4];  // 2 east of north
    float sw2_h = p[3][0];  // 2 west of south
    float se2_h = p[3][4];  // 2 east of south

    float nw2_v = p[0][1];  // 2 north of west
    float ne2_v = p[0][3];  // 2 north of east
    float sw2_v = p[4][1];  // 2 south of west
    float se2_v = p[4][3];  // 2 south of east

    if (evenRow && evenCol)
    {
        // Position is R (native red)
        // R is known
        R = c;

        // G at R location: kernel weights [-1, 2, -1; 2, 4, 2; -1, 2, -1] / 8
        // Plus gradient correction
        G = (4.0 * c + 2.0 * (n + s + w + e) - (n2 + s2 + w2 + e2)) / 8.0;

        // B at R location: kernel weights [1.5, 0, -3, 0, 1.5; 0, 0, 0, 0, 0; -3, 0, 12, 0, -3; ...]
        // Simplified: average of diagonals with gradient correction
        B = (6.0 * c + 2.0 * (nw + ne + sw + se) - 1.5 * (n2 + s2 + w2 + e2)) / 8.0;
    }
    else if (evenRow && !evenCol)
    {
        // Position is G on R row
        // G is known
        G = c;

        // R at G (on R row): horizontal neighbors with vertical gradient correction
        R = (5.0 * c + 4.0 * (w + e) - (n + s + w2 + e2 + nw2_h + ne2_h + sw2_h + se2_h) * 0.5) / 8.0;

        // B at G (on R row): vertical neighbors with horizontal gradient correction
        B = (5.0 * c + 4.0 * (n + s) - (w + e + n2 + s2 + nw2_v + ne2_v + sw2_v + se2_v) * 0.5) / 8.0;
    }
    else if (!evenRow && evenCol)
    {
        // Position is G on B row
        // G is known
        G = c;

        // R at G (on B row): vertical neighbors with horizontal gradient correction
        R = (5.0 * c + 4.0 * (n + s) - (w + e + n2 + s2 + nw2_v + ne2_v + sw2_v + se2_v) * 0.5) / 8.0;

        // B at G (on B row): horizontal neighbors with vertical gradient correction
        B = (5.0 * c + 4.0 * (w + e) - (n + s + w2 + e2 + nw2_h + ne2_h + sw2_h + se2_h) * 0.5) / 8.0;
    }
    else
    {
        // Position is B (native blue)
        // B is known
        B = c;

        // G at B location: same as G at R location
        G = (4.0 * c + 2.0 * (n + s + w + e) - (n2 + s2 + w2 + e2)) / 8.0;

        // R at B location: same pattern as B at R location
        R = (6.0 * c + 2.0 * (nw + ne + sw + se) - 1.5 * (n2 + s2 + w2 + e2)) / 8.0;
    }

    // Clamp to valid range
    return saturate(float3(R, G, B));
}

// MHC demosaicing using UV coordinates
float3 MHCDemosaicUV(Texture2D tex, SamplerState samp, float2 uv, float2 texelSize, int channel)
{
    int2 texSize = int2(1.0 / texelSize);
    int2 pos = int2(uv * texSize);

    return MHCDemosaic(tex, pos, texSize, channel);
}

// Process all three channels and output three demosaiced images
void MHCDemosaicAll(
    Texture2D tex,
    int2 pos,
    int2 texSize,
    out float3 image1,
    out float3 image2,
    out float3 image3)
{
    image1 = MHCDemosaic(tex, pos, texSize, 0); // Red channel -> Image 1
    image2 = MHCDemosaic(tex, pos, texSize, 1); // Green channel -> Image 2
    image3 = MHCDemosaic(tex, pos, texSize, 2); // Blue channel -> Image 3
}

// Process all three channels using UV coordinates
void MHCDemosaicAllUV(
    Texture2D tex,
    SamplerState samp,
    float2 uv,
    float2 texelSize,
    out float3 image1,
    out float3 image2,
    out float3 image3)
{
    int2 texSize = int2(1.0 / texelSize);
    int2 pos = int2(uv * texSize);

    MHCDemosaicAll(tex, pos, texSize, image1, image2, image3);
}

#endif // MINRA_MHC_DEMOSAIC_INCLUDED
