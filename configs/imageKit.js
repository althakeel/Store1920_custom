import ImageKit from "@imagekit/nodejs";

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

// Default export preserves existing imports; methods resolve to the instance on first use
const imagekit = new Proxy({}, {
    get(_target, prop) {
        const ik = ensureImageKit();
        // @ts-ignore - dynamic property access on ImageKit instance
        return ik[prop];
    }
});

export default imagekit;