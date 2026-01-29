import type { Algorithm } from '../types';
import styles from './AlgorithmToggle.module.css';

interface AlgorithmToggleProps {
  value: Algorithm;
  onChange: (algorithm: Algorithm) => void;
  disabled?: boolean;
}

const algorithms: { value: Algorithm; label: string; shortLabel: string }[] = [
  { value: 'nearest_neighbor', label: 'Nearest Neighbor', shortLabel: 'NN' },
  { value: 'bilinear', label: 'Bilinear', shortLabel: 'BL' },
  { value: 'malvar_he_cutler', label: 'Malvar-He-Cutler', shortLabel: 'MHC' },
];

export function AlgorithmToggle({ value, onChange, disabled }: AlgorithmToggleProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.label}>DEMOSAIC ALGORITHM</span>
      </div>

      <div className={styles.options}>
        {algorithms.map((algo, index) => (
          <button
            key={algo.value}
            className={`${styles.option} ${value === algo.value ? styles.active : ''}`}
            onClick={() => onChange(algo.value)}
            disabled={disabled}
          >
            <span className={styles.optionIndex}>{String(index + 1).padStart(2, '0')}</span>
            <span className={styles.optionLabel}>{algo.label}</span>
            <span className={styles.optionShort}>{algo.shortLabel}</span>

            {value === algo.value && (
              <div className={styles.activeIndicator}>
                <div className={styles.activeDot} />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
