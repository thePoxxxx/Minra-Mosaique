// Copyright Minra. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

/**
 * Minra Mosaique Runtime Module
 * Provides GPU-accelerated Bayer demosaicing for decoding combined CFA textures.
 */
class FMinraMosaiqueModule : public IModuleInterface
{
public:
    /** IModuleInterface implementation */
    virtual void StartupModule() override;
    virtual void ShutdownModule() override;

    /**
     * Singleton-like access to this module's interface.
     *
     * @return The singleton instance, loading the module on demand if needed.
     */
    static inline FMinraMosaiqueModule& Get()
    {
        return FModuleManager::LoadModuleChecked<FMinraMosaiqueModule>("MinraMosaique");
    }

    /**
     * Checks if this module is loaded and ready.
     *
     * @return True if the module is loaded, false otherwise.
     */
    static inline bool IsAvailable()
    {
        return FModuleManager::Get().IsModuleLoaded("MinraMosaique");
    }
};
