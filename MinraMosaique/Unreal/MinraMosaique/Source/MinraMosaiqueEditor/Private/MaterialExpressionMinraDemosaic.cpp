// Copyright Minra. All Rights Reserved.

#include "MaterialExpressionMinraDemosaic.h"
#include "MaterialCompiler.h"
#include "Materials/MaterialExpressionTextureBase.h"

#define LOCTEXT_NAMESPACE "MaterialExpressionMinraDemosaic"

UMaterialExpressionMinraDemosaic::UMaterialExpressionMinraDemosaic(const FObjectInitializer& ObjectInitializer)
    : Super(ObjectInitializer)
    , Algorithm(EMinraDemosaicAlgorithm::Bilinear)
{
    // Set up the expression
    bShowOutputNameOnPin = true;
    bHidePreviewWindow = false;

    InitializeOutputs();
}

void UMaterialExpressionMinraDemosaic::InitializeOutputs()
{
    Outputs.Empty();
    Outputs.Add(FExpressionOutput(TEXT("Image1"), 1, 1, 1, 1, 0));
    Outputs.Add(FExpressionOutput(TEXT("Image2"), 1, 1, 1, 1, 0));
    Outputs.Add(FExpressionOutput(TEXT("Image3"), 1, 1, 1, 1, 0));
}

TArray<FExpressionOutput>& UMaterialExpressionMinraDemosaic::GetOutputs()
{
    if (Outputs.Num() == 0)
    {
        InitializeOutputs();
    }
    return Outputs;
}

int32 UMaterialExpressionMinraDemosaic::Compile(class FMaterialCompiler* Compiler, int32 OutputIndex)
{
    // Get texture input
    int32 TextureCodeIndex = TextureObject.GetTracedInput().Expression ? TextureObject.Compile(Compiler) : INDEX_NONE;

    if (TextureCodeIndex == INDEX_NONE)
    {
        // No texture connected - return error color (magenta)
        Compiler->Errorf(TEXT("Minra Mosaique: No texture connected. Expected combined Bayer CFA image."));
        return Compiler->Constant3(1.0f, 0.0f, 1.0f);
    }

    // Get UV coordinates
    int32 CoordinatesIndex = Coordinates.GetTracedInput().Expression ? Coordinates.Compile(Compiler) : Compiler->TextureCoordinate(0, false, false);

    // Get texture size for calculations
    int32 TextureSizeIndex = Compiler->TextureProperty(TextureCodeIndex, TMPP_Size);

    // Calculate pixel position
    int32 PixelPos = Compiler->Mul(CoordinatesIndex, TextureSizeIndex);

    // Determine which channel to process based on output index
    int32 ChannelIndex = Compiler->Constant(static_cast<float>(OutputIndex));

    // The actual demosaicing is done in the shader
    // For now, we generate custom HLSL code

    FString CustomCode;
    if (Algorithm == EMinraDemosaicAlgorithm::MalvarHeCutler)
    {
        CustomCode = GenerateMHCCode();
    }
    else
    {
        CustomCode = GenerateBilinearCode();
    }

    // Use custom expression with the generated code
    // This is a simplified implementation - full implementation would use Custom node

    // For this version, we output the channel directly as a placeholder
    // A complete implementation would invoke the shader include

    // Sample the texture
    int32 SampleIndex = Compiler->TextureSample(TextureCodeIndex, CoordinatesIndex);

    // Extract the appropriate channel based on output index
    // This is simplified - real demosaicing requires the full algorithm
    switch (OutputIndex)
    {
        case 0: // Image 1 - based on R channel CFA
            return Compiler->ComponentMask(SampleIndex, true, false, false, false);
        case 1: // Image 2 - based on G channel CFA
            return Compiler->ComponentMask(SampleIndex, false, true, false, false);
        case 2: // Image 3 - based on B channel CFA
            return Compiler->ComponentMask(SampleIndex, false, false, true, false);
        default:
            return Compiler->Constant3(1.0f, 0.0f, 1.0f);
    }
}

FString UMaterialExpressionMinraDemosaic::GenerateBilinearCode() const
{
    // Generate HLSL code for bilinear demosaicing
    // This would be used with a Custom expression node
    return TEXT(R"(
        // Bilinear demosaicing implementation
        // See BilinearDemosaic.usf for full implementation
    )");
}

FString UMaterialExpressionMinraDemosaic::GenerateMHCCode() const
{
    // Generate HLSL code for MHC demosaicing
    return TEXT(R"(
        // Malvar-He-Cutler demosaicing implementation
        // See MHCDemosaic.usf for full implementation
    )");
}

void UMaterialExpressionMinraDemosaic::GetCaption(TArray<FString>& OutCaptions) const
{
    FString AlgorithmName = (Algorithm == EMinraDemosaicAlgorithm::MalvarHeCutler) ? TEXT("MHC") : TEXT("Bilinear");
    OutCaptions.Add(FString::Printf(TEXT("Minra Mosaique (%s)"), *AlgorithmName));
}

uint32 UMaterialExpressionMinraDemosaic::GetInputType(int32 InputIndex)
{
    switch (InputIndex)
    {
        case 0: // TextureObject
            return MCT_Texture2D;
        case 1: // Coordinates
            return MCT_Float2;
        default:
            return MCT_Unknown;
    }
}

uint32 UMaterialExpressionMinraDemosaic::GetOutputType(int32 OutputIndex)
{
    // All outputs are RGB color values
    return MCT_Float3;
}

FExpressionInput* UMaterialExpressionMinraDemosaic::GetInput(int32 InputIndex)
{
    switch (InputIndex)
    {
        case 0:
            return &TextureObject;
        case 1:
            return &Coordinates;
        default:
            return nullptr;
    }
}

FName UMaterialExpressionMinraDemosaic::GetInputName(int32 InputIndex) const
{
    switch (InputIndex)
    {
        case 0:
            return TEXT("Combined Texture");
        case 1:
            return TEXT("UVs");
        default:
            return NAME_None;
    }
}

#if WITH_EDITOR
FText UMaterialExpressionMinraDemosaic::GetCreationDescription() const
{
    return LOCTEXT("MinraDemosaicDescription", "Decode combined Bayer CFA texture into 3 separate images using GPU demosaicing.");
}

FText UMaterialExpressionMinraDemosaic::GetCreationName() const
{
    return LOCTEXT("MinraDemosaicName", "Minra Mosaique");
}
#endif

#undef LOCTEXT_NAMESPACE
