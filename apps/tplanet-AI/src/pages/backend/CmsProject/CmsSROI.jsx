import React, { useEffect, useState } from "react";
import {
  getSroiData,
  getSroiDataMeta,
  setSroiData,
  getSroiTableData,
} from "../../../utils/SROI.jsx";
//import { draw_doughnut_chart, isValidDoughnutChartData } from "./chart/bar.js";
import { plan_info } from "../../../utils/Plan";
import { useParams } from "react-router-dom";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const CmsSroi = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [visible, setVisible] = useState("YES");
  const [activeTab, setActiveTab] = useState("SOCIAL");
  const [tableData, setTableData] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState();
  const [isloading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [showCalculation, setShowCalculation] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

// 載入專案 & meta 資料
const [retryCount, setRetryCount] = useState(0);
const [isAutoRetrying, setIsAutoRetrying] = useState(false);

const fetchData = async () => {
  try {
    setLoading(true);
    setErrorMessage(null);
    
    console.log("Loading project info...");
    const objProject = await plan_info(id);
    
    console.log("Loading SROI meta...");
    
    const metaPromise = getSroiDataMeta(id);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('SROI_TIMEOUT')), 25000)
    );
    
    const meta = await Promise.race([metaPromise, timeoutPromise]);
    
    setProject({ ...objProject, fileId: meta.data.file_id });
    setVisible(meta.data.visible);
    setRetryCount(0); // 重置重試計數
    console.log("Loading completed successfully");
  } catch (err) {
    console.error("Error loading SROI meta:", err);
    
    if (err.message === 'SROI_TIMEOUT' && retryCount < 2) {
      // 自動重試
      setIsAutoRetrying(true);
      const waitTime = retryCount === 0 ? 20000 : 30000; // 15秒, 30秒
      setErrorMessage(`首次 SROI 資料建置中，${waitTime/1000}秒後自動重試 (${retryCount + 1}/2)`);
      
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setIsAutoRetrying(false);
        fetchData();
      }, waitTime);
      return;
    }
    
    // 超過重試或其他錯誤
    setErrorMessage(
      err.message === 'SROI_TIMEOUT' 
        ? 'SROI 準備時間較長，請點擊重試' 
        : (err.message || "載入失敗，請重新整理頁面")
    );
  } finally {
    if (!isAutoRetrying) {
      setLoading(false);
    }
  }
};

useEffect(() => {
  if (!id) return;
  fetchData();
}, [id]);

  // 載入表格資料
  useEffect(() => {
    if (!project) return;
    const loadTable = async (sroiType) => {
      try {
        const json = await getSroiTableData(project.uuid, sroiType);
        setTableData(json.values || []);
      } catch (err) {
        console.error(err);
      }
    };
    loadTable(activeTab);
  }, [activeTab, project]);

  // 準備圖表數據
  const getChartData = () => {
    if (!data?.sroiData) return null;

    const { social_subtotal, economy_subtotal, environment_subtotal } =
      data.sroiData;

    // 過濾掉 value 為 0 的
    const raw = [
      { label: "社會價值", value: social_subtotal, color: "#36A2EB" },
      { label: "經濟價值", value: economy_subtotal, color: "#4ECDC4" },
      { label: "環境價值", value: environment_subtotal, color: "#45B7D1" },
    ];
    const filtered = raw.filter((item) => item.value > 0);

    if (filtered.length === 0) return null;

    return {
      labels: filtered.map((item) => item.label),
      datasets: [
        {
          data: filtered.map((item) => item.value),
          backgroundColor: filtered.map((item) => item.color),
          borderColor: filtered.map((item) => item.color),
          borderWidth: 1,
          cutout: "50%",
        },
      ],
    };
  };

  const options = {
    plugins: {
      legend: { display: false },
      datalabels: {
        display: true,
        color: "white",
        font: {
          size: 12,
        },
        formatter: (value, context) => {
          const label = context.chart.data.labels[context.dataIndex];
          return `${label}`;
        },
      },
    },
  };

  // 計算 SROI
  const calculateSroi = () => {
    if (!data?.sroiData) return "0.00";
    const { total_benefit, total_cost } = data.sroiData;
    if (total_cost === 0) return "0.00";
    return (total_benefit / total_cost).toFixed(2);
  };

  // 刷新數據
  const handleRefresh = async () => {
    setIsLoading(true);
    setError(false);
    setShowCalculation(true); // 點擊更新後顯示計算區域

    try {
      const sroiData = await getSroiData(id);
      const { social_subtotal, economy_subtotal, environment_subtotal } =
        sroiData;

      setData({
        ...data,
        sroiData,
        visible: sroiData.visible,
      });
      setIsLoading(false);
    } catch (err) {
      setError(true);
      console.error("Failed to fetch SROI data:", err);
    } finally {
      setLoading(false);
    }
  };

  const sroi = calculateSroi();
  const chartData = getChartData();
  const hasValidData = chartData;

if (loading) return <div id="loading-container">首次載入可能需要較長時間，請耐心等待</div>;
if (errorMessage) return (
  <div>
    注意：{errorMessage} 
    <button 
      onClick={() => fetchData()}
      className="ml-2 px-3 py-1 bg-blue-500 text-white rounded"
    >
      重試
    </button>
  </div>
);
if (!project) return <div>No project found</div>;

  return (
    <div id="cms-sroi" className="container pt-4">
      {/* 計畫基本資料 */}
      <div className="mt-4">
        <p className="bg-[#317EE0] py-2 text-white pl-6">計畫基本資料</p>
        <div className="row px-4">
          <div className="col-md-6">
            <p>永續專案: {project.name}</p>
            <p>專案金額 (NTD): {project.budget}</p>
          </div>

          <div className="col-md-6">
            <p>期間: {project.period}</p>
          </div>
        </div>
      </div>

      {/* 永續指標數據量化方法學 */}
      <div className="mt-4">
        <p className="bg-[#317EE0] py-2 text-white pl-6">
          永續指標數據量化方法學
        </p>

        <div className="relative bg-gray-100">
          <div
            className={`content px-2 overflow-hidden transition-all duration-300 ease-in-out ${
              expanded ? "max-h-[1000px]" : "max-h-[200px]"
            }`}
          >
            <h6>導入 SROI 方法學的宗旨</h6>
            <p>
              SROI（Social Return on Investment,
              社會投資回報率）是由英國政府第三部門所擬定用來評估組織在社會、環境、經濟等面向中所產生的改變，並將其賦與統一貨幣價值，以利於更公正客觀地判斷資源投入與最終成果所鏈接的因果關係。其六大步驟如下:
            </p>
            <ol>
              <li>1. 定義範圍及利害關係人</li>
              <li>2. 影響力地圖描繪專案成果</li>
              <li>3. 盤點成果並賦予定價</li>
              <li>4. 成果轉換為具體的影響力</li>
              <li>5. 計算資源投入前後之價值</li>
              <li>6. 社會影響力揭露及追蹤</li>
            </ol>
            <p>
              透過直接與利害關係人密切地訪談與互動，蒐集資料，建立永續專案的掌握度，此由下而上
              (Bottom up)
              的資料蒐集及側錄過程，與社會影響力決策系統的核心目標不謀而合。因此，導入SROI
              方法學的概念是「小鎮智能」與合作夥伴 -
              「小鎮文創」、「小鎮賦能」及「小鎮風土」今年重要的里程碑。
            </p>
            <p>
              未來，組織能清晰地了解自身的社會影響力，有了數據的支持，在ESG(Environmental、Social、Governance)
              由上而下 (Top down)
              的政策及數位化轉型的浪潮下，能快速且有效率地因應，確保企業與組織間的資源投入與運用富含可持續性。
            </p>

            <h6>如何使用本試算表</h6>
            <ol>
              <li>
                SROI
                方法學將評估「社會、經濟、環境」三面向，請依序在各面向分頁中【反灰處】填入數值，價值計算將自動產出。
              </li>
              <li>
                總價值計算分頁將依據「社會、經濟、環境」三面向分頁所產出之小計數值計算出
                SROI，其公式為： <br />
                <code>SROI = 總社會現值 / 總投入價值</code>
              </li>
            </ol>
          </div>

          {/* 漸層遮罩 - 放在 content 的同級 */}
          <div
            className={`absolute bottom-0 left-0 right-0 h-20 pointer-events-none transition-opacity duration-300 ${
              expanded ? "opacity-0" : "opacity-100"
            }`}
            style={{
              background:
                "linear-gradient(to bottom, transparent 0%, rgba(243, 244, 246, 0.8) 50%, rgb(243, 244, 246) 100%)",
            }}
          />
        </div>

        <div className="text-center">
          <button
            className="bg-[#317EE0] p-2 text-white rounded"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "隱藏" : "顯示更多"}
          </button>
        </div>

        {/* SROI 方法學 iframe */}
        <div className="mt-4">
          <p className="bg-[#317EE0] py-2 text-white pl-6">
            社會投資報酬率 (SROI) 方法學
          </p>
          <div className="px-4">
            <div className="d-flex">
              <iframe
                id="iframe_sroi"
                width="100%"
                style={{ height: "50vh" }}
                src={`https://docs.google.com/spreadsheets/d/${project.fileId}?headers=false&chrome=false&single=true&widget=false&rm=minimal`}
                title="SROI Sheet"
              />
            </div>
            <br />
            <div>
              {/* 更新按鈕 */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded transition-colors"
                >
                  更新
                </button>
              </div>
              {showCalculation && (
                <div className="mt-4">
                  <p className="bg-[#317EE0] py-2 text-white pl-6">價值計算</p>

                  <div className="p-6">
                    {isloading && (
                      <div className="text-center py-8">
                        <p className="text-lg font-semibold">載入中...</p>
                      </div>
                    )}

                    {error && !isloading && (
                      <div className="text-center py-8">
                        <p className="text-lg font-semibold">載入失敗</p>
                      </div>
                    )}

                    {!isloading && !error && !hasValidData && (
                      <div className="text-center py-8">
                        <p className="text-lg font-semibold">尚無 SROI 資料</p>
                      </div>
                    )}

                    {!isloading && !error && hasValidData && (
                      <div>
                        <div className="mt-4">
                          <div className="">
                            <div className="row">
                              <div className="col-md-8">
                                <p>
                                  總社會現值 :
                                  {data?.sroiData?.computed?.total_benefit ||
                                    "0"}
                                </p>
                                <p>
                                  總投入價值 :
                                  {data?.sroiData?.computed?.total_cost || "0"}
                                </p>
                                <p>SROI : {sroi}</p>
                                <ul className="list-unstyled">
                                  <li>
                                    1. 免責聲明：以上提供的 SROI
                                    計算公式僅供參考，使用者應理解其限制性質並自行承擔風險。
                                  </li>
                                  <li>
                                    2. SROI
                                    計算為評估社會影響的方法之一，並不代表對所有決策的唯一評估標準。
                                  </li>
                                </ul>
                              </div>
                              <div className="col-md-4">
                                <div className="relative w-64 h-64">
                                  {hasValidData ? (
                                    <div className="w-full h-full">
                                      <Doughnut
                                        width={200}
                                        height={200}
                                        data={chartData}
                                        dataKey="value"
                                        nameKey="name"
                                        options={options}
                                      />

                                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <h5 className="text-lg font-semibold text-gray-800">
                                          SROI
                                        </h5>
                                        <h6 className="text-xl font-bold text-purple-600">
                                          {sroi}
                                        </h6>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center border-2 border-gray-300 border-dashed rounded-full">
                                      <p className="text-lg font-semibold text-gray-800">
                                        SROI
                                      </p>
                                      <p className="text-xl font-bold text-purple-600">
                                        {sroi}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        <div className="mb-6">
          {/* 導航標籤 */}
          <div className="flex overflow-hidden">
            <button
              onClick={() => setActiveTab("SOCIAL")}
              className={`flex-1 py-2 px-3 text-center font-medium transition-colors duration-200 ${
                activeTab === "SOCIAL" ? "bg-[#D39E00]" : "bg-[#FFC007]"
              }`}
            >
              社會面向
            </button>
            <button
              onClick={() => setActiveTab("ECONOMY")}
              className={`flex-1 py-2 px-3 text-center font-medium transition-colors duration-200 ${
                activeTab === "ECONOMY" ? "bg-[#D39E00]" : "bg-[#FFC007]"
              }`}
            >
              經濟面向
            </button>
            <button
              onClick={() => setActiveTab("ENVIRONMENT")}
              className={`flex-1 py-2 px-3 text-center font-medium transition-colors duration-200 ${
                activeTab === "ENVIRONMENT" ? "bg-[#D39E00]" : "bg-[#FFC007]"
              }`}
            >
              環境面向
            </button>
            <a
              href={`/backend/cms_sroi_evidence/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="!no-underline flex-1 py-2 px-3 text-center font-medium bg-green-600 text-white hover:bg-green-700 transition-colors duration-200"
            >
              佐證資料
            </a>
          </div>
        </div>

        {/* 表格內容 */}
        <div className="overflow-hidden">
          <table className="table-auto border-collapse w-full text-sm">
            <tbody>
              {tableData.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, colIndex) => (
                    <td
                      key={colIndex}
                      className="border border-gray-300 px-2 py-1"
                      style={{
                        backgroundColor: cell.background_color || "transparent",
                      }}
                    >
                      {cell.value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CmsSroi;
