using UnityEngine;

namespace Minra.Mosaique
{
    /// <summary>
    /// ScriptableObject that holds a combined Bayer CFA texture and provides
    /// demosaiced output textures. Can be used for editor-time baking or
    /// runtime GPU demosaicing.
    /// </summary>
    [CreateAssetMenu(fileName = "MinraDemosaicTexture", menuName = "Minra/Demosaic Texture")]
    public class MinraDemosaicTexture : ScriptableObject
    {
        /// <summary>
        /// Demosaicing algorithm to use.
        /// </summary>
        public enum DemosaicAlgorithm
        {
            /// <summary>
            /// Fast 3x3 interpolation. Good quality for most use cases.
            /// </summary>
            [Tooltip("Fast 3x3 interpolation. Good quality for most use cases. Lower GPU cost.")]
            Bilinear,

            /// <summary>
            /// High-quality 5x5 gradient-corrected interpolation.
            /// Better edge preservation at higher GPU cost.
            /// </summary>
            [Tooltip("Malvar-He-Cutler: High-quality 5x5 gradient-corrected interpolation. Better edge preservation at higher GPU cost.")]
            MalvarHeCutler
        }

        [Header("Input")]
        [Tooltip("Input texture containing 3 Bayer CFA patterns stored in RGB channels. Supports PNG or MSQ3 format.")]
        [SerializeField]
        private Texture2D _combinedTexture;

        [Tooltip("Demosaicing algorithm to use for reconstruction.")]
        [SerializeField]
        private DemosaicAlgorithm _algorithm = DemosaicAlgorithm.Bilinear;

        [Header("Baked Outputs (Editor-Time)")]
        [Tooltip("Demosaiced output image reconstructed from the R channel CFA pattern.")]
        [SerializeField]
        private Texture2D _bakedImage1;

        [Tooltip("Demosaiced output image reconstructed from the G channel CFA pattern.")]
        [SerializeField]
        private Texture2D _bakedImage2;

        [Tooltip("Demosaiced output image reconstructed from the B channel CFA pattern.")]
        [SerializeField]
        private Texture2D _bakedImage3;

        [Header("Preview Cache")]
        [SerializeField, HideInInspector]
        private Texture2D _previewImage1;
        [SerializeField, HideInInspector]
        private Texture2D _previewImage2;
        [SerializeField, HideInInspector]
        private Texture2D _previewImage3;

        /// <summary>
        /// The combined input texture containing 3 CFA patterns in RGB channels.
        /// </summary>
        public Texture2D CombinedTexture
        {
            get => _combinedTexture;
            set => _combinedTexture = value;
        }

        /// <summary>
        /// The demosaicing algorithm to use.
        /// </summary>
        public DemosaicAlgorithm Algorithm
        {
            get => _algorithm;
            set => _algorithm = value;
        }

        /// <summary>
        /// Baked output texture for Image 1 (from R channel).
        /// </summary>
        public Texture2D BakedImage1 => _bakedImage1;

        /// <summary>
        /// Baked output texture for Image 2 (from G channel).
        /// </summary>
        public Texture2D BakedImage2 => _bakedImage2;

        /// <summary>
        /// Baked output texture for Image 3 (from B channel).
        /// </summary>
        public Texture2D BakedImage3 => _bakedImage3;

        /// <summary>
        /// Preview texture for Image 1 (editor use).
        /// </summary>
        public Texture2D PreviewImage1 => _previewImage1;

        /// <summary>
        /// Preview texture for Image 2 (editor use).
        /// </summary>
        public Texture2D PreviewImage2 => _previewImage2;

        /// <summary>
        /// Preview texture for Image 3 (editor use).
        /// </summary>
        public Texture2D PreviewImage3 => _previewImage3;

        /// <summary>
        /// Whether the combined texture is valid and ready for processing.
        /// </summary>
        public bool IsValid => _combinedTexture != null &&
                               _combinedTexture.width > 0 &&
                               _combinedTexture.height > 0;

        /// <summary>
        /// Whether baked textures are available.
        /// </summary>
        public bool HasBakedTextures => _bakedImage1 != null &&
                                        _bakedImage2 != null &&
                                        _bakedImage3 != null;

        /// <summary>
        /// Gets the appropriate output texture, preferring baked if available.
        /// </summary>
        public Texture2D GetImage1() => _bakedImage1 != null ? _bakedImage1 : _previewImage1;
        public Texture2D GetImage2() => _bakedImage2 != null ? _bakedImage2 : _previewImage2;
        public Texture2D GetImage3() => _bakedImage3 != null ? _bakedImage3 : _previewImage3;

#if UNITY_EDITOR
        /// <summary>
        /// Sets the baked output textures. Editor-only.
        /// </summary>
        public void SetBakedTextures(Texture2D image1, Texture2D image2, Texture2D image3)
        {
            _bakedImage1 = image1;
            _bakedImage2 = image2;
            _bakedImage3 = image3;
            UnityEditor.EditorUtility.SetDirty(this);
        }

        /// <summary>
        /// Sets the preview textures. Editor-only.
        /// </summary>
        public void SetPreviewTextures(Texture2D image1, Texture2D image2, Texture2D image3)
        {
            _previewImage1 = image1;
            _previewImage2 = image2;
            _previewImage3 = image3;
        }

        /// <summary>
        /// Clears the baked textures. Editor-only.
        /// </summary>
        public void ClearBakedTextures()
        {
            _bakedImage1 = null;
            _bakedImage2 = null;
            _bakedImage3 = null;
            UnityEditor.EditorUtility.SetDirty(this);
        }
#endif

        private void OnValidate()
        {
            // Validation happens in the editor inspector
        }

        /// <summary>
        /// Creates an error/fallback texture for invalid inputs.
        /// </summary>
        public static Texture2D CreateFallbackTexture(int width = 64, int height = 64)
        {
            Texture2D fallback = new Texture2D(width, height, TextureFormat.RGB24, false);
            Color[] pixels = new Color[width * height];

            // Magenta/black checkerboard pattern
            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    bool isEven = ((x / 8) + (y / 8)) % 2 == 0;
                    pixels[y * width + x] = isEven ? Color.magenta : Color.black;
                }
            }

            fallback.SetPixels(pixels);
            fallback.Apply();
            fallback.name = "MinraMosaique_Fallback";

            return fallback;
        }
    }
}
