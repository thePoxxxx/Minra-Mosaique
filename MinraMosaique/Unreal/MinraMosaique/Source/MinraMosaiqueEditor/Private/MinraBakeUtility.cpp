// Copyright Minra. All Rights Reserved.

#include "MinraBakeUtility.h"
#include "Engine/Texture2D.h"
#include "Misc/FileHelper.h"
#include "ImageUtils.h"
#include "IImageWrapper.h"
#include "IImageWrapperModule.h"
#include "Modules/ModuleManager.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "UObject/Package.h"
#include "UObject/SavePackage.h"

bool FMinraBakeUtility::BakeTextures(
    UMinraDemosaicTexture* Source,
    const FString& OutputPath,
    bool bGenerateMipmaps)
{
    if (!Source || !Source->IsValid())
    {
        UE_LOG(LogTemp, Error, TEXT("Minra Mosaique: Invalid source texture."));
        return false;
    }

    return BakeTexturesFromCombined(
        Source->CombinedTexture,
        Source->Algorithm,
        OutputPath,
        Source->GetName(),
        bGenerateMipmaps);
}

bool FMinraBakeUtility::BakeTexturesFromCombined(
    UTexture2D* CombinedTexture,
    EMinraDemosaicAlgorithm Algorithm,
    const FString& OutputPath,
    const FString& BaseFilename,
    bool bGenerateMipmaps)
{
    if (!CombinedTexture)
    {
        UE_LOG(LogTemp, Error, TEXT("Minra Mosaique: No combined texture provided."));
        return false;
    }

    int32 Width = CombinedTexture->GetSizeX();
    int32 Height = CombinedTexture->GetSizeY();

    if (Width <= 0 || Height <= 0)
    {
        UE_LOG(LogTemp, Error, TEXT("Minra Mosaique: Invalid texture dimensions."));
        return false;
    }

    // Read source pixels
    TArray<FColor> SourcePixels;
    SourcePixels.SetNum(Width * Height);

    // Lock texture for reading
    FTexture2DMipMap& Mip = CombinedTexture->GetPlatformData()->Mips[0];
    const void* Data = Mip.BulkData.LockReadOnly();

    if (!Data)
    {
        UE_LOG(LogTemp, Error, TEXT("Minra Mosaique: Failed to lock texture for reading."));
        return false;
    }

    FMemory::Memcpy(SourcePixels.GetData(), Data, Width * Height * sizeof(FColor));
    Mip.BulkData.Unlock();

    // Process each channel
    for (int32 Channel = 0; Channel < 3; ++Channel)
    {
        UE_LOG(LogTemp, Log, TEXT("Minra Mosaique: Processing Image %d..."), Channel + 1);

        // Create output texture
        TArray<FColor> OutputPixels;
        OutputPixels.SetNum(Width * Height);

        for (int32 Y = 0; Y < Height; ++Y)
        {
            for (int32 X = 0; X < Width; ++X)
            {
                FColor Demosaiced;

                if (Algorithm == EMinraDemosaicAlgorithm::MalvarHeCutler)
                {
                    Demosaiced = DemosaicPixelMHC(SourcePixels, Width, Height, X, Y, Channel);
                }
                else
                {
                    Demosaiced = DemosaicPixelBilinear(SourcePixels, Width, Height, X, Y, Channel);
                }

                OutputPixels[Y * Width + X] = Demosaiced;
            }
        }

        // Create the output texture
        FString TextureName = FString::Printf(TEXT("%s_Image%d"), *BaseFilename, Channel + 1);
        FString PackagePath = FString::Printf(TEXT("%s/%s"), *OutputPath, *TextureName);

        UPackage* Package = CreatePackage(*PackagePath);
        if (!Package)
        {
            UE_LOG(LogTemp, Error, TEXT("Minra Mosaique: Failed to create package for %s."), *TextureName);
            continue;
        }

        UTexture2D* OutputTexture = NewObject<UTexture2D>(Package, *TextureName, RF_Public | RF_Standalone);
        if (!OutputTexture)
        {
            UE_LOG(LogTemp, Error, TEXT("Minra Mosaique: Failed to create texture %s."), *TextureName);
            continue;
        }

        // Initialize the texture
        OutputTexture->GetPlatformData() = new FTexturePlatformData();
        OutputTexture->GetPlatformData()->SizeX = Width;
        OutputTexture->GetPlatformData()->SizeY = Height;
        OutputTexture->GetPlatformData()->PixelFormat = PF_B8G8R8A8;

        // Create mip
        FTexture2DMipMap* OutputMip = new FTexture2DMipMap();
        OutputTexture->GetPlatformData()->Mips.Add(OutputMip);
        OutputMip->SizeX = Width;
        OutputMip->SizeY = Height;

        // Allocate and copy data
        OutputMip->BulkData.Lock(LOCK_READ_WRITE);
        void* OutputData = OutputMip->BulkData.Realloc(Width * Height * sizeof(FColor));
        FMemory::Memcpy(OutputData, OutputPixels.GetData(), Width * Height * sizeof(FColor));
        OutputMip->BulkData.Unlock();

        OutputTexture->UpdateResource();

        // Save the package
        FString PackageFilename = FPackageName::LongPackageNameToFilename(PackagePath, FPackageName::GetAssetPackageExtension());

        FSavePackageArgs SaveArgs;
        SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
        UPackage::SavePackage(Package, OutputTexture, *PackageFilename, SaveArgs);

        // Register with asset registry
        FAssetRegistryModule::AssetCreated(OutputTexture);

        UE_LOG(LogTemp, Log, TEXT("Minra Mosaique: Saved %s"), *PackageFilename);
    }

    UE_LOG(LogTemp, Log, TEXT("Minra Mosaique: Successfully baked 3 textures to %s"), *OutputPath);
    return true;
}

FColor FMinraBakeUtility::DemosaicPixelBilinear(
    const TArray<FColor>& Pixels,
    int32 Width,
    int32 Height,
    int32 X,
    int32 Y,
    int32 Channel)
{
    bool EvenRow = (Y & 1) == 0;
    bool EvenCol = (X & 1) == 0;

    auto GetChannel = [&Pixels, Width, Height, Channel](int32 PX, int32 PY) -> float
    {
        PX = FMath::Clamp(PX, 0, Width - 1);
        PY = FMath::Clamp(PY, 0, Height - 1);
        const FColor& C = Pixels[PY * Width + PX];
        switch (Channel)
        {
            case 0: return C.R / 255.0f;
            case 1: return C.G / 255.0f;
            default: return C.B / 255.0f;
        }
    };

    float Center = GetChannel(X, Y);
    float Top = GetChannel(X, Y - 1);
    float Bottom = GetChannel(X, Y + 1);
    float Left = GetChannel(X - 1, Y);
    float Right = GetChannel(X + 1, Y);
    float TopLeft = GetChannel(X - 1, Y - 1);
    float TopRight = GetChannel(X + 1, Y - 1);
    float BottomLeft = GetChannel(X - 1, Y + 1);
    float BottomRight = GetChannel(X + 1, Y + 1);

    float R, G, B;

    if (EvenRow && EvenCol)
    {
        R = Center;
        G = (Top + Bottom + Left + Right) * 0.25f;
        B = (TopLeft + TopRight + BottomLeft + BottomRight) * 0.25f;
    }
    else if (EvenRow && !EvenCol)
    {
        R = (Left + Right) * 0.5f;
        G = Center;
        B = (Top + Bottom) * 0.5f;
    }
    else if (!EvenRow && EvenCol)
    {
        R = (Top + Bottom) * 0.5f;
        G = Center;
        B = (Left + Right) * 0.5f;
    }
    else
    {
        R = (TopLeft + TopRight + BottomLeft + BottomRight) * 0.25f;
        G = (Top + Bottom + Left + Right) * 0.25f;
        B = Center;
    }

    return FColor(
        FMath::Clamp(FMath::RoundToInt(R * 255.0f), 0, 255),
        FMath::Clamp(FMath::RoundToInt(G * 255.0f), 0, 255),
        FMath::Clamp(FMath::RoundToInt(B * 255.0f), 0, 255),
        255);
}

FColor FMinraBakeUtility::DemosaicPixelMHC(
    const TArray<FColor>& Pixels,
    int32 Width,
    int32 Height,
    int32 X,
    int32 Y,
    int32 Channel)
{
    bool EvenRow = (Y & 1) == 0;
    bool EvenCol = (X & 1) == 0;

    auto Mirror = [](int32 P, int32 Size) -> int32
    {
        if (P < 0) return -P;
        if (P >= Size) return 2 * Size - P - 2;
        return P;
    };

    auto GetChannel = [&Pixels, Width, Height, Channel, &Mirror](int32 PX, int32 PY) -> float
    {
        PX = Mirror(PX, Width);
        PY = Mirror(PY, Height);
        PX = FMath::Clamp(PX, 0, Width - 1);
        PY = FMath::Clamp(PY, 0, Height - 1);
        const FColor& C = Pixels[PY * Width + PX];
        switch (Channel)
        {
            case 0: return C.R / 255.0f;
            case 1: return C.G / 255.0f;
            default: return C.B / 255.0f;
        }
    };

    // Sample 5x5 neighborhood
    float C = GetChannel(X, Y);
    float N = GetChannel(X, Y - 1);
    float S = GetChannel(X, Y + 1);
    float W = GetChannel(X - 1, Y);
    float E = GetChannel(X + 1, Y);
    float NW = GetChannel(X - 1, Y - 1);
    float NE = GetChannel(X + 1, Y - 1);
    float SW = GetChannel(X - 1, Y + 1);
    float SE = GetChannel(X + 1, Y + 1);
    float N2 = GetChannel(X, Y - 2);
    float S2 = GetChannel(X, Y + 2);
    float W2 = GetChannel(X - 2, Y);
    float E2 = GetChannel(X + 2, Y);

    float R, G, B;

    if (EvenRow && EvenCol)
    {
        R = C;
        G = (4.0f * C + 2.0f * (N + S + W + E) - (N2 + S2 + W2 + E2)) / 8.0f;
        B = (6.0f * C + 2.0f * (NW + NE + SW + SE) - 1.5f * (N2 + S2 + W2 + E2)) / 8.0f;
    }
    else if (EvenRow && !EvenCol)
    {
        G = C;
        R = (4.0f * C + 2.0f * (W + E) - 0.5f * (N2 + S2 + W2 + E2)) / 8.0f;
        B = (4.0f * C + 2.0f * (N + S) - 0.5f * (N2 + S2 + W2 + E2)) / 8.0f;
    }
    else if (!EvenRow && EvenCol)
    {
        G = C;
        R = (4.0f * C + 2.0f * (N + S) - 0.5f * (N2 + S2 + W2 + E2)) / 8.0f;
        B = (4.0f * C + 2.0f * (W + E) - 0.5f * (N2 + S2 + W2 + E2)) / 8.0f;
    }
    else
    {
        B = C;
        G = (4.0f * C + 2.0f * (N + S + W + E) - (N2 + S2 + W2 + E2)) / 8.0f;
        R = (6.0f * C + 2.0f * (NW + NE + SW + SE) - 1.5f * (N2 + S2 + W2 + E2)) / 8.0f;
    }

    return FColor(
        FMath::Clamp(FMath::RoundToInt(R * 255.0f), 0, 255),
        FMath::Clamp(FMath::RoundToInt(G * 255.0f), 0, 255),
        FMath::Clamp(FMath::RoundToInt(B * 255.0f), 0, 255),
        255);
}

bool FMinraBakeUtility::SaveTextureToPNG(UTexture2D* Texture, const FString& FilePath)
{
    if (!Texture)
    {
        return false;
    }

    int32 Width = Texture->GetSizeX();
    int32 Height = Texture->GetSizeY();

    // Read pixels
    TArray<FColor> Pixels;
    Pixels.SetNum(Width * Height);

    FTexture2DMipMap& Mip = Texture->GetPlatformData()->Mips[0];
    const void* Data = Mip.BulkData.LockReadOnly();

    if (!Data)
    {
        return false;
    }

    FMemory::Memcpy(Pixels.GetData(), Data, Width * Height * sizeof(FColor));
    Mip.BulkData.Unlock();

    // Compress to PNG
    IImageWrapperModule& ImageWrapperModule = FModuleManager::LoadModuleChecked<IImageWrapperModule>(FName("ImageWrapper"));
    TSharedPtr<IImageWrapper> ImageWrapper = ImageWrapperModule.CreateImageWrapper(EImageFormat::PNG);

    if (!ImageWrapper.IsValid())
    {
        return false;
    }

    if (!ImageWrapper->SetRaw(Pixels.GetData(), Pixels.Num() * sizeof(FColor), Width, Height, ERGBFormat::BGRA, 8))
    {
        return false;
    }

    TArray64<uint8> CompressedData;
    if (!ImageWrapper->GetCompressed(CompressedData))
    {
        return false;
    }

    return FFileHelper::SaveArrayToFile(CompressedData, *FilePath);
}
