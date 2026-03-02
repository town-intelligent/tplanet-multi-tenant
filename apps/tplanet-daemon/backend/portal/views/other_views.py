"""Mockup, News, Upload, and Contact Us view endpoints."""
import json
import logging
import os
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse
from django.conf import settings

from portal.gmail import send_gmail
from portal.manager import mockup_modify, mockup_fetch
from portal.manager import news_post_create, news_post_list, news_post_get, news_post_delete

logger = logging.getLogger('tplanet')


def _response(**kwargs):
    """Create JSON response."""
    resp = HttpResponse()
    resp.write(json.dumps(kwargs, ensure_ascii=False))
    return resp


@csrf_exempt
def mockup_new(request):
    """Create/modify mockup."""
    result, description = mockup_modify(request)
    return _response(result=result, description=description)


@csrf_exempt
def mockup_get(request):
    """Get mockup."""
    result, description = mockup_fetch(request)
    return _response(result=result, description=description)


@csrf_exempt
def news_create(request):
    """Create news post."""
    result, content = news_post_create(request)
    return _response(result=result, content=content)


@csrf_exempt
def news_list(request):
    """List news posts."""
    result, content = news_post_list(request)
    return _response(result=result, content=content)


@csrf_exempt
def news_get(request):
    """Get news post."""
    result, content = news_post_get(request)
    return _response(result=result, content=content)


@csrf_exempt
def news_delete(request):
    """Delete news post."""
    result, content = news_post_delete(request)
    return _response(result=result, content=content)


@csrf_exempt
def contact_us(request):
    """Handle contact us form submission."""
    try:
        data = request.POST.dict()
        name = data.get("name", "")
        email = data.get("email", "")
        company = data.get("company", "")
        phone = data.get("phone", "")
        sdgs = data.get("sdgs", "")
        needs = data.get("needs", "")
        to = data.get("to", settings.GMAIL_USERNAME)

        subject = f"[Secondhome@AI] 聯繫我們 - {name}"
        content = (
            f"姓名: {name}\n"
            f"Email: {email}\n"
            f"公司/組織: {company}\n"
            f"電話: {phone}\n"
            f"SDGs: {sdgs}\n"
            f"需求說明:\n{needs}\n"
        )

        sent = send_gmail(subject, to, content)
        return _response(result=sent)
    except Exception as e:
        logger.error(f"contact_us error: {e}")
        return _response(result=False, error=str(e))


@csrf_exempt
def upload_img(request):
    """Upload image."""
    try:
        img_path = settings.STATIC_ROOT + "/media/imgs/"
        for filename, file in request.FILES.items():
            with open(img_path + filename + os.path.splitext(file.name)[-1], "wb") as f:
                f.write(file.read())
    except Exception as e:
        logger.error(e)

    return _response(result="OK")
