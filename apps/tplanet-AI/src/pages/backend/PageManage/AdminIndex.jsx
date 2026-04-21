import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Editor from 'react-simple-wysiwyg';
import DOMPurify from 'dompurify';

const HomepageEditor = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  // Tenant config state
  const [tenantConfig, setTenantConfig] = useState({
    name: "",
    brandName: "",
    primaryColor: "#1976d2",
    secondaryColor: "#424242",
    logoUrl: "",
    kpiBannerUrl: "",
    socialLinks: { facebook: "", youtube: "" },
    privacyUrl: "",
  });
  const [tenantConfigDirty, setTenantConfigDirty] = useState(false);

  // KPI banner upload state (handled separately since the file posts to mockup
  // endpoint before the tenant-config PUT)
  const [kpiBannerFile, setKpiBannerFile] = useState(null);
  const [kpiBannerPreview, setKpiBannerPreview] = useState("");

  // 新增：實際要上傳的檔案
  const [files, setFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

  // --- 工具：嘗試把字串 JSON 解析成物件 ---
  const tryParseJSON = (s) => {
    if (typeof s !== "string") return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  // --- 工具：把舊的巢狀 description 攤平（相容 400 範例）---
  const normalizeDescription = (desc) => {
    let p = { ...(desc || {}) };
    for (let i = 0; i < 3; i++) {
      const inner = tryParseJSON(p.description);
      if (inner && typeof inner === "object") {
        // 內層攤平補到外層（外層已存在的優先）
        Object.entries(inner).forEach(([k, v]) => {
          if (!(k in p)) p[k] = v;
        });
        p.description = inner.description;
      } else {
        break;
      }
    }
    // 如果 description 看起來像 JSON，就刪掉避免污染 state
    if (typeof p.description !== "string" || p.description.trim().startsWith("{")) {
      delete p.description;
    }
    return p;
  };

  // Load tenant config
  useEffect(() => {
    const loadTenantConfig = async () => {
      try {
        const jwt = localStorage.getItem("jwt") || "";
        const response = await fetch(
          `${import.meta.env.VITE_HOST_URL_TPLANET}/api/tenant/admin-config`,
          {
            headers: {
              Accept: "application/json",
              ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
            },
          }
        );
        if (response.ok) {
          const config = await response.json();
          setTenantConfig({
            name: config.name || "",
            brandName: config.brandName || "",
            primaryColor: config.primaryColor || "#1976d2",
            secondaryColor: config.secondaryColor || "#424242",
            logoUrl: config.logoUrl || "",
            kpiBannerUrl: config.kpiBannerUrl || "",
            socialLinks: {
              facebook: config.socialLinks?.facebook || "",
              youtube: config.socialLinks?.youtube || "",
              ...(config.socialLinks || {}),
            },
            privacyUrl: config.privacyUrl || "",
          });
        }
      } catch (e) {
        console.log("Failed to load tenant config:", e);
      }
    };
    loadTenantConfig();
  }, []);

  useEffect(() => {
    const mockup_get = async () => {
      const form = new FormData();
      form.append("email", localStorage.getItem("email"));

      try {
        const response = await fetch(
          `${import.meta.env.VITE_HOST_URL_TPLANET}/api/mockup/get`,
          {
            method: "POST",
            body: form,
          }
        );

        const obj = await response.json();
        console.log("Mockup Get Response:", obj);

        if (obj.result !== false && obj.description && Object.keys(obj.description).length > 0) {
          setData(normalizeDescription(obj.description));
        } else {
          // 初始化空資料，讓編輯器可以使用
          setData({});
        }
      } catch (e) {
        console.log(e);
        setData({});
      } finally {
        setLoading(false);
      }
    };

    mockup_get();
  }, []);

  // Update tenant config field (flat key)
  const updateTenantConfig = (key, value) => {
    setTenantConfig((prev) => ({ ...prev, [key]: value }));
    setTenantConfigDirty(true);
  };

  // Update nested socialLinks entry (facebook / youtube / ...)
  const updateSocialLink = (platform, value) => {
    setTenantConfig((prev) => ({
      ...prev,
      socialLinks: { ...(prev.socialLinks || {}), [platform]: value },
    }));
    setTenantConfigDirty(true);
  };

  // KPI banner file selection (validation + preview only; actual upload in handleSave)
  const handleKpiBannerSelect = (file) => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert(t("edit.cms_upload_format"));
      return;
    }
    if (file.size > maxSize) {
      alert(t("edit.cms_upload_size"));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setKpiBannerPreview(e.target.result);
    reader.readAsDataURL(file);
    setKpiBannerFile(file);
    setTenantConfigDirty(true);
  };

  const clearKpiBannerSelection = () => {
    setKpiBannerFile(null);
    setKpiBannerPreview("");
  };

  // Save tenant config
  //
  // Flow:
  //   1. If admin chose a new KPI banner file, POST it to /api/mockup/new first.
  //      Backend stores the file under /static/new_mockup/<email>/kpi-banner.<ext>
  //      and returns the real URL (with correct extension).
  //   2. PUT the tenant config (including the newly returned kpiBannerUrl) to
  //      /api/tenant/admin-config.
  const saveTenantConfig = async () => {
    try {
      let configToSave = { ...tenantConfig };

      if (kpiBannerFile) {
        const form = new FormData();
        form.append("email", localStorage.getItem("email"));
        form.append("kpi-banner", kpiBannerFile, kpiBannerFile.name);
        const uploadResp = await fetch(
          `${import.meta.env.VITE_HOST_URL_TPLANET}/api/mockup/new`,
          { method: "POST", body: form }
        );
        if (!uploadResp.ok) {
          throw new Error("KPI banner upload failed");
        }
        const uploadObj = await uploadResp.json();
        // Trust backend for the real URL (handles extension correctly).
        const uploadedUrl = uploadObj?.description?.["kpi-banner"];
        if (uploadedUrl) {
          configToSave = { ...configToSave, kpiBannerUrl: uploadedUrl };
          setTenantConfig(configToSave);
          setKpiBannerFile(null);
          setKpiBannerPreview("");
        }
      }

      const jwt = localStorage.getItem("jwt") || "";
      const response = await fetch(
        `${import.meta.env.VITE_HOST_URL_TPLANET}/api/tenant/admin-config`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
          },
          body: JSON.stringify(configToSave),
        }
      );
      if (response.ok) {
        setTenantConfigDirty(false);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Failed to save tenant config:", e);
      return false;
    }
  };

  // 圖片上傳處理（預覽用 base64，實際上傳用 File）
  const handleImageUpload = (file, key) => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/gif"]; // 加上 gif

    if (!allowedTypes.includes(file.type)) {
      alert(t("edit.cms_upload_format"));
      return;
    }
    if (file.size > maxSize) {
      alert(t("edit.cms_upload_size"));
      return;
    }

    // 預覽（dataURL）
    const reader = new FileReader();
    reader.onload = (e) => {
      setData((prev) => ({
        ...prev,
        [key]: e.target.result,
      }));
    };
    reader.readAsDataURL(file);

    // 送到後端的實際檔案
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  // 更新描述內容
  const updateDescription = (key, value) => {
    setData((prev) => ({
      ...prev,
      [key]: DOMPurify.sanitize(value),
    }));
  };

  // 驗證表單
  const validateForm = () => {
    const newErrors = {};

    if (!data["banner-image"]) {
      newErrors.bannerImage = t("edit.cms_upload_banner_required");
    }

    const descriptions = [
      "t-planet-description",
      "csr-description",
      "sdg-description",
      "twins-description",
    ];
    descriptions.forEach((key) => {
      if (!String(data[key] || "").trim()) {
        newErrors[key] = t("edit.cms_desc_required");
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 送出（逐欄位 append；圖片送 File）
  const handleSave = async () => {
    if (!validateForm()) {
      alert(t("edit.cms_validation_all_required"));
      return;
    }

    setIsLoading(true);
    try {
      // Save tenant config first if dirty
      if (tenantConfigDirty) {
        const tenantSaved = await saveTenantConfig();
        if (!tenantSaved) {
          alert("站台設定儲存失敗");
        }
      }

      const form = new FormData();
      form.append("email", localStorage.getItem("email"));

      // 如需保證 HTML <p> 包裹，可用 wrapAsP；否則直接送字串
      const wrapAsP = (v) => {
        const s = String(v || "").trim();
        if (!s) return "";
        return s.startsWith("<") ? s : `<p>${s}</p>`;
      };

      // 文字描述欄位
      form.append("t-planet-description", wrapAsP(data["t-planet-description"]));
      form.append("csr-description", wrapAsP(data["csr-description"]));
      form.append("sdg-description", wrapAsP(data["sdg-description"]));
      form.append("twins-description", wrapAsP(data["twins-description"]));

      // 圖片欄位：有新檔案才上傳；沒有就不覆蓋（後端保留舊值）
      const imageKeys = [
        "banner-image",
        "t-planet-img",
        "csr-img",
        "sdg-img",
        "twins-img",
        // 若未來有下列兩個，也可解鎖：
        // "news-banner-img",
        // "contact-us-banner-img",
      ];
      imageKeys.forEach((k) => {
        if (files[k]) {
          form.append(k, files[k], files[k].name);
        }
      });

      const response = await fetch(
        `${import.meta.env.VITE_HOST_URL_TPLANET}/api/mockup/new`,
        {
          method: "POST",
          body: form,
        }
      );

      if (response.ok) {
        alert(t("edit.cms_save_success"));
        setErrors({});
      } else {
        throw new Error("儲存失敗");
      }
    } catch (error) {
      console.error(error);
      alert(t("edit.cms_save_failed"));
    } finally {
      setIsLoading(false);
    }
  };

  // 圖片編輯子元件
  const ImageEditor = ({
    imageKey,
    label,
    className = "img-fluid",
  }) => {
    // 判斷圖片來源：如果是 data URL (base64) 就直接使用，否則加上 API URL
    const getImageSrc = (imageData) => {
      if (!imageData) return null;
      if (typeof imageData === "string" && imageData.startsWith("data:")) {
        return imageData; // 使用者剛上傳的 base64
      }
      // 後端回傳的相對路徑
      return `${import.meta.env.VITE_HOST_URL_TPLANET}${imageData}`;
    };

    const imageSrc = getImageSrc(data[imageKey]);

    return (
      <div className="relative group">
        {imageSrc ? (
          <img
            className={className}
            src={imageSrc}
            alt={label}
          />
        ) : (
          <div className={`${className} bg-gray-200 flex items-center justify-center min-h-[200px] border-2 border-dashed border-gray-400`}>
            <div className="text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>{label}</p>
              <p className="text-sm">點擊下方按鈕上傳圖片</p>
            </div>
          </div>
        )}

        <div className="absolute bottom-0 right-0">
          <button
            onClick={() =>
              document.getElementById(`upload-${imageKey}`).click()
            }
            className="bg-[#317EE0] text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center"
          >
            {t("edit.cms_edit_image")}
          </button>
          <input
            id={`upload-${imageKey}`}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) =>
              e.target.files[0] &&
              handleImageUpload(e.target.files[0], imageKey)
            }
          />
        </div>
      </div>
    );
  };

  // 描述編輯子元件
  const DescriptionEditor = ({
    descKey,
    placeholder,
    className = "text-xl",
  }) => (
    <div>
      <div className="wysiwyg-content">
        <Editor
          value={data[descKey] || ""}
          onChange={(e) => updateDescription(descKey, e.target.value)}
          placeholder={placeholder}
        />
        {errors[descKey] && (
          <div className="mt-1 flex items-center text-red-600 text-sm">
            {errors[descKey]}
          </div>
        )}
      </div>
    </div>
  );

  // Tenant Config Editor Component
  const TenantConfigSection = () => (
    <div className="container mx-auto mb-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          站台基本設定
          {tenantConfigDirty && (
            <span className="text-sm text-orange-500 font-normal">(未儲存)</span>
          )}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 站台名稱 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              站台名稱
            </label>
            <input
              type="text"
              value={tenantConfig.name}
              onChange={(e) => updateTenantConfig("name", e.target.value)}
              placeholder="輸入站台名稱"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Logo URL
            </label>
            <input
              type="text"
              value={tenantConfig.logoUrl}
              onChange={(e) => updateTenantConfig("logoUrl", e.target.value)}
              placeholder="/static/images/logo.svg"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* 主色 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              主題色
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={tenantConfig.primaryColor}
                onChange={(e) => updateTenantConfig("primaryColor", e.target.value)}
                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={tenantConfig.primaryColor}
                onChange={(e) => updateTenantConfig("primaryColor", e.target.value)}
                placeholder="#1976d2"
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* 輔助色 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              輔助色
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={tenantConfig.secondaryColor}
                onChange={(e) => updateTenantConfig("secondaryColor", e.target.value)}
                className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={tenantConfig.secondaryColor}
                onChange={(e) => updateTenantConfig("secondaryColor", e.target.value)}
                placeholder="#424242"
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 預覽 */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">主題預覽：</p>
          <div className="flex gap-4 items-center">
            <div
              className="w-20 h-8 rounded"
              style={{ backgroundColor: tenantConfig.primaryColor }}
            />
            <span className="text-sm">主色</span>
            <div
              className="w-20 h-8 rounded"
              style={{ backgroundColor: tenantConfig.secondaryColor }}
            />
            <span className="text-sm">輔助色</span>
          </div>
        </div>

        {/* 品牌 / 社群 / 隱私 / KPI banner */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold mb-4">品牌 / 社群 / 隱私</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 品牌名稱 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                品牌名稱
                <span className="ml-1 text-xs text-gray-400">
                  (footer 顯示，留空則沿用站台名稱)
                </span>
              </label>
              <input
                type="text"
                value={tenantConfig.brandName}
                onChange={(e) => updateTenantConfig("brandName", e.target.value)}
                placeholder="Second Home"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 隱私權政策 URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                隱私權政策 URL
              </label>
              <input
                type="text"
                value={tenantConfig.privacyUrl}
                onChange={(e) => updateTenantConfig("privacyUrl", e.target.value)}
                placeholder="https://privacy.example.com/"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Facebook */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Facebook URL
              </label>
              <input
                type="text"
                value={tenantConfig.socialLinks?.facebook || ""}
                onChange={(e) => updateSocialLink("facebook", e.target.value)}
                placeholder="https://www.facebook.com/..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* YouTube */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                YouTube URL
              </label>
              <input
                type="text"
                value={tenantConfig.socialLinks?.youtube || ""}
                onChange={(e) => updateSocialLink("youtube", e.target.value)}
                placeholder="https://www.youtube.com/..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* KPI banner: preview + upload or URL */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                KPI 頁 Banner
                <span className="ml-1 text-xs text-gray-400">
                  (留空則使用預設 banner；建議 2400×400，6:1)
                </span>
              </label>
              <div className="flex flex-col md:flex-row gap-4 items-start">
                <div className="flex-shrink-0 w-full md:w-56 h-20 bg-gray-100 rounded border border-gray-200 overflow-hidden flex items-center justify-center">
                  {kpiBannerPreview ? (
                    <img
                      src={kpiBannerPreview}
                      alt="KPI banner preview"
                      className="object-contain h-full w-full"
                    />
                  ) : tenantConfig.kpiBannerUrl ? (
                    <img
                      src={
                        tenantConfig.kpiBannerUrl.startsWith("http")
                          ? tenantConfig.kpiBannerUrl
                          : `${import.meta.env.VITE_HOST_URL_TPLANET}${tenantConfig.kpiBannerUrl}`
                      }
                      alt="KPI banner"
                      className="object-contain h-full w-full"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="text-xs text-gray-400">尚未設定</span>
                  )}
                </div>
                <div className="flex-1 w-full">
                  <input
                    type="text"
                    value={tenantConfig.kpiBannerUrl}
                    onChange={(e) => updateTenantConfig("kpiBannerUrl", e.target.value)}
                    placeholder="/static/new_mockup/.../kpi-banner.png"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="mt-2 flex gap-2 items-center">
                    <button
                      type="button"
                      onClick={() =>
                        document.getElementById("kpi-banner-upload").click()
                      }
                      className="bg-[#317EE0] text-white px-4 py-2 rounded hover:bg-blue-600 text-sm"
                    >
                      選擇圖片上傳
                    </button>
                    {kpiBannerFile && (
                      <>
                        <span className="text-xs text-gray-500 truncate max-w-[180px]">
                          {kpiBannerFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={clearKpiBannerSelection}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >
                          取消選擇
                        </button>
                      </>
                    )}
                    <input
                      id="kpi-banner-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        e.target.files[0] &&
                        handleKpiBannerSelect(e.target.files[0])
                      }
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    儲存後上傳並自動更新 URL（副檔名以實際檔案為準）。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Loading 狀態
  if (loading) {
    return (
      <section className="flex-grow mt-5">
        <div className="flex flex-col items-center justify-center py-40">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </section>
    );
  }

  return (
    <div className="relative">
      <section className="flex-grow mt-5">
        {/* 站台基本設定 */}
        <TenantConfigSection />

        <div className="container mx-auto px-0 py-2">
          <div className="text-center">
            {/* 橫幅圖片 */}
            <ImageEditor
              imageKey="banner-image"
              label="橫幅圖片"
              className="img-fluid"
            />
            {errors.bannerImage && (
              <div className="mt-2 flex items-center justify-center text-red-600 text-sm">
                ⚠️ {errors.bannerImage}
              </div>
            )}
          </div>
        </div>

        <div className="container mx-auto">
          <div className="py-4">
            <div className="flex justify-center py-6">
              <div className="col-md-10">
                {/* T-Planet 描述 */}
                <DescriptionEditor
                  descKey="t-planet-description"
                  placeholder={t("adminIndex.cms_placeholder_tplanet")}
                  className="px-3 md:px-0 text-xl"
                />
              </div>
            </div>
          </div>

          <div className="py-4">
            <div className="flex justify-center">
              <div className="w-full md:w-10/12">
                <div className="text-center">
                  {/* T-Planet 地圖 */}
                  <ImageEditor
                    imageKey="t-planet-img"
                    label="專案地圖"
                    className="img-fluid"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-light py-4">
          <div className="container mx-auto">
            {/* CSR 區塊 */}
            <div className="flex justify-center">
              <div className="w-full md:w-10/12">
                <div className="card p-2 md:p-4">
                  <div className="flex flex-col md:flex-row items-center">
                    <div className="w-full md:w-5/12 text-center">
                      <ImageEditor
                        imageKey="csr-img"
                        label="CSR 圖片"
                        className="img-fluid p-3 md:p-0"
                      />
                    </div>
                    <div className="w-full md:w-7/12">
                      <div className="card-body">
                        <DescriptionEditor
                          descKey="csr-description"
                          placeholder={t("adminIndex.cms_placeholder_csr")}
                          className="card-text text-xl"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SDG 區塊 */}
            <div className="flex justify-center mt-5">
              <div className="w-full md:w-10/12">
                <div className="card p-2 md:p-4">
                  <div className="flex flex-col md:flex-row items-center">
                    <div className="w-full md:w-5/12 text中心">
                      <ImageEditor
                        imageKey="sdg-img"
                        label="SDGs 圖片"
                        className="img-fluid p-3 md:p-0"
                      />
                    </div>
                    <div className="w-full md:w-7/12">
                      <div className="card-body">
                        <DescriptionEditor
                          descKey="sdg-description"
                          placeholder={t("adminIndex.cms_placeholder_sdg")}
                          className="card-text text-xl"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Digital Twin 區塊 */}
            <div className="flex justify-center mt-5">
              <div className="w-full md:w-10/12">
                <div className="card p-2 md:p-4">
                  <div className="flex flex-col md:flex-row items-center">
                    <div className="w-full md:w-5/12 text-center">
                      <ImageEditor
                        imageKey="twins-img"
                        label="數位分身圖片"
                        className="img-fluid p-3 md:p-0"
                      />
                    </div>
                    <div className="w-full md:w-7/12">
                      <div className="card-body">
                        <DescriptionEditor
                          descKey="twins-description"
                          placeholder={t("adminIndex.cms_placeholder_digital_twin")}
                          className="card-text text-xl"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 儲存按鈕 */}
        <div className="p-6">
          <div className="flex justify-center">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="bg-[#317EE0] rounded text-white px-8 py-2 hover:bg-blue-600 disabled:bg-gray-400 flex items-center font-medium"
            >
              {isLoading ? t("edit.cms_saving") : t("edit.cms_save")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomepageEditor;