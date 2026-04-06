export default function normalizeImportedRichText(value = '') {
  return String(value || '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/=\"\"([^\"]*)\"\"/g, '="$1"')
    .replace(/contenteditable=\"false\"/gi, 'contenteditable="false"')
    .replace(/contenteditable=\"true\"/gi, 'contenteditable="true"')
    .trim();
}