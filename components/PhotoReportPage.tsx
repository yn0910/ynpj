import type { PhotoEntry } from '@/app/page'

interface PhotoReportPageProps {
  photos: (PhotoEntry | null)[]
  pageNumber: number
  totalPages: number
}

export default function PhotoReportPage({ photos, pageNumber, totalPages }: PhotoReportPageProps) {
  // 6枚のスロット（写真が少ない場合は null で補完）
  const slots = [...photos, null, null, null, null, null, null].slice(0, 6) as (PhotoEntry | null)[]

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
          background: '#0f2850',
          padding: '3mm 8mm',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}>
          <div style={{ width: '1.2mm', height: '5mm', backgroundColor: '#60a5fa', borderRadius: '1mm' }} />
          <span style={{ color: '#ffffff', fontSize: '4.5mm', fontWeight: 700, letterSpacing: '0.5mm' }}>
            写真報告書
          </span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '3mm' }}>
          {pageNumber + 1} &nbsp;/&nbsp; {totalPages + 1}
        </span>
      </div>

      {/* ─── 写真グリッド（2列×3行）─── */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr 1fr',
          gap: '3mm',
          padding: '4mm',
          overflow: 'hidden',
        }}
      >
        {slots.map((photo, i) => {
          const photoNumber = (pageNumber - 1) * 6 + i + 1
          return <PhotoCell key={i} photo={photo} photoNumber={photoNumber} />
        })}
      </div>
    </div>
  )
}

// ─── 写真セル ─────────────────────────────────────────────────────────────────

interface PhotoCellProps {
  photo: PhotoEntry | null
  photoNumber: number
}

function PhotoCell({ photo, photoNumber }: PhotoCellProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '0.4mm solid #d1d5db',
        borderRadius: '1.5mm',
        overflow: 'hidden',
        backgroundColor: '#f9fafb',
      }}
    >
      {/* 写真番号バー */}
      <div
        style={{
          backgroundColor: '#1e3a5f',
          padding: '1mm 3mm',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ color: '#ffffff', fontSize: '2.8mm', fontWeight: 600 }}>
          写真 {photoNumber}
        </span>
        {photo && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '2.5mm' }}>&#x2713;</span>}
      </div>

      {/* 写真エリア */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          backgroundColor: '#e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.dataUrl}
            alt={`写真 ${photoNumber}`}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5mm' }}>
            <span style={{ color: '#9ca3af', fontSize: '5mm', lineHeight: 1 }}>&#x1F4F7;</span>
            <span style={{ color: '#9ca3af', fontSize: '2.5mm' }}>写真なし</span>
          </div>
        )}
      </div>

      {/* 作業内容 */}
      <div
        style={{
          padding: '1.5mm 3mm',
          borderTop: '0.3mm solid #e5e7eb',
          backgroundColor: '#f0f4ff',
          minHeight: '9mm',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <p style={{
          margin: 0,
          fontSize: '2.5mm',
          color: photo?.workItem ? '#1e3a5f' : '#9ca3af',
          lineHeight: 1.4,
          wordBreak: 'break-all',
          fontWeight: photo?.workItem ? 500 : 400,
        }}>
          {photo?.workItem || '―'}
        </p>
      </div>

      {/* コメント（入力がある場合のみ表示） */}
      {photo?.caption && (
        <div style={{ padding: '1.5mm 3mm', borderTop: '0.3mm solid #e5e7eb', backgroundColor: '#ffffff', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: '2.5mm', color: '#374151', lineHeight: 1.4, wordBreak: 'break-all' }}>
            {photo.caption}
          </p>
        </div>
      )}
    </div>
  )
}
