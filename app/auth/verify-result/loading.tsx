export default function Loading() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 px-4">
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-[#8a348e]/30 border-t-[#8a348e]"
        aria-hidden="true"
      />
      <div className="text-sm text-gray-600 text-center">Đang tải kết quả…</div>
    </div>
  )
}
