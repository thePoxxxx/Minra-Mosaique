using UnityEngine;
using UnityEditor;

namespace Minra.Mosaique.Editor
{
    /// <summary>
    /// Custom inspector for MinraDemosaicTexture assets.
    /// Shows preview thumbnails and baking controls.
    /// </summary>
    [CustomEditor(typeof(MinraDemosaicTexture))]
    public class MinraMosaiqueInspector : UnityEditor.Editor
    {
        private MinraDemosaicTexture _target;
        private SerializedProperty _combinedTextureProp;
        private SerializedProperty _algorithmProp;

        private Texture2D _previewImage1;
        private Texture2D _previewImage2;
        private Texture2D _previewImage3;
        private bool _previewsGenerated;

        private const int PREVIEW_SIZE = 128;

        private void OnEnable()
        {
            _target = (MinraDemosaicTexture)target;
            _combinedTextureProp = serializedObject.FindProperty("_combinedTexture");
            _algorithmProp = serializedObject.FindProperty("_algorithm");

            GeneratePreviews();
        }

        private void OnDisable()
        {
            CleanupPreviews();
        }

        public override void OnInspectorGUI()
        {
            serializedObject.Update();

            // Header
            EditorGUILayout.LabelField("Minra Mosaique", EditorStyles.boldLabel);
            EditorGUILayout.Space();

            // Validation warning
            if (!_target.IsValid)
            {
                EditorGUILayout.HelpBox(
                    "Invalid input texture. Expected combined Bayer CFA image with 3 channels.",
                    MessageType.Warning);
                EditorGUILayout.Space();
            }

            // Input section
            EditorGUILayout.LabelField("Input", EditorStyles.boldLabel);
            EditorGUI.BeginChangeCheck();
            EditorGUILayout.PropertyField(_combinedTextureProp,
                new GUIContent("Combined Texture",
                    "Input texture containing 3 Bayer CFA patterns stored in RGB channels. Supports PNG or MSQ3 format."));

            if (EditorGUI.EndChangeCheck())
            {
                serializedObject.ApplyModifiedProperties();
                GeneratePreviews();
            }

            // Combined texture preview
            if (_target.CombinedTexture != null)
            {
                EditorGUILayout.BeginHorizontal();
                GUILayout.FlexibleSpace();
                Rect previewRect = GUILayoutUtility.GetRect(PREVIEW_SIZE, PREVIEW_SIZE);
                EditorGUI.DrawPreviewTexture(previewRect, _target.CombinedTexture, null, ScaleMode.ScaleToFit);
                GUILayout.FlexibleSpace();
                EditorGUILayout.EndHorizontal();

                EditorGUILayout.LabelField(
                    $"Size: {_target.CombinedTexture.width} x {_target.CombinedTexture.height}",
                    EditorStyles.centeredGreyMiniLabel);
            }

            EditorGUILayout.Space();

            // Algorithm selection
            EditorGUILayout.LabelField("Settings", EditorStyles.boldLabel);
            EditorGUI.BeginChangeCheck();
            EditorGUILayout.PropertyField(_algorithmProp,
                new GUIContent("Algorithm", GetAlgorithmTooltip(_target.Algorithm)));

            if (EditorGUI.EndChangeCheck())
            {
                serializedObject.ApplyModifiedProperties();
                GeneratePreviews();
            }

            EditorGUILayout.Space();

            // Output previews
            EditorGUILayout.LabelField("Output Previews", EditorStyles.boldLabel);

            if (_target.IsValid && _previewsGenerated)
            {
                EditorGUILayout.BeginHorizontal();
                GUILayout.FlexibleSpace();

                // Image 1
                EditorGUILayout.BeginVertical(GUILayout.Width(PREVIEW_SIZE));
                if (_previewImage1 != null)
                {
                    Rect rect1 = GUILayoutUtility.GetRect(PREVIEW_SIZE, PREVIEW_SIZE);
                    EditorGUI.DrawPreviewTexture(rect1, _previewImage1, null, ScaleMode.ScaleToFit);
                }
                EditorGUILayout.LabelField("Image 1 (R)", EditorStyles.centeredGreyMiniLabel);
                EditorGUILayout.EndVertical();

                GUILayout.Space(8);

                // Image 2
                EditorGUILayout.BeginVertical(GUILayout.Width(PREVIEW_SIZE));
                if (_previewImage2 != null)
                {
                    Rect rect2 = GUILayoutUtility.GetRect(PREVIEW_SIZE, PREVIEW_SIZE);
                    EditorGUI.DrawPreviewTexture(rect2, _previewImage2, null, ScaleMode.ScaleToFit);
                }
                EditorGUILayout.LabelField("Image 2 (G)", EditorStyles.centeredGreyMiniLabel);
                EditorGUILayout.EndVertical();

                GUILayout.Space(8);

                // Image 3
                EditorGUILayout.BeginVertical(GUILayout.Width(PREVIEW_SIZE));
                if (_previewImage3 != null)
                {
                    Rect rect3 = GUILayoutUtility.GetRect(PREVIEW_SIZE, PREVIEW_SIZE);
                    EditorGUI.DrawPreviewTexture(rect3, _previewImage3, null, ScaleMode.ScaleToFit);
                }
                EditorGUILayout.LabelField("Image 3 (B)", EditorStyles.centeredGreyMiniLabel);
                EditorGUILayout.EndVertical();

                GUILayout.FlexibleSpace();
                EditorGUILayout.EndHorizontal();
            }
            else
            {
                EditorGUILayout.HelpBox("Assign a combined texture to see output previews.", MessageType.Info);
            }

            EditorGUILayout.Space();

            // Baking section
            EditorGUILayout.LabelField("Baking", EditorStyles.boldLabel);

            if (_target.HasBakedTextures)
            {
                EditorGUILayout.HelpBox("Baked textures are available. These will be used at runtime (zero GPU cost).", MessageType.Info);

                EditorGUILayout.BeginHorizontal();
                if (GUILayout.Button("Clear Baked Textures"))
                {
                    _target.ClearBakedTextures();
                }
                EditorGUILayout.EndHorizontal();
            }

            EditorGUI.BeginDisabledGroup(!_target.IsValid);
            if (GUILayout.Button(new GUIContent("Bake to Textures",
                "Process the combined texture and save 3 separate texture files. Zero runtime cost.")))
            {
                BakeTextures();
            }
            EditorGUI.EndDisabledGroup();

            serializedObject.ApplyModifiedProperties();
        }

        private string GetAlgorithmTooltip(MinraDemosaicTexture.DemosaicAlgorithm algorithm)
        {
            switch (algorithm)
            {
                case MinraDemosaicTexture.DemosaicAlgorithm.MalvarHeCutler:
                    return "Malvar-He-Cutler: High-quality 5x5 gradient-corrected interpolation. Better edge preservation at higher GPU cost.";
                default:
                    return "Fast 3x3 interpolation. Good quality for most use cases. Lower GPU cost.";
            }
        }

        private void GeneratePreviews()
        {
            CleanupPreviews();

            if (!_target.IsValid || _target.CombinedTexture == null)
            {
                _previewsGenerated = false;
                return;
            }

            Texture2D source = _target.CombinedTexture;

            // Make sure the texture is readable
            if (!source.isReadable)
            {
                _previewsGenerated = false;
                return;
            }

            int width = source.width;
            int height = source.height;

            // Generate demosaiced previews (scaled to PREVIEW_SIZE)
            _previewImage1 = GenerateDemosaicedPreview(source, width, height, 0);
            _previewImage2 = GenerateDemosaicedPreview(source, width, height, 1);
            _previewImage3 = GenerateDemosaicedPreview(source, width, height, 2);

            _previewsGenerated = true;
        }

        private Texture2D GenerateDemosaicedPreview(Texture2D source, int width, int height, int channel)
        {
            // Create preview at reduced size for performance
            float scale = Mathf.Min(1f, (float)PREVIEW_SIZE / Mathf.Max(width, height));
            int previewWidth = Mathf.Max(1, Mathf.RoundToInt(width * scale));
            int previewHeight = Mathf.Max(1, Mathf.RoundToInt(height * scale));

            Texture2D preview = new Texture2D(previewWidth, previewHeight, TextureFormat.RGB24, false);
            Color[] sourcePixels = source.GetPixels();
            Color[] previewPixels = new Color[previewWidth * previewHeight];

            for (int py = 0; py < previewHeight; py++)
            {
                for (int px = 0; px < previewWidth; px++)
                {
                    // Map preview pixel to source pixel
                    int sx = Mathf.RoundToInt((float)px / previewWidth * width);
                    int sy = Mathf.RoundToInt((float)py / previewHeight * height);
                    sx = Mathf.Clamp(sx, 0, width - 1);
                    sy = Mathf.Clamp(sy, 0, height - 1);

                    // Simple bilinear demosaic for preview
                    Color rgb = DemosaicPixelBilinear(sourcePixels, width, height, sx, sy, channel);
                    previewPixels[py * previewWidth + px] = rgb;
                }
            }

            preview.SetPixels(previewPixels);
            preview.Apply();
            return preview;
        }

        private Color DemosaicPixelBilinear(Color[] pixels, int width, int height, int x, int y, int channel)
        {
            bool evenRow = (y & 1) == 0;
            bool evenCol = (x & 1) == 0;

            float GetChannel(int px, int py)
            {
                px = Mathf.Clamp(px, 0, width - 1);
                py = Mathf.Clamp(py, 0, height - 1);
                Color c = pixels[py * width + px];
                return channel == 0 ? c.r : (channel == 1 ? c.g : c.b);
            }

            float center = GetChannel(x, y);
            float top = GetChannel(x, y - 1);
            float bottom = GetChannel(x, y + 1);
            float left = GetChannel(x - 1, y);
            float right = GetChannel(x + 1, y);
            float topLeft = GetChannel(x - 1, y - 1);
            float topRight = GetChannel(x + 1, y - 1);
            float bottomLeft = GetChannel(x - 1, y + 1);
            float bottomRight = GetChannel(x + 1, y + 1);

            float R, G, B;

            if (evenRow && evenCol)
            {
                R = center;
                G = (top + bottom + left + right) * 0.25f;
                B = (topLeft + topRight + bottomLeft + bottomRight) * 0.25f;
            }
            else if (evenRow && !evenCol)
            {
                R = (left + right) * 0.5f;
                G = center;
                B = (top + bottom) * 0.5f;
            }
            else if (!evenRow && evenCol)
            {
                R = (top + bottom) * 0.5f;
                G = center;
                B = (left + right) * 0.5f;
            }
            else
            {
                R = (topLeft + topRight + bottomLeft + bottomRight) * 0.25f;
                G = (top + bottom + left + right) * 0.25f;
                B = center;
            }

            return new Color(R, G, B);
        }

        private void CleanupPreviews()
        {
            if (_previewImage1 != null) DestroyImmediate(_previewImage1);
            if (_previewImage2 != null) DestroyImmediate(_previewImage2);
            if (_previewImage3 != null) DestroyImmediate(_previewImage3);

            _previewImage1 = null;
            _previewImage2 = null;
            _previewImage3 = null;
            _previewsGenerated = false;
        }

        private void BakeTextures()
        {
            string folder = EditorUtility.OpenFolderPanel("Save Baked Textures", "Assets", "");
            if (string.IsNullOrEmpty(folder))
                return;

            // Convert to relative path
            if (folder.StartsWith(Application.dataPath))
            {
                folder = "Assets" + folder.Substring(Application.dataPath.Length);
            }
            else
            {
                EditorUtility.DisplayDialog("Error", "Please select a folder inside the Assets directory.", "OK");
                return;
            }

            MinraBakeWindow.BakeTextures(_target, folder);
        }
    }
}
