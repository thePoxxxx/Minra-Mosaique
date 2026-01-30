// Copyright Minra. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "MinraDemosaicTexture.h"

/**
 * Utility class for baking demosaiced textures.
 * Processes combined CFA textures and outputs 3 separate texture files.
 */
class MINRAMOSAIQUEEDITOR_API FMinraBakeUtility
{
public:
    /**
     * Bake demosaiced textures from a MinraDemosaicTexture asset.
     *
     * @param Source The source texture asset to process
     * @param OutputPath The folder path to save the baked textures
     * @param bGenerateMipmaps Whether to generate mipmaps for output textures
     * @return True if baking was successful
     */
    static bool BakeTextures(
        UMinraDemosaicTexture* Source,
        const FString& OutputPath,
        bool bGenerateMipmaps = true);

    /**
     * Bake demosaiced textures from a raw combined texture.
     *
     * @param CombinedTexture The combined CFA texture
     * @param Algorithm The demosaicing algorithm to use
     * @param OutputPath The folder path to save the baked textures
     * @param BaseFilename The base filename for output textures
     * @param bGenerateMipmaps Whether to generate mipmaps for output textures
     * @return True if baking was successful
     */
    static bool BakeTexturesFromCombined(
        UTexture2D* CombinedTexture,
        EMinraDemosaicAlgorithm Algorithm,
        const FString& OutputPath,
        const FString& BaseFilename,
        bool bGenerateMipmaps = true);

private:
    /**
     * Demosaic a single channel using bilinear interpolation.
     */
    static FColor DemosaicPixelBilinear(
        const TArray<FColor>& Pixels,
        int32 Width,
        int32 Height,
        int32 X,
        int32 Y,
        int32 Channel);

    /**
     * Demosaic a single channel using Malvar-He-Cutler algorithm.
     */
    static FColor DemosaicPixelMHC(
        const TArray<FColor>& Pixels,
        int32 Width,
        int32 Height,
        int32 X,
        int32 Y,
        int32 Channel);

    /**
     * Save a texture to disk as PNG.
     */
    static bool SaveTextureToPNG(
        UTexture2D* Texture,
        const FString& FilePath);
};
