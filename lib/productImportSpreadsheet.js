import * as XLSX from 'xlsx';

const normalizeHeaderRow = (headerRow = []) => {
  const seen = new Map();

  return headerRow.map((value, index) => {
    const baseHeader = String(value || `Column ${index + 1}`).trim() || `Column ${index + 1}`;
    const duplicateCount = seen.get(baseHeader) || 0;
    seen.set(baseHeader, duplicateCount + 1);

    return duplicateCount > 0 ? `${baseHeader} (${duplicateCount + 1})` : baseHeader;
  });
};

export function sheetToRows(sheet) {
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  });

  const headerIndex = matrix.findIndex((row) => Array.isArray(row) && row.some((cell) => String(cell || '').trim() !== ''));
  if (headerIndex === -1) return [];

  const headers = normalizeHeaderRow(matrix[headerIndex] || []);

  return matrix
    .slice(headerIndex + 1)
    .filter((row) => Array.isArray(row) && row.some((cell) => String(cell || '').trim() !== ''))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

export async function parseProductImportFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error('No worksheet found in file');
  }

  return sheetToRows(workbook.Sheets[sheetName]);
}
