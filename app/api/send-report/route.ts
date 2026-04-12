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

  // 6列均等（各列 16 単位 ≈ 112px、合計 ≈ 672px）
  sheet.columns = [
    { key: 'a', width: 16 },
    { key: 'b', width: 16 },
    { key: 'c', width: 16 },
    { key: 'd', width: 16 },
    { key: 'e', width: 16 },
    { key: 'f', width: 16 },
  ]

  // ─── タイトル ──────────────────────────────────────────────────────────────
  sheet.mergeCells('A1:F1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = '作業報告書'
  titleCell.font      = { name: 'メイリオ', bold: true, size: 18, color: { argb: 'FFFFFFFF' } }
  titleCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2850' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 42

  // ─── 基本情報 ────────────────────────────────────────────────────────────────
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
    lblCell.value     = label
    lblCell.font      = { name: 'メイリオ', bold: true, size: 10, color: { argb: 'FF1D4ED8' } }
    lblCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } }
    lblCell.alignment = { horizontal: 'center', vertical: 'middle' }
    lblCell.border    = {
      top:    { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left:   { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right:  { style: 'thin', color: { argb: 'FFD1D5DB' } },
    }

    const valCell = sheet.getCell(`B${rowNum}`)
    valCell.value     = value
    valCell.font      = { name: 'メイリオ', size: 11, color: { argb: 'FF111827' } }
    valCell.alignment = { vertical: 'middle', indent: 1 }
    valCell.border    = {
      top:    { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right:  { style: 'thin', color: { argb: 'FFD1D5DB' } },
    }
    sheet.getRow(rowNum).height = 24
  })

  // スペーサー（行6）
  sheet.getRow(6).height = 10

  // ─── 写真（2列レイアウト）──────────────────────────────────────────────────
  // tl/br アンカー方式：セル境界に合わせて画像が自動リサイズされる
  const ROWS_PER_IMAGE = 22 // 画像エリアの行数
  const ROW_HEIGHT     = 14 // 各行の高さ（ポイント）

  const validPhotos = photos.filter(Boolean) as PhotoData[]
  let currentRow = 7 // 1始まり（Excelの行番号）

  for (let i = 0; i < validPhotos.length; i += 2) {
    const photo1 = validPhotos[i]
    const photo2 = validPhotos[i + 1] || null

    // ── 写真番号ヘッダー ──
    sheet.mergeCells(`A${currentRow}:C${currentRow}`)
    const hdr1 = sheet.getCell(`A${currentRow}`)
    hdr1.value     = `写真 ${i + 1}`
    hdr1.font      = { name: 'メイリオ', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    hdr1.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    hdr1.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }

    if (photo2) {
      sheet.mergeCells(`D${currentRow}:F${currentRow}`)
      const hdr2 = sheet.getCell(`D${currentRow}`)
      hdr2.value     = `写真 ${i + 2}`
      hdr2.font      = { name: 'メイリオ', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
      hdr2.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
      hdr2.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    }
    sheet.getRow(currentRow).height = 18
    currentRow++

    // ── 画像行の高さ設定 ──
    const imageStartRow = currentRow // 1始まり
    for (let r = 0; r < ROWS_PER_IMAGE; r++) {
      sheet.getRow(imageStartRow + r).height = ROW_HEIGHT
    }

    // ── 写真1 埋め込み（列A-C を tl/br で指定）──
    // ExcelJS の tl/br は 0始まりインデックス
    // imageStartRow（1始まり）→ row インデックス = imageStartRow - 1
    const imgStart0 = imageStartRow - 1           // 0始まり
    const imgEnd0   = imageStartRow + ROWS_PER_IMAGE - 1 // 0始まり（次の行の上端 = 画像の下端）

    const ext1   = photo1.dataUrl.startsWith('data:image/png') ? 'png' : 'jpeg'
    const imgId1 = workbook.addImage({ base64: photo1.dataUrl.split(',')[1], extension: ext1 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(sheet as any).addImage(imgId1, {
      tl: { col: 0, row: imgStart0 },
      br: { col: 3, row: imgEnd0 },
    })

    // ── 写真2 埋め込み（列D-F）──
    if (photo2) {
      const ext2   = photo2.dataUrl.startsWith('data:image/png') ? 'png' : 'jpeg'
      const imgId2 = workbook.addImage({ base64: photo2.dataUrl.split(',')[1], extension: ext2 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(sheet as any).addImage(imgId2, {
        tl: { col: 3, row: imgStart0 },
        br: { col: 6, row: imgEnd0 },
      })
    }

    currentRow += ROWS_PER_IMAGE

    // ── 作業内容行 ──
    sheet.mergeCells(`A${currentRow}:C${currentRow}`)
    const work1 = sheet.getCell(`A${currentRow}`)
    work1.value     = photo1.workItem || '―'
    work1.font      = { name: 'メイリオ', size: 9, bold: !!photo1.workItem, color: { argb: 'FF1E3A5F' } }
    work1.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } }
    work1.alignment = { vertical: 'middle', indent: 1, wrapText: true }

    if (photo2) {
      sheet.mergeCells(`D${currentRow}:F${currentRow}`)
      const work2 = sheet.getCell(`D${currentRow}`)
      work2.value     = photo2.workItem || '―'
      work2.font      = { name: 'メイリオ', size: 9, bold: !!photo2.workItem, color: { argb: 'FF1E3A5F' } }
      work2.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } }
      work2.alignment = { vertical: 'middle', indent: 1, wrapText: true }
    }
    sheet.getRow(currentRow).height = 24
    currentRow++

    // ── コメント行（いずれかにコメントがある場合）──
    if (photo1.caption || photo2?.caption) {
      if (photo1.caption) {
        sheet.mergeCells(`A${currentRow}:C${currentRow}`)
        const cap1 = sheet.getCell(`A${currentRow}`)
        cap1.value     = photo1.caption
        cap1.font      = { name: 'メイリオ', size: 8, color: { argb: 'FF374151' } }
        cap1.alignment = { vertical: 'middle', indent: 1, wrapText: true }
      }
      if (photo2?.caption) {
        sheet.mergeCells(`D${currentRow}:F${currentRow}`)
        const cap2 = sheet.getCell(`D${currentRow}`)
        cap2.value     = photo2.caption
        cap2.font      = { name: 'メイリオ', size: 8, color: { argb: 'FF374151' } }
        cap2.alignment = { vertical: 'middle', indent: 1, wrapText: true }
      }
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
