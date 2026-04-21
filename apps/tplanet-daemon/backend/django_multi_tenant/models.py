"""
TenantConfig model for database-stored tenant configuration.

Provides editable tenant settings that override YAML defaults.
"""

from django.db import models


class TenantConfig(models.Model):
    """
    Database-stored tenant configuration.

    Overrides YAML configuration when values are set.
    Domain/database settings remain in YAML (infrastructure config).
    """

    tenant_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Unique tenant identifier (matches YAML tenant key)",
    )
    name = models.CharField(
        max_length=200,
        help_text="Display name for the tenant",
    )
    brand_name = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="Footer / copyright brand name (falls back to name when empty)",
    )

    # Theme
    logo_url = models.TextField(
        blank=True,
        null=True,
        help_text="URL or path to tenant logo",
    )
    primary_color = models.CharField(
        max_length=7,
        default="#1976d2",
        help_text="Primary theme color (hex format)",
    )
    secondary_color = models.CharField(
        max_length=7,
        default="#424242",
        help_text="Secondary theme color (hex format)",
    )

    # Content
    banner_image = models.TextField(
        blank=True,
        null=True,
        help_text="URL or path to banner image",
    )
    section_images = models.JSONField(
        default=dict,
        blank=True,
        help_text="Section-specific images (JSON object)",
    )
    section_descriptions = models.JSONField(
        default=dict,
        blank=True,
        help_text="Section-specific descriptions (JSON object)",
    )
    kpi_banner_url = models.TextField(
        blank=True,
        default="",
        help_text="URL or path to KPI page banner image",
    )
    social_links = models.JSONField(
        default=dict,
        blank=True,
        help_text="Social media links (JSON object, e.g. {facebook, youtube})",
    )
    privacy_url = models.TextField(
        blank=True,
        default="",
        help_text="Privacy policy URL shown in footer",
    )

    # Settings
    features = models.JSONField(
        default=dict,
        blank=True,
        help_text="Feature flags (JSON object)",
    )
    departments = models.JSONField(
        default=list,
        blank=True,
        help_text="Department list (JSON array)",
    )
    settings = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional settings (JSON object)",
    )
    hosters = models.JSONField(
        default=list,
        blank=True,
        help_text="Site hosters list (JSON array). hosters[0]=admin, hosters[1:]=members",
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this config is active",
    )

    class Meta:
        db_table = "tenant_config"
        verbose_name = "Tenant Configuration"
        verbose_name_plural = "Tenant Configurations"
        ordering = ["tenant_id"]

    def __str__(self):
        return f"{self.name} ({self.tenant_id})"

    def to_dict(self):
        """Convert to dictionary for API responses."""
        return {
            "tenantId": self.tenant_id,
            "name": self.name,
            "brandName": self.brand_name or "",
            "logoUrl": self.logo_url,
            "primaryColor": self.primary_color,
            "secondaryColor": self.secondary_color,
            "bannerImage": self.banner_image,
            "sectionImages": self.section_images or {},
            "sectionDescriptions": self.section_descriptions or {},
            "kpiBannerUrl": self.kpi_banner_url or "",
            "socialLinks": self.social_links or {},
            "privacyUrl": self.privacy_url or "",
            "features": self.features or {},
            "departments": self.departments or [],
            "settings": self.settings or {},
            "hosters": self.hosters or [],
            "isActive": self.is_active,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def from_yaml_config(cls, tenant_id: str, yaml_config: dict) -> "TenantConfig":
        """Create a TenantConfig instance from YAML config (for sync)."""
        theme = yaml_config.get("theme", {})
        return cls(
            tenant_id=tenant_id,
            name=yaml_config.get("name", tenant_id),
            brand_name=yaml_config.get("brand_name", "") or "",
            logo_url=theme.get("logo_url"),
            primary_color=theme.get("primary_color", "#1976d2"),
            secondary_color=theme.get("secondary_color", "#424242"),
            kpi_banner_url=yaml_config.get("kpi_banner_url", "") or "",
            social_links=yaml_config.get("social_links", {}) or {},
            privacy_url=yaml_config.get("privacy_url", "") or "",
            features=yaml_config.get("features", {}),
            departments=yaml_config.get("departments", []),
            settings=yaml_config.get("settings", {}),
        )
