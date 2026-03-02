"""Google Sheet formatting operations for SROI."""
import logging
import pygsheets
from pygsheets.exceptions import WorksheetNotFound
from .config import CREDENTIALS_FILE, SROI_FIELDS, COUNTS_OF_FIELDS

logger = logging.getLogger(__name__)


def update_google_sheet(file_id, obj_project):
    """Update project budget in Google Sheet. Returns None if worksheet not found."""
    gc = pygsheets.authorize(service_file=CREDENTIALS_FILE)
    url = f"https://docs.google.com/spreadsheets/d/{file_id}/edit?usp=sharing"
    sht = gc.open_by_url(url)
    try:
        worksheet = sht.worksheet_by_title("總價值計算")
    except WorksheetNotFound:
        logger.warning("Worksheet '總價值計算' not found in sheet %s, skipping budget update", file_id)
        return None
    worksheet.update_value("B5", obj_project.budget)
    return sht


def set_text_color_red_if_string_found(worksheet, search_string):
    """Set text color to red for cells containing search string."""
    all_cells = worksheet.get_all_values(returnas='matrix')

    for row_index, row in enumerate(all_cells):
        for col_index, value in enumerate(row):
            if search_string in value:
                cell = worksheet.cell((row_index + 1, col_index + 1))
                text_color = {'red': 1, 'green': 0, 'blue': 0}
                cell.text_format["foregroundColorStyle"] = {"rgbColor": text_color}
                cell.text_format["bold"] = True
                cell.update()


def set_specific_color_for_sroi_gsheet(service, list_project_weight, df_sdg_sroi_map, obj_sroi_file_id):
    """Set specific colors for SROI Google Sheet."""
    gc = pygsheets.authorize(service_file=CREDENTIALS_FILE)
    url = f"https://docs.google.com/spreadsheets/d/{obj_sroi_file_id}/edit?usp=sharing"
    sht_sroi = gc.open_by_url(url)

    for index_sroi_field in range(COUNTS_OF_FIELDS):
        str_sheet_title = SROI_FIELDS[index_sroi_field]["sheet_title"]
        try:
            worksheet_sroi_social = sht_sroi.worksheet_by_title(str_sheet_title)
        except WorksheetNotFound:
            logger.warning("Worksheet '%s' not found in sheet %s, skipping color", str_sheet_title, obj_sroi_file_id)
            continue

        for index in range(len(list_project_weight)):
            if list_project_weight[index] != "0":
                for index_face in range(5, 8):
                    cell_value = df_sdg_sroi_map[0].iloc[index + 1, index_face]
                    list_cell = cell_value.split("\n")

                    for str_face in list_cell:
                        if str_face != "":
                            set_text_color_red_if_string_found(worksheet_sroi_social, str_face)

    return True
