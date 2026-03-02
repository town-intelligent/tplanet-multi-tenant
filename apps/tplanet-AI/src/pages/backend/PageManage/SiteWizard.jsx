import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ImageUpload from "../../../components/ImageUpload";
import { getContrastColor } from "../../../utils/multi-tenant";

const STEPS = [
  { id: 1, title: "基本資料", description: "設定站台 ID 與名稱" },
  { id: 2, title: "主題設定", description: "選擇顏色與 Logo" },
  { id: 3, title: "功能開關", description: "啟用或停用功能" },
  { id: 4, title: "確認建立", description: "檢視並確認設定" },
];

const AVAILABLE_FEATURES = [
  { key: "ai_secretary", label: "AI 智慧秘書", description: "啟用 AI 對話功能" },
  { key: "news", label: "最新消息", description: "啟用最新消息公告功能" },
  { key: "sroi", label: "SROI 分析", description: "啟用社會投資報酬率分析" },
  { key: "analytics", label: "數據分析", description: "啟用數據分析儀表板" },
];

const SiteWizard = () => {
  const navigate = useNavigate();
  const { tenantId: editTenantId } = useParams();
  const isEditMode = Boolean(editTenantId);

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    tenantId: "",
    name: "",
    adminEmail: "",            // 站台管理員 email → hosters[0]
    primaryColor: "#1976d2",
    secondaryColor: "#424242",
    logoUrl: "",
    createSubdomain: true,  // 自動建立子網域
    features: {
      ai_secretary: true,
      news: true,
      sroi: true,
      analytics: true,
    },
  });

  const [subdomainStatus, setSubdomainStatus] = useState(null); // null, 'checking', 'available', 'exists'
  const validateTimeoutRef = useRef(null);

  // Load existing tenant data in edit mode
  useEffect(() => {
    if (isEditMode) {
      loadTenantData();
    }
  }, [editTenantId]);

  const loadTenantData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_HOST_URL_TPLANET}/api/tenant/${editTenantId}`
      );
      if (!response.ok) throw new Error("無法載入站台資料");
      const result = await response.json();
      const tenant = result.data;

      setFormData({
        tenantId: tenant.tenantId,
        name: tenant.name || "",
        adminEmail: (tenant.hosters && tenant.hosters[0]) || "",
        existingHosters: tenant.hosters || [],
        primaryColor: tenant.primaryColor || "#1976d2",
        secondaryColor: tenant.secondaryColor || "#424242",
        logoUrl: tenant.logoUrl || "",
        features: tenant.features || {
          ai_secretary: true,
          nft: false,
          analytics: true,
          custom_reports: false,
        },
      });
    } catch (e) {
      setError("載入失敗: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setError(null);

    // 檢查站台 ID 是否可用（debounce 500ms）
    if (key === "tenantId") {
      if (validateTimeoutRef.current) {
        clearTimeout(validateTimeoutRef.current);
      }
      if (value.length >= 2) {
        setSubdomainStatus("checking");
        validateTimeoutRef.current = setTimeout(() => {
          checkSubdomainAvailability(value);
        }, 500);
      } else {
        setSubdomainStatus(null);
      }
    }
  };

  const checkSubdomainAvailability = async (tenantId) => {
    if (!tenantId || tenantId.length < 2) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_HOST_URL_TPLANET}/api/tenant/validate/${tenantId}`
      );
      const result = await response.json();
      if (result.available) {
        setSubdomainStatus("available");
        setError(null);
      } else {
        setSubdomainStatus("exists");
        setError(result.reason);
      }
    } catch (e) {
      setSubdomainStatus(null);
    }
  };

  const updateFeature = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      features: { ...prev.features, [key]: value },
    }));
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!formData.tenantId.trim()) {
          setError("請輸入站台 ID");
          return false;
        }
        if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(formData.tenantId) && formData.tenantId.length > 2) {
          if (!/^[a-z0-9]+$/.test(formData.tenantId)) {
            setError("站台 ID 只能包含小寫英文、數字和連字號");
            return false;
          }
        }
        // 新增模式需要驗證 tenant ID 可用性
        if (!isEditMode && subdomainStatus !== "available") {
          setError("請等待站台 ID 驗證完成");
          return false;
        }
        if (!formData.name.trim()) {
          setError("請輸入站台名稱");
          return false;
        }
        if (!formData.adminEmail.trim() || !/\S+@\S+\.\S+/.test(formData.adminEmail)) {
          setError("請輸入有效的站台管理員 Email");
          return false;
        }
        return true;
      case 2:
        if (!/^#[0-9A-Fa-f]{6}$/.test(formData.primaryColor)) {
          setError("主題色格式不正確");
          return false;
        }
        if (!/^#[0-9A-Fa-f]{6}$/.test(formData.secondaryColor)) {
          setError("輔助色格式不正確");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setError(null);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEditMode
        ? `${import.meta.env.VITE_HOST_URL_TPLANET}/api/tenant/${editTenantId}`
        : `${import.meta.env.VITE_HOST_URL_TPLANET}/api/tenant/create`;

      const submitData = {
        ...formData,
        hosters: isEditMode
          ? [formData.adminEmail.trim(), ...(formData.existingHosters || []).slice(1)]
          : [formData.adminEmail.trim()],
      };
      delete submitData.adminEmail;
      delete submitData.existingHosters;
      delete submitData.createSubdomain;

      const response = await fetch(url, {
        method: isEditMode ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();

      if (response.ok) {
        // 建立子網域（僅新增模式且有勾選）
        if (!isEditMode && formData.createSubdomain) {
          try {
            const dnsResponse = await fetch(
              `${import.meta.env.VITE_HOST_URL_TPLANET}/api/tenant/dns/create`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  subdomain: formData.tenantId,
                  proxied: true,
                }),
              }
            );
            const dnsResult = await dnsResponse.json();
            if (dnsResult.success) {
              alert(`站台 "${formData.name}" 建立成功！\n子網域: ${formData.tenantId}.sechome.cc`);
            } else {
              alert(`站台建立成功，但子網域建立失敗: ${dnsResult.error}`);
            }
          } catch (e) {
            alert(`站台建立成功，但子網域建立失敗: ${e.message}`);
          }
        } else {
          alert(`站台 "${formData.name}" ${isEditMode ? "更新" : "建立"}成功！`);
        }
        navigate("/backend/tenant/list");
      } else {
        setError(result.error || `${isEditMode ? "更新" : "建立"}失敗`);
      }
    } catch (e) {
      setError("網路錯誤: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step indicator
  const StepIndicator = () => (
    <div className="flex justify-between mb-8">
      {STEPS.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
              currentStep >= step.id
                ? "bg-blue-600 border-blue-600 text-white"
                : "border-gray-300 text-gray-400"
            }`}
          >
            {step.id}
          </div>
          <div className="ml-2 hidden md:block">
            <p className={`text-sm font-medium ${currentStep >= step.id ? "text-blue-600" : "text-gray-400"}`}>
              {step.title}
            </p>
            <p className="text-xs text-gray-400">{step.description}</p>
          </div>
          {index < STEPS.length - 1 && (
            <div className={`w-12 h-0.5 mx-4 ${currentStep > step.id ? "bg-blue-600" : "bg-gray-300"}`} />
          )}
        </div>
      ))}
    </div>
  );

  // Step 1: Basic Info
  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          站台 ID <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.tenantId}
          onChange={(e) => updateField("tenantId", e.target.value.toLowerCase())}
          placeholder="my-site"
          disabled={isEditMode}
          className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${
            isEditMode ? "bg-gray-100 cursor-not-allowed" : ""
          }`}
        />
        <div className="mt-1 flex items-center gap-2">
          <p className="text-sm text-gray-500">
            {isEditMode
              ? "站台 ID 建立後無法修改"
              : "只能使用小寫英文、數字和連字號"}
          </p>
          {!isEditMode && subdomainStatus && (
            <span className={`text-sm px-2 py-0.5 rounded ${
              subdomainStatus === "checking" ? "bg-gray-100 text-gray-600" :
              subdomainStatus === "available" ? "bg-green-100 text-green-700" :
              "bg-yellow-100 text-yellow-700"
            }`}>
              {subdomainStatus === "checking" ? "檢查中..." :
               subdomainStatus === "available" ? "可用" : "已存在"}
            </span>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          站台名稱 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => updateField("name", e.target.value)}
          placeholder="我的站台"
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          站台管理員 Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={formData.adminEmail}
          onChange={(e) => updateField("adminEmail", e.target.value)}
          placeholder="admin@example.com"
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-sm text-gray-500">
          此帳號將成為站台管理員，可登入後台管理會員
        </p>
      </div>

      {/* 子網域設定 */}
      {!isEditMode && (
        <div className="p-4 bg-blue-50 rounded-lg">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.createSubdomain}
              onChange={(e) => updateField("createSubdomain", e.target.checked)}
              className="w-5 h-5 mt-0.5 text-blue-600 rounded"
            />
            <div>
              <p className="font-medium text-gray-700">自動建立子網域</p>
              <p className="text-sm text-gray-500">
                建立 <span className="font-mono bg-white px-1 rounded">{formData.tenantId || "tenant-id"}.sechome.cc</span> 並設定 Cloudflare DNS
              </p>
            </div>
          </label>
        </div>
      )}
    </div>
  );

  // Step 2: Theme
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">主題色</label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={formData.primaryColor}
              onChange={(e) => updateField("primaryColor", e.target.value)}
              className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={formData.primaryColor}
              onChange={(e) => updateField("primaryColor", e.target.value)}
              className="flex-1 p-3 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">輔助色</label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={formData.secondaryColor}
              onChange={(e) => updateField("secondaryColor", e.target.value)}
              className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={formData.secondaryColor}
              onChange={(e) => updateField("secondaryColor", e.target.value)}
              className="flex-1 p-3 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
        <ImageUpload
          value={formData.logoUrl}
          onChange={(url) => updateField("logoUrl", url)}
          type="logo"
          tenantId={formData.tenantId || "new"}
          placeholder="點擊或拖放 Logo 圖片上傳"
        />
      </div>

      {/* Preview */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600 mb-3">主題預覽</p>
        <div className="flex gap-4 items-center">
          <div
            className="px-6 py-2 rounded"
            style={{ backgroundColor: formData.primaryColor, color: getContrastColor(formData.primaryColor) }}
          >
            主要按鈕
          </div>
          <div
            className="px-6 py-2 rounded"
            style={{ backgroundColor: formData.secondaryColor, color: getContrastColor(formData.secondaryColor) }}
          >
            次要按鈕
          </div>
        </div>
      </div>
    </div>
  );

  // Step 3: Features
  const renderStep3 = () => (
    <div className="space-y-4">
      <p className="text-gray-600 mb-4">功能列表（目前全部啟用，尚未開放個別切換）：</p>
      {AVAILABLE_FEATURES.map((feature) => (
        <label
          key={feature.key}
          className="flex items-center p-4 bg-gray-100 rounded-lg cursor-not-allowed opacity-75"
        >
          <input
            type="checkbox"
            checked={true}
            disabled
            className="w-5 h-5 text-blue-600 rounded cursor-not-allowed"
          />
          <div className="ml-3">
            <p className="font-medium text-gray-500">{feature.label}</p>
            <p className="text-sm text-gray-400">{feature.description}</p>
          </div>
        </label>
      ))}
    </div>
  );

  // Step 4: Confirm
  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="font-bold text-lg mb-4">請確認以下設定</h3>

        <div className="space-y-4">
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">站台 ID</span>
            <span className="font-medium">{formData.tenantId}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">站台名稱</span>
            <span className="font-medium">{formData.name}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">站台管理員</span>
            <span className="font-medium">{formData.adminEmail}</span>
          </div>
          {!isEditMode && formData.createSubdomain && (
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">子網域</span>
              <span className="font-medium font-mono">{formData.tenantId}.sechome.cc</span>
            </div>
          )}
          <div className="flex justify-between py-2 border-b items-center">
            <span className="text-gray-600">主題色</span>
            <div className="flex gap-2 items-center">
              <div
                className="w-6 h-6 rounded"
                style={{ backgroundColor: formData.primaryColor }}
              />
              <span>{formData.primaryColor}</span>
            </div>
          </div>
          <div className="flex justify-between py-2 border-b items-center">
            <span className="text-gray-600">輔助色</span>
            <div className="flex gap-2 items-center">
              <div
                className="w-6 h-6 rounded"
                style={{ backgroundColor: formData.secondaryColor }}
              />
              <span>{formData.secondaryColor}</span>
            </div>
          </div>
          {formData.logoUrl && (
            <div className="flex justify-between py-2 border-b items-center">
              <span className="text-gray-600">Logo</span>
              <img
                src={formData.logoUrl}
                alt="Logo"
                className="h-10 max-w-32 object-contain"
              />
            </div>
          )}
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">啟用功能</span>
            <span className="font-medium">
              {Object.entries(formData.features)
                .filter(([_, v]) => v)
                .map(([k]) => AVAILABLE_FEATURES.find((f) => f.key === k)?.label)
                .join(", ") || "無"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">載入中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-8">
        {isEditMode ? `編輯站台: ${editTenantId}` : "建立新站台"}
      </h1>

      <StepIndicator />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => currentStep === 1 ? navigate(-1) : prevStep()}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          {currentStep === 1 ? "取消" : "上一步"}
        </button>

        {currentStep < 4 ? (
          <button
            onClick={nextStep}
            disabled={currentStep === 1 && !isEditMode && subdomainStatus !== "available"}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {currentStep === 1 && subdomainStatus === "checking" ? "驗證中..." : "下一步"}
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            {isSubmitting
              ? (isEditMode ? "更新中..." : "建立中...")
              : (isEditMode ? "確認更新" : "確認建立")}
          </button>
        )}
      </div>
    </div>
  );
};

export default SiteWizard;
