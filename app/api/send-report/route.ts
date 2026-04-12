import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import puppeteer from 'puppeteer'

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

function esc(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDateFull(dateStr: string): string {
  if (!dateStr) return '―'
  const [datePart, timePart] = dateStr.split('T')
  if (!datePart) return '―'
  const [year, month, day] = datePart.split('-')
  if (!year || !month || !day) return '―'
  const time = timePart ? ` ${timePart}` : ''
  return `${year}年${parseInt(month)}月${parseInt(day)}日${time}`
}

function formatDateStamp(dateStr: string): string {
  if (!dateStr) return ''
  const [datePart, timePart] = dateStr.split('T')
  if (!datePart) return ''
  const [year, month, day] = datePart.split('-')
  if (!year || !month || !day) return ''
  const time = timePart ? ` ${timePart}` : ''
  return `${year}/${month}/${day}${time}`
}

// ══════════════════════════════════════════════════════════════════════
// 表紙ページ HTML
// ══════════════════════════════════════════════════════════════════════
function coverPageHtml(opts: {
  propertyName: string
  shootingDate: string
  worker: string
  workContent: string
  coverPhoto: string | null
  totalPages: number
}): string {
  const { propertyName, shootingDate, worker, workContent, coverPhoto, totalPages } = opts
  const dateStr = formatDateFull(shootingDate)

  const photoArea = coverPhoto
    ? `<img src="${esc(coverPhoto)}" alt="表紙写真" style="width:100%;height:100%;object-fit:cover;display:block;">`
    : `<div style="display:flex;flex-direction:column;align-items:center;gap:2mm;color:#9ca3af;">
         <span style="font-size:10mm;">&#x1F4F7;</span>
         <span style="font-size:3.5mm;">表紙写真</span>
       </div>`

  const infoRows = [
    { label: '物件名',   value: propertyName || '―' },
    { label: '撮影日時', value: dateStr },
    { label: '作業者',   value: worker || '―' },
    { label: '作業内容', value: workContent || '―' },
  ].map(({ label, value }) => `
    <tr style="border-bottom:0.3mm solid #e5e7eb;">
      <td style="padding:5mm 4mm;width:28%;background-color:#f0f4ff;font-size:3.8mm;color:#1d4ed8;font-weight:700;vertical-align:middle;white-space:nowrap;">${esc(label)}</td>
      <td style="padding:5mm 6mm;font-size:4.5mm;color:#111827;vertical-align:middle;word-break:break-all;">${esc(value)}</td>
    </tr>`).join('')

  return `
<div class="a4-page" style="width:210mm;height:297mm;display:flex;flex-direction:column;overflow:hidden;font-family:inherit;">
  <!-- ヘッダー -->
  <div style="background:linear-gradient(150deg,#0f2850 0%,#1d4ed8 100%);height:72mm;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;flex-shrink:0;">
    <div style="position:absolute;top:-20mm;right:-20mm;width:60mm;height:60mm;border-radius:50%;background:rgba(255,255,255,0.06);"></div>
    <div style="position:absolute;bottom:-15mm;left:-10mm;width:45mm;height:45mm;border-radius:50%;background:rgba(255,255,255,0.05);"></div>
    <p style="color:rgba(255,255,255,0.55);font-size:3.2mm;letter-spacing:4px;margin:0 0 4mm 0;font-weight:500;">WORK INSPECTION REPORT</p>
    <h1 style="color:#ffffff;font-size:16mm;font-weight:700;letter-spacing:3mm;margin:0;line-height:1;">作業報告書</h1>
  </div>
  <!-- コンテンツ -->
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 16mm;gap:8mm;">
    <!-- 表紙写真 -->
    <div style="width:100%;height:90mm;border:0.4mm solid #d1d5db;border-radius:2mm;overflow:hidden;background-color:#f3f4f6;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      ${photoArea}
    </div>
    <!-- 基本情報テーブル -->
    <div>
      <div style="width:20mm;height:1.2mm;background:#1d4ed8;margin-bottom:5mm;"></div>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>${infoRows}</tbody>
      </table>
    </div>
  </div>
  <!-- フッター -->
  <div style="height:14mm;background:#0f2850;display:flex;align-items:center;justify-content:flex-end;padding-right:8mm;flex-shrink:0;">
    <span style="color:rgba(255,255,255,0.4);font-size:2.8mm;">作業報告書 &mdash; 1 / ${totalPages}</span>
  </div>
</div>`
}

// ══════════════════════════════════════════════════════════════════════
// 写真セル HTML
// ══════════════════════════════════════════════════════════════════════
function photoCellHtml(photo: PhotoData | null, photoNumber: number, dateStamp: string): string {
  const photoArea = photo
    ? `<img src="${esc(photo.dataUrl)}" alt="写真 ${photoNumber}" style="width:100%;height:100%;object-fit:contain;display:block;">
       ${dateStamp ? `<span style="position:absolute;bottom:1.5mm;right:1.5mm;background-color:rgba(0,0,0,0.55);color:#ffffff;font-size:2.2mm;padding:0.5mm 1.5mm;border-radius:0.8mm;letter-spacing:0.2mm;line-height:1.4;">${esc(dateStamp)}</span>` : ''}`
    : `<div style="display:flex;flex-direction:column;align-items:center;gap:1.5mm;">
         <span style="color:#9ca3af;font-size:5mm;line-height:1;">&#x1F4F7;</span>
         <span style="color:#9ca3af;font-size:2.5mm;">写真なし</span>
       </div>`

  const captionRow = photo?.caption
    ? `<div style="padding:1.5mm 3mm;border-top:0.3mm solid #e5e7eb;background-color:#ffffff;flex-shrink:0;">
         <p style="margin:0;font-size:2.5mm;color:#374151;line-height:1.4;word-break:break-all;">${esc(photo.caption)}</p>
       </div>`
    : ''

  return `
<div style="display:flex;flex-direction:column;border:0.4mm solid #d1d5db;border-radius:1.5mm;overflow:hidden;background-color:#f9fafb;">
  <!-- 写真番号バー -->
  <div style="background-color:#1e3a5f;padding:1mm 3mm;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
    <span style="color:#ffffff;font-size:2.8mm;font-weight:600;">写真 ${photoNumber}</span>
    ${photo ? '<span style="color:rgba(255,255,255,0.5);font-size:2.5mm;">&#x2713;</span>' : ''}
  </div>
  <!-- 写真エリア -->
  <div style="flex:1;overflow:hidden;background-color:#e5e7eb;display:flex;align-items:center;justify-content:center;position:relative;">
    ${photoArea}
  </div>
  <!-- 作業内容 -->
  <div style="padding:1.5mm 3mm;border-top:0.3mm solid #e5e7eb;background-color:#f0f4ff;min-height:9mm;flex-shrink:0;display:flex;align-items:center;">
    <p style="margin:0;font-size:2.5mm;color:${photo?.workItem ? '#1e3a5f' : '#9ca3af'};line-height:1.4;word-break:break-all;font-weight:${photo?.workItem ? 500 : 400};">${esc(photo?.workItem || '―')}</p>
  </div>
  ${captionRow}
</div>`
}

// ══════════════════════════════════════════════════════════════════════
// 写真報告書ページ HTML
// ══════════════════════════════════════════════════════════════════════
function photoPageHtml(opts: {
  photos: (PhotoData | null)[]
  pageNumber: number   // 0-indexed
  totalPages: number   // 0-indexed (last page index)
  shootingDate?: string
}): string {
  const { photos, pageNumber, totalPages, shootingDate } = opts
  const slots = [...photos, null, null, null, null, null, null].slice(0, 6) as (PhotoData | null)[]
  const dateStamp = shootingDate ? formatDateStamp(shootingDate) : ''

  const cells = slots.map((photo, i) => {
    const photoNumber = pageNumber * 6 + i + 1
    return photoCellHtml(photo, photoNumber, dateStamp)
  }).join('')

  return `
<div class="a4-page" style="width:210mm;height:297mm;display:flex;flex-direction:column;overflow:hidden;font-family:inherit;">
  <!-- ヘッダー -->
  <div style="background:#0f2850;padding:3mm 8mm;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
    <div style="display:flex;align-items:center;gap:3mm;">
      <div style="width:1.2mm;height:5mm;background-color:#60a5fa;border-radius:1mm;"></div>
      <span style="color:#ffffff;font-size:4.5mm;font-weight:700;letter-spacing:0.5mm;">写真報告書</span>
    </div>
    <span style="color:rgba(255,255,255,0.5);font-size:3mm;">${pageNumber + 1}&nbsp;/&nbsp;${totalPages + 1}</span>
  </div>
  <!-- 写真グリッド（2列×3行） -->
  <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr 1fr;gap:3mm;padding:4mm;overflow:hidden;">
    ${cells}
  </div>
</div>`
}

// ══════════════════════════════════════════════════════════════════════
// PDF 生成
// ══════════════════════════════════════════════════════════════════════
async function generatePDF(body: ReportBody): Promise<Buffer> {
  const { propertyName, shootingDate, worker, workContent, coverPhoto, photos } = body

  const PAGE_SIZE = 6
  const totalPhotoPages = Math.max(1, Math.ceil(photos.filter(Boolean).length / PAGE_SIZE))
  const totalPages = 1 + totalPhotoPages  // 表紙 + 写真ページ数

  const cover = coverPageHtml({ propertyName, shootingDate, worker, workContent, coverPhoto, totalPages })

  const photoPages: string[] = []
  for (let i = 0; i < totalPhotoPages; i++) {
    const pagePhotos = [...photos.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE)]
    while (pagePhotos.length < PAGE_SIZE) pagePhotos.push(null)
    photoPages.push(photoPageHtml({ photos: pagePhotos, pageNumber: i, totalPages: totalPhotoPages - 1, shootingDate }))
  }

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #ffffff; }
    body { font-family: 'Noto Sans JP', 'Meiryo UI', 'Meiryo', 'Yu Gothic', sans-serif; }
    .a4-page { background-color: #ffffff; page-break-after: always; break-after: page; }
    .a4-page:last-child { page-break-after: auto; break-after: auto; }
  </style>
</head>
<body>
${cover}
${photoPages.join('\n')}
</body>
</html>`

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

// ══════════════════════════════════════════════════════════════════════
// POST ハンドラー
// ══════════════════════════════════════════════════════════════════════
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

    const pdfBuffer = await generatePDF(body)
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })

    const dateStr  = formatDateFull(shootingDate)
    const safeName = propertyName || '物件名未設定'
    const filename = `作業報告書_${safeName}_${dateStr.replace(/[年月日\s:]/g, '')}.pdf`

    await transporter.sendMail({
      from:    `作業報告書 <${process.env.SMTP_USER}>`,
      to:      recipientEmail.trim(),
      subject: `【作業報告書】${safeName}（${dateStr}）`,
      text:    ['作業報告書を添付いたします。', '', `物件名：${safeName}`, `撮影日時：${dateStr}`, `作業者：${worker || '―'}`, `作業内容：${workContent || '―'}`].join('\n'),
      attachments: [{
        filename,
        content:     pdfBuffer,
        contentType: 'application/pdf',
      }],
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('send-report error:', err)
    const message = err instanceof Error ? err.message : '不明なエラー'
    return NextResponse.json({ error: `送信に失敗しました：${message}` }, { status: 500 })
  }
}
