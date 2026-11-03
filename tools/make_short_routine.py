#!/usr/bin/env python3
"""Make a shorter week-block routine CSV from a longer one, with the same rules as the app's
"Make shorter" button (see compress.py).

    python3 tools/make_short_routine.py templates/bcs-4-month.csv 56 templates/bcs-2-month.csv
"""
import csv
import io
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
os.environ.setdefault("ROUTINE_DATA", tempfile.mkdtemp())   # importing server opens a database
import compress  # noqa: E402
import server  # noqa: E402


def main():
    if len(sys.argv) < 4:
        sys.exit(__doc__.strip())
    src, days, dst = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    title = sys.argv[4] if len(sys.argv) > 4 else ""
    with open(src, encoding="utf-8-sig") as f:
        text = f.read()
    t = server.parse_template(text)
    # the subjects with their own column every week = the names in the first "Day" header row
    head = next(r for r in csv.reader(io.StringIO(text)) if r and r[0].strip().lower() == "day")
    names = [c.strip() for c in head[2:] if c.strip()]
    cols = [k for k, n in t["SNAME"].items() if n in names]
    st = {"P": t["P"], "WT": t["WT"], "SUBJ": t["SUBJ"], "SNAME": t["SNAME"], "done": []}
    new, stats = compress.compress_state(st, days)
    weeks = new["nw"]
    title = title or "BCS Daily - %d দিনের সময়সূচি (%d সপ্তাহ, %s থেকে ছোট করা)" % (days, weeks, os.path.basename(src))
    with open(dst, "w", encoding="utf-8") as f:
        f.write(compress.to_week_csv(new, title, cols))
    print(dst, stats)


if __name__ == "__main__":
    main()
