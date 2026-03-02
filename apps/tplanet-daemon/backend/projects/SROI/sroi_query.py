"""SROI query operations."""
import copy
import logging
from distutils.util import strtobool
from pygsheets.exceptions import WorksheetNotFound
from projects.models import SROI, Project
from utils.sroi import get_max_width, get_sroi_evidence_identifiers, get_sroi_table_values
from .field import total_value_calculation
from .gsheet import get_google_sheet, get_google_sheet_as_dataframe, update_google_sheet
from .config import SORI_WORKSHEET_MAP, SROI_TYPE_SOCIAL, SROI_TYPE_ECONOMY, SROI_TYPE_ENVIRONMENT, dict_sroi_init

logger = logging.getLogger(__name__)


def _get_project_sroi(project_uuid):
    """Get project and SROI objects, return (project, sroi) or (None, error_msg)."""
    if not Project.objects.filter(uuid=project_uuid).exists():
        return None, {"message": "Project not found"}
    obj_project = Project.objects.get(uuid=project_uuid)
    if not SROI.objects.filter(obj_project=obj_project).exists():
        return None, {"message": "SROI not found"}
    return obj_project, SROI.objects.get(obj_project=obj_project)


def get_sroi_worksheet(manager, project_uuid: str, sroi_type: str):
    """Get SROI worksheet data."""
    if sroi_type not in SORI_WORKSHEET_MAP:
        return False, {"message": "SROI type not found"}

    obj_project, result = _get_project_sroi(project_uuid)
    if obj_project is None:
        return False, result

    worksheet_title = SORI_WORKSHEET_MAP[sroi_type]["sheet_title"]
    try:
        worksheet = get_google_sheet(manager.sroi_file_id).worksheet_by_title(worksheet_title)
    except WorksheetNotFound:
        logger.warning("Worksheet '%s' not found in sheet %s", worksheet_title, manager.sroi_file_id)
        return False, {"message": f"Worksheet '{worksheet_title}' not found"}
    values = get_sroi_table_values(worksheet)

    return {"project_uuid": project_uuid, "file_id": manager.sroi_file_id,
            "worksheet_title": worksheet_title, "values": values, "max_width": get_max_width(values)}


def get_sroi_evidence(manager, project_uuid: str):
    """Get SROI evidence identifiers."""
    obj_project, result = _get_project_sroi(project_uuid)
    if obj_project is None:
        return False, result

    google_sht = get_google_sheet(manager.sroi_file_id)
    return {t: get_sroi_evidence_identifiers(google_sht.worksheet_by_title(SORI_WORKSHEET_MAP[t]["sheet_title"]))
            for t in [SROI_TYPE_SOCIAL, SROI_TYPE_ECONOMY, SROI_TYPE_ENVIRONMENT]}


def get_sroi(manager, req):
    """Get full SROI data."""
    obj_project, result = _get_project_sroi(req["uuid_project"])
    if obj_project is None:
        return False, result

    obj_sroi = SROI.objects.get(obj_project=obj_project)
    dict_sroi = copy.deepcopy(dict_sroi_init)
    dict_sroi["visible"] = obj_sroi.visible
    dict_sroi["file_id"] = manager.sroi_file_id

    sht = update_google_sheet(manager.sroi_file_id, obj_project)
    if sht is None:
        logger.warning("Budget update skipped for project %s (worksheet not found)", req["uuid_project"])
    total_value_calculation(get_google_sheet_as_dataframe(manager.sroi_file_id), dict_sroi)
    return True, dict_sroi


def get_sroi_meta(manager, req):
    """Get SROI metadata."""
    obj_project, result = _get_project_sroi(req["uuid_project"])
    if obj_project is None:
        return False, result

    obj_sroi = SROI.objects.filter(obj_project=obj_project).last()
    sht = update_google_sheet(obj_sroi.file_id, obj_project)
    if sht is None:
        logger.warning("Budget update skipped for project %s (worksheet not found)", req["uuid_project"])
    return True, {"uuid": req["uuid_project"], "file_id": obj_sroi.file_id, "visible": obj_sroi.visible}


def set_visible(manager, req):
    """Set SROI visibility."""
    try:
        obj_project = Project.objects.get(uuid=manager.uuid_project)
        obj_sroi = SROI.objects.get(obj_project=obj_project)
        obj_sroi.visible = bool(strtobool(req["visible"]))
        obj_sroi.save()
        return True, {"visible": obj_sroi.visible, "file_id": obj_sroi.file_id}
    except Exception as e:
        return False, {"message": str(e)}
