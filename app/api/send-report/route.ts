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

// セルスタイル適用ヘルパー
function styleHeader(cell: ExcelJS.Cell, text: string) {
  cell.value     = text
  cell.font      = { name: 'メイリオ', bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
  cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
  cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
}

async function generateExcel(body: ReportBody): Promise<Buffer> {
  const { propertyName, shootingDate, worker, workContent, photos } = body

  const workbook = new ExcelJS.Workbook()
  workbook.creator = '作業報告書アプリ'

  const sheet = workbook.addWorksheet('作業報告書')

  // ── A4縦レイアウト設定 ──────────────────────────────────────────────────────
  sheet.pageSetup = {
    paperSize:         9,         // A4
    orientation:       'portrait',
    horizontalCentered: true,
    fitToPage:         false,
    margins: {
      left: 0.35, right: 0.35,
      top:  0.4,  bottom: 0.4,
      header: 0,  footer: 0,
    },
  }

  // 6列均等（A4幅に最適化：各14単位）
  sheet.columns = [
    { key: 'a', width: 14 },
    { key: 'b', width: 14 },
    { key: 'c', width: 14 },
    { key: 'd', width: 14 },
    { key: 'e', width: 14 },
    { key: 'f', width: 14 },
  ]

  // ─── タイトル ──────────────────────────────────────────────────────────────
  sheet.mergeCells('A1:F1')
  const titleCell = sheet.getCell('A1')
  titleCell.value     = '作業報告書'
  titleCell.font      = { name: 'メイリオ', bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
  titleCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2850' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 32

  // ─── 基本情報テーブル ─────────────────────────────────────────────────────
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
    lblCell.font      = { name: 'メイリオ', bold: true, size: 9, color: { argb: 'FF1D4ED8' } }
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
    valCell.font      = { name: 'メイリオ', size: 10, color: { argb: 'FF111827' } }
    valCell.alignment = { vertical: 'middle', indent: 1 }
    valCell.border    = {
      top:    { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right:  { style: 'thin', color: { argb: 'FFD1D5DB' } },
    }
    sheet.getRow(rowNum).height = 20
  })

  // ── セクション区切り ────────────────────────────────────────────────────────
  sheet.getRow(6).height = 6

  // ─── 写真グリッド（2列×3行 = 6枚/ページ）─────────────────────────────────
  // プレビューと同じ構成：3ペア × 2列 = 6枚ずつグループ化
  const PHOTO_BAR_H  = 13   // 写真番号バーの行高さ（pt）
  const ROWS_PER_IMG = 12   // 写真エリアの行数
  const IMG_ROW_H    = 13   // 写真行ごとの高さ（pt）
  const WORK_ROW_H   = 16   // 作業内容行の高さ（pt）
  const CAPTION_H    = 13   // コメント行の高さ（pt）
  const PAIR_GAP_H   = 4    // ペア間スペーサー（pt）
  const GROUP_GAP_H  = 10   // グループ間スペーサー（pt）

  const validPhotos = photos.filter(Boolean) as PhotoData[]
  let currentRow = 7  // Excelの行番号（1始まり）

  // 6枚ごとにグループ化（プレビューの1ページ = 6枚）
  for (let groupStart = 0; groupStart < validPhotos.length; groupStart += 6) {
    const group      = validPhotos.slice(groupStart, groupStart + 6)
    const pageNum    = Math.floor(groupStart / 6) + 1
    const totalPages = Math.ceil(validPhotos.length / 6)

    // ── ページヘッダー「写真報告書」──
    sheet.mergeCells(`A${currentRow}:F${currentRow}`)
    const pgHdr = sheet.getCell(`A${currentRow}`)
    pgHdr.value     = `写真報告書　　${pageNum}  /  ${totalPages}`
    pgHdr.font      = { name: 'メイリオ', bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    pgHdr.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2850' } }
    pgHdr.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 }
    sheet.getRow(currentRow).height = 18
    currentRow++

    // 3ペア（= 3行）ループ
    for (let pair = 0; pair < 3; pair++) {
      const photo1   = group[pair * 2]     || null
      const photo2   = group[pair * 2 + 1] || null
      const photoNum1 = groupStart + pair * 2 + 1
      const photoNum2 = groupStart + pair * 2 + 2

      // 写真番号バー（左・右）
      sheet.mergeCells(`A${currentRow}:C${currentRow}`)
      styleHeader(sheet.getCell(`A${currentRow}`), `写真 ${photoNum1}`)

      sheet.mergeCells(`D${currentRow}:F${currentRow}`)
      if (photo2) {
        styleHeader(sheet.getCell(`D${currentRow}`), `写真 ${photoNum2}`)
      } else {
        const empty = sheet.getCell(`D${currentRow}`)
        empty.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9CA3AF' } }
      }
      sheet.getRow(currentRow).height = PHOTO_BAR_H
      currentRow++

      // 写真エリアの行高さ設定
      const imgStart = currentRow
      for (let r = 0; r < ROWS_PER_IMG; r++) {
        sheet.getRow(imgStart + r).height = IMG_ROW_H
      }
      // 0始まりインデックス（ExcelJS の tl/br 用）
      const tl0 = imgStart - 1
      const br0 = imgStart + ROWS_PER_IMG - 1

      // 写真1 埋め込み（列A-C）
      if (photo1) {
        const ext1 = photo1.dataUrl.startsWith('data:image/png') ? 'png' : 'jpeg'
        const id1  = workbook.addImage({ base64: photo1.dataUrl.split(',')[1], extension: ext1 })
        // tl/br はExcelJS内部でサポート（TypeScript型定義が厳格なため as any）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(sheet as any).addImage(id1, { tl: { col: 0, row: tl0 }, br: { col: 3, row: br0 } })
      }

      // 写真2 埋め込み（列D-F）
      if (photo2) {
        const ext2 = photo2.dataUrl.startsWith('data:image/png') ? 'png' : 'jpeg'
        const id2  = workbook.addImage({ base64: photo2.dataUrl.split(',')[1], extension: ext2 })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(sheet as any).addImage(id2, { tl: { col: 3, row: tl0 }, br: { col: 6, row: br0 } })
      }

      currentRow += ROWS_PER_IMG

      // 作業内容行
      sheet.mergeCells(`A${currentRow}:C${currentRow}`)
      const w1 = sheet.getCell(`A${currentRow}`)
      w1.value     = photo1?.workItem || '―'
      w1.font      = { name: 'メイリオ', size: 8, bold: !!photo1?.workItem, color: { argb: 'FF1E3A5F' } }
      w1.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } }
      w1.alignment = { vertical: 'middle', indent: 1, wrapText: true }

      sheet.mergeCells(`D${currentRow}:F${currentRow}`)
      const w2 = sheet.getCell(`D${currentRow}`)
      w2.value     = photo2?.workItem || '―'
      w2.font      = { name: 'メイリオ', size: 8, bold: !!photo2?.workItem, color: { argb: 'FF1E3A5F' } }
      w2.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } }
      w2.alignment = { vertical: 'middle', indent: 1, wrapText: true }
      sheet.getRow(currentRow).height = WORK_ROW_H
      currentRow++

      // コメント行（いずれかにある場合）
      if (photo1?.caption || photo2?.caption) {
        sheet.mergeCells(`A${currentRow}:C${currentRow}`)
        const c1 = sheet.getCell(`A${currentRow}`)
        c1.value     = photo1?.caption || ''
        c1.font      = { name: 'メイリオ', size: 7, color: { argb: 'FF374151' } }
        c1.alignment = { vertical: 'middle', indent: 1, wrapText: true }

        sheet.mergeCells(`D${currentRow}:F${currentRow}`)
        const c2 = sheet.getCell(`D${currentRow}`)
        c2.value     = photo2?.caption || ''
        c2.font      = { name: 'メイリオ', size: 7, color: { argb: 'FF374151' } }
        c2.alignment = { vertical: 'middle', indent: 1, wrapText: true }
        sheet.getRow(currentRow).height = CAPTION_H
        currentRow++
      }

      // ペア間スペーサー（最終ペア以外）
      if (pair < 2) {
        sheet.getRow(currentRow).height = PAIR_GAP_H
        currentRow++
      }
    }

    // グループ間スペーサー
    sheet.getRow(currentRow).height = GROUP_GAP_H
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
