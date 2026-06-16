from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell
from openpyxl.comments import Comment

from .transformers import BuildStats


def export_workbook(output_path: Path, headers: list[str], rows: list[dict[str, str]], stats: BuildStats) -> None:
    workbook = Workbook(write_only=True)
    data_sheet = workbook.create_sheet(title="master_table")
    data_sheet.freeze_panes = "A2"

    header_cells = []
    for header in headers:
        cell = WriteOnlyCell(data_sheet, value=header)
        header_cells.append(cell)

    summary_lines = []
    for metric, counter in (
        ("input_counts", stats.input_counts),
        ("output_counts", stats.output_counts),
        ("invalid_counts", stats.invalid_counts),
        ("channel_counts", stats.channel_counts),
        ("filtered_counts", stats.filtered_counts),
    ):
        for key, value in sorted(counter.items()):
            summary_lines.append(f"{metric}: {key}={value}")
    if summary_lines:
        header_cells[0].comment = Comment("\n".join(summary_lines), "Codex")

    data_sheet.append(header_cells)

    for row in rows:
        data_sheet.append([row.get(header, "") for header in headers])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    workbook.save(output_path)
