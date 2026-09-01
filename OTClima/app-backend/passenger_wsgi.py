import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(PROJECT_ROOT)
sys.path.insert(0, PROJECT_ROOT)

try:
    from a2wsgi import ASGIMiddleware
    from app.main import app as asgi_app
except ModuleNotFoundError:
    # Passenger loads this file before Python Selector installs requirements.
    def application(environ, start_response):
        body = b"Installing Python dependencies. Restart the application when complete."
        start_response(
            "200 OK",
            [
                ("Content-Type", "text/plain; charset=utf-8"),
                ("Content-Length", str(len(body))),
            ],
        )
        return [body]
else:
    application = ASGIMiddleware(asgi_app)
