import { MapContainer, TileLayer, Tooltip, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useHosters, useDepartments } from "../../../utils/multi-tenant";

// 預設顏色表
const DEFAULT_COLORS = ['#744EC2', '#138DFF', '#D64550', '#6B007B', '#E66C37', '#FF8C00', '#D9B301', '#32CD32', '#12239E', '#E044A7', '#9370DB'];

// TreeNode 組件（定義在 BubbleMap 外面，避免每次 render 重建導致 scroll 重置）
const TreeNode = ({ node, checkedItems, onCheck, expandedNodes, onToggleExpand }) => {
  const isChecked = checkedItems[node.name] || false;
  const isExpanded = expandedNodes[node.name] || false;
  const hasChildren = node.children && node.children.length > 0;

  const handleCheck = () => {
    onCheck(node, !isChecked);
  };

  return (
    <div style={{ marginLeft: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={handleCheck}
            style={{ marginRight: "0.5rem" }}
          />
          {node.name}
        </label>
        {hasChildren && (
          <button
            onClick={() => onToggleExpand(node.name)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              marginLeft: "0.5rem",
              padding: "0"
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              stroke="#707070"
              style={{
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease-in-out",
              }}
            >
              <path
                d="M7 10L12 15L17 10"
                stroke="#878787"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div style={{ marginLeft: "1.5rem" }}>
          {node.children.map((child, idx) => (
            <TreeNode
              key={idx}
              node={child}
              checkedItems={checkedItems}
              onCheck={onCheck}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const BubbleMap = () => {
  // 狀態管理
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [checkedItems, setCheckedItems] = useState({});
  const [filteredData, setFilteredData] = useState([]);
  const [originalData, setOriginalData] = useState([]);
  const [apiDepartments, setApiDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bounds, setBounds] = useState({
    minLat: 23.6,
    maxLat: 24.2,
    minLong: 120.6,
    maxLong: 121.2
  });
  const [expandedNodes, setExpandedNodes] = useState({});  // 追蹤展開狀態
  const { t } = useTranslation();

  // Multi-tenant hooks
  const SITE_HOSTERS = useHosters();
  const TENANT_DEPARTMENTS = useDepartments();

  // 使用 tenant config departments，加上顏色
  const departments = useMemo(() => {
    return TENANT_DEPARTMENTS.map((name, index) => ({
      name: typeof name === 'string' ? name : name.name,
      color: DEFAULT_COLORS[index % DEFAULT_COLORS.length]
    }));
  }, [TENANT_DEPARTMENTS]);

  // API 呼叫函數 - 使用 tenant hosters 過濾
  const fetchBubbleMapData = async (filters = {}) => {
    try {
      setLoading(true);
      setError(null);

      // 使用 tenant hosters 和 departments
      const hosters = SITE_HOSTERS.length > 1 ? SITE_HOSTERS.slice(1) : SITE_HOSTERS;
      const tenantDepts = TENANT_DEPARTMENTS.map(d => typeof d === 'string' ? d : d.name);
      const requestBody = {
        email: hosters[0] || "",
        hosters: hosters,
        tenant_departments: tenantDepts,
        ...filters
      };

      const response = await fetch(import.meta.env.VITE_HOST_URL_TPLANET + '/api/dashboard/bubble_map_v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        const cityData = result.data.city || [];
        setOriginalData(cityData);
        setApiDepartments(result.data.departments || []);
        setBounds(result.data.bounds || bounds);

        // 從兩層結構提取鄉鎮資料給地圖用
        const towns = cityData.flatMap(county =>
          (county.children || []).filter(town => town.coordinates)
        );
        setFilteredData(towns);

        // 預設全部勾選（縣市和鄉鎮都勾選）
        const allChecked = {};
        const setAllChecked = (nodes) => {
          nodes.forEach(node => {
            allChecked[node.name] = true;
            if (node.children && node.children.length > 0) {
              setAllChecked(node.children);
            }
          });
        };
        setAllChecked(cityData);
        setCheckedItems(allChecked);

      } else {
        throw new Error(result.error || 'API 回傳失敗');
      }
    } catch (err) {
      const errorMessage = err.message;
      setError(errorMessage);
      console.error('API 呼叫失敗:', err);
      
      if (errorMessage.includes('Failed to fetch')) {
        setError('無法連接到伺服器，請檢查網路連線');
      }
    } finally {
      setLoading(false);
    }
  };

  // 初始載入資料 - 等待 SITE_HOSTERS 載入
  useEffect(() => {
    if (SITE_HOSTERS.length > 0) {
      fetchBubbleMapData();
    }
  }, [SITE_HOSTERS]);

  // 年度篩選
  const handleYearChange = async (year) => {
    setSelectedYear(year);
    const filters = {};
    
    if (year !== "all") {
      filters.year = parseInt(year);
    }
    
    if (selectedDepartment !== "all") {
      filters.department = selectedDepartment;
    }
    
    await fetchBubbleMapData(filters);
  };

  // 部門篩選
  const handleDepartmentChange = async (department) => {
    setSelectedDepartment(department);
    const filters = {};
    
    if (selectedYear !== "all") {
      filters.year = parseInt(selectedYear);
    }
    
    if (department !== "all") {
      filters.department = department;
    }
    
    await fetchBubbleMapData(filters);
  };

  // 地點篩選
  const handleCheck = (node, checked) => {
    const updated = { ...checkedItems };
    const setNodeCheck = (n, state) => {
      updated[n.name] = state;
      if (n.children) {
        n.children.forEach((child) => setNodeCheck(child, state));
      }
    };
    setNodeCheck(node, checked);
    setCheckedItems(updated);
  };

  // 從兩層結構提取所有鄉鎮資料（用於地圖顯示）
  const extractTowns = (data) => {
    return data.flatMap(county =>
      (county.children || []).filter(town => town.coordinates)
    );
  };

  // 根據勾選狀態篩選資料
  useEffect(() => {
    const checkedNames = Object.keys(checkedItems).filter(
      (key) => checkedItems[key]
    );

    if (checkedNames.length === 0) {
      // 沒有勾選時顯示全部鄉鎮
      setFilteredData(extractTowns(originalData));
    } else {
      // 從兩層結構中提取被勾選的鄉鎮
      const filtered = originalData.flatMap(county =>
        (county.children || []).filter(town =>
          town.coordinates && checkedItems[town.name]
        )
      );
      setFilteredData(filtered);
    }
  }, [checkedItems, originalData]);

  // 渲染 SDGs 標籤
  const renderSDGs = (sdgs) => {
    if (!sdgs || sdgs.length === 0) return "無對應 SDG";
    return sdgs.join(", ");
  };

  // 重試函數
  const handleRetry = () => {
    setError(null);
    fetchBubbleMapData();
  };

  // 切換節點展開狀態
  const toggleExpand = (nodeName) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeName]: !prev[nodeName]
    }));
  };

  // PieChartIcon 組件
  const PieChartIcon = (city, departments) => {
    // 使用平方根來計算大小，最小20px，最大60px
    const size = Math.min(Math.max(Math.sqrt(city.budget) / 8, 20), 60);
    const radius = size / 2;
    const innerRadius = radius - 3;

    // 使用 children 資料
    const budgets = city.children || [];
    const totalBudget = budgets.reduce((sum, d) => sum + (d.budget || 0), 0);

    if (totalBudget === 0) {
      // 如果總預算為0，顯示小的灰色圓圈
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="7" fill="rgba(204, 204, 204, 0.5)" stroke="rgba(150, 150, 150, 0.8)" stroke-width="1"/>
        </svg>
      `;

      return L.divIcon({
        html: svg,
        className: "",
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
    }

    // 如果只有一個部門
    if (budgets.length === 1) {
      const deptInfo = departments.find((d) => d.name === budgets[0].name) || {
        color: "#cccccc",
      };

      const colorWithAlpha = deptInfo.color.startsWith("#")
        ? `${deptInfo.color}B3`
        : `rgba(204, 204, 204, 0.7)`;

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${radius}" cy="${radius}" r="${innerRadius}" fill="${colorWithAlpha}"/>
        </svg>
      `;

      return L.divIcon({
        html: svg,
        className: "",
        iconSize: [size, size],
        iconAnchor: [radius, radius],
      });
    }

    // 多部門的圓餅圖
    let currentAngle = -Math.PI / 2;
    const slices = budgets
      .map((dept) => {
        const deptInfo = departments.find((d) => d.name === dept.name) || {
          color: "#cccccc",
        };

        const percentage = dept.budget / totalBudget;
        const sliceAngle = percentage * 2 * Math.PI;

        if (sliceAngle <= 0) return "";

        const colorWithAlpha = deptInfo.color.startsWith("#")
          ? `${deptInfo.color}B3`
          : `rgba(204, 204, 204, 0.7)`;

        const startX = radius + innerRadius * Math.cos(currentAngle);
        const startY = radius + innerRadius * Math.sin(currentAngle);

        const endX = radius + innerRadius * Math.cos(currentAngle + sliceAngle);
        const endY = radius + innerRadius * Math.sin(currentAngle + sliceAngle);

        const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

        const pathData = `
          M ${radius} ${radius}
          L ${startX} ${startY}
          A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${endX} ${endY}
          Z
        `;

        currentAngle += sliceAngle;

        return `<path d="${pathData}" fill="${colorWithAlpha}" stroke="rgba(255, 255, 255, 0.8)" stroke-width="1"/>`;
      })
      .filter((slice) => slice);

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        ${slices.join("")}
      </svg>
    `;

    return L.divIcon({
      html: svg,
      className: "",
      iconSize: [size, size],
      iconAnchor: [radius, radius],
    });
  };

  // 載入中狀態
  if (loading) {
    return (
      <div className="bg-white py-4">
        <div className="w-5/6 mx-auto">
          <div className="flex justify-center items-center h-96">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--tenant-primary)]"></div>
              <div className="mt-2">{t("common.loading")}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 錯誤狀態
  if (error) {
    return (
      <div className="bg-white py-4">
        <div className="w-5/6 mx-auto">
          <div className="flex justify-center items-center h-96">
            <div className="text-center">
              <div className="text-red-500 mb-4">
                <svg className="mx-auto h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                {t("common.error")}: {error}
              </div>
              <button 
                onClick={handleRetry}
                className="px-4 py-2 bg-[var(--tenant-primary)] text-[var(--tenant-primary-contrast)] rounded hover:opacity-90"
              >
                {t("common.retry")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 地圖中心和邊界計算
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const distanceLat = bounds.maxLat - bounds.minLat;
  const bufferLat = distanceLat * 0.05;
  const centerLong = (bounds.minLong + bounds.maxLong) / 2;
  const distanceLong = bounds.maxLong - bounds.minLong;
  const bufferLong = distanceLong * 0.15;

  return (
    <div className="bg-white py-4">
      <div className="w-5/6 mx-auto">
        <label className="text-xl font-semibold">
          {t("map.orgBudgetTitle")} {<span className="text-lg">({t("map.budgetUnit")})</span>}
        </label>
        <br />
        <span className="flex items-center font-semibold">
          {t("map.organization")}{" "}
          <span className="text-sm font-normal flex flex-wrap items-center gap-x-1 gap-y-2 ml-2">
            {departments.map((dept, index) => (
              <span key={index} className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: dept.color }}
                ></div>
                {dept.name}
              </span>
            ))}
          </span>
        </span>
        <div className="flex">
          <div className="w-3/4">
            <MapContainer
              className="w-full h-[480px] rounded-lg shadow-lg"
              zoom={10}
              center={[centerLat, centerLong]}
              bounds={[
                [bounds.minLat - bufferLat, bounds.minLong - bufferLong],
                [bounds.maxLat + bufferLat, bounds.maxLong + bufferLong],
              ]}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {filteredData.map((city, k) => (
                <Marker
                  key={k}
                  position={[city.coordinates[1], city.coordinates[0]]}
                  icon={PieChartIcon(city, departments)}
                >
                  <Tooltip direction="right" offset={[10, 0]} opacity={1}>
                    <div className="p-3 min-w-64">
                      <div className="flex justify-between items-start gap-4">
                        <div className="text-right text-gray-600 text-sm">
                          <div>{t("map.tooltipDistrict")}</div>
                          <div>{t("map.tooltipOrganization")}</div>
                          <div>{t("map.tooltipTotalBudget")}</div>
                          <div>{t("map.tooltipSdgs")}</div>
                        </div>
                        <div className="text-sm">
                          <div>{city.name}</div>
                          <div>
                            {city.children && city.children.length > 0 
                              ? city.children.map((c) => c.name).join(", ")
                              : t("map.noDepartment")
                            }
                          </div>
                          <div>{city.budget.toLocaleString()}</div>
                          <div>{renderSDGs(city.sdgs)}</div>
                        </div>
                      </div>
                    </div>
                  </Tooltip>
                </Marker>
              ))}
            </MapContainer>
          </div>
          {/* 篩選區域 */}
          <div className="w-1/4">
            <div className="flex flex-col px-3 gap-3">
              <select
                className="form-select block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[var(--tenant-primary)] focus:border-[var(--tenant-primary)]"
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
              >
                <option value="all">{t("map.filterAllYears")}</option>
                {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              <select
                className="form-select block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[var(--tenant-primary)] focus:border-[var(--tenant-primary)]"
                value={selectedDepartment}
                onChange={(e) => handleDepartmentChange(e.target.value)}
              >
                <option value="all">{t("map.filterAllDepartments")}</option>
                {departments.map(dept => (
                  <option key={dept.name} value={dept.name}>{dept.name}</option>
                ))}
              </select>

              <div className="border border-gray-300 rounded-md">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-300">
                  <h3 className="text-sm font-medium text-gray-900">{t("map.regionTaiwan")}</h3>
                </div>
                <div className="p-3">
                  <div className="h-[340px] overflow-auto">
                    {originalData.map((city, idx) => (
                      <TreeNode
                        key={idx}
                        node={city}
                        checkedItems={checkedItems}
                        onCheck={handleCheck}
                        expandedNodes={expandedNodes}
                        onToggleExpand={toggleExpand}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BubbleMap;