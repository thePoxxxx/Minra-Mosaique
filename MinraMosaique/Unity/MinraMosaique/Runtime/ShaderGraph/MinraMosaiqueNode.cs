using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

#if UNITY_EDITOR
using UnityEditor.ShaderGraph;
using UnityEditor.ShaderGraph.Internal;
#endif

namespace Minra.Mosaique
{
    /// <summary>
    /// Custom Shader Graph node that demosaics a combined Bayer CFA texture
    /// into 3 separate output images.
    /// </summary>
#if UNITY_EDITOR
    [Title("Minra", "Minra Mosaique")]
#endif
    [Serializable]
    public class MinraMosaiqueNode
#if UNITY_EDITOR
        : CodeFunctionNode
#endif
    {
#if UNITY_EDITOR
        public enum DemosaicAlgorithm
        {
            [Tooltip("Fast 3x3 interpolation. Good quality for most use cases. Lower GPU cost.")]
            Bilinear,

            [Tooltip("Malvar-He-Cutler: High-quality 5x5 gradient-corrected interpolation. Better edge preservation at higher GPU cost.")]
            MalvarHeCutler
        }

        [SerializeField]
        private DemosaicAlgorithm _algorithm = DemosaicAlgorithm.Bilinear;

        public DemosaicAlgorithm Algorithm
        {
            get => _algorithm;
            set
            {
                if (_algorithm != value)
                {
                    _algorithm = value;
                    Dirty(ModificationScope.Graph);
                }
            }
        }

        public MinraMosaiqueNode()
        {
            name = "Minra Mosaique";
        }

        public override bool hasPreview => true;

        protected override MethodInfo GetFunctionToConvert()
        {
            switch (_algorithm)
            {
                case DemosaicAlgorithm.MalvarHeCutler:
                    return GetType().GetMethod(nameof(MinraDemosaicMHC),
                        System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.NonPublic);
                default:
                    return GetType().GetMethod(nameof(MinraDemosaicBilinear),
                        System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.NonPublic);
            }
        }

        static string MinraDemosaicBilinear(
            [Slot(0, Binding.None, ShaderStageCapability.Fragment)]
            Texture2D CombinedTexture,
            [Slot(1, Binding.None, ShaderStageCapability.Fragment)]
            SamplerState Sampler,
            [Slot(2, Binding.MeshUV0)]
            Vector2 UV,
            [Slot(3, Binding.None, ShaderStageCapability.Fragment)]
            out Vector3 Image1,
            [Slot(4, Binding.None, ShaderStageCapability.Fragment)]
            out Vector3 Image2,
            [Slot(5, Binding.None, ShaderStageCapability.Fragment)]
            out Vector3 Image3)
        {
            Image1 = Vector3.zero;
            Image2 = Vector3.zero;
            Image3 = Vector3.zero;

            return @"
{
    // Get texture dimensions
    float width, height;
    CombinedTexture.GetDimensions(width, height);
    int2 texSize = int2(width, height);
    int2 pos = int2(UV * texSize);

    // Bayer pattern detection
    bool evenRow = (pos.y & 1) == 0;
    bool evenCol = (pos.x & 1) == 0;

    // Process each channel
    for (int channel = 0; channel < 3; channel++)
    {
        // Sample neighbors with clamp-to-edge
        float center = CombinedTexture.Load(int3(clamp(pos, int2(0,0), texSize-1), 0))[channel];
        float top = CombinedTexture.Load(int3(clamp(pos + int2(0,-1), int2(0,0), texSize-1), 0))[channel];
        float bottom = CombinedTexture.Load(int3(clamp(pos + int2(0,1), int2(0,0), texSize-1), 0))[channel];
        float left = CombinedTexture.Load(int3(clamp(pos + int2(-1,0), int2(0,0), texSize-1), 0))[channel];
        float right = CombinedTexture.Load(int3(clamp(pos + int2(1,0), int2(0,0), texSize-1), 0))[channel];
        float topLeft = CombinedTexture.Load(int3(clamp(pos + int2(-1,-1), int2(0,0), texSize-1), 0))[channel];
        float topRight = CombinedTexture.Load(int3(clamp(pos + int2(1,-1), int2(0,0), texSize-1), 0))[channel];
        float bottomLeft = CombinedTexture.Load(int3(clamp(pos + int2(-1,1), int2(0,0), texSize-1), 0))[channel];
        float bottomRight = CombinedTexture.Load(int3(clamp(pos + int2(1,1), int2(0,0), texSize-1), 0))[channel];

        float R, G, B;

        if (evenRow && evenCol)
        {
            R = center;
            G = (top + bottom + left + right) * 0.25;
            B = (topLeft + topRight + bottomLeft + bottomRight) * 0.25;
        }
        else if (evenRow && !evenCol)
        {
            R = (left + right) * 0.5;
            G = center;
            B = (top + bottom) * 0.5;
        }
        else if (!evenRow && evenCol)
        {
            R = (top + bottom) * 0.5;
            G = center;
            B = (left + right) * 0.5;
        }
        else
        {
            R = (topLeft + topRight + bottomLeft + bottomRight) * 0.25;
            G = (top + bottom + left + right) * 0.25;
            B = center;
        }

        if (channel == 0) Image1 = float3(R, G, B);
        else if (channel == 1) Image2 = float3(R, G, B);
        else Image3 = float3(R, G, B);
    }
}";
        }

        static string MinraDemosaicMHC(
            [Slot(0, Binding.None, ShaderStageCapability.Fragment)]
            Texture2D CombinedTexture,
            [Slot(1, Binding.None, ShaderStageCapability.Fragment)]
            SamplerState Sampler,
            [Slot(2, Binding.MeshUV0)]
            Vector2 UV,
            [Slot(3, Binding.None, ShaderStageCapability.Fragment)]
            out Vector3 Image1,
            [Slot(4, Binding.None, ShaderStageCapability.Fragment)]
            out Vector3 Image2,
            [Slot(5, Binding.None, ShaderStageCapability.Fragment)]
            out Vector3 Image3)
        {
            Image1 = Vector3.zero;
            Image2 = Vector3.zero;
            Image3 = Vector3.zero;

            return @"
{
    // Get texture dimensions
    float width, height;
    CombinedTexture.GetDimensions(width, height);
    int2 texSize = int2(width, height);
    int2 pos = int2(UV * texSize);

    // Helper function for mirror boundary
    #define MIRROR(p, s) (p < 0 ? -p : (p >= s ? 2*s - p - 2 : p))
    #define SAMPLE(dx, dy, ch) CombinedTexture.Load(int3(clamp(int2(MIRROR(pos.x+dx, texSize.x), MIRROR(pos.y+dy, texSize.y)), int2(0,0), texSize-1), 0))[ch]

    bool evenRow = (pos.y & 1) == 0;
    bool evenCol = (pos.x & 1) == 0;

    for (int channel = 0; channel < 3; channel++)
    {
        // Sample 5x5 neighborhood
        float c = SAMPLE(0, 0, channel);
        float n = SAMPLE(0, -1, channel);
        float s = SAMPLE(0, 1, channel);
        float w = SAMPLE(-1, 0, channel);
        float e = SAMPLE(1, 0, channel);
        float nw = SAMPLE(-1, -1, channel);
        float ne = SAMPLE(1, -1, channel);
        float sw = SAMPLE(-1, 1, channel);
        float se = SAMPLE(1, 1, channel);
        float n2 = SAMPLE(0, -2, channel);
        float s2 = SAMPLE(0, 2, channel);
        float w2 = SAMPLE(-2, 0, channel);
        float e2 = SAMPLE(2, 0, channel);

        float R, G, B;

        if (evenRow && evenCol)
        {
            R = c;
            G = (4.0 * c + 2.0 * (n + s + w + e) - (n2 + s2 + w2 + e2)) / 8.0;
            B = (6.0 * c + 2.0 * (nw + ne + sw + se) - 1.5 * (n2 + s2 + w2 + e2)) / 8.0;
        }
        else if (evenRow && !evenCol)
        {
            G = c;
            R = (4.0 * c + 2.0 * (w + e) - 0.5 * (n2 + s2 + w2 + e2)) / 8.0;
            B = (4.0 * c + 2.0 * (n + s) - 0.5 * (n2 + s2 + w2 + e2)) / 8.0;
        }
        else if (!evenRow && evenCol)
        {
            G = c;
            R = (4.0 * c + 2.0 * (n + s) - 0.5 * (n2 + s2 + w2 + e2)) / 8.0;
            B = (4.0 * c + 2.0 * (w + e) - 0.5 * (n2 + s2 + w2 + e2)) / 8.0;
        }
        else
        {
            B = c;
            G = (4.0 * c + 2.0 * (n + s + w + e) - (n2 + s2 + w2 + e2)) / 8.0;
            R = (6.0 * c + 2.0 * (nw + ne + sw + se) - 1.5 * (n2 + s2 + w2 + e2)) / 8.0;
        }

        float3 result = saturate(float3(R, G, B));
        if (channel == 0) Image1 = result;
        else if (channel == 1) Image2 = result;
        else Image3 = result;
    }

    #undef MIRROR
    #undef SAMPLE
}";
        }

        public override void GenerateNodeCode(ShaderStringBuilder sb, GenerationMode generationMode)
        {
            base.GenerateNodeCode(sb, generationMode);
        }
#endif
    }
}
