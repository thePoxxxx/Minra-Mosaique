// Copyright Minra. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Materials/MaterialExpression.h"
#include "MSQ3Asset.h"
#include "MaterialExpressionMinraDemosaic.generated.h"

/**
 * Custom material expression for Minra Mosaique demosaicing.
 * Decodes a combined Bayer CFA texture into 3 separate output images.
 */
UCLASS(collapsecategories, hidecategories = Object, MinimalAPI)
class UMaterialExpressionMinraDemosaic : public UMaterialExpression
{
    GENERATED_UCLASS_BODY()

    /** Input texture containing 3 Bayer CFA patterns stored in RGB channels. */
    UPROPERTY(meta = (ToolTip = "Input texture containing 3 Bayer CFA patterns stored in RGB channels. Supports PNG or MSQ3 format."))
    FExpressionInput TextureObject;

    /** Optional UV coordinates. If not connected, uses default mesh UVs. */
    UPROPERTY(meta = (ToolTip = "UV coordinates for texture sampling. Uses mesh UVs if not connected."))
    FExpressionInput Coordinates;

    /** Demosaicing algorithm to use. */
    UPROPERTY(EditAnywhere, Category = "Minra Mosaique", meta = (ToolTip = "Demosaicing algorithm. Bilinear is faster, MHC provides better quality."))
    EMinraDemosaicAlgorithm Algorithm;

    //~ Begin UMaterialExpression Interface
    virtual int32 Compile(class FMaterialCompiler* Compiler, int32 OutputIndex) override;
    virtual void GetCaption(TArray<FString>& OutCaptions) const override;
    virtual uint32 GetInputType(int32 InputIndex) override;
    virtual uint32 GetOutputType(int32 OutputIndex) override;
    virtual bool IsResultMaterialAttributes(int32 OutputIndex) override { return false; }
    virtual FExpressionInput* GetInput(int32 InputIndex) override;
    virtual FName GetInputName(int32 InputIndex) const override;
    virtual int32 GetInputCount() const override { return 2; }

#if WITH_EDITOR
    virtual FText GetCreationDescription() const override;
    virtual FText GetCreationName() const override;
#endif
    //~ End UMaterialExpression Interface

    // This expression has 3 outputs: Image1, Image2, Image3
    virtual TArray<FExpressionOutput>& GetOutputs() override;

protected:
    /** Cached outputs array */
    TArray<FExpressionOutput> Outputs;

    /** Initialize outputs */
    void InitializeOutputs();

    /** Generate HLSL code for bilinear demosaicing */
    FString GenerateBilinearCode() const;

    /** Generate HLSL code for MHC demosaicing */
    FString GenerateMHCCode() const;
};
