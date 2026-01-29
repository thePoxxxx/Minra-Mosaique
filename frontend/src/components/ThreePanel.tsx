import styles from './ThreePanel.module.css';

interface ImagePanelProps {
  label: string;
  sublabel?: string;
  dataUrl: string | null;
  isLoading?: boolean;
  index: number;
}

function ImagePanel({ label, sublabel, dataUrl, isLoading, index }: ImagePanelProps) {
  return (
    <div
      className={styles.panel}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className={styles.panelHeader}>
        <div className={styles.labelGroup}>
          <span className={styles.panelIndex}>{String(index + 1).padStart(2, '0')}</span>
          <span className={styles.panelLabel}>{label}</span>
        </div>
        {sublabel && <span className={styles.panelSublabel}>{sublabel}</span>}
      </div>

      <div className={styles.imageContainer}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner} />
            <span>PROCESSING</span>
          </div>
        ) : dataUrl ? (
          <>
            <img src={dataUrl} alt={label} className={styles.image} />
            <div className={styles.imageOverlay}>
              <div className={styles.cornerMarker} style={{ top: 8, left: 8 }} />
              <div className={styles.cornerMarker} style={{ top: 8, right: 8 }} />
              <div className={styles.cornerMarker} style={{ bottom: 8, left: 8 }} />
              <div className={styles.cornerMarker} style={{ bottom: 8, right: 8 }} />
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <span>NO DATA</span>
          </div>
        )}

        {/* Scan line effect */}
        <div className={styles.scanLine} />
      </div>

      {/* Bottom status bar */}
      <div className={styles.statusBar}>
        <span className={styles.statusDot} data-active={!!dataUrl} />
        <span className={styles.statusText}>
          {dataUrl ? 'READY' : 'WAITING'}
        </span>
      </div>
    </div>
  );
}

interface ThreePanelProps {
  originalDataUrl: string | null;
  mosaicedDataUrl: string | null;
  reconstructedDataUrl: string | null;
  mosaicViewLabel: string;
  algorithmLabel: string;
  isProcessing: boolean;
}

export function ThreePanel({
  originalDataUrl,
  mosaicedDataUrl,
  reconstructedDataUrl,
  mosaicViewLabel,
  algorithmLabel,
  isProcessing,
}: ThreePanelProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLine} />
        <span className={styles.headerLabel}>IMAGE ANALYSIS</span>
        <div className={styles.headerLine} />
      </div>

      <div className={styles.grid}>
        <ImagePanel
          label="ORIGINAL"
          sublabel="RGB Input"
          dataUrl={originalDataUrl}
          index={0}
        />
        <ImagePanel
          label="MOSAICED"
          sublabel={mosaicViewLabel}
          dataUrl={mosaicedDataUrl}
          index={1}
        />
        <ImagePanel
          label="RECONSTRUCTED"
          sublabel={algorithmLabel}
          dataUrl={reconstructedDataUrl}
          isLoading={isProcessing && !reconstructedDataUrl}
          index={2}
        />
      </div>
    </div>
  );
}
