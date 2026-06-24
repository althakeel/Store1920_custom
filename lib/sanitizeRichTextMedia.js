const DATA_URI_IN_HTML = /src=(["'])(data:(?:image|video)\/[^"']+)\1/gi;

/**
 * Uploads embedded data: URIs inside rich HTML to S3 and replaces them with public URLs.
 */
export async function sanitizeRichTextMedia(html, uploadFile) {
  const source = String(html || '');
  if (!source || !source.includes('data:')) return source;

  let output = source;
  const seen = new Set();
  const matches = [...source.matchAll(DATA_URI_IN_HTML)];

  for (const match of matches) {
    const dataUrl = match[2];
    if (!dataUrl || seen.has(dataUrl)) continue;
    seen.add(dataUrl);

    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const extension = blob.type?.includes('video') ? 'mp4' : 'jpg';
      const file = new File([blob], `embedded_${Date.now()}.${extension}`, {
        type: blob.type || (extension === 'mp4' ? 'video/mp4' : 'image/jpeg'),
      });
      const uploaded = await uploadFile(file);
      const url = uploaded?.url || uploaded;
      if (url) {
        output = output.split(dataUrl).join(url);
      }
    } catch (error) {
      console.warn('[sanitizeRichTextMedia] skipped embedded asset:', error?.message || error);
    }
  }

  return output;
}
