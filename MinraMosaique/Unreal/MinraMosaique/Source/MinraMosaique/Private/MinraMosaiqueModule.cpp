// Copyright Minra. All Rights Reserved.

#include "MinraMosaiqueModule.h"

#define LOCTEXT_NAMESPACE "FMinraMosaiqueModule"

void FMinraMosaiqueModule::StartupModule()
{
    // This code will execute after your module is loaded into memory.
    // The exact timing is specified in the .uplugin file per-module.

    UE_LOG(LogTemp, Log, TEXT("Minra Mosaique: Runtime module loaded."));
}

void FMinraMosaiqueModule::ShutdownModule()
{
    // This function may be called during shutdown to clean up your module.

    UE_LOG(LogTemp, Log, TEXT("Minra Mosaique: Runtime module unloaded."));
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FMinraMosaiqueModule, MinraMosaique)
