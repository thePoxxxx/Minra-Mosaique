import { create } from 'zustand';
import type { Algorithm, MosaicView, ExportFormat, Metrics } from '../types';

interface ImageState {
  // Session
  sessionId: string | null;
  isProcessing: boolean;
  error: string | null;

  // Original image
  originalDataUrl: string | null;
  originalWidth: number;
  originalHeight: number;

  // Mosaiced image (both views cached)
  mosaicGrayscaleDataUrl: string | null;
  mosaicColorizedDataUrl: string | null;
  currentMosaicView: MosaicView;

  // Reconstructed image
  reconstructedDataUrl: string | null;
  currentAlgorithm: Algorithm;

  // Quality metrics
  psnr: number | null;
  ssim: number | null;
  metricsExpanded: boolean;

  // Export settings
  exportFormat: ExportFormat;
  exportQuality: number;

  // Actions
  setSessionId: (id: string) => void;
  setOriginalImage: (dataUrl: string, width: number, height: number) => void;
  setMosaicedImages: (grayscale: string, colorized: string) => void;
  setMosaicView: (view: MosaicView) => void;
  setAlgorithm: (algorithm: Algorithm) => void;
  setReconstructedImage: (dataUrl: string, metrics: Metrics) => void;
  setMetricsExpanded: (expanded: boolean) => void;
  setExportFormat: (format: ExportFormat) => void;
  setExportQuality: (quality: number) => void;
  setProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  isProcessing: false,
  error: null,
  originalDataUrl: null,
  originalWidth: 0,
  originalHeight: 0,
  mosaicGrayscaleDataUrl: null,
  mosaicColorizedDataUrl: null,
  currentMosaicView: 'grayscale' as MosaicView,
  reconstructedDataUrl: null,
  currentAlgorithm: 'malvar_he_cutler' as Algorithm,
  psnr: null,
  ssim: null,
  metricsExpanded: false,
  exportFormat: 'mosaic' as ExportFormat,
  exportQuality: 85,
};

export const useImageStore = create<ImageState>((set) => ({
  ...initialState,

  setSessionId: (id) => set({ sessionId: id }),

  setOriginalImage: (dataUrl, width, height) => set({
    originalDataUrl: dataUrl,
    originalWidth: width,
    originalHeight: height,
  }),

  setMosaicedImages: (grayscale, colorized) => set({
    mosaicGrayscaleDataUrl: grayscale,
    mosaicColorizedDataUrl: colorized,
  }),

  setMosaicView: (view) => set({ currentMosaicView: view }),

  setAlgorithm: (algorithm) => set({
    currentAlgorithm: algorithm,
    // Clear reconstructed to show loading state
    reconstructedDataUrl: null,
    psnr: null,
    ssim: null,
  }),

  setReconstructedImage: (dataUrl, metrics) => set({
    reconstructedDataUrl: dataUrl,
    psnr: metrics.psnr,
    ssim: metrics.ssim,
    isProcessing: false,
  }),

  setMetricsExpanded: (expanded) => set({ metricsExpanded: expanded }),

  setExportFormat: (format) => set({ exportFormat: format }),

  setExportQuality: (quality) => set({ exportQuality: quality }),

  setProcessing: (processing) => set({ isProcessing: processing }),

  setError: (error) => set({ error, isProcessing: false }),

  reset: () => set(initialState),
}));
