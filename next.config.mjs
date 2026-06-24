/** @type {import('next').NextConfig} */
const domains = ['store1920-images.s3.ap-south-1.amazonaws.com', 'ik.imagekit.io'];
// Allow placehold.co for demo/placeholder images
if (!domains.includes('placehold.co')) domains.push('placehold.co');
// Allow Flixcart CDN for category images
if (!domains.includes('rukminim2.flixcart.com')) domains.push('rukminim2.flixcart.com');
// Store1920 media / WordPress uploads (category images, catalog imports)
if (!domains.includes('db.store1920.com')) domains.push('db.store1920.com');
// Amazon product image CDNs (imported / scraped catalog images)
[
    'm.media-amazon.com',
    'images-na.ssl-images-amazon.com',
    'images-eu.ssl-images-amazon.com',
    'images-fe.ssl-images-amazon.com',
    'ecx.images-amazon.com',
    'images.amazon.com',
].forEach((host) => {
    if (!domains.includes(host)) domains.push(host);
});
try {
    if (process.env.AWS_S3_PUBLIC_URL) {
        const u = new URL(process.env.AWS_S3_PUBLIC_URL);
        if (!domains.includes(u.hostname)) domains.push(u.hostname);
    }
    if (process.env.NEXT_PUBLIC_AWS_S3_PUBLIC_URL) {
        const u2 = new URL(process.env.NEXT_PUBLIC_AWS_S3_PUBLIC_URL);
        if (!domains.includes(u2.hostname)) domains.push(u2.hostname);
    }
    if (process.env.IMAGEKIT_URL_ENDPOINT) {
        const ik = new URL(process.env.IMAGEKIT_URL_ENDPOINT);
        if (!domains.includes(ik.hostname)) domains.push(ik.hostname);
    }
    if (process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT) {
        const ik2 = new URL(process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT);
        if (!domains.includes(ik2.hostname)) domains.push(ik2.hostname);
    }
} catch {}



// Add Googleusercontent domain for images
if (!domains.includes('lh3.googleusercontent.com')) domains.push('lh3.googleusercontent.com');

const nextConfig = {
    images: {
        unoptimized: false,
        // `domains` is deprecated but still required for Turbopack dev image allowlist in Next 16.
        domains,
        remotePatterns: [
            ...domains.map((host) => ({ protocol: 'https', hostname: host, pathname: '/**' })),
            { protocol: 'https', hostname: '*.media-amazon.com', pathname: '/**' },
            { protocol: 'https', hostname: '*.ssl-images-amazon.com', pathname: '/**' },
            { protocol: 'https', hostname: '*.store1920.com', pathname: '/**' },
            { protocol: 'https', hostname: 'ik.imagekit.io', pathname: '/**' },
        ],
        formats: ['image/avif', 'image/webp'],
        deviceSizes: [320, 420, 640, 768, 1024, 1280, 1536, 1920],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
        qualities: [75, 85, 90, 100]
    },
    compress: true,
    proxyClientMaxBodySize: '200mb',
    experimental: {
        serverActions: {
            bodySizeLimit: '200mb'
        },
        optimizePackageImports: [
            'lucide-react',
            'react-icons',
            'date-fns',
            'recharts',
            '@tiptap/react',
            '@tiptap/starter-kit',
            'firebase/auth',
            'firebase/app',
            'react-redux',
        ],
    },
    serverExternalPackages: ['mongoose', 'firebase-admin'],
    turbopack: {},

    webpack: (config, { dev }) => {
        config.module.rules.push({
            test: /\.mp3$/i,
            type: 'asset/resource',
        });
        if (dev) {
            // Avoid EPERM cache rename failures on Windows when multiple tools touch .next/cache
            config.cache = { type: 'memory' };
        }
        return config;
    },

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
                source: '/',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, s-maxage=60, stale-while-revalidate=300',
                    },
                ],
            },
            {
                source: '/product/:slug*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, s-maxage=120, stale-while-revalidate=600',
                    },
                ],
            },
            {
                source: '/shop',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, s-maxage=120, stale-while-revalidate=600',
                    },
                ],
            },
            {
                source: '/categories',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, s-maxage=300, stale-while-revalidate=900',
                    },
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
