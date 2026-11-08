"""Squeeze a routine into fewer days (for example the BCS 4-month plan into 2 months).

Each subject is handled on its own, so no day suddenly gets twice the work:

1. A topic that comes back later in the same subject with the same text (the 4-month plan
   repeats every math topic twice) is kept once.
2. Revision / self-test / model-test topics are thinned: per subject, only the last one
   of each new week stays. A block that is mostly revision (a final model-test week) stays whole.
3. What is left of each subject keeps its order and is spread evenly over the days its
   part of the old plan now covers. A subject that pauses for more than a week (science
   in weeks 1 and 3) is placed part by part, so it stays where it was in the plan.

Nothing is deleted: dropped topics go to the Archive, so they can be brought back.
Ticks (done) stay with their topics.
"""
import math
import re

REVIEW = re.compile(
    r"রিভিশন|রিভাইস|revision|revise|self\s*test|মডেল\s*টেস্ট|model\s*test|প্রশ্ন বিশ্লেষণ"
    r"|আবার দেখ|রেফারেন্স টেবিল|অনুশীলন|ঝালাই|practice", re.I)
GAP = 7   # a subject absent for more than this many old days starts a new part


def is_review(t):
    return bool(REVIEW.search(t or ""))


def _norm(t):
    return re.sub(r"\s+", " ", (t or "").strip().lower())


def _ordinal(p):
    return (p["w"] - 1) * 7 + p["d"]


def _wd(o):
    return (o - 1) // 7 + 1, (o - 1) % 7 + 1


def compress_tasks(tasks, days, dedupe=True, thin=True):
    """tasks: list of task dicts (w, d, s, t, ...). Returns (new task list, stats).
    Archived input tasks are kept as they are."""
    live = [p for p in tasks if not p.get("arch")]
    old_len = max([_ordinal(p) for p in live] or [1])
    days = max(1, int(days))
    r = old_len / days
    out = [dict(p) for p in tasks if p.get("arch")]
    dropped = {"repeat": 0, "review": 0}
    by_subj = {}
    for p in sorted(live, key=lambda p: (_ordinal(p), p["id"])):
        by_subj.setdefault(p["s"], []).append(p)

    def target(o):   # where an old day lands, before balancing
        return min(days, max(1, math.ceil(o / r)))

    for s, ps in by_subj.items():
        # 1) repeats
        keep, seen = [], set()
        for p in ps:
            k = _norm(p["t"])
            if dedupe and r > 1 and not is_review(p["t"]) and k in seen:
                out.append(_arch(p, target(_ordinal(p))))
                dropped["repeat"] += 1
                continue
            seen.add(k)
            keep.append(p)
        # 2) parts: split where the subject pauses for more than a week
        parts, cur = [], []
        for p in keep:
            if cur and _ordinal(p) - _ordinal(cur[-1]) > GAP:
                parts.append(cur)
                cur = []
            cur.append(p)
        if cur:
            parts.append(cur)
        for part in parts:
            first, last = _ordinal(part[0]), _ordinal(part[-1])
            a, b = target(first), target(last)
            # 3) reviews: the last one per new week stays (only when the plan gets shorter).
            # A part that is mostly revision (a final model-test week) is left whole.
            if thin and r > 1 and sum(is_review(p["t"]) for p in part) * 2 <= len(part):
                last_rev = {}
                for i, p in enumerate(part):
                    if is_review(p["t"]):
                        last_rev[_wd(target(_ordinal(p)))[0]] = i
                kept = []
                for i, p in enumerate(part):
                    if is_review(p["t"]) and last_rev.get(_wd(target(_ordinal(p)))[0]) != i:
                        out.append(_arch(p, target(_ordinal(p))))
                        dropped["review"] += 1
                    else:
                        kept.append(p)
                part = kept
            # 4) spread evenly over the new span, keeping the order
            span, n = b - a + 1, len(part)
            for i, p in enumerate(part):
                o = a + (i * span // n if n >= span else round(i * (span - 1) / max(1, n - 1)))
                w, d = _wd(o)
                q = dict(p)
                q.update(w=w, d=d, ow=w, od=d)
                out.append(q)
    out.sort(key=lambda p: p["id"])
    live_out = [p for p in out if not p.get("arch")]
    per_day = {}
    for p in live_out:
        per_day[_ordinal(p)] = per_day.get(_ordinal(p), 0) + 1
    old_day = {}
    for p in live:
        old_day[_ordinal(p)] = old_day.get(_ordinal(p), 0) + 1
    stats = {
        "old_days": old_len, "days": days, "topics": len(live_out),
        "archived_repeat": dropped["repeat"], "archived_review": dropped["review"],
        "per_day_old": round(len(live) / max(1, len(old_day)), 1),
        "per_day": round(len(live_out) / max(1, len(per_day)), 1),
        "max_day_old": max(old_day.values() or [0]), "max_day": max(per_day.values() or [0]),
    }
    return out, stats


def _arch(p, o):
    w, d = _wd(o)
    q = dict(p)
    q.update(w=w, d=d, ow=w, od=d, arch=True)
    return q


def week_titles(old_wt, old_len, days, nw):
    """New week k gets the titles of the old weeks that now fall in it, joined with " + "."""
    r = old_len / days
    out = {}
    for k in range(1, nw + 1):
        lo, hi = (k - 1) * 7 + 1, k * 7          # new days of week k
        names = []
        for ow in range(1, math.ceil(old_len / 7) + 1):
            mid = ((ow - 1) * 7 + 4) / r          # middle of the old week, in new days
            if lo - 0.5 <= mid < hi + 0.5:
                t = (old_wt.get(str(ow)) or "").strip()
                if t and t not in names:
                    names.append(t)
        if names:
            out[str(k)] = " + ".join(names)
    return out


def compress_state(st, days, start=None, dedupe=True, thin=True):
    """A new routine state from st, squeezed into `days` days. Topic ids and ticks are kept;
    hours, notes and timers start fresh (it is a new project)."""
    tasks, stats = compress_tasks(st.get("P", []), days, dedupe, thin)
    nw = max(1, math.ceil(days / 7))
    done_ids = {p["id"] for p in tasks if not p.get("arch")}
    new = {
        "v": 2, "PNAME": st.get("PNAME", ""), "P": tasks, "uid": max([p["id"] for p in tasks] or [0]),
        "done": [i for i in st.get("done", []) if i in done_ids], "START": start or st.get("START"),
        "notes": {}, "TG": st.get("TG", 10), "TGD": {}, "HR": {}, "revs": [], "rid": 0,
        "LAD": st.get("LAD", [1, 3, 7, 14, 30]), "refl": [], "R": [], "RM": [], "FOC": [], "fid": 0,
        "pin": [], "SUBJ": st.get("SUBJ", []), "SNAME": st.get("SNAME", {}),
        "WT": week_titles(st.get("WT", {}), stats["old_days"], days, nw), "nw": nw,
        "SEC": {}, "HRC": {}, "closed": {},
    }
    if st.get("SMIN"):
        new["SMIN"] = st["SMIN"]
    return new, stats


def to_week_csv(st, title, column_subjects):
    """Write a state as the week-block CSV (the format of templates/bcs-4-month.csv).
    column_subjects: subject keys that get their own column every week (math, বাংলা, English);
    every other subject is a week subject. A week with two week subjects gives the second
    one its own column, named in that week's header row."""
    import csv
    import io
    sname = st["SNAME"]
    tasks = [p for p in st["P"] if not p.get("arch")]
    buf = io.StringIO()
    wr = csv.writer(buf, lineterminator="\n")
    wr.writerow([title, "", "", "", ""])
    for w in range(1, st["nw"] + 1):
        wk = sorted([p for p in tasks if p["w"] == w], key=lambda p: (p["d"], p["id"]))
        mains = []
        for p in wk:
            if p["s"] not in column_subjects and p["s"] not in mains:
                mains.append(p["s"])
        # the first column after "Day" always belongs to the week subject (named by the title)
        cols = (mains or [None]) + list(column_subjects)
        wt = st["WT"].get(str(w)) or (sname.get(mains[0], "") if mains else "")
        if mains and re.split(r" - | \+ ", wt)[0].strip() != sname[mains[0]]:
            wt = sname[mains[0]] + " + " + wt
        wr.writerow([])
        wr.writerow(["সপ্তাহ %d (মাস %d) - %s" % (w, (w - 1) // 4 + 1, wt), "", "", "", ""])
        wr.writerow(["Day", "মূল বিষয়"] + [sname.get(s, s) for s in cols[1:]])
        for d in range(1, 8):
            row = ["Day %d" % d]
            for s in cols:
                cell = [p["t"] + (" [%s]" % p["p"] if p.get("p") else "") + (" {পৃ. %s}" % p["pg"] if p.get("pg") else "") for p in wk if p["d"] == d and p["s"] == s]
                row.append(" | ".join(cell))
            wr.writerow(row)
    return buf.getvalue()
