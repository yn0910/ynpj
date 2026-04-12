'use client'

import { useState, useCallback, useRef } from 'react'
import CoverPage from '@/components/CoverPage'
import PhotoReportPage from '@/components/PhotoReportPage'
import { CLEANING_OPTIONS } from '@/lib/constants'

export interface PhotoEntry {
  dataUrl: string
  caption: string
  workItem: string
}

export interface ReportData {
  propertyName: string
  shootingDate: string
  worker: string
  workContent: string
  coverPhoto: PhotoEntry | null
  photos: (PhotoEntry | null)[]
}

function getInitialDate(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm   = String(now.getMonth() + 1).padStart(2, '0')
  const dd   = String(now.getDate()).padStart(2, '0')
  const hh   = String(now.getHours()).padStart(2, '0')
  const min  = String(now.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

// 写真を最大1200pxに圧縮（送信データ削減）
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (evt) => {
      const src = evt.target!.result as string
      const img = document.createElement('img')
      img.onload = () => {
        const MAX = 1200
        let { width: w, height: h } = img
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.78))
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  })
}

const initialData: ReportData = {
  propertyName: '',
  shootingDate: '',
  worker:       '',
  workContent:  '日常清掃',
  coverPhoto:   null,
  photos:       Array(6).fill(null),
}

export default function Home() {
  const [data, setData] = useState<ReportData>({
    ...initialData,
    shootingDate: typeof window !== 'undefined' ? getInitialDate() : '',
  })
  const [view,           setView]           = useState<'form' | 'preview'>('form')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [sendStatus,     setSendStatus]     = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [sendError,      setSendError]      = useState('')

  // ─── 写真アップロード（圧縮あり）──────────────────────────────────────────
  const handleCoverPhotoUpload = useCallback(async (file: File) => {
    const dataUrl = await compressImage(file)
    setData((prev) => ({ ...prev, coverPhoto: { dataUrl, caption: '', workItem: '' } }))
  }, [])

  const handleCoverPhotoRemove = useCallback(() => {
    setData((prev) => ({ ...prev, coverPhoto: null }))
  }, [])

  const handlePhotoUpload = useCallback(async (index: number, file: File) => {
    const dataUrl = await compressImage(file)
    setData((prev) => {
      const photos = [...prev.photos]
      photos[index] = {
        dataUrl,
        caption:  photos[index]?.caption  ?? '',
        workItem: photos[index]?.workItem ?? '',
      }
      return { ...prev, photos }
    })
  }, [])

  const handleCaptionChange = useCallback((index: number, caption: string) => {
    setData((prev) => {
      const photos = [...prev.photos]
      if (photos[index]) photos[index] = { ...photos[index]!, caption }
      return { ...prev, photos }
    })
  }, [])

  const handleWorkItemChange = useCallback((index: number, value: string) => {
    setData((prev) => {
      const photos = [...prev.photos]
      if (photos[index]) photos[index] = { ...photos[index]!, workItem: value }
      return { ...prev, photos }
    })
  }, [])

  const handleRemovePhoto = useCallback((index: number) => {
    setData((prev) => {
      const photos = [...prev.photos]
      photos[index] = null
      return { ...prev, photos }
    })
  }, [])

  const handleAddPage = useCallback(() => {
    setData((prev) => ({
      ...prev,
      photos: [...prev.photos, ...Array(6).fill(null)],
    }))
  }, [])

  const handleRemovePage = useCallback(() => {
    setData((prev) => {
      const photos = [...prev.photos]
      if (photos.length <= 6) return prev
      if (!photos.slice(-6).every((p) => p === null)) return prev
      return { ...prev, photos: photos.slice(0, -6) }
    })
  }, [])

  // ─── メール送信（クライアント側でPDF生成→APIへ送信）─────────────────────
  const handleSend = useCallback(async () => {
    if (!recipientEmail.trim()) {
      setSendError('送信先メールアドレスを入力してください')
      setSendStatus('error')
      return
    }
    setSendStatus('sending')
    setSendError('')
    try {
      // A4ページ要素を全て取得
      const pageEls = Array.from(document.querySelectorAll('.a4-page'))
      if (pageEls.length === 0) throw new Error('プレビューが見つかりません。画面を更新してください。')

      // 動的インポート（クライアント専用）
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      for (let i = 0; i < pageEls.length; i++) {
        if (i > 0) pdf.addPage()
        const canvas = await html2canvas(pageEls[i] as HTMLElement, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
        })
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, 210, 297)
      }

      const pdfBase64 = pdf.output('datauristring').split(',')[1]

      const res = await fetch('/api/send-report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyName:   data.propertyName,
          shootingDate:   data.shootingDate,
          worker:         data.worker,
          workContent:    data.workContent,
          pdfBase64,
          recipientEmail: recipientEmail.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'エラーが発生しました')
      setSendStatus('success')
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'エラーが発生しました')
      setSendStatus('error')
    }
  }, [data, recipientEmail])

  const handlePreview = () => {
    setView('preview')
    setSendStatus('idle')
    setSendError('')
    window.scrollTo(0, 0)
  }

  const totalPhotoPages = Math.ceil(data.photos.length / 6)
  const canRemovePage   = data.photos.length > 6 && data.photos.slice(-6).every((p) => p === null)

  // ─── プレビュー画面 ────────────────────────────────────────────────────────
  if (view === 'preview') {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* スティッキーヘッダー */}
        <div className="no-print sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-3 space-y-2">
            {/* 上段：戻るボタン */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setView('form'); setSendStatus('idle') }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium border border-gray-300 shrink-0"
              >
                ← 編集に戻る
              </button>
              <span className="text-base font-bold text-gray-800">プレビュー</span>
            </div>
            {/* 下段：送信フォーム */}
            {sendStatus === 'success' ? (
              <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 font-medium text-sm">
                <span>✓</span>
                <span>メールを送信しました！</span>
                <button onClick={() => setSendStatus('idle')} className="ml-auto text-green-500 hover:text-green-700 text-xs underline">閉じる</button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => { setRecipientEmail(e.target.value); setSendStatus('idle') }}
                  placeholder="送信先メールアドレス"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleSend}
                  disabled={sendStatus === 'sending'}
                  className="px-6 py-2.5 bg-blue-700 text-white text-sm font-bold rounded-lg hover:bg-blue-800 transition-colors shadow disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
                >
                  {sendStatus === 'sending' ? 'PDF生成・送信中…' : 'PDFでメール送信'}
                </button>
              </div>
            )}
            {sendStatus === 'error' && sendError && (
              <p className="text-xs text-red-600 px-1">{sendError}</p>
            )}
          </div>
        </div>

        {/* A4プレビュー（横スクロール対応） */}
        <div className="print-area overflow-x-auto flex flex-col items-center py-8 gap-8 bg-gray-100">
          <CoverPage
            propertyName={data.propertyName}
            shootingDate={data.shootingDate}
            worker={data.worker}
            workContent={data.workContent}
            coverPhoto={data.coverPhoto}
          />
          {Array.from({ length: totalPhotoPages }).map((_, pageIndex) => {
            const pagePhotos = data.photos.slice(pageIndex * 6, pageIndex * 6 + 6)
            return (
              <PhotoReportPage
                key={pageIndex}
                photos={pagePhotos}
                pageNumber={pageIndex + 1}
                totalPages={totalPhotoPages}
                shootingDate={data.shootingDate}
              />
            )
          })}
        </div>
      </div>
    )
  }

  // ─── 入力フォーム画面 ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-900 text-white shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <h1 className="text-xl font-bold text-center tracking-wide">作業報告書 作成</h1>
          <p className="text-center text-blue-200 text-xs mt-1">写真を撮ってPDFでメール送信</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* ① 基本情報 */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-bold text-gray-800 mb-4 pb-3 border-b border-gray-100 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-700 text-white rounded-full text-xs flex items-center justify-center font-bold shrink-0">1</span>
            基本情報
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">物件名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={data.propertyName}
                onChange={(e) => setData((p) => ({ ...p, propertyName: e.target.value }))}
                placeholder="例：〇〇マンション 301号室"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">撮影日時 <span className="text-red-500">*</span></label>
              <input
                type="datetime-local"
                value={data.shootingDate}
                onChange={(e) => setData((p) => ({ ...p, shootingDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">作業者名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={data.worker}
                onChange={(e) => setData((p) => ({ ...p, worker: e.target.value }))}
                placeholder="例：田中 太郎"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">作業内容</label>
              <input
                type="text"
                value={data.workContent}
                onChange={(e) => setData((p) => ({ ...p, workContent: e.target.value }))}
                placeholder="例：日常清掃"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </section>

        {/* ② 表紙写真 */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-bold text-gray-800 mb-1 pb-3 border-b border-gray-100 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-700 text-white rounded-full text-xs flex items-center justify-center font-bold shrink-0">2</span>
            表紙写真
          </h2>
          <p className="text-xs text-gray-500 mb-4 mt-2">表紙の中央に大きく表示されます。</p>
          <CoverPhotoSlot photo={data.coverPhoto} onUpload={handleCoverPhotoUpload} onRemove={handleCoverPhotoRemove} />
        </section>

        {/* ③ 報告書用写真（ページごと） */}
        {Array.from({ length: totalPhotoPages }).map((_, pageIndex) => {
          const startIndex = pageIndex * 6
          const pagePhotos = data.photos.slice(startIndex, startIndex + 6)
          return (
            <section key={pageIndex} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-base font-bold text-gray-800 mb-3 pb-3 border-b border-gray-100 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-700 text-white rounded-full text-xs flex items-center justify-center font-bold shrink-0">
                  {pageIndex === 0 ? '3' : ''}
                </span>
                {pageIndex === 0 ? `写真（${pageIndex + 1}ページ目・最大6枚）` : `写真（${pageIndex + 1}ページ目・最大6枚）`}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {pagePhotos.map((photo, i) => {
                  const globalIndex = startIndex + i
                  return (
                    <PhotoSlot
                      key={globalIndex}
                      index={globalIndex}
                      photo={photo}
                      onUpload={handlePhotoUpload}
                      onCaptionChange={handleCaptionChange}
                      onWorkItemChange={handleWorkItemChange}
                      onRemove={handleRemovePhoto}
                    />
                  )
                })}
              </div>
            </section>
          )
        })}

        {/* ページ追加・削除 */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={handleAddPage}
            className="flex-1 sm:flex-none px-6 py-3 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 shadow transition-colors"
          >
            ＋ ページを追加（6枚）
          </button>
          {canRemovePage && (
            <button
              onClick={handleRemovePage}
              className="flex-1 sm:flex-none px-6 py-3 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 shadow transition-colors"
            >
              最終ページを削除
            </button>
          )}
        </div>

        {/* プレビュー確認ボタン */}
        <div className="pb-8">
          <button
            onClick={handlePreview}
            className="w-full py-4 bg-blue-700 text-white text-base font-bold rounded-xl hover:bg-blue-800 shadow-md transition-colors"
          >
            内容確認・メール送信へ →
          </button>
        </div>
      </main>
    </div>
  )
}

// ─── 表紙写真スロット ──────────────────────────────────────────────────────────

interface CoverPhotoSlotProps {
  photo: PhotoEntry | null
  onUpload: (file: File) => void
  onRemove: () => void
}

function CoverPhotoSlot({ photo, onUpload, onRemove }: CoverPhotoSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col items-center">
      {photo ? (
        <div className="relative w-full max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.dataUrl} alt="表紙写真" className="w-full h-48 object-cover rounded-lg border border-gray-200" />
          <button onClick={onRemove} className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow transition-colors" title="削除">×</button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="w-full max-w-sm h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        >
          <span className="text-4xl text-gray-300 leading-none">+</span>
          <span className="text-sm text-gray-400 mt-2">タップして写真を追加</span>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }} />
        </div>
      )}
    </div>
  )
}

// ─── 写真スロット ──────────────────────────────────────────────────────────────

interface PhotoSlotProps {
  index: number
  photo: PhotoEntry | null
  onUpload: (index: number, file: File) => void
  onCaptionChange: (index: number, caption: string) => void
  onWorkItemChange: (index: number, value: string) => void
  onRemove: (index: number) => void
}

function PhotoSlot({ index, photo, onUpload, onCaptionChange, onWorkItemChange, onRemove }: PhotoSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    if (file.type.startsWith('image/')) onUpload(index, file)
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index, onUpload],
  )

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-semibold text-gray-500">写真 {index + 1}</div>
      {photo ? (
        <div className="flex flex-col gap-1">
          <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.dataUrl} alt={`写真${index + 1}`} className="w-full aspect-[3/4] object-contain" />
            <button onClick={() => onRemove(index)} className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 text-sm flex items-center justify-center shadow transition-colors" title="削除">×</button>
          </div>
          <select
            value={photo.workItem}
            onChange={(e) => onWorkItemChange(index, e.target.value)}
            className="w-full text-xs border border-gray-300 rounded-md px-2 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
          >
            <option value="">作業内容を選択</option>
            {CLEANING_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <input
            type="text"
            value={photo.caption}
            onChange={(e) => onCaptionChange(index, e.target.value)}
            placeholder="コメント（任意）"
            className="w-full text-xs border border-gray-300 rounded-md px-2 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
          />
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="aspect-[3/4] border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        >
          <span className="text-4xl text-gray-300 leading-none">+</span>
          <span className="text-xs text-gray-400 mt-2 text-center px-1">タップして追加</span>
          <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
        </div>
      )}
    </div>
  )
}
