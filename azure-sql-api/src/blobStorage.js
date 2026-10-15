import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const localEnvPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
} else {
  dotenv.config();
}

/**
 * Azure Blob Storage Configuration
 * Default container: picshesystem
 * Default account name: halls
 */
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || 'picshesystem';
const ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME || 'halls';
const ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY || '';
const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const SAS_TOKEN = process.env.AZURE_STORAGE_SAS_TOKEN || '';

let blobServiceClient = null;
let containerClient = null;
let isInitialized = false;

/**
 * Check if Azure Blob Storage has configuration available
 */
export function isBlobStorageConfigured() {
  return Boolean(
    CONNECTION_STRING.trim() ||
    (ACCOUNT_NAME.trim() && ACCOUNT_KEY.trim()) ||
    (ACCOUNT_NAME.trim() && SAS_TOKEN.trim())
  );
}

/**
 * Initialize and get ContainerClient for picshesystem
 */
export async function getContainerClient() {
  if (containerClient) return containerClient;

  try {
    if (CONNECTION_STRING.trim()) {
      blobServiceClient = BlobServiceClient.fromConnectionString(CONNECTION_STRING.trim());
    } else if (ACCOUNT_NAME.trim() && ACCOUNT_KEY.trim()) {
      const sharedKeyCredential = new StorageSharedKeyCredential(ACCOUNT_NAME.trim(), ACCOUNT_KEY.trim());
      blobServiceClient = new BlobServiceClient(
        `https://${ACCOUNT_NAME.trim()}.blob.core.windows.net`,
        sharedKeyCredential
      );
    } else if (ACCOUNT_NAME.trim() && SAS_TOKEN.trim()) {
      const sas = SAS_TOKEN.startsWith('?') ? SAS_TOKEN : `?${SAS_TOKEN}`;
      blobServiceClient = new BlobServiceClient(
        `https://${ACCOUNT_NAME.trim()}.blob.core.windows.net${sas}`
      );
    } else {
      console.warn('⚠️ Azure Blob Storage: ยังไม่ได้ระบุ AZURE_STORAGE_CONNECTION_STRING หรือ AZURE_STORAGE_ACCOUNT_KEY ใน .env');
      return null;
    }

    containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

    // Try creating container if it does not exist (public access to blob if allowed)
    try {
      await containerClient.createIfNotExists({
        access: 'blob'
      });
      console.log(`✅ เชื่อมต่อ Azure Blob Storage สำเร็จ (Container: ${CONTAINER_NAME})`);
    } catch (createErr) {
      // Container might already exist or account doesn't have permission to create/set ACL
      console.log(`ℹ️ Azure Blob Storage: ใช้ Container "${CONTAINER_NAME}" (${createErr.message.includes('ContainerAlreadyExists') ? 'มีอยู่แล้ว' : createErr.message})`);
    }

    isInitialized = true;
    return containerClient;
  } catch (err) {
    console.error('❌ ไม่สามารถเชื่อมต่อ Azure Blob Storage:', err.message);
    return null;
  }
}

/**
 * Upload an image buffer or stream to Azure Blob Storage
 * @param {Buffer} buffer - File buffer
 * @param {string} originalFilename - Original filename
 * @param {string} mimeType - MIME Type (e.g. image/jpeg, image/png)
 * @returns {Promise<{ key: string, url: string, blobUrl: string }>}
 */
export async function uploadImageToAzureBlob(buffer, originalFilename, mimeType = 'image/jpeg') {
  const container = await getContainerClient();
  if (!container) {
    throw new Error('Azure Blob Storage ยังไม่ได้เชื่อมต่อ กรุณาระบุ Access Key หรือ Connection String ใน .env');
  }

  const ext = path.extname(originalFilename) || '.jpg';
  const safeBase = path.basename(originalFilename, ext).replace(/[^a-zA-Z0-9_\u0E00-\u0E7F-]/g, '_');
  const filename = `${Date.now()}_${safeBase}${ext}`;
  const blobKey = `photos/${filename}`;

  const blockBlobClient = container.getBlockBlobClient(blobKey);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: mimeType,
      blobCacheControl: 'public, max-age=31536000'
    }
  });

  const blobUrl = blockBlobClient.url;
  const proxyUrl = `/api/images/${blobKey}`;

  return {
    key: blobKey,
    url: proxyUrl,
    blobUrl
  };
}

/**
 * Download a blob from Azure Blob Storage as a readable stream
 * @param {string} blobKey - e.g. "photos/12345_test.jpg" or "12345_test.jpg"
 * @returns {Promise<{ stream: NodeJS.ReadableStream, contentType: string, contentLength: number } | null>}
 */
export async function getAzureBlobStream(blobKey) {
  const container = await getContainerClient();
  if (!container) return null;

  // Normalize key: remove leading slashes or /api/images/ prefix if present
  let cleanKey = blobKey.replace(/^\/?(api\/images\/)?/, '');
  
  // If key does not start with photos/, also check if it exists in photos/
  let blockBlobClient = container.getBlockBlobClient(cleanKey);
  let exists = await blockBlobClient.exists();

  if (!exists && !cleanKey.startsWith('photos/')) {
    const withPhotosKey = `photos/${cleanKey}`;
    const altClient = container.getBlockBlobClient(withPhotosKey);
    if (await altClient.exists()) {
      blockBlobClient = altClient;
      exists = true;
    }
  }

  if (!exists) return null;

  const downloadResponse = await blockBlobClient.download();
  return {
    stream: downloadResponse.readableStreamBody,
    contentType: downloadResponse.contentType || 'image/jpeg',
    contentLength: downloadResponse.contentLength
  };
}

/**
 * Delete a blob from Azure Blob Storage
 * @param {string} blobKey - e.g. "photos/12345_test.jpg" or full URL or relative URL
 * @returns {Promise<boolean>}
 */
export async function deleteAzureBlob(blobKey) {
  if (!blobKey) return false;
  const container = await getContainerClient();
  if (!container) return false;

  try {
    let cleanKey = String(blobKey).replace(/https?:\/\/[^\/]+\.blob\.core\.windows\.net\/[^\/]+\//i, '');
    cleanKey = cleanKey.replace(/^\/?(api\/images\/)?/, '');

    let blockBlobClient = container.getBlockBlobClient(cleanKey);
    let exists = await blockBlobClient.exists();

    if (!exists && !cleanKey.startsWith('photos/')) {
      const withPhotosKey = `photos/${cleanKey}`;
      const altClient = container.getBlockBlobClient(withPhotosKey);
      if (await altClient.exists()) {
        blockBlobClient = altClient;
        exists = true;
      }
    }

    if (exists) {
      await blockBlobClient.delete();
      console.log(`🗑️ ลบไฟล์จาก Azure Blob สำเร็จ: ${cleanKey}`);
      return true;
    }
    return false;
  } catch (err) {
    console.warn(`⚠️ ไม่สามารถลบไฟล์จาก Azure Blob (${blobKey}):`, err.message);
    return false;
  }
}

/**
 * Get Storage Information for Health Check
 */
export function getStorageInfo() {
  return {
    type: 'Microsoft Azure Blob Storage',
    container: CONTAINER_NAME,
    account: ACCOUNT_NAME,
    configured: isBlobStorageConfigured(),
    endpoint: `https://${ACCOUNT_NAME}.blob.core.windows.net/${CONTAINER_NAME}`
  };
}
