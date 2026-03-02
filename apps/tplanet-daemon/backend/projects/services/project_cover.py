"""Project cover image operations."""
import base64
import json
from pathlib import Path

from django.conf import settings

from projects.models import Project


def push_project_cover(req):
    """Upload project cover image."""
    if not Project.objects.filter(uuid=req["uuid"]).exists():
        return False, "Project not exist"

    project = Project.objects.get(uuid=req["uuid"])

    # Create directory
    cover_path = Path(settings.STATIC_ROOT) / "project" / project.uuid / "media" / "cover"
    cover_path.mkdir(parents=True, exist_ok=True)

    # Decode and save image
    img_data = req["img"]
    if "jpeg" in img_data:
        img_data = img_data.replace("data:image/jpeg;base64,", "")
    else:
        img_data = img_data.replace("data:image/png;base64,", "")

    file_content = base64.b64decode(img_data)
    with open(cover_path / "cover.png", "wb") as f:
        f.write(file_content)

    project.img = f"{settings.STATIC_URL}project/{project.uuid}/media/cover/cover.png"
    project.save()

    return True, json.dumps({"result": "true", "url": project.img}, ensure_ascii=False)
