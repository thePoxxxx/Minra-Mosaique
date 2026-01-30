// Minra Mosaique - Bilinear Demosaicing Shader
// Fast 3x3 interpolation for Bayer RGGB pattern
// Good quality for most use cases with lower GPU cost

#ifndef MINRA_BILINEAR_DEMOSAIC_INCLUDED
#define MINRA_BILINEAR_DEMOSAIC_INCLUDED

#include "ChannelExtract.hlsl"

// Bayer RGGB Pattern:
// Even rows: R G R G R G ...
// Odd rows:  G B G B G B ...
//
// Position detection:
// (0,0)=R, (1,0)=G, (0,1)=G, (1,1)=B
// evenRow = (y & 1) == 0
// evenCol = (x & 1) == 0

// Sample CFA value with clamp-to-edge boundary handling
float SampleCFA(Texture2D tex, int2 pos, int2 texSize, int channel)
{
    // Clamp to valid texture coordinates
    pos = clamp(pos, int2(0, 0), texSize - int2(1, 1));
    return GetCFAValue(tex, pos, channel);
}

// Bilinear demosaicing for a single channel
// Returns RGB color reconstructed from the CFA pattern
float3 BilinearDemosaic(Texture2D tex, int2 pos, int2 texSize, int channel)
{
    bool evenRow = (pos.y & 1) == 0;
    bool evenCol = (pos.x & 1) == 0;

    float R, G, B;

    // Sample the center pixel
    float center = SampleCFA(tex, pos, texSize, channel);

    // Sample neighbors
    float top    = SampleCFA(tex, pos + int2(0, -1), texSize, channel);
    float bottom = SampleCFA(tex, pos + int2(0,  1), texSize, channel);
    float left   = SampleCFA(tex, pos + int2(-1, 0), texSize, channel);
    float right  = SampleCFA(tex, pos + int2( 1, 0), texSize, channel);

    float topLeft     = SampleCFA(tex, pos + int2(-1, -1), texSize, channel);
    float topRight    = SampleCFA(tex, pos + int2( 1, -1), texSize, channel);
    float bottomLeft  = SampleCFA(tex, pos + int2(-1,  1), texSize, channel);
    float bottomRight = SampleCFA(tex, pos + int2( 1,  1), texSize, channel);

    if (evenRow && evenCol)
    {
        // Position is R (native red)
        R = center;
        G = (top + bottom + left + right) * 0.25;
        B = (topLeft + topRight + bottomLeft + bottomRight) * 0.25;
    }
    else if (evenRow && !evenCol)
    {
        // Position is G on R row (green on red row)
        R = (left + right) * 0.5;
        G = center;
        B = (top + bottom) * 0.5;
    }
    else if (!evenRow && evenCol)
    {
        // Position is G on B row (green on blue row)
        R = (top + bottom) * 0.5;
        G = center;
        B = (left + right) * 0.5;
    }
    else
    {
        // Position is B (native blue)
        R = (topLeft + topRight + bottomLeft + bottomRight) * 0.25;
        G = (top + bottom + left + right) * 0.25;
        B = center;
    }

    return float3(R, G, B);
}

// Bilinear demosaicing using UV coordinates
float3 BilinearDemosaicUV(Texture2D tex, SamplerState samp, float2 uv, float2 texelSize, int channel)
{
    // Convert UV to pixel coordinates
    int2 texSize = int2(1.0 / texelSize);
    int2 pos = int2(uv * texSize);

    return BilinearDemosaic(tex, pos, texSize, channel);
}

// Process all three channels and output three demosaiced images
void BilinearDemosaicAll(
    Texture2D tex,
    int2 pos,
    int2 texSize,
    out float3 image1,
    out float3 image2,
    out float3 image3)
{
    image1 = BilinearDemosaic(tex, pos, texSize, 0); // Red channel -> Image 1
    image2 = BilinearDemosaic(tex, pos, texSize, 1); // Green channel -> Image 2
    image3 = BilinearDemosaic(tex, pos, texSize, 2); // Blue channel -> Image 3
}

// Process all three channels using UV coordinates
void BilinearDemosaicAllUV(
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

    BilinearDemosaicAll(tex, pos, texSize, image1, image2, image3);
}

#endif // MINRA_BILINEAR_DEMOSAIC_INCLUDED
