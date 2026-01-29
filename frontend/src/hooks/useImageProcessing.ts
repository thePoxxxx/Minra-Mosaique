import { useCallback, useEffect } from 'react';
import { useImageStore } from '../store/imageStore';
import { uploadImage, demosaicImage, exportMosaiced } from '../services/api';
import type { Algorithm, ExportFormat } from '../types';

export function useImageProcessing() {
  const {
    sessionId,
    currentAlgorithm,
    exportFormat,
    exportQuality,
    setSessionId,
    setOriginalImage,
    setMosaicedImages,
    setReconstructedImage,
    setProcessing,
    setError,
    reset,
  } = useImageStore();

  // Handle file upload
  const handleUpload = useCallback(async (file: File) => {
    setProcessing(true);
    setError(null);

    try {
      const response = await uploadImage(file);

      setSessionId(response.session_id);
      setOriginalImage(
        response.original.data_url,
        response.original.width,
        response.original.height
      );
      setMosaicedImages(
        response.mosaiced.grayscale_data_url,
        response.mosaiced.colorized_data_url
      );
      setReconstructedImage(
        response.reconstructed.data_url,
        response.reconstructed.metrics
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
    }
  }, [setSessionId, setOriginalImage, setMosaicedImages, setReconstructedImage, setProcessing, setError]);

  // Re-process when algorithm changes
  useEffect(() => {
    if (!sessionId) return;

    const processImage = async () => {
      setProcessing(true);
      try {
        const result = await demosaicImage(sessionId, currentAlgorithm);
        setReconstructedImage(result.reconstructed_data_url, result.metrics);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Processing failed';
        setError(message);
      }
    };

    processImage();
  }, [sessionId, currentAlgorithm, setReconstructedImage, setProcessing, setError]);

  // Handle algorithm change
  const handleAlgorithmChange = useCallback((algorithm: Algorithm) => {
    useImageStore.getState().setAlgorithm(algorithm);
  }, []);

  // Handle export
  const handleExport = useCallback(async () => {
    if (!sessionId) return;

    setProcessing(true);
    try {
      const blob = await exportMosaiced(sessionId, exportFormat, exportQuality);

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFormat === 'mosaic' ? 'image.mosaic' : 'mosaiced.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProcessing(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      setError(message);
    }
  }, [sessionId, exportFormat, exportQuality, setProcessing, setError]);

  // Handle reset
  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  return {
    handleUpload,
    handleAlgorithmChange,
    handleExport,
    handleReset,
  };
}
