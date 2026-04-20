import CsrProject from "../../assets/csr-project.png";
import ProjectList from "./components/ProjectList";
import KpiList from "./components/KpiList";
import Chart from "./components/Chart";
import BubbleMap from "./components/BubbleMap";
import KpiChart from "./components/KpiChart";
import KpiHeatMap from "./components/KpiHeatMap";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { list_plans, plan_info } from "../../utils/Plan";
import { useHosters, useKpiBannerUrl } from "../../utils/multi-tenant";
import { AnimatedSection } from "../../utils/useScrollAnimation";

const KPI = () => {
  const [searchParams] = useSearchParams();
  const [objListProjects, setObjListProjects] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedDep, setSelectedDep] = useState("all");
  const [selectedSdg, setSelectedSdg] = useState("all");
  const SITE_HOSTERS = useHosters();
  const kpiBannerUrl = useKpiBannerUrl();
  const bannerSrc = kpiBannerUrl
    ? `${import.meta.env.VITE_HOST_URL_TPLANET}${kpiBannerUrl}`
    : CsrProject;

  // Loading 狀態
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState({ current: 0, total: 0 });

  // 分頁狀態
  const [currentPage, setCurrentPage] = useState(1);

  // 初始化載入權重及專案 - 簡化版，類似生產環境
  const fetchProjects = async () => {
    setLoading(true);
    try {
      // 判斷是否為「公司個體」模式
      const jwt = localStorage.getItem("jwt");
      const email = localStorage.getItem("email");
      const isLoggedIn = jwt && jwt !== "" && email && email !== "";
      const isPersonalMode = searchParams.get("status") === "loggedin";

      let hosters;
      if (isLoggedIn && isPersonalMode) {
        // 公司個體：只顯示自己的專案
        hosters = [email];
      } else {
        // 跨區跨域：顯示所有人的專案
        hosters = SITE_HOSTERS.length > 1 ? SITE_HOSTERS.slice(1) : SITE_HOSTERS;
        // 非 personal mode 仍保留目前登入者，避免 hosters 設定失準時整頁無資料
        if (email) hosters = [...hosters, email];
      }
      hosters = [...new Set((hosters || []).map((h) => (h || "").trim()).filter(Boolean))];
      const allProjects = [];
      const projectYears = new Set();
      let mergedProjectList = [];

      for (const hoster of hosters) {
        let objListProjects2 = null;
        try {
          objListProjects2 = await list_plans(hoster);
        } catch (err) {
          console.warn(`[KPI] list_plans failed for ${hoster}:`, err);
          continue;
        }

        const projectUuids = objListProjects2?.projects || [];
        if (Array.isArray(projectUuids)) {
          mergedProjectList = Array.from(new Set([...mergedProjectList, ...projectUuids]));
          setObjListProjects({ result: "true", projects: mergedProjectList });
        }
        setLoadProgress(prev => ({ ...prev, total: prev.total + projectUuids.length }));
        for (const uuid of projectUuids) {
          const projectInfo = await plan_info(uuid);
          allProjects.push({ uuid, ...projectInfo });
          setLoadProgress(prev => ({ ...prev, current: prev.current + 1 }));

          if (projectInfo.period) {
            const startYear = new Date(
              projectInfo.period.split("-")[0]
            ).getFullYear();
            if (!isNaN(startYear)) {
              projectYears.add(startYear);
            }
          }
        }
      }

      setProjects(allProjects);
      setFilteredProjects(allProjects);
      setYears(Array.from(projectYears).sort());
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 等待 hosters 載入完成才抓專案
    if (SITE_HOSTERS.length > 0) {
      fetchProjects();
    }
  }, [searchParams, SITE_HOSTERS]);

  // 當篩選條件改變時，重置到第一頁
  const resetToFirstPage = () => {
    setCurrentPage(1);
  };

  return (
    <section className="overflow-hidden">
      {/* 只在第一頁顯示完整內容 */}
      {currentPage === 1 && (
        <>
          {/* Banner - 淡入放大效果 */}
          <AnimatedSection animation="zoom-in">
            <div
              className="bg-cover mb-0 block bg-center h-48 md:h-80"
              style={{
                backgroundImage: `url(${bannerSrc})`,
              }}
            ></div>
          </AnimatedSection>

          {/* SDG 17 項主題格狀展示區 - 從下方滑入 */}
          <AnimatedSection animation="fade-up">
            <KpiList projects={objListProjects} />
          </AnimatedSection>

          {/* 條狀圖 - 從左滑入 */}
          <AnimatedSection animation="fade-left">
            <Chart />
          </AnimatedSection>

          {/* 互動式地圖 - 從下方滑入 */}
          <AnimatedSection animation="fade-up">
            <BubbleMap />
          </AnimatedSection>

          {/* 折線圖 & 圓餅圖 - 從右滑入 */}
          <AnimatedSection animation="fade-right">
            <KpiChart />
          </AnimatedSection>

          {/* 熱度圖 - 從下方滑入 */}
          <AnimatedSection animation="fade-up">
            <KpiHeatMap />
          </AnimatedSection>
        </>
      )}

      {/* 計畫卡片預覽（最多 3 張，其他續下頁，每頁至多 9 張)*/}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--tenant-primary)] border-t-transparent mb-4"></div>
          <p className="text-gray-600">載入專案中...</p>
          {loadProgress.total > 0 && (
            <p className="text-gray-400 text-sm">{loadProgress.current} / {loadProgress.total} 筆</p>
          )}
        </div>
      ) : (
        <AnimatedSection animation="fade-up">
          <ProjectList
            projects={projects}
            filteredProjects={filteredProjects}
            setFilteredProjects={setFilteredProjects}
            years={years}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            selectedDep={selectedDep}
            setSelectedDep={setSelectedDep}
            selectedSdg={selectedSdg}
            setSelectedSdg={setSelectedSdg}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            resetToFirstPage={resetToFirstPage}
          />
        </AnimatedSection>
      )}
    </section>
  );
};

export default KPI;
