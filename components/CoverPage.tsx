import type { PhotoEntry } from '@/app/page'

interface CoverPageProps {
  propertyName: string
  shootingDate: string
  worker: string
  coverPhoto?: PhotoEntry | null
  workItems?: string[]
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '―'
  const [datePart, timePart] = dateStr.split('T')
  if (!datePart) return '―'
  const [year, month, day] = datePart.split('-')
  if (!year || !month || !day) return '―'
  const timeStr = timePart ? ` ${timePart}` : ''
  return `${year}年${parseInt(month)}月${parseInt(day)}日${timeStr}`
}

export default function CoverPage({
  propertyName,
  shootingDate,
  worker,
  coverPhoto,
  workItems = [],
}: CoverPageProps) {
  const infoRows = [
    { label: '物件名', value: propertyName || '―' },
    { label: '撮影日時', value: formatDateTime(shootingDate) },
    { label: '作業者', value: worker || '―' },
  ]

  const filledItems = workItems.filter((v) => v.trim() !== '')

  return (
    <div
      className="a4-page bg-white"
      style={{
        width: '210mm',
        height: '297mm',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'inherit',
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      }}
    >
      {/* ─── ヘッダー ─── */}
      <div
        style={{
          background: 'linear-gradient(150deg, #0f2850 0%, #1d4ed8 100%)',
          height: '60mm',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div style={{ position: 'absolute', top: '-20mm', right: '-20mm', width: '60mm', height: '60mm', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: '-15mm', left: '-10mm', width: '45mm', height: '45mm', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '3mm', letterSpacing: '4px', marginBottom: '3mm', fontWeight: 500 }}>
          WORK INSPECTION REPORT
        </p>
        <h1 style={{ color: '#ffffff', fontSize: '14mm', fontWeight: 700, letterSpacing: '3mm', margin: 0, lineHeight: 1 }}>
          作業報告書
        </h1>
      </div>

      {/* ─── コンテンツ ─── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '6mm 14mm',
          gap: '5mm',
          overflow: 'hidden',
        }}
      >
        {/* 表紙写真 */}
        <div
          style={{
            width: '100%',
            height: '55mm',
            border: '0.4mm solid #d1d5db',
            borderRadius: '2mm',
            overflow: 'hidden',
            backgroundColor: '#f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {coverPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPhoto.dataUrl}
              alt="表紙写真"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2mm', color: '#9ca3af' }}>
              <span style={{ fontSize: '9mm' }}>&#x1F4F7;</span>
              <span style={{ fontSize: '3mm' }}>表紙写真</span>
            </div>
          )}
        </div>

        {/* 基本情報テーブル */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ width: '16mm', height: '1mm', background: '#1d4ed8', marginBottom: '4mm' }} />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {infoRows.map(({ label, value }) => (
                <tr key={label} style={{ borderBottom: '0.3mm solid #e5e7eb' }}>
                  <td style={{ padding: '3.5mm 4mm', width: '27%', backgroundColor: '#f0f4ff', fontSize: '3.5mm', color: '#1d4ed8', fontWeight: 700, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    {label}
                  </td>
                  <td style={{ padding: '3.5mm 5mm', fontSize: '4mm', color: '#111827', verticalAlign: 'middle', wordBreak: 'break-all' }}>
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 作業内容 */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {/* セクションヘッダー */}
          <div
            style={{
              backgroundColor: '#0f2850',
              padding: '2.5mm 4mm',
              display: 'flex',
              alignItems: 'center',
              gap: '2mm',
              marginBottom: '0',
            }}
          >
            <div style={{ width: '1mm', height: '4mm', backgroundColor: '#60a5fa', borderRadius: '0.5mm' }} />
            <span style={{ color: '#ffffff', fontSize: '3.5mm', fontWeight: 700 }}>作業内容</span>
          </div>

          {/* 作業リスト */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {Array.from({ length: 10 }).map((_, i) => {
                const value = workItems[i] ?? ''
                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '0.25mm solid #e5e7eb',
                      backgroundColor: i % 2 === 0 ? '#ffffff' : '#f9fafb',
                    }}
                  >
                    <td
                      style={{
                        padding: '2.5mm 3mm',
                        width: '8mm',
                        fontSize: '3mm',
                        color: '#6b7280',
                        fontWeight: 700,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        borderRight: '0.25mm solid #e5e7eb',
                      }}
                    >
                      {i + 1}
                    </td>
                    <td
                      style={{
                        padding: '2.5mm 4mm',
                        fontSize: '3.5mm',
                        color: value ? '#111827' : '#d1d5db',
                        verticalAlign: 'middle',
                      }}
                    >
                      {value || '―'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── フッター ─── */}
      <div
        style={{
          height: '12mm',
          background: '#0f2850',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: '8mm',
          flexShrink: 0,
        }}
      >
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '2.8mm' }}>
          作業報告書 &mdash; 1 / 3
        </span>
      </div>
    </div>
  )
}
