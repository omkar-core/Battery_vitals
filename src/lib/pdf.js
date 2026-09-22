/**
 * Minimal, dependency-free PDF-1.4 generator for telemetry exports.
 * Builds a paginated Courier-text PDF containing a tabular dump of rows.
 * Used by /api/export (format=pdf). Output is ASCII-safe; unusual glyphs are
 * coalesced to '?' because the embedded base font is standard Type1 Courier.
 */

const COLS = [
  { key: 'timestamp', width: 150 },
  { key: 'voltage', width: 52 },
  { key: 'current', width: 52 },
  { key: 'power', width: 52 },
  { key: 'soc', width: 52 },
  { key: 'soh', width: 52 },
  { key: 'temperature', width: 64 },
  { key: 'humidity', width: 58 },
  { key: 'bhi', width: 52 },
  { key: 'safety', width: 72 },
  { key: 'resistance', width: 64 },
  { key: 'mq2', width: 52 },
  { key: 'mq135', width: 58 },
]

const FONT_SIZE = 9
const ROW_H = 13
const HEADER_H = 18
const MARGIN_LEFT = 36
const MARGIN_TOP = 56
const PAGE_WIDTH = 842 // landscape A4 so all columns fit
const PAGE_HEIGHT = 595
const ROWS_PER_PAGE = Math.floor((PAGE_HEIGHT - MARGIN_TOP - 40) / ROW_H)
const MAX_ROWS = 500

function pdfEscape(s) {
  let out = String(s).replace(/[^\t\n -~]/g, '?')
  out = out.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  return out
}

function padStart(n, width) {
  return String(n).padStart(width, '0')
}

function buildContent(rows, batteryId, pageStart) {
  const lines = []
  let y = PAGE_HEIGHT - MARGIN_TOP

  lines.push(`BT /F1 14 Tf ${MARGIN_LEFT} ${y} Td (Battery Vital telemetry export - ${pdfEscape(batteryId)}) Tj ET`)
  y -= 22

  const renderRow = (row, yPos, isHeader) => {
    const parts = []
    let x = MARGIN_LEFT
    for (const c of COLS) {
      const val = isHeader ? c.key : (row[c.key] != null ? String(row[c.key]) : '')
      parts.push(`1 0 0 1 ${x} ${yPos} Tm (${pdfEscape(val)}) Tj`)
      x += c.width
    }
    return `BT /F1 ${FONT_SIZE} Tf ${parts.join(' ')} ET`
  }

  lines.push(renderRow(null, y, true))
  y -= HEADER_H
  lines.push(`${MARGIN_LEFT} ${y} m ${PAGE_WIDTH - 36} ${y} l S`)
  y -= 4

  const slice = rows.slice(pageStart, pageStart + ROWS_PER_PAGE)
  for (const row of slice) {
    lines.push(renderRow(row, y, false))
    y -= ROW_H
  }

  return lines.join('\n')
}

export function buildTelemetryPdf(rows = [], batteryId = 'BAT001') {
  const limited = rows.slice(0, MAX_ROWS)
  const pageCount = Math.max(1, Math.ceil(limited.length / ROWS_PER_PAGE))

  // Object layout: 1 Catalog, 2 Pages, 3 Font, then per page: page+content.
  const totalObjects = 3 + pageCount * 2
  const pageObj = (i) => 4 + i * 2
  const contentObj = (i) => 5 + i * 2

  const objStrings = new Array(totalObjects + 1)
  objStrings[1] = `<< /Type /Catalog /Pages 2 0 R >>`
  const kids = Array.from({ length: pageCount }, (_, i) => `${pageObj(i)} 0 R`).join(' ')
  objStrings[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`
  objStrings[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>`

  for (let i = 0; i < pageCount; i++) {
    const contentStr = buildContent(limited, batteryId, i * ROWS_PER_PAGE)
    objStrings[pageObj(i)] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentObj(i)} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`
    objStrings[contentObj(i)] = `<< /Length ${Buffer.byteLength(contentStr, 'latin1')} >>\nstream\n${contentStr}\nendstream`
  }

  // Serialize with byte offsets for the xref table.
  const chunks = ['%PDF-1.4\n%\xE2\xE3\xCF\xD3\n']
  const offsets = new Array(totalObjects + 1)
  let pos = Buffer.byteLength(chunks[0], 'latin1')

  for (let i = 1; i <= totalObjects; i++) {
    offsets[i] = pos
    const chunk = `${padStart(i, 5)} 0 obj\n${objStrings[i]}\nendobj\n`
    chunks.push(chunk)
    pos += Buffer.byteLength(chunk, 'latin1')
  }

  const xrefPos = pos
  let xref = `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= totalObjects; i++) {
    xref += `${padStart(offsets[i], 10)} 00000 n \n`
  }
  chunks.push(xref)
  pos += Buffer.byteLength(xref, 'latin1')

  chunks.push(
    `trailer\n<< /Root 1 0 R /Size ${totalObjects + 1} >>\nstartxref\n${xrefPos}\n%%EOF\n`
  )

  return Buffer.concat(chunks.map((c) => Buffer.from(c, 'latin1')))
}