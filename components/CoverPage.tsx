import type { PhotoEntry } from '@/app/page'

interface CoverPageProps {
  propertyName: string
  shootingDate: string
  worker: string
  coverPhoto?: PhotoEntry | null
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

const infoRows = (propertyName: string, shootingDate: string, worker: string) => [
  { label: '物件名', value: propertyName || '―' },
  { label: '撮影日時', value: formatDateTime(shootingDate) },
  { label: '作業者', value: worker || '―' },
]

export default function CoverPage({ propertyName, shootingDate, worker, coverPhoto }: CoverPageProps) {
  const rows = infoRows(propertyName, shootingDate, worker)

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
          height: '72mm',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-20mm',
            right: '-20mm',
            width: '60mm',
            height: '60mm',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-15mm',
            left: '-10mm',
            width: '45mm',
            height: '45mm',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
          }}
        />
        <p
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: '3.2mm',
            letterSpacing: '4px',
            marginBottom: '4mm',
            fontWeight: 500,
          }}
        >
          WORK INSPECTION REPORT
        </p>
        <h1
          style={{
            color: '#ffffff',
            fontSize: '16mm',
            fontWeight: 700,
            letterSpacing: '3mm',
            margin: 0,
            lineHeight: 1,
          }}
        >
          作業報告書
        </h1>
      </div>

      {/* ─── コンテンツ ─── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '8mm 16mm',
          gap: '6mm',
        }}
      >
        {/* 表紙写真 */}
        <div
          style={{
            width: '100%',
            height: '90mm',
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
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3mm',
                color: '#9ca3af',
              }}
            >
              <span style={{ fontSize: '10mm' }}>&#x1F4F7;</span>
              <span style={{ fontSize: '3.5mm' }}>表紙写真</span>
            </div>
          )}
        </div>

        {/* アクセントライン＋情報テーブル */}
        <div>
          <div
            style={{
              width: '20mm',
              height: '1.2mm',
              background: '#1d4ed8',
              marginBottom: '5mm',
            }}
          />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {rows.map(({ label, value }) => (
                <tr key={label} style={{ borderBottom: '0.3mm solid #e5e7eb' }}>
                  <td
                    style={{
                      padding: '4mm 4mm',
                      width: '28%',
                      backgroundColor: '#f0f4ff',
                      fontSize: '3.8mm',
                      color: '#1d4ed8',
                      fontWeight: 700,
                      verticalAlign: 'middle',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </td>
                  <td
                    style={{
                      padding: '4mm 6mm',
                      fontSize: '4.5mm',
                      color: '#111827',
                      verticalAlign: 'middle',
                      wordBreak: 'break-all',
                    }}
                  >
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── フッター ─── */}
      <div
        style={{
          height: '14mm',
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
