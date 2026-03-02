"""Task comment operations."""
import base64
import json
import logging
import os
from pathlib import Path, PurePath

from django.conf import settings

from projects.models import Task

logger = logging.getLogger('tplanet')


def comment(req):
    """Add comment to a task."""
    if not Task.objects.filter(uuid=req["uuid"]).exists():
        return False, "Task not exist"

    task = Task.objects.get(uuid=req["uuid"])
    comment_path = Path(settings.STATIC_ROOT) / "project" / task.obj_project.uuid / "tasks" / req["uuid"] / req["email"]
    comment_path.mkdir(parents=True, exist_ok=True)

    # Save comment
    (comment_path / "comment.txt").write_text(req["comment"])

    # Save status
    (comment_path / "status.txt").write_text("0")

    # Save picture
    if "img" in req:
        _save_comment_image(comment_path, req["img"])

    return True, json.dumps({"status": "OK"}, ensure_ascii=False)


def _save_comment_image(comment_path, img_data):
    """Save comment image."""
    try:
        if "data:image/png;base64," in img_data:
            img_data = img_data.replace("data:image/png;base64,", "")
        else:
            img_data = img_data.replace("data:image/jpeg;base64,", "")

        with open(comment_path / "img.png", "wb") as f:
            f.write(base64.b64decode(img_data))
    except Exception as e:
        logger.error(e)


def get_task_comment(req):
    """Get task comments."""
    if not Task.objects.filter(uuid=req["uuid"]).exists():
        logger.warning("Error, task not exist")
        return False, "Task not exist"

    task = Task.objects.get(uuid=req["uuid"])
    uuid_project = task.obj_project.uuid

    comments = []
    task_path = Path(f"backend/static/project/{uuid_project}/tasks/{req['uuid']}")

    if not task_path.exists():
        return True, comments

    for path in task_path.iterdir():
        if not path.is_dir():
            continue

        email = PurePath(path).parts[-1]
        comment_data = _read_comment_data(task_path, email, uuid_project, req["uuid"])
        comments.append(comment_data)

    return True, comments


def _read_comment_data(task_path, email, uuid_project, uuid_task):
    """Read comment data for a user."""
    status = "0"
    status_path = task_path / email / "status.txt"
    if os.path.exists(status_path):
        status = status_path.read_text()

    comment_text = (task_path / email / "comment.txt").read_text()
    img_url = f"/static/project/{uuid_project}/tasks/{uuid_task}/{email}/img.png"

    return {
        "email": email,
        "comment": comment_text,
        "img": img_url,
        "status": status
    }
