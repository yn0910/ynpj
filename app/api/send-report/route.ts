import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

interface ReportBody {
  propertyName:   string
  shootingDate:   string
  worker:         string
  workContent:    string
  pdfBase64:      string
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

export async function POST(request: NextRequest) {
  try {
    const body: ReportBody = await request.json()
    const { propertyName, shootingDate, worker, workContent, pdfBase64, recipientEmail } = body

    if (!recipientEmail?.trim())
      return NextResponse.json({ error: '送信先メールアドレスを入力してください' }, { status: 400 })

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS)
      return NextResponse.json(
        { error: 'メール設定が未完了です。.env.local に SMTP_USER と SMTP_PASS を設定してください。' },
        { status: 500 },
      )

    if (!pdfBase64)
      return NextResponse.json({ error: 'PDFデータがありません' }, { status: 400 })

    const pdfBuffer = Buffer.from(pdfBase64, 'base64')

    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })

    const dateStr  = formatDate(shootingDate)
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
