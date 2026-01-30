// Copyright Minra. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"
#include "Engine/Texture2D.h"
#include "MSQ3Asset.generated.h"

/**
 * Demosaicing algorithm selection.
 */
UENUM(BlueprintType)
enum class EMinraDemosaicAlgorithm : uint8
{
    /** Fast 3x3 interpolation. Good quality for most use cases. Lower GPU cost. */
    Bilinear UMETA(DisplayName = "Bilinear", ToolTip = "Fast 3x3 interpolation. Good quality for most use cases. Lower GPU cost."),

    /** Malvar-He-Cutler: High-quality 5x5 gradient-corrected interpolation. Better edge preservation at higher GPU cost. */
    MalvarHeCutler UMETA(DisplayName = "Malvar-He-Cutler", ToolTip = "High-quality 5x5 gradient-corrected interpolation. Better edge preservation at higher GPU cost.")
};

/**
 * Asset representing an MSQ3 file containing 3 Bayer CFA patterns.
 * Can be used directly in materials for runtime demosaicing or baked to separate textures.
 */
UCLASS(BlueprintType)
class MINRAMOSAIQUE_API UMSQ3Asset : public UObject
{
    GENERATED_BODY()

public:
    UMSQ3Asset();

    /** Original width of the image */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "MSQ3")
    int32 Width;

    /** Original height of the image */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "MSQ3")
    int32 Height;

    /** Quality setting used during compression (0-100) */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "MSQ3")
    uint8 Quality;

    /** Combined texture containing all 3 CFA channels in RGB */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "MSQ3")
    UTexture2D* CombinedTexture;

    /** Demosaicing algorithm to use */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "MSQ3")
    EMinraDemosaicAlgorithm Algorithm;

    /** Baked output texture for Image 1 (from R channel) */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Baked")
    UTexture2D* BakedImage1;

    /** Baked output texture for Image 2 (from G channel) */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Baked")
    UTexture2D* BakedImage2;

    /** Baked output texture for Image 3 (from B channel) */
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Baked")
    UTexture2D* BakedImage3;

    /** Returns true if the asset has valid data */
    UFUNCTION(BlueprintCallable, Category = "MSQ3")
    bool IsValid() const;

    /** Returns true if baked textures are available */
    UFUNCTION(BlueprintCallable, Category = "MSQ3")
    bool HasBakedTextures() const;

    /** Gets the best available texture for Image 1 (baked if available, otherwise combined for runtime) */
    UFUNCTION(BlueprintCallable, Category = "MSQ3")
    UTexture2D* GetImage1() const;

    /** Gets the best available texture for Image 2 */
    UFUNCTION(BlueprintCallable, Category = "MSQ3")
    UTexture2D* GetImage2() const;

    /** Gets the best available texture for Image 3 */
    UFUNCTION(BlueprintCallable, Category = "MSQ3")
    UTexture2D* GetImage3() const;
};
