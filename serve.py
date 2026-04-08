import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3000

class JSHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.json': 'application/json',
        '': 'application/octet-stream',
    }

    def log_message(self, format, *args):
        pass  # suppress logs

with socketserver.TCPServer(("", PORT), JSHandler) as httpd:
    print(f"Serving on http://localhost:{PORT}")
    httpd.serve_forever()
