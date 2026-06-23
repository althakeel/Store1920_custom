export function parseImportRowType(value) {
  return String(value || 'simple')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isVariationImportRow(row = {}) {
  const rowType = parseImportRowType(row.Type || row.type);
  return new Set([
    'variation',
    'variant',
    'product variation',
    'product variant',
  ]).has(rowType);
}

export function isVariableImportProductRow(row = {}) {
  const rowType = parseImportRowType(row.Type || row.type);
  return new Set([
    'variable',
    'variable product',
    'product variable',
  ]).has(rowType);
}

export function isSkippableVariationImportRow(row = {}) {
  return isVariationImportRow(row);
}
