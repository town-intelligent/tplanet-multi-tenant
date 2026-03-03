import { formatDate } from "./Transform";

export const getTaskWeight = async (list_task_UUIDs) => {
  const formdata = new FormData();
  formdata.append("uuid", list_task_UUIDs[0]);

  try {
    const response = await fetch(
      `${import.meta.env.VITE_HOST_URL_TPLANET}/api/tasks/task_weight`,
      {
        method: "POST",
        body: formdata,
        redirect: "follow",
      }
    );

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
    return {};
  }
};

export const getTaskInfo = async (uuid) => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_HOST_URL_TPLANET}/api/tasks/get/${uuid}`,
      {
        method: "GET",
        redirect: "follow",
      }
    );

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    return data?.data || data;
  } catch (error) {
    console.error("Error:", error);
    return {};
  }
};

export const listChildrenTasks = async (taskUuid) => {
  const formdata = new FormData();
  formdata.append("uuid", taskUuid);

  try {
    const response = await fetch(
      `${import.meta.env.VITE_HOST_URL_TPLANET}/api/tasks/get_child_tasks`,
      {
        method: "POST",
        body: formdata,
        redirect: "follow",
      }
    );

    // 404 表示沒有 child tasks，這是正常的
    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    // API 回傳格式: {success: true, data: {...}} 或直接 {...}
    const result = data?.data || data;
    return result?.task || [];
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
};

export const submitTask = async (formdata) => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_HOST_URL_TPLANET}/api/tasks/new`,
      {
        method: "POST",
        body: formdata,
        redirect: "follow",
      }
    );

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    return data.task;
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
};

export const deleteTask = async (uuid) => {
  const formdata = new FormData();
  formdata.append("email", localStorage.getItem("email"));
  formdata.append("uuid", uuid);

  try {
    const response = await fetch(
      `${import.meta.env.VITE_HOST_URL_TPLANET}/api/tasks/del_task`,
      {
        method: "POST",
        body: formdata,
        redirect: "follow",
      }
    );

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
};

export const submitTaskCover = async (base64Img, uuid) => {
  const formdata = new FormData();
  formdata.append("uuid", uuid);
  formdata.append("img", base64Img);
  try {
    const response = await fetch(
      `${import.meta.env.VITE_HOST_URL_TPLANET}/api/tasks/push_task_cover`,
      {
        method: "POST",
        body: formdata,
        redirect: "follow",
      }
    );
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

export const parentTaskSubmit = async (formdata, id) => {
  if (!formdata) {
    return {};
  }
  for (const data of formdata.parentTasks) {
    const form = new FormData();

    form.append("uuid", id);
    form.append("task", data.uuid);
    form.append("email", localStorage.getItem("email"));
    form.append("name", data.name);
    form.append("task_start_date", formatDate(data.startDate));
    form.append("task_due_date", formatDate(data.dueDate));
    form.append("overview", data.overview);
    form.append("gps_flag", data.gps);

    try {
      await submitTask(form);
    } catch (e) {
      console.log(e);
    }
  }
};

export const childTaskSubmit = async (formdata, id) => {
  if (!formdata) {
    return {};
  }
  for (const data of formdata) {
    const form = new FormData();
    const type = 3;
    //const child_task_id = child_task_queue[index_child_task];

    form.append("task", data.uuid);
    form.append("name", data.name);
    form.append("task_start_date", formatDate(data.startDate));
    form.append("task_due_date", formatDate(data.dueDate));
    form.append("uuid", id);
    form.append("email", localStorage.getItem("email"));
    form.append("type", type);
    form.append("tasks", data.tasks);

    try {
      await submitTask(form);
    } catch (e) {
      console.log(e);
    }
  }
};
