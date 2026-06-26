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

function parseExportMeta(cells = []) {
  const text = cells.map((cell) => String(cell ?? '').trim()).join(' ')
  if (!text.includes('EXPORT_META') && !text.includes('exported_rows')) {
    return null
  }

  const exportedMatch = text.match(/exported_rows[,\s]+(\d+)/i)
  const expectedMatch = text.match(/expected_rows[,\s]+(\d+)/i)
  const skippedMatch = text.match(/skipped_rows[,\s]+(\d+)/i)

  return {
    exportedRows: exportedMatch ? Number(exportedMatch[1]) : null,
    expectedRows: expectedMatch ? Number(expectedMatch[1]) : null,
    skippedRows: skippedMatch ? Number(skippedMatch[1]) : null,
  }
}

function isLikelyOrderRow(cells = [], row = {}) {
  const first = String(cells[0] ?? '').trim()
  if (/^wc-\d+$/i.test(first)) return true
  if (/^\d{4,}$/.test(first)) return true

  const legacySourceId = String(row.legacySourceId || row.legacysourceid || row.csvSourceId || '').trim()
  if (/^wc-\d+$/i.test(legacySourceId)) return true
  if (/^woo:\d+$/i.test(legacySourceId)) return true

  const wooId = String(
    row.woocommerceOrderId
    || row.woocommerceorderid
    || row.wcorderid
    || row.wcOrderId
    || '',
  ).trim()
  if (/^\d+$/.test(wooId)) return true

  const orderNumber = String(
    row.shortOrderNumber
    || row.orderNumber
    || row.ordernumber
    || row.orderNo
    || '',
  ).trim()
  if (orderNumber && /\d/.test(orderNumber)) return true

  const explicitOrderId = String(row.orderId || row._id || row.id || '').trim()
  if (/^[a-f0-9]{24}$/i.test(explicitOrderId)) return true

  const email = String(
    row.customerEmail
    || row.guestEmail
    || row.email
    || row.buyeremail
    || '',
  ).trim()
  const totalRaw = String(
    row.total
    || row.orderTotal
    || row.amount
    || row.value
    || row.cod
    || '',
  ).trim()
  const total = Number(totalRaw.replace(/[^\d.-]/g, ''))
  if (email.includes('@') && Number.isFinite(total) && total >= 0) return true

  const customerName = String(
    row.customerName
    || row.guestName
    || row.name
    || row.receiverName
    || row.recieverName
    || '',
  ).trim()
  const phone = String(
    row.customerPhone
    || row.guestPhone
    || row.phone
    || row.receiverPhone
    || row.recieverPhone
    || '',
  ).trim()
  if (customerName && phone && Number.isFinite(total) && total >= 0) return true

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

function isExportMetaPhysicalLine(line = '') {
  const trimmed = String(line || '').trim().replace(/^"/, '')
  return trimmed.startsWith('# EXPORT') || trimmed.includes('EXPORT_META')
}

function isNewCsvRecordLine(line = '') {
  return /^wc-\d+,/.test(line) || isExportMetaPhysicalLine(line)
}

function parseCsvLine(line = '') {
  const cells = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      cells.push(field)
      field = ''
    } else {
      field += char
    }
  }

  cells.push(field)
  return cells
}

function extractIsoDatesFromRecord(record = '') {
  return String(record || '').match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+\-]\d{2}:\d{2}/g) || []
}

function applyRecordDatesToRow(row = {}, record = '') {
  const dates = extractIsoDatesFromRecord(record)
  if (!dates.length) return row

  const next = { ...row }
  if (!String(next.createdAt || '').trim()) next.createdAt = dates[0]
  if (!String(next.orderDate || '').trim()) next.orderDate = dates[0] || dates[1]
  if (!String(next.updatedAt || '').trim()) next.updatedAt = dates[2] || dates[1] || dates[0]
  if (!String(next.dateCompleted || '').trim() && dates[3]) next.dateCompleted = dates[3]
  if (!String(next.datePaid || '').trim() && dates[4]) next.datePaid = dates[4]
  return next
}

function parseCsvTextToMatrix(text = '') {
  const normalized = String(text || '').replace(/^\ufeff/, '')
  const physicalLines = normalized.split(/\r?\n/)
  const records = []
  let buffer = ''

  for (const line of physicalLines) {
    if (!buffer) {
      buffer = line
      continue
    }

    if (isNewCsvRecordLine(line)) {
      if (buffer.trim()) {
        records.push(buffer)
      }
      buffer = line
    } else {
      buffer += `\n${line}`
    }
  }

  if (buffer.trim()) {
    records.push(buffer)
  }

  return records.map((record) => ({
    cells: parseCsvLine(record),
    record,
  }))
}

function parseMatrixToRows(matrix) {
  if (!matrix.length) {
    return {
      rows: [],
      stats: {
        sheetRows: 0,
        headerRowIndex: 0,
        emptyRowsSkipped: 0,
        nonOrderRowsSkipped: 0,
        metaRowsSkipped: 0,
        orderRows: 0,
        exportMeta: null,
      },
    }
  }

  const headerRowIndex = findHeaderRowIndex(matrix.map((entry) => entry.cells || entry))
  const headers = (matrix[headerRowIndex]?.cells || matrix[headerRowIndex]) || []
  const rows = []
  let emptyRowsSkipped = 0
  let metaRowsSkipped = 0
  let nonOrderRowsSkipped = 0
  let exportMeta = null

  for (let index = headerRowIndex + 1; index < matrix.length; index += 1) {
    const entry = matrix[index] || {}
    const cells = entry.cells || entry
    const record = entry.record || ''
    let row = matrixRowToObject(headers, cells)
    row = applyRecordDatesToRow(row, record)

    if (isExportMetaRow(cells, row)) {
      metaRowsSkipped += 1
      exportMeta = parseExportMeta(cells) || exportMeta
      continue
    }

    if (isEmptyRow(cells) && !isLikelyOrderRow(cells, row)) {
      emptyRowsSkipped += 1
      continue
    }

    if (!isLikelyOrderRow(cells, row)) {
      nonOrderRowsSkipped += 1
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
      nonOrderRowsSkipped,
      metaRowsSkipped,
      orderRows: rows.length,
      exportMeta,
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
        nonOrderRowsSkipped: 0,
        metaRowsSkipped: 0,
        orderRows: 0,
        exportMeta: null,
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
        nonOrderRowsSkipped: 0,
        metaRowsSkipped: 0,
        orderRows: 0,
        exportMeta: null,
      },
    }
  }

  return parseOrderImportSheet(workbook.Sheets[sheetName])
}

export function parseOrderImportBuffer(buffer, fileName = '') {
  const lowerName = String(fileName || '').toLowerCase()
  const isCsv = lowerName.endsWith('.csv')

  if (isCsv) {
    const text = typeof buffer === 'string'
      ? buffer
      : new TextDecoder('utf-8').decode(buffer)
    const matrix = parseCsvTextToMatrix(text)
    return parseMatrixToRows(matrix)
  }

  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    raw: false,
  })

  return parseOrderImportWorkbook(workbook)
}
