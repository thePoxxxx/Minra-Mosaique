export type Algorithm = 'nearest_neighbor' | 'bilinear' | 'malvar_he_cutler';
export type MosaicView = 'grayscale' | 'colorized';
export type ExportFormat = 'mosaic' | 'png';

export interface Metrics {
  psnr: number;
  ssim: number;
}

export interface OriginalImageData {
  width: number;
  height: number;
  dataUrl: string;
}

export interface MosaicedImageData {
  grayscaleDataUrl: string;
  colorizedDataUrl: string;
}

export interface ReconstructedImageData {
  dataUrl: string;
  metrics: Metrics;
}

export interface UploadResponse {
  session_id: string;
  original: {
    width: number;
    height: number;
    data_url: string;
  };
  mosaiced: {
    grayscale_data_url: string;
    colorized_data_url: string;
  };
  reconstructed: {
    data_url: string;
    metrics: Metrics;
  };
}

export interface DemosaicResponse {
  reconstructed_data_url: string;
  metrics: Metrics;
}
