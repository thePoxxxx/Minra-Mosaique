import { useState } from 'react';
import styles from './QualityMetrics.module.css';

interface QualityMetricsProps {
  psnr: number | null;
  ssim: number | null;
  expanded: boolean;
  onToggle: (expanded: boolean) => void;
}

export function QualityMetrics({ psnr, ssim, expanded, onToggle }: QualityMetricsProps) {
  const getPSNRQuality = (value: number): { label: string; color: string } => {
    if (value >= 40) return { label: 'EXCELLENT', color: 'var(--phosphor)' };
    if (value >= 35) return { label: 'VERY GOOD', color: 'var(--cyan)' };
    if (value >= 30) return { label: 'GOOD', color: 'var(--amber)' };
    return { label: 'FAIR', color: 'var(--error)' };
  };

  const getSSIMQuality = (value: number): { label: string; color: string } => {
    if (value >= 0.95) return { label: 'EXCELLENT', color: 'var(--phosphor)' };
    if (value >= 0.90) return { label: 'VERY GOOD', color: 'var(--cyan)' };
    if (value >= 0.80) return { label: 'GOOD', color: 'var(--amber)' };
    return { label: 'FAIR', color: 'var(--error)' };
  };

  const psnrQuality = psnr ? getPSNRQuality(psnr) : null;
  const ssimQuality = ssim ? getSSIMQuality(ssim) : null;

  return (
    <div className={styles.container}>
      <button
        className={styles.header}
        onClick={() => onToggle(!expanded)}
      >
        <div className={styles.headerLeft}>
          <svg
            className={`${styles.chevron} ${expanded ? styles.expanded : ''}`}
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M6 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.label}>QUALITY METRICS</span>
        </div>

        {!expanded && psnr !== null && ssim !== null && (
          <div className={styles.summaryBadges}>
            <span
              className={styles.badge}
              style={{ color: psnrQuality?.color }}
            >
              PSNR: {psnr.toFixed(1)}dB
            </span>
            <span
              className={styles.badge}
              style={{ color: ssimQuality?.color }}
            >
              SSIM: {ssim.toFixed(3)}
            </span>
          </div>
        )}
      </button>

      {expanded && (
        <div className={styles.content}>
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricName}>PSNR</span>
              <span className={styles.metricUnit}>Peak Signal-to-Noise Ratio</span>
            </div>
            {psnr !== null ? (
              <div className={styles.metricBody}>
                <div className={styles.metricValue}>
                  <span className={styles.valueNumber}>{psnr.toFixed(2)}</span>
                  <span className={styles.valueUnit}>dB</span>
                </div>
                <div className={styles.metricQuality}>
                  <span
                    className={styles.qualityBadge}
                    style={{
                      color: psnrQuality?.color,
                      borderColor: psnrQuality?.color,
                    }}
                  >
                    {psnrQuality?.label}
                  </span>
                </div>
                <div className={styles.metricScale}>
                  <div className={styles.scaleBar}>
                    <div
                      className={styles.scaleFill}
                      style={{
                        width: `${Math.min((psnr / 50) * 100, 100)}%`,
                        background: psnrQuality?.color,
                      }}
                    />
                    <div
                      className={styles.scaleMarker}
                      style={{ left: `${Math.min((psnr / 50) * 100, 100)}%` }}
                    />
                  </div>
                  <div className={styles.scaleLabels}>
                    <span>0</span>
                    <span>25</span>
                    <span>50+</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.noData}>NO DATA</div>
            )}
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricName}>SSIM</span>
              <span className={styles.metricUnit}>Structural Similarity Index</span>
            </div>
            {ssim !== null ? (
              <div className={styles.metricBody}>
                <div className={styles.metricValue}>
                  <span className={styles.valueNumber}>{ssim.toFixed(4)}</span>
                </div>
                <div className={styles.metricQuality}>
                  <span
                    className={styles.qualityBadge}
                    style={{
                      color: ssimQuality?.color,
                      borderColor: ssimQuality?.color,
                    }}
                  >
                    {ssimQuality?.label}
                  </span>
                </div>
                <div className={styles.metricScale}>
                  <div className={styles.scaleBar}>
                    <div
                      className={styles.scaleFill}
                      style={{
                        width: `${ssim * 100}%`,
                        background: ssimQuality?.color,
                      }}
                    />
                    <div
                      className={styles.scaleMarker}
                      style={{ left: `${ssim * 100}%` }}
                    />
                  </div>
                  <div className={styles.scaleLabels}>
                    <span>0</span>
                    <span>0.5</span>
                    <span>1.0</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.noData}>NO DATA</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
