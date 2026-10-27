# Routine — study routine tracker

A web app for a daily study routine: today's topics with ticks, study hours, Pomodoro timer,
pending work, spaced revision, notes, print, CSV import/export, English/বাংলা, light/dark,
phone-number login and an admin view of every user's progress.

New users start with the **BCS 4-month routine** (`templates/bcs-4-month.csv`, 16 weeks · 112 days).
"Day N" counts from each project's start date by the calendar.

**Projects:** a user can keep several routines. Tap the logo to switch, rename, delete or create one
(from the BCS template, a CSV file, or empty). Subjects, topics, ticks, hours, timer time and notes belong
to a project; language, theme, timer and sound settings belong to the account. *Overall* shows every
project at a glance.

**CSV upload** opens a table editor first: fix day, subject (dropdown), topic and priority; new subject
names are listed so you can create them or map them onto an existing subject; then review and apply.
Both the week-block format (like the BCS file) and the flat `day,subject,priority,subpart` format work.
The same table opens for a week (tap its card on the *Routine* page) and for *+ Add topics*.
A week card's ✕ removes the week: its topics go to Archive and later weeks move up (Undo works).

Only Python 3.8+ is needed — no packages to install.

## Run it on this computer

**Desktop icon** (Linux):

```bash
./launcher/install-desktop.sh
```

This puts a **Routine** icon on the Desktop and in the app menu. Clicking it starts the server in the
background (no terminal) and opens the app in its own window. `./launcher/stop.sh` stops the server.

**Or by hand:**

```bash
python3 server.py            # → http://127.0.0.1:8765
```

**Phone on the same Wi-Fi:** run `python3 server.py --host 0.0.0.0`, then open
`http://<this-computer's-IP>:8765` on the phone. In the phone browser use *Add to Home screen* to get
an app icon. Only do this on a network you trust (see *Login* below).

## Login and admin

- Login is by phone number only — **no password or OTP yet**. Anyone who can reach the app and knows a
  phone number can open that account. Fine on your own computer; add real authentication (OTP or a
  password) before sharing a public link widely.
- A new number asks for a name and creates the account.
- **The first account created is the admin.** The admin sees an *Admin* tab: every user's day,
  overall progress, on-track %, today's ticks, hours in the last 7 days, streak, pending and last seen;
  one row per project; *View* opens that routine read-only; the admin can add users, make/remove admins and delete users.

## Host it for free (PythonAnywhere)

PythonAnywhere's free plan runs Python web apps and keeps files (so the SQLite data stays).

1. Create a free account at <https://www.pythonanywhere.com>.
2. *Files* → upload this folder as a zip into your home folder and unzip it in a *Bash console*
   (`unzip routine-app.zip`), so you have `/home/<you>/routine-app/server.py`.
3. *Web* → *Add a new web app* → *Manual configuration* → the newest Python.
4. Open the *WSGI configuration file* link and replace everything in it with:

   ```python
   import sys
   sys.path.insert(0, "/home/<you>/routine-app")
   from server import application
   ```

5. Press *Reload*. The app is at `https://<you>.pythonanywhere.com`. Open it and create your
   account first — that makes you the admin.

The free plan asks you to press "Run until 3 months from today" on the *Web* tab every three months.
Any other WSGI host works the same way (`wsgi.py` exposes `application`).

Settings via environment variables (all optional):

| Variable | Default | Meaning |
|---|---|---|
| `ROUTINE_PORT` | `8765` | port for `server.py` |
| `ROUTINE_HOST` | `127.0.0.1` | address to listen on |
| `ROUTINE_DATA` | `./data` | folder for `routine.db` |
| `ROUTINE_TEMPLATE` | `templates/bcs-4-month.csv` | routine new users start with |
| `ROUTINE_TZ_OFFSET` | `360` | minutes from UTC for the admin's "today" (Bangladesh = 360) |

## Data

Everything is in `data/routine.db` (SQLite). Back it up by copying that file. Each user can also
download a JSON backup from *Settings → Data*.

## Files

```
server.py            web server + API + SQLite (stdlib only)
wsgi.py              entry point for WSGI hosts
templates/           routine CSV new users start with
static/              the app (index.html, app.css, i18n.js, core.js, views.js, features.js, main.js, icons)
launcher/            desktop launcher, stop script, desktop-icon installer
```

### Routine CSV format

The template is the week-block layout: a row `সপ্তাহ N (মাস M) — Title`, a `Day,…` header row naming
the subjects, then `Day 1`…`Day 7` rows. In a cell, `|` separates topics and a trailing `[High]`,
`[Medium]` or `[Low]` sets the priority. Inside the app, *Routine → Upload CSV* takes the simple flat
format instead (`day,subject,priority,subpart`; *Template* downloads an example).
