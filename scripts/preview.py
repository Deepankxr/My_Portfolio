"""Safe local preview: public site files only, no credentials or source data."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import argparse
import re
ROOT=Path(__file__).resolve().parent.parent
PUBLIC={'.html','.css','.js','.jpg','.jpeg','.png','.webp','.avif','.svg','.ico','.woff','.woff2','.ttf','.txt','.xml'}
PAGES={'index.html','thoughts.html','privacy.html','404.html','favicon.svg','robots.txt','sitemap.xml','page-sitemap.xml','image-sitemap.xml','projects.xml','googleREPLACE_WITH_SEARCH_CONSOLE_TOKEN.html'}
class Handler(SimpleHTTPRequestHandler):
 extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.xml':'application/xml; charset=utf-8','.webp':'image/webp','.avif':'image/avif'}
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
 def permitted(self):
  route=unquote(urlsplit(self.path).path)
  target=(ROOT/route.lstrip('/')).resolve()
  if target.is_dir():target=target/'index.html'
  if not target.is_relative_to(ROOT):return False
  relative=target.relative_to(ROOT)
  generated=(len(relative.parts)==1 and re.fullmatch(r'(?:page|image)-sitemap-\d+\.xml|google[a-zA-Z0-9]+\.html',relative.name))
  return (not any(p.startswith('.') for p in relative.parts) and (str(relative)in PAGES or generated or relative.parts[0] in ('about','blog','work','assets','css','js')) and target.suffix.lower()in PUBLIC and target.is_file())
 def send_error(self,code,message=None,explain=None):
  if code==404 and (ROOT/'404.html').is_file():
   content=(ROOT/'404.html').read_bytes();self.send_response(404);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(content)));self.send_header('X-Robots-Tag','noindex');self.end_headers()
   if self.command!='HEAD':self.wfile.write(content)
   return
  super().send_error(code,message,explain)
 def do_GET(self):
  if not self.permitted():self.send_error(404);return
  super().do_GET()
 def do_HEAD(self):
  if not self.permitted():self.send_error(404);return
  super().do_HEAD()
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8767);args=parser.parse_args()
 print(f'Noir portfolio: http://127.0.0.1:{args.port}/',flush=True)
 ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
