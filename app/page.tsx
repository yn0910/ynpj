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
  coverPhoto: PhotoEntry | null
  photos: (PhotoEntry | null)[]
}

function getInitialDate(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

const initialData: ReportData = {
  propertyName: '',
  shootingDate: '',
  worker: '',
  coverPhoto: null,
  photos: Array(8).fill(null),
}

export default function Home() {
  const [data, setData] = useState<ReportData>({
    ...initialData,
    shootingDate: typeof window !== 'undefined' ? getInitialDate() : '',
  })
  const [view, setView] = useState<'form' | 'preview'>('form')

  const handleCoverPhotoUpload = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setData((prev) => ({ ...prev, coverPhoto: { dataUrl, caption: '', workItem: '' } }))
    }
    reader.readAsDataURL(file)
  }, [])

  const handleCoverPhotoRemove = useCallback(() => {
    setData((prev) => ({ ...prev, coverPhoto: null }))
  }, [])

  const handlePhotoUpload = useCallback((index: number, file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setData((prev) => {
        const photos = [...prev.photos]
        photos[index] = {
          dataUrl,
          caption: photos[index]?.caption ?? '',
          workItem: photos[index]?.workItem ?? '',
        }
        return { ...prev, photos }
      })
    }
    reader.readAsDataURL(file)
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

  const handlePreview = () => {
    setView('preview')
    window.scrollTo(0, 0)
  }

  const photos1 = data.photos.slice(0, 4)
  const photos2 = data.photos.slice(4, 8)

  if (view === 'preview') {
    return (
      <div className="min-h-screen bg-gray-200">
        <div className="no-print sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
            <button
              onClick={() => setView('form')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium border border-gray-300"
            >
              ← 編集に戻る
            </button>
            <h1 className="text-lg font-bold text-gray-800">プレビュー</h1>
            <button
              onClick={() => window.print()}
              className="ml-auto px-6 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors text-sm font-bold shadow"
            >
              印刷する
            </button>
          </div>
        </div>
        <div className="print-area flex flex-col items-center py-8 gap-8 bg-gray-200">
          <CoverPage
            propertyName={data.propertyName}
            shootingDate={data.shootingDate}
            worker={data.worker}
            coverPhoto={data.coverPhoto}
          />
          <PhotoReportPage photos={photos1} pageNumber={1} totalPages={2} />
          <PhotoReportPage photos={photos2} pageNumber={2} totalPages={2} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-900 text-white shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <h1 className="text-2xl font-bold text-center tracking-wide">作業報告書 作成</h1>
          <p className="text-center text-blue-200 text-sm mt-1">写真を8枚までアップロードしてA4報告書を作成できます</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* ① 基本情報 */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-5 pb-3 border-b border-gray-100 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-700 text-white rounded-full text-sm flex items-center justify-center font-bold">1</span>
            基本情報の入力
          </h2>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                物件名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={data.propertyName}
                onChange={(e) => setData((p) => ({ ...p, propertyName: e.target.value }))}
                placeholder="例：〇〇マンション 301号室"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                撮影日時 <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={data.shootingDate}
                onChange={(e) => setData((p) => ({ ...p, shootingDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                作業者名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={data.worker}
                onChange={(e) => setData((p) => ({ ...p, worker: e.target.value }))}
                placeholder="例：田中 太郎"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
          </div>
        </section>

        {/* ② 表紙写真 */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-2 pb-3 border-b border-gray-100 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-700 text-white rounded-full text-sm flex items-center justify-center font-bold">2</span>
            表紙写真（中央に1枚）
          </h2>
          <p className="text-sm text-gray-500 mb-4">表紙の中央に大きく表示されます。</p>
          <CoverPhotoSlot
            photo={data.coverPhoto}
            onUpload={handleCoverPhotoUpload}
            onRemove={handleCoverPhotoRemove}
          />
        </section>

        {/* ③ 報告書用写真 */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-2 pb-3 border-b border-gray-100 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-700 text-white rounded-full text-sm flex items-center justify-center font-bold">3</span>
            写真のアップロード（最大8枚）
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            各写真に作業内容（2項目）を設定できます。1ページあたり4枚、合計2ページです。
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <PhotoSlot
                key={i}
                index={i}
                photo={data.photos[i]}
                onUpload={handlePhotoUpload}
                onCaptionChange={handleCaptionChange}
                onWorkItemChange={handleWorkItemChange}
                onRemove={handleRemovePhoto}
              />
            ))}
          </div>
        </section>

        {/* プレビューボタン */}
        <div className="text-center pb-8">
          <button
            onClick={handlePreview}
            className="px-10 py-3.5 bg-blue-700 text-white text-base font-bold rounded-xl hover:bg-blue-800 shadow-md transition-colors"
          >
            プレビュー・印刷へ進む
          </button>
        </div>
      </main>
    </div>
  )
}

// ─── 表紙写真スロット ────────────────────────────────────────────────────────

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
          <img src={photo.dataUrl} alt="表紙写真" className="w-full h-48 object-cover rounded-lg border border-gray-200" />
          <button onClick={onRemove} className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center shadow transition-colors text-sm" title="削除">×</button>
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

// ─── 写真スロットコンポーネント ────────────────────────────────────────────

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
    [index, onUpload],
  )

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-semibold text-gray-500">写真 {index + 1}</div>
      {photo ? (
        <div className="flex flex-col gap-1">
          {/* サムネイル */}
          <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
            <img src={photo.dataUrl} alt={`写真${index + 1}`} className="w-full aspect-[3/4] object-contain" />
            <button onClick={() => onRemove(index)} className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 text-sm flex items-center justify-center shadow transition-colors leading-none" title="削除">×</button>
          </div>
          {/* 作業内容 */}
          <select
            value={photo.workItem}
            onChange={(e) => onWorkItemChange(index, e.target.value)}
            className="w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
          >
            <option value="">作業内容を選択</option>
            {CLEANING_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          {/* コメント */}
          <input
            type="text"
            value={photo.caption}
            onChange={(e) => onCaptionChange(index, e.target.value)}
            placeholder="コメント（任意）"
            className="w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
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
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
        </div>
      )}
    </div>
  )
}
