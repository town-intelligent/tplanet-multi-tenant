import { useState, useEffect } from "react";
import { Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useTenantTheme } from "../utils/multi-tenant";

const ResetPw = () => {

  // Redirect to SignIn if email is not set in localStorage
  useEffect(() => {
    if (!localStorage.getItem("email")) {
      window.location.replace("/signin");
    }
  }, []);

  const [email, setEmail] = useState(localStorage.getItem("email") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [warningMessage, setWarningMessage] = useState("");

  // 即時驗證狀態
  const [passwordValidation, setPasswordValidation] = useState({
    isValid: false,
    length: false,
    hasLowerCase: false,
    hasUpperCase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });
  const [passwordMatch, setPasswordMatch] = useState(null); // null: 未檢查, true: 匹配, false: 不匹配
  const { t } = useTranslation();
  const { primaryColor, contrastColor } = useTenantTheme();

  // 密碼規則驗證
  useEffect(() => {
    if (password === "") {
      setPasswordValidation({
        isValid: false,
        length: false,
        hasLowerCase: false,
        hasUpperCase: false,
        hasNumber: false,
        hasSpecialChar: false,
      });
      return;
    }

    const validation = {
      length: password.length >= 8,
      hasLowerCase: /[a-z]/.test(password),
      hasUpperCase: /[A-Z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[\W_]/.test(password),
    };

    validation.isValid = Object.values(validation).every(Boolean);
    setPasswordValidation(validation);
  }, [password]);

  // 確認密碼匹配檢查
  useEffect(() => {
    if (confirmPassword === "") {
      setPasswordMatch(null);
      return;
    }
    setPasswordMatch(password === confirmPassword);
  }, [password, confirmPassword]);

  const handleSubmit = async () => {
    if (!passwordValidation.isValid) {
      setWarningMessage(t("resetPassword.error_invalid_password"));
      return;
    }
    if (!passwordMatch) {
      setWarningMessage(t("resetPassword.error_password_not_match"));
      return;
    }

    setWarningMessage("");

    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

    const urlencoded = new URLSearchParams();
    urlencoded.append("email", email);
    urlencoded.append("password", password);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_HOST_URL_TPLANET}/api/accounts/reset_password`,
        {
          method: "POST",
          headers: myHeaders,
          body: urlencoded,
          redirect: "follow",
        }
      );

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const returnData = await response.json();
      alert(t("resetPassword.success_reset"));
      window.location.replace("/signin");
    } catch (error) {
      console.error("Error:", error);
      setWarningMessage(t("resetPassword.error_reset_fail"));
    }
  };

  // 驗證狀態圖示組件
  const ValidationIcon = ({ isValid, isEmpty = false }) => {
    if (isEmpty) return null;
    return isValid ? (
      <span className="text-green-500 text-lg">✓</span>
    ) : (
      <span className="text-red-500 text-lg">✗</span>
    );
  };

  return (
    <div>
      <div className="flex flex-col pt-20">
        {/* 中間內容 */}
        <div className="w-1/2 mx-auto flex-1 px-4 py-2">
          <p className="text-center text-2xl">{t("resetPassword.title")}</p>
          <div>
            <div className="row justify-content-center">
              <div className="col-11 col-sm-5 rounded-xl py-2 mb-2 flex flex-col gap-3">
                <div className="form-group">
                  <small className="text-sm text-[#828282]">{email}</small>
                  <div className="relative">
                    <input
                      type="password"
                      className="rounded-xl w-full h-10 px-3 pr-10 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      id="password"
                      placeholder={t("resetPassword.password")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <ValidationIcon
                        isValid={passwordValidation.isValid}
                        isEmpty={password === ""}
                      />
                    </div>
                  </div>

                  {/* 密碼規則提示 */}
                  {password !== "" && (
                    <div className="mt-2 text-xs space-y-1">
                      <div
                        className={`flex items-center gap-1 ${passwordValidation.length ? "text-green-600" : "text-red-600"}`}
                      >
                        <span>{passwordValidation.length ? "✓" : "✗"}</span>
                        <span>{t("resetPassword.rule_length")}</span>
                      </div>
                      <div
                        className={`flex items-center gap-1 ${passwordValidation.hasLowerCase ? "text-green-600" : "text-red-600"}`}
                      >
                        <span>
                          {passwordValidation.hasLowerCase ? "✓" : "✗"}
                        </span>
                        <span>{t("resetPassword.rule_lowercase")}</span>
                      </div>
                      <div
                        className={`flex items-center gap-1 ${passwordValidation.hasUpperCase ? "text-green-600" : "text-red-600"}`}
                      >
                        <span>
                          {passwordValidation.hasUpperCase ? "✓" : "✗"}
                        </span>
                        <span>{t("resetPassword.rule_uppercase")}</span>
                      </div>
                      <div
                        className={`flex items-center gap-1 ${passwordValidation.hasNumber ? "text-green-600" : "text-red-600"}`}
                      >
                        <span>{passwordValidation.hasNumber ? "✓" : "✗"}</span>
                        <span>{t("resetPassword.rule_number")}</span>
                      </div>
                      <div
                        className={`flex items-center gap-1 ${passwordValidation.hasSpecialChar ? "text-green-600" : "text-red-600"}`}
                      >
                        <span>
                          {passwordValidation.hasSpecialChar ? "✓" : "✗"}
                        </span>
                        <span>{t("resetPassword.rule_special")}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group mb-0">
                  <div className="relative">
                    <input
                      type="password"
                      className="rounded-xl w-full h-10 px-3 pr-10 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      id="cfm_password"
                      placeholder={t("resetPassword.confirm_password")}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <ValidationIcon
                        isValid={passwordMatch === true}
                        isEmpty={confirmPassword === ""}
                      />
                    </div>
                  </div>

                  {/* 密碼匹配提示 */}
                  {confirmPassword !== "" && (
                    <div
                      className={`mt-1 text-xs ${passwordMatch ? "text-green-600" : "text-red-600"}`}
                    >
                      {passwordMatch ? t("resetPassword.match_success") : t("resetPassword.match_fail")}
                    </div>
                  )}

                  <small id="war_msg" className="fz-xs text-red-500 block mt-2">
                    {warningMessage}
                  </small>
                </div>
              </div>
            </div>
            <div className="row justify-content-center mt-3">
              <div className="col-11 col-sm-5 px-0">
                <Button
                  type="button"
                  className={`btn w-full h-12 rounded-xl font-medium transition-colors border-0 ${
                    passwordValidation.isValid && passwordMatch
                      ? ""
                      : "bg-gray-400 text-gray-200 cursor-not-allowed"
                  }`}
                  style={passwordValidation.isValid && passwordMatch ? { backgroundColor: primaryColor, color: contrastColor } : {}}
                  onClick={handleSubmit}
                  disabled={!passwordValidation.isValid || !passwordMatch}
                >
                  {t("resetPassword.confirm")}
                </Button>
              </div>
            </div>
            {/* <div className="row justify-content-center mt-3">
              <div className="col-11 col-sm-5 px-0">
                <button
                  type="button"
                  className={`btn w-full h-12 rounded-xl font-medium transition-colors ${
                    passwordValidation.isValid && passwordMatch
                      ? "bg-gray-800 text-white hover:bg-gray-700"
                      : "bg-gray-400 text-gray-200 cursor-not-allowed"
                  }`}
                  onClick={handleSubmit}
                  disabled={!passwordValidation.isValid || !passwordMatch}
                >
                  確認
                </button>
              </div>
            </div> */}
          </div>
        </div>

        {/* 最底下的波浪 */}
        <div className="relative h-40 bg-gray-100 overflow-hidden">
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
      </div>
    </div>
  );
};

export default ResetPw;
