import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import nodemailer from 'nodemailer'

interface PhotoData {
  dataUrl: string
  caption: string
  workItem: string
}

interface ReportBody {
  propertyName: string
  shootingDate: string
  worker: string
  workContent: string
  photos: (PhotoData | null)[]
  recipientEmail: string
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '―'
  const [datePart, timePart] = dateStr.split('T')
  if (!datePart) return '―'
  const [year, month, day] = datePart.split('-')
  if (!year || !month || !day) return '―'
  const time = timePart ? ` ${timePart}` : ''
  return `${year}年${parseInt(month)}月${parseInt(day)}日${time}`
}

async function generateExcel(body: ReportBody): Promise<Buffer> {
  const { propertyName, shootingDate, worker, workContent, photos } = body

  const workbook = new ExcelJS.Workbook()
  workbook.creator = '作業報告書アプリ'
  const sheet = workbook.addWorksheet('作業報告書')

  sheet.columns = [
    { width: 12 }, // A
    { width: 16 }, // B
    { width: 16 }, // C
    { width: 16 }, // D
    { width: 16 }, // E
    { width: 16 }, // F
  ]

  // ─── タイトル ────────────────────────────────────────────────────────────
  sheet.mergeCells('A1:F1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = '作業報告書'
  titleCell.font = { name: 'メイリオ', bold: true, size: 18, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2850' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 42

  // ─── 基本情報 ─────────────────────────────────────────────────────────────
  const infoItems = [
    { label: '物件名',   value: propertyName || '―' },
    { label: '撮影日時', value: formatDate(shootingDate) },
    { label: '作業者',   value: worker || '―' },
    { label: '作業内容', value: workContent || '―' },
  ]

  infoItems.forEach(({ label, value }, i) => {
    const rowNum = i + 2
    sheet.mergeCells(`B${rowNum}:F${rowNum}`)

    const lblCell = sheet.getCell(`A${rowNum}`)
    lblCell.value = label
    lblCell.font = { name: 'メイリオ', bold: true, size: 10, color: { argb: 'FF1D4ED8' } }
    lblCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } }
    lblCell.alignment = { horizontal: 'center', vertical: 'middle' }
    lblCell.border = {
      top:    { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left:   { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right:  { style: 'thin', color: { argb: 'FFD1D5DB' } },
    }

    const valCell = sheet.getCell(`B${rowNum}`)
    valCell.value = value
    valCell.font = { name: 'メイリオ', size: 11, color: { argb: 'FF111827' } }
    valCell.alignment = { vertical: 'middle', indent: 1 }
    valCell.border = {
      top:    { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right:  { style: 'thin', color: { argb: 'FFD1D5DB' } },
    }
    sheet.getRow(rowNum).height = 24
  })

  // スペーサー（行6）
  sheet.getRow(6).height = 10

  // ─── 写真 ──────────────────────────────────────────────────────────────────
  const ROWS_PER_IMAGE = 18  // 画像が占める行数
  const ROW_HEIGHT     = 14  // 各行の高さ（ポイント）
  const IMG_WIDTH      = 400 // px
  const IMG_HEIGHT     = 252 // px

  const validPhotos = photos.filter(Boolean) as PhotoData[]
  let currentRow = 7 // 1始まり

  for (let i = 0; i < validPhotos.length; i++) {
    const photo = validPhotos[i]

    // 写真Nヘッダーバー
    sheet.mergeCells(`A${currentRow}:F${currentRow}`)
    const headerCell = sheet.getCell(`A${currentRow}`)
    headerCell.value = `写真 ${i + 1}`
    headerCell.font = { name: 'メイリオ', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    headerCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    sheet.getRow(currentRow).height = 18
    currentRow++

    // 画像行の高さ設定
    const imageStartRow = currentRow
    for (let r = 0; r < ROWS_PER_IMAGE; r++) {
      sheet.getRow(imageStartRow + r).height = ROW_HEIGHT
    }

    // 画像の埋め込み（0始まりインデックスで指定）
    const ext    = photo.dataUrl.startsWith('data:image/png') ? 'png' : 'jpeg'
    const base64 = photo.dataUrl.split(',')[1]
    const imgId  = workbook.addImage({ base64, extension: ext })
    sheet.addImage(imgId, {
      tl:  { col: 0, row: imageStartRow - 1 }, // ExcelJS は 0始まり
      ext: { width: IMG_WIDTH, height: IMG_HEIGHT },
    })
    currentRow += ROWS_PER_IMAGE

    // 作業内容
    sheet.mergeCells(`A${currentRow}:F${currentRow}`)
    const workCell = sheet.getCell(`A${currentRow}`)
    workCell.value = photo.workItem || '―'
    workCell.font  = { name: 'メイリオ', size: 10, bold: !!photo.workItem, color: { argb: 'FF1E3A5F' } }
    workCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } }
    workCell.alignment = { vertical: 'middle', indent: 1, wrapText: true }
    sheet.getRow(currentRow).height = 22
    currentRow++

    // コメント（ある場合のみ）
    if (photo.caption) {
      sheet.mergeCells(`A${currentRow}:F${currentRow}`)
      const captionCell = sheet.getCell(`A${currentRow}`)
      captionCell.value = photo.caption
      captionCell.font  = { name: 'メイリオ', size: 9, color: { argb: 'FF374151' } }
      captionCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
      captionCell.alignment = { vertical: 'middle', indent: 1, wrapText: true }
      sheet.getRow(currentRow).height = 18
      currentRow++
    }

    // スペーサー
    sheet.getRow(currentRow).height = 8
    currentRow++
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

export async function POST(request: NextRequest) {
  try {
    const body: ReportBody = await request.json()
    const { propertyName, shootingDate, worker, workContent, recipientEmail } = body

    if (!recipientEmail?.trim()) {
      return NextResponse.json({ error: '送信先メールアドレスを入力してください' }, { status: 400 })
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return NextResponse.json(
        { error: 'メール設定が未完了です。.env.local に SMTP_USER と SMTP_PASS を設定してください。' },
        { status: 500 },
      )
    }

    const excelBuffer = await generateExcel(body)

    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    const dateStr  = formatDate(shootingDate)
    const safeName = propertyName || '物件名未設定'
    const filename = `作業報告書_${safeName}_${dateStr.replace(/[年月日\s:]/g, '')}.xlsx`

    await transporter.sendMail({
      from:    `作業報告書 <${process.env.SMTP_USER}>`,
      to:      recipientEmail.trim(),
      subject: `【作業報告書】${safeName}（${dateStr}）`,
      text: [
        '作業報告書を添付いたします。',
        '',
        `物件名：${safeName}`,
        `撮影日時：${dateStr}`,
        `作業者：${worker || '―'}`,
        `作業内容：${workContent || '―'}`,
      ].join('\n'),
      attachments: [
        {
          filename,
          content:     excelBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('send-report error:', err)
    const message = err instanceof Error ? err.message : '不明なエラー'
    return NextResponse.json({ error: `送信に失敗しました：${message}` }, { status: 500 })
  }
}
