// Copyright Minra. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"

/**
 * Minra Mosaique Editor Module
 * Provides editor tools for importing MSQ3 files, custom material expressions,
 * and texture baking utilities.
 */
class FMinraMosaiqueEditorModule : public IModuleInterface
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
    static inline FMinraMosaiqueEditorModule& Get()
    {
        return FModuleManager::LoadModuleChecked<FMinraMosaiqueEditorModule>("MinraMosaiqueEditor");
    }

    /**
     * Checks if this module is loaded and ready.
     *
     * @return True if the module is loaded, false otherwise.
     */
    static inline bool IsAvailable()
    {
        return FModuleManager::Get().IsModuleLoaded("MinraMosaiqueEditor");
    }

private:
    /** Register custom asset types */
    void RegisterAssetTypes();

    /** Unregister custom asset types */
    void UnregisterAssetTypes();
};
