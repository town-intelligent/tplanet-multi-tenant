"""Project attachment operations."""
import json
import logging
import os
from pathlib import Path

from django.conf import settings

from projects.models import Project

logger = logging.getLogger('tplanet')


def upload_attachment(uuid, file_obj):
    """Upload attachment to a project."""
    if not Project.objects.filter(uuid=uuid).exists():
        return False, "Project not exist"

    project = Project.objects.get(uuid=uuid)
    attach_path = Path(settings.STATIC_ROOT) / "project" / project.uuid / "attachments"
    attach_path.mkdir(parents=True, exist_ok=True)

    # Clear old files
    for p in attach_path.glob("*"):
        if p.is_file():
            try:
                p.unlink()
            except Exception as e:
                logger.warning(f"Failed to remove file {p}: {e}")

    # Save new file
    file_path = attach_path / file_obj.name
    with open(file_path, "wb") as f:
        for chunk in file_obj.chunks():
            f.write(chunk)

    project.attachments_data = json.dumps({file_obj.name: str(file_path)}, ensure_ascii=False)
    project.save(update_fields=["attachments_data"])

    return True, "Upload success"


def download_attachment(uuid, filename=None):
    """Download attachment from a project."""
    if not Project.objects.filter(uuid=uuid).exists():
        return False, "Project not exist"

    project = Project.objects.get(uuid=uuid)

    if not project.attachments_data:
        return False, "No attachments found"

    attachments = json.loads(project.attachments_data)

    if filename:
        file_path = attachments.get(filename)
        if not file_path:
            return False, f"File not found, name = {filename}"
    else:
        file_path = list(attachments.values())[0]

    if not os.path.exists(file_path):
        return False, "File missing on server"

    return True, file_path


def attachment_exist(uuid):
    """Check if attachment exists for a project."""
    if not Project.objects.filter(uuid=uuid).exists():
        return False, "Project not exist"

    project = Project.objects.get(uuid=uuid)

    if not project.attachments_data:
        return False, "No attachments found"

    return True, "Attachments exist"
