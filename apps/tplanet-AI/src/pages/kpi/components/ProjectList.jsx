import { Row, Col, Form, Card } from "react-bootstrap";
import { Link } from "react-router-dom";
import SdgIconsGenerator from "../../../utils/sdgs/SdgsImg";
import React from "react";
import Pagination from "react-bootstrap/Pagination";
import { useDepartments } from "../../../utils/multi-tenant";
import { useTranslation } from "react-i18next";

const API_BASE = (import.meta.env.VITE_HOST_URL_TPLANET || "").replace(/\/+$/, "");
const resolveAssetUrl = (path) => {
  if (!path) return "#";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/static/")) {
    return API_BASE ? `${API_BASE}${path}` : `/api${path}`;
  }
  return API_BASE ? `${API_BASE}${path}` : path;
};

const sdgs = [
  "SDG1",
  "SDG2",
  "SDG3",
  "SDG4",
  "SDG5",
  "SDG6",
  "SDG7",
  "SDG8",
  "SDG9",
  "SDG10",
  "SDG11",
  "SDG12",
  "SDG13",
  "SDG14",
  "SDG15",
  "SDG16",
  "SDG17",
];

const ProjectList = ({
  projects,
  filteredProjects,
  setFilteredProjects,
  years,
  selectedYear,
  setSelectedYear,
  selectedDep,
  setSelectedDep,
  selectedSdg,
  setSelectedSdg,
  currentPage,
  setCurrentPage,
  resetToFirstPage,
}) => {
  const { t } = useTranslation();
  const departments = useDepartments();
  // 篩選專案
  const applyFilters = (year, dep, sdg) => {
    let filtered = projects;

    // 年度篩選
    if (year !== "all") {
      filtered = filtered.filter((project) => {
        if (!project.period) return false;
        const startYear = new Date(project.period.split("-")[0]).getFullYear();
        return startYear === parseInt(year);
      });
    }

    // 局處篩選
    if (dep !== "all") {
      filtered = filtered.filter((project) => {
        return project.project_b === dep;
      });
    }

    // SDG 篩選
    if (sdg !== "all") {
      filtered = filtered.filter((project) => {
        if (!project.weight) return false;
        const weightArray = project.weight.split(",");
        const sdgIndex = parseInt(sdg.replace("SDG", "")) - 1;
        return weightArray[sdgIndex] === "1";
      });
    }

    setFilteredProjects(filtered);
  };

  const handleYearChange = (e) => {
    const year = e.target.value;
    setSelectedYear(year);
    resetToFirstPage();
    applyFilters(year, selectedDep, selectedSdg);
  };

  const handleDepartmentChange = (e) => {
    const dep = e.target.value;
    setSelectedDep(dep);
    resetToFirstPage();
    applyFilters(selectedYear, dep, selectedSdg);
  };

  const handleSdgChange = (e) => {
    const sdg = e.target.value;
    setSelectedSdg(sdg);
    resetToFirstPage();
    applyFilters(selectedYear, selectedDep, sdg);
  };

  // 生成專案卡片的 HTML
  const generateProjectBlock = (project) => {
    return (
      <Col md={4} key={project.uuid} className="mb-4">
        <Card className="kpi-card" style={{ borderRadius: "20px" }}>
          <Link
            to={`/content/${project.uuid}`}
            className="!no-underline text-black"
          >
            <div
              className="img-fluid bg-cover shadow"
              style={{
                backgroundImage: `url(${resolveAssetUrl(project.img)})`,
                height: "200px",
                borderRadius: "18px",
                backgroundSize: "cover",
                backgroundPosition: "center center",
              }}
            ></div>
          </Link>
          <Card.Body>
            <Link
              to={`/content/${project.uuid}`}
              className="!no-underline text-black"
            >
              <p className="text-xl text-[var(--tenant-primary-dark,#1e3a5f)] font-bold">{project.name}</p>
              <p>{t("project.projectOrg")}: {project.org}</p>
              <p>{t("project.projectTeam")}: {project.project_b}</p>
              <p>
                {t("project.projectPeriod")}:{" "}
                <span className="font-bold">
                  {project.period ? project.period.split("-").join(" ~ ") : ""}
                </span>
              </p>
            </Link>
            <div className="flex flex-wrap gap-1">
              <SdgIconsGenerator weight={project.weight} />
            </div>
          </Card.Body>
        </Card>
      </Col>
    );
  };

  const firstPageItems = 3;
  const otherPagesItems = 9;

  const totalItems = filteredProjects.length;

  const totalPages =
    totalItems <= firstPageItems
      ? 1
      : Math.ceil((totalItems - firstPageItems) / otherPagesItems) + 1;

  const startIndex =
    currentPage === 1
      ? 0
      : firstPageItems + (currentPage - 2) * otherPagesItems;

  const endIndex =
    currentPage === 1
      ? Math.min(firstPageItems, totalItems)
      : Math.min(startIndex + otherPagesItems, totalItems);

  const currentPageProjects = filteredProjects.slice(startIndex, endIndex);

  return (
    <div className="bg-light py-4">
      <div className="flex flex-col justify-center w-5/6 mx-auto">
        {/* 只有第一頁才顯示標題和篩選器 */}
        {currentPage === 1 && (
          <>
            <div className="">
              <h3 className="text-center fw-bold">{t("project.projectListTitle")}</h3>
            </div>
            <div className="flex mb-3 gap-4">
              {/* 年度 */}
              <div className="w-36">
                <Form.Select
                  aria-label={t("project.filterYear")}
                  id="year_filter"
                  value={selectedYear}
                  onChange={handleYearChange}
                >
                  <option value="all">{t("project.filterSelectYear")}</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </Form.Select>
              </div>

              {/* 地方團隊 */}
              <div className="w-44">
                <Form.Select
                  aria-label={t("project.filterDepartment")}
                  id="departments_filter"
                  value={selectedDep}
                  onChange={handleDepartmentChange}
                >
                  <option value="all">{t("project.filterDepartment")}</option>
                  {departments.map((dep) => (
                    <option key={dep.id || dep} value={dep.name || dep}>
                      {dep.name || dep}
                    </option>
                  ))}
                </Form.Select>
              </div>

              {/* 永續發展指標 */}
              <div className="w-44">
                <Form.Select
                  aria-label={t("project.filterSdg")}
                  id="sdg_filter"
                  value={selectedSdg}
                  onChange={handleSdgChange}
                >
                  <option value="all">{t("project.filterSdgs")}</option>
                  {sdgs.map((sdg) => (
                    <option key={sdg} value={sdg}>
                      {sdg}
                    </option>
                  ))}
                </Form.Select>
              </div>
            </div>
          </>
        )}

        {/* 專案卡片列表 */}
        <Row id="project_container">
          {currentPageProjects.map((project) => generateProjectBlock(project))}
        </Row>

        {/* 分頁 */}
        {totalPages > 1 && (
          <div className="text-center mt-10 flex justify-center">
            <Pagination>
              <Pagination.Prev
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              />
              {Array.from({ length: totalPages }, (_, index) => {
                const pageNumber = index + 1;
                return (
                  <Pagination.Item
                    key={pageNumber}
                    active={pageNumber === currentPage}
                    onClick={() => setCurrentPage(pageNumber)}
                  >
                    {pageNumber}
                  </Pagination.Item>
                );
              })}
              <Pagination.Next
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
              />
            </Pagination>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectList;
