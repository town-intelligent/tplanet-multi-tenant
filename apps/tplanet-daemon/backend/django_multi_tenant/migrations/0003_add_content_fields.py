"""
Migration to add content-type fields to TenantConfig.

Adds fields previously only editable via tenants.yml so admins can
maintain them through the CMS:

- brand_name        : footer / copyright brand (falls back to name when empty)
- kpi_banner_url    : /kpi page banner image URL
- social_links      : {facebook, youtube, ...}
- privacy_url       : privacy policy URL

Refs: town-intelligent/tplanet-multi-tenant#64
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("django_multi_tenant", "0002_add_hosters"),
    ]

    operations = [
        migrations.AddField(
            model_name="tenantconfig",
            name="brand_name",
            field=models.CharField(
                blank=True,
                default="",
                max_length=200,
                help_text="Footer / copyright brand name (falls back to name when empty)",
            ),
        ),
        migrations.AddField(
            model_name="tenantconfig",
            name="kpi_banner_url",
            field=models.TextField(
                blank=True,
                default="",
                help_text="URL or path to KPI page banner image",
            ),
        ),
        migrations.AddField(
            model_name="tenantconfig",
            name="social_links",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Social media links (JSON object, e.g. {facebook, youtube})",
            ),
        ),
        migrations.AddField(
            model_name="tenantconfig",
            name="privacy_url",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Privacy policy URL shown in footer",
            ),
        ),
    ]
