import ImageKit, { toFile } from '@imagekit/nodejs';

let _imagekit = null;

function getImageKitEnv() {
  return {
    publicKey:
      process.env.IMAGEKIT_PUBLIC_KEY ||
      process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY ||
      '',
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
    urlEndpoint:
      process.env.IMAGEKIT_URL_ENDPOINT ||
      process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ||
      '',
  };
}

export function ensureImageKit() {
  if (_imagekit) return _imagekit;

  const { publicKey, privateKey, urlEndpoint } = getImageKitEnv();
  if (!publicKey || !privateKey || !urlEndpoint) {
    throw new Error(
      'ImageKit is not configured. Set IMAGEKIT_PRIVATE_KEY and NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT.'
    );
  }

  _imagekit = new ImageKit({
    publicKey,
    privateKey,
    urlEndpoint,
  });

  return _imagekit;
}

const imagekit = {
  async upload(options = {}, ...rest) {
    const normalizedOptions = { ...(options || {}) };
    const rawFile = normalizedOptions.file;

    if (Buffer.isBuffer(rawFile) || rawFile instanceof Uint8Array) {
      normalizedOptions.file = await toFile(rawFile, normalizedOptions.fileName || 'upload-file');
    }

    return ensureImageKit().files.upload(normalizedOptions, ...rest);
  },
  url(options = {}) {
    const { path, src, ...rest } = options || {};
    const { urlEndpoint } = getImageKitEnv();

    return ensureImageKit().helper.buildSrc({
      urlEndpoint,
      src: src || path || '',
      ...rest,
    });
  },
  getAuthenticationParameters(...args) {
    return ensureImageKit().helper.getAuthenticationParameters(...args);
  },
};

export default imagekit;
