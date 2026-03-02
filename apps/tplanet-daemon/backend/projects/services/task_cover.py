"""Task cover image operations."""
import base64
import json
import logging
from pathlib import Path

from django.conf import settings

from projects.models import Task

logger = logging.getLogger('tplanet')


def push_task_cover(req):
    """Upload task cover image."""
    if not Task.objects.filter(uuid=req["uuid"]).exists():
        logger.warning("Task not exist")
        return False, "Task not exist"

    task = Task.objects.get(uuid=req["uuid"])

    if "img" in req:
        img_data = req["img"]
        if "data:image/png;base64," in img_data:
            img_data = img_data.replace("data:image/png;base64,", "")
        else:
            img_data = img_data.replace("data:image/jpeg;base64,", "")

        cover_path = Path(settings.STATIC_ROOT) / "project" / task.obj_project.uuid / "tasks" / req["uuid"]
        cover_path.mkdir(parents=True, exist_ok=True)

        with open(cover_path / "cover.png", "wb") as f:
            f.write(base64.b64decode(img_data))

    task.thumbnail = f"{settings.STATIC_URL}project/{task.obj_project.uuid}/tasks/{req['uuid']}/cover.png"
    task.save()

    return True, json.dumps({"result": "true", "url": task.thumbnail}, ensure_ascii=False)
