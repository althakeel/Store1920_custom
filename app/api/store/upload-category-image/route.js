import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';

function parseAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const parts = auth.split(' ');
  return parts.length === 2 ? parts[1] : null;
}

export async function POST(req) {
  try {
    console.log('Category image upload request received');

    const token = parseAuthHeader(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify token
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;
    console.log('Token verified for user:', userId);

    const body = await req.json();
    const { base64Image, fileName } = body;

    if (!base64Image) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    // Validate base64 format
    if (!base64Image.startsWith('data:')) {
      return NextResponse.json(
        { error: 'Invalid image format. Must be base64 data URL.' },
        { status: 400 }
      );
    }

    console.log('Uploading to ImageKit:', fileName);

    // Extract base64 data and media type
    const matches = base64Image.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      console.error('Base64 regex match failed');
      return NextResponse.json(
        { error: 'Invalid base64 format' },
        { status: 400 }
      );
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    console.log(`Image data: ${base64Data.length} bytes, type: ${mimeType}`);

    // Determine file extension from mime type
    const extensionMap = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
    };
    const extension = extensionMap[mimeType] || '.jpg';
    const fileNameWithExt = `${fileName || `category-${Date.now()}`}${extension}`;

    // Use ImageKit REST API with JSON body - send COMPLETE data URL
    const authHeader = Buffer.from(
      `${process.env.IMAGEKIT_PRIVATE_KEY}:`
    ).toString('base64');
    
    console.log('Sending to ImageKit:', fileNameWithExt);

    // Create FormData for ImageKit upload
    const formData = new FormData();
    formData.append('file', base64Data);
    formData.append('fileName', fileNameWithExt);
    formData.append('folder', '/Brandstored/home-categories');

    const uploadResponse = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
      },
      body: formData,
    });

    console.log('ImageKit response status:', uploadResponse.status);

    const responseText = await uploadResponse.text();
    console.log('ImageKit response:', responseText.substring(0, 200));

    if (!uploadResponse.ok) {
      console.error('ImageKit API error:', responseText);
      throw new Error(`ImageKit upload failed: ${uploadResponse.status} - ${responseText.substring(0, 100)}`);
    }

    const uploadedData = JSON.parse(responseText);
    console.log('Image uploaded to ImageKit:', uploadedData.url);
    console.log('Full ImageKit response:', JSON.stringify(uploadedData, null, 2));

    // Ensure URL has file extension
    let finalUrl = uploadedData.url;
    if (uploadedData.url && !uploadedData.url.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
      console.warn('ImageKit URL missing extension, appending:', extension);
      finalUrl = `${uploadedData.url}${extension}`;
    }

    return NextResponse.json(
      {
        url: finalUrl,
        fileId: uploadedData.fileId,
        message: 'Image uploaded successfully'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error uploading image:', error.message);
    return NextResponse.json(
      { error: error.message || 'Failed to upload image' },
      { status: 500 }
    );
  }
}

