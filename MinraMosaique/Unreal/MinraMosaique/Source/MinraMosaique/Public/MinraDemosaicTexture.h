// Copyright Minra. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"
#include "Engine/Texture2D.h"
#include "MSQ3Asset.h"
#include "MinraDemosaicTexture.generated.h"

/**
 * Texture asset that holds a combined Bayer CFA texture and provides
 * demosaiced output textures. Can be used for editor-time baking or
 * runtime GPU demosaicing.
 */
UCLASS(BlueprintType)
class MINRAMOSAIQUE_API UMinraDemosaicTexture : public UObject
{
    GENERATED_BODY()

public:
    UMinraDemosaicTexture();

    /** Input texture containing 3 Bayer CFA patterns stored in RGB channels. Supports PNG or MSQ3 format. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Input", meta = (ToolTip = "Input texture containing 3 Bayer CFA patterns stored in RGB channels."))
    UTexture2D* CombinedTexture;

    /** Demosaicing algorithm to use for reconstruction. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Settings", meta = (ToolTip = "Demosaicing algorithm to use for reconstruction."))
    EMinraDemosaicAlgorithm Algorithm;

    /** Baked output texture for Image 1 (from R channel). */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Baked Outputs", meta = (ToolTip = "Demosaiced output image reconstructed from the R channel CFA pattern."))
    UTexture2D* BakedImage1;

    /** Baked output texture for Image 2 (from G channel). */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Baked Outputs", meta = (ToolTip = "Demosaiced output image reconstructed from the G channel CFA pattern."))
    UTexture2D* BakedImage2;

    /** Baked output texture for Image 3 (from B channel). */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Baked Outputs", meta = (ToolTip = "Demosaiced output image reconstructed from the B channel CFA pattern."))
    UTexture2D* BakedImage3;

    /** Returns true if the combined texture is valid and ready for processing. */
    UFUNCTION(BlueprintCallable, Category = "Minra Mosaique")
    bool IsValid() const;

    /** Returns true if baked textures are available. */
    UFUNCTION(BlueprintCallable, Category = "Minra Mosaique")
    bool HasBakedTextures() const;

    /** Gets the appropriate output texture for Image 1, preferring baked if available. */
    UFUNCTION(BlueprintCallable, Category = "Minra Mosaique")
    UTexture2D* GetImage1() const;

    /** Gets the appropriate output texture for Image 2, preferring baked if available. */
    UFUNCTION(BlueprintCallable, Category = "Minra Mosaique")
    UTexture2D* GetImage2() const;

    /** Gets the appropriate output texture for Image 3, preferring baked if available. */
    UFUNCTION(BlueprintCallable, Category = "Minra Mosaique")
    UTexture2D* GetImage3() const;

    /** Creates an error/fallback texture for invalid inputs. */
    UFUNCTION(BlueprintCallable, Category = "Minra Mosaique")
    static UTexture2D* CreateFallbackTexture(int32 Width = 64, int32 Height = 64);

#if WITH_EDITOR
    /** Sets the baked output textures. Editor-only. */
    void SetBakedTextures(UTexture2D* Image1, UTexture2D* Image2, UTexture2D* Image3);

    /** Clears the baked textures. Editor-only. */
    void ClearBakedTextures();
#endif
};
