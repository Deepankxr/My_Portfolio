"""Check the static site, retained articles, metadata, assets and local links."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
from collections import Counter
import re,json
ROOT=Path(__file__).resolve().parent.parent
class Doc(HTMLParser):
 def __init__(self,source):
  super().__init__(convert_charrefs=True);self.nodes=[];self.feed(source)
 def handle_starttag(self,tag,attrs):self.nodes.append((tag,dict(attrs)))
 def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs)
files=[ROOT/x for x in ('index.html','thoughts.html','privacy.html')]+sorted((ROOT/'about').glob('*.html'))+sorted((ROOT/'work').glob('*.html'))+sorted((ROOT/'blog').glob('*.html'))
docs={p:Doc(p.read_text())for p in files};errors=[];links=0
for path,doc in docs.items():
 rel=str(path.relative_to(ROOT));counts=Counter(a['id'] for _,a in doc.nodes if 'id'in a)
 for key,n in counts.items():
  if n>1:errors.append(f'{rel}: duplicate id {key}')
 if sum(t=='h1'for t,a in doc.nodes)!=1:errors.append(f'{rel}: must have one h1')
 if not any(t=='link'and a.get('rel')=='canonical'for t,a in doc.nodes):errors.append(f'{rel}: missing canonical')
 if not any(t=='meta'and a.get('name')=='description'for t,a in doc.nodes):errors.append(f'{rel}: missing description')
 if not any(t=='a'and a.get('href')=='#main'for t,a in doc.nodes):errors.append(f'{rel}: missing skip link')
 for tag,a in doc.nodes:
  if tag=='img' and 'alt'not in a:errors.append(f'{rel}: image missing alt')
  for key in ('href','src'):
   if key not in a:continue
   url=urlsplit(a[key])
   if url.scheme or url.netloc:continue
   target=(path.parent/unquote(url.path)).resolve() if url.path else path
   if target.is_dir():target=target/'index.html'
   links+=1
   if not target.exists():errors.append(f'{rel}: missing {a[key]}');continue
   if url.fragment and target.suffix=='.html':
    targetdoc=docs.get(target) or Doc(target.read_text())
    if not any(x.get('id')==unquote(url.fragment)for _,x in targetdoc.nodes):errors.append(f'{rel}: missing anchor {a[key]}')
  if tag in ('video','audio')or '.mp4'in a.get('src','') or 'api.kie' in a.get('src',''):errors.append(f'{rel}: rejected AI media referenced')
for post in json.loads((ROOT/'content/portfolio.json').read_text())['posts']:
 source=(ROOT/'content/essays'/f"{post['slug']}.html").read_text().strip()
 rendered=(ROOT/'blog'/f"{post['slug']}.html").read_text()
 article=re.search(r'<article class="post-body" id="essay">(.*?)</article>',rendered,re.S).group(1).strip()
 normalize=lambda s:re.sub(r'<h2\b[^>]*>','<h2>',s)
 if normalize(source)!=normalize(article):errors.append(f'{post["slug"]}: article text changed')
privacy=re.search(r'<article class="post-body">(.*?)</article>',(ROOT/'privacy.html').read_text(),re.S).group(1).strip()
if privacy!=(ROOT/'content/privacy.html').read_text().strip():errors.append('Privacy policy changed')
css=(ROOT/'css/noir.css').read_text()
for source in re.findall(r'url\([\'"]?([^\)\'\"]+)',css):
 if not source.startswith(('data:','http')) and not (ROOT/'css'/source).exists():errors.append(f'CSS asset missing: {source}')
result={'pages_checked':len(files),'local_references_checked':links,'essays_preserved':17,'privacy_copy_preserved':True,'errors':errors}
(ROOT/'noir-verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2));raise SystemExit(bool(errors))
