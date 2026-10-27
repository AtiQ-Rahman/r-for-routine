# WSGI entry point for hosting (PythonAnywhere, uWSGI, gunicorn …).
# On PythonAnywhere: Web tab → WSGI configuration file → replace its content with:
#
#   import sys
#   sys.path.insert(0, "/home/<your-username>/routine-app")
#   from server import application
#
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from server import application  # noqa: E402,F401
