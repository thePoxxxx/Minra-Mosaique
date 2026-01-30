// Copyright Minra. All Rights Reserved.

#include "MSQ3Factory.h"
#include "MSQ3Asset.h"
#include "Engine/Texture2D.h"
#include "EditorFramework/AssetImportData.h"

#define LOCTEXT_NAMESPACE "MSQ3Factory"

UMSSQ3Factory::UMSSQ3Factory(const FObjectInitializer& ObjectInitializer)
    : Super(ObjectInitializer)
{
    bCreateNew = false;
    bEditAfterNew = false;
    bEditorImport = true;
    bText = false;

    SupportedClass = UMSQ3Asset::StaticClass();

    Formats.Add(TEXT("msq3;MSQ3 Combined CFA Image"));
}

bool UMSSQ3Factory::FactoryCanImport(const FString& Filename)
{
    return Filename.EndsWith(TEXT(".msq3"), ESearchCase::IgnoreCase);
}

UObject* UMSSQ3Factory::FactoryCreateBinary(
    UClass* InClass,
    UObject* InParent,
    FName InName,
    EObjectFlags Flags,
    UObject* Context,
    const TCHAR* Type,
    const uint8*& Buffer,
    const uint8* BufferEnd,
    FFeedbackContext* Warn)
{
    // Validate magic bytes
    int32 DataSize = BufferEnd - Buffer;
    if (DataSize < 14)
    {
        Warn->Logf(ELogVerbosity::Error, TEXT("Minra Mosaique: MSQ3 file too small."));
        return nullptr;
    }

    if (Buffer[0] != 'M' || Buffer[1] != 'S' || Buffer[2] != 'Q' || Buffer[3] != '3')
    {
        Warn->Logf(ELogVerbosity::Error, TEXT("Minra Mosaique: Invalid MSQ3 magic bytes."));
        return nullptr;
    }

    // Read version
    uint8 Version = Buffer[4];
    if (Version != 1)
    {
        Warn->Logf(ELogVerbosity::Error, TEXT("Minra Mosaique: Unsupported MSQ3 version %d."), Version);
        return nullptr;
    }

    // Read dimensions (little-endian)
    auto ReadUInt32 = [](const uint8* Data) -> uint32
    {
        return Data[0] | (Data[1] << 8) | (Data[2] << 16) | (Data[3] << 24);
    };

    uint32 Width = ReadUInt32(Buffer + 5);
    uint32 Height = ReadUInt32(Buffer + 9);
    uint8 Quality = Buffer[13];

    // Validate dimensions
    if (Width == 0 || Height == 0 || Width > 16384 || Height > 16384)
    {
        Warn->Logf(ELogVerbosity::Error, TEXT("Minra Mosaique: Invalid dimensions %dx%d."), Width, Height);
        return nullptr;
    }

    // Create the asset
    UMSQ3Asset* NewAsset = NewObject<UMSQ3Asset>(InParent, InClass, InName, Flags);
    if (!NewAsset)
    {
        return nullptr;
    }

    NewAsset->Width = static_cast<int32>(Width);
    NewAsset->Height = static_cast<int32>(Height);
    NewAsset->Quality = Quality;
    NewAsset->Algorithm = EMinraDemosaicAlgorithm::Bilinear;

    // Read channel data sizes and WebP blobs
    // Note: Full implementation would decode WebP here
    // For now, we store the raw data and create a placeholder texture

    int32 Offset = 14;

    // Read R channel
    if (Offset + 4 > DataSize)
    {
        Warn->Logf(ELogVerbosity::Error, TEXT("Minra Mosaique: Unexpected end of file reading R channel size."));
        return nullptr;
    }
    uint32 RSize = ReadUInt32(Buffer + Offset);
    Offset += 4 + RSize;

    // Read G channel
    if (Offset + 4 > DataSize)
    {
        Warn->Logf(ELogVerbosity::Error, TEXT("Minra Mosaique: Unexpected end of file reading G channel size."));
        return nullptr;
    }
    uint32 GSize = ReadUInt32(Buffer + Offset);
    Offset += 4 + GSize;

    // Read B channel
    if (Offset + 4 > DataSize)
    {
        Warn->Logf(ELogVerbosity::Error, TEXT("Minra Mosaique: Unexpected end of file reading B channel size."));
        return nullptr;
    }
    uint32 BSize = ReadUInt32(Buffer + Offset);

    // Create a placeholder combined texture
    // In a full implementation, you would decode the WebP channels and combine them
    NewAsset->CombinedTexture = CreatePlaceholderTexture(NewAsset->Width, NewAsset->Height);

    Warn->Logf(ELogVerbosity::Log,
        TEXT("Minra Mosaique: Imported MSQ3 file. Dimensions: %dx%d, Quality: %d. WebP decoding requires external library."),
        Width, Height, Quality);

    return NewAsset;
}

UTexture2D* UMSSQ3Factory::CreatePlaceholderTexture(int32 Width, int32 Height)
{
    UTexture2D* Texture = UTexture2D::CreateTransient(Width, Height, PF_R8G8B8A8);
    if (!Texture)
    {
        return nullptr;
    }

    // Create a gradient pattern to show it's a placeholder
    FTexture2DMipMap& Mip = Texture->GetPlatformData()->Mips[0];
    void* Data = Mip.BulkData.Lock(LOCK_READ_WRITE);

    if (Data)
    {
        uint8* Pixels = static_cast<uint8*>(Data);

        for (int32 Y = 0; Y < Height; ++Y)
        {
            for (int32 X = 0; X < Width; ++X)
            {
                int32 Index = (Y * Width + X) * 4;

                // Gradient pattern
                uint8 R = static_cast<uint8>((X * 255) / Width);
                uint8 G = static_cast<uint8>((Y * 255) / Height);
                uint8 B = 128;

                Pixels[Index + 0] = R;
                Pixels[Index + 1] = G;
                Pixels[Index + 2] = B;
                Pixels[Index + 3] = 255;
            }
        }

        Mip.BulkData.Unlock();
    }

    Texture->UpdateResource();
    return Texture;
}

bool UMSSQ3Factory::DoesSupportClass(UClass* Class)
{
    return Class == UMSQ3Asset::StaticClass();
}

UClass* UMSSQ3Factory::ResolveSupportedClass()
{
    return UMSQ3Asset::StaticClass();
}

// Reimport handlers

bool UMSSQ3Factory::CanReimport(UObject* Obj, TArray<FString>& OutFilenames)
{
    UMSQ3Asset* Asset = Cast<UMSQ3Asset>(Obj);
    if (Asset)
    {
        // Would need to store source file path in the asset
        return false;
    }
    return false;
}

void UMSSQ3Factory::SetReimportPaths(UObject* Obj, const TArray<FString>& NewReimportPaths)
{
    // Store new reimport paths
}

EReimportResult::Type UMSSQ3Factory::Reimport(UObject* Obj)
{
    return EReimportResult::Failed;
}

#undef LOCTEXT_NAMESPACE
