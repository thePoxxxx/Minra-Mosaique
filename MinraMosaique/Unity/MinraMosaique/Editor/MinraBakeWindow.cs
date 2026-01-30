using System.IO;
using UnityEngine;
using UnityEditor;

namespace Minra.Mosaique.Editor
{
    /// <summary>
    /// Editor window for batch baking demosaiced textures.
    /// Processes combined CFA textures and outputs 3 separate texture files.
    /// </summary>
    public class MinraBakeWindow : EditorWindow
    {
        private Texture2D _inputTexture;
        private MinraDemosaicTexture.DemosaicAlgorithm _algorithm = MinraDemosaicTexture.DemosaicAlgorithm.Bilinear;
        private string _outputFolder = "Assets";
        private string _outputPrefix = "Demosaiced";
        private bool _generateMipmaps = true;

        private Vector2 _scrollPosition;

        [MenuItem("Window/Minra/Mosaique Bake Window")]
        public static void ShowWindow()
        {
            var window = GetWindow<MinraBakeWindow>();
            window.titleContent = new GUIContent("Minra Mosaique Bake");
            window.minSize = new Vector2(400, 300);
            window.Show();
        }

        private void OnGUI()
        {
            _scrollPosition = EditorGUILayout.BeginScrollView(_scrollPosition);

            EditorGUILayout.LabelField("Minra Mosaique - Texture Baking", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox(
                "Process a combined Bayer CFA texture and save 3 separate demosaiced images. " +
                "Zero runtime cost - textures are pre-computed.",
                MessageType.Info);

            EditorGUILayout.Space();

            // Input section
            EditorGUILayout.LabelField("Input", EditorStyles.boldLabel);

            _inputTexture = (Texture2D)EditorGUILayout.ObjectField(
                new GUIContent("Combined Texture",
                    "Input texture containing 3 Bayer CFA patterns stored in RGB channels."),
                _inputTexture, typeof(Texture2D), false);

            if (_inputTexture != null)
            {
                EditorGUILayout.LabelField(
                    $"Dimensions: {_inputTexture.width} x {_inputTexture.height}",
                    EditorStyles.miniLabel);

                if (!_inputTexture.isReadable)
                {
                    EditorGUILayout.HelpBox(
                        "Texture is not readable. Enable 'Read/Write' in the texture import settings.",
                        MessageType.Error);
                }
            }

            EditorGUILayout.Space();

            // Settings section
            EditorGUILayout.LabelField("Settings", EditorStyles.boldLabel);

            _algorithm = (MinraDemosaicTexture.DemosaicAlgorithm)EditorGUILayout.EnumPopup(
                new GUIContent("Algorithm", GetAlgorithmTooltip(_algorithm)),
                _algorithm);

            _generateMipmaps = EditorGUILayout.Toggle(
                new GUIContent("Generate Mipmaps", "Generate mipmaps for the output textures."),
                _generateMipmaps);

            EditorGUILayout.Space();

            // Output section
            EditorGUILayout.LabelField("Output", EditorStyles.boldLabel);

            EditorGUILayout.BeginHorizontal();
            _outputFolder = EditorGUILayout.TextField("Output Folder", _outputFolder);
            if (GUILayout.Button("Browse", GUILayout.Width(60)))
            {
                string folder = EditorUtility.OpenFolderPanel("Select Output Folder", _outputFolder, "");
                if (!string.IsNullOrEmpty(folder))
                {
                    if (folder.StartsWith(Application.dataPath))
                    {
                        _outputFolder = "Assets" + folder.Substring(Application.dataPath.Length);
                    }
                }
            }
            EditorGUILayout.EndHorizontal();

            _outputPrefix = EditorGUILayout.TextField(
                new GUIContent("Filename Prefix", "Prefix for output filenames. Results in Prefix_1.png, Prefix_2.png, Prefix_3.png"),
                _outputPrefix);

            EditorGUILayout.Space();

            // Preview of output names
            EditorGUILayout.LabelField("Output Files:", EditorStyles.miniLabel);
            EditorGUILayout.LabelField($"  {_outputPrefix}_1.png (from R channel)", EditorStyles.miniLabel);
            EditorGUILayout.LabelField($"  {_outputPrefix}_2.png (from G channel)", EditorStyles.miniLabel);
            EditorGUILayout.LabelField($"  {_outputPrefix}_3.png (from B channel)", EditorStyles.miniLabel);

            EditorGUILayout.Space();

            // Bake button
            EditorGUI.BeginDisabledGroup(_inputTexture == null || !_inputTexture.isReadable);
            if (GUILayout.Button("Bake Textures", GUILayout.Height(30)))
            {
                BakeTextures();
            }
            EditorGUI.EndDisabledGroup();

            EditorGUILayout.EndScrollView();
        }

        private string GetAlgorithmTooltip(MinraDemosaicTexture.DemosaicAlgorithm algorithm)
        {
            switch (algorithm)
            {
                case MinraDemosaicTexture.DemosaicAlgorithm.MalvarHeCutler:
                    return "Malvar-He-Cutler: High-quality 5x5 gradient-corrected interpolation. Better edge preservation, slower processing.";
                default:
                    return "Fast 3x3 interpolation. Good quality for most use cases.";
            }
        }

        private void BakeTextures()
        {
            if (_inputTexture == null || !_inputTexture.isReadable)
                return;

            try
            {
                EditorUtility.DisplayProgressBar("Minra Mosaique", "Demosaicing textures...", 0f);

                int width = _inputTexture.width;
                int height = _inputTexture.height;
                Color[] sourcePixels = _inputTexture.GetPixels();

                // Process each channel
                for (int channel = 0; channel < 3; channel++)
                {
                    EditorUtility.DisplayProgressBar("Minra Mosaique",
                        $"Processing Image {channel + 1}...",
                        (channel + 0.5f) / 3f);

                    Texture2D output = new Texture2D(width, height, TextureFormat.RGB24, _generateMipmaps);
                    Color[] outputPixels = new Color[width * height];

                    for (int y = 0; y < height; y++)
                    {
                        for (int x = 0; x < width; x++)
                        {
                            Color rgb = _algorithm == MinraDemosaicTexture.DemosaicAlgorithm.MalvarHeCutler
                                ? DemosaicPixelMHC(sourcePixels, width, height, x, y, channel)
                                : DemosaicPixelBilinear(sourcePixels, width, height, x, y, channel);

                            outputPixels[y * width + x] = rgb;
                        }
                    }

                    output.SetPixels(outputPixels);
                    output.Apply(_generateMipmaps);

                    // Save to file
                    string filename = $"{_outputPrefix}_{channel + 1}.png";
                    string path = Path.Combine(_outputFolder, filename);

                    byte[] pngData = output.EncodeToPNG();
                    File.WriteAllBytes(path, pngData);

                    DestroyImmediate(output);

                    EditorUtility.DisplayProgressBar("Minra Mosaique",
                        $"Saved Image {channel + 1}...",
                        (channel + 1f) / 3f);
                }

                AssetDatabase.Refresh();
                EditorUtility.ClearProgressBar();

                EditorUtility.DisplayDialog("Minra Mosaique",
                    $"Successfully baked 3 textures to:\n{_outputFolder}",
                    "OK");
            }
            catch (System.Exception e)
            {
                EditorUtility.ClearProgressBar();
                EditorUtility.DisplayDialog("Error",
                    $"Failed to bake textures: {e.Message}",
                    "OK");
                Debug.LogException(e);
            }
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

        private Color DemosaicPixelMHC(Color[] pixels, int width, int height, int x, int y, int channel)
        {
            bool evenRow = (y & 1) == 0;
            bool evenCol = (x & 1) == 0;

            // Mirror boundary sampling
            int Mirror(int p, int size)
            {
                if (p < 0) return -p;
                if (p >= size) return 2 * size - p - 2;
                return p;
            }

            float GetChannel(int px, int py)
            {
                px = Mirror(px, width);
                py = Mirror(py, height);
                px = Mathf.Clamp(px, 0, width - 1);
                py = Mathf.Clamp(py, 0, height - 1);
                Color c = pixels[py * width + px];
                return channel == 0 ? c.r : (channel == 1 ? c.g : c.b);
            }

            // Sample 5x5 neighborhood
            float c = GetChannel(x, y);
            float n = GetChannel(x, y - 1);
            float s = GetChannel(x, y + 1);
            float w = GetChannel(x - 1, y);
            float e = GetChannel(x + 1, y);
            float nw = GetChannel(x - 1, y - 1);
            float ne = GetChannel(x + 1, y - 1);
            float sw = GetChannel(x - 1, y + 1);
            float se = GetChannel(x + 1, y + 1);
            float n2 = GetChannel(x, y - 2);
            float s2 = GetChannel(x, y + 2);
            float w2 = GetChannel(x - 2, y);
            float e2 = GetChannel(x + 2, y);

            float R, G, B;

            if (evenRow && evenCol)
            {
                R = c;
                G = (4f * c + 2f * (n + s + w + e) - (n2 + s2 + w2 + e2)) / 8f;
                B = (6f * c + 2f * (nw + ne + sw + se) - 1.5f * (n2 + s2 + w2 + e2)) / 8f;
            }
            else if (evenRow && !evenCol)
            {
                G = c;
                R = (4f * c + 2f * (w + e) - 0.5f * (n2 + s2 + w2 + e2)) / 8f;
                B = (4f * c + 2f * (n + s) - 0.5f * (n2 + s2 + w2 + e2)) / 8f;
            }
            else if (!evenRow && evenCol)
            {
                G = c;
                R = (4f * c + 2f * (n + s) - 0.5f * (n2 + s2 + w2 + e2)) / 8f;
                B = (4f * c + 2f * (w + e) - 0.5f * (n2 + s2 + w2 + e2)) / 8f;
            }
            else
            {
                B = c;
                G = (4f * c + 2f * (n + s + w + e) - (n2 + s2 + w2 + e2)) / 8f;
                R = (6f * c + 2f * (nw + ne + sw + se) - 1.5f * (n2 + s2 + w2 + e2)) / 8f;
            }

            return new Color(
                Mathf.Clamp01(R),
                Mathf.Clamp01(G),
                Mathf.Clamp01(B));
        }

        /// <summary>
        /// Static method to bake textures from a MinraDemosaicTexture asset.
        /// Called from the inspector.
        /// </summary>
        public static void BakeTextures(MinraDemosaicTexture source, string outputFolder)
        {
            if (source == null || !source.IsValid)
            {
                EditorUtility.DisplayDialog("Error", "Invalid source texture.", "OK");
                return;
            }

            try
            {
                EditorUtility.DisplayProgressBar("Minra Mosaique", "Demosaicing textures...", 0f);

                Texture2D inputTexture = source.CombinedTexture;

                if (!inputTexture.isReadable)
                {
                    EditorUtility.ClearProgressBar();
                    EditorUtility.DisplayDialog("Error",
                        "Texture is not readable. Enable 'Read/Write' in the texture import settings.",
                        "OK");
                    return;
                }

                int width = inputTexture.width;
                int height = inputTexture.height;
                Color[] sourcePixels = inputTexture.GetPixels();

                string baseName = source.name;
                Texture2D[] bakedTextures = new Texture2D[3];

                // Create bake window instance for helper methods
                var bakeHelper = CreateInstance<MinraBakeWindow>();
                bakeHelper._algorithm = source.Algorithm;

                for (int channel = 0; channel < 3; channel++)
                {
                    EditorUtility.DisplayProgressBar("Minra Mosaique",
                        $"Processing Image {channel + 1}...",
                        (channel + 0.5f) / 3f);

                    Texture2D output = new Texture2D(width, height, TextureFormat.RGB24, true);
                    Color[] outputPixels = new Color[width * height];

                    for (int y = 0; y < height; y++)
                    {
                        for (int x = 0; x < width; x++)
                        {
                            Color rgb = source.Algorithm == MinraDemosaicTexture.DemosaicAlgorithm.MalvarHeCutler
                                ? bakeHelper.DemosaicPixelMHC(sourcePixels, width, height, x, y, channel)
                                : bakeHelper.DemosaicPixelBilinear(sourcePixels, width, height, x, y, channel);

                            outputPixels[y * width + x] = rgb;
                        }
                    }

                    output.SetPixels(outputPixels);
                    output.Apply(true);

                    // Save to file
                    string filename = $"{baseName}_Image{channel + 1}.png";
                    string path = Path.Combine(outputFolder, filename);

                    byte[] pngData = output.EncodeToPNG();
                    File.WriteAllBytes(path, pngData);

                    bakedTextures[channel] = output;
                }

                DestroyImmediate(bakeHelper);
                AssetDatabase.Refresh();

                // Load the created textures and assign them
                string[] texturePaths = new string[3];
                for (int i = 0; i < 3; i++)
                {
                    texturePaths[i] = Path.Combine(outputFolder, $"{baseName}_Image{i + 1}.png");
                    DestroyImmediate(bakedTextures[i]);
                }

                Texture2D baked1 = AssetDatabase.LoadAssetAtPath<Texture2D>(texturePaths[0]);
                Texture2D baked2 = AssetDatabase.LoadAssetAtPath<Texture2D>(texturePaths[1]);
                Texture2D baked3 = AssetDatabase.LoadAssetAtPath<Texture2D>(texturePaths[2]);

                source.SetBakedTextures(baked1, baked2, baked3);

                EditorUtility.ClearProgressBar();
                EditorUtility.DisplayDialog("Minra Mosaique",
                    $"Successfully baked 3 textures to:\n{outputFolder}",
                    "OK");
            }
            catch (System.Exception e)
            {
                EditorUtility.ClearProgressBar();
                EditorUtility.DisplayDialog("Error",
                    $"Failed to bake textures: {e.Message}",
                    "OK");
                Debug.LogException(e);
            }
        }
    }
}
