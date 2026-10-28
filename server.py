#!/usr/bin/env python3
"""Routine - study routine tracker.

Python standard library only (no pip install needed).

Run on your computer:   python3 server.py            -> http://127.0.0.1:8765
Let a phone on the same Wi-Fi open it:   python3 server.py --host 0.0.0.0
Host it for free: any WSGI host (e.g. PythonAnywhere) - point it at `application`
in this file (see wsgi.py and README.md).

Data: one SQLite file (data/routine.db). A user has one or more projects (routines);
each project is stored as one JSON document. The browser app does the routine logic,
the server stores it and gives the admin a progress summary of every project.
"""
import argparse
import copy
import csv
import datetime as dt
import hashlib
import hmac
import io
import json
import mimetypes
import os
import re
import secrets
import sqlite3
from socketserver import ThreadingMixIn
from wsgiref.simple_server import WSGIRequestHandler, WSGIServer, make_server

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("ROUTINE_DATA", os.path.join(BASE, "data"))
DB_PATH = os.path.join(DATA_DIR, "routine.db")
STATIC = os.path.join(BASE, "static")
TEMPLATE_CSV = os.environ.get("ROUTINE_TEMPLATE", os.path.join(BASE, "templates", "bcs-4-month.csv"))
TEMPLATE_NAME = os.environ.get("ROUTINE_TEMPLATE_NAME", "BCS Daily - ৪ মাসের রুটিন")
# Minutes east of UTC used for "today" on the server (admin summaries). Bangladesh = +6h.
TZ_MIN = int(os.environ.get("ROUTINE_TZ_OFFSET", "360"))
MAX_BODY = 8 * 1024 * 1024


# ---------------------------------------------------------------- database
def db():
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    with db() as con:
        con.execute("PRAGMA journal_mode=WAL")
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS users(
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              phone TEXT UNIQUE NOT NULL,
              name TEXT NOT NULL,
              is_admin INTEGER NOT NULL DEFAULT 0,
              created TEXT NOT NULL,
              last_seen TEXT);
            CREATE TABLE IF NOT EXISTS sessions(
              token TEXT PRIMARY KEY,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              created TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS projects(
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              name TEXT NOT NULL,
              created TEXT NOT NULL,
              rev INTEGER NOT NULL DEFAULT 1,
              data TEXT NOT NULL,
              updated TEXT NOT NULL);
            """
        )
        cols = {r["name"] for r in con.execute("PRAGMA table_info(users)")}
        if "prefs" not in cols:
            con.execute("ALTER TABLE users ADD COLUMN prefs TEXT")
        if "active_project" not in cols:
            con.execute("ALTER TABLE users ADD COLUMN active_project INTEGER")
        # PIN login: accounts made before PINs have none and set one at their next login;
        # they were all usable, so they start approved
        if "pin" not in cols:
            con.execute("ALTER TABLE users ADD COLUMN pin TEXT")
        if "approved" not in cols:
            con.execute("ALTER TABLE users ADD COLUMN approved INTEGER NOT NULL DEFAULT 1")
        if "pin_fails" not in cols:
            con.execute("ALTER TABLE users ADD COLUMN pin_fails INTEGER NOT NULL DEFAULT 0")
        if "locked_until" not in cols:
            con.execute("ALTER TABLE users ADD COLUMN locked_until TEXT")
        if "pin_temp" not in cols:
            con.execute("ALTER TABLE users ADD COLUMN pin_temp INTEGER NOT NULL DEFAULT 0")
        if "blocked" not in cols:
            con.execute("ALTER TABLE users ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0")
        scols = {r["name"] for r in con.execute("PRAGMA table_info(sessions)")}
        if "last_used" not in scols:
            con.execute("ALTER TABLE sessions ADD COLUMN last_used TEXT")
        if "agent" not in scols:
            con.execute("ALTER TABLE sessions ADD COLUMN agent TEXT")
        # earlier versions kept one routine per user in `states`: turn each into a project
        if con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='states'").fetchone():
            for r in con.execute("SELECT s.* FROM states s WHERE NOT EXISTS "
                                 "(SELECT 1 FROM projects p WHERE p.user_id=s.user_id)").fetchall():
                st = json.loads(r["data"])
                prefs = st.pop("SET", None)
                cur = con.execute("INSERT INTO projects(user_id,name,created,rev,data,updated) VALUES(?,?,?,?,?,?)",
                                  (r["user_id"], TEMPLATE_NAME, r["updated"], 1, json.dumps(st, ensure_ascii=False), r["updated"]))
                con.execute("UPDATE users SET active_project=?, prefs=COALESCE(prefs,?) WHERE id=?",
                            (cur.lastrowid, json.dumps(prefs or {}, ensure_ascii=False), r["user_id"]))
            con.execute("DROP TABLE states")


def now_iso():
    return dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def server_today():
    return (dt.datetime.utcnow() + dt.timedelta(minutes=TZ_MIN)).date()


# ---------------------------------------------------------------- routine template (CSV -> state)
PRIORITY = re.compile(r"\s*\[(high|medium|low)\]\s*$", re.I)
WEEK_ROW = re.compile(r"^\s*(?:সপ্তাহ|week)\s*[0-9০-৯]+", re.I)
DAY_ROW = re.compile(r"^\s*day\s*([0-9০-৯]+)\s*$", re.I)
BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")


def parse_template(text):
    """Read the week-block routine CSV: a row "সপ্তাহ N (মাস M) - Subject - part", a "Day"
    header row naming the columns, then "Day 1..7" rows. The first column holds the week's
    own subject (the part of the week title before " - "); the other columns are subjects
    named by the header. A cell may hold several topics separated by "|"; a trailing
    "[High]" / "[Medium]" / "[Low]" is the priority."""
    rows = list(csv.reader(io.StringIO(text.lstrip("﻿"))))
    name, wt, tasks = "", {}, []
    keys, week_subj, col_keys = {}, {}, []   # subject name -> key, week -> key
    week_names, col_names, cols = [], [], None

    def key_for(n):
        if n not in keys:
            keys[n] = "s%d" % (len(keys) + 1)
        return keys[n]

    # first pass: subjects in a stable order - week subjects first, then the column subjects
    for r in rows:
        first = (r[0] if r else "").strip()
        if WEEK_ROW.match(first):
            full = ", ".join(c.strip() for c in r if c.strip())
            title = full.split(" - ", 1)[1].strip() if " - " in full else full
            week_names.append(title.split(" - ")[0].strip() or title)
        elif first.lower() == "day" and not col_names:
            col_names = [c.strip() for c in r[2:] if c.strip()]
    for n in week_names + col_names:
        key_for(n)

    week = 0
    for r in rows:
        cells = [c.strip() for c in r]
        if not any(cells):
            continue
        first = cells[0]
        if WEEK_ROW.match(first):
            week += 1
            full = ", ".join(c for c in cells if c)
            wt[str(week)] = full.split(" - ", 1)[1].strip() if " - " in full else full
            week_subj[week] = keys[week_names[week - 1]]
            continue
        if first.lower() == "day":
            cols = [c for c in cells[1:] if c]
            col_keys = [None] + [key_for(c) for c in cols[1:]]
            continue
        m = DAY_ROW.match(first)
        if m and cols and week:
            d = int(m.group(1).translate(BN_DIGITS))
            for ci, cell in enumerate(cells[1: 1 + len(cols)]):
                s = week_subj[week] if ci == 0 else col_keys[ci]
                for part in cell.split("|"):
                    part = part.strip()
                    if not part:
                        continue
                    pm = PRIORITY.search(part)
                    tasks.append({
                        "id": len(tasks) + 1, "w": week, "d": d, "s": s,
                        "t": PRIORITY.sub("", part).strip(),
                        "p": pm.group(1).capitalize() if pm else "",
                        "ow": week, "od": d, "arch": False, "from": "",
                    })
            continue
        if not name and not week:
            name = first
    return {"name": name, "WT": wt, "SUBJ": [[k] for k in keys.values()],
            "SNAME": {k: n for n, k in keys.items()}, "P": tasks, "nw": max(1, week)}


_TEMPLATE = None


def template():
    global _TEMPLATE
    if _TEMPLATE is None:
        try:
            with open(TEMPLATE_CSV, encoding="utf-8-sig") as f:
                _TEMPLATE = parse_template(f.read())
        except OSError:
            _TEMPLATE = {"name": "", "WT": {}, "SUBJ": [], "SNAME": {}, "P": [], "nw": 1}
    return _TEMPLATE


def new_state(start, empty=False):
    t = {"name": "", "WT": {}, "SUBJ": [], "SNAME": {}, "P": [], "nw": 1} if empty else copy.deepcopy(template())
    return {
        "v": 2, "PNAME": t["name"], "P": t["P"], "uid": len(t["P"]), "done": [], "START": start,
        "notes": {}, "TG": 10, "TGD": {}, "HR": {}, "revs": [], "rid": 0, "LAD": [1, 3, 7, 14, 30],
        "refl": [], "R": [], "RM": [], "FOC": [], "fid": 0, "pin": [], "SUBJ": t["SUBJ"],
        "SNAME": t["SNAME"], "WT": t["WT"], "nw": t["nw"], "SEC": {}, "HRC": {}, "closed": {},
    }


# ---------------------------------------------------------------- progress summary
def summarize(st, today=None):
    today = today or server_today()
    try:
        start = dt.date.fromisoformat(st.get("START") or "")
    except ValueError:
        start = today
    co = max(1, (today - start).days + 1)
    ordf = lambda p: (p["w"] - 1) * 7 + p["d"]
    tasks = [p for p in st.get("P", []) if not p.get("arch")]
    done = set(st.get("done", []))
    pct = lambda a: round(100 * sum(1 for p in a if p["id"] in done) / len(a)) if a else 0
    hr, tgd, tg = st.get("HR", {}), st.get("TGD", {}), st.get("TG", 10)
    hrs = lambda o: hr.get(str(o), 0)
    tgt = lambda o: tgd.get(str(o), tg)
    o, streak = co, 0
    if hrs(o) < tgt(o):
        o -= 1
    while o >= 1 and hrs(o) >= tgt(o):
        streak, o = streak + 1, o - 1
    today_tasks = [p for p in tasks if ordf(p) == co]
    own_today = [f for f in st.get("FOC", []) if f.get("o") == co]
    upto = [p for p in tasks if ordf(p) <= co]
    sec = st.get("SEC", {})
    week = range(max(1, co - 6), co + 1)
    fg = st.get("FGD", {})
    away = sum(fg.get(str(x), {}).get("sec", 0) for x in week)
    studied = sum(sec.get(str(x), 0) for x in week)
    smin = st.get("SMIN") or {}
    est = lambda p: p.get("est") or smin.get(p["s"], 0) or 0
    return {
        "day": co, "started": (today - start).days >= 0, "start": start.isoformat(),
        "plan_len": max([co] + [ordf(p) for p in tasks]),
        "overall": pct(tasks), "on_track": pct(upto),
        "done": sum(1 for p in tasks if p["id"] in done), "total": len(tasks),
        # today = routine topics + own to-dos of the day
        "today_done": sum(1 for p in today_tasks if p["id"] in done) + sum(1 for f in own_today if f.get("done")),
        "today_total": len(today_tasks) + len(own_today),
        "pending": sum(1 for p in tasks if ordf(p) < co and p["id"] not in done),
        "hours_today": hrs(co), "target": tgt(co),
        "hours_7d": sum(hrs(x) for x in range(max(1, co - 6), co + 1)),
        "logged_min_today": int(sec.get(str(co), 0) // 60),
        "logged_min_7d": int(sum(sec.get(str(x), 0) for x in range(max(1, co - 6), co + 1)) // 60),
        "streak": streak,
        # focus guard, last 7 days: share of timer time spent in the app, times left, sessions broken
        "focus_7d": round(100 * studied / (studied + away)) if away and studied + away > 0 else (100 if studied else None),
        "leaves_7d": sum(fg.get(str(x), {}).get("n", 0) for x in week),
        "away_min_7d": int(away // 60),
        "broken_7d": sum(fg.get(str(x), {}).get("b", 0) for x in week),
        # planned minutes (topic estimate or its subject's default)
        "plan_min_today": sum(est(p) for p in today_tasks) + sum(f.get("est") or 0 for f in st.get("FOC", []) if f.get("o") == co),
        "plan_min_7d": sum(est(p) for p in tasks if co - 6 <= ordf(p) <= co),
    }


# ---------------------------------------------------------------- http helpers
class HTTPError(Exception):
    def __init__(self, status, error, extra=None):
        super().__init__(error)
        self.status, self.error, self.extra = status, error, extra or {}


STATUS = {200: "200 OK", 201: "201 Created", 400: "400 Bad Request", 401: "401 Unauthorized",
          403: "403 Forbidden", 404: "404 Not Found", 405: "405 Method Not Allowed",
          409: "409 Conflict", 413: "413 Payload Too Large", 429: "429 Too Many Requests",
          500: "500 Internal Server Error"}


def read_json(environ):
    try:
        n = int(environ.get("CONTENT_LENGTH") or 0)
    except ValueError:
        n = 0
    if n > MAX_BODY:
        raise HTTPError(413, "too_large")
    raw = environ["wsgi.input"].read(n) if n else b""
    if not raw:
        return {}
    try:
        return json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise HTTPError(400, "bad_json")


def norm_phone(raw):
    d = re.sub(r"\D", "", str(raw or "").translate(BN_DIGITS))
    if d.startswith("880") and len(d) == 13:
        d = "0" + d[3:]
    elif len(d) == 10 and d.startswith("1"):
        d = "0" + d
    if not 6 <= len(d) <= 15:
        raise HTTPError(400, "bad_phone")
    return d


PIN_RE = re.compile(r"^[0-9]{4,6}$")
PIN_TRIES, PIN_LOCK_MIN = 5, 15


def valid_pin(raw):
    pin = str(raw or "").translate(BN_DIGITS).strip()
    if not PIN_RE.match(pin):
        raise HTTPError(400, "bad_pin_format")
    return pin


def hash_pin(pin):
    salt = secrets.token_hex(16)
    return "%s$%s" % (salt, hashlib.pbkdf2_hmac("sha256", pin.encode(), salt.encode(), 200000).hex())


def pin_ok(stored, pin):
    salt, _, h = (stored or "").partition("$")
    return bool(h) and hmac.compare_digest(
        h, hashlib.pbkdf2_hmac("sha256", pin.encode(), salt.encode(), 200000).hex())


def check_pin(con, u, pin):
    """Count wrong PINs; after PIN_TRIES the account is locked for PIN_LOCK_MIN minutes. The count
    lives in SQL and is re-read after the (slow) hash check, so guesses sent in parallel stop at the
    lock too. It is committed before raising, since an error rolls the transaction back."""
    now = now_iso()
    if u["locked_until"] and u["locked_until"] > now:
        raise HTTPError(429, "locked", {"until": u["locked_until"]})
    if u["locked_until"]:  # an old lock has run out: fresh tries
        con.execute("UPDATE users SET pin_fails=0, locked_until=NULL WHERE id=? AND locked_until<=?", (u["id"], now))
        con.commit()
    ok = pin_ok(u["pin"], pin)
    con.execute("UPDATE users SET pin_fails=pin_fails+? WHERE id=?", (0 if ok else 1, u["id"]))
    fails, lock = con.execute("SELECT pin_fails, locked_until FROM users WHERE id=?", (u["id"],)).fetchone()
    if lock and lock > now_iso():  # locked by another request meanwhile
        con.commit()
        raise HTTPError(429, "locked", {"until": lock})
    if ok:
        con.execute("UPDATE users SET pin_fails=0 WHERE id=?", (u["id"],))
        return
    if fails >= PIN_TRIES:
        lock = (dt.datetime.utcnow() + dt.timedelta(minutes=PIN_LOCK_MIN)).replace(microsecond=0).isoformat() + "Z"
        con.execute("UPDATE users SET locked_until=? WHERE id=?", (lock, u["id"]))
        con.commit()
        raise HTTPError(429, "locked", {"until": lock})
    con.commit()
    raise HTTPError(401, "bad_pin", {"left": PIN_TRIES - fails})


def temp_pin():
    """A one-time PIN the admin passes on (new user or PIN reset); the user should change it."""
    return "%06d" % secrets.randbelow(10 ** 6)


def user_json(u):
    try:
        prefs = json.loads(u["prefs"] or "{}")
    except ValueError:
        prefs = {}
    return {"id": u["id"], "phone": u["phone"], "name": u["name"], "is_admin": bool(u["is_admin"]),
            "created": u["created"], "last_seen": u["last_seen"], "prefs": prefs,
            "active_project": u["active_project"], "approved": bool(u["approved"]), "has_pin": bool(u["pin"]),
            "blocked": bool(u["blocked"]), "pin_temp": bool(u["pin_temp"])}


def valid_day(s):
    try:
        return dt.date.fromisoformat(str(s)).isoformat()
    except ValueError:
        return server_today().isoformat()


def new_session(con, uid, environ=None):
    token = secrets.token_urlsafe(32)
    con.execute("INSERT INTO sessions(token,user_id,created,last_used,agent) VALUES(?,?,?,?,?)",
                (token, uid, now_iso(), now_iso(), device_name((environ or {}).get("HTTP_USER_AGENT", ""))))
    return token


def device_name(ua):
    """A short label like "Chrome · Android" from a User-Agent string."""
    br = next((n for k, n in (("Edg/", "Edge"), ("OPR/", "Opera"), ("SamsungBrowser", "Samsung Internet"),
                              ("Firefox/", "Firefox"), ("Chrome/", "Chrome"), ("Safari/", "Safari")) if k in ua), "")
    os_ = next((n for k, n in (("Android", "Android"), ("iPhone", "iPhone"), ("iPad", "iPad"), ("Windows", "Windows"),
                               ("Mac OS", "Mac"), ("Linux", "Linux")) if k in ua), "")
    return " · ".join(x for x in (br, os_) if x) or "Unknown device"


def session_list(con, uid, current=None):
    return [{"device": r["agent"] or "Unknown device", "created": r["created"],
             "last_used": r["last_used"] or r["created"], "current": r["token"] == current}
            for r in con.execute("SELECT * FROM sessions WHERE user_id=? ORDER BY COALESCE(last_used,created) DESC",
                                 (uid,)).fetchall()]


def bearer(environ):
    h = environ.get("HTTP_AUTHORIZATION", "")
    return h[7:].strip() if h.lower().startswith("bearer ") else ""


def add_project(con, uid, name, state):
    cur = con.execute("INSERT INTO projects(user_id,name,created,rev,data,updated) VALUES(?,?,?,?,?,?)",
                      (uid, name, now_iso(), 1, json.dumps(state, ensure_ascii=False), now_iso()))
    con.execute("UPDATE users SET active_project=? WHERE id=?", (cur.lastrowid, uid))
    return cur.lastrowid


def create_user(con, phone, name, today, lang, pin=None, approved=True):
    name = (name or "").strip()[:60]
    if not name:
        raise HTTPError(400, "name_required")
    if con.execute("SELECT 1 FROM users WHERE phone=?", (phone,)).fetchone():
        raise HTTPError(409, "phone_exists")
    first = con.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
    cur = con.execute("INSERT INTO users(phone,name,is_admin,created,last_seen,prefs,pin,approved) VALUES(?,?,?,?,?,?,?,?)",
                      (phone, name, 1 if first else 0, now_iso(), None, json.dumps({"lang": lang}),
                       hash_pin(pin) if pin else None, 1 if first or approved else 0))
    add_project(con, cur.lastrowid, TEMPLATE_NAME, new_state(today))
    return con.execute("SELECT * FROM users WHERE id=?", (cur.lastrowid,)).fetchone()


def auth(con, environ, admin=False):
    token = bearer(environ)
    row = con.execute("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?",
                      (token,)).fetchone() if token else None
    if not row or not row["approved"] or row["blocked"]:
        raise HTTPError(401, "login_required")
    if admin and not row["is_admin"]:
        raise HTTPError(403, "admin_only")
    con.execute("UPDATE users SET last_seen=? WHERE id=?", (now_iso(), row["id"]))
    con.execute("UPDATE sessions SET last_used=? WHERE token=?", (now_iso(), token))
    return row


def project_row(con, pid, uid=None):
    row = con.execute("SELECT * FROM projects WHERE id=?" + (" AND user_id=?" if uid else ""),
                      (pid, uid) if uid else (pid,)).fetchone()
    if not row:
        raise HTTPError(404, "not_found")
    return row


def project_list(con, uid):
    out = []
    for r in con.execute("SELECT * FROM projects WHERE user_id=? ORDER BY id", (uid,)).fetchall():
        out.append({"id": r["id"], "name": r["name"], "created": r["created"], "updated": r["updated"],
                    "summary": summarize(json.loads(r["data"]))})
    return out


def int_part(s):
    try:
        return int(s)
    except (TypeError, ValueError):
        raise HTTPError(404, "not_found")


# ---------------------------------------------------------------- API
def api(method, path, environ):
    parts = [p for p in path.split("/") if p]
    with db() as con:
        con.execute("PRAGMA foreign_keys=ON")
        if parts == ["health"]:
            return 200, {"ok": True}

        if parts == ["login"] and method == "POST":
            body = read_json(environ)
            u = con.execute("SELECT * FROM users WHERE phone=?", (norm_phone(body.get("phone")),)).fetchone()
            if not u:
                raise HTTPError(404, "not_found")
            if not u["approved"]:
                raise HTTPError(403, "pending_approval")
            if u["blocked"]:
                raise HTTPError(403, "blocked")
            if not u["pin"]:
                # an account from before PINs: it may pick one here only while it is logged in nowhere;
                # otherwise the PIN is set in Settings on a logged-in device (or the admin resets it)
                if con.execute("SELECT 1 FROM sessions WHERE user_id=?", (u["id"],)).fetchone():
                    raise HTTPError(403, "pin_from_settings")
                if not body.get("new_pin"):
                    raise HTTPError(409, "pin_setup")
                con.execute("UPDATE users SET pin=?, pin_fails=0, locked_until=NULL WHERE id=?",
                            (hash_pin(valid_pin(body["new_pin"])), u["id"]))
            else:
                check_pin(con, u, str(body.get("pin") or "").translate(BN_DIGITS).strip())
            u = con.execute("SELECT * FROM users WHERE id=?", (u["id"],)).fetchone()
            return 200, {"token": new_session(con, u["id"], environ), "user": user_json(u)}

        if parts == ["register"] and method == "POST":
            body = read_json(environ)
            u = create_user(con, norm_phone(body.get("phone")), body.get("name"),
                            valid_day(body.get("today")), body.get("lang") or "en",
                            pin=valid_pin(body.get("pin")), approved=False)
            if not u["approved"]:
                return 201, {"pending": True}
            return 201, {"token": new_session(con, u["id"], environ), "user": user_json(u)}

        me = auth(con, environ)
        if parts == ["me"]:
            out = {"user": user_json(me)}
            if me["is_admin"]:
                out["waiting"] = con.execute("SELECT COUNT(*) FROM users WHERE approved=0").fetchone()[0]
            return 200, out
        if parts == ["pin"] and method == "POST":
            body = read_json(environ)
            new = valid_pin(body.get("new"))
            if me["pin"]:
                check_pin(con, me, str(body.get("old") or "").translate(BN_DIGITS).strip())
            con.execute("UPDATE users SET pin=?, pin_temp=0 WHERE id=?", (hash_pin(new), me["id"]))
            # other devices log out; this one stays in
            con.execute("DELETE FROM sessions WHERE user_id=? AND token<>?", (me["id"], bearer(environ)))
            return 200, {"ok": True}
        if parts == ["logout"] and method == "POST":
            con.execute("DELETE FROM sessions WHERE token=?", (bearer(environ),))
            return 200, {"ok": True}
        if parts == ["sessions"] and method == "GET":
            return 200, {"sessions": session_list(con, me["id"], bearer(environ))}
        if parts == ["sessions", "others"] and method == "DELETE":
            con.execute("DELETE FROM sessions WHERE user_id=? AND token<>?", (me["id"], bearer(environ)))
            return 200, {"ok": True}
        if parts == ["prefs"] and method == "PUT":
            prefs = read_json(environ).get("prefs")
            if not isinstance(prefs, dict):
                raise HTTPError(400, "prefs_required")
            con.execute("UPDATE users SET prefs=? WHERE id=?", (json.dumps(prefs, ensure_ascii=False), me["id"]))
            return 200, {"ok": True}
        if parts == ["template"] and method == "GET":
            qs = dict(p.split("=", 1) for p in environ.get("QUERY_STRING", "").split("&") if "=" in p)
            return 200, {"state": new_state(valid_day(qs.get("today")))}

        # ---- projects (each one is a routine)
        if parts == ["projects"] and method == "GET":
            return 200, {"projects": project_list(con, me["id"]), "active": me["active_project"]}
        if parts == ["projects"] and method == "POST":
            body = read_json(environ)
            name = (body.get("name") or "").strip()[:80]
            if not name:
                raise HTTPError(400, "name_required")
            st = new_state(valid_day(body.get("start")), empty=body.get("source") != "template")
            pid = add_project(con, me["id"], name, st)
            return 201, {"id": pid, "name": name, "rev": 1, "state": st}
        if parts[:1] == ["projects"] and len(parts) >= 2:
            pid = int_part(parts[1])
            row = project_row(con, pid, me["id"])
            if len(parts) == 2 and method == "GET":
                con.execute("UPDATE users SET active_project=? WHERE id=?", (pid, me["id"]))
                return 200, {"id": pid, "name": row["name"], "rev": row["rev"], "state": json.loads(row["data"])}
            if len(parts) == 2 and method == "PUT":
                body = read_json(environ)
                if not isinstance(body.get("state"), dict):
                    raise HTTPError(400, "state_required")
                if body.get("rev") != row["rev"]:
                    raise HTTPError(409, "conflict", {"rev": row["rev"], "state": json.loads(row["data"])})
                con.execute("UPDATE projects SET rev=?,data=?,updated=? WHERE id=?",
                            (row["rev"] + 1, json.dumps(body["state"], ensure_ascii=False), now_iso(), pid))
                return 200, {"rev": row["rev"] + 1}
            if len(parts) == 3 and parts[2] == "rename" and method == "POST":
                name = (read_json(environ).get("name") or "").strip()[:80]
                if not name:
                    raise HTTPError(400, "name_required")
                con.execute("UPDATE projects SET name=? WHERE id=?", (name, pid))
                return 200, {"ok": True}
            if len(parts) == 2 and method == "DELETE":
                left = con.execute("SELECT id FROM projects WHERE user_id=? AND id<>? ORDER BY id",
                                   (me["id"], pid)).fetchall()
                if not left:
                    raise HTTPError(400, "last_project")
                con.execute("DELETE FROM projects WHERE id=?", (pid,))
                if me["active_project"] == pid:
                    con.execute("UPDATE users SET active_project=? WHERE id=?", (left[0]["id"], me["id"]))
                return 200, {"ok": True, "active": left[0]["id"]}

        # ---- admin
        if parts[:1] == ["admin"]:
            auth(con, environ, admin=True)
            if parts == ["admin", "users"] and method == "GET":
                out = []
                for r in con.execute("SELECT * FROM users ORDER BY created").fetchall():
                    j = user_json(r)
                    j.pop("prefs", None)
                    j["projects"] = project_list(con, r["id"])
                    j["sessions"] = session_list(con, r["id"])
                    out.append(j)
                return 200, {"users": out, "me": me["id"]}
            if parts == ["admin", "users"] and method == "POST":
                body = read_json(environ)
                pin = temp_pin()
                u = create_user(con, norm_phone(body.get("phone")), body.get("name"),
                                valid_day(body.get("today")), body.get("lang") or "en", pin=pin)
                con.execute("UPDATE users SET pin_temp=1 WHERE id=?", (u["id"],))
                return 201, {"user": user_json(u), "pin": pin}
            if len(parts) == 3 and parts[1] == "projects" and method == "GET":
                row = project_row(con, int_part(parts[2]))
                u = con.execute("SELECT * FROM users WHERE id=?", (row["user_id"],)).fetchone()
                return 200, {"user": user_json(u), "project": {"id": row["id"], "name": row["name"]},
                             "state": json.loads(row["data"])}
            if len(parts) >= 3 and parts[1] == "users":
                uid = int_part(parts[2])
                if not con.execute("SELECT 1 FROM users WHERE id=?", (uid,)).fetchone():
                    raise HTTPError(404, "not_found")
                if uid == me["id"] and method != "GET" and parts[3:] != ["edit"]:
                    raise HTTPError(400, "not_yourself")
                if parts[3:] in (["block"], ["reset-pin"]) and con.execute(
                        "SELECT is_admin FROM users WHERE id=?", (uid,)).fetchone()[0]:
                    raise HTTPError(400, "is_admin")  # remove the admin role first
                if len(parts) == 4 and parts[3] == "block" and method == "POST":
                    blocked = 1 if read_json(environ).get("blocked") else 0
                    con.execute("UPDATE users SET blocked=? WHERE id=?", (blocked, uid))
                    if blocked:
                        con.execute("DELETE FROM sessions WHERE user_id=?", (uid,))
                    return 200, {"ok": True}
                if len(parts) == 4 and parts[3] == "edit" and method == "POST":
                    body = read_json(environ)
                    name, phone = (body.get("name") or "").strip()[:60], norm_phone(body.get("phone"))
                    if not name:
                        raise HTTPError(400, "name_required")
                    if con.execute("SELECT 1 FROM users WHERE phone=? AND id<>?", (phone, uid)).fetchone():
                        raise HTTPError(409, "phone_exists")
                    con.execute("UPDATE users SET name=?, phone=? WHERE id=?", (name, phone, uid))
                    return 200, {"ok": True}
                if len(parts) == 4 and parts[3] == "sessions" and method == "DELETE":
                    con.execute("DELETE FROM sessions WHERE user_id=?", (uid,))
                    return 200, {"ok": True}
                if len(parts) == 4 and parts[3] == "approve" and method == "POST":
                    con.execute("UPDATE users SET approved=1 WHERE id=?", (uid,))
                    return 200, {"ok": True}
                if len(parts) == 4 and parts[3] == "reset-pin" and method == "POST":
                    # a one-time PIN for the admin to pass on; the user is asked to change it
                    pin = temp_pin()
                    con.execute("UPDATE users SET pin=?, pin_temp=1, pin_fails=0, locked_until=NULL WHERE id=?",
                                (hash_pin(pin), uid))
                    con.execute("DELETE FROM sessions WHERE user_id=?", (uid,))
                    return 200, {"ok": True, "pin": pin}
                if len(parts) == 4 and parts[3] == "role" and method == "POST":
                    con.execute("UPDATE users SET is_admin=? WHERE id=?",
                                (1 if read_json(environ).get("is_admin") else 0, uid))
                    return 200, {"ok": True}
                if len(parts) == 3 and method == "DELETE":
                    con.execute("DELETE FROM sessions WHERE user_id=?", (uid,))
                    con.execute("DELETE FROM projects WHERE user_id=?", (uid,))
                    con.execute("DELETE FROM users WHERE id=?", (uid,))
                    return 200, {"ok": True}
        raise HTTPError(404, "not_found")


def serve_static(path, start_response):
    rel = "index.html" if path in ("", "/") else path.lstrip("/")
    full = os.path.realpath(os.path.join(STATIC, rel))
    if not full.startswith(os.path.realpath(STATIC) + os.sep) or not os.path.isfile(full):
        full = os.path.join(STATIC, "index.html")  # single-page app
    ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
    if full.endswith(".webmanifest"):
        ctype = "application/manifest+json"
    if ctype.startswith("text/") or ctype in ("application/javascript", "application/json", "image/svg+xml"):
        ctype += "; charset=utf-8"
    with open(full, "rb") as f:
        data = f.read()
    start_response("200 OK", [("Content-Type", ctype), ("Content-Length", str(len(data))),
                              ("Cache-Control", "no-cache")])
    return [data]


def application(environ, start_response):
    path = environ.get("PATH_INFO") or "/"
    if not path.startswith("/api/"):
        return serve_static(path, start_response)
    try:
        status, body = api(environ["REQUEST_METHOD"], path[5:], environ)
    except HTTPError as e:
        status, body = e.status, {"error": e.error, **e.extra}
    except Exception:  # keep the app answering; details go to the server log
        import traceback
        traceback.print_exc()
        status, body = 500, {"error": "server_error"}
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    start_response(STATUS.get(status, str(status)), [("Content-Type", "application/json; charset=utf-8"),
                                                     ("Content-Length", str(len(data))),
                                                     ("Cache-Control", "no-store")])
    return [data]


init_db()


class ThreadingServer(ThreadingMixIn, WSGIServer):
    daemon_threads = True


class QuietHandler(WSGIRequestHandler):
    def log_message(self, *args):
        pass


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Routine study tracker")
    ap.add_argument("--host", default=os.environ.get("ROUTINE_HOST", "127.0.0.1"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("ROUTINE_PORT", "8765")))
    a = ap.parse_args()
    with make_server(a.host, a.port, application, server_class=ThreadingServer, handler_class=QuietHandler) as srv:
        print("Routine is running on http://%s:%d" % ("127.0.0.1" if a.host == "0.0.0.0" else a.host, a.port))
        srv.serve_forever()
