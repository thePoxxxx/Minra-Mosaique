import { useCallback, useState } from 'react';
import styles from './ImageUploader.module.css';

interface ImageUploaderProps {
  onUpload: (file: File) => void;
  isProcessing: boolean;
}

export function ImageUploader({ onUpload, isProcessing }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      onUpload(files[0]);
    }
  }, [onUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUpload(files[0]);
    }
  }, [onUpload]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLine} />
        <span className={styles.headerLabel}>INPUT SOURCE</span>
        <div className={styles.headerLine} />
      </div>

      <label
        className={`${styles.dropzone} ${isDragging ? styles.dragging : ''} ${isProcessing ? styles.processing : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          onChange={handleFileSelect}
          className={styles.fileInput}
          disabled={isProcessing}
        />

        <div className={styles.content}>
          {isProcessing ? (
            <>
              <div className={styles.spinner} />
              <span className={styles.processingText}>PROCESSING</span>
            </>
          ) : (
            <>
              <div className={styles.iconContainer}>
                <svg className={styles.icon} viewBox="0 0 48 48" fill="none">
                  <rect x="8" y="12" width="32" height="24" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="16" cy="20" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 30L16 24L22 28L32 20L40 26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M24 8V12M24 36V40M4 24H8M40 24H44" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <div className={styles.crosshair}>
                  <span /><span /><span /><span />
                </div>
              </div>

              <div className={styles.textContainer}>
                <span className={styles.mainText}>DROP IMAGE FILE</span>
                <span className={styles.subText}>or click to browse</span>
              </div>

              <div className={styles.formatBadges}>
                <span className={styles.badge}>PNG</span>
                <span className={styles.badge}>JPG</span>
              </div>
            </>
          )}
        </div>

        {/* Corner decorations */}
        <div className={`${styles.corner} ${styles.topLeft}`} />
        <div className={`${styles.corner} ${styles.topRight}`} />
        <div className={`${styles.corner} ${styles.bottomLeft}`} />
        <div className={`${styles.corner} ${styles.bottomRight}`} />

        {/* Grid pattern */}
        <div className={styles.gridPattern} />
      </label>
    </div>
  );
}
