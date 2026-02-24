// src/pages/components/OcrTaskList.jsx
import { TIPS } from "../utils/tips";
import { useTipsCarousel } from "../hooks/useTipsCarousel";

export default function OcrTaskList({ tasks, onStartPrefill, onCancel, listRef }) {
  const tipIndex = useTipsCarousel(TIPS.length, 8000);
  if (!tasks?.length) return null;

  const stageLabel = (s) => {
    switch (s) {
      case "ocr": return "OCR 解析中";
      case "index": return "建立索引中";
      case "extract": return "欄位抽取中";
      case "cms_upload": return "上傳 CMS 中";
      case "done": return "完成";
      case "error": return "失敗";
      default: return "準備中";
    }
  };

  return (
    <div ref={listRef} className="space-y-3 mb-2 px-4">
      {tasks.map((t) => {
        const pct = Math.round(Math.min(1, Math.max(0, t.progress ?? 0)) * 100);
        const isDone = t.stage === "done";
        const isError = t.stage === "error";
        return (
          <div key={t.id} className="border rounded-lg bg-white shadow-sm p-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-800">
                {isDone ? "處理完成" : isError ? "處理發生錯誤" : "正在處理，我們先暫停對話"} …〈{t.name}〉
              </div>
              {!isDone && !isError && (
                <button
                  onClick={() => onCancel?.(t.id)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  取消顯示
                </button>
              )}
            </div>

            {/* Stage line */}
            <div className="mt-2 text-xs text-gray-600">
              階段：{stageLabel(t.stage)}
              {t.message ? <span className="text-gray-400">（{t.message}）</span> : null}
            </div>

            {/* Progress */}
            {!isDone && !isError && (
              <>
                <div className="mt-2 h-2 w-full bg-gray-200 rounded overflow-hidden">
                  <div
                    className="h-full bg-[var(--tenant-primary)] transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>{pct}%</span>
                  <span className="truncate">💡 {TIPS[tipIndex]}</span>
                </div>
              </>
            )}

            {/* Actions / Footer */}
            <div className="mt-3 flex items-center justify-between">
              {isDone ? (
                <>
                  <div className="text-sm text-green-600">
                    ✅ 已完成{t.cmsLink ? " → 可開啟專案" : ""}
                  </div>
                  <div className="flex gap-2">
                    {t.cmsLink && (
                      <a
                        href={t.cmsLink}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded bg-[var(--tenant-primary)] text-[var(--tenant-primary-contrast)] text-xs hover:opacity-90"
                      >
                        開啟專案
                      </a>
                    )}
                    <button
                      onClick={() => onCancel?.(t.id)}
                      className="px-3 py-1.5 rounded border text-xs hover:bg-gray-50"
                    >
                      關閉
                    </button>
                  </div>
                </>
              ) : isError ? (
                <>
                  <div className="text-sm text-red-600">
                    ❌ 處理失敗：{t.error || "請稍後重試"}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onCancel?.(t.id)}
                      className="px-3 py-1.5 rounded border text-xs hover:bg-gray-50"
                    >
                      關閉
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}