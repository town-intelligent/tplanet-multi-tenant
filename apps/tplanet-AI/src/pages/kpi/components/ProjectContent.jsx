import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import placeMarker from "../../../assets/place_marker.svg";
import PDF from "../../../assets/pdf_icon.svg";
import {
  plan_info,
  getProjectWeight,
  list_plan_tasks,
} from "../../../utils/Plan";
import { getTaskInfo, listChildrenTasks } from "../../../utils/Task";
import generateSdgsIcons from "../../../utils/sdgs/SdgsImg";
import SdgsWeight from "../../../utils/sdgs/SdgsWeight";
import SdgsChart from "../../../utils/sdgs/SdgsChart";
import SROI from "./SROI"; // 你現有的 SROI 組件
import { getSroiData, getSroiDataMeta } from "../../../utils/sroiUtils";
import { useTranslation } from "react-i18next";
import TrHtml from "../../../utils/TrHtml";
import { useScopeTr } from "../../../utils/TranslateScope";

const API_BASE = (import.meta.env.VITE_HOST_URL_TPLANET || "").replace(/\/+$/, "");
const resolveAssetUrl = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/static/")) {
    return API_BASE ? `${API_BASE}${path}` : `/api${path}`;
  }
  return API_BASE ? `${API_BASE}${path}` : path;
};

export default function ProjectContent() {
  const [project, setProject] = useState({});
  const [tasks, setTasks] = useState([]);
  const [taskWeights, setTaskWeights] = useState([]);
  const [totalWeight, setTotalWeight] = useState(0);
  const [attachmentExists, setAttachmentExists] = useState(false);
  const [attachmentName, setAttachmentName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false); // 新增：用於追蹤下載狀態
  const [error, setError] = useState(null);
  const { t } = useTranslation();
  const { tr, registerText } = useScopeTr();

  // 新增：分頁狀態（成果展現 / SROI）
  const [activeTab, setActiveTab] = useState("成果展現");

  // 新增：SROI 相關狀態
  const [sroiData, setSroiData] = useState(null);
  const [sroiLoading, setSroiLoading] = useState(false);
  const [sroiError, setSroiError] = useState(null);

  const { id } = useParams();

  useEffect(() => {
    const fetchProject = async () => {
      if (id) {
        const projectData = await plan_info(id);
        setProject(projectData);

        const weight = await relatePeople(id);
        setTotalWeight(weight);

        const parentTasks = await list_plan_tasks(id, 1);
        const taskUuids = parentTasks?.tasks || [];

        if (taskUuids.length > 0) {
          const list_task = await Promise.all(
            taskUuids.map((taskUuid) => getTaskInfo(taskUuid))
          );
          setTasks(list_task);

          const list_child_task = await Promise.all(
            list_task.map((task) => listChildrenTasks(task.uuid))
          );
          const flattened_child_tasks = list_child_task.flat();

          const list_weight = await Promise.all(
            flattened_child_tasks.map((taskUuid) => getTaskInfo(taskUuid))
          );
          setTaskWeights(generateContentValues(list_weight));
        } else {
          setTasks([]);
          setTaskWeights([]);
        }
        setAttachmentName(projectData.name + ".pdf");
      }
    };

    fetchProject();
  }, [id]);

  // 註冊 task 名稱以進行翻譯
  useEffect(() => {
    tasks.forEach((task) => {
      if (task.name) registerText(task.name);
    });
  }, [tasks, registerText]);

  // 檢查附件是否存在
  useEffect(() => {
    const checkAttachment = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${import.meta.env.VITE_HOST_URL_TPLANET}/api/projects/attachment_exist`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uuid: id }),
        });
        if (!response.ok) throw new Error(`HTTP 錯誤！ 狀態: ${response.status}`);
        const data = await response.json();
        setAttachmentExists(data.data?.exists ?? data.result ?? false);
      } catch (err) {
        console.error("API 呼叫失敗:", err);
        setError("無法檢查附件狀態，請稍後再試。");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      checkAttachment();
    }
  }, [id]);

  //處理檔案下載的函式
  const handleDownload = async () => {
    if (isDownloading) return; // 防止重複點擊
    setIsDownloading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_HOST_URL_TPLANET}/api/projects/download_attachment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uuid: id }),
      });

      if (!response.ok) {
        throw new Error(`檔案下載失敗，伺服器回應: ${response.status}`);
      }

      // 1. 從後端回應的 header 中嘗試取得檔案名稱
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = attachmentName;
      if (contentDisposition) {
        // 解析 "attachment; filename="your_filename.pdf"" 這種格式
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch && filenameMatch.length > 1) {
            // 使用 decodeURIComponent 來處理中文或特殊字元檔名
            filename = decodeURIComponent(filenameMatch[1]);
        }
      }

      // 2. 將回應轉換為 Blob (二進制大型物件)
      const blob = await response.blob();

      // 3. 建立一個暫存的 URL 指向這個 Blob 物件
      const url = window.URL.createObjectURL(blob);

      // 4. 建立一個隱形的 <a> 標籤來觸發下載
      const a = document.createElement('a');
      a.href = url;
      a.download = filename; // 設定下載的檔案名稱
      document.body.appendChild(a); // 將它加入到 DOM 中
      a.click(); // 模擬點擊

      // 5. 清理，移除 <a> 標籤並釋放暫存 URL
      a.remove();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error("下載過程出錯:", err);
      alert("檔案下載失敗，請稍後再試。");
    } finally {
      setIsDownloading(false);
    }
  };

  // 當附件不存在時的提示
  const showPendingMessage = () => {
    alert('待建立成果報告');
  };

  // 新增：獲取 SROI 數據的函數
  const fetchSroiData = async () => {
    if (!id) return;
    
    setSroiLoading(true);
    setSroiError(null);
    
    try {
      const data = await getSroiData(id);
      setSroiData(data);
    } catch (error) {
      console.error('Failed to fetch SROI data:', error);
      setSroiError('無法載入 SROI 數據');
      // 如果 API 失敗，使用預設數據
      /*
      setSroiData({
        sroi: 10.12,
        visible: true,
        computed: {
          total_benefit: 220044055.6,
          social_subtotal: 0,
          economy_subtotal: 2024000,
          environment_subtotal: 55006,
          total_cost: 200000,
        }  
      });
      */
    } finally {
      setSroiLoading(false);
    }
  };

  // 新增：當切換到 SROI 分頁時獲取數據
  useEffect(() => {
    if (activeTab === "SROI" && !sroiData && !sroiLoading) {
      fetchSroiData();
    }
  }, [activeTab, id]);

  // 新增：支援 #sroi 直接開 SROI 分頁
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.toLowerCase();
      if (hash === "#sroi") setActiveTab("SROI");
      if (hash === "#tasks" || hash === "#成果展現") setActiveTab("成果展現");
    }
  }, []);

  const generateContentValues = (taskWeights) => {
    return taskWeights.map((task) => {
      const content = JSON.parse(task.content);
      return Object.values(content).map((value) => parseInt(value));
    });
  };

  const renderLocation = (locationString) => {
    if (!locationString) return [];
    const list_location = locationString.split(",");
    const locations = ["台北", "竹山", "高雄", "花蓮", "馬祖"];
    return list_location
      .map((loc, index) =>
        parseInt(loc) === 1 ? (
          <span key={index} className="font-semibold">
            (行政區域) {locations[index]}
            <br />
          </span>
        ) : null
      )
      .filter(Boolean);
  };

  const relatePeople = async (projectUuid) => {
    const parentTasks = await list_plan_tasks(projectUuid, 1);
    const taskUuids = parentTasks?.tasks || [];

    if (taskUuids.length === 0) {
      return 0;
    }

    const list_weight = await getProjectWeight(taskUuids);

    let total_weight = 0;
    for (const key in list_weight) {
      total_weight += parseInt(list_weight[key]);
    }

    return total_weight;
  };

  if (!project || !project.uuid) {
    if (isLoading) {
      return <div className="container mx-auto py-8 text-center">載入中...</div>;
    }
    return <div className="container mx-auto py-8 text-center">找不到專案資料</div>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>{error}</p>;
  }

  return (
    <section className="flex-grow-1 py-4 bg-light">
      <div className="container mx-auto">
        <div className="row mt-3 mt-md-5">
          <div className="col-md-12"></div>
        </div>

        <div className="row justify-center mt-4 py-4 bg-white">
          <div className="col-10">
            {/* 封面與標題 */}
            <img
              id="project_cover"
              className="max-w-full h-auto mx-auto"
              src={resolveAssetUrl(project.img)}
              alt=""
            />
            <div className="row mt-4 pb-4 border-b border-[#D9D9D9]">
              <div className="col-md-6">
                <h4 className="!text-[var(--tenant-primary-dark,#1e3a5f)]" id="project_name">
                  {project.name}
                </h4>
              </div>
              <div className="col-md-6">
                <div
                  className="flex flex-wrap justify-center justify-md-end"
                  id="project_sdg_container"
                >
                  {/* {project.weight ? generateSdgsIcons(project.weight) : null} */}
                </div>
              </div>
            </div>

            {/* project description */}
            <div className="row mt-4 border-b border-[#D9D9D9]">
              <div className="col-md-6">
                <div className="d-flex flex-col h-full justify-center md:justify-start">
                  <p className="mb-3">
                    {t("project.projectPeriod_2")}:
                    <span className="pl-2" id="project_period">
                      {project.period}
                    </span>
                  </p>
                  <p className="mb-3" id="project_uuid">
                    {t("project.projectId")}:<span className="font-bold">{project.uuid}</span>
                  </p>
                  <p className="flex">
                    <img className="mr-2 w-5" src={placeMarker} alt="" />
                    <span id="location">{project.location}</span>
                  </p>
                  {attachmentExists ? (
                  <div
                    onClick={handleDownload}
                    className={`cursor-pointer ${isDownloading ? 'opacity-50' : ''}`}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => e.key === 'Enter' && handleDownload()}
                  >
                    <p className="flex">
                      <img className="mr-2 w-5" src={PDF} alt="" />
                      <span id="file" className="text-[var(--tenant-primary)] font-semibold">
                        {isDownloading ? t("project.downloading") : attachmentName}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div
                    onClick={showPendingMessage}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => e.key === 'Enter' && showPendingMessage()}
                  >
                    <p className="flex">
                      <img className="mr-2 w-5" src={PDF} alt="" />
                      <span id="file" className="text-[var(--tenant-primary)] font-semibold">
                        {isDownloading ? t("project.downloading") : attachmentName}
                      </span>
                    </p>
                  </div>
                )}
                </div>
              </div>
              <div className="col-md-6">
                <div className="d-flex flex-col">
                  <p className="mb-3">
                    {t("project.projectOrg")}:
                    <span className="pl-2" id="project_a">
                      Second Home
                      {project.project_a}
                    </span>
                  </p>
                  <p className="mb-3">
                    {t("project.projectTeam")}:
                    <span className="pl-2" id="hoster">
                      {project.project_b}
                    </span>
                  </p>
                  <p className="mb-3">
                    {t("project.projectContact")}:
                    <span className="pl-2" id="project_b">
                      {project.hoster}
                    </span>
                  </p>
                  {/* <p className="mb-3">
                    電子郵件:
                    <span className="pl-2" id="email">
                      {project.email}
                    </span>
                  </p> */}
                </div>
              </div>
            </div>

            {/* 計劃理念 */}
            <div className="row mt-4 pb-4 border-b border-[#D9D9D9]">
              <div className="col-md-12">
                <p className="text-2xl font-bold">{t("project.projectPhilosophy")}</p>
                {/* <p
                  className="mt-3 mb-2"
                  id="philosophy"
                  dangerouslySetInnerHTML={{ __html: project.philosophy }}
                ></p> */}
                <TrHtml
                  className="mt-3 mb-2"
                  id="philosophy"
                  html={project.philosophy}
                />
              </div>
            </div>

            {/* sdgs block */}
            <div className="row mt-5 pb-4 border-b border-[#D9D9D9]" id="project_weight_description">
              <SdgsWeight data={project.weight_description} />
            </div>

            {/* 計劃金額 */}
            <div className="row mt-4 pb-4 border-b border-[#D9D9D9]">
              <div className="flex items-center justify-between w-full">
                <div className="flex flex-col items-start w-full">
                  <p className=" text-black mb-2">
                    {t("project.projectBudget")}<span className="text-sm">{t("project.budgetUnit")}</span>
                  </p>
                  <div className="w-11/12 border-b border-[var(--tenant-primary)]"></div>
                </div>

                <p
                  className="flex items-end font-bold text-[var(--tenant-primary)] rozha-one-regular"
                  id="budget"
                >
                  <span className="text-2xl mr-1">NTD</span>
                  <span className="text-9xl">
                    {project.is_budget_revealed ? project.budget.toLocaleString() : "-"}
                  </span>
                </p>
              </div>
            </div>

            {/* ====== Tabs 導覽 ====== */}
            <div className="mt-6 border-b border-[#D9D9D9]">
              <div className="flex gap-6" role="tablist" aria-label="成果/SROI 分頁">
                <button
                  type="button"
                  className={`pb-3 text-lg font-semibold ${
                    activeTab === "成果展現"
                      ? "text-[var(--tenant-primary)] border-b-2 border-[var(--tenant-primary)]"
                      : "text-[#6B7280]"
                  }`}
                  onClick={() => setActiveTab("成果展現")}
                  aria-selected={activeTab === "成果展現"}
                  role="tab"
                >
                  {t("project.tabOutcome")}
                </button>
                <button
                  type="button"
                  className={`pb-3 text-lg font-semibold ${
                    activeTab === "SROI"
                      ? "text-[var(--tenant-primary)] border-b-2 border-[var(--tenant-primary)]"
                      : "text-[#6B7280]"
                  }`}
                  onClick={() => setActiveTab("SROI")}
                  aria-selected={activeTab === "SROI"}
                  role="tab"
                >
                  SROI
                </button>
              </div>
            </div>

            {/* ====== Tab 內容 ====== */}
            <div className="mt-4" role="tabpanel">
              {activeTab === "成果展現" && (
                <div className="border-b border-[#D9D9D9]">
                  <div className="col-md-12">
                    <p className="text-2xl font-bold">{t("project.tabOutcome")}</p>
                  </div>

                  <div id="tasks_container" className="tabs-section row">
                    {tasks.map((task, index) => (
                      <div key={index} className="row mt-4" id={`task_${index}`}>
                        <div className="col-md-6">
                          <img
                            src={resolveAssetUrl(task.thumbnail)}
                            alt=""
                          />
                        </div>

                        {/* 如果要開圖表，把這段解開 */}
                        {/* <div className="col-md-6 mt-4 mt-md-0">
                          <SdgsChart
                            projectUuid={project.uuid}
                            title="永續指標"
                            id="task"
                          />
                        </div> */}

                        <div className="col-12 mb-2">
                          <div className="row mt-3">
                            <div className="col-md-6">
                              <p className="text-[var(--tenant-primary-dark,#1e3a5f)] text-xl font-bold">
                                {t("project.taskName")}: {tr(task.name || "")}
                              </p>
                            </div>

                            {/* 若要顯示每個 task 的 SDGs 圖標，把這段解開 */}
                            {/* <div className="col-md-6 md:text-right">
                              <p className="flex flex-wrap justify-center justify-md-end">
                                {taskWeights[index] &&
                                  generateSdgsIcons(taskWeights[index].join(","))}
                              </p>
                            </div> */}
                          </div>

                          <p>{t("project.taskDate")}: {task.period}</p>
                          <TrHtml
                            className="mt-3 mb-2"
                            id="overview"
                            html={task.overview}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "SROI" && (
                <div>
                  <div className="col-md-12">
                    <p className="text-2xl font-bold">SROI</p>
                  </div>
                  <div id="SROI_block" className="tabs-section row">
                    {sroiLoading ? (
                      <div className="col-12 text-center py-4">
                        <h5 className="font-weight-bold">{t("common.loading")}</h5>
                      </div>
                    ) : sroiError ? (
                      <div className="col-12 text-center py-4">
                        <h5 className="font-weight-bold text-danger">{t("common.loadFailed")}</h5>
                        <button 
                          className="btn btn-primary mt-2"
                          onClick={fetchSroiData}
                        >
                          {t("common.reload")}
                        </button>
                      </div>
                    ) : sroiData ? (
                      <SROI
                        sroiValue={sroiData.sroi}
                        totalValue={sroiData.computed.total_benefit}
                        socialValue={sroiData.computed.social_subtotal}
                        economicValue={sroiData.computed.economy_subtotal}
                        environmentalValue={sroiData.computed.environment_subtotal}
                        totalInvestment={sroiData.computed.total_cost}
                        visible={sroiData.visible}
                      />
                    ) : null}
                  </div>
                </div>
              )}
            </div>
            {/* ====== /Tab 內容 ====== */}
          </div>
        </div>
      </div>
    </section>
  );
}
