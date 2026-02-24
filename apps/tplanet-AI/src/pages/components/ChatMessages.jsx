import { useState } from "react";
import { exportChartAsPDF, exportChartAsDocx } from "../../pages/utils/Exporter";
import SimpleChart from "../../utils/sdgs/SimpleChart";
import AI from "../../assets/ai_icon.svg";
import { useTranslation } from "react-i18next";

function linkify(text) {
  if (!text) return null;
  const urlRe = /(https?:\/\/[^\s]+)/g;
  const parts = String(text).split(urlRe);
  return parts.map((part, i) => {
    if (urlRe.test(part)) {
      let label = part;
      const m = part.match(/content\.html\?uuid=([A-Za-z0-9\-]+)/);
      if (m) label = m[1];
      return (
        <a
          key={`lnk-${i}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--tenant-primary)] underline break-all"
        >
          {label}
        </a>
      );
    }
    return <span key={`txt-${i}`}>{part}</span>;
  });
}

export default function ChatMessages({ messages, policyHit, isStreaming, onConfirm }) {
  const [copiedId, setCopiedId] = useState(null);
  const { t } = useTranslation();

  const handleCopy = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error("複製失敗:", err);
    }
  };

  return (
    <div className="flex-1 p-4 overflow-y-auto space-y-4">
      {policyHit && (
        <div className="px-4 pt-3 pb-1 border-b">
          <span className="text-xs text-red-600">已觸發安全政策：{policyHit}</span>
        </div>
      )}

      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex items-start ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
        >
          {msg.sender === "ai" && (
            <img src={AI} alt="AI" className="w-8 h-8 rounded-full mr-2 flex-shrink-0" />
          )}

          <div className="flex flex-col max-w-[620px]">
            <div
              className={`text-sm ${
                msg.sender === "user"
                  ? "bg-[var(--tenant-primary)] text-[var(--tenant-primary-contrast)]"
                  : "bg-white text-gray-900 border border-gray-200"
              } p-3 rounded-lg shadow-sm`}
            >
              {msg.type === "chart" ? (
                <div>
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                  <div id={`chart-${msg.id}`} className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 overflow-auto" style={{ maxWidth: 400 }}>
                    <div style={{ minWidth: 500 }}>
                      <SimpleChart chartData={msg.chartData} />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    {!msg.confirmed ? (
                      <button
                        className="px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                        onClick={() => onConfirm && onConfirm(msg.id)}
                      >
                        {t("aiSecretary.confirm")}
                      </button>
                    ) : (
                      <>
                        <button
                          className="px-3 py-2 rounded bg-black text-white hover:bg-gray-800"
                          onClick={() => exportChartAsPDF(`chart-${msg.id}`)}
                        >
                          {t("aiSecretary.exportPDF")}
                        </button>
                        <button
                          className="px-3 py-2 rounded bg-white border hover:bg-gray-50"
                          onClick={() => exportChartAsDocx(`chart-${msg.id}`)}
                        >
                          {t("aiSecretary.exportWORD")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{linkify(msg.text)}</div>
              )}
            </div>

            <div className="text-xs text-gray-500 mt-1 px-1 flex items-center">
              <span className="font-medium">{msg.sender === "ai" ? "AI 秘書" : "您"}</span>
              <span className="mx-1">•</span>
              <span>{msg.time}</span>
              {msg.sender === "ai" && (
                <button
                  onClick={() => handleCopy(msg.text, i)}
                  className="ml-2 px-2 py-0.5 text-xs text-gray-500 hover:text-[var(--tenant-primary)] hover:bg-gray-50 rounded transition-colors"
                  title={t("aiSecretary.copyMessage")}
                >
                  {copiedId === i ? t("aiSecretary.copied") : t("aiSecretary.copy")}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {isStreaming && (
        <div className="flex items-start">
          <img src={AI} alt="AI" className="w-8 h-8 rounded-full mr-2 flex-shrink-0" />
          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full animate-bounce bg-[var(--tenant-primary)]"></div>
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
