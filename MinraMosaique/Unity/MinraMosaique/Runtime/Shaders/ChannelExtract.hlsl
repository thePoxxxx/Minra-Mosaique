// Minra Mosaique - Channel Extraction Shader
// Extracts individual RGB channels from a combined Bayer CFA texture

#ifndef MINRA_CHANNEL_EXTRACT_INCLUDED
#define MINRA_CHANNEL_EXTRACT_INCLUDED

// Extract the Red channel (CFA for Image 1)
float ExtractChannelR(float4 color)
{
    return color.r;
}

// Extract the Green channel (CFA for Image 2)
float ExtractChannelG(float4 color)
{
    return color.g;
}

// Extract the Blue channel (CFA for Image 3)
float ExtractChannelB(float4 color)
{
    return color.b;
}

// Extract all three channels at once
void ExtractAllChannels(float4 color, out float cfaR, out float cfaG, out float cfaB)
{
    cfaR = color.r;
    cfaG = color.g;
    cfaB = color.b;
}

// Sample and extract a specific channel from texture
float SampleChannel(Texture2D tex, SamplerState samp, float2 uv, int channel)
{
    float4 color = tex.Sample(samp, uv);

    if (channel == 0) return color.r;
    if (channel == 1) return color.g;
    return color.b;
}

// Get CFA value at a specific pixel position for a given channel
// This is used when we need to access the raw CFA data at integer coordinates
float GetCFAValue(Texture2D tex, int2 pos, int channel)
{
    float4 color = tex.Load(int3(pos, 0));

    if (channel == 0) return color.r;
    if (channel == 1) return color.g;
    return color.b;
}

#endif // MINRA_CHANNEL_EXTRACT_INCLUDED
