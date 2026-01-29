import { useImageStore } from './store/imageStore';
import { useImageProcessing } from './hooks/useImageProcessing';
import { ImageUploader } from './components/ImageUploader';
import { ThreePanel } from './components/ThreePanel';
import { AlgorithmToggle } from './components/AlgorithmToggle';
import { MosaicViewToggle } from './components/MosaicViewToggle';
import { ExportControls } from './components/ExportControls';
import { QualityMetrics } from './components/QualityMetrics';
import styles from './App.module.css';

function App() {
  const {
    sessionId,
    isProcessing,
    error,
    originalDataUrl,
    mosaicGrayscaleDataUrl,
    mosaicColorizedDataUrl,
    currentMosaicView,
    reconstructedDataUrl,
    currentAlgorithm,
    psnr,
    ssim,
    metricsExpanded,
    exportFormat,
    exportQuality,
    setMosaicView,
    setMetricsExpanded,
    setExportFormat,
    setExportQuality,
  } = useImageStore();

  const {
    handleUpload,
    handleAlgorithmChange,
    handleExport,
    handleReset,
  } = useImageProcessing();

  const hasImage = sessionId !== null;
  const mosaicedDataUrl = currentMosaicView === 'colorized'
    ? mosaicColorizedDataUrl
    : mosaicGrayscaleDataUrl;

  const algorithmLabels: Record<string, string> = {
    nearest_neighbor: 'Nearest Neighbor',
    bilinear: 'Bilinear',
    malvar_he_cutler: 'Malvar-He-Cutler',
  };

  return (
    <div className={styles.app}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <svg viewBox="0 0 32 32" fill="none">
                <rect x="4" y="4" width="10" height="10" fill="#ff4444" opacity="0.9" />
                <rect x="18" y="4" width="10" height="10" fill="#44ff44" opacity="0.9" />
                <rect x="4" y="18" width="10" height="10" fill="#44ff44" opacity="0.9" />
                <rect x="18" y="18" width="10" height="10" fill="#4444ff" opacity="0.9" />
              </svg>
            </div>
            <div className={styles.logoText}>
              <span className={styles.logoTitle}>Image DeMosaique</span>
              <span className={styles.logoSubtitle}>Bayer CFA Simulator</span>
            </div>
          </div>

          {hasImage && (
            <button className={styles.resetButton} onClick={handleReset}>
              <svg viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 8a6 6 0 1011.5 2.5M14 8a6 6 0 00-6-6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M14 2v4h-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>NEW IMAGE</span>
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className={styles.main}>
        {error && (
          <div className={styles.errorBanner}>
            <span className={styles.errorIcon}>!</span>
            <span>{error}</span>
          </div>
        )}

        {!hasImage ? (
          <div className={styles.uploadContainer}>
            <ImageUploader onUpload={handleUpload} isProcessing={isProcessing} />

            <div className={styles.info}>
              <h2 className={styles.infoTitle}>How it works</h2>
              <div className={styles.infoSteps}>
                <div className={styles.infoStep}>
                  <span className={styles.stepNumber}>01</span>
                  <span className={styles.stepText}>Upload a PNG or JPG image</span>
                </div>
                <div className={styles.infoStep}>
                  <span className={styles.stepNumber}>02</span>
                  <span className={styles.stepText}>System applies RGGB Bayer mosaicing</span>
                </div>
                <div className={styles.infoStep}>
                  <span className={styles.stepNumber}>03</span>
                  <span className={styles.stepText}>Compare demosaicing algorithms in real-time</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.workspace}>
            <div className={styles.panelsSection}>
              <ThreePanel
                originalDataUrl={originalDataUrl}
                mosaicedDataUrl={mosaicedDataUrl}
                reconstructedDataUrl={reconstructedDataUrl}
                mosaicViewLabel={currentMosaicView === 'colorized' ? 'Color-coded' : 'Grayscale'}
                algorithmLabel={algorithmLabels[currentAlgorithm]}
                isProcessing={isProcessing}
              />
            </div>

            <aside className={styles.sidebar}>
              <AlgorithmToggle
                value={currentAlgorithm}
                onChange={handleAlgorithmChange}
                disabled={isProcessing}
              />

              <MosaicViewToggle
                value={currentMosaicView}
                onChange={setMosaicView}
                disabled={isProcessing}
              />

              <ExportControls
                format={exportFormat}
                quality={exportQuality}
                onFormatChange={setExportFormat}
                onQualityChange={setExportQuality}
                onExport={handleExport}
                disabled={isProcessing}
              />

              <QualityMetrics
                psnr={psnr}
                ssim={ssim}
                expanded={metricsExpanded}
                onToggle={setMetricsExpanded}
              />
            </aside>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <span className={styles.footerText}>
          RGGB Bayer Pattern • Malvar-He-Cutler Algorithm
        </span>
      </footer>
    </div>
  );
}

export default App;
