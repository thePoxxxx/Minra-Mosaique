// Copyright Minra. All Rights Reserved.

#include "MSQ3Asset.h"

// MSQ3 Format Constants
namespace MSQ3
{
    const char MAGIC[5] = "MSQ3";
    const uint8 CURRENT_VERSION = 1;
    const int32 HEADER_SIZE = 14;
    const int32 MAX_DIMENSION = 16384;
}

/**
 * MSQ3 Decoder implementation
 * Decodes MSQ3 binary format files containing 3 Bayer CFA patterns.
 */
class FMinraMSQ3Decoder
{
public:
    struct FMQ3Data
    {
        int32 Width = 0;
        int32 Height = 0;
        uint8 Quality = 0;
        TArray<uint8> ChannelR;
        TArray<uint8> ChannelG;
        TArray<uint8> ChannelB;

        bool IsValid() const
        {
            return Width > 0 && Height > 0 &&
                   ChannelR.Num() > 0 &&
                   ChannelG.Num() > 0 &&
                   ChannelB.Num() > 0;
        }
    };

    /**
     * Validates if data contains valid MSQ3 magic bytes.
     */
    static bool IsMSQ3Data(const TArray<uint8>& Data)
    {
        if (Data.Num() < MSQ3::HEADER_SIZE)
        {
            return false;
        }

        return Data[0] == 'M' && Data[1] == 'S' && Data[2] == 'Q' && Data[3] == '3';
    }

    /**
     * Decodes MSQ3 data from raw bytes.
     */
    static TSharedPtr<FMQ3Data> Decode(const TArray<uint8>& Data)
    {
        if (!IsMSQ3Data(Data))
        {
            UE_LOG(LogTemp, Warning, TEXT("Minra Mosaique: Invalid MSQ3 file - magic bytes not found."));
            return nullptr;
        }

        TSharedPtr<FMQ3Data> Result = MakeShared<FMQ3Data>();

        int32 Offset = 4; // Skip magic bytes

        // Read version
        uint8 Version = Data[Offset++];
        if (Version != MSQ3::CURRENT_VERSION)
        {
            UE_LOG(LogTemp, Warning, TEXT("Minra Mosaique: Unsupported MSQ3 version %d. Expected %d."), Version, MSQ3::CURRENT_VERSION);
            return nullptr;
        }

        // Read dimensions (little-endian)
        auto ReadUInt32 = [&Data, &Offset]() -> uint32
        {
            uint32 Value = Data[Offset] |
                          (Data[Offset + 1] << 8) |
                          (Data[Offset + 2] << 16) |
                          (Data[Offset + 3] << 24);
            Offset += 4;
            return Value;
        };

        Result->Width = static_cast<int32>(ReadUInt32());
        Result->Height = static_cast<int32>(ReadUInt32());
        Result->Quality = Data[Offset++];

        // Validate dimensions
        if (Result->Width <= 0 || Result->Height <= 0 ||
            Result->Width > MSQ3::MAX_DIMENSION || Result->Height > MSQ3::MAX_DIMENSION)
        {
            UE_LOG(LogTemp, Warning, TEXT("Minra Mosaique: Invalid MSQ3 dimensions: %dx%d"), Result->Width, Result->Height);
            return nullptr;
        }

        // Read channel data
        auto ReadChannel = [&Data, &Offset, &ReadUInt32]() -> TArray<uint8>
        {
            TArray<uint8> ChannelData;

            if (Offset + 4 > Data.Num())
            {
                return ChannelData;
            }

            uint32 Size = ReadUInt32();

            if (Offset + static_cast<int32>(Size) > Data.Num())
            {
                return ChannelData;
            }

            ChannelData.SetNum(Size);
            FMemory::Memcpy(ChannelData.GetData(), &Data[Offset], Size);
            Offset += Size;

            return ChannelData;
        };

        Result->ChannelR = ReadChannel();
        Result->ChannelG = ReadChannel();
        Result->ChannelB = ReadChannel();

        if (!Result->IsValid())
        {
            UE_LOG(LogTemp, Warning, TEXT("Minra Mosaique: Failed to read MSQ3 channel data."));
            return nullptr;
        }

        return Result;
    }

    /**
     * Decodes MSQ3 file from disk.
     */
    static TSharedPtr<FMQ3Data> DecodeFromFile(const FString& FilePath)
    {
        TArray<uint8> FileData;

        if (!FFileHelper::LoadFileToArray(FileData, *FilePath))
        {
            UE_LOG(LogTemp, Warning, TEXT("Minra Mosaique: Failed to read MSQ3 file: %s"), *FilePath);
            return nullptr;
        }

        return Decode(FileData);
    }
};

// UMSQ3Asset implementation

UMSQ3Asset::UMSQ3Asset()
    : Width(0)
    , Height(0)
    , Quality(0)
    , CombinedTexture(nullptr)
    , Algorithm(EMinraDemosaicAlgorithm::Bilinear)
    , BakedImage1(nullptr)
    , BakedImage2(nullptr)
    , BakedImage3(nullptr)
{
}

bool UMSQ3Asset::IsValid() const
{
    return CombinedTexture != nullptr && Width > 0 && Height > 0;
}

bool UMSQ3Asset::HasBakedTextures() const
{
    return BakedImage1 != nullptr && BakedImage2 != nullptr && BakedImage3 != nullptr;
}

UTexture2D* UMSQ3Asset::GetImage1() const
{
    return BakedImage1 != nullptr ? BakedImage1 : CombinedTexture;
}

UTexture2D* UMSQ3Asset::GetImage2() const
{
    return BakedImage2 != nullptr ? BakedImage2 : CombinedTexture;
}

UTexture2D* UMSQ3Asset::GetImage3() const
{
    return BakedImage3 != nullptr ? BakedImage3 : CombinedTexture;
}
