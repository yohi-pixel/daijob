import http.server
import socketserver
import sys
import os
import urllib.request
import urllib.error

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
BACKEND = os.getenv("BACKEND_URL", "http://localhost:8000")

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.json': 'application/json',
        '': 'application/octet-stream',
    }

    def do_GET(self):
        if self.path.startswith('/api'):
            self._proxy()
        elif self.path == '/' or self.path == '':
            self.path = '/pages/home.html'
            super().do_GET()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith('/api'):
            self._proxy()
        else:
            super().do_POST()

    def do_PUT(self):
        if self.path.startswith('/api'):
            self._proxy()
        else:
            self.send_response(405)
            self.end_headers()

    def do_DELETE(self):
        if self.path.startswith('/api'):
            self._proxy()
        else:
            self.send_response(405)
            self.end_headers()

    def _proxy(self):
        url = BACKEND + self.path
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length) if length else None
        req = urllib.request.Request(url, data=body, method=self.command)
        # Forward all relevant request headers
        for h, v in self.headers.items():
            hl = h.lower()
            if hl in ('transfer-encoding', 'connection', 'host'):
                continue
            req.add_header(h, v)
        try:
            with urllib.request.urlopen(req) as resp:
                self.send_response(resp.status)
                is_sse = 'text/event-stream' in resp.headers.get('Content-Type', '')
                for k, v in resp.headers.items():
                    if k.lower() not in ('transfer-encoding', 'connection'):
                        self.send_header(k, v)
                self.end_headers()
                if is_sse:
                    while True:
                        chunk = resp.read(64)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        self.wfile.flush()
                else:
                    self.wfile.write(resp.read())
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_response(502)
            self.end_headers()
            self.wfile.write(str(e).encode())

    def log_message(self, format, *args):
        pass  # suppress logs

with socketserver.TCPServer(("", PORT), ProxyHandler) as httpd:
    print(f"Serving on http://localhost:{PORT}")
    httpd.serve_forever()
