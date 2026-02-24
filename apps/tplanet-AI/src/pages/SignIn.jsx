import { useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Captcha from "../utils/Captcha";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/ProtectRoute";
import { useTranslation } from "react-i18next";
import { apiPost } from "../utils/api";
import { useTenantTheme } from "../utils/multi-tenant";

const getLocalStorage = (key) => localStorage.getItem(key);

export default function SignIn() {
  const [isVerified, setIsVerified] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { setIsAuthenticated } = useAuth();
  const { t } = useTranslation();
  const { primaryColor, secondaryColor, contrastColor } = useTenantTheme();

  const signin = async (formdata) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await apiPost('/accounts/signin', formdata);

      if (!response.success) {
        throw new Error(response.error?.message || "登入失敗");
      }

      return response.data;
    } catch (error) {
      setError(true);
      console.error("登入錯誤:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const formData = new FormData();
      formData.append("username", email);
      formData.append("email", email);
      formData.append("password", password);
      const result = await signin(formData);

      // 假設登入成功後的處理，例如儲存 token 等
      if (result?.token) {
        localStorage.setItem("jwt", result.token);
        localStorage.setItem("username", result.username);
        localStorage.setItem("email", email);
        setIsAuthenticated(true);

        // 統一導向 /backend，由 BackendRedirect 根據權限決定去向
        navigate("/backend");
      }
    } catch (error) {
      // 錯誤已經在 signin 函數中處理
      console.error("提交表單時發生錯誤:", error);
    }
  };

  return (
    <>
      <div className="w-2/3 mx-auto mb-5">
        <p className="text-center mt-5 text-2xl">{t("login.title")}</p>
        <form>
          <div className="row justify-content-center mt-3">
            <div className="col-11 col-sm-5 rounded-xl py-2 mb-2 flex flex-col gap-3">
              {error ? (
                <div className="border-1 border-[#BE0000] bg-[#FFAEAE] p-1 mb-2 rounded text-center">
                  <small id="wrong-pw" className="  text-danger  ">
                    {t("login.errorWrongCredentials")}
                  </small>
                </div>
              ) : null}
              <div className="form-group">
                <input
                  type="email"
                  className={`rounded-xl w-full h-10 px-3 bg-buttonBg ${
                    error ? "border-1 border-[#BE0000]" : ""
                  }`}
                  id="email"
                  aria-describedby="emailHelp"
                  placeholder={t("login.emailPlaceholder")}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                  }}
                />
              </div>
              <div className="form-group mb-0 relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className={`rounded-xl w-full h-10 px-3 pr-10 bg-buttonBg ${
                    error ? "border-1 border-[#BE0000]" : ""
                  }`}
                  placeholder={t("login.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                  }}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-center mt-2">
            <div className="w-1/3 px-0">
              <div className="flex justify-between">
                <p className="mb-0">
                  <a
                    href="/forget_pw"
                    className="!no-underline hover:!underline text-dark"
                  >
                    {t("login.forgotPassword")}
                  </a>
                </p>

                <a
                  href="/signup"
                  className="ml-auto !no-underline hover:!underline"
                >
                  {t("login.createAccount")}
                </a>
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-center">
            <Captcha isVerified={isVerified} setIsVerified={setIsVerified} />
          </div>

          <div className="row justify-content-center mt-4">
            <div className="col-11 col-sm-5 p-0">
              <Button
                type="submit"
                className="btn btn-block w-full border-0"
                style={{ backgroundColor: primaryColor, color: contrastColor }}
                onClick={handleSubmit}
                disabled={!isVerified}
              >
                {t("login.submit")}
              </Button>
            </div>
          </div>
        </form>
      </div>
      <div className="relative h-40 bg-gray-100 overflow-hidden">
        {/* 後景灰色波浪 */}
        <svg
          className="absolute bottom-0 left-0 w-full h-28 opacity-90 translate-y-2"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            fill="#e5e5e5"
            d="M0,36 C160,56 320,76 480,70 C640,64 800,32 960,38 C1120,44 1280,88 1440,80 L1440,120 L0,120 Z"
          ></path>
        </svg>

        {/* 前景藍色波浪 */}
        <svg
          className="absolute bottom-0 left-0 w-full h-28"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            fill={primaryColor}
            d="M0,76 C180,44 360,20 540,30 C720,40 900,80 1080,86 C1260,92 1350,80 1440,66 L1440,120 L0,120 Z"
          ></path>
        </svg>
      </div>
    </>
  );
}
