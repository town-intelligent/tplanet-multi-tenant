import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
// InputBar 組件修改示例

export default function InputBar({
  onSend,
  onStop,
  isLoading,
  isStreaming,
  disabled = false,
  disabledMessage,
  prefillText = "" // 新增：用於預填文字的 prop
}) {
  const [input, setInput] = useState("");
  const { t } = useTranslation();

  // 當 prefillText 改變時，自動填入 input
  useEffect(() => {
    if (prefillText) {
      setInput(prefillText);
    }
  }, [prefillText]);

  const handleSend = () => {
    if (disabled) return; // 🔥 禁用時不執行

    const text = input.trim();
    if (!text) return;

    onSend(text, () => setInput(""));
  };

  const handleKeyPress = (e) => {
    if (disabled) return; // 🔥 禁用時不執行

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white p-4">
      {/* 🔥 顯示禁用訊息 */}
      {disabled && disabledMessage && (
        <div className="mb-2 text-sm text-gray-500 text-center">
          {disabledMessage}
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={disabled ? t("aiSecretary.waitforResponse") : t("aiSecretary.input")}
          disabled={disabled}  // 🔥 禁用輸入框
          className={`flex-1 resize-none border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--tenant-primary)] ${
            disabled ? "bg-gray-100 cursor-not-allowed" : ""
          }`}
          rows={1}
        />

        {isStreaming ? (
          <button
            onClick={onStop}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            {t("aiSecretary.stop")}
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={disabled || isLoading || !input.trim()}  // 🔥 加入 disabled 條件
            className={`px-4 py-2 rounded-lg ${
              disabled || isLoading || !input.trim()
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-[var(--tenant-primary)] hover:opacity-90"
            } text-[var(--tenant-primary-contrast)]`}
          >
            {isLoading ? t("aiSecretary.sending") : t("aiSecretary.send")}
          </button>
        )}
      </div>
    </div>
  );
}