#!/usr/bin/env python3
"""Copy book page numbers ("pg") from the routine templates into routines that already exist.

A topic gets the page of the template topic with the same subject name and text: first one on
the same original week and day, otherwise any one, as long as all such topics share one page.
Only topics without a page are touched. Each changed project gets a new revision, so an open
app reloads it instead of saving over it.

    python3 tools/fill_pages.py            # show what would change
    python3 tools/fill_pages.py --apply    # change data/routine.db (copy it first)
"""
import json
import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server  # noqa: E402


def index():
    exact, loose = {}, {}
    for kind in server.TEMPLATES:
        t = server.template(kind)
        for p in t["P"]:
            if not p.get("pg"):
                continue
            name = t["SNAME"].get(p["s"], "")
            exact.setdefault((kind, p["w"], p["d"], name, p["t"]), p["pg"])
            loose.setdefault((name, p["t"]), set()).add(p["pg"])
    return exact, loose


def fill(st, exact, loose):
    n = 0
    for p in st.get("P", []):
        if p.get("pg"):
            continue
        name = st.get("SNAME", {}).get(p["s"], "")
        pg = ""
        for kind in server.TEMPLATES:
            pg = exact.get((kind, p.get("ow", p["w"]), p.get("od", p["d"]), name, p["t"]), "")
            if pg:
                break
        if not pg and len(loose.get((name, p["t"]), ())) == 1:
            pg = next(iter(loose[(name, p["t"])]))
        if pg:
            p["pg"] = pg
            n += 1
    return n


def main():
    apply = "--apply" in sys.argv
    exact, loose = index()
    con = sqlite3.connect(os.path.join(server.DATA_DIR, "routine.db"))
    for pid, name, rev, data in con.execute("SELECT id, name, rev, data FROM projects").fetchall():
        st = json.loads(data)
        n = fill(st, exact, loose)
        print("%s (#%d): %d of %d topics get a page" % (name, pid, n, len(st.get("P", []))))
        if apply and n:
            con.execute("UPDATE projects SET data=?, rev=?, updated=? WHERE id=?",
                        (json.dumps(st, ensure_ascii=False), rev + 1, server.now_iso(), pid))
    if apply:
        con.commit()
    else:
        print("(nothing changed - run with --apply)")


if __name__ == "__main__":
    main()
