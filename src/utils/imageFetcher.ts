import { getApiUrl, R2_PUBLIC_BASE_URL, extractPhotoKey } from '../services/storage';
export { R2_PUBLIC_BASE_URL, extractPhotoKey };

/**
 * Directly convert a base64 Data URI into a Blob without using network fetch.
 * Handles whitespace, newlines, and various MIME types safely.
 */
export function dataUriToBlob(dataUri: string): Blob | null {
  try {
    if (!dataUri || !dataUri.startsWith('data:')) return null;
    const parts = dataUri.split(',');
    if (parts.length < 2) return null;

    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const cleanBase64 = parts[1].replace(/\s/g, '');
    const byteStr = atob(cleanBase64);
    const len = byteStr.length;
    const u8arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      u8arr[i] = byteStr.charCodeAt(i);
    }
    return new Blob([u8arr], { type: mime });
  } catch (err) {
    console.warn('[imageFetcher] dataUriToBlob conversion error:', err);
    return null;
  }
}

/**
 * Resolves an image URL so it can be reliably fetched in the browser:
 * - Prioritizes Cloudflare R2 Public CDN directly (bypasses Zscaler blocks & backend proxy issues)
 * - Returns base64 data URIs as-is
 * - Preserves third-party external image URLs (e.g. Unsplash avatars)
 */
export function resolveImageProxyUrl(rawUrl?: string | null): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:')) return trimmed;

  // If already pointing to the public R2 domain, return as-is
  if (trimmed.includes('.r2.dev/')) return trimmed;

  const key = extractPhotoKey(trimmed);
  if (key) {
    return `${R2_PUBLIC_BASE_URL}/${encodeURI(key)}`;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return getApiUrl(trimmed);
}

/**
 * Generates an array of fallback candidate URLs to try fetching from,
 * in order of highest likelihood to succeed.
 */
export function getCandidateUrls(rawUrl: string): string[] {
  const candidates: string[] = [];
  const add = (u?: string | null) => {
    if (u && typeof u === 'string' && u.trim() && !candidates.includes(u.trim())) {
      candidates.push(u.trim());
    }
  };

  if (!rawUrl) return candidates;
  const cleanUrl = rawUrl.trim();
  if (cleanUrl.startsWith('data:')) {
    candidates.push(cleanUrl);
    return candidates;
  }

  const key = extractPhotoKey(cleanUrl);
  if (key) {
    // 1. Direct Cloudflare R2 Public CDN (Top Priority - fast, not blocked by Zscaler, full CORS)
    add(`${R2_PUBLIC_BASE_URL}/${encodeURI(key)}`);
    add(`${R2_PUBLIC_BASE_URL}/${key}`);

    // 2. Same-origin relative path (works on Express port 8787, Azure Static Web Apps, etc.)
    add(`/api/images/${encodeURI(key)}`);
    add(`/api/images/${key}`);

    // 3. Full origin relative path if in browser
    if (typeof window !== 'undefined' && window.location?.origin) {
      add(`${window.location.origin}/api/images/${encodeURI(key)}`);
      add(`${window.location.origin}/api/images/${key}`);
    }

    // 4. Current configured backend via getApiUrl
    add(getApiUrl(`/api/images/${key}`));

    // 5. Local Express / Azure SQL API Server (port 8787)
    add(`http://localhost:8787/api/images/${key}`);

    // 6. Remote Cloudflare Worker fallback
    add(`https://shesystem.anuruk3030.workers.dev/api/images/${key}`);
  }

  // 7. Resolved proxy URL
  add(resolveImageProxyUrl(cleanUrl));

  // 8. Raw URL directly
  add(cleanUrl);

  return candidates;
}

/**
 * Robustly fetches an image URL and returns a Blob.
 * Handles:
 * 1. Data URLs (base64) - instant decode via ArrayBuffer
 * 2. Multi-backend candidate URLs (Cloudflare R2 Public CDN, Same-Origin, Express API 8787, Worker)
 * 3. Validation to reject HTML/JSON error responses disguised as 200 OK (e.g. Zscaler block pages or Vite 504)
 * 4. Fallback to HTMLImageElement + Canvas if fetch is blocked by browser CORS policies
 */
export async function fetchImageAsBlob(rawUrl?: string | null): Promise<Blob | null> {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const cleanUrl = rawUrl.trim();
  if (!cleanUrl) return null;

  // 1. Instant Data URI decode
  if (cleanUrl.startsWith('data:')) {
    const b = dataUriToBlob(cleanUrl);
    if (b && b.size > 0) return b;
  }

  const candidateUrls = getCandidateUrls(cleanUrl);

  // 2. Try fetching each candidate URL in sequence
  for (const url of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s per URL

      const resp = await fetch(url, {
        signal: controller.signal,
        mode: 'cors'
      });
      clearTimeout(timeoutId);

      if (resp.ok && resp.status === 200) {
        const contentType = (resp.headers.get('content-type') || '').toLowerCase();
        // Skip HTML or JSON error/fallback responses (e.g. Zscaler block pages or 404 HTML)
        if (contentType.includes('text/html') || contentType.includes('application/json')) {
          continue;
        }

        const blob = await resp.blob();
        if (blob && blob.size > 100 && !blob.type.includes('html')) {
          return blob;
        }
      }
    } catch (_) {
      // Continue to next candidate
    }
  }

  // 3. Fallback: HTML Image + Canvas (works when direct fetch fails due to certain browser policies)
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    for (const url of candidateUrls) {
      try {
        const canvasBlob = await new Promise<Blob | null>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';

          const timer = setTimeout(() => {
            img.onload = null;
            img.onerror = null;
            resolve(null);
          }, 4000); // 4s timeout

          img.onload = () => {
            clearTimeout(timer);
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || img.width || 800;
              canvas.height = img.naturalHeight || img.height || 600;
              const ctx = canvas.getContext('2d');
              if (!ctx) return resolve(null);
              ctx.drawImage(img, 0, 0);
              canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
            } catch {
              resolve(null);
            }
          };

          img.onerror = () => {
            clearTimeout(timer);
            resolve(null);
          };

          img.src = url;
        });

        if (canvasBlob && canvasBlob.size > 100) {
          return canvasBlob;
        }
      } catch (_) {
        // Try next candidate
      }
    }
  }

  return null;
}

/**
 * Creates a clear, well-formatted placeholder image Blob when the original image
 * file is unreachable on the network/server. This ensures that every exported item
 * has a visual image file inside its equipment folder explaining the status.
 */
export function createFallbackImageBlob(equipCode: string, label: string, originalUrl: string): Blob | null {
  if (typeof document === 'undefined') return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, 800, 600);

    // Border
    ctx.strokeStyle = '#dc2626'; // red-600
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, 788, 588);

    // Header banner
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(12, 12, 776, 110);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('SHE SAFETY MANAGEMENT SYSTEM', 40, 60);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('รายงานรูปภาพอุปกรณ์ความปลอดภัยและดับเพลิง', 40, 95);

    // Equipment Code & Type Card
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(40, 150, 720, 130);

    ctx.fillStyle = '#38bdf8'; // sky-400
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`รหัสอุปกรณ์: ${equipCode}`, 60, 200);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`ประเภทภาพ: ${label}`, 60, 245);

    // Notice Box
    ctx.fillStyle = '#450a0a'; // dark red
    ctx.fillRect(40, 310, 720, 150);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 310, 720, 150);

    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('⚠️ ไม่สามารถดาวน์โหลดไฟล์รูปภาพต้นฉบับได้จากเซิร์ฟเวอร์', 60, 355);

    ctx.fillStyle = '#fecaca';
    ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('สาเหตุที่เป็นไปได้: ไฟล์ถูกลบ, เซิร์ฟเวอร์ออฟไลน์ หรือเครือข่ายบล็อกการเชื่อมต่อ', 60, 395);

    // Truncated URL info
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px monospace';
    const displayUrl = originalUrl.length > 75 ? originalUrl.substring(0, 72) + '...' : originalUrl;
    ctx.fillText(`URL: ${displayUrl}`, 60, 430);

    // Footer
    ctx.fillStyle = '#64748b';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`สร้างโดยระบบอัตโนมัติเมื่อ: ${new Date().toLocaleString('th-TH')}`, 40, 540);

    // Synchronous data URL to Blob
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return dataUriToBlob(dataUrl);
  } catch (err) {
    console.warn('[imageFetcher] createFallbackImageBlob failed:', err);
    return null;
  }
}
