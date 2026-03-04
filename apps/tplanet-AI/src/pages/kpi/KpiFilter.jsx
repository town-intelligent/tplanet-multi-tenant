// src/pages/frontend/components/KpiFilter.jsx
import { useState, useEffect, useRef, useMemo } from "react";
import { sdgData } from "../../utils/Config";
import { list_plans, plan_info } from "../../utils/Plan";
import { useHosters } from "../../utils/multi-tenant";
import { Row, Col, Card } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import SdgIconsGenerator from "../../utils/sdgs/SdgsImg";
import i18n from "../../utils/i18n";
import { useTranslation } from "react-i18next";

// 讀入 SDG 小圖示
const loadImages = async (names, setState) => {
  try {
    const imagePromises = names.map((name) =>
      import(`../../assets/sdgs/${name}.png`).then((module) => ({
        key: `sdg_${name}`,
        src: module.default,
      }))
    );
    const loadedImages = await Promise.all(imagePromises);
    const imagesObject = loadedImages.reduce((acc, image) => {
      acc[image.key] = image.src;
      return acc;
    }, {});
    setState(imagesObject);
  } catch (error) {
    console.error("載入SDG圖片時發生錯誤:", error);
  }
};

const useSdgImages = () => {
  const [images, setImages] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    const run = async () => {
      await loadImages(sdgData.map((i) => i.id), setImages);
      setIsLoaded(true);
    };
    run();
  }, []);
  return { images, isLoaded };
};

const API_BASE = (import.meta.env.VITE_HOST_URL_TPLANET || "").replace(/\/+$/, "");
const resolveAssetUrl = (path) => {
  if (!path) return "#";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/static/")) {
    return API_BASE ? `${API_BASE}${path}` : `/api${path}`;
  }
  return API_BASE ? `${API_BASE}${path}` : path;
};

// 期間字串美化：把 "YYYY/MM/DD - YYYY/MM/DD" 變成 "YYYY/MM/DD ~ YYYY/MM/DD"
const displayPeriod = (period) =>
  typeof period === "string" ? period.replace(/\s*-\s*/g, " ~ ") : "";

// 單卡片
const generateProjectBlock = (project) => {
  const imgUrl = resolveAssetUrl(project?.img);
  return (
    <Col md={4} key={project.uuid} className="mb-4">
      <Card className="kpi-card" style={{ borderRadius: "20px" }}>
        <Link to={`/content/${project.uuid}`} className="!no-underline text-black">
          <div
            className="img-fluid bg-cover shadow"
            style={{
              backgroundImage: `url(${imgUrl})`,
              height: "200px",
              borderRadius: "18px",
              backgroundSize: "cover",
              backgroundPosition: "center center",
            }}
          ></div>
        </Link>
        <Card.Body>
          <Link to={`/content/${project.uuid}`} className="!no-underline text-black">
            <p className="text-xl text-[var(--tenant-primary-dark,#1e3a5f)] font-bold">{project.name || ""}</p>
            <p>{i18n.t("project.projectOrg")}: {project.project_a || ""}</p>
            <p>{i18n.t("project.projectTeam")}: {project.project_b || "（未標示）"}</p>
            <p>
              {i18n.t("project.projectPeriod")}: <span className="font-bold">{displayPeriod(project.period)}</span>
            </p>
          </Link>
          <div className="flex flex-wrap gap-1">
            <SdgIconsGenerator weight={project.weight || ""} />
          </div>
        </Card.Body>
      </Card>
    </Col>
  );
};

// 依 SDG 篩選（weight 是逗號字串）
const filterProjectsBySdg = (allProjects, sdgId) => {
  if (!sdgId) return allProjects;
  const idx = parseInt(sdgId, 10) - 1;
  if (Number.isNaN(idx)) return allProjects;
  return allProjects.filter((p) => {
    if (!p?.weight || typeof p.weight !== "string") return false;
    const arr = p.weight.split(",");
    return idx >= 0 && idx < arr.length && arr[idx].trim() === "1";
  });
};

const KpiFilter = () => {
  const { id } = useParams();
  const [allProjects, setAllProjects] = useState([]);     // ← 真的專案（來自 API）
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [selectedSdg, setSelectedSdg] = useState(null);
  const { images } = useSdgImages();
  const { t } = useTranslation();
  const siteHosters = useHosters();

  // 追蹤已載入的 hosters key
  const loadedKeyRef = useRef('');
  const hostersKey = useMemo(() => JSON.stringify(siteHosters), [siteHosters]);

  // URL 參數 → 目前 SDG
  useEffect(() => {
    if (id) {
      const sdg = sdgData.find((item) => item.id === id);
      setSelectedSdg(sdg || null);
    } else {
      setSelectedSdg(null);
    }
  }, [id]);

  // 從 API 抓專案列表 + 詳情
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const currentEmail = (localStorage.getItem("email") || "").trim();
        let hosters = siteHosters.length > 1 ? siteHosters.slice(1) : siteHosters;
        if (currentEmail) hosters = [...hosters, currentEmail];
        hosters = [...new Set((hosters || []).map((h) => (h || "").trim()).filter(Boolean))];

        // 1) 收集所有 uuid
        const uuidSet = new Set();
        for (const email of hosters) {
          let listResp = null;
          try {
            listResp = await list_plans(email);
          } catch (err) {
            console.warn(`[KpiFilter] list_plans failed for ${email}:`, err);
            continue;
          }
          const projects = listResp?.projects || [];
          if (Array.isArray(projects)) {
            projects.forEach((u) => uuidSet.add(u));
          }
        }
        const uuids = Array.from(uuidSet);

        // 2) 取每個 uuid 的 plan_info（分批避免一次太多）
        const BATCH = 8;
        const aggregated = [];
        for (let i = 0; i < uuids.length; i += BATCH) {
          const slice = uuids.slice(i, i + BATCH);
          const infos = await Promise.all(
            slice.map(async (uuid) => {
              try {
                const info = await plan_info(uuid);
                return { uuid, ...info };
              } catch (e) {
                console.warn("plan_info 失敗:", uuid, e);
                return null;
              }
            })
          );
          aggregated.push(...infos.filter(Boolean));
        }

        setAllProjects(aggregated);
        setFilteredProjects(filterProjectsBySdg(aggregated, id));
      } catch (error) {
        console.error("Error fetching data:", error);
        setAllProjects([]);
        setFilteredProjects([]);
      }
    };

    if (siteHosters.length > 0 && loadedKeyRef.current !== hostersKey) {
      loadedKeyRef.current = hostersKey;
      fetchProjects();
    }
  }, [hostersKey, siteHosters]); // 當 hosters 載入後抓專案



  // 當 SDG 改變時重新篩選
  useEffect(() => {
    setFilteredProjects(filterProjectsBySdg(allProjects, id));
  }, [allProjects, id]);

  return (
    <div className="flex flex-col justify-center w-5/6 mx-auto">
      <div className="py-4">
        {selectedSdg && (
          <div className="bg-white p-4 rounded-lg">
            <div className="flex items-center gap-8 mb-2">
              {images[`sdg_${selectedSdg.id}`] && (
                <img
                  src={images[`sdg_${selectedSdg.id}`]}
                  alt={`SDG ${selectedSdg.id}`}
                  className="w-20 h-20 object-contain"
                />
              )}
              <span className="text-2xl font-bold">{t(`sdgData.${selectedSdg.id}.text`)}</span>
            </div>
            <p className="text-lg font-bold ml-3">{t(`sdgData.${selectedSdg.id}.content`)}</p>
          </div>
        )}
      </div>

      <Row id="project_container">
        {filteredProjects.map((project) => generateProjectBlock(project))}
      </Row>
    </div>
  );
};

export default KpiFilter;
