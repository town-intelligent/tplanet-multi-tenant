"""Task creation operations."""
import ast
import base64
import json
import logging
import random
import re
from distutils.util import strtobool
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import User

from projects.models import Project, Task

logger = logging.getLogger('tplanet')


def create_task(req):
    """Create a new task."""
    if not Project.objects.filter(uuid=req["uuid"]).exists():
        logger.warning(f"Project {req['uuid']} not exist")
        return False, "Project not exist"

    task = _get_or_create_task(req)
    task.obj_user = User.objects.get(email=req["email"])
    task.obj_project = Project.objects.get(uuid=req["uuid"])
    task.token = int(req.get("token", 0))
    task.type_task = int(req.get("type", 0))
    if "type" not in req:
        task.overview = "SDGS 永續問卷"

    _set_task_content(task, req)
    task.name = req.get("name", task.name)
    task.overview = req.get("overview", task.overview)
    if req.get("task_start_date") and req.get("task_due_date"):
        task.period = f"{req['task_start_date']}-{req['task_due_date']}"

    if "cover" in req:
        _save_task_cover(task, req)

    try:
        task.gps_flag = bool(strtobool(req.get("gps_flag", "false")))
    except Exception:
        task.gps_flag = False

    task.save()
    return True, task.uuid


def _get_or_create_task(req):
    """Get existing task or create new one."""
    if "task" in req:
        return Task.objects.get(uuid=req["task"])

    task = Task()
    while True:
        uuid = ''.join(str(random.randint(0, 9)) for _ in range(8))
        if not Task.objects.filter(uuid=uuid).exists():
            task.uuid = uuid
            break
    return task


def _set_task_content(task, req):
    """Parse and set task content from request."""
    try:
        tasks_list = ast.literal_eval(re.sub(r'', '', req["tasks"]))
        content = {f"sdgs-{i}": "0" for i in range(1, 28)}

        for item in tasks_list:
            if "task_parent_id" in item:
                parent_id = item["task_parent_id"]
                if Task.objects.filter(uuid=parent_id).exists():
                    task.parent_task = Task.objects.get(uuid=parent_id)
            else:
                content[f"sdgs-{int(item['sdg'])}"] = "1"

        task.content = json.dumps(content)
    except Exception as e:
        logger.error(e)


def _save_task_cover(task, req):
    """Save task cover image."""
    img = req["cover"]
    if "data:image/png;base64," in img:
        img = img.replace("data:image/png;base64,", "")
    else:
        img = img.replace("data:image/jpeg;base64,", "")

    cover_path = Path(settings.STATIC_ROOT) / "project" / req["uuid"] / "tasks" / task.uuid / "cover"
    cover_path.mkdir(parents=True, exist_ok=True)

    with open(cover_path / "cover.png", "wb") as f:
        f.write(base64.b64decode(img))

    task.thumbnail = f"{settings.STATIC_URL}project/{task.obj_project.uuid}/tasks/{task.uuid}/cover/cover.png"
