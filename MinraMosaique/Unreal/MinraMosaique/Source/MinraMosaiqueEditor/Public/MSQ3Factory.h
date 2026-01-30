// Copyright Minra. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Factories/Factory.h"
#include "EditorReimportHandler.h"
#include "MSQ3Factory.generated.h"

/**
 * Factory for importing MSQ3 files.
 * Creates UMSQ3Asset objects from .msq3 binary files.
 */
UCLASS(hidecategories = Object)
class UMSSQ3Factory : public UFactory, public FReimportHandler
{
    GENERATED_UCLASS_BODY()

    //~ Begin UFactory Interface
    virtual bool FactoryCanImport(const FString& Filename) override;
    virtual UObject* FactoryCreateBinary(UClass* InClass, UObject* InParent, FName InName, EObjectFlags Flags, UObject* Context, const TCHAR* Type, const uint8*& Buffer, const uint8* BufferEnd, FFeedbackContext* Warn) override;
    virtual bool DoesSupportClass(UClass* Class) override;
    virtual UClass* ResolveSupportedClass() override;
    //~ End UFactory Interface

    //~ Begin FReimportHandler Interface
    virtual bool CanReimport(UObject* Obj, TArray<FString>& OutFilenames) override;
    virtual void SetReimportPaths(UObject* Obj, const TArray<FString>& NewReimportPaths) override;
    virtual EReimportResult::Type Reimport(UObject* Obj) override;
    //~ End FReimportHandler Interface

private:
    /** Creates a placeholder texture for MSQ3 files (WebP decoding not implemented) */
    static UTexture2D* CreatePlaceholderTexture(int32 Width, int32 Height);
};
