import axios from 'axios';
import {
  compressImageForUpload,
  getUploadErrorMessage,
  isUploadTooLargeError,
} from '@/lib/compressImageForUpload';

function folderForType(type = '') {
  if (type === 'logo') return 'brands';
  if (type === 'banner') return 'stores/banners';
  return 'products';
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
    throw new Error(`Direct upload failed (${uploadResponse.status})`);
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
  if (compress && String(file.type || '').startsWith('image/')) {
    uploadFile = await compressImageForUpload(file);
  }

  try {
    return await uploadViaPresignedS3(uploadFile, { token, type });
  } catch (presignError) {
    if (!isUploadTooLargeError(presignError)) {
      console.warn('[uploadStoreImage] presigned upload failed, falling back to API:', presignError?.message || presignError);
    }
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
