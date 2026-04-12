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

// A4縦ページ設定
const A4_SETUP: Partial<ExcelJS.PageSetup> = {
  paperSize: 9, orientation: 'portrait', horizontalCentered: true,
  margins: { left: 0.3, right: 0.3, top: 0.35, bottom: 0.35, header: 0, footer: 0 },
}

// 6列（左3列＝写真1列目、右3列＝写真2列目）
const COLS = [
  { key: 'a', width: 13 }, { key: 'b', width: 13 }, { key: 'c', width: 13 },
  { key: 'd', width: 13 }, { key: 'e', width: 13 }, { key: 'f', width: 13 },
]

// 画像埋め込み（tl/br アンカー）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function embedImg(sheet: any, wb: ExcelJS.Workbook, dataUrl: string, c0: number, c1: number, r0: number, r1: number) {
  const ext  = dataUrl.startsWith('data:image/png') ? 'png' : 'jpeg'
  const id   = wb.addImage({ base64: dataUrl.split(',')[1], extension: ext })
  sheet.addImage(id, { tl: { col: c0, row: r0 }, br: { col: c1, row: r1 } })
}

// 外枠ボーダー（セル単位で外周だけ引く）
function outerBorder(
  sheet: ExcelJS.Worksheet,
  r1: number, r2: number, c1: number, c2: number, // 1始まり
  color = 'FFD1D5DB',
) {
  const b: ExcelJS.Border = { style: 'thin', color: { argb: color } }
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const borders: Partial<ExcelJS.Borders> = {}
      if (r === r1) borders.top    = b
      if (r === r2) borders.bottom = b
      if (c === c1) borders.left   = b
      if (c === c2) borders.right  = b
      if (Object.keys(borders).length) sheet.getCell(r, c).border = borders as ExcelJS.Borders
    }
  }
}

async function generateExcel(body: ReportBody): Promise<Buffer> {
  const { propertyName, shootingDate, worker, workContent, coverPhoto, photos } = body
  const wb = new ExcelJS.Workbook()
  wb.creator = '作業報告書アプリ'

  // ══════════════════════════════════════════════════════════════════════
  // Sheet 1：表紙  ─  タイトル → 表紙写真 → 情報テーブル
  // ══════════════════════════════════════════════════════════════════════
  const cs = wb.addWorksheet('表紙')
  cs.pageSetup = { ...A4_SETUP } as ExcelJS.PageSetup
  cs.columns   = COLS.map(c => ({ ...c }))

  // ── タイトルバー ──
  cs.mergeCells('A1:F1')
  const t = cs.getCell('A1')
  t.value     = '作業報告書'
  t.font      = { name: 'メイリオ', bold: true, size: 18, color: { argb: 'FFFFFFFF' } }
  t.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2850' } }
  t.alignment = { horizontal: 'center', vertical: 'middle' }
  cs.getRow(1).height = 40

  // ── 表紙写真（タイトル直下：行2〜23）──
  const COVER_ROWS = 22
  const COVER_ROW_H = 13
  const coverPhotoStart = 2
  const coverPhotoEnd   = coverPhotoStart + COVER_ROWS - 1
  for (let r = coverPhotoStart; r <= coverPhotoEnd; r++) cs.getRow(r).height = COVER_ROW_H

  if (coverPhoto) {
    embedImg(cs, wb, coverPhoto, 0, 6, coverPhotoStart - 1, coverPhotoEnd)
  } else {
    // 写真なし：グレー背景
    cs.mergeCells(`A${coverPhotoStart}:F${coverPhotoEnd}`)
    const ph = cs.getCell(`A${coverPhotoStart}`)
    ph.value     = '表紙写真'
    ph.font      = { name: 'メイリオ', size: 12, color: { argb: 'FF9CA3AF' } }
    ph.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
    ph.alignment = { horizontal: 'center', vertical: 'middle' }
  }

  // ── スペーサー ──
  const spacerRow = coverPhotoEnd + 1
  cs.getRow(spacerRow).height = 6
  cs.mergeCells(`A${spacerRow}:F${spacerRow}`)
  cs.getCell(`A${spacerRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }

  // ── 基本情報テーブル ──
  const infoItems = [
    { label: '物件名',   value: propertyName || '―' },
    { label: '撮影日時', value: formatDate(shootingDate) },
    { label: '作業者',   value: worker || '―' },
    { label: '作業内容', value: workContent || '―' },
  ]
  const infoStart = spacerRow + 1
  infoItems.forEach(({ label, value }, i) => {
    const row = infoStart + i
    cs.mergeCells(`B${row}:F${row}`)

    const lbl = cs.getCell(`A${row}`)
    lbl.value     = label
    lbl.font      = { name: 'メイリオ', bold: true, size: 10, color: { argb: 'FF1D4ED8' } }
    lbl.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } }
    lbl.alignment = { horizontal: 'center', vertical: 'middle' }
    lbl.border    = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left:   { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right:  { style: 'thin', color: { argb: 'FFD1D5DB' } },
    }

    const val = cs.getCell(`B${row}`)
    val.value     = value
    val.font      = { name: 'メイリオ', size: 11, color: { argb: 'FF111827' } }
    val.alignment = { vertical: 'middle', indent: 1 }
    val.border    = {
      top:    { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right:  { style: 'thin', color: { argb: 'FFD1D5DB' } },
    }
    cs.getRow(row).height = 24
  })

  // ── フッター ──
  const footerRow = infoStart + infoItems.length
  cs.mergeCells(`A${footerRow}:F${footerRow}`)
  const footer = cs.getCell(`A${footerRow}`)
  footer.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2850' } }
  cs.getRow(footerRow).height = 12

  // ══════════════════════════════════════════════════════════════════════
  // Sheet 2：写真報告書  ─  2列×3行グリッド（プレビューと同じ構成）
  // ══════════════════════════════════════════════════════════════════════
  const ps = wb.addWorksheet('写真報告書')
  ps.pageSetup = { ...A4_SETUP } as ExcelJS.PageSetup
  ps.columns   = COLS.map(c => ({ ...c }))

  // レイアウト定数（A4に3ペア＝6枚が収まるよう調整）
  const HDR_H     = 18  // ページヘッダー高さ
  const NUM_BAR_H = 13  // 写真番号バー高さ
  const IMG_ROWS  = 14  // 写真エリアの行数
  const IMG_ROW_H = 12  // 各行の高さ（pt）
  const WORK_H    = 16  // 作業内容行高さ
  const GAP_H     = 4   // ペア間スペーサー

  const PAGE_SIZE  = 6
  const totalPages = Math.ceil(photos.length / PAGE_SIZE)
  let row = 1

  for (let pgIdx = 0; pgIdx < totalPages; pgIdx++) {
    const slots = [...photos.slice(pgIdx * PAGE_SIZE, (pgIdx + 1) * PAGE_SIZE)]
    while (slots.length < PAGE_SIZE) slots.push(null)

    // ── ページヘッダー「写真報告書 P/N」──
    ps.mergeCells(`A${row}:D${row}`)
    const ph = ps.getCell(`A${row}`)
    ph.value     = '写真報告書'
    ph.font      = { name: 'メイリオ', bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    ph.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2850' } }
    ph.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 }

    ps.mergeCells(`E${row}:F${row}`)
    const pn = ps.getCell(`E${row}`)
    pn.value     = `${pgIdx + 1} / ${totalPages}`
    pn.font      = { name: 'メイリオ', size: 9, color: { argb: 'FFAAAAAA' } }
    pn.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2850' } }
    pn.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 }

    ps.getRow(row).height = HDR_H
    row++

    // ── 3ペア（= 3行）──
    for (let pair = 0; pair < 3; pair++) {
      const p1      = slots[pair * 2]     as PhotoData | null
      const p2      = slots[pair * 2 + 1] as PhotoData | null
      const num1    = pgIdx * PAGE_SIZE + pair * 2 + 1
      const num2    = pgIdx * PAGE_SIZE + pair * 2 + 2

      // ── 写真番号バー（左・右）──
      const numRow = row
      ps.mergeCells(`A${numRow}:C${numRow}`)
      const n1 = ps.getCell(`A${numRow}`)
      n1.value     = `写真 ${num1}`
      n1.font      = { name: 'メイリオ', bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
      n1.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: p1 ? 'FF1E3A5F' : 'FF6B7280' } }
      n1.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }

      ps.mergeCells(`D${numRow}:F${numRow}`)
      const n2 = ps.getCell(`D${numRow}`)
      n2.value     = `写真 ${num2}`
      n2.font      = { name: 'メイリオ', bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
      n2.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: p2 ? 'FF1E3A5F' : 'FF6B7280' } }
      n2.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }

      ps.getRow(numRow).height = NUM_BAR_H
      row++

      // ── 写真エリア ──
      const imgRowStart = row
      const imgRowEnd   = row + IMG_ROWS - 1
      for (let r2 = imgRowStart; r2 <= imgRowEnd; r2++) ps.getRow(r2).height = IMG_ROW_H

      // 画像埋め込み or 「写真なし」プレースホルダー
      const tl0 = imgRowStart - 1  // 0始まり
      const br0 = imgRowEnd        // 0始まり（次の行の上端 = 画像の下端）

      if (p1) {
        embedImg(ps, wb, p1.dataUrl, 0, 3, tl0, br0)
      } else {
        ps.mergeCells(`A${imgRowStart}:C${imgRowEnd}`)
        const pl = ps.getCell(`A${imgRowStart}`)
        pl.value     = '写真なし'
        pl.font      = { name: 'メイリオ', size: 9, color: { argb: 'FF9CA3AF' } }
        pl.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
        pl.alignment = { horizontal: 'center', vertical: 'middle' }
      }

      if (p2) {
        embedImg(ps, wb, p2.dataUrl, 3, 6, tl0, br0)
      } else {
        ps.mergeCells(`D${imgRowStart}:F${imgRowEnd}`)
        const pr = ps.getCell(`D${imgRowStart}`)
        pr.value     = '写真なし'
        pr.font      = { name: 'メイリオ', size: 9, color: { argb: 'FF9CA3AF' } }
        pr.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
        pr.alignment = { horizontal: 'center', vertical: 'middle' }
      }

      // 写真エリア全体に外枠ボーダー（左右それぞれ）
      outerBorder(ps, numRow, imgRowEnd + 1, 1, 3)  // 左スロット（A-C）
      outerBorder(ps, numRow, imgRowEnd + 1, 4, 6)  // 右スロット（D-F）

      row = imgRowEnd + 1

      // ── 作業内容行 ──
      const workRow = row
      ps.mergeCells(`A${workRow}:C${workRow}`)
      const w1 = ps.getCell(`A${workRow}`)
      w1.value     = p1?.workItem || '―'
      w1.font      = { name: 'メイリオ', size: 8, bold: !!p1?.workItem, color: { argb: 'FF1E3A5F' } }
      w1.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } }
      w1.alignment = { vertical: 'middle', indent: 1, wrapText: true }
      w1.border    = { bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }, left: { style: 'thin', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } } }

      ps.mergeCells(`D${workRow}:F${workRow}`)
      const w2 = ps.getCell(`D${workRow}`)
      w2.value     = p2?.workItem || '―'
      w2.font      = { name: 'メイリオ', size: 8, bold: !!p2?.workItem, color: { argb: 'FF1E3A5F' } }
      w2.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } }
      w2.alignment = { vertical: 'middle', indent: 1, wrapText: true }
      w2.border    = { bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }, left: { style: 'thin', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } } }

      ps.getRow(workRow).height = WORK_H
      row++

      // コメント行
      if (p1?.caption || p2?.caption) {
        ps.mergeCells(`A${row}:C${row}`)
        const c1 = ps.getCell(`A${row}`)
        c1.value     = p1?.caption || ''
        c1.font      = { name: 'メイリオ', size: 7, color: { argb: 'FF374151' } }
        c1.alignment = { vertical: 'middle', indent: 1, wrapText: true }
        c1.border    = { bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }, left: { style: 'thin', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } } }

        ps.mergeCells(`D${row}:F${row}`)
        const c2 = ps.getCell(`D${row}`)
        c2.value     = p2?.caption || ''
        c2.font      = { name: 'メイリオ', size: 7, color: { argb: 'FF374151' } }
        c2.alignment = { vertical: 'middle', indent: 1, wrapText: true }
        c2.border    = { bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }, left: { style: 'thin', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } } }

        ps.getRow(row).height = 12
        row++
      }

      // ペア間スペーサー
      if (pair < 2) {
        ps.getRow(row).height = GAP_H
        row++
      }
    }

    // グループ間スペーサー
    ps.getRow(row).height = 8
    row++
  }

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}

export async function POST(request: NextRequest) {
  try {
    const body: ReportBody = await request.json()
    const { propertyName, shootingDate, worker, workContent, recipientEmail } = body

    if (!recipientEmail?.trim())
      return NextResponse.json({ error: '送信先メールアドレスを入力してください' }, { status: 400 })

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS)
      return NextResponse.json(
        { error: 'メール設定が未完了です。.env.local に SMTP_USER と SMTP_PASS を設定してください。' },
        { status: 500 },
      )

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
      text:    ['作業報告書を添付いたします。', '', `物件名：${safeName}`, `撮影日時：${dateStr}`, `作業者：${worker || '―'}`, `作業内容：${workContent || '―'}`].join('\n'),
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
