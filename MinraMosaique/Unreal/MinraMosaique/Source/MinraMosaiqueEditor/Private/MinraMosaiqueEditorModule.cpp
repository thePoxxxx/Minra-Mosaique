// Copyright Minra. All Rights Reserved.

#include "MinraMosaiqueEditorModule.h"
#include "AssetToolsModule.h"
#include "IAssetTools.h"

#define LOCTEXT_NAMESPACE "FMinraMosaiqueEditorModule"

void FMinraMosaiqueEditorModule::StartupModule()
{
    // This code will execute after your module is loaded into memory.

    UE_LOG(LogTemp, Log, TEXT("Minra Mosaique: Editor module loaded."));

    RegisterAssetTypes();
}

void FMinraMosaiqueEditorModule::ShutdownModule()
{
    // This function may be called during shutdown to clean up your module.

    UE_LOG(LogTemp, Log, TEXT("Minra Mosaique: Editor module unloaded."));

    UnregisterAssetTypes();
}

void FMinraMosaiqueEditorModule::RegisterAssetTypes()
{
    // Register asset type actions for MSQ3 files
    IAssetTools& AssetTools = FModuleManager::LoadModuleChecked<FAssetToolsModule>("AssetTools").Get();

    // Custom asset categories could be registered here
    // AssetTools.RegisterAdvancedAssetCategory(FName(TEXT("MinraMosaique")), LOCTEXT("MinraMosaiqueCategory", "Minra Mosaique"));
}

void FMinraMosaiqueEditorModule::UnregisterAssetTypes()
{
    // Cleanup asset type registrations
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FMinraMosaiqueEditorModule, MinraMosaiqueEditor)
