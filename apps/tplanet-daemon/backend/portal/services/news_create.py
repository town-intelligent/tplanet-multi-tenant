"""News creation operations."""
import json
import logging
import os
import random
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import User

from portal.models import News

logger = logging.getLogger('tplanet')

ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.zip', '.rar', '.jpg', '.png', '.gif']
MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024


def news_post_create(req):
    """Create a news post."""
    req_dict = req.POST.dict()
    email = req_dict.get("email")

    if not email:
        return False, "Missing required parameter: email"

    if not User.objects.filter(email=email).exists():
        logger.warning(f"Error, Account not exist - {email}")
        return False, "Account not exist"

    news = _create_news_object(User.objects.get(email=email), req_dict)
    news_path = Path(settings.STATIC_ROOT) / "news" / news.uuid

    content = _save_images(news_path, req.FILES, news.uuid)
    attachment = _save_attachment(news_path, req.FILES, news.uuid)

    news.static = json.dumps(content)
    if attachment:
        news.attachments_data = json.dumps(attachment)
    news.save()

    return True, {**content, **({'attachment': attachment} if attachment else {})}


def _create_news_object(user, req_dict):
    """Create and initialize news object."""
    news = News()
    news.uuid = _generate_uuid()
    news.obj_user = user
    news.title = req_dict.get("title", "")
    news.description = req_dict.get("description", "")
    if "news_start" in req_dict and "news_end" in req_dict:
        news.period = f"{req_dict['news_start'].replace(' ', '')} - {req_dict['news_end'].replace(' ', '')}"
    return news


def _generate_uuid():
    """Generate unique 8-digit UUID."""
    while True:
        uuid = ''.join(str(random.randint(0, 9)) for _ in range(8))
        if not News.objects.filter(uuid=uuid).exists():
            return uuid


def _save_images(news_path, files, uuid):
    """Save banner and images."""
    news_path.mkdir(parents=True, exist_ok=True)
    static_url = f"{settings.STATIC_URL}news/{uuid}/"
    content = {"banner": "", "img_0": "", "img_1": "", "img_2": ""}

    for key in ["banner", "img_0", "img_1", "img_2"]:
        if key in files:
            ext = os.path.splitext(files[key].name)[-1]
            (news_path / f"{key}{ext}").write_bytes(files[key].read())
            content[key] = f"{static_url}{key}{ext}"
    return content


def _save_attachment(news_path, files, uuid):
    """Save single attachment if valid."""
    if "attachment" not in files:
        return None

    file = files["attachment"]
    if file.size > MAX_ATTACHMENT_SIZE:
        logger.warning(f"Attachment too large: {file.size} bytes")
        return None

    ext = os.path.splitext(file.name)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        logger.warning(f"Attachment not allowed extension: {ext}")
        return None

    safe_filename = f"attachment_{uuid}{ext}"
    (news_path / safe_filename).write_bytes(file.read())

    return {"original_name": file.name, "safe_filename": safe_filename,
            "file_size": file.size, "file_type": ext,
            "url": f"{settings.STATIC_URL}news/{uuid}/{safe_filename}"}
