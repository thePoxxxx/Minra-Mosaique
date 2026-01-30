using System.IO;
using UnityEngine;
using UnityEditor;
using UnityEditor.AssetImporters;

namespace Minra.Mosaique.Editor
{
    /// <summary>
    /// Custom asset importer for MSQ3 files.
    /// Imports MSQ3 files as MinraDemosaicTexture assets with preview generation.
    /// </summary>
    [ScriptedImporter(1, "msq3")]
    public class MSQ3Importer : ScriptedImporter
    {
        [Tooltip("Demosaicing algorithm to use for preview and baking.")]
        public MinraDemosaicTexture.DemosaicAlgorithm algorithm = MinraDemosaicTexture.DemosaicAlgorithm.Bilinear;

        [Tooltip("Automatically generate preview thumbnails on import.")]
        public bool generatePreviews = true;

        [Tooltip("Preview thumbnail size (width and height).")]
        [Range(64, 512)]
        public int previewSize = 128;

        public override void OnImportAsset(AssetImportContext ctx)
        {
            // Read the MSQ3 file
            byte[] fileData = File.ReadAllBytes(ctx.assetPath);
            MSQ3Decoder.MSQ3Data msq3Data = MSQ3Decoder.Decode(fileData);

            if (msq3Data == null || !msq3Data.IsValid)
            {
                // Create error asset
                ctx.LogImportError("Failed to decode MSQ3 file. Invalid format or corrupted data.");

                var errorAsset = ScriptableObject.CreateInstance<MinraDemosaicTexture>();
                errorAsset.name = Path.GetFileNameWithoutExtension(ctx.assetPath);
                ctx.AddObjectToAsset("main", errorAsset);
                ctx.SetMainObject(errorAsset);
                return;
            }

            // Create the main asset
            var demosaicTexture = ScriptableObject.CreateInstance<MinraDemosaicTexture>();
            demosaicTexture.name = Path.GetFileNameWithoutExtension(ctx.assetPath);
            demosaicTexture.Algorithm = algorithm;

            // Since Unity doesn't natively support WebP, we need to handle this specially.
            // For now, create placeholder textures that indicate the dimensions.
            // In a production environment, you would integrate a WebP decoder.

            // Create a combined texture from the MSQ3 data
            // Note: This requires WebP decoding which Unity doesn't support natively
            Texture2D combinedTexture = CreatePlaceholderTexture(msq3Data.Width, msq3Data.Height);
            combinedTexture.name = "CombinedTexture";

            demosaicTexture.CombinedTexture = combinedTexture;

            // Add the combined texture as a sub-asset
            ctx.AddObjectToAsset("combined", combinedTexture);

            if (generatePreviews)
            {
                // Generate preview thumbnails
                var preview1 = GeneratePreviewTexture(msq3Data.Width, msq3Data.Height, 0);
                var preview2 = GeneratePreviewTexture(msq3Data.Width, msq3Data.Height, 1);
                var preview3 = GeneratePreviewTexture(msq3Data.Width, msq3Data.Height, 2);

                preview1.name = "Preview_Image1";
                preview2.name = "Preview_Image2";
                preview3.name = "Preview_Image3";

                ctx.AddObjectToAsset("preview1", preview1);
                ctx.AddObjectToAsset("preview2", preview2);
                ctx.AddObjectToAsset("preview3", preview3);

                demosaicTexture.SetPreviewTextures(preview1, preview2, preview3);
            }

            // Set the main object
            ctx.AddObjectToAsset("main", demosaicTexture);
            ctx.SetMainObject(demosaicTexture);

            // Add metadata
            ctx.LogImportWarning($"MSQ3 file imported. Dimensions: {msq3Data.Width}x{msq3Data.Height}, Quality: {msq3Data.Quality}. " +
                               "Note: WebP channel decoding requires external library integration.");
        }

        private Texture2D CreatePlaceholderTexture(int width, int height)
        {
            // Create a placeholder texture showing the file is MSQ3 format
            // In production, you would decode the WebP channels here
            Texture2D tex = new Texture2D(width, height, TextureFormat.RGB24, true);

            Color[] pixels = new Color[width * height];
            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    // Create a gradient pattern to indicate it's a placeholder
                    float r = (float)x / width;
                    float g = (float)y / height;
                    float b = 0.5f;
                    pixels[y * width + x] = new Color(r, g, b);
                }
            }

            tex.SetPixels(pixels);
            tex.Apply(true);
            return tex;
        }

        private Texture2D GeneratePreviewTexture(int srcWidth, int srcHeight, int channel)
        {
            // Generate a scaled preview thumbnail
            int size = Mathf.Min(previewSize, Mathf.Max(srcWidth, srcHeight));
            Texture2D preview = new Texture2D(size, size, TextureFormat.RGB24, false);

            Color[] pixels = new Color[size * size];
            Color channelColor = channel == 0 ? Color.red : (channel == 1 ? Color.green : Color.blue);

            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    // Create a gradient indicating which channel this represents
                    float intensity = ((float)x / size + (float)y / size) * 0.5f;
                    pixels[y * size + x] = Color.Lerp(Color.black, channelColor, intensity);
                }
            }

            preview.SetPixels(pixels);
            preview.Apply();
            return preview;
        }
    }

    /// <summary>
    /// Custom editor for the MSQ3 importer settings.
    /// </summary>
    [CustomEditor(typeof(MSQ3Importer))]
    public class MSQ3ImporterEditor : ScriptedImporterEditor
    {
        public override void OnInspectorGUI()
        {
            EditorGUILayout.HelpBox(
                "MSQ3 files contain 3 WebP-compressed Bayer CFA patterns. " +
                "Unity requires external WebP decoding for full functionality. " +
                "Consider using PNG workflow for native support.",
                MessageType.Info);

            EditorGUILayout.Space();

            base.OnInspectorGUI();
        }
    }
}
