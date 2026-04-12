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
  coverPhoto: string | null
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

// A4縦の共通ページ設定
const A4_PAGE_SETUP: Partial<ExcelJS.PageSetup> = {
  paperSize:          9,
  orientation:        'portrait',
  horizontalCentered: true,
  fitToPage:          false,
  margins: { left: 0.35, right: 0.35, top: 0.4, bottom: 0.4, header: 0, footer: 0 },
}

// 6列均等（A4幅に合わせた幅）
const COLUMNS = [
  { key: 'a', width: 14 },
  { key: 'b', width: 14 },
  { key: 'c', width: 14 },
  { key: 'd', width: 14 },
  { key: 'e', width: 14 },
  { key: 'f', width: 14 },
]

// 画像埋め込み（tl/br 形式：ExcelJS型定義が厳格なため as any）
function embedImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheet: any,
  workbook: ExcelJS.Workbook,
  dataUrl: string,
  colStart: number,
  colEnd: number,
  rowStart0: number, // 0始まり
  rowEnd0: number,   // 0始まり
) {
  const ext    = dataUrl.startsWith('data:image/png') ? 'png' : 'jpeg'
  const base64 = dataUrl.split(',')[1]
  const id     = workbook.addImage({ base64, extension: ext })
  sheet.addImage(id, { tl: { col: colStart, row: rowStart0 }, br: { col: colEnd, row: rowEnd0 } })
}

// 写真番号バー（常に表示。写真なしのスロットはグレー）
function addPhotoHeader(
  sheet: ExcelJS.Worksheet,
  rowNum: number,
  colStart: 'A' | 'D',
  colEnd:   'C' | 'F',
  photoNum: number,
  hasPhoto: boolean,
) {
  sheet.mergeCells(`${colStart}${rowNum}:${colEnd}${rowNum}`)
  const cell = sheet.getCell(`${colStart}${rowNum}`)
  cell.value     = `写真 ${photoNum}`
  cell.font      = { name: 'メイリオ', bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
  cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: hasPhoto ? 'FF1E3A5F' : 'FF9CA3AF' } }
  cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
}

// 「写真なし」プレースホルダー行の背景色設定
function addEmptyPhotoArea(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  rows: number,
  colStart: 'A' | 'D',
  colEnd:   'C' | 'F',
) {
  sheet.mergeCells(`${colStart}${startRow}:${colEnd}${startRow + rows - 1}`)
  const cell = sheet.getCell(`${colStart}${startRow}`)
  cell.value     = '写真なし'
  cell.font      = { name: 'メイリオ', size: 9, color: { argb: 'FF9CA3AF' } }
  cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
}

// 作業内容セル
function addWorkItem(
  sheet: ExcelJS.Worksheet,
  rowNum: number,
  colStart: 'A' | 'D',
  colEnd:   'C' | 'F',
  text: string,
) {
  sheet.mergeCells(`${colStart}${rowNum}:${colEnd}${rowNum}`)
  const cell = sheet.getCell(`${colStart}${rowNum}`)
  cell.value     = text || '―'
  cell.font      = { name: 'メイリオ', size: 8, bold: !!text, color: { argb: 'FF1E3A5F' } }
  cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } }
  cell.alignment = { vertical: 'middle', indent: 1, wrapText: true }
}

async function generateExcel(body: ReportBody): Promise<Buffer> {
  const { propertyName, shootingDate, worker, workContent, coverPhoto, photos } = body
  const workbook = new ExcelJS.Workbook()
  workbook.creator = '作業報告書アプリ'

  // ════════════════════════════════════════════════════════════════════════
  // シート1：表紙
  // ════════════════════════════════════════════════════════════════════════
  const coverSheet = workbook.addWorksheet('表紙')
  coverSheet.pageSetup = { ...A4_PAGE_SETUP } as ExcelJS.PageSetup
  coverSheet.columns   = COLUMNS.map(c => ({ ...c }))

  // タイトル
  coverSheet.mergeCells('A1:F1')
  const titleCell = coverSheet.getCell('A1')
  titleCell.value     = '作業報告書'
  titleCell.font      = { name: 'メイリオ', bold: true, size: 18, color: { argb: 'FFFFFFFF' } }
  titleCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2850' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  coverSheet.getRow(1).height = 40

  // 基本情報テーブル
  const infoItems = [
    { label: '物件名',   value: propertyName || '―' },
    { label: '撮影日時', value: formatDate(shootingDate) },
    { label: '作業者',   value: worker || '―' },
    { label: '作業内容', value: workContent || '―' },
  ]
  infoItems.forEach(({ label, value }, i) => {
    const row = i + 2
    coverSheet.mergeCells(`B${row}:F${row}`)

    const lbl = coverSheet.getCell(`A${row}`)
    lbl.value     = label
    lbl.font      = { name: 'メイリオ', bold: true, size: 10, color: { argb: 'FF1D4ED8' } }
    lbl.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } }
    lbl.alignment = { horizontal: 'center', vertical: 'middle' }
    lbl.border    = {
      top:    { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left:   { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right:  { style: 'thin', color: { argb: 'FFD1D5DB' } },
    }

    const val = coverSheet.getCell(`B${row}`)
    val.value     = value
    val.font      = { name: 'メイリオ', size: 11, color: { argb: 'FF111827' } }
    val.alignment = { vertical: 'middle', indent: 1 }
    val.border    = {
      top:    { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right:  { style: 'thin', color: { argb: 'FFD1D5DB' } },
    }
    coverSheet.getRow(row).height = 24
  })

  // スペーサー（行6）
  coverSheet.getRow(6).height = 8

  // 表紙写真（A4比率で大きく配置）
  const COVER_PHOTO_ROWS = 20
  const COVER_ROW_H      = 14
  if (coverPhoto) {
    for (let r = 7; r < 7 + COVER_PHOTO_ROWS; r++) coverSheet.getRow(r).height = COVER_ROW_H
    embedImage(coverSheet, workbook, coverPhoto, 0, 6, 6, 6 + COVER_PHOTO_ROWS)
  }

  // ════════════════════════════════════════════════════════════════════════
  // シート2：写真報告書（2列×3行グリッド）
  // ════════════════════════════════════════════════════════════════════════
  const photoSheet = workbook.addWorksheet('写真報告書')
  photoSheet.pageSetup = { ...A4_PAGE_SETUP } as ExcelJS.PageSetup
  photoSheet.columns   = COLUMNS.map(c => ({ ...c }))

  const PAGE_SIZE    = 6
  const HEADER_H     = 18   // 「写真報告書」バー
  const PHOTO_BAR_H  = 13   // 「写真N」バー
  const ROWS_PER_IMG = 13   // 写真エリア行数
  const IMG_ROW_H    = 13   // 各行の高さ（pt）
  const WORK_H       = 16   // 作業内容行
  const CAPTION_H    = 12   // コメント行
  const PAIR_GAP     = 4    // ペア間スペーサー
  const GROUP_GAP    = 8    // グループ間スペーサー

  // photos配列をそのまま使う（null含む）→ スロット番号を保持
  const totalPages = Math.ceil(photos.length / PAGE_SIZE)
  let currentRow   = 1

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    // 6スロット取得（不足分はnullで補完）
    const pageSlots = [...photos.slice(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE)]
    while (pageSlots.length < PAGE_SIZE) pageSlots.push(null)

    // ページヘッダー「写真報告書 P/N」
    photoSheet.mergeCells(`A${currentRow}:F${currentRow}`)
    const pgHdr = photoSheet.getCell(`A${currentRow}`)
    pgHdr.value     = `写真報告書　　${pageIdx + 1}  /  ${totalPages}`
    pgHdr.font      = { name: 'メイリオ', bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    pgHdr.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2850' } }
    pgHdr.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 }
    photoSheet.getRow(currentRow).height = HEADER_H
    currentRow++

    // 3ペア（= 2列 × 3行）
    for (let pair = 0; pair < 3; pair++) {
      const photo1    = pageSlots[pair * 2]     as PhotoData | null
      const photo2    = pageSlots[pair * 2 + 1] as PhotoData | null
      const photoNum1 = pageIdx * PAGE_SIZE + pair * 2 + 1
      const photoNum2 = pageIdx * PAGE_SIZE + pair * 2 + 2

      // 写真番号バー（左・右とも常に表示）
      addPhotoHeader(photoSheet, currentRow, 'A', 'C', photoNum1, !!photo1)
      addPhotoHeader(photoSheet, currentRow, 'D', 'F', photoNum2, !!photo2)
      photoSheet.getRow(currentRow).height = PHOTO_BAR_H
      currentRow++

      // 写真エリアの行高さ設定
      for (let r = 0; r < ROWS_PER_IMG; r++) {
        photoSheet.getRow(currentRow + r).height = IMG_ROW_H
      }
      const tl0 = currentRow - 1          // 0始まり
      const br0 = currentRow + ROWS_PER_IMG - 1

      // 写真1 埋め込み or プレースホルダー
      if (photo1) {
        embedImage(photoSheet, workbook, photo1.dataUrl, 0, 3, tl0, br0)
      } else {
        addEmptyPhotoArea(photoSheet, currentRow, ROWS_PER_IMG, 'A', 'C')
      }

      // 写真2 埋め込み or プレースホルダー
      if (photo2) {
        embedImage(photoSheet, workbook, photo2.dataUrl, 3, 6, tl0, br0)
      } else {
        addEmptyPhotoArea(photoSheet, currentRow, ROWS_PER_IMG, 'D', 'F')
      }

      currentRow += ROWS_PER_IMG

      // 作業内容行（左・右）
      addWorkItem(photoSheet, currentRow, 'A', 'C', photo1?.workItem ?? '')
      addWorkItem(photoSheet, currentRow, 'D', 'F', photo2?.workItem ?? '')
      photoSheet.getRow(currentRow).height = WORK_H
      currentRow++

      // コメント行（どちらかにコメントがある場合）
      if (photo1?.caption || photo2?.caption) {
        photoSheet.mergeCells(`A${currentRow}:C${currentRow}`)
        const c1 = photoSheet.getCell(`A${currentRow}`)
        c1.value     = photo1?.caption || ''
        c1.font      = { name: 'メイリオ', size: 7, color: { argb: 'FF374151' } }
        c1.alignment = { vertical: 'middle', indent: 1, wrapText: true }

        photoSheet.mergeCells(`D${currentRow}:F${currentRow}`)
        const c2 = photoSheet.getCell(`D${currentRow}`)
        c2.value     = photo2?.caption || ''
        c2.font      = { name: 'メイリオ', size: 7, color: { argb: 'FF374151' } }
        c2.alignment = { vertical: 'middle', indent: 1, wrapText: true }

        photoSheet.getRow(currentRow).height = CAPTION_H
        currentRow++
      }

      // ペア間スペーサー（最終ペア以外）
      if (pair < 2) {
        photoSheet.getRow(currentRow).height = PAIR_GAP
        currentRow++
      }
    }

    // グループ間スペーサー
    photoSheet.getRow(currentRow).height = GROUP_GAP
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
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })

    const dateStr  = formatDate(shootingDate)
    const safeName = propertyName || '物件名未設定'
    const filename = `作業報告書_${safeName}_${dateStr.replace(/[年月日\s:]/g, '')}.xlsx`

    await transporter.sendMail({
      from:    `作業報告書 <${process.env.SMTP_USER}>`,
      to:      recipientEmail.trim(),
      subject: `【作業報告書】${safeName}（${dateStr}）`,
      text: ['作業報告書を添付いたします。', '', `物件名：${safeName}`, `撮影日時：${dateStr}`, `作業者：${worker || '―'}`, `作業内容：${workContent || '―'}`].join('\n'),
      attachments: [{
        filename,
        content:     excelBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }],
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('send-report error:', err)
    const message = err instanceof Error ? err.message : '不明なエラー'
    return NextResponse.json({ error: `送信に失敗しました：${message}` }, { status: 500 })
  }
}
