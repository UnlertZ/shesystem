import { getApiUrl } from '../services/storage';

/**
 * Resolves an image URL so it can be reliably fetched in the browser without CORS errors:
 * - If it's a direct Microsoft Azure Blob Storage URL (e.g. https://...blob.core.windows.net/.../photos/xyz.jpg),
 *   it rewrites it to use the backend proxy endpoint `/api/images/photos/xyz.jpg`
 * - If it starts with `photos/`, routes via `/api/images/photos/...`
 * - If it's a relative path like `/api/images/...`, it resolves it via getApiUrl
 * - If it's already a data URI, it is returned as is
 */
export function resolveImageProxyUrl(rawUrl?: string | null): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('data:')) return rawUrl;

  // 1. Check if it's an Azure Blob Storage URL (container: picshesystem or similar)
  // Format: https://<account>.blob.core.windows.net/<container>/photos/<filename>
  const azureBlobMatch = rawUrl.match(/https?:\/\/[^\/]+\.blob\.core\.windows\.net\/[^\/]+\/(.+)/i);
  if (azureBlobMatch && azureBlobMatch[1]) {
    return getApiUrl(`/api/images/${azureBlobMatch[1]}`);
  }

  // 2. If path starts with photos/
  if (rawUrl.startsWith('photos/')) {
    return getApiUrl(`/api/images/${rawUrl}`);
  }

  // 3. If relative path starting with /api/
  if (rawUrl.startsWith('/api/')) {
    return getApiUrl(rawUrl);
  }

  // 4. If full URL that contains /api/images/
  if (rawUrl.includes('/api/images/')) {
    const apiPart = rawUrl.substring(rawUrl.indexOf('/api/images/'));
    return getApiUrl(apiPart);
  }

  return getApiUrl(rawUrl);
}

/**
 * Generates an array of fallback candidate URLs to try fetching from,
 * in order of highest likelihood to succeed.
 */
function getCandidateUrls(rawUrl: string): string[] {
  const candidates: string[] = [];
  const add = (u?: string | null) => {
    if (u && typeof u === 'string' && u.trim() && !candidates.includes(u.trim())) {
      candidates.push(u.trim());
    }
  };

  if (!rawUrl) return candidates;
  if (rawUrl.startsWith('data:')) {
    candidates.push(rawUrl);
    return candidates;
  }

  // Primary resolved proxy URL
  const resolved = resolveImageProxyUrl(rawUrl);
  add(resolved);

  // Raw URL directly
  add(rawUrl);

  // Extract key (e.g. "photos/1760412345_safe.jpg" or "1760412345_safe.jpg")
  let key: string | null = null;
  const photoMatch = rawUrl.match(/(photos\/[^?#]+)/i);
  if (photoMatch) {
    key = photoMatch[1];
  } else {
    const apiImgMatch = rawUrl.match(/\/api\/images\/([^?#]+)/i);
    if (apiImgMatch) {
      key = apiImgMatch[1];
    }
  }

  if (key) {
    // Current backend proxy
    add(getApiUrl(`/api/images/${key}`));
    // Same-origin relative path (useful with Vite proxy or Azure Static Web Apps)
    add(`/api/images/${key}`);
    // Local Express / Azure SQL API server
    add(`http://localhost:8787/api/images/${key}`);
    // Remote Cloudflare Worker fallback
    add(`https://shesystem.anuruk3030.workers.dev/api/images/${key}`);
  }

  return candidates;
}

/**
 * Robustly fetches an image URL and returns a Blob.
 * Handles:
 * 1. Data URLs (base64)
 * 2. Multi-backend candidate URLs (Azure Blob Storage, local API, Cloudflare Worker, Vite proxy)
 * 3. Validation to reject HTML/JSON error responses disguised as 200 OK
 * 4. Fallback to HTMLImageElement + Canvas if fetch is blocked by browser CORS policies
 */
export async function fetchImageAsBlob(rawUrl?: string | null): Promise<Blob | null> {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const cleanUrl = rawUrl.trim();
  if (!cleanUrl) return null;

  // 1. Data URI
  if (cleanUrl.startsWith('data:')) {
    try {
      const res = await fetch(cleanUrl);
      if (res.ok) {
        const b = await res.blob();
        if (b && b.size > 0) return b;
      }
    } catch (_) {
      // Manual decode fallback
      try {
        const parts = cleanUrl.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const byteStr = atob(parts[1]);
        const ab = new ArrayBuffer(byteStr.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteStr.length; i++) {
          ia[i] = byteStr.charCodeAt(i);
        }
        return new Blob([ab], { type: mime });
      } catch (_) {
        return null;
      }
    }
  }

  const candidateUrls = getCandidateUrls(cleanUrl);

  // 2. Try fetching each candidate URL in sequence
  for (const url of candidateUrls) {
    try {
      const resp = await fetch(url, {
        mode: 'cors',
        headers: { Accept: 'image/*,*/*' }
      });

      if (resp.ok && resp.status === 200) {
        const contentType = (resp.headers.get('content-type') || '').toLowerCase();
        // Skip HTML or JSON error/fallback responses
        if (contentType.includes('text/html') || contentType.includes('application/json')) {
          continue;
        }

        const blob = await resp.blob();
        if (blob && blob.size > 0 && !blob.type.includes('html')) {
          return blob;
        }
      }
    } catch (err) {
      // Continue to next candidate
    }
  }

  // 3. Fallback: HTML Image + Canvas (works when direct fetch fails due to certain browser headers)
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
          }, 6000); // 6s timeout

          img.onload = () => {
            clearTimeout(timer);
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || img.width || 800;
              canvas.height = img.naturalHeight || img.height || 600;
              const ctx = canvas.getContext('2d');
              if (!ctx) return resolve(null);
              ctx.drawImage(img, 0, 0);
              canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9);
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

        if (canvasBlob && canvasBlob.size > 0) {
          return canvasBlob;
        }
      } catch (_) {
        // Try next candidate
      }
    }
  }

  return null;
}
