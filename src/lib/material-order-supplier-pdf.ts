import 'server-only'

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { MaterialOrder } from '@/lib/material-orders'

type DrawTextBlockParams = {
  page: import('pdf-lib').PDFPage
  text: string
  x: number
  y: number
  maxWidth: number
  lineHeight: number
  font: import('pdf-lib').PDFFont
  fontSize: number
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set'
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatQuantity(value: number) {
  if (Number.isInteger(value)) {
    return String(value)
  }

  return value.toFixed(2).replace(/\.?0+$/, '')
}

function wrapText(
  text: string,
  font: import('pdf-lib').PDFFont,
  fontSize: number,
  maxWidth: number
) {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return ['']
  }

  const lines: string[] = []
  let currentLine = words[0]

  for (let index = 1; index < words.length; index += 1) {
    const nextWord = words[index]
    const nextLine = `${currentLine} ${nextWord}`
    const nextWidth = font.widthOfTextAtSize(nextLine, fontSize)

    if (nextWidth <= maxWidth) {
      currentLine = nextLine
      continue
    }

    lines.push(currentLine)
    currentLine = nextWord
  }

  lines.push(currentLine)
  return lines
}

function drawTextBlock(params: DrawTextBlockParams) {
  const lines = wrapText(params.text, params.font, params.fontSize, params.maxWidth)

  let nextY = params.y

  lines.forEach((line) => {
    params.page.drawText(line, {
      x: params.x,
      y: nextY,
      size: params.fontSize,
      font: params.font,
      color: rgb(0.12, 0.14, 0.17),
    })
    nextY -= params.lineHeight
  })

  return nextY
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9\-_]+/gi, '_').replace(/_+/g, '_')
}

export async function generateMaterialOrderSupplierPdf(order: MaterialOrder) {
  const pdf = await PDFDocument.create()
  let page = pdf.addPage([612, 792])
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold)
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica)

  const marginX = 48
  let y = 748

  page.drawText('4 Elements Renovations', {
    x: marginX,
    y,
    font: bodyFont,
    size: 11,
    color: rgb(0.45, 0.42, 0.35),
  })
  y -= 24

  page.drawText('Supplier Purchase Order', {
    x: marginX,
    y,
    font: titleFont,
    size: 24,
    color: rgb(0.08, 0.1, 0.14),
  })
  y -= 30

  const homeowner = order.job?.homeowner_name ?? order.ship_to_name ?? 'Not set'
  const address = order.job?.address ?? order.ship_to_address ?? 'Not set'
  const vendor = order.vendor_name ?? 'Not set'
  const vendorEmail = order.vendor_email ?? 'Not set'

  const summaryLines = [
    `Order #: ${order.order_number}`,
    `Homeowner: ${homeowner}`,
    `Address: ${address}`,
    `Vendor: ${vendor}`,
    `Vendor Email: ${vendorEmail}`,
    `Needed By: ${formatDate(order.needed_by)}`,
    `Status: ${order.status}`,
  ]

  summaryLines.forEach((line) => {
    page.drawText(line, {
      x: marginX,
      y,
      font: bodyFont,
      size: 11,
      color: rgb(0.16, 0.18, 0.2),
    })
    y -= 16
  })

  y -= 6
  page.drawText('Items', {
    x: marginX,
    y,
    font: titleFont,
    size: 14,
    color: rgb(0.08, 0.1, 0.14),
  })
  y -= 20

  for (const item of order.items) {
    if (y < 120) {
      y = 748
      page = pdf.addPage([612, 792])
    }

    const selectedOptions = item.options
      .filter((option) => option.is_selected)
      .map((option) => `${option.option_group}: ${option.option_value}`)
      .join(' | ')

    page.drawText(
      `${item.item_name}  •  Qty ${formatQuantity(item.quantity)} ${item.unit ?? ''}`.trim(),
      {
        x: marginX,
        y,
        font: titleFont,
        size: 11,
        color: rgb(0.12, 0.14, 0.17),
      }
    )
    y -= 14

    if (selectedOptions) {
      y = drawTextBlock({
        page,
        text: `Selections: ${selectedOptions}`,
        x: marginX,
        y,
        maxWidth: 512,
        lineHeight: 13,
        font: bodyFont,
        fontSize: 10,
      })
    }

    if (item.notes) {
      y = drawTextBlock({
        page,
        text: `Notes: ${item.notes}`,
        x: marginX,
        y,
        maxWidth: 512,
        lineHeight: 13,
        font: bodyFont,
        fontSize: 10,
      })
    }

    y -= 8
  }

  const pdfBytes = await pdf.save()
  const homeownerPart = sanitizeFileName(homeowner || 'homeowner')
  const fileName = `material-order-${order.order_number}-${homeownerPart}.pdf`

  return { pdfBytes, fileName }
}
