import type { MosaicView } from '../types';
import styles from './MosaicViewToggle.module.css';

interface MosaicViewToggleProps {
  value: MosaicView;
  onChange: (view: MosaicView) => void;
  disabled?: boolean;
}

export function MosaicViewToggle({ value, onChange, disabled }: MosaicViewToggleProps) {
  const isColorized = value === 'colorized';

  const handleToggle = () => {
    onChange(isColorized ? 'grayscale' : 'colorized');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.label}>MOSAIC VIEW</span>
      </div>

      <div className={styles.toggleWrapper}>
        <button
          className={`${styles.toggleButton} ${!isColorized ? styles.active : ''}`}
          onClick={() => onChange('grayscale')}
          disabled={disabled}
        >
          <svg className={styles.icon} viewBox="0 0 20 20" fill="currentColor">
            <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <circle cx="10" cy="10" r="3" fill="currentColor" />
          </svg>
          <span>Grayscale</span>
        </button>

        <div className={styles.divider} />

        <button
          className={`${styles.toggleButton} ${isColorized ? styles.active : ''}`}
          onClick={() => onChange('colorized')}
          disabled={disabled}
        >
          <svg className={styles.icon} viewBox="0 0 20 20">
            <circle cx="8" cy="8" r="4" fill="#ff4444" opacity="0.8" />
            <circle cx="12" cy="8" r="4" fill="#44ff44" opacity="0.8" />
            <circle cx="10" cy="12" r="4" fill="#4444ff" opacity="0.8" />
          </svg>
          <span>Color-coded</span>
        </button>
      </div>

      <p className={styles.hint}>
        {isColorized
          ? 'R pixels → red, G pixels → green, B pixels → blue'
          : 'Single-channel intensity values'}
      </p>
    </div>
  );
}
