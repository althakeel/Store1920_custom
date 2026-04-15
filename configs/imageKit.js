import ImageKit, { toFile } from "@imagekit/nodejs";

// Lazy initialize ImageKit to avoid build-time crashes when env vars are missing
let _imagekit = null;

export function ensureImageKit() {
    if (_imagekit) return _imagekit;
    const { IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT } = process.env;
    if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_PRIVATE_KEY || !IMAGEKIT_URL_ENDPOINT) {
        throw new Error("ImageKit is not configured");
    }
    _imagekit = new ImageKit({
        publicKey: IMAGEKIT_PUBLIC_KEY,
        privateKey: IMAGEKIT_PRIVATE_KEY,
        urlEndpoint: IMAGEKIT_URL_ENDPOINT,
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
        return ensureImageKit().helper.buildSrc({
            urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
            src: src || path || '',
            ...rest,
        });
    },
    getAuthenticationParameters(...args) {
        return ensureImageKit().helper.getAuthenticationParameters(...args);
    },
};

export default imagekit;