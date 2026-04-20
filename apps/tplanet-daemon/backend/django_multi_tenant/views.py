# django_multi_tenant/views.py
"""
API views for multi-tenant configuration.
"""

import json
import logging
import re
from pathlib import Path
from typing import Any

from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET, require_http_methods
from django.views.decorators.csrf import csrf_exempt

from django_multi_tenant.middleware.tenant_context import get_current_tenant

logger = logging.getLogger(__name__)

# Validation patterns
HEX_COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")


def _validate_hex_color(value: str) -> bool:
    """Validate hex color format (#RRGGBB)."""
    return bool(HEX_COLOR_PATTERN.match(value))


def _validate_url(value: str | None) -> bool:
    """Basic URL validation - allows relative paths and URLs."""
    if value is None or value == "":
        return True
    if value.startswith("/"):
        return True
    if value.startswith(("http://", "https://")):
        return True
    return False


def _sanitize_string(value: Any, max_length: int = 500) -> str | None:
    """Sanitize string input."""
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    return value.strip()[:max_length]


@csrf_exempt
@require_GET
def tenant_config(request):
    """
    Return current tenant configuration for frontend.

    Response:
    {
        "tenantId": "nantou-gov",
        "name": "南投縣政府",
        "features": {...},
        "theme": {...}
    }
    """
    tenant = get_current_tenant()

    if not tenant:
        # Return default config if no tenant
        return JsonResponse({
            "tenantId": "default",
            "name": "TPlanet AI",
            "features": {
                "ai_secretary": True,
                "nft": True,
            },
            "theme": {
                "primary_color": "#1976d2",
                "secondary_color": "#424242",
            }
        })

    # DB config overrides YAML for editable fields (hosters, departments, etc.)
    from django_multi_tenant.models import TenantConfig
    db_config = TenantConfig.objects.filter(tenant_id=tenant.tenant_id).first()

    return JsonResponse({
        "tenantId": tenant.tenant_id,
        "name": db_config.name if db_config else tenant.name,
        "logoUrl": db_config.logo_url if db_config and db_config.logo_url else tenant.config.get("theme", {}).get("logo_url", ""),
        "brandName": tenant.config.get("brand_name", tenant.name),
        "features": db_config.features if db_config and db_config.features else tenant.config.get("features", {}),
        "theme": {
            **tenant.config.get("theme", {}),
            **({"primary_color": db_config.primary_color, "secondary_color": db_config.secondary_color}
               if db_config and db_config.primary_color else {}),
        },
        "settings": db_config.settings if db_config and db_config.settings else tenant.config.get("settings", {}),
        "hosters": db_config.hosters if db_config and db_config.hosters else tenant.config.get("hosters", []),
        "departments": db_config.departments if db_config and db_config.departments else tenant.config.get("departments", []),
        "superusers": tenant.config.get("superusers", []),
        "districts": tenant.config.get("districts", []),
        "regions": tenant.config.get("regions", {}),
        "socialLinks": tenant.config.get("social_links", {}),
        "privacyUrl": tenant.config.get("privacy_url", ""),
        "kpiBannerUrl": tenant.config.get("kpi_banner_url", ""),
    })


@csrf_exempt
@require_http_methods(["GET", "PUT"])
def admin_config(request: HttpRequest) -> JsonResponse:
    """
    Admin API for editing tenant configuration.

    GET: Returns current editable configuration
    PUT: Updates tenant configuration in database
    """
    tenant = get_current_tenant()
    if not tenant:
        return JsonResponse({"error": "No tenant context"}, status=400)

    from django_multi_tenant.models import TenantConfig

    if request.method == "GET":
        db_config = TenantConfig.objects.filter(tenant_id=tenant.tenant_id).first()
        yaml_config = tenant.config
        theme = yaml_config.get("theme", {})

        return JsonResponse({
            "tenantId": tenant.tenant_id,
            "name": db_config.name if db_config else tenant.name,
            "primaryColor": (
                db_config.primary_color
                if db_config
                else theme.get("primary_color", "#1976d2")
            ),
            "secondaryColor": (
                db_config.secondary_color
                if db_config
                else theme.get("secondary_color", "#424242")
            ),
            "logoUrl": (
                db_config.logo_url
                if db_config
                else theme.get("logo_url")
            ),
            "bannerImage": db_config.banner_image if db_config else None,
            "sectionImages": db_config.section_images if db_config else {},
            "sectionDescriptions": db_config.section_descriptions if db_config else {},
            "features": (
                db_config.features
                if db_config and db_config.features
                else yaml_config.get("features", {})
            ),
            "departments": (
                db_config.departments
                if db_config and db_config.departments
                else yaml_config.get("departments", [])
            ),
            "settings": (
                db_config.settings
                if db_config and db_config.settings
                else yaml_config.get("settings", {})
            ),
            "hosters": (
                db_config.hosters
                if db_config and db_config.hosters
                else yaml_config.get("hosters", [])
            ),
        })

    elif request.method == "PUT":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        # Validate input fields
        errors = []

        if "primaryColor" in data and data["primaryColor"]:
            if not _validate_hex_color(data["primaryColor"]):
                errors.append("primaryColor must be a valid hex color (e.g., #1976d2)")

        if "secondaryColor" in data and data["secondaryColor"]:
            if not _validate_hex_color(data["secondaryColor"]):
                errors.append("secondaryColor must be a valid hex color (e.g., #424242)")

        if "logoUrl" in data:
            if not _validate_url(data["logoUrl"]):
                errors.append("logoUrl must be a relative path or valid URL")

        if "bannerImage" in data:
            if not _validate_url(data["bannerImage"]):
                errors.append("bannerImage must be a relative path or valid URL")

        if "features" in data and not isinstance(data["features"], dict):
            errors.append("features must be an object")

        if "departments" in data and not isinstance(data["departments"], list):
            errors.append("departments must be an array")

        if "settings" in data and not isinstance(data["settings"], dict):
            errors.append("settings must be an object")

        if "hosters" in data:
            if not isinstance(data["hosters"], list):
                errors.append("hosters must be an array of email addresses")
            elif not all(isinstance(h, str) for h in data["hosters"]):
                errors.append("hosters must contain only string values")

        if errors:
            return JsonResponse({"error": "Validation failed", "details": errors}, status=400)

        db_config, created = TenantConfig.objects.get_or_create(
            tenant_id=tenant.tenant_id,
            defaults={"name": tenant.name},
        )

        # Update fields if provided
        if "name" in data:
            db_config.name = _sanitize_string(data["name"], max_length=200) or db_config.name
        if "primaryColor" in data:
            db_config.primary_color = data["primaryColor"]
        if "secondaryColor" in data:
            db_config.secondary_color = data["secondaryColor"]
        if "logoUrl" in data:
            db_config.logo_url = _sanitize_string(data["logoUrl"], max_length=2000)
        if "bannerImage" in data:
            db_config.banner_image = _sanitize_string(data["bannerImage"], max_length=2000)
        if "sectionImages" in data:
            db_config.section_images = data["sectionImages"]
        if "sectionDescriptions" in data:
            db_config.section_descriptions = data["sectionDescriptions"]
        if "features" in data:
            db_config.features = data["features"]
        if "departments" in data:
            db_config.departments = data["departments"]
        if "settings" in data:
            db_config.settings = data["settings"]
        if "hosters" in data:
            db_config.hosters = data["hosters"]

        db_config.save()

        logger.info(f"Updated tenant config: {tenant.tenant_id}")

        return JsonResponse({
            "success": True,
            "message": "Configuration updated",
            "data": db_config.to_dict(),
        })


@csrf_exempt
@require_GET
def tenant_list(request: HttpRequest) -> JsonResponse:
    """
    List all tenants (for admin / superuser).

    Returns merged list from TenantConfig DB + tenants.yml.
    DB entries take priority; YAML-only tenants are included as well.
    Frontend ProtectedRoute handles access control.
    """
    from django_multi_tenant.models import TenantConfig
    from django_multi_tenant.config.loader import TenantConfigLoader

    # 1. DB tenants (active only shown, but track ALL IDs to suppress YAML)
    all_db_ids = set(TenantConfig.objects.values_list("tenant_id", flat=True))
    db_tenants = TenantConfig.objects.filter(is_active=True).order_by("tenant_id")
    result = []

    for t in db_tenants:
        result.append(t.to_dict())

    # 2. YAML tenants not in DB at all (deleted DB tenants stay suppressed)
    try:
        loader = TenantConfigLoader()
        config_path = Path(__file__).resolve().parent.parent / "config" / "tenants.yml"
        loader.load_from_file(config_path)

        for tenant_id, yaml_cfg in loader.tenants.items():
            if tenant_id == "default":
                continue  # system fallback, not manageable
            if tenant_id not in all_db_ids:
                result.append({
                    "tenantId": tenant_id,
                    "name": yaml_cfg.get("name", tenant_id),
                    "database": yaml_cfg.get("database", {}).get("alias", tenant_id),
                    "primaryColor": yaml_cfg.get("theme", {}).get("primary_color", "#1976d2"),
                    "secondaryColor": yaml_cfg.get("theme", {}).get("secondary_color", "#424242"),
                    "features": yaml_cfg.get("features", {}),
                    "hosters": yaml_cfg.get("hosters", []),
                    "isActive": True,
                    "source": "yaml",
                })
    except Exception as e:
        logger.warning(f"Failed to load tenants.yml: {e}")

    result.sort(key=lambda x: x.get("tenantId", ""))

    return JsonResponse({
        "tenants": result,
        "count": len(result),
    })


@csrf_exempt
@require_GET
def validate_tenant_id(request: HttpRequest, tenant_id: str) -> JsonResponse:
    """Check if a tenant ID is available for creation."""
    from django_multi_tenant.models import TenantConfig

    exists = TenantConfig.objects.filter(tenant_id=tenant_id, is_active=True).exists()
    return JsonResponse({
        "tenantId": tenant_id,
        "available": not exists,
    })


@csrf_exempt
@require_http_methods(["POST"])
def tenant_create(request: HttpRequest) -> JsonResponse:
    """
    Create a new tenant.

    Required fields: tenantId, name
    Optional fields: primaryColor, secondaryColor, logoUrl, features, etc.
    """
    from django_multi_tenant.models import TenantConfig

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    # Validate required fields
    tenant_id = data.get("tenantId")
    name = data.get("name")

    if not tenant_id:
        return JsonResponse({"error": "tenantId is required"}, status=400)
    if not name:
        return JsonResponse({"error": "name is required"}, status=400)

    # Validate tenant_id format (alphanumeric + hyphen)
    if not re.match(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", tenant_id) and len(tenant_id) > 2:
        if not re.match(r"^[a-z0-9]+$", tenant_id):
            return JsonResponse({
                "error": "tenantId must be lowercase alphanumeric with hyphens (e.g., my-tenant)"
            }, status=400)

    # Check if tenant already exists
    existing = TenantConfig.objects.filter(tenant_id=tenant_id).first()
    if existing and existing.is_active:
        return JsonResponse({"error": f"Tenant '{tenant_id}' already exists"}, status=400)

    # Validate optional fields
    errors = []
    if "primaryColor" in data and data["primaryColor"]:
        if not _validate_hex_color(data["primaryColor"]):
            errors.append("primaryColor must be a valid hex color")
    if "secondaryColor" in data and data["secondaryColor"]:
        if not _validate_hex_color(data["secondaryColor"]):
            errors.append("secondaryColor must be a valid hex color")

    if errors:
        return JsonResponse({"error": "Validation failed", "details": errors}, status=400)

    # Validate hosters if provided
    hosters = data.get("hosters", [])
    if hosters and not isinstance(hosters, list):
        return JsonResponse({"error": "hosters must be an array"}, status=400)

    if existing and not existing.is_active:
        # Re-activate previously deleted tenant with new data
        existing.name = _sanitize_string(name, max_length=200)
        existing.primary_color = data.get("primaryColor", "#1976d2")
        existing.secondary_color = data.get("secondaryColor", "#424242")
        existing.logo_url = _sanitize_string(data.get("logoUrl"), max_length=2000)
        existing.banner_image = _sanitize_string(data.get("bannerImage"), max_length=2000)
        existing.features = data.get("features", {})
        existing.departments = data.get("departments", [])
        existing.hosters = hosters
        existing.settings = data.get("settings", {})
        existing.is_active = True
        existing.save()
        tenant = existing
        logger.info(f"Re-activated deleted tenant: {tenant_id}")
    else:
        # Create new tenant
        tenant = TenantConfig.objects.create(
            tenant_id=tenant_id,
            name=_sanitize_string(name, max_length=200),
            primary_color=data.get("primaryColor", "#1976d2"),
            secondary_color=data.get("secondaryColor", "#424242"),
            logo_url=_sanitize_string(data.get("logoUrl"), max_length=2000),
            banner_image=_sanitize_string(data.get("bannerImage"), max_length=2000),
            features=data.get("features", {}),
            departments=data.get("departments", []),
            hosters=hosters,
            settings=data.get("settings", {}),
        )
        logger.info(f"Created new tenant: {tenant_id}")

    # Bind tenant -> current env (dev/stable) for deterministic `*.sechome.cc` routing.
    binding = None
    try:
        from django_multi_tenant.tenant_env_router import bind_tenant_to_current_env
        binding = bind_tenant_to_current_env(tenant_id)
    except Exception as e:
        logger.exception("Failed to bind tenant to env router")
        binding = {"ok": False, "error": str(e)}

    return JsonResponse({
        "success": True,
        "message": f"Tenant '{tenant_id}' created",
        "data": tenant.to_dict(),
        "binding": binding,
    }, status=201)


@csrf_exempt
@require_http_methods(["GET", "PUT", "DELETE"])
def tenant_detail(request: HttpRequest, tenant_id: str) -> JsonResponse:
    """
    Get, update, or delete a specific tenant.

    GET: Get tenant details
    PUT: Update tenant
    DELETE: Soft delete tenant (set is_active=False)
    """
    from django_multi_tenant.models import TenantConfig

    # Protect system tenants
    if request.method == "DELETE" and tenant_id in {"default", "multi-tenant"}:
        return JsonResponse(
            {"error": f"Tenant '{tenant_id}' is a protected system tenant and cannot be deleted"},
            status=400,
        )

    # Prevent deleting the tenant you're currently on
    if request.method == "DELETE":
        current_tenant = get_current_tenant()
        if current_tenant and current_tenant.tenant_id == tenant_id:
            return JsonResponse(
                {"error": "無法刪除目前使用中的站台"},
                status=400,
            )

    try:
        tenant = TenantConfig.objects.get(tenant_id=tenant_id)
    except TenantConfig.DoesNotExist:
        # YAML-only tenant — DELETE creates a suppression record, others 404
        if request.method == "DELETE":
            from django_multi_tenant import cloudflare
            cloudflare.delete_subdomain(tenant_id)
            TenantConfig.objects.create(
                tenant_id=tenant_id, name=tenant_id, is_active=False, hosters=[]
            )
            logger.info(f"Deleted YAML-only tenant: {tenant_id}")
            return JsonResponse({
                "success": True,
                "message": f"Tenant '{tenant_id}' deleted",
                "cleaned": ["dns", "db(suppressed)"],
            })
        return JsonResponse({"error": f"Tenant '{tenant_id}' not found"}, status=404)

    if not tenant.is_active and request.method != "DELETE":
        return JsonResponse({"error": f"Tenant '{tenant_id}' has been deleted"}, status=404)

    if request.method == "GET":
        return JsonResponse({"data": tenant.to_dict()})

    elif request.method == "PUT":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        # Update fields
        if "name" in data:
            tenant.name = _sanitize_string(data["name"], max_length=200) or tenant.name
        if "primaryColor" in data:
            if data["primaryColor"] and not _validate_hex_color(data["primaryColor"]):
                return JsonResponse({"error": "Invalid primaryColor"}, status=400)
            tenant.primary_color = data["primaryColor"]
        if "secondaryColor" in data:
            if data["secondaryColor"] and not _validate_hex_color(data["secondaryColor"]):
                return JsonResponse({"error": "Invalid secondaryColor"}, status=400)
            tenant.secondary_color = data["secondaryColor"]
        if "logoUrl" in data:
            tenant.logo_url = _sanitize_string(data["logoUrl"], max_length=2000)
        if "bannerImage" in data:
            tenant.banner_image = _sanitize_string(data["bannerImage"], max_length=2000)
        if "features" in data:
            tenant.features = data["features"]
        if "departments" in data:
            tenant.departments = data["departments"]
        if "settings" in data:
            tenant.settings = data["settings"]
        if "hosters" in data:
            if not isinstance(data["hosters"], list):
                return JsonResponse({"error": "hosters must be an array"}, status=400)
            tenant.hosters = data["hosters"]
        if "isActive" in data:
            tenant.is_active = bool(data["isActive"])

        tenant.save()
        logger.info(f"Updated tenant: {tenant_id}")

        return JsonResponse({
            "success": True,
            "message": "Tenant updated",
            "data": tenant.to_dict(),
        })

    elif request.method == "DELETE":
        from django_multi_tenant import cloudflare

        deleted_resources = []

        # 1. Delete DNS record
        dns_result = cloudflare.delete_subdomain(tenant_id)
        if dns_result.get("success"):
            deleted_resources.append("dns")
        logger.info(f"[{tenant_id}] DNS cleanup: {dns_result.get('message', '')}")

        # 2. Keep global user accounts; only detach tenant hosters mapping.
        # Users can belong to other tenants and should not be deleted here.
        if tenant.hosters:
            deleted_resources.append("hosters(detached)")

        # 3. Soft delete TenantConfig (keeps record to suppress YAML fallback)
        tenant.is_active = False
        tenant.hosters = []
        tenant.save()
        deleted_resources.append("db(deactivated)")
        logger.info(f"Deleted tenant: {tenant_id} — cleaned: {', '.join(deleted_resources)}")

        # Best-effort: remove binding from env router (if configured).
        try:
            from django_multi_tenant.tenant_env_router import unbind_tenant
            unbind_result = unbind_tenant(tenant_id)
            if unbind_result.get("ok"):
                deleted_resources.append("env_router(unbound)")
        except Exception:
            logger.exception("Failed to unbind tenant from env router")

        return JsonResponse({
            "success": True,
            "message": f"Tenant '{tenant_id}' deleted",
            "cleaned": deleted_resources,
        })


@csrf_exempt
@require_http_methods(["POST"])
def upload_image(request: HttpRequest) -> JsonResponse:
    """
    Upload an image file for tenant configuration.

    Accepts multipart/form-data with:
    - file: The image file
    - type: Image type (logo, banner, section)
    - tenant_id: Optional tenant ID for organizing files

    Returns the URL path to the uploaded file.
    """
    import os
    import uuid
    from django.conf import settings

    if "file" not in request.FILES:
        return JsonResponse({"error": "No file provided"}, status=400)

    uploaded_file = request.FILES["file"]
    image_type = request.POST.get("type", "logo")
    tenant_id = request.POST.get("tenant_id", "default")

    # Validate file type
    allowed_types = ["image/png", "image/jpeg", "image/gif", "image/svg+xml", "image/webp"]
    if uploaded_file.content_type not in allowed_types:
        return JsonResponse({
            "error": f"Invalid file type: {uploaded_file.content_type}. Allowed: PNG, JPEG, GIF, SVG, WebP"
        }, status=400)

    # Validate file size (max 5MB)
    max_size = 5 * 1024 * 1024
    if uploaded_file.size > max_size:
        return JsonResponse({
            "error": f"File too large. Maximum size: 5MB"
        }, status=400)

    # Generate unique filename
    ext = os.path.splitext(uploaded_file.name)[1].lower()
    if not ext:
        ext_map = {
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/gif": ".gif",
            "image/svg+xml": ".svg",
            "image/webp": ".webp",
        }
        ext = ext_map.get(uploaded_file.content_type, ".png")

    filename = f"{image_type}-{uuid.uuid4().hex[:8]}{ext}"

    # Create upload directory
    upload_dir = os.path.join(settings.BASE_DIR, "static", "uploads", "tenants", tenant_id)
    os.makedirs(upload_dir, exist_ok=True)

    # Save file
    file_path = os.path.join(upload_dir, filename)
    with open(file_path, "wb+") as destination:
        for chunk in uploaded_file.chunks():
            destination.write(chunk)

    # Return relative URL
    relative_url = f"/static/uploads/tenants/{tenant_id}/{filename}"

    logger.info(f"Uploaded image: {relative_url}")

    return JsonResponse({
        "success": True,
        "url": relative_url,
        "filename": filename,
        "size": uploaded_file.size,
        "contentType": uploaded_file.content_type,
    })


@csrf_exempt
@require_http_methods(["POST"])
def create_subdomain(request: HttpRequest) -> JsonResponse:
    """
    Create a Cloudflare DNS A record for a tenant subdomain.

    POST body: { "subdomain": "tenant-id", "proxied": true }
    """
    from django_multi_tenant import cloudflare

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    subdomain = data.get("subdomain")
    if not subdomain:
        return JsonResponse({"error": "subdomain is required"}, status=400)

    # Validate subdomain format
    if not re.match(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", subdomain) and len(subdomain) > 2:
        if not re.match(r"^[a-z0-9]+$", subdomain):
            return JsonResponse({
                "error": "subdomain must be lowercase alphanumeric with hyphens"
            }, status=400)

    proxied = data.get("proxied", True)

    result = cloudflare.create_subdomain(subdomain, proxied=proxied)

    if result["success"]:
        return JsonResponse(result)
    else:
        return JsonResponse(result, status=400)


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_subdomain(request: HttpRequest, subdomain: str) -> JsonResponse:
    """
    Delete a Cloudflare DNS A record for a tenant subdomain.
    """
    from django_multi_tenant import cloudflare

    result = cloudflare.delete_subdomain(subdomain)

    if result["success"]:
        return JsonResponse(result)
    else:
        return JsonResponse(result, status=400)


@csrf_exempt
@require_GET
def check_subdomain(request: HttpRequest, subdomain: str) -> JsonResponse:
    """
    Check if a subdomain exists in Cloudflare DNS.
    """
    from django_multi_tenant import cloudflare

    record = cloudflare.get_dns_record(subdomain)

    return JsonResponse({
        "exists": record is not None,
        "subdomain": subdomain,
        "domain": cloudflare.CLOUDFLARE_DOMAIN,
        "fullDomain": f"{subdomain}.{cloudflare.CLOUDFLARE_DOMAIN}",
        "record": record,
    })
