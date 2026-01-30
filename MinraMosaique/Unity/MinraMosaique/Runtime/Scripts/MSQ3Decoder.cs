using System;
using System.IO;
using UnityEngine;

namespace Minra.Mosaique
{
    /// <summary>
    /// Decodes MSQ3 binary format files containing 3 Bayer CFA patterns.
    /// MSQ3 stores each channel as a separate WebP-compressed grayscale image.
    /// </summary>
    public static class MSQ3Decoder
    {
        public const string MAGIC = "MSQ3";
        public const byte CURRENT_VERSION = 1;
        public const int HEADER_SIZE = 14;

        /// <summary>
        /// Result of decoding an MSQ3 file.
        /// </summary>
        public class MSQ3Data
        {
            public int Width { get; set; }
            public int Height { get; set; }
            public byte Quality { get; set; }
            public byte[] ChannelR { get; set; }
            public byte[] ChannelG { get; set; }
            public byte[] ChannelB { get; set; }

            /// <summary>
            /// Whether the decode was successful.
            /// </summary>
            public bool IsValid => ChannelR != null && ChannelG != null && ChannelB != null;
        }

        /// <summary>
        /// Validates if a file is a valid MSQ3 file by checking magic bytes.
        /// </summary>
        public static bool IsMSQ3File(byte[] data)
        {
            if (data == null || data.Length < HEADER_SIZE)
                return false;

            return data[0] == 'M' && data[1] == 'S' && data[2] == 'Q' && data[3] == '3';
        }

        /// <summary>
        /// Validates if a file is a valid MSQ3 file by checking the file extension and magic bytes.
        /// </summary>
        public static bool IsMSQ3File(string path)
        {
            if (string.IsNullOrEmpty(path))
                return false;

            if (!path.EndsWith(".msq3", StringComparison.OrdinalIgnoreCase))
                return false;

            if (!File.Exists(path))
                return false;

            try
            {
                using (var stream = File.OpenRead(path))
                {
                    byte[] header = new byte[4];
                    if (stream.Read(header, 0, 4) < 4)
                        return false;

                    return header[0] == 'M' && header[1] == 'S' && header[2] == 'Q' && header[3] == '3';
                }
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Decodes an MSQ3 file from raw bytes.
        /// </summary>
        /// <param name="data">Raw MSQ3 file data</param>
        /// <returns>Decoded MSQ3 data or null if invalid</returns>
        public static MSQ3Data Decode(byte[] data)
        {
            if (!IsMSQ3File(data))
            {
                Debug.LogWarning("Minra Mosaique: Invalid MSQ3 file - magic bytes not found.");
                return null;
            }

            try
            {
                using (var stream = new MemoryStream(data))
                using (var reader = new BinaryReader(stream))
                {
                    // Skip magic bytes (already validated)
                    reader.ReadBytes(4);

                    // Read version
                    byte version = reader.ReadByte();
                    if (version != CURRENT_VERSION)
                    {
                        Debug.LogWarning($"Minra Mosaique: Unsupported MSQ3 version {version}. Expected {CURRENT_VERSION}.");
                        return null;
                    }

                    // Read dimensions (little-endian)
                    uint width = reader.ReadUInt32();
                    uint height = reader.ReadUInt32();

                    // Read quality
                    byte quality = reader.ReadByte();

                    // Validate dimensions
                    if (width == 0 || height == 0 || width > 16384 || height > 16384)
                    {
                        Debug.LogWarning($"Minra Mosaique: Invalid MSQ3 dimensions: {width}x{height}");
                        return null;
                    }

                    // Read R channel
                    uint rSize = reader.ReadUInt32();
                    byte[] rData = reader.ReadBytes((int)rSize);

                    // Read G channel
                    uint gSize = reader.ReadUInt32();
                    byte[] gData = reader.ReadBytes((int)gSize);

                    // Read B channel
                    uint bSize = reader.ReadUInt32();
                    byte[] bData = reader.ReadBytes((int)bSize);

                    return new MSQ3Data
                    {
                        Width = (int)width,
                        Height = (int)height,
                        Quality = quality,
                        ChannelR = rData,
                        ChannelG = gData,
                        ChannelB = bData
                    };
                }
            }
            catch (Exception e)
            {
                Debug.LogWarning($"Minra Mosaique: Failed to decode MSQ3 file: {e.Message}");
                return null;
            }
        }

        /// <summary>
        /// Decodes an MSQ3 file from disk.
        /// </summary>
        public static MSQ3Data DecodeFromFile(string path)
        {
            if (!File.Exists(path))
            {
                Debug.LogWarning($"Minra Mosaique: MSQ3 file not found: {path}");
                return null;
            }

            try
            {
                byte[] data = File.ReadAllBytes(path);
                return Decode(data);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"Minra Mosaique: Failed to read MSQ3 file: {e.Message}");
                return null;
            }
        }

        /// <summary>
        /// Decodes WebP data to a grayscale texture.
        /// Note: Unity doesn't natively support WebP, so this requires external decoding.
        /// For editor-time, we can use system libraries or fall back to PNG-based workflow.
        /// </summary>
        public static Texture2D DecodeWebPToTexture(byte[] webpData, int width, int height)
        {
            // Unity doesn't have built-in WebP support.
            // In a production environment, you would use a WebP decoding library.
            // For now, we'll create a placeholder that indicates WebP decoding is needed.

            Debug.LogWarning("Minra Mosaique: WebP decoding requires external library. " +
                           "Consider using the PNG workflow or integrating a WebP decoder.");

            // Create a magenta error texture
            Texture2D errorTexture = new Texture2D(width, height, TextureFormat.R8, false);
            Color[] pixels = new Color[width * height];
            for (int i = 0; i < pixels.Length; i++)
            {
                // Checkerboard pattern for error indication
                int x = i % width;
                int y = i / width;
                bool isEven = ((x / 8) + (y / 8)) % 2 == 0;
                pixels[i] = isEven ? Color.magenta : Color.black;
            }
            errorTexture.SetPixels(pixels);
            errorTexture.Apply();

            return errorTexture;
        }

        /// <summary>
        /// Creates a combined RGBA texture from three grayscale CFA textures.
        /// </summary>
        public static Texture2D CreateCombinedTexture(Texture2D cfaR, Texture2D cfaG, Texture2D cfaB)
        {
            if (cfaR == null || cfaG == null || cfaB == null)
                return null;

            int width = cfaR.width;
            int height = cfaR.height;

            if (cfaG.width != width || cfaG.height != height ||
                cfaB.width != width || cfaB.height != height)
            {
                Debug.LogWarning("Minra Mosaique: CFA textures must have matching dimensions.");
                return null;
            }

            Texture2D combined = new Texture2D(width, height, TextureFormat.RGB24, true);

            Color[] pixelsR = cfaR.GetPixels();
            Color[] pixelsG = cfaG.GetPixels();
            Color[] pixelsB = cfaB.GetPixels();
            Color[] result = new Color[width * height];

            for (int i = 0; i < result.Length; i++)
            {
                result[i] = new Color(pixelsR[i].r, pixelsG[i].r, pixelsB[i].r, 1f);
            }

            combined.SetPixels(result);
            combined.Apply(true); // Generate mipmaps

            return combined;
        }
    }
}
