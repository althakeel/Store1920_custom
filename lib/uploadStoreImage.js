import axios from 'axios';
import {
  compressImageForUpload,
  getUploadErrorMessage,
  isUploadTooLargeError,
} from '@/lib/compressImageForUpload';

const API_FALLBACK_MAX_BYTES = 900 * 1024;

function folderForType(type = '') {
  if (type === 'logo') return 'brands';
  if (type === 'banner') return 'stores/banners';
  if (type === 'category') return 'categories';
  return 'products';
}

function isVideoFile(file) {
  const mime = String(file?.type || '').toLowerCase();
  if (mime.startsWith('video/')) return true;
  const name = String(file?.name || '').toLowerCase();
  return ['.mp4', '.webm', '.mov', '.m4v', '.avi', '.mkv'].some((ext) => name.endsWith(ext));
}

async function uploadViaPresignedS3(file, { token, type }) {
  const folder = folderForType(type);
  const { data } = await axios.post('/api/store/upload/presign', {
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    folder,
    fileSize: file.size,
  }, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const uploadResponse = await fetch(data.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': data.contentType || file.type || 'application/octet-stream',
    },
  });

  if (!uploadResponse.ok) {
    throw new Error(`Direct S3 upload failed (${uploadResponse.status}). Enable S3 CORS for PUT from your site domain.`);
  }

  return { url: data.publicUrl, success: true };
}

async function uploadViaApi(file, { token, type }) {
  const formData = new FormData();
  formData.append('image', file);
  if (type) formData.append('type', type);

  const { data } = await axios.post('/api/store/upload-image', formData, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return data;
}

/**
 * Compress then upload — prefers direct S3 (bypasses nginx body-size limits).
 */
export async function uploadStoreImage(file, { token, type, compress = true } = {}) {
  if (!file || !token) {
    throw new Error('File and auth token are required');
  }

  let uploadFile = file;
  const shouldCompress = compress && String(file.type || '').startsWith('image/') && !isVideoFile(file);
  if (shouldCompress) {
    uploadFile = await compressImageForUpload(file);
  }

  try {
    return await uploadViaPresignedS3(uploadFile, { token, type });
  } catch (presignError) {
    const canFallback = uploadFile.size <= API_FALLBACK_MAX_BYTES && !isUploadTooLargeError(presignError);
    if (!canFallback) {
      throw new Error(
        presignError?.message
        || 'Upload failed. Enable S3 bucket CORS for browser PUT uploads, or increase nginx client_max_body_size on the server.'
      );
    }
    console.warn('[uploadStoreImage] presigned upload failed, using API fallback:', presignError?.message || presignError);
  }

  try {
    return await uploadViaApi(uploadFile, { token, type });
  } catch (apiError) {
    throw new Error(getUploadErrorMessage(apiError));
  }
}

export async function prepareImagesForProductForm(files = []) {
  const prepared = [];
  for (const file of files) {
    if (!file) continue;
    if (String(file.type || '').startsWith('image/')) {
      prepared.push(await compressImageForUpload(file));
    } else {
      prepared.push(file);
    }
  }
  return prepared;
}
