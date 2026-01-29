/**
 * Image DeMosaique - Main Application
 *
 * Pure client-side Bayer CFA simulator demonstrating
 * mosaicing and demosaicing algorithms.
 */

// Application State
const state = {
    originalImage: null,        // Original ImageData
    originalCanvas: null,       // Original image as canvas
    cfaData: null,              // Single-channel CFA array (Uint8Array) - working copy
    cfaOriginal: null,          // Original full RGGB CFA (before any mode changes)
    cfaCompact: null,           // Compact RG-B CFA data (for export)
    reconstructedData: null,    // Reconstructed RGBA (Uint8ClampedArray)
    width: 0,
    height: 0,
    algorithm: 'frequency_aware',
    viewMode: 'grayscale',      // 'grayscale' or 'colorized'
    mosaicMode: 'standard',     // 'standard' or 'compact'
    exportFormat: 'png',
    exportQuality: 85,
    baseCompression: 'jpeg',    // 'jpeg' or 'webp' for .mosaic/.mosai2 encoding
    metrics: null,
    isProcessing: false,
    metricsExpanded: false,
    isImportedMosaic: false,    // True when loaded from .mosaic/.mosai2 (no original)
    importedFileSize: 0,        // Actual file size of imported .mosaic/.mosai2
    originalFileSize: 0,        // Actual file size of uploaded original image
    // New state for enhancements
    inspectorX: -1,
    inspectorY: -1,
    inspectorZoom: 8,           // 8x, 16x, or 32x
    inspectorShowGrid: true,
    modalPanel: null,           // 'original', 'mosaic', or 'reconstructed'
    modalZoom: 'fit'            // 'fit', '100', or '200'
};

// DOM Elements
let elements = {};

/**
 * Initialize application on DOM ready
 */
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    initializeEventListeners();
    updateUI();
});

/**
 * Cache DOM element references
 */
function initializeElements() {
    elements = {
        // Main sections
        uploadContainer: document.getElementById('upload-container'),
        workspace: document.getElementById('workspace'),
        errorBanner: document.getElementById('error-banner'),
        errorMessage: document.getElementById('error-message'),

        // Uploader
        dropzone: document.getElementById('dropzone'),
        fileInput: document.getElementById('file-input'),
        dropzoneContent: document.getElementById('dropzone-content'),
        processingState: document.getElementById('processing-state'),

        // Panels
        originalPanel: document.getElementById('original-panel'),
        originalImage: document.getElementById('original-image'),
        originalStatus: document.getElementById('original-status'),

        mosaicPanel: document.getElementById('mosaic-panel'),
        mosaicImage: document.getElementById('mosaic-image'),
        mosaicStatus: document.getElementById('mosaic-status'),
        mosaicSublabel: document.getElementById('mosaic-sublabel'),

        reconstructedPanel: document.getElementById('reconstructed-panel'),
        reconstructedImage: document.getElementById('reconstructed-image'),
        reconstructedStatus: document.getElementById('reconstructed-status'),
        reconstructedSublabel: document.getElementById('reconstructed-sublabel'),

        // Controls
        algorithmOptions: document.querySelectorAll('.algorithm-option'),
        viewButtons: document.querySelectorAll('.toggle-button'),
        formatButtons: document.querySelectorAll('.format-btn'),
        qualityRow: document.getElementById('quality-row'),
        qualityLabel: document.getElementById('quality-label'),
        qualitySlider: document.getElementById('quality-slider'),
        qualityValue: document.getElementById('quality-value'),
        sliderFill: document.getElementById('slider-fill'),
        exportButton: document.getElementById('export-button'),
        exportExt: document.getElementById('export-ext'),
        exportLabel: document.getElementById('export-label'),
        compressionRow: document.getElementById('compression-row'),
        compressionButtons: document.querySelectorAll('.compression-btn'),
        compressionInfo: document.getElementById('compression-info'),
        estimateRow: document.getElementById('estimate-row'),
        estimateSize: document.getElementById('estimate-size'),
        estimateFormat: document.getElementById('estimate-format'),

        // Metrics
        metricsHeader: document.getElementById('metrics-header'),
        metricsContent: document.getElementById('metrics-content'),
        metricsChevron: document.getElementById('metrics-chevron'),
        psnrBadge: document.getElementById('psnr-badge'),
        ssimBadge: document.getElementById('ssim-badge'),
        psnrValue: document.getElementById('psnr-value'),
        ssimValue: document.getElementById('ssim-value'),
        psnrQuality: document.getElementById('psnr-quality'),
        ssimQuality: document.getElementById('ssim-quality'),
        psnrFill: document.getElementById('psnr-fill'),
        psnrMarker: document.getElementById('psnr-marker'),
        ssimFill: document.getElementById('ssim-fill'),
        ssimMarker: document.getElementById('ssim-marker'),

        // Reset
        resetButton: document.getElementById('reset-button'),

        // Panel info readouts
        originalResolution: document.getElementById('original-resolution'),
        originalSize: document.getElementById('original-size'),
        mosaicResolution: document.getElementById('mosaic-resolution'),
        mosaicSize: document.getElementById('mosaic-size'),
        reconstructedResolution: document.getElementById('reconstructed-resolution'),
        reconstructedSize: document.getElementById('reconstructed-size'),

        // Expand buttons
        expandButtons: document.querySelectorAll('.expand-btn'),

        // Image containers (for click events)
        imageContainers: document.querySelectorAll('.image-container[data-panel]'),

        // Pixel Inspector
        inspectorXY: document.getElementById('inspector-xy'),
        inspectorHint: document.querySelector('.inspector-hint'),
        inspectorContent: document.getElementById('inspector-content'),
        inspectorOriginal: document.getElementById('inspector-original'),
        inspectorMosaic: document.getElementById('inspector-mosaic'),
        inspectorReconstructed: document.getElementById('inspector-reconstructed'),
        originalPixelRGB: document.getElementById('original-pixel-rgb'),
        mosaicPixelVal: document.getElementById('mosaic-pixel-val'),
        reconstructedPixelRGB: document.getElementById('reconstructed-pixel-rgb'),
        zoomButtons: document.querySelectorAll('.zoom-btn'),
        showGridCheckbox: document.getElementById('show-grid'),

        // Fullscreen Modal
        fullscreenModal: document.getElementById('fullscreen-modal'),
        modalPanelIndex: document.getElementById('modal-panel-index'),
        modalPanelLabel: document.getElementById('modal-panel-label'),
        modalPanelSublabel: document.getElementById('modal-panel-sublabel'),
        modalResolution: document.getElementById('modal-resolution'),
        modalZoom: document.getElementById('modal-zoom'),
        modalClose: document.getElementById('modal-close'),
        modalImage: document.getElementById('modal-image'),
        modalControlBtns: document.querySelectorAll('.modal-control-btn'),

        // Mosaic Mode Toggle (Standard vs Compact)
        modeButtons: document.querySelectorAll('[data-mode]'),
        storageBadge: document.getElementById('storage-ratio'),
        modeDescription: document.getElementById('mode-description')
    };
}

/**
 * Set up event listeners
 */
function initializeEventListeners() {
    // File upload via dropzone
    elements.dropzone.addEventListener('click', () => {
        if (!state.isProcessing) {
            elements.fileInput.click();
        }
    });

    elements.fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    elements.dropzone.addEventListener('dragover', handleDragOver);
    elements.dropzone.addEventListener('dragleave', handleDragLeave);
    elements.dropzone.addEventListener('drop', handleDrop);

    // Algorithm selection
    elements.algorithmOptions.forEach(option => {
        option.addEventListener('click', () => {
            if (!option.disabled) {
                selectAlgorithm(option.dataset.algorithm);
            }
        });
    });

    // View mode toggle (grayscale vs colorized)
    elements.viewButtons.forEach(button => {
        // Only handle view buttons, not mode buttons
        if (button.dataset.view) {
            button.addEventListener('click', () => {
                if (!button.disabled) {
                    selectViewMode(button.dataset.view);
                }
            });
        }
    });

    // Mosaic mode toggle (standard vs compact)
    elements.modeButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (!button.disabled) {
                selectMosaicMode(button.dataset.mode);
            }
        });
    });

    // Export format selection
    elements.formatButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (!button.disabled) {
                selectExportFormat(button.dataset.format);
            }
        });
    });

    // Quality slider
    elements.qualitySlider.addEventListener('input', handleQualityChange);

    // Compression toggle (JPEG vs WebP)
    elements.compressionButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (!button.disabled) {
                selectBaseCompression(button.dataset.compression);
            }
        });
    });

    // Export button
    elements.exportButton.addEventListener('click', handleExport);

    // Metrics toggle
    elements.metricsHeader.addEventListener('click', toggleMetrics);

    // Reset button
    elements.resetButton.addEventListener('click', resetApplication);

    // Expand buttons for fullscreen modal
    elements.expandButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openFullscreenModal(btn.dataset.panel);
        });
    });

    // Image container clicks for pixel inspector
    elements.imageContainers.forEach(container => {
        container.addEventListener('click', (e) => {
            handleImageClick(e, container.dataset.panel);
        });
        container.addEventListener('mousemove', (e) => {
            handleImageHover(e, container.dataset.panel);
        });
        container.addEventListener('mouseleave', () => {
            hideCrosshairs();
        });
    });

    // Zoom buttons for pixel inspector
    elements.zoomButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            setInspectorZoom(parseInt(btn.dataset.zoom, 10));
        });
    });

    // Grid toggle for pixel inspector
    elements.showGridCheckbox.addEventListener('change', (e) => {
        state.inspectorShowGrid = e.target.checked;
        updateInspectorCanvases();
    });

    // Modal close button
    elements.modalClose.addEventListener('click', closeFullscreenModal);

    // Modal backdrop click to close
    document.querySelector('.modal-backdrop')?.addEventListener('click', closeFullscreenModal);

    // Modal zoom controls
    elements.modalControlBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setModalZoom(btn.dataset.zoom);
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !elements.fullscreenModal.classList.contains('hidden')) {
            closeFullscreenModal();
        }
    });
}

/**
 * Handle drag over event
 */
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropzone.classList.add('dragging');
}

/**
 * Handle drag leave event
 */
function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropzone.classList.remove('dragging');
}

/**
 * Handle file drop
 */
function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropzone.classList.remove('dragging');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

/**
 * Handle file selection from input
 */
function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

/**
 * Process uploaded file
 */
function processFile(file) {
    // Check if it's a .mosaic file
    if (file.name.endsWith('.mosaic')) {
        processMosaicFile(file);
        return;
    }

    // Check if it's a .mosai2 file
    if (file.name.endsWith('.mosai2')) {
        processMosai2File(file);
        return;
    }

    // Validate image file type
    if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) {
        showError('Please upload a PNG, JPEG, .mosaic, or .mosai2 file.');
        return;
    }

    // Store the actual file size
    state.originalFileSize = file.size;

    hideError();
    setProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            processImage(img);
        };
        img.onerror = () => {
            showError('Failed to load image.');
            setProcessing(false);
        };
        img.src = e.target.result;
    };
    reader.onerror = () => {
        showError('Failed to read file.');
        setProcessing(false);
    };
    reader.readAsDataURL(file);
}

/**
 * Process .mosaic file
 *
 * When importing a .mosaic file, we don't have the original RGB image.
 * The CFA data goes directly to the Mosaic panel, and we demosaic to show
 * the reconstruction. The Original panel shows a placeholder.
 */
function processMosaicFile(file) {
    hideError();
    setProcessing(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const mosaicData = new Uint8Array(e.target.result);
            const decoded = await MosaicFormat.decodeMosaic(mosaicData);

            state.width = decoded.width;
            state.height = decoded.height;
            state.cfaData = decoded.cfaData;       // Working copy (already expanded if was compact)
            state.cfaOriginal = decoded.cfaData;   // Store as original for mode switching

            // Set mode based on what was stored in the file
            if (decoded.compactMode) {
                state.mosaicMode = 'compact';
                // Recreate compact data for potential re-export
                state.cfaCompact = Mosaicing.applyCompactPacking(
                    decoded.cfaData, decoded.width, decoded.height
                );
            } else {
                state.mosaicMode = 'standard';
                state.cfaCompact = null;
            }

            // No original image available - set to null
            state.originalImage = null;
            state.originalCanvas = null;
            state.isImportedMosaic = true;  // Flag to indicate imported mosaic
            state.importedFileSize = mosaicData.length;  // Store actual file size

            // Auto-select best algorithm for imported files
            state.algorithm = 'frequency_aware';

            // Run demosaicing
            runDemosaicing();

            setProcessing(false);
            updateUI();

            // Show info that this was loaded from .mosaic
            const modeLabel = decoded.compactMode ? ' (Compact RG-B)' : ' (Standard RGGB)';
            console.log(`Loaded .mosaic file: ${state.width}x${state.height}, quality=${decoded.quality}${modeLabel}, size=${mosaicData.length} bytes`);
        } catch (err) {
            showError('Failed to decode .mosaic file: ' + err.message);
            setProcessing(false);
        }
    };
    reader.onerror = () => {
        showError('Failed to read file.');
        setProcessing(false);
    };
    reader.readAsArrayBuffer(file);
}

/**
 * Process .mosai2 file (dual-JPEG compact format)
 *
 * When importing a .mosai2 file, we don't have the original RGB image.
 * The CFA data goes directly to the Mosaic panel, and we demosaic to show
 * the reconstruction. The Original panel shows a placeholder.
 */
function processMosai2File(file) {
    hideError();
    setProcessing(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const mosai2Data = new Uint8Array(e.target.result);
            const decoded = await MosaicFormat2.decodeMosai2(mosai2Data);

            state.width = decoded.width;
            state.height = decoded.height;
            state.cfaData = decoded.cfaData;       // Already expanded with reconstructed G
            state.cfaOriginal = decoded.cfaData;   // Store for mode switching

            // .mosai2 is always compact mode
            state.mosaicMode = 'compact';
            // Recreate the compact data for potential re-export
            state.cfaCompact = Mosaicing.applyCompactPacking(
                decoded.cfaData, decoded.width, decoded.height
            );

            // No original image available - set to null
            state.originalImage = null;
            state.originalCanvas = null;
            state.isImportedMosaic = true;  // Flag to indicate imported mosaic
            state.importedFileSize = mosai2Data.length;  // Store actual file size

            // Auto-select best algorithm for imported files
            state.algorithm = 'frequency_aware';

            // Run demosaicing
            runDemosaicing();

            setProcessing(false);
            updateUI();

            console.log(`Loaded .mosai2 file: ${state.width}x${state.height}, quality=${decoded.quality} (Compact RG-B), size=${mosai2Data.length} bytes`);
        } catch (err) {
            showError('Failed to decode .mosai2 file: ' + err.message);
            setProcessing(false);
        }
    };
    reader.onerror = () => {
        showError('Failed to read file.');
        setProcessing(false);
    };
    reader.readAsArrayBuffer(file);
}

/**
 * Process loaded image
 */
function processImage(img) {
    state.width = img.width;
    state.height = img.height;

    // Create canvas for original image
    const canvas = document.createElement('canvas');
    canvas.width = state.width;
    canvas.height = state.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    state.originalCanvas = canvas;
    state.originalImage = ctx.getImageData(0, 0, state.width, state.height);

    // Apply mosaicing - store as both original and working copy
    const cfa = Mosaicing.applyBayerMosaic(state.originalImage);
    state.cfaOriginal = cfa;  // Keep original for mode switching
    state.cfaData = cfa;      // Working copy

    // Reset mode to standard on new image
    state.mosaicMode = 'standard';
    state.cfaCompact = null;
    state.isImportedMosaic = false;  // This is a real image, not imported mosaic
    state.importedFileSize = 0;

    // Run demosaicing with current algorithm
    runDemosaicing();

    setProcessing(false);
    updateUI();
}

/**
 * Run demosaicing with current algorithm
 */
function runDemosaicing() {
    if (!state.cfaData) return;

    state.reconstructedData = Demosaicing.demosaic(
        state.cfaData,
        state.width,
        state.height,
        state.algorithm
    );

    // Calculate metrics
    calculateMetrics();
}

/**
 * Calculate quality metrics
 */
function calculateMetrics() {
    // Can't calculate metrics without original image (e.g., imported mosaic files)
    if (!state.originalImage || !state.reconstructedData || state.isImportedMosaic) {
        state.metrics = null;
        return;
    }

    state.metrics = Metrics.calculateMetrics(
        state.originalImage.data,
        state.reconstructedData,
        state.width,
        state.height
    );
}

/**
 * Select demosaicing algorithm
 */
function selectAlgorithm(algorithm) {
    if (state.algorithm === algorithm) return;

    state.algorithm = algorithm;

    // Re-run demosaicing
    if (state.cfaData) {
        runDemosaicing();
    }

    updateUI();
}

/**
 * Select mosaic view mode (grayscale vs colorized)
 */
function selectViewMode(mode) {
    if (state.viewMode === mode) return;

    state.viewMode = mode;
    updateUI();
}

/**
 * Select mosaic mode (standard RGGB vs compact RG-B)
 *
 * Standard mode: Full RGGB pattern, W×H storage
 * Compact mode: Drops one G channel, 75% storage (25% smaller)
 */
function selectMosaicMode(mode) {
    if (state.mosaicMode === mode || !state.cfaOriginal) return;

    state.mosaicMode = mode;

    if (mode === 'compact') {
        // Create compact version (drop G from odd rows)
        state.cfaCompact = Mosaicing.applyCompactPacking(
            state.cfaOriginal, state.width, state.height
        );
        // Expand for demosaicing (with reconstructed G copied from neighbors)
        state.cfaData = Mosaicing.expandCompactCFA(
            state.cfaCompact, state.width, state.height
        );
    } else {
        // Restore original full RGGB CFA
        state.cfaData = state.cfaOriginal;
        state.cfaCompact = null;
    }

    // Re-run demosaicing with updated CFA
    runDemosaicing();
    updateUI();
    // Trigger estimate update (data size changed)
    debouncedEstimateUpdate();
}

/**
 * Select export format
 */
function selectExportFormat(format) {
    if (state.exportFormat === format) return;

    state.exportFormat = format;
    updateUI();
    // Trigger estimate update for new format
    debouncedEstimateUpdate();
}

/**
 * Select base compression for .mosaic/.mosai2 encoding
 */
function selectBaseCompression(compression) {
    if (state.baseCompression === compression) return;

    state.baseCompression = compression;
    updateCompressionUI();
}

/**
 * Handle quality slider change
 */
function handleQualityChange(e) {
    state.exportQuality = parseInt(e.target.value, 10);
    updateQualityUI();
    // Trigger debounced estimate update
    debouncedEstimateUpdate();
}

/**
 * Toggle metrics panel
 */
function toggleMetrics() {
    state.metricsExpanded = !state.metricsExpanded;
    updateMetricsUI();
}

/**
 * Handle export
 */
async function handleExport() {
    if (!state.cfaData) return;

    if (state.exportFormat === 'mosaic') {
        // Export as custom .mosaic format (single-channel with adaptive compression)
        // Use compact data if in compact mode, otherwise use full CFA
        const dataToExport = state.mosaicMode === 'compact'
            ? state.cfaCompact
            : state.cfaOriginal;

        const mosaicData = await MosaicFormat.encodeMosaic(
            dataToExport,
            state.width,
            state.height,
            {
                quality: state.exportQuality,
                pattern: MosaicFormat.PATTERN.RGGB,
                compactMode: state.mosaicMode === 'compact',
                adaptive: true,  // Auto-select smallest (PNG vs lossy vs micro)
                baseCompression: state.baseCompression
            }
        );

        // Get size stats for console info
        const stats = MosaicFormat.getSizeStats(dataToExport, mosaicData);
        const modeLabel = state.mosaicMode === 'compact' ? ' (Compact RG-B)' : ' (Standard RGGB)';
        console.log(`Mosaic export${modeLabel}: ${stats.originalSize} bytes -> ${stats.compressedSize} bytes (${stats.ratio}x compression, ${stats.savingsPercent}% savings)`);

        // Create blob and download
        const blob = new Blob([mosaicData], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'image.mosaic';
        link.click();
        URL.revokeObjectURL(url);
        return;
    }

    if (state.exportFormat === 'mosai2') {
        // Export as .mosai2 format (dual-JPEG compact format)
        // This format ALWAYS uses compact mode - uses even rows + B values separately
        // Use the original full CFA as source (the encoder extracts even rows and B values)
        const sourceData = state.cfaOriginal || state.cfaData;

        const mosai2Data = MosaicFormat2.encodeMosai2(
            sourceData,
            state.width,
            state.height,
            {
                quality: state.exportQuality,
                baseCompression: state.baseCompression
            }
        );

        // Get size stats for console info
        const stats = MosaicFormat2.getMosai2Stats(sourceData, mosai2Data, state.width, state.height);
        console.log(`Mosai2 export (Dual-JPEG Compact): ${stats.originalSize} bytes -> ${stats.compressedSize} bytes (${stats.compressionRatio}x compression, ${stats.savingsPercent}% savings)`);

        // Create blob and download
        const blob = new Blob([mosai2Data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'image.mosai2';
        link.click();
        URL.revokeObjectURL(url);
        return;
    }

    // For PNG/JPEG export
    const canvas = document.createElement('canvas');
    canvas.width = state.width;
    canvas.height = state.height;
    const ctx = canvas.getContext('2d');

    let imageData;
    let filenameBase;

    if (state.isImportedMosaic) {
        // For imported mosaics, export the RECONSTRUCTION
        imageData = new ImageData(state.reconstructedData, state.width, state.height);
        filenameBase = 'reconstructed';
    } else {
        // For normal workflow, export the mosaic visualization
        let viewData;
        if (state.viewMode === 'grayscale') {
            viewData = Mosaicing.generateGrayscaleView(state.cfaData, state.width, state.height);
        } else {
            viewData = Mosaicing.generateColorizedView(state.cfaData, state.width, state.height);
        }
        imageData = new ImageData(viewData, state.width, state.height);
        filenameBase = 'mosaic';
    }

    ctx.putImageData(imageData, 0, 0);

    // Export as PNG or JPEG
    let dataUrl, filename;
    if (state.exportFormat === 'png') {
        dataUrl = canvas.toDataURL('image/png');
        filename = filenameBase + '.png';
    } else {
        dataUrl = canvas.toDataURL('image/jpeg', state.exportQuality / 100);
        filename = filenameBase + '.jpg';
    }

    // Trigger download
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
}

/**
 * Reset application state
 */
function resetApplication() {
    state.originalImage = null;
    state.originalCanvas = null;
    state.cfaData = null;
    state.cfaOriginal = null;
    state.cfaCompact = null;
    state.reconstructedData = null;
    state.width = 0;
    state.height = 0;
    state.metrics = null;
    state.isProcessing = false;
    state.mosaicMode = 'standard';
    state.isImportedMosaic = false;
    state.importedFileSize = 0;
    state.originalFileSize = 0;

    // Reset file input
    elements.fileInput.value = '';

    // Reset inspector
    resetInspector();

    // Close modal if open
    closeFullscreenModal();

    updateUI();
}

/**
 * Set processing state
 */
function setProcessing(processing) {
    state.isProcessing = processing;
    elements.dropzone.classList.toggle('processing', processing);
    elements.dropzoneContent.classList.toggle('hidden', processing);
    elements.processingState.classList.toggle('hidden', !processing);
}

/**
 * Show error message
 */
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorBanner.classList.remove('hidden');
}

/**
 * Hide error message
 */
function hideError() {
    elements.errorBanner.classList.add('hidden');
}

/**
 * Update entire UI based on state
 */
function updateUI() {
    const hasImage = state.cfaData !== null;

    // Show/hide sections
    elements.uploadContainer.classList.toggle('hidden', hasImage);
    elements.workspace.classList.toggle('hidden', !hasImage);

    // Update panels
    updatePanelsUI();

    // Update panel info (resolution/size)
    updatePanelInfoUI();

    // Update algorithm selection
    updateAlgorithmUI();

    // Update view toggle
    updateViewToggleUI();

    // Update mosaic mode toggle
    updateMosaicModeUI();

    // Update export controls
    updateExportUI();

    // Update metrics
    updateMetricsUI();

    // Update controls enabled state
    updateControlsState(hasImage);

    // Update inspector if active
    if (state.inspectorX >= 0) {
        updateInspectorCanvases();
    }
}

/**
 * Update image panels
 */
function updatePanelsUI() {
    if (!state.cfaData) return;

    // Original panel - show placeholder if imported mosaic
    if (state.isImportedMosaic || !state.originalCanvas) {
        // Create a placeholder image for imported mosaics
        const placeholderCanvas = document.createElement('canvas');
        placeholderCanvas.width = state.width;
        placeholderCanvas.height = state.height;
        const pCtx = placeholderCanvas.getContext('2d');

        // Dark background with grid pattern
        pCtx.fillStyle = '#0a0b0f';
        pCtx.fillRect(0, 0, state.width, state.height);

        // Draw subtle grid
        pCtx.strokeStyle = '#1a1c26';
        pCtx.lineWidth = 1;
        const gridSize = Math.max(20, Math.min(state.width, state.height) / 10);
        for (let x = 0; x < state.width; x += gridSize) {
            pCtx.beginPath();
            pCtx.moveTo(x, 0);
            pCtx.lineTo(x, state.height);
            pCtx.stroke();
        }
        for (let y = 0; y < state.height; y += gridSize) {
            pCtx.beginPath();
            pCtx.moveTo(0, y);
            pCtx.lineTo(state.width, y);
            pCtx.stroke();
        }

        // Draw "NO SOURCE" text
        const fontSize = Math.max(12, Math.min(state.width, state.height) / 8);
        pCtx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
        pCtx.fillStyle = '#3a3d4a';
        pCtx.textAlign = 'center';
        pCtx.textBaseline = 'middle';
        pCtx.fillText('NO SOURCE', state.width / 2, state.height / 2 - fontSize * 0.3);

        // Draw subtitle
        const subSize = fontSize * 0.4;
        pCtx.font = `400 ${subSize}px 'JetBrains Mono', monospace`;
        pCtx.fillStyle = '#545768';
        pCtx.fillText('IMPORTED MOSAIC', state.width / 2, state.height / 2 + fontSize * 0.5);

        elements.originalImage.src = placeholderCanvas.toDataURL('image/png');
        elements.originalStatus.classList.remove('active');
    } else {
        elements.originalImage.src = state.originalCanvas.toDataURL('image/png');
        elements.originalStatus.classList.add('active');
    }

    // Mosaic panel
    const mosaicCanvas = document.createElement('canvas');
    mosaicCanvas.width = state.width;
    mosaicCanvas.height = state.height;
    const mosaicCtx = mosaicCanvas.getContext('2d');

    let mosaicViewData;
    const isCompact = state.mosaicMode === 'compact';

    if (state.viewMode === 'grayscale') {
        // Use compact visualization if in compact mode (shows dropped G as striped)
        if (isCompact) {
            mosaicViewData = Mosaicing.generateCompactGrayscaleView(state.cfaData, state.width, state.height);
            elements.mosaicSublabel.textContent = 'COMPACT';
        } else {
            mosaicViewData = Mosaicing.generateGrayscaleView(state.cfaData, state.width, state.height);
            elements.mosaicSublabel.textContent = 'GRAYSCALE';
        }
    } else {
        // Use compact visualization if in compact mode (shows dropped G as magenta)
        if (isCompact) {
            mosaicViewData = Mosaicing.generateCompactColorizedView(state.cfaData, state.width, state.height);
            elements.mosaicSublabel.textContent = 'COMPACT';
        } else {
            mosaicViewData = Mosaicing.generateColorizedView(state.cfaData, state.width, state.height);
            elements.mosaicSublabel.textContent = 'COLOR-CODED';
        }
    }

    const mosaicImageData = new ImageData(mosaicViewData, state.width, state.height);
    mosaicCtx.putImageData(mosaicImageData, 0, 0);
    elements.mosaicImage.src = mosaicCanvas.toDataURL('image/png');
    elements.mosaicStatus.classList.add('active');

    // Reconstructed panel
    const reconCanvas = document.createElement('canvas');
    reconCanvas.width = state.width;
    reconCanvas.height = state.height;
    const reconCtx = reconCanvas.getContext('2d');
    const reconImageData = new ImageData(state.reconstructedData, state.width, state.height);
    reconCtx.putImageData(reconImageData, 0, 0);
    elements.reconstructedImage.src = reconCanvas.toDataURL('image/png');
    elements.reconstructedStatus.classList.add('active');

    // Update sublabel with algorithm name
    const algorithmNames = {
        'nearest_neighbor': 'NN',
        'bilinear': 'BILINEAR',
        'malvar_he_cutler': 'MHC',
        'agcrd': 'AGCRD',
        'frequency_aware': 'FAD',
        'bilinear_corrected': 'BLC',
        'smooth_hue': 'SHT'
    };
    elements.reconstructedSublabel.textContent = algorithmNames[state.algorithm] || '';
}

/**
 * Update algorithm selection UI
 */
function updateAlgorithmUI() {
    elements.algorithmOptions.forEach(option => {
        const isActive = option.dataset.algorithm === state.algorithm;
        option.classList.toggle('active', isActive);

        // Toggle active indicator
        const indicator = option.querySelector('.active-indicator');
        if (indicator) {
            indicator.style.display = isActive ? 'flex' : 'none';
        }
    });
}

/**
 * Update view toggle UI
 */
function updateViewToggleUI() {
    elements.viewButtons.forEach(button => {
        // Only handle view buttons (not mode buttons)
        if (button.dataset.view) {
            const isActive = button.dataset.view === state.viewMode;
            button.classList.toggle('active', isActive);
        }
    });
}

/**
 * Update mosaic mode toggle UI (Standard vs Compact)
 */
function updateMosaicModeUI() {
    elements.modeButtons.forEach(button => {
        const isActive = button.dataset.mode === state.mosaicMode;
        button.classList.toggle('active', isActive);
    });

    // Update storage badge
    if (elements.storageBadge) {
        if (state.mosaicMode === 'compact') {
            elements.storageBadge.textContent = '75%';
            elements.storageBadge.classList.add('compact');
        } else {
            elements.storageBadge.textContent = '100%';
            elements.storageBadge.classList.remove('compact');
        }
    }

    // Update description
    if (elements.modeDescription) {
        if (state.mosaicMode === 'compact') {
            elements.modeDescription.textContent = 'RG-B mode: One G channel removed for 25% smaller files';
        } else {
            elements.modeDescription.textContent = 'Full RGGB Bayer pattern with two green channels';
        }
    }
}

/**
 * Update export controls UI
 *
 * Format visibility rules:
 * - Imported mosaic: Only PNG/JPEG (for reconstruction export)
 * - Standard RGGB mode: .MOSAIC + PNG/JPEG
 * - Compact RG-B mode: .MOSAI2 + PNG/JPEG
 */
function updateExportUI() {
    // Update export section label based on context
    if (elements.exportLabel) {
        if (state.isImportedMosaic) {
            elements.exportLabel.textContent = 'EXPORT RECONSTRUCTION';
        } else {
            elements.exportLabel.textContent = 'EXPORT MOSAIC';
        }
    }

    // Determine which formats should be visible
    const showMosaic = !state.isImportedMosaic && state.mosaicMode === 'standard';
    const showMosai2 = !state.isImportedMosaic && state.mosaicMode === 'compact';

    // Show/hide format buttons based on mode
    elements.formatButtons.forEach(button => {
        const format = button.dataset.format;

        // Determine visibility
        let visible = true;
        if (format === 'mosaic') {
            visible = showMosaic;
        } else if (format === 'mosai2') {
            visible = showMosai2;
        }
        // PNG and JPEG are always visible

        button.style.display = visible ? '' : 'none';

        // Update active state
        const isActive = button.dataset.format === state.exportFormat;
        button.classList.toggle('active', isActive);
    });

    // If current format is hidden, auto-select PNG
    if ((state.exportFormat === 'mosaic' && !showMosaic) ||
        (state.exportFormat === 'mosai2' && !showMosai2)) {
        state.exportFormat = 'png';
        // Re-run to update active states
        elements.formatButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.format === 'png');
        });
    }

    // Export extension label
    elements.exportExt.textContent = '.' + state.exportFormat.toUpperCase();

    // Show/hide quality slider based on format
    // PNG is lossless, so no quality slider needed
    const needsQuality = state.exportFormat === 'jpeg' || state.exportFormat === 'mosaic' || state.exportFormat === 'mosai2';
    elements.qualityRow.style.display = needsQuality ? 'flex' : 'none';

    // Show/hide compression toggle based on format (only for .mosaic/.mosai2)
    const needsCompression = state.exportFormat === 'mosaic' || state.exportFormat === 'mosai2';
    if (elements.compressionRow) {
        elements.compressionRow.style.display = needsCompression ? 'flex' : 'none';
    }

    // Show/hide estimate row based on format (only for .mosaic/.mosai2)
    const needsEstimate = (state.exportFormat === 'mosaic' || state.exportFormat === 'mosai2') && state.cfaData;
    if (elements.estimateRow) {
        elements.estimateRow.style.display = needsEstimate ? 'flex' : 'none';
    }

    // Update quality label based on format
    if (state.exportFormat === 'mosaic' || state.exportFormat === 'mosai2') {
        const compLabel = state.baseCompression === 'webp' ? 'WebP' : 'JPEG';
        elements.qualityLabel.textContent = `${compLabel} Compression Quality`;
    } else {
        elements.qualityLabel.textContent = 'JPEG Quality';
    }

    updateQualityUI();
    updateCompressionUI();

    // Trigger estimate calculation if showing .mosaic/.mosai2
    if (needsEstimate) {
        debouncedEstimateUpdate();
    }
}

/**
 * Update quality slider UI
 */
function updateQualityUI() {
    elements.qualityValue.textContent = state.exportQuality + '%';
    elements.sliderFill.style.width = state.exportQuality + '%';
}

/**
 * Update compression toggle UI
 */
function updateCompressionUI() {
    elements.compressionButtons.forEach(button => {
        const isActive = button.dataset.compression === state.baseCompression;
        button.classList.toggle('active', isActive);
    });

    // Update info text
    if (elements.compressionInfo) {
        elements.compressionInfo.textContent = `Adaptive: PNG or ${state.baseCompression.toUpperCase()}, auto-selects smallest`;
    }

    // Trigger estimate update when compression changes
    debouncedEstimateUpdate();
}

// ============================================
// FILE SIZE ESTIMATE FUNCTIONS
// ============================================

// Debounce timer for estimate updates
let estimateDebounceTimer = null;

/**
 * Debounced estimate update (300ms delay)
 */
function debouncedEstimateUpdate() {
    if (estimateDebounceTimer) {
        clearTimeout(estimateDebounceTimer);
    }
    estimateDebounceTimer = setTimeout(() => {
        updateFileSizeEstimate();
    }, 300);
}

/**
 * Calculate and display estimated file size for .mosaic/.mosai2 export
 * This runs the actual encoding to get an accurate size
 */
async function updateFileSizeEstimate() {
    // Only show for .mosaic/.mosai2 formats
    if (state.exportFormat !== 'mosaic' && state.exportFormat !== 'mosai2') {
        if (elements.estimateRow) {
            elements.estimateRow.style.display = 'none';
        }
        return;
    }

    // Need CFA data to estimate
    if (!state.cfaData) {
        if (elements.estimateRow) {
            elements.estimateRow.style.display = 'none';
        }
        return;
    }

    // Show the estimate row
    if (elements.estimateRow) {
        elements.estimateRow.style.display = 'flex';
    }

    // Show calculating state
    if (elements.estimateSize) {
        elements.estimateSize.textContent = 'Calculating...';
        elements.estimateSize.classList.add('calculating');
    }
    if (elements.estimateFormat) {
        elements.estimateFormat.textContent = '';
        elements.estimateFormat.className = 'estimate-format';
    }

    try {
        let encodedData;
        let formatUsed = '';

        if (state.exportFormat === 'mosaic') {
            // Use compact data if in compact mode, otherwise use full CFA
            const dataToExport = state.mosaicMode === 'compact'
                ? state.cfaCompact
                : (state.cfaOriginal || state.cfaData);

            encodedData = await MosaicFormat.encodeMosaic(
                dataToExport,
                state.width,
                state.height,
                {
                    quality: state.exportQuality,
                    pattern: MosaicFormat.PATTERN.RGGB,
                    compactMode: state.mosaicMode === 'compact',
                    adaptive: true,
                    baseCompression: state.baseCompression
                }
            );

            // Detect which format was used (adaptive selection)
            // Header is 20 bytes, image data starts after that
            formatUsed = MosaicFormat.detectCompressionFormat(
                encodedData.subarray(MosaicFormat.HEADER_SIZE)
            ) || state.baseCompression;

        } else if (state.exportFormat === 'mosai2') {
            // .mosai2 always uses compact mode internally
            const sourceData = state.cfaOriginal || state.cfaData;

            encodedData = MosaicFormat2.encodeMosai2(
                sourceData,
                state.width,
                state.height,
                {
                    quality: state.exportQuality,
                    baseCompression: state.baseCompression
                }
            );

            // Detect format from first stream (starts after 28-byte header)
            formatUsed = MosaicFormat.detectCompressionFormat(
                encodedData.subarray(MosaicFormat2.MOSAI2_HEADER_SIZE)
            ) || state.baseCompression;
        }

        // Update display with actual size
        if (elements.estimateSize && encodedData) {
            elements.estimateSize.textContent = formatBytes(encodedData.length);
            elements.estimateSize.classList.remove('calculating');
        }

        // Show which compression format was selected
        if (elements.estimateFormat && formatUsed) {
            elements.estimateFormat.textContent = formatUsed.toUpperCase();
            elements.estimateFormat.className = 'estimate-format ' + formatUsed.toLowerCase();
        }

    } catch (err) {
        console.error('Failed to estimate file size:', err);
        if (elements.estimateSize) {
            elements.estimateSize.textContent = 'Error';
            elements.estimateSize.classList.remove('calculating');
        }
    }
}

/**
 * Update metrics panel UI
 */
function updateMetricsUI() {
    // Toggle expand/collapse
    elements.metricsContent.classList.toggle('hidden', !state.metricsExpanded);
    elements.metricsChevron.classList.toggle('expanded', state.metricsExpanded);

    if (!state.metrics) {
        if (state.isImportedMosaic) {
            // Show special message for imported mosaics
            elements.psnrBadge.textContent = 'N/A';
            elements.ssimBadge.textContent = 'N/A';
            elements.psnrValue.textContent = '--';
            elements.ssimValue.textContent = '--';
            elements.psnrQuality.className = 'quality-badge';
            elements.psnrQuality.textContent = 'NO SOURCE';
            elements.ssimQuality.className = 'quality-badge';
            elements.ssimQuality.textContent = 'NO SOURCE';
            elements.psnrFill.style.width = '0%';
            elements.psnrMarker.style.left = '0%';
            elements.ssimFill.style.width = '0%';
            elements.ssimMarker.style.left = '0%';
        } else {
            elements.psnrBadge.textContent = '--';
            elements.ssimBadge.textContent = '--';
        }
        return;
    }

    const psnr = state.metrics.psnr;
    const ssim = state.metrics.ssim;

    // Update badges in header
    if (psnr === Infinity) {
        elements.psnrBadge.textContent = 'PSNR: PERFECT';
    } else {
        elements.psnrBadge.textContent = 'PSNR: ' + psnr.toFixed(1) + ' dB';
    }
    elements.ssimBadge.textContent = 'SSIM: ' + ssim.toFixed(4);

    // Update detailed values
    if (psnr === Infinity) {
        elements.psnrValue.textContent = '\u221E';
    } else {
        elements.psnrValue.textContent = psnr.toFixed(2);
    }
    elements.ssimValue.textContent = ssim.toFixed(4);

    // Update quality badges
    let psnrQualityClass, psnrQualityText;
    if (psnr === Infinity || psnr >= 40) {
        psnrQualityClass = 'excellent';
        psnrQualityText = 'EXCELLENT';
    } else if (psnr >= 30) {
        psnrQualityClass = 'good';
        psnrQualityText = 'GOOD';
    } else {
        psnrQualityClass = 'fair';
        psnrQualityText = 'FAIR';
    }

    elements.psnrQuality.className = 'quality-badge ' + psnrQualityClass;
    elements.psnrQuality.textContent = psnrQualityText;

    let ssimQualityClass, ssimQualityText;
    if (ssim >= 0.95) {
        ssimQualityClass = 'excellent';
        ssimQualityText = 'EXCELLENT';
    } else if (ssim >= 0.85) {
        ssimQualityClass = 'good';
        ssimQualityText = 'GOOD';
    } else {
        ssimQualityClass = 'fair';
        ssimQualityText = 'FAIR';
    }

    elements.ssimQuality.className = 'quality-badge ' + ssimQualityClass;
    elements.ssimQuality.textContent = ssimQualityText;

    // Update scale bars
    // PSNR: scale 0-60 dB
    const psnrPercent = psnr === Infinity ? 100 : Math.min(100, (psnr / 60) * 100);
    elements.psnrFill.style.width = psnrPercent + '%';
    elements.psnrMarker.style.left = psnrPercent + '%';

    // SSIM: scale 0-1
    const ssimPercent = ssim * 100;
    elements.ssimFill.style.width = ssimPercent + '%';
    elements.ssimMarker.style.left = ssimPercent + '%';
}

/**
 * Update controls enabled/disabled state
 */
function updateControlsState(hasImage) {
    // Algorithm options
    elements.algorithmOptions.forEach(option => {
        option.disabled = !hasImage;
    });

    // View toggle
    elements.viewButtons.forEach(button => {
        button.disabled = !hasImage;
    });

    // Mode toggle (standard vs compact)
    elements.modeButtons.forEach(button => {
        button.disabled = !hasImage;
    });

    // Export controls
    elements.formatButtons.forEach(button => {
        button.disabled = !hasImage;
    });
    elements.qualitySlider.disabled = !hasImage;
    elements.compressionButtons.forEach(button => {
        button.disabled = !hasImage;
    });
    elements.exportButton.disabled = !hasImage;
}

// ============================================
// PANEL INFO & SIZE FUNCTIONS
// ============================================

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Calculate estimated size of image data
 */
function calculateImageSize(width, height, channels) {
    return width * height * channels;
}

/**
 * Update panel info readouts (resolution and size)
 */
function updatePanelInfoUI() {
    if (!state.cfaData) {
        elements.originalResolution.textContent = '--';
        elements.originalSize.textContent = '--';
        elements.mosaicResolution.textContent = '--';
        elements.mosaicSize.textContent = '--';
        elements.reconstructedResolution.textContent = '--';
        elements.reconstructedSize.textContent = '--';
        return;
    }

    const res = `${state.width}x${state.height}`;

    // Original: show actual file size, or N/A for imported mosaics
    elements.originalResolution.textContent = res;
    if (state.isImportedMosaic) {
        elements.originalSize.textContent = 'N/A';
    } else if (state.originalFileSize > 0) {
        elements.originalSize.textContent = formatBytes(state.originalFileSize);
    } else {
        elements.originalSize.textContent = '--';
    }

    // Mosaic: show actual file size for imported files, or raw data size for new mosaics
    elements.mosaicResolution.textContent = res;
    if (state.isImportedMosaic && state.importedFileSize > 0) {
        // Show actual file size from imported .mosaic/.mosai2 file
        elements.mosaicSize.textContent = formatBytes(state.importedFileSize);
    } else if (state.mosaicMode === 'compact' && state.cfaCompact) {
        // Compact mode: show raw data size (before JPEG compression)
        const compactSize = state.cfaCompact.length;
        elements.mosaicSize.textContent = formatBytes(compactSize) + ' raw';
    } else {
        // Standard mode: show raw CFA size (before JPEG compression)
        elements.mosaicSize.textContent = formatBytes(calculateImageSize(state.width, state.height, 1)) + ' raw';
    }

    // Reconstructed: RGB (3 channels) - always raw in-memory size
    elements.reconstructedResolution.textContent = res;
    elements.reconstructedSize.textContent = formatBytes(calculateImageSize(state.width, state.height, 3)) + ' raw';
}

// ============================================
// FULLSCREEN MODAL FUNCTIONS
// ============================================

/**
 * Open fullscreen modal for a panel
 */
function openFullscreenModal(panelType) {
    if (!state.cfaData) return;

    state.modalPanel = panelType;
    state.modalZoom = 'fit';

    // Set modal content based on panel type
    const panelInfo = {
        original: {
            index: '01',
            label: 'ORIGINAL',
            sublabel: state.isImportedMosaic ? 'NO SOURCE' : 'RGB'
        },
        mosaic: { index: '02', label: 'MOSAICED', sublabel: state.viewMode === 'grayscale' ? 'GRAYSCALE' : 'COLOR-CODED' },
        reconstructed: { index: '03', label: 'RECONSTRUCTED', sublabel: elements.reconstructedSublabel.textContent }
    };

    const info = panelInfo[panelType];
    elements.modalPanelIndex.textContent = info.index;
    elements.modalPanelLabel.textContent = info.label;
    elements.modalPanelSublabel.textContent = info.sublabel;
    elements.modalResolution.textContent = `${state.width} x ${state.height}`;

    // Set image source
    let imgSrc;
    if (panelType === 'original') {
        imgSrc = elements.originalImage.src;
    } else if (panelType === 'mosaic') {
        imgSrc = elements.mosaicImage.src;
    } else {
        imgSrc = elements.reconstructedImage.src;
    }
    elements.modalImage.src = imgSrc;

    // Reset zoom
    setModalZoom('fit');

    // Show modal
    elements.fullscreenModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

/**
 * Close fullscreen modal
 */
function closeFullscreenModal() {
    elements.fullscreenModal.classList.add('hidden');
    document.body.style.overflow = '';
    state.modalPanel = null;
}

/**
 * Set modal zoom level
 */
function setModalZoom(zoom) {
    state.modalZoom = zoom;

    // Update button states
    elements.modalControlBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.zoom === zoom);
    });

    // Update image class
    elements.modalImage.classList.remove('zoom-100', 'zoom-200');
    if (zoom === '100') {
        elements.modalImage.classList.add('zoom-100');
        elements.modalZoom.textContent = '100%';
    } else if (zoom === '200') {
        elements.modalImage.classList.add('zoom-200');
        elements.modalZoom.textContent = '200%';
    } else {
        elements.modalZoom.textContent = 'FIT';
    }
}

// ============================================
// PIXEL INSPECTOR FUNCTIONS
// ============================================

/**
 * Handle click on image container for pixel inspector
 */
function handleImageClick(e, panelType) {
    if (!state.cfaData) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const img = e.currentTarget.querySelector('img');
    const imgRect = img.getBoundingClientRect();

    // Calculate click position relative to image
    const x = e.clientX - imgRect.left;
    const y = e.clientY - imgRect.top;

    // Convert to image coordinates
    const scaleX = state.width / imgRect.width;
    const scaleY = state.height / imgRect.height;

    const imgX = Math.floor(x * scaleX);
    const imgY = Math.floor(y * scaleY);

    // Clamp to valid range
    state.inspectorX = Math.max(0, Math.min(state.width - 1, imgX));
    state.inspectorY = Math.max(0, Math.min(state.height - 1, imgY));

    // Update inspector
    updateInspector();
}

/**
 * Handle mouse hover on image container
 */
function handleImageHover(e, panelType) {
    if (!state.cfaData) return;

    const img = e.currentTarget.querySelector('img');
    const imgRect = img.getBoundingClientRect();
    const crosshair = e.currentTarget.querySelector('.inspector-crosshair');

    // Calculate position relative to image
    const x = e.clientX - imgRect.left;
    const y = e.clientY - imgRect.top;

    // Check if within image bounds
    if (x >= 0 && x <= imgRect.width && y >= 0 && y <= imgRect.height) {
        // Convert to image coordinates
        const scaleX = state.width / imgRect.width;
        const scaleY = state.height / imgRect.height;

        const imgX = Math.floor(x * scaleX);
        const imgY = Math.floor(y * scaleY);

        // Update crosshair position
        const crosshairH = crosshair.querySelector('.crosshair-h');
        const crosshairV = crosshair.querySelector('.crosshair-v');
        const crosshairCoords = crosshair.querySelector('.crosshair-coords');

        crosshairH.style.top = y + 'px';
        crosshairV.style.left = x + 'px';
        crosshairCoords.textContent = `${imgX}, ${imgY}`;

        crosshair.classList.remove('hidden');
    }
}

/**
 * Hide all crosshairs
 */
function hideCrosshairs() {
    document.querySelectorAll('.inspector-crosshair').forEach(ch => {
        ch.classList.add('hidden');
    });
}

/**
 * Update pixel inspector display
 */
function updateInspector() {
    if (state.inspectorX < 0 || state.inspectorY < 0) return;

    // Show inspector content, hide hint
    elements.inspectorHint.classList.add('hidden');
    elements.inspectorContent.classList.remove('hidden');

    // Update coordinates display
    elements.inspectorXY.textContent = `${state.inspectorX},${state.inspectorY}`;

    // Update canvases
    updateInspectorCanvases();

    // Update pixel value readouts
    updatePixelReadouts();
}

/**
 * Update inspector canvas displays
 */
function updateInspectorCanvases() {
    if (state.inspectorX < 0 || !state.cfaData) return;

    const zoom = state.inspectorZoom;
    const gridSize = Math.floor(128 / zoom); // How many pixels to show
    const halfGrid = Math.floor(gridSize / 2);

    // Calculate the region to display (centered on click point)
    const startX = Math.max(0, state.inspectorX - halfGrid);
    const startY = Math.max(0, state.inspectorY - halfGrid);

    // Draw original - show placeholder if imported mosaic
    if (state.isImportedMosaic || !state.originalImage) {
        drawInspectorPlaceholder(elements.inspectorOriginal, 'NO SOURCE');
    } else {
        drawInspectorCanvas(
            elements.inspectorOriginal,
            state.originalImage.data,
            startX, startY, gridSize, zoom, 'rgb'
        );
    }

    // Draw mosaic - use compact visualization if in compact mode
    const isCompact = state.mosaicMode === 'compact';
    let mosaicViewData;
    if (state.viewMode === 'grayscale') {
        mosaicViewData = isCompact
            ? Mosaicing.generateCompactGrayscaleView(state.cfaData, state.width, state.height)
            : Mosaicing.generateGrayscaleView(state.cfaData, state.width, state.height);
    } else {
        mosaicViewData = isCompact
            ? Mosaicing.generateCompactColorizedView(state.cfaData, state.width, state.height)
            : Mosaicing.generateColorizedView(state.cfaData, state.width, state.height);
    }
    drawInspectorCanvas(
        elements.inspectorMosaic,
        mosaicViewData,
        startX, startY, gridSize, zoom, 'rgb'
    );

    // Draw reconstructed
    drawInspectorCanvas(
        elements.inspectorReconstructed,
        state.reconstructedData,
        startX, startY, gridSize, zoom, 'rgb'
    );
}

/**
 * Draw zoomed pixel grid on canvas
 */
function drawInspectorCanvas(canvas, imageData, startX, startY, gridSize, zoom, mode) {
    const ctx = canvas.getContext('2d');
    const pixelSize = zoom;

    ctx.clearRect(0, 0, 128, 128);

    // Draw pixels
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            const imgX = startX + x;
            const imgY = startY + y;

            if (imgX >= state.width || imgY >= state.height) continue;

            const idx = (imgY * state.width + imgX) * 4;
            const r = imageData[idx];
            const g = imageData[idx + 1];
            const b = imageData[idx + 2];

            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }
    }

    // Draw grid overlay if enabled
    if (state.inspectorShowGrid && zoom >= 8) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;

        for (let i = 0; i <= gridSize; i++) {
            ctx.beginPath();
            ctx.moveTo(i * pixelSize, 0);
            ctx.lineTo(i * pixelSize, 128);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, i * pixelSize);
            ctx.lineTo(128, i * pixelSize);
            ctx.stroke();
        }
    }

    // Highlight center pixel
    const centerX = Math.floor(gridSize / 2);
    const centerY = Math.floor(gridSize / 2);
    ctx.strokeStyle = '#00ff9d';
    ctx.lineWidth = 2;
    ctx.strokeRect(centerX * pixelSize, centerY * pixelSize, pixelSize, pixelSize);
}

/**
 * Draw placeholder on inspector canvas (for imported mosaics)
 */
function drawInspectorPlaceholder(canvas, text) {
    const ctx = canvas.getContext('2d');

    // Dark background
    ctx.fillStyle = '#0a0b0f';
    ctx.fillRect(0, 0, 128, 128);

    // Draw subtle grid
    ctx.strokeStyle = '#1a1c26';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 128; i += 16) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 128);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(128, i);
        ctx.stroke();
    }

    // Draw text
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#3a3d4a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 64);
}

/**
 * Update pixel value readouts
 */
function updatePixelReadouts() {
    const idx = (state.inspectorY * state.width + state.inspectorX) * 4;

    // Original RGB values - show N/A for imported mosaics
    if (state.isImportedMosaic || !state.originalImage) {
        elements.originalPixelRGB.textContent = 'N/A';
    } else {
        const origR = state.originalImage.data[idx];
        const origG = state.originalImage.data[idx + 1];
        const origB = state.originalImage.data[idx + 2];
        elements.originalPixelRGB.textContent = `R:${origR} G:${origG} B:${origB}`;
    }

    // Mosaic value (single channel)
    const cfaIdx = state.inspectorY * state.width + state.inspectorX;
    const mosaicVal = state.cfaData[cfaIdx];

    // Check if this is a reconstructed G position (compact mode: odd row, even col)
    const isDroppedG = state.mosaicMode === 'compact' &&
                       (state.inspectorY % 2 === 1) &&
                       (state.inspectorX % 2 === 0);

    if (isDroppedG) {
        elements.mosaicPixelVal.textContent = `VAL:${mosaicVal} (COPIED)`;
    } else {
        elements.mosaicPixelVal.textContent = `VAL:${mosaicVal}`;
    }

    // Reconstructed RGB values
    const reconR = state.reconstructedData[idx];
    const reconG = state.reconstructedData[idx + 1];
    const reconB = state.reconstructedData[idx + 2];
    elements.reconstructedPixelRGB.textContent = `R:${reconR} G:${reconG} B:${reconB}`;
}

/**
 * Set inspector zoom level
 */
function setInspectorZoom(zoom) {
    state.inspectorZoom = zoom;

    // Update button states
    elements.zoomButtons.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.zoom, 10) === zoom);
    });

    // Redraw canvases
    updateInspectorCanvases();
}

/**
 * Reset inspector state
 */
function resetInspector() {
    state.inspectorX = -1;
    state.inspectorY = -1;
    elements.inspectorXY.textContent = '--,--';
    elements.inspectorHint.classList.remove('hidden');
    elements.inspectorContent.classList.add('hidden');
}
