import { NextResponse } from 'next/server';
import formidable from 'formidable';
import fs from 'fs';
import { uploadToS3 } from '@/lib/storage';

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req) {
  try {
    const form = new formidable.IncomingForm();
    const data = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });
    const file = data.files.image;
    if (!file) {
      return NextResponse.json({ error: 'No image uploaded' }, { status: 400 });
    }

    const buffer = fs.readFileSync(file.filepath);
    const uploadResponse = await uploadToS3({
      buffer,
      fileName: file.originalFilename,
      folder: 'uploads',
      contentType: file.mimetype || undefined,
    });

    return NextResponse.json({ url: uploadResponse.url });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
