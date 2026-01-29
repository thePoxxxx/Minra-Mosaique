import type { ExportFormat } from '../types';
import styles from './ExportControls.module.css';

interface ExportControlsProps {
  format: ExportFormat;
  quality: number;
  onFormatChange: (format: ExportFormat) => void;
  onQualityChange: (quality: number) => void;
  onExport: () => void;
  disabled?: boolean;
}

export function ExportControls({
  format,
  quality,
  onFormatChange,
  onQualityChange,
  onExport,
  disabled,
}: ExportControlsProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.label}>EXPORT MOSAICED</span>
      </div>

      <div className={styles.controls}>
        <div className={styles.formatRow}>
          <span className={styles.rowLabel}>Format</span>
          <div className={styles.formatButtons}>
            <button
              className={`${styles.formatBtn} ${format === 'mosaic' ? styles.active : ''}`}
              onClick={() => onFormatChange('mosaic')}
              disabled={disabled}
            >
              <span className={styles.formatExt}>.mosaic</span>
              <span className={styles.formatDesc}>Custom + JPEG</span>
            </button>
            <button
              className={`${styles.formatBtn} ${format === 'png' ? styles.active : ''}`}
              onClick={() => onFormatChange('png')}
              disabled={disabled}
            >
              <span className={styles.formatExt}>.png</span>
              <span className={styles.formatDesc}>Lossless</span>
            </button>
          </div>
        </div>

        {format === 'mosaic' && (
          <div className={styles.qualityRow}>
            <div className={styles.qualityHeader}>
              <span className={styles.rowLabel}>Quality</span>
              <span className={styles.qualityValue}>{quality}%</span>
            </div>
            <div className={styles.sliderContainer}>
              <input
                type="range"
                min="1"
                max="100"
                value={quality}
                onChange={(e) => onQualityChange(Number(e.target.value))}
                className={styles.slider}
                disabled={disabled}
              />
              <div className={styles.sliderTrack}>
                <div
                  className={styles.sliderFill}
                  style={{ width: `${quality}%` }}
                />
              </div>
              <div className={styles.sliderMarks}>
                <span>1</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>
          </div>
        )}

        <button
          className={styles.exportButton}
          onClick={onExport}
          disabled={disabled}
        >
          <svg className={styles.exportIcon} viewBox="0 0 20 20" fill="none">
            <path
              d="M10 3v10M10 13l-4-4M10 13l4-4M4 17h12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>DOWNLOAD</span>
          <span className={styles.exportExt}>
            {format === 'mosaic' ? '.mosaic' : '.png'}
          </span>
        </button>
      </div>
    </div>
  );
}
