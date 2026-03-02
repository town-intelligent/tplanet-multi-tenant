// 原檔：src/pages/SignUp.jsx（或你的檔案路徑）
import { useState } from "react";
import Button from "react-bootstrap/Button";
import Captcha from "../utils/Captcha";
import PrivacyPolicyModal from "../components/PrivacyPolicyModal";
import { useTranslation } from "react-i18next";
import { useTenantTheme } from "../utils/multi-tenant";

const SignUp = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const [isVerified, setIsVerified] = useState(false);

  // 新增：條款 Modal 狀態
  const [showPolicy, setShowPolicy] = useState(false);
  const [agreedPolicy, setAgreedPolicy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { t } = useTranslation();
  const { primaryColor, contrastColor } = useTenantTheme();

  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

  // 把實際送出的邏輯抽出
  const doSubmit = async () => {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

    const urlencoded = new URLSearchParams();
    urlencoded.append("username", username);
    urlencoded.append("email", email);
    urlencoded.append("password", password);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_HOST_URL_TPLANET}/api/accounts/signup`,
        {
          method: "POST",
          headers: myHeaders,
          body: urlencoded,
          redirect: "follow",
        }
      );

      if (!response.ok) {
        alert(t("signup.fail"));
        throw new Error("Network response was not ok");
      }

      const returnData = await response.json();
      localStorage.setItem("jwt", returnData.token);
      localStorage.setItem("username", username);
      console.log("Get JWT from cookie", localStorage.getItem("jwt"));
      window.location.replace("/");
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // 原本的送出入口，先檢查密碼與 Captcha，再檢查是否已同意條款
  const handleSubmit = async () => {
    if (!passwordRegex.test(password)) {
      setWarningMessage("密碼需至少 8 碼，且包含大小寫字母、數字及特殊符號");
      return;
    }
    if (password !== confirmPassword) {
      setWarningMessage("兩次輸入的密碼不一致");
      return;
    }
    if (!isVerified) {
      setWarningMessage("請先通過驗證碼");
      return;
    }
    if (!agreedPolicy) {
      // 尚未同意，先開條款 Modal；等使用者按「同意並繼續」後再送出
      setShowPolicy(true);
      return;
    }

    // 已同意 → 直接送出
    await doSubmit();
  };

  // Modal 的事件：同意 → 設定已同意並送出；關閉 → 單純關閉
  const handleAgreePolicy = async () => {
    setAgreedPolicy(true);
    setShowPolicy(false);
    await doSubmit();
  };

  return (
    <>
      <div className="w-1/2 mx-auto mb-5">
        <p className="text-center mt-4 text-2xl">{t("signup.title")}</p>
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="row justify-content-center">
            <div className="col-11 col-sm-5 rounded-xl py-2 mb-2 flex flex-col gap-3">
              <div className="form-group">
                <input
                  type="email"
                  className="rounded-xl w-full h-10 px-3 bg-white"
                  aria-describedby="emailHelp"
                  placeholder={t("signup.accountPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="form-group">
                <input
                  type="text"
                  className="rounded-xl w-full h-10 px-3 bg-white"
                  id="username"
                  placeholder={t("signup.usernamePlaceholder")}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="form-group relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="rounded-xl w-full h-10 px-3 pr-10 bg-white"
                  id="password"
                  placeholder={t("signup.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
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
              <div className="form-group mb-0 relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="rounded-xl w-full h-10 px-3 pr-10 bg-white"
                  id="cfm_password"
                  placeholder={t("signup.confirmPasswordPlaceholder")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-5 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
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
                <small id="war_msg" className="fz-xs text-danger">
                  {warningMessage}
                </small>
              </div>
            </div>
          </div>

          <div className="row justify-center mt-3">
            <div className="col-11 col-sm-5">
              <div className="flex justify-between items-center">
                <a href="/forget_pw" className="text-dark !no-underline">
                  {t("signup.forgotPassword")}
                </a>

                {/* 讓使用者可手動查看條款 */}
                <button
                  type="button"
                  onClick={() => setShowPolicy(true)}
                  className="ml-auto hover:underline bg-transparent border-0 p-0"
                  style={{ color: primaryColor }}
                >
                  {t("signup.readPrivacyPolicy")}
                </button>
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-center">
            <Captcha isVerified={isVerified} setIsVerified={setIsVerified} />
          </div>

          <div className="row justify-content-center mt-3">
            <div className="col-11 col-sm-5 px-0">
              <Button
                type="button"
                className="btn btn-block w-full border-0"
                style={{ backgroundColor: primaryColor, color: contrastColor }}
                onClick={handleSubmit}
                disabled={!isVerified}
              >
                {t("signup.submit")}
              </Button>
            </div>
          </div>
        </form>
      </div>

      <div className="relative h-40 bg-gray-100 overflow-hidden">
        <svg
          className="absolute bottom-0 left-0 right-0 w-full h-28"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            fill="#e5e6e8"
            d="M0 40c80 6 160 15 240 22s160 10 240 7 160-13 240-29 160-22 240-16 160 26 240 32 160 2 240 2v62H0Z"
          />
        </svg>
        <svg
          className="absolute bottom-0 left-0 right-0 w-full h-36"
          viewBox="0 0 1440 140"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            fill={primaryColor}
            d="M0 84c120 28 240 42 360 37s240-34 360-63 240-40 360-26 240 58 360 74v34H0Z"
          />
        </svg>
      </div>

      {/* 隱私權條款 Modal */}
      <PrivacyPolicyModal
        show={showPolicy}
        onClose={() => setShowPolicy(false)}
        onAgree={handleAgreePolicy}
      />
    </>
  );
};

export default SignUp;