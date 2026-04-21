// 上傳 mockup
//
// Note: /api/mockup/new is auth-gated server-side (Bearer JWT required; caller
// must be tenant hosters[0] or a YAML superuser). The `email` POST field is
// ignored by the backend — it derives the email from the JWT user to prevent
// impersonation.
export async function mockup_upload(form) {
  try {
    const jwt = (typeof localStorage !== "undefined" && localStorage.getItem("jwt")) || "";
    const response = await fetch(
      `${import.meta.env.VITE_HOST_URL_TPLANET}/api/mockup/new`,
      {
        method: "POST",
        body: form,
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.text();
    return JSON.parse(data);
  } catch (error) {
    console.error("mockup_upload error:", error);
    throw error; // 保持原本的 Promise reject 行為
  }
}

// 獲取 mockup
export async function mockup_get(formData) {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_HOST_URL_TPLANET}/api/mockup/get`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.text();
    return JSON.parse(data);
  } catch (error) {
    console.error("mockup_get error:", error);
    return { description: {} }; // 返回預設值以保持向後兼容
  }
}
