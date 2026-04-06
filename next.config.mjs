/** @type {import('next').NextConfig} */
// Always allow ImageKit host used by project images
const domains = ['ik.imagekit.io'];
// Allow placehold.co for demo/placeholder images
if (!domains.includes('placehold.co')) domains.push('placehold.co');
// Allow Flixcart CDN for category images
if (!domains.includes('rukminim2.flixcart.com')) domains.push('rukminim2.flixcart.com');
try {
    if (process.env.IMAGEKIT_URL_ENDPOINT) {
        const u = new URL(process.env.IMAGEKIT_URL_ENDPOINT);
        if (!domains.includes(u.hostname)) domains.push(u.hostname);
    }
    if (process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT) {
        const u2 = new URL(process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT);
        if (!domains.includes(u2.hostname)) domains.push(u2.hostname);
    }
} catch {}



// Add Googleusercontent domain for images
if (!domains.includes('lh3.googleusercontent.com')) domains.push('lh3.googleusercontent.com');

const nextConfig = {
    images: {
        unoptimized: true,
        domains,
        // Allow the same hosts via remotePatterns for fine-grained control
        remotePatterns: [
            ...domains.map((host) => ({ protocol: 'https', hostname: host, pathname: '/:path*' })),
            { protocol: 'https', hostname: '**', pathname: '/:path*' },
            { protocol: 'http', hostname: '**', pathname: '/:path*' },
        ],
        formats: ['image/avif', 'image/webp'],
        deviceSizes: [320, 420, 640, 768, 1024, 1280, 1536, 1920],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
        qualities: [75, 85, 90, 100]
    },
    // Enable response compression (gzip/brotli) to reduce payload size by 70%
    compress: true,
    // Increase body size limit for product uploads with multiple images (up to 4MB per image)
    experimental: {
        serverActions: {
            bodySizeLimit: '50mb'
        }
    },
    serverExternalPackages: ['mongoose'],

    // Skip static generation for authenticated routes
    async headers() {
        return [
            {
                // Apply security headers to all routes
                source: '/:path*',
                headers: [
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on'
                    },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=31536000; includeSubDomains'
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN'
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff'
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block'
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin'
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()'
                    }
                ],
            },
            {
                source: '/store/:path*',
                headers: [
                    {
                        key: 'X-Robots-Tag',
                        value: 'noindex',
                    },
                    {
                        key: 'Cache-Control',
                        value: 'private, no-cache, no-store, must-revalidate'
                    }
                ],
            },
            {
                source: '/admin/:path*',
                headers: [
                    {
                        key: 'X-Robots-Tag',
                        value: 'noindex',
                    },
                    {
                        key: 'Cache-Control',
                        value: 'private, no-cache, no-store, must-revalidate'
                    }
                ],
            },
            {
                // API routes security
                source: '/api/:path*',
                headers: [
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff'
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY'
                    }
                ]
            }
        ];
    },
};

export default nextConfig;
