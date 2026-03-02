"""Mockup operations."""
import json
import logging
import os
from pathlib import Path

from django.conf import settings

logger = logging.getLogger('tplanet')


def mockup_modify(req):
    """Modify mockup data."""
    email = req.POST.get("email")
    if not email:
        return False, "Missing required parameter: email"
    mockup_path = Path(settings.STATIC_ROOT) / "new_mockup" / email
    static_url = f"{settings.STATIC_URL}new_mockup/{email}/"

    mockup_path.mkdir(parents=True, exist_ok=True)

    # Create empty index
    (mockup_path / "index.html").write_text("")

    # Parse description from POST
    description = _parse_description(req.POST.dict())

    # Save uploaded files
    for filename, file in req.FILES.items():
        ext = os.path.splitext(file.name)[-1]
        with open(mockup_path / f"{filename}{ext}", "wb") as f:
            f.write(file.read())
        description[filename] = f"{static_url}{filename}{ext}"

    # Merge with existing description
    original = _load_description(mockup_path)
    original.update(description)

    # Save merged description
    (mockup_path / "description.json").write_text(json.dumps(original))

    return True, original


def _parse_description(raw):
    """Parse and filter description from raw POST data."""
    return {k: v for k, v in raw.items() if v not in ("undefined", None)}


def _load_description(mockup_path):
    """Load existing description or return empty dict."""
    desc_file = mockup_path / "description.json"
    if not desc_file.exists():
        return {}

    try:
        return json.loads(desc_file.read_text())
    except Exception as e:
        logger.error(e)
        return {}


def mockup_fetch(req):
    """Fetch mockup data."""
    email = req.POST.get("email")
    if not email:
        return False, "Missing required parameter: email"
    mockup_path = Path(settings.STATIC_ROOT) / "new_mockup" / email
    desc_file = mockup_path / "description.json"

    if not desc_file.exists():
        return True, {}

    try:
        return True, json.loads(desc_file.read_text())
    except Exception:
        return True, {}
