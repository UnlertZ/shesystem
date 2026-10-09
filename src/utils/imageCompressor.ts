/**
 * High-performance client-side image compression utility
 * Reduces image size by 90-97% before uploading to Cloudflare R2 / Server,
 * saving storage quota, reducing upload bandwidth, and speeding up PDF exports.
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/webp';
}

/**
 * Compresses an image File or Blob to target dimensions and quality.
 * Returns a new File object with reduced file size (typically ~80-250 KB instead of 5-15 MB).
 */
export async function compressImage(
  file: File | Blob,
  options: CompressOptions = {}
): Promise<File> {
  const {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.8,
    mimeType = 'image/jpeg'
  } = options;

  // If not an image or is SVG/GIF (animated), return original file safely
  if (file.type && (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif')) {
    if (file instanceof File) return file;
    return new File([file], 'image.jpg', { type: file.type });
  }

  // If already small (< 150KB) and already JPEG/WebP, skip compression
  if (file.size <= 150 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/webp')) {
    if (file instanceof File) return file;
    return new File([file], 'image.jpg', { type: file.type });
  }

  return new Promise((resolve) => {
    // If not in browser environment (SSR), fallback to original
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      if (file instanceof File) return resolve(file);
      return resolve(new File([file], 'image.jpg', { type: file.type }));
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Scale down while maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        if (file instanceof File) return resolve(file);
        return resolve(new File([file], 'image.jpg', { type: file.type }));
      }

      // Smooth downsampling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Fill canvas with white background (handles transparent PNGs gracefully when converted to JPEG)
      if (mimeType === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            if (file instanceof File) return resolve(file);
            return resolve(new File([file], 'image.jpg', { type: file.type }));
          }

          // If compression somehow resulted in a larger file (very rare edge case), keep original if it was already File
          if (file instanceof File && blob.size >= file.size && file.type === mimeType) {
            return resolve(file);
          }

          const originalName = (file as File).name || 'compressed_image.jpg';
          const ext = mimeType === 'image/webp' ? '.webp' : '.jpg';
          const newName = originalName.replace(/\.[^/.]+$/, '') + ext;

          const compressedFile = new File([blob], newName, {
            type: mimeType,
            lastModified: Date.now()
          });

          const originalKb = (file.size / 1024).toFixed(1);
          const compressedKb = (compressedFile.size / 1024).toFixed(1);
          const savedPercent = (((file.size - compressedFile.size) / file.size) * 100).toFixed(1);

          console.log(
            `%c[Image Compressor] %cReduced size from ${originalKb} KB to ${compressedKb} KB (saved ${savedPercent}%)`,
            'color: #10b981; font-weight: bold;',
            'color: #0f172a;'
          );

          resolve(compressedFile);
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      if (file instanceof File) return resolve(file);
      resolve(new File([file], 'image.jpg', { type: file.type }));
    };

    img.src = objectUrl;
  });
}
