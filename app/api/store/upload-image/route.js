import authSeller from "@/middlewares/authSeller";
import imagekit from "@/configs/imageKit";
import { getAuth } from '@/lib/firebase-admin';


export async function POST(request) {
    try {
        // Get userId from verified Firebase ID token
        const authHeader = request.headers.get('authorization') || '';
        if (!authHeader.startsWith('Bearer ')) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const idToken = authHeader.replace('Bearer ', '');
        let userId = null;
        try {
            const decodedToken = await getAuth().verifyIdToken(idToken);
            userId = decodedToken.uid;
        } catch (authError) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const storeId = await authSeller(userId);
        if (!storeId) {
            return Response.json({ error: "Store not approved or not found" }, { status: 403 });
        }
        const formData = await request.formData();
        const image = formData.get('image');
        const type = formData.get('type'); // 'logo' or 'banner'
        
        if (!image) {
            return Response.json({ error: "No image provided" }, { status: 400 });
        }
        
        // Convert file to buffer
        const buffer = Buffer.from(await image.arrayBuffer());
        
        // Determine folder and transformation based on type
        const folder = type === 'logo' ? 'stores/logos' : type === 'banner' ? 'stores/banners' : 'products/descriptions';
        const fileName = type ? `${type}_${Date.now()}_${image.name}` : `desc_${Date.now()}_${image.name}`;
        
        // Upload to ImageKit
        const response = await imagekit.upload({
            file: buffer,
            fileName: fileName,
            folder: folder
        });
        
        // Return transformed URL based on type
        const transformation = type === 'logo' 
            ? [{ quality: "auto" }, { format: "webp" }, { width: "200", height: "200" }]
            : type === 'banner'
            ? [{ quality: "auto" }, { format: "webp" }, { width: "1200" }]
            : [{ quality: "auto" }, { format: "webp" }, { width: "800" }];
        
        const url = imagekit.url({
            path: response.filePath,
            transformation: transformation
        });
        return Response.json({ 
            success: true, 
            url: url 
        });
    } catch (error) {
        console.error('Image upload error:', error);
        return Response.json({ 
            error: error.message || "Failed to upload image" 
        }, { status: 500 });
    }
}
