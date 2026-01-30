// Copyright Minra. All Rights Reserved.

#include "MinraDemosaicTexture.h"
#include "Engine/Texture2D.h"

UMinraDemosaicTexture::UMinraDemosaicTexture()
    : CombinedTexture(nullptr)
    , Algorithm(EMinraDemosaicAlgorithm::Bilinear)
    , BakedImage1(nullptr)
    , BakedImage2(nullptr)
    , BakedImage3(nullptr)
{
}

bool UMinraDemosaicTexture::IsValid() const
{
    return CombinedTexture != nullptr &&
           CombinedTexture->GetSizeX() > 0 &&
           CombinedTexture->GetSizeY() > 0;
}

bool UMinraDemosaicTexture::HasBakedTextures() const
{
    return BakedImage1 != nullptr &&
           BakedImage2 != nullptr &&
           BakedImage3 != nullptr;
}

UTexture2D* UMinraDemosaicTexture::GetImage1() const
{
    return BakedImage1 != nullptr ? BakedImage1 : CombinedTexture;
}

UTexture2D* UMinraDemosaicTexture::GetImage2() const
{
    return BakedImage2 != nullptr ? BakedImage2 : CombinedTexture;
}

UTexture2D* UMinraDemosaicTexture::GetImage3() const
{
    return BakedImage3 != nullptr ? BakedImage3 : CombinedTexture;
}

UTexture2D* UMinraDemosaicTexture::CreateFallbackTexture(int32 Width, int32 Height)
{
    // Create a magenta/black checkerboard pattern to indicate error
    UTexture2D* Fallback = UTexture2D::CreateTransient(Width, Height, PF_R8G8B8A8);

    if (!Fallback)
    {
        return nullptr;
    }

    Fallback->UpdateResource();

    // Lock the texture for writing
    FTexture2DMipMap& Mip = Fallback->GetPlatformData()->Mips[0];
    void* Data = Mip.BulkData.Lock(LOCK_READ_WRITE);

    if (Data)
    {
        uint8* Pixels = static_cast<uint8*>(Data);
        const int32 CheckerSize = 8;

        for (int32 Y = 0; Y < Height; ++Y)
        {
            for (int32 X = 0; X < Width; ++X)
            {
                int32 Index = (Y * Width + X) * 4;
                bool IsEven = ((X / CheckerSize) + (Y / CheckerSize)) % 2 == 0;

                if (IsEven)
                {
                    // Magenta
                    Pixels[Index + 0] = 255;  // R
                    Pixels[Index + 1] = 0;    // G
                    Pixels[Index + 2] = 255;  // B
                    Pixels[Index + 3] = 255;  // A
                }
                else
                {
                    // Black
                    Pixels[Index + 0] = 0;
                    Pixels[Index + 1] = 0;
                    Pixels[Index + 2] = 0;
                    Pixels[Index + 3] = 255;
                }
            }
        }

        Mip.BulkData.Unlock();
    }

    Fallback->UpdateResource();

    return Fallback;
}

#if WITH_EDITOR
void UMinraDemosaicTexture::SetBakedTextures(UTexture2D* Image1, UTexture2D* Image2, UTexture2D* Image3)
{
    BakedImage1 = Image1;
    BakedImage2 = Image2;
    BakedImage3 = Image3;

    Modify();
}

void UMinraDemosaicTexture::ClearBakedTextures()
{
    BakedImage1 = nullptr;
    BakedImage2 = nullptr;
    BakedImage3 = nullptr;

    Modify();
}
#endif
