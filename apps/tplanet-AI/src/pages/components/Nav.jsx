import { useState, useEffect } from "react";
import DefaultLogo from "../../assets/logo.svg";
import User from "../../assets/user.svg";
import Language_icon from "../../assets/language.svg";
import { Navbar, Nav, Container, NavDropdown } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../utils/ProtectRoute";
import { useTranslation } from "react-i18next";
import { useLogoUrl, useBrandName, useTenant } from "../../utils/multi-tenant";

export default function Str_Nav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLogin] = useState(false);
  const [scrollOpacity, setScrollOpacity] = useState(1);
  const { isAuthenticated } = useAuth();

  const { t, i18n } = useTranslation();
  const { loading } = useTenant();
  const tenantLogoUrl = useLogoUrl();
  const brandName = useBrandName();
  const logoSrc = loading ? null : (tenantLogoUrl || DefaultLogo);

  // Navbar 滾動/滑入效果
  useEffect(() => {
    const navbar = document.querySelector(".navbar");
    if (!navbar) return;

    let lastScrollTop = 0;
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      if (scrollTop > lastScrollTop) {
        navbar.classList.add("opacity-70");
      } else {
        navbar.classList.remove("opacity-70");
      }
      lastScrollTop = scrollTop;
    };
    const handleHover = () => navbar.classList.remove("opacity-70");

    navbar.addEventListener("mouseenter", handleHover);
    window.addEventListener("scroll", handleScroll);
    return () => {
      navbar.removeEventListener("mouseenter", handleHover);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // 使用者 icon 點擊後依 group 導頁
  const handleUserClick = () => {
    // 統一導向 /backend，由 BackendRedirect 根據權限決定去向
    navigate("/backend");
  };

  return (
    <Navbar
      expand="xl"
      className="flex items-center justify-between w-full navbar fixed-top"
      style={{
        backgroundColor: `rgba(255, 255, 255, ${scrollOpacity})`,
        backdropFilter: scrollOpacity < 0.9 ? "blur(10px)" : "none",
        transition: "all 0.3s ease-in-out",
        zIndex: 1030,
      }}
    >
      <Container fluid>
        <Navbar.Brand
          href="/"
          className="d-none d-md-block my-md-2 ml-10 w-[260px]"
        >
          {logoSrc && (
            <img
              src={logoSrc}
              alt={`${brandName} Logo`}
              className="logo-pc h-[42.88px]"
              style={{
                opacity: scrollOpacity,
                transition: "opacity 0.3s ease-in-out",
              }}
            />
          )}
        </Navbar.Brand>
        <Navbar.Brand href="/" className="d-md-none my-2 w-[260px]">
          {logoSrc && (
            <img
              src={logoSrc}
              alt={`${brandName} Logo`}
              className="logo-mobile h-[42.88px]"
              style={{
                opacity: scrollOpacity,
                transition: "opacity 0.3s ease-in-out",
              }}
            />
          )}
        </Navbar.Brand>

        <Navbar.Toggle
          aria-controls="navbarSupportedContent"
          aria-label="開啟目錄"
          className="mr-md-5"
        />

        <Navbar.Collapse id="navbarSupportedContent">
          <Nav className="ms-xl-auto text-lg font-bold gap-2.5">
            <Nav.Item id="index">
              <Nav.Link
                href="/"
                className="!text-black hover:!text-[var(--tenant-primary-dark,#1e3a5f)]"
                title="Second Home"
                style={{
                  opacity: scrollOpacity,
                  transition: "opacity 0.3s ease-in-out",
                }}
              >
                Second Home
              </Nav.Link>
            </Nav.Item>

            {/* ✅ 永續專案：只保留單一按鈕 */}
            {isAuthenticated ? (
              <Nav.Item id="sustainable">
                <NavDropdown
                  title={<span className="text-black ">{t("nav.sustainable")}</span>}
                  id="sustainable-dropdown"
                  style={{
                    opacity: scrollOpacity,
                    transition: "opacity 0.3s ease-in-out",
                  }}
                >
                  <NavDropdown.Item href="/kpi">
                    跨區跨域
                  </NavDropdown.Item>

                  <NavDropdown.Item href="/kpi?status=loggedin">
                    公司個體
                  </NavDropdown.Item>

                </NavDropdown>
              </Nav.Item>
            ) : (
              <Nav.Item id="sustainable">
                <Nav.Link
                  href="/kpi"
                  className="!text-black hover:!text-[var(--tenant-primary-dark,#1e3a5f)]"
                  title={t("nav.sustainable")}
                  style={{
                    opacity: scrollOpacity,
                    transition: "opacity 0.3s ease-in-out",
                  }}
                >
                  {t("nav.sustainable")}
                </Nav.Link>
              </Nav.Item>
            )}

            <Nav.Item id="news_list">
              <Nav.Link
                href="/news_list"
                className="!text-black hover:!text-[var(--tenant-primary-dark,#1e3a5f)]"
                title={t("nav.news")}
                style={{
                  opacity: scrollOpacity,
                  transition: "opacity 0.3s ease-in-out",
                }}
              >
                {/* 最新消息 */}
                {t("nav.news")}
              </Nav.Link>
            </Nav.Item>

            <NavDropdown
              title={
                <img
                  src={Language_icon}
                  alt="Language"
                  className="align-top mr-1"
                  width={30}
                  style={{
                    opacity: scrollOpacity,
                    transition: "opacity 0.3s ease-in-out",
                  }}
                />
              }
              id="language-dropdown"
              style={{
                opacity: scrollOpacity,
                transition: "opacity 0.3s ease-in-out",
              }}
            >
              <NavDropdown.Item onClick={() => i18n.changeLanguage("zh")}>
                中
              </NavDropdown.Item>
              <NavDropdown.Item onClick={() => i18n.changeLanguage("en")}>
                EN
              </NavDropdown.Item>
              <NavDropdown.Item onClick={() => i18n.changeLanguage("ja")}>
                日
              </NavDropdown.Item>
              <NavDropdown.Item onClick={() => i18n.changeLanguage("ko")}>
                한
              </NavDropdown.Item>
            </NavDropdown>

            {isAuthenticated ? (
              <img
                src={User}
                alt={t("nav.userIconAlt")}
                className="align-top mr-1 cursor-pointer"
                width={30}
                onClick={handleUserClick}
                style={{
                  opacity: scrollOpacity,
                  transition: "opacity 0.3s ease-in-out",
                }}
              />
            ) : (
              <Nav.Item id="account_status" className="flex items-center">
                <img
                  src={User}
                  alt={t("nav.userIconAlt")}
                  className="align-top mr-1"
                  width={30}
                  style={{
                    opacity: scrollOpacity,
                    transition: "opacity 0.3s ease-in-out",
                  }}
                />
                <Nav.Link
                  href="/signin"
                  className="px-0 !text-black hover:!text-[var(--tenant-primary-dark,#1e3a5f)]"
                  title={t("nav.signin")}
                  style={{
                    opacity: scrollOpacity,
                    transition: "opacity 0.3s ease-in-out",
                  }}
                >
                  {t("nav.signin")}
                </Nav.Link>
                <span className="px-1 align-middle mb-0.5">/</span>
                <Nav.Link
                  href="/signup"
                  className="px-0 !text-black hover:!text-[var(--tenant-primary-dark,#1e3a5f)]"
                  title={t("nav.signup")}
                  style={{
                    opacity: scrollOpacity,
                    transition: "opacity 0.3s ease-in-out",
                  }}
                >
                  {t("nav.signup")}
                </Nav.Link>
              </Nav.Item>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
