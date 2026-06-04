import imagekit from "@/configs/imageKit";
import { getAuth } from '@/lib/firebase-admin';

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;

    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(token);
    } catch {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = decoded.uid || decoded.user_id || decoded.sub || null;

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const uploadContext = String(formData.get('uploadContext') || '').trim().toLowerCase();
    const isShowcaseBannerUpload = uploadContext === 'showcase-banner';
    const files = [...formData.getAll('files'), ...formData.getAll('file')].filter(Boolean);
    
    if (!files || files.length === 0) {
      return Response.json({ error: "No files provided" }, { status: 400 });
    }

    const uploadedUrls = [];
    
    for (const file of files) {
      // Convert file to buffer
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Determine folder based on file type
      const isVideo = file.type.startsWith('video/');
      const folder = isVideo
        ? 'returns/videos'
        : isShowcaseBannerUpload
          ? 'store/showcase-banners'
          : 'returns/images';
      const filePrefix = isShowcaseBannerUpload ? 'showcase' : 'return';
      const fileName = `${filePrefix}_${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name}`;
      
      // Upload to ImageKit
      const response = await imagekit.upload({
        file: buffer,
        fileName: fileName,
        folder: folder
      });
      
      // Return original uploaded asset URL without transformations.
      // This preserves exact source quality (important for banner text clarity).
      const url = response.url;
      
      uploadedUrls.push(url);
    }

    return Response.json({ 
      success: true,
      url: uploadedUrls[0] || null,
      urls: uploadedUrls 
    });
  } catch (error) {
    console.error('File upload error:', error);
    return Response.json({ 
      error: error.message || "Failed to upload files" 
    }, { status: 500 });
  }
}
