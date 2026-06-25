import * as XLSX from 'xlsx'

function normalizeHeaderKey(value = '') {
  return String(value || '')
    .replace(/^\ufeff/, '')
    .trim()
}

function normalizeCellValue(cell) {
  if (cell === null || cell === undefined) return ''
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return cell.toISOString()
  }
  return String(cell).trim()
}

function expandSheetBounds(sheet) {
  if (!sheet) {
    return { minR: 0, minC: 0, maxR: 0, maxC: 0 }
  }

  let minR = Infinity
  let minC = Infinity
  let maxR = 0
  let maxC = 0

  for (const key of Object.keys(sheet)) {
    if (key[0] === '!') continue
    try {
      const { r, c } = XLSX.utils.decode_cell(key)
      minR = Math.min(minR, r)
      minC = Math.min(minC, c)
      maxR = Math.max(maxR, r)
      maxC = Math.max(maxC, c)
    } catch {
      // ignore invalid cell keys
    }
  }

  if (!Number.isFinite(minR)) {
    if (sheet['!ref']) {
      const range = XLSX.utils.decode_range(sheet['!ref'])
      return {
        minR: range.s.r,
        minC: range.s.c,
        maxR: range.e.r,
        maxC: range.e.c,
      }
    }
    return { minR: 0, minC: 0, maxR: 0, maxC: 0 }
  }

  return { minR, minC, maxR, maxC }
}

function readSheetMatrix(sheet) {
  const { minR, minC, maxR, maxC } = expandSheetBounds(sheet)
  const matrix = []

  for (let rowIndex = minR; rowIndex <= maxR; rowIndex += 1) {
    const row = []
    for (let colIndex = minC; colIndex <= maxC; colIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })
      const cell = sheet[address]
      if (!cell) {
        row.push('')
        continue
      }
      const value = cell.w ?? cell.v ?? ''
      row.push(normalizeCellValue(value))
    }
    matrix.push(row)
  }

  return matrix
}

function isEmptyRow(cells = []) {
  return !cells.some((cell) => String(cell ?? '').trim() !== '')
}

function isExportMetaRow(cells = [], row = {}) {
  const first = String(cells[0] ?? '').trim()
  if (first.startsWith('# EXPORT') || first.includes('EXPORT_META')) {
    return true
  }
  return Object.values(row).some((value) => String(value || '').includes('EXPORT_META'))
}

function isLikelyOrderRow(cells = [], row = {}) {
  const first = String(cells[0] ?? '').trim()
  if (/^wc-\d+$/i.test(first)) return true

  const legacySourceId = String(row.legacySourceId || row.legacysourceid || '').trim()
  if (/^wc-\d+$/i.test(legacySourceId)) return true

  const wooId = String(row.woocommerceOrderId || row.woocommerceorderid || '').trim()
  if (/^\d+$/.test(wooId)) return true

  const orderNumber = String(row.shortOrderNumber || row.orderNumber || row.ordernumber || '').trim()
  if (orderNumber) return true

  return false
}

function findHeaderRowIndex(matrix = []) {
  for (let index = 0; index < Math.min(matrix.length, 10); index += 1) {
    const normalized = matrix[index]
      .map((cell) => normalizeHeaderKey(cell).toLowerCase().replace(/[^a-z0-9]/g, ''))
      .join('|')

    if (
      normalized.includes('legacysourceid')
      || normalized.includes('woocommerceorderid')
      || normalized.includes('ordernumber')
      || normalized.includes('shortordernumber')
      || normalized.includes('customername')
    ) {
      return index
    }
  }

  return 0
}

function matrixRowToObject(headers, cells = []) {
  const row = {}

  headers.forEach((header, index) => {
    const key = normalizeHeaderKey(header)
    if (!key) return
    row[key] = cells[index] ?? ''
  })

  return row
}

function parseMatrixToRows(matrix) {
  if (!matrix.length) {
    return {
      rows: [],
      stats: {
        sheetRows: 0,
        headerRowIndex: 0,
        emptyRowsSkipped: 0,
        metaRowsSkipped: 0,
        orderRows: 0,
      },
    }
  }

  const headerRowIndex = findHeaderRowIndex(matrix)
  const headers = matrix[headerRowIndex] || []
  const rows = []
  let emptyRowsSkipped = 0
  let metaRowsSkipped = 0

  for (let index = headerRowIndex + 1; index < matrix.length; index += 1) {
    const cells = matrix[index] || []
    const row = matrixRowToObject(headers, cells)

    if (isExportMetaRow(cells, row)) {
      metaRowsSkipped += 1
      continue
    }

    if (isEmptyRow(cells) && !isLikelyOrderRow(cells, row)) {
      emptyRowsSkipped += 1
      continue
    }

    if (!isLikelyOrderRow(cells, row)) {
      emptyRowsSkipped += 1
      continue
    }

    rows.push(row)
  }

  return {
    rows,
    stats: {
      sheetRows: matrix.length,
      headerRowIndex,
      emptyRowsSkipped,
      metaRowsSkipped,
      orderRows: rows.length,
    },
  }
}

/**
 * Parse every populated row from a worksheet by scanning all cell keys
 * (Excel !ref is often too short and drops thousands of rows).
 */
export function parseOrderImportSheet(sheet) {
  if (!sheet) {
    return {
      rows: [],
      stats: {
        sheetRows: 0,
        headerRowIndex: 0,
        emptyRowsSkipped: 0,
        metaRowsSkipped: 0,
        orderRows: 0,
      },
    }
  }

  const matrix = readSheetMatrix(sheet)
  return parseMatrixToRows(matrix)
}

export function parseOrderImportWorkbook(workbook) {
  const sheetName = workbook?.SheetNames?.[0]
  if (!sheetName) {
    return {
      rows: [],
      stats: {
        sheetRows: 0,
        headerRowIndex: 0,
        emptyRowsSkipped: 0,
        metaRowsSkipped: 0,
        orderRows: 0,
      },
    }
  }

  return parseOrderImportSheet(workbook.Sheets[sheetName])
}

export function parseOrderImportBuffer(buffer, fileName = '') {
  const lowerName = String(fileName || '').toLowerCase()
  const isCsv = lowerName.endsWith('.csv')

  let workbook
  if (isCsv) {
    const text = typeof buffer === 'string'
      ? buffer
      : new TextDecoder('utf-8').decode(buffer)
    workbook = XLSX.read(text, {
      type: 'string',
      cellDates: true,
      raw: false,
    })
  } else {
    workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: true,
      raw: false,
    })
  }

  return parseOrderImportWorkbook(workbook)
}
