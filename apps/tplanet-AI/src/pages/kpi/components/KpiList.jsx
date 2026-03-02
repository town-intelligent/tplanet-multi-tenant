// src/pages/frontend/components/KPIList.jsx
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Container, Row, Col, Card, Form, Badge } from "react-bootstrap";
import SDGsCircle from "../../../assets/SDGs-circle.png";
import { sdgData } from "../../../utils/Config.jsx";
import { useHosters, useDepartments } from "../../../utils/multi-tenant";
import { useTranslation } from "react-i18next";

const API_BASE = import.meta.env.VITE_HOST_URL_TPLANET;

const formatCurrency = (n) =>
  new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 }).format(
    Number(n || 0)
  );

const KPIList = () => {
  const [images, setImages] = useState({});
  const [sdgCounts, setSdgCounts] = useState({});        // {1..17: num}
  const [totalProjects, setTotalProjects] = useState(0);  // 後端回傳的總專案數

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();
  const allHosters = useHosters();
  const STATIC_DEPARTMENTS = useDepartments();
  // ✅ 多帳號處理（穩定引用）
  const hosters = useMemo(() => {
    return allHosters.length > 1 ? allHosters.slice(1) : allHosters;
  }, [allHosters]);

  // 预算（總投入經費：元）
  const [totalBudget, setTotalBudget] = useState(0);      // 元
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetError, setBudgetError] = useState("");

  // 各處室彙總：{ [hoster]: { budget, projects } }
  const [budgetByDept, setBudgetByDept] = useState({});
  // 下拉清單項目（用後端回來的 + 靜態清單做聯集）
  const [deptOptions, setDeptOptions] = useState([]);
  const [selectedDep, setSelectedDep] = useState("");

  // 計算案件數最高的 SDG
  const topSDG = useMemo(() => {
    let maxCount = 0;
    let topId = null;
    
    Object.entries(sdgCounts).forEach(([id, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topId = parseInt(id);
      }
    });
    
    return { id: topId, count: maxCount };
  }, [sdgCounts]);

  // ✅ 多帳號並行請求：SDGs 件數 & 總專案數
  const fetchMultipleSdgData = async (emails) => {
    setLoading(true);
    setError("");

    try {
      // 建立多個 POST 請求
      const requests = emails.map((email) =>
        fetch(`${API_BASE}/api/dashboard/sdgs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
          .then((resp) => {
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return resp.json();
          })
          .catch((err) => {
            console.error(`[SDGs] ${email} 請求失敗：`, err);
            return null; // 某些請求失敗也不會中斷整體
          })
      );

      const results = await Promise.all(requests);

      // 彙總結果
      const sdgSum = Array(18).fill(0);
      let totalProjectsSum = 0;

      results.forEach((data) => {
        if (!data) return;
        const sdgsProjects = data?.content?.sdgs_projects ?? {};
        const total = Number(data?.content?.total_projects ?? 0);
        totalProjectsSum += total;

        for (let i = 1; i <= 17; i++) {
          sdgSum[i] += Number(sdgsProjects[`SDG-${i}`] ?? 0);
        }
      });

      const normalized = {};
      for (let i = 1; i <= 17; i++) normalized[i] = sdgSum[i];
      setSdgCounts(normalized);
      setTotalProjects(totalProjectsSum);
    } catch (e) {
      console.error(e);
      setError("無法載入 SDGs 件數");
    } finally {
      setLoading(false);
    }
  };

  // ✅ 多帳號並行請求：預算總額與各處室分布
  const fetchMultipleBudgetSummary = async (emails) => {
    setBudgetLoading(true);
    setBudgetError("");

    try {
      const requests = emails.map((email) =>
        fetch(`${API_BASE}/api/dashboard/budget`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
          .then((resp) => {
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return resp.json();
          })
          .catch((err) => {
            console.error(`[Budget] ${email} 請求失敗：`, err);
            return null;
          })
      );

      const results = await Promise.all(requests);

      // 初始化彙總表
      const baseMap = {};
      STATIC_DEPARTMENTS.forEach((dept) => {
        const name = dept.name || dept;
        baseMap[name] = { budget: 0, projects: 0 };
      });
      let totalBudgetSum = 0;

      // 合併所有回傳資料
      results.forEach((data) => {
        if (!data) return;

        totalBudgetSum += Number(
          data?.total ?? data?.["total:"] ?? data?.content?.total ?? 0
        );

        const apiList = Array.isArray(data?.departments)
          ? data.departments
          : [];
        apiList.forEach((d) => {
          let name = d?.project_b;
          if (
            !name ||
            name === "null" ||
            name === "未標示" ||
            (typeof name === "string" && !name.trim())
          )
            return;

          name = name.toString();
          // 只統計 tenant config 中設定的 departments
          if (baseMap[name]) {
            baseMap[name].budget += Number(d?.budget ?? 0);
            baseMap[name].projects += Number(d?.projects ?? 0);
          }
        });
      });

      // 生成下拉清單 - 只顯示 tenant config 設定的 departments
      const staticNames = STATIC_DEPARTMENTS.map((d) => d.name || d);

      setTotalBudget(totalBudgetSum);
      setBudgetByDept(baseMap);
      setDeptOptions(staticNames);
    } catch (e) {
      console.error(e);
      setBudgetError("無法載入總投入經費/各處室分布");
    } finally {
      setBudgetLoading(false);
    }
  };

  // 載 SDG icon
  useEffect(() => {
    const loadImages = async (names, setState) => {
      try {
        const imagePromises = names.map((name) =>
          import(`../../../assets/sdgs/${name}.png`).then((module) => ({
            key: `weight_${name}`,
            src: module.default,
          }))
        );
        const loaded = await Promise.all(imagePromises);
        const obj = loaded.reduce((acc, img) => {
          acc[img.key] = img.src;
          return acc;
        }, {});
        setState(obj);
      } catch (e) {
        console.error("載入 SDG 圖片失敗：", e);
      }
    };
    loadImages(sdgData.map((item) => item.id), setImages);
  }, []);

  // 追蹤已載入的 hosters key
  const loadedSdgKeyRef = useRef('');
  const loadedBudgetKeyRef = useRef('');
  const hostersKey = useMemo(() => JSON.stringify(hosters), [hosters]);
  const depsKey = useMemo(() => JSON.stringify(STATIC_DEPARTMENTS), [STATIC_DEPARTMENTS]);

  // SDGs 資料載入（只需 hosters）
  useEffect(() => {
    if (!hosters.length || loadedSdgKeyRef.current === hostersKey) return;
    loadedSdgKeyRef.current = hostersKey;
    fetchMultipleSdgData(hosters);
  }, [hostersKey, hosters]);

  // Budget 資料載入（需要 hosters + STATIC_DEPARTMENTS 都載入完成）
  useEffect(() => {
    const key = `${hostersKey}:${depsKey}`;
    if (!hosters.length || !STATIC_DEPARTMENTS.length || loadedBudgetKeyRef.current === key) return;
    loadedBudgetKeyRef.current = key;
    fetchMultipleBudgetSummary(hosters);
  }, [hostersKey, depsKey, hosters, STATIC_DEPARTMENTS]);

  // 目前選定局處的金額
  const selectedDepBudget = useMemo(() => {
    if (!selectedDep) return 0;
    return budgetByDept[selectedDep]?.budget ?? 0;
  }, [selectedDep, budgetByDept]);

  return (
    <div className="bg-light py-4">
      <Container>
        {/* KPI */}
        <Row className="justify-content-center mt-4">
          <Col xs={10}>
            <h3 className="text-center fw-bold">{t("kpi.title")}</h3>
          </Col>
        </Row>

        {(error || budgetError) && (
          <Row className="justify-content-center">
            <Col xs={10}>
              {error && <div className="text-danger text-center">{error}</div>}
              {budgetError && (
                <div className="text-danger text-center">{budgetError}</div>
              )}
            </Col>
          </Row>
        )}

        {(loading || budgetLoading) && (
          <Row className="justify-content-center">
            <Col xs={10}>
              <div className="text-center">{t("common.loading")}</div>
            </Col>
          </Row>
        )}

        <Row className="justify-content-center">
          {sdgData.map((item) => {
            const isTopSDG = topSDG.id === item.id && topSDG.count > 0;
            return (
              <Col key={item.id} xs={6} md={2} className="mt-4 md:mt-0">
                <a
                  href={`kpi_filter/${item.id}`}
                  className="block w-full h-full !no-underline"
                >
                  <Card 
                    className={`
                      rounded-3 
                      flex flex-col h-80 
                      border-0
                      transition-all duration-300 ease-in-out
                      ${isTopSDG 
                        ? 'shadow-lg transform scale-105 bg-gradient-to-br from-amber-50 to-yellow-100' 
                        : 'shadow-md hover:shadow-lg hover:transform hover:scale-102'
                      }
                    `}
                    style={{
                      boxShadow: isTopSDG 
                        ? '0 20px 40px rgba(251, 191, 36, 0.3), 0 0 0 3px rgba(251, 191, 36, 0.2)' 
                        : '0 8px 25px rgba(0, 0, 0, 0.15)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {/* 頂部徽章 */}
                    {isTopSDG && (
                      <div className="position-absolute" style={{ top: '-5px', right: '10px', zIndex: 10 }}>
                        <Badge 
                          bg="warning" 
                          className="px-3 py-2 rounded-bottom-3"
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
                          }}
                        >
                          {t("kpi.topBadge")}
                        </Badge>
                      </div>
                    )}

                    {/* 閃爍動畫效果 */}
                    {isTopSDG && (
                      <div 
                        className="position-absolute w-100 h-100"
                        style={{
                          background: 'linear-gradient(45deg, transparent 30%, rgba(251, 191, 36, 0.1) 50%, transparent 70%)',
                          pointerEvents: 'none',
                          zIndex: 1
                        }}
                      ></div>
                    )}

                    <Card.Img
                      variant="top"
                      src={images[`weight_${item.id}`]}
                      className="rounded-top-3 h-40 object-contain p-2"
                      style={{
                        filter: isTopSDG ? 'brightness(1.1) saturate(1.2)' : 'none',
                        zIndex: 2,
                        position: 'relative'
                      }}
                    />
                    
                    <Card.Body className="flex-1 flex flex-col justify-between p-3" style={{ zIndex: 2, position: 'relative' }}>
                      <Card.Text className="min-h-[3em] flex items-center justify-center text-center font-bold text-sm">
                        {item.text}
                      </Card.Text>
                      <div className="text-center mb-0">
                        <div className="d-flex align-items-center justify-content-center">
                          <span className="me-1">{t("kpi.projectCount")}:</span>
                          <span 
                            id={`pc_${item.id}`}
                            className={`fw-bold ${isTopSDG ? 'text-warning fs-5' : ''}`}
                            style={{
                              textShadow: isTopSDG ? '1px 1px 2px rgba(0,0,0,0.1)' : 'none'
                            }}
                          >
                            {sdgCounts[item.id] ?? 0}
                          </span>
                          <span className="ms-1">{t("kpi.item")}</span>
                          {isTopSDG && (
                            <span className="ms-2">
                              ✨
                            </span>
                          )}
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                </a>
              </Col>
            );
          })}

          {/* 總專案件數：使用後端 total_projects */}
          <Col xs={6} md={2} className="mt-4 md:mt-0">
            <Card 
              className="rounded-3 border-0 shadow-md hover:shadow-lg transition-all duration-300"
              style={{
                boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white'
              }}
            >
              <Card.Img 
                variant="top" 
                src={SDGsCircle} 
                className="rounded-top-3 p-2"
                style={{ filter: 'brightness(1.1)' }}
              />
              <Card.Body className="text-center">
                <Card.Text className="mb-2"></Card.Text>
                <div className="mb-0 fw-bold">
                  {t("kpi.totalProjects")}:
                  <div className="fs-4 mt-1">
                    <span id="pc_total_sdgs">{totalProjects}</span>{t("kpi.item")}
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* 總投入經費（左）＋ 局處選擇（右） */}
      <div className="flex justify-around items-center mt-20">
        {/* 左：總投入經費（新台幣：元） */}
        <div className="flex flex-col items-center mt-10">
          <p className="text-9xl text-[var(--tenant-primary-dark)] rozha-one-regular">
            {formatCurrency(totalBudget)}
            <span className="text-5xl">{t("kpi.currency")}</span>
          </p>
          <p className="text-xl font-bold">
            {t("kpi.totalBudget")}<span className="text-lg">{t("kpi.budgetUnit")}</span>
          </p>
        </div>

        {/* 右：局處下拉 + 動態金額 */}
        <div className="flex flex-col items-center">
          <Form.Select
            className="!border-none bg-transparent"
            name="department"
            value={selectedDep}
            onChange={(e) => setSelectedDep(e.target.value)}
          >
            <option value="">{t("kpi.selectDept")}</option>
            {deptOptions.map((dept, index) => (
              <option key={index} value={dept}>
                {dept}
              </option>
            ))}
          </Form.Select>
          <p className="text-9xl text-[var(--tenant-primary-dark)] rozha-one-regular">
            {formatCurrency(selectedDep ? selectedDepBudget : 0)}
            <span className="text-5xl">{t("kpi.currency")}</span>
          </p>
          <p className="text-xl font-bold">
            {selectedDep !== "" ? selectedDep : t("kpi.deptBudget")}
            <span className="text-lg">{t("kpi.budgetUnit")}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default KPIList;