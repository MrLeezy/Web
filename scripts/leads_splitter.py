#!/usr/bin/env python3
import argparse
import csv
import json
import os
import sys
from collections import Counter
from datetime import datetime

REMOVE_SOURCES = ["wechat-dsp-xcx", "wechat-dsp", "douyin", "kuaishou", "toutiao"]
KEEP_SOURCE = "wechat-dsp"


def parse_args():
    parser = argparse.ArgumentParser(description="Split leads CSV into two output tables.")
    parser.add_argument("--input", required=True, help="Source CSV path")
    parser.add_argument("--output-dir", required=True, help="Directory for generated CSV files")
    return parser.parse_args()


def extract_date_from_filename(filepath):
    filename = os.path.basename(filepath)
    if "_by_" in filename:
        suffix = filename.split("_by_")[-1]
        return suffix.replace(".csv", "")
    return datetime.now().strftime("%Y%m%d")


def read_csv_rows(filepath):
    with open(filepath, "r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.reader(handle))
    if not rows:
        raise ValueError("CSV 文件为空")
    return rows[0], rows[1:]


def write_csv(filepath, header, rows):
    with open(filepath, "w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)


def main():
    args = parse_args()
    os.makedirs(args.output_dir, exist_ok=True)

    header, data_rows = read_csv_rows(args.input)
    if not header:
        raise ValueError("CSV 表头为空")

    source_counter = Counter()
    for row in data_rows:
        source_counter[row[0] if row else ""] += 1

    table1_rows = [row for row in data_rows if row and row[0] not in REMOVE_SOURCES]
    table2_rows = [row for row in data_rows if row and row[0] == KEEP_SOURCE]

    date_str = extract_date_from_filename(args.input)
    table1_filename = f"leads_form_by_{date_str}#{len(table1_rows)}.csv"
    table2_filename = f"leads_form_by_{date_str}#{len(table2_rows)}-to ouyang.csv"

    write_csv(os.path.join(args.output_dir, table1_filename), header, table1_rows)
    write_csv(os.path.join(args.output_dir, table2_filename), header, table2_rows)

    payload = {
        "total": len(data_rows),
        "table1_count": len(table1_rows),
        "table2_count": len(table2_rows),
        "source_distribution": dict(source_counter),
        "outputs": [
            {
                "key": "table1",
                "label": "Table 1",
                "description": "Removes wechat-dsp-xcx, wechat-dsp, douyin, kuaishou, and toutiao.",
                "filename": table1_filename,
                "count": len(table1_rows),
            },
            {
                "key": "table2",
                "label": "Table 2",
                "description": "Keeps only wechat-dsp for the downstream handoff.",
                "filename": table2_filename,
                "count": len(table2_rows),
            },
        ],
    }
    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
