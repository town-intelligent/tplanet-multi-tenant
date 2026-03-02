// src/pages/frontend/NewsContent.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { news_get } from "../utils/New";
import Tr from "../utils/Tr.jsx";

const TPLANET_BASE = import.meta.env.VITE_HOST_URL_TPLANET;

const buildUrl = (p) => {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return `${TPLANET_BASE}${p}`;
};

const ATTACH_EXTS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".ppt", ".pptx", ".zip", ".rar", ".7z",
  ".csv", ".txt"
];

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2)} ${units[i]}`;
};

// 支援 attachments_data(物件/陣列) + 從 static 掃描常見附件
const normalizeAttachments = (attachmentsData, staticObj) => {
  const results = [];
  const pushOne = (obj, idx = 0) => {
    if (!obj) return;
    const rawUrl = obj.url || obj.href || obj.path;
    if (!rawUrl) return;
    results.push({
      name: obj.original_name || obj.name || obj.safe_filename || rawUrl.split("/").pop() || `附件_${idx + 1}`,
      url: buildUrl(rawUrl),
      size: obj.file_size,
      type: obj.file_type
    });
  };
  if (Array.isArray(attachmentsData)) attachmentsData.forEach((o, i) => pushOne(o, i));
  else if (attachmentsData && typeof attachmentsData === "object") pushOne(attachmentsData, 0);

  if (staticObj && typeof staticObj === "object") {
    Object.entries(staticObj).forEach(([k, v]) => {
      if (!v || typeof v !== "string") return;
      const lower = v.toLowerCase();
      const isImageKey = k === "banner" || /^img_\d+$/.test(k);
      const looksAttach = ATTACH_EXTS.some((ext) => lower.endsWith(ext));
      if (!isImageKey && looksAttach) {
        results.push({
          name: v.split("/").pop() || k,
          url: buildUrl(v),
          size: undefined,
          type: ATTACH_EXTS.find((ext) => lower.endsWith(ext)) || ""
        });
      }
    });
  }

  const uniq = [];
  const seen = new Set();
  for (const r of results) {
    if (r.url && !seen.has(r.url)) { seen.add(r.url); uniq.push(r); }
  }
  return uniq;
};

function NewsContent() {
  const { id } = useParams(); // /news_content/:id → uuid
  const [news, setNews] = useState(null);
  const [selectedImg, setSelectedImg] = useState(null);
  const [showAttach, setShowAttach] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await news_get(id);
        if (!res?.result) throw new Error(res?.error || "news_get 失敗");
        setNews(res.content);
      } catch (e) {
        setError(e?.message || "未知錯誤");
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, [id]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && (setSelectedImg(null), setShowAttach(false));
    if (selectedImg || showAttach) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedImg, showAttach]);

  const title = news?.title || "—";
  const period = news?.period || "";
  const descriptionRaw = news?.description || "";

  const bannerUrl = useMemo(() => buildUrl(news?.static?.banner), [news?.static?.banner]);
  const thumbUrls = useMemo(() => {
    if (!news?.static) return [];
    return ["img_0", "img_1", "img_2"].map((k) => news.static[k]).filter(Boolean).map(buildUrl);
  }, [news?.static]);

  const attachments = useMemo(
    () => normalizeAttachments(news?.attachments_data, news?.static),
    [news?.attachments_data, news?.static]
  );

  const descNodes = useMemo(() => {
    if (!descriptionRaw) return null;
    return descriptionRaw
      .split(/\r?\n\r?\n|\r?\n/g)
      .filter((s) => s.trim().length)
      .map((para, idx) => (
        <Tr key={idx} className="mb-4 leading-7">{para}</Tr>
      ));
  }, [descriptionRaw]);

  if (loading) return <div className="px-6 py-10">🔄 載入中...</div>;
  if (error) return <div className="px-6 py-10">❌ {error}</div>;
  if (!news) return <div className="px-6 py-10">❌ 找不到新聞內容。</div>;

  const openAllAttachments = () => {
    attachments.forEach((a) => window.open(a.url, "_blank", "noopener,noreferrer"));
  };

  return (
    <div id="news-container" className="flex w-5/6 mx-auto gap-6 pt-10">
      {/* 左側：圖片區 */}
      <div className="w-full md:w-1/2 flex flex-col">
        <div
          id="banner"
          className="bg-center bg-cover bg-white cursor-pointer hover:scale-105 transition-transform duration-300 rounded"
          style={{ backgroundImage: bannerUrl ? `url(${bannerUrl})` : "none", height: 250 }}
          onClick={() => bannerUrl && setSelectedImg(bannerUrl)}
        >
          {!bannerUrl && (
            <span className="flex items-center justify-center h-full text-gray-400 text-sm">
              No Image
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2.5 mt-3 w-full">
          {thumbUrls.length ? (
            thumbUrls.map((u, idx) => (
              <div
                key={idx}
                id={`img_${idx}`}
                className="w-full aspect-square bg-center bg-cover bg-white cursor-pointer hover:scale-105 transition-transform duration-300 rounded"
                style={{ backgroundImage: `url(${u})` }}
                onClick={() => setSelectedImg(u)}
              />
            ))
          ) : (
            <div className="col-span-3 text-center text-gray-400 text-sm py-6 border rounded">
              無更多圖片
            </div>
          )}
        </div>

        {selectedImg && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999]"
            onClick={() => setSelectedImg(null)}
          >
            <img
              src={selectedImg}
              alt="Preview"
              className="max-w-[90%] max-h-[90%] rounded-lg shadow-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>

      {/* 右側：內文區 */}
      <div className="w-full md:w-1/2">
        <div id="title">
          <Tr className="text-[var(--tenant-primary)] text-3xl md:text-4xl font-bold" children={title} />
        </div>
        {period && (
          <p id="period" className="text-[var(--tenant-primary)] text-2xl md:text-3xl font-semibold mt-1">
            {period}
          </p>
        )}

        <div id="description" className="mt-6 text-base">
          {descNodes}
        </div>

        {/* 下載附件：放在內文下方（整欄寬、置中、藍底白字） */}
        {attachments.length > 0 && (
          <div className="mt-6">
            <a
              href={attachments[0].url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-[var(--tenant-primary)] text-[var(--tenant-primary-contrast)] rounded-md px-6 py-4 hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--tenant-primary)]"
            >
              <div className="flex items-center justify-center gap-3">
                {/* 小相機/附件圖示（inline SVG，避免額外依賴） */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 7a4 4 0 1 1 8 0v6a6 6 0 1 1-12 0V9a1 1 0 1 1 2 0v4a4 4 0 1 0 8 0V7a2 2 0 1 0-4 0v6a1 1 0 1 1-2 0V7z" />
                </svg>
                <span className="text-lg font-semibold">
                  附件{attachments.length > 1 ? `（${attachments.length}）` : ""}
                </span>
                {attachments[0].size ? (
                  <span className="text-sm opacity-90">· {formatFileSize(attachments[0].size)}</span>
                ) : null}
              </div>
            </a>

            {/* 多附件時的輔助操作 */}
            {attachments.length > 1 && (
              <div className="mt-2 flex items-center justify-end gap-4 text-sm">
                <button
                  onClick={() => setShowAttach(true)}
                  className="text-[var(--tenant-primary)] hover:underline"
                >
                  查看全部
                </button>
                <button
                  onClick={openAllAttachments}
                  className="text-[var(--tenant-primary)] hover:underline"
                  title="在新分頁開啟全部附件"
                >
                  全部開啟
                </button>
              </div>
            )}
          </div>
        )}

        {/* 附件列表 Modal */}
        {showAttach && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
            onClick={() => setShowAttach(false)}
          >
            <div
              className="bg-white rounded-xl shadow-xl w-[90%] max-w-xl p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">附件下載</h3>
                <button
                  onClick={() => setShowAttach(false)}
                  className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200"
                >
                  關閉
                </button>
              </div>
              <ul className="divide-y">
                {attachments.map((a) => (
                  <li key={a.url} className="py-3 flex items-center justify-between gap-4">
                    <div className="truncate">
                      <span className="mr-2">📎</span>
                      <span className="truncate" title={a.name}>{a.name}</span>
                      {a.size ? <span className="ml-2 text-gray-500 text-sm">({formatFileSize(a.size)})</span> : null}
                    </div>
                    <a
                      href={a.url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 px-3 py-1 rounded bg-[var(--tenant-primary)] text-[var(--tenant-primary-contrast)] hover:opacity-90"
                    >
                      下載
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default NewsContent;
