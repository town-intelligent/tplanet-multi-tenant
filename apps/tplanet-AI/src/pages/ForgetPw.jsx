import { useState } from "react";
import Button from "react-bootstrap/Button";
import { forgotPassword } from "../utils/Accounts";
import { useTenantTheme } from "../utils/multi-tenant";

const ForgetPw = () => {
  const { primaryColor, contrastColor } = useTenantTheme();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false); // 新增狀態控制

  const handleSubmit = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      alert("請輸入電子郵件信箱");
      return;
    }

    if (!emailRegex.test(email)) {
      alert("請輸入正確的電子郵件格式");
      return;
    }

    // 按下後進入寄信狀態
    setIsSubmitting(true);

    try {
      const success = await forgotPassword(email);

      if (success) {
        alert("重設密碼連結已寄出，請檢查您的信箱");
      } else {
        alert("變更密碼失敗，請洽系統管理員或稍後再試");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("變更密碼失敗，請洽系統管理員或稍後再試");
    } finally {
      // 無論成功與否都恢復按鈕
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col pt-20">
        {/* 中間內容 */}
        <div className="w-1/2 mx-auto my-12 flex-1 justify-center items-center px-4 py-2">
          <p className="text-center text-2xl">忘記密碼</p>
          <form>
            <div className="row justify-content-center">
              <div className="col-11 col-sm-5 rounded-xl py-2 mb-2 flex flex-col gap-3">
                <div className="form-group">
                  <label className="text-sm">
                    請輸入電子郵件信箱以重新設定
                  </label>
                  <input
                    type="email"
                    className="rounded-xl w-full h-10 px-3 bg-white"
                    aria-describedby="emailHelp"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
            <div className="row justify-content-center mt-3">
              <div className="col-11 col-sm-5 px-0">
                <Button
                  type="button"
                  className="btn btn-block w-full border-0"
                  style={{ backgroundColor: primaryColor, color: contrastColor }}
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "請稍候..." : "確認"}
                </Button>
              </div>
            </div>
          </form>
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

export default ForgetPw;