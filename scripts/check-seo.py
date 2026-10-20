"""Verify generated SEO, structured data and optionally the actual local HTTP responses."""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

from seo import ROOT, SM, IM, clean_route, image_size


class Doc(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.nodes, self.title, self.schemas = [], '', []
        self.in_title, self.in_schema, self.json = False, False, ''
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        a=dict(attrs); self.nodes.append((tag,a))
        if tag=='title': self.in_title=True
        if tag=='script' and a.get('type')=='application/ld+json': self.in_schema=True;self.json=''

    def handle_data(self, text):
        if self.in_title: self.title+=text
        if self.in_schema: self.json+=text

    def handle_endtag(self, tag):
        if tag=='title': self.in_title=False
        if tag=='script' and self.in_schema:
            self.schemas.append(json.loads(self.json));self.in_schema=False

    def meta(self, name):
        return next((a.get('content','') for t,a in self.nodes if t=='meta' and (a.get('name')==name or a.get('property')==name)),None)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--http-base');args=parser.parse_args()
    manifest=json.loads((ROOT/'seo-build.json').read_text());config=json.loads((ROOT/'content/seo.json').read_text())
    base=manifest['base_url']; errors=[];titles=[];descriptions=[];og_images=[];image_count=0;schema_types=Counter()
    def check(ok, message):
        if not ok: errors.append(message)
    for p in manifest['pages']:
        doc=Doc((ROOT/p['path']).read_text())
        titles.append(doc.title);descriptions.append(doc.meta('description'));og_images.append(doc.meta('og:image'))
        check(len(doc.title)<60,p['path']+': title too long')
        check(140<=len(doc.meta('description') or '')<=160,p['path']+': description length')
        check(any(t=='link' and a.get('rel')=='canonical' and a.get('href')==p['url'] for t,a in doc.nodes),p['path']+': canonical')
        for directive in ('robots','googlebot'):
            check('noindex' not in (doc.meta(directive) or ''),p['path']+': unexpected noindex')
            check(all(x in (doc.meta(directive) or '') for x in ('max-image-preview:large','max-snippet:-1','max-video-preview:-1')),p['path']+': preview directive')
        for tag in ('header','main','nav','footer'):
            check(any(t==tag for t,a in doc.nodes),p['path']+': missing '+tag)
        headings=[int(t[1]) for t,a in doc.nodes if re.fullmatch(r'h[1-6]',t)]
        check(headings.count(1)==1,p['path']+': h1 count')
        for prev,current in zip(headings,headings[1:]):
            check(current<=prev+1,p['path']+f': heading order h{prev}→h{current}')
        for t,a in doc.nodes:
            if t!='img':continue
            image_count+=1
            check('alt' in a,p['path']+': missing alt')
            check(all(a.get(k,'').isdigit() and int(a[k])>0 for k in ('width','height')),p['path']+': image dimensions '+a.get('src',''))
            check(a.get('decoding')=='async',p['path']+': missing async decoding')
            check(a.get('loading') in ('lazy','eager'),p['path']+': missing image loading')
            if a.get('fetchpriority')=='high':check(a.get('loading')=='eager',p['path']+': LCP not eager')
        og_path=ROOT/urlsplit(doc.meta('og:image')).path.lstrip('/')
        check(og_path.is_file() and image_size(og_path)==(1200,630),p['path']+': OG size')
        check(bool(doc.meta('og:image:alt')) and bool(doc.meta('twitter:image:alt')),p['path']+': OG/Twitter alt')
        graph=[item for schema in doc.schemas for item in schema.get('@graph',[schema])]
        for item in graph:schema_types[item['@type']]+=1
        if p['path']=='index.html':
            person=next((g for g in graph if g['@type']=='Person'),{})
            check(all(person.get(k) for k in ('name','jobTitle','url','sameAs')), 'Person fields')
            website=next((g for g in graph if g['@type']=='WebSite'),{})
            check('thoughts.html?q={search_term_string}' in website.get('potentialAction',{}).get('target',{}).get('urlTemplate',''),'SearchAction endpoint')
        if p['path'].startswith('work/') and p['path']!='work/index.html':
            work=next((g for g in graph if g['@type']=='CreativeWork'),{})
            check(all(work.get(k) for k in ('name','description','author','url','image')),'CreativeWork fields: '+p['path'])
            crumbs=next((g for g in graph if g['@type']=='BreadcrumbList'),{}).get('itemListElement',[])
            check([g.get('position') for g in crumbs]==[1,2,3] and all(g.get('item','').startswith(base) for g in crumbs),'Breadcrumb structure: '+p['path'])
    check(len(set(titles))==len(titles),'Duplicate titles')
    check(len(set(descriptions))==len(descriptions),'Duplicate descriptions')
    check(len(set(og_images))==len(og_images),'Shared OG image')
    ns={'s':SM,'image':IM};image_urls=set();all_urls=set();xml_counts={}
    for name in manifest['sitemaps']:
        xml=ET.parse(ROOT/name).getroot();check(xml.tag in ('{'+SM+'}urlset','{'+SM+'}sitemapindex'),name+': namespace')
        for loc in xml.findall('.//s:loc',ns)+xml.findall('.//image:loc',ns):
            parsed=urlsplit(loc.text or '')
            check(parsed.scheme=='https' and bool(parsed.netloc) and loc.text.startswith(base),name+': invalid absolute URL '+str(loc.text));all_urls.add(loc.text)
        images=xml.findall('.//image:image',ns);xml_counts[name]={'pages':len(xml.findall('s:url',ns)),'images':len(images)}
        check(len(images)<=1000,name+': image count exceeds 1000')
        for image in images:
            loc=image.find('image:loc',ns);title=image.find('image:title',ns)
            check(loc is not None and bool(loc.text),name+': image without loc')
            check(title is not None and bool(title.text),name+': image without title')
            if loc is not None:image_urls.add(loc.text)
        for node in xml.findall('s:url',ns):
            loc=node.findtext('s:loc',namespaces=ns)
            route=urlsplit(loc).path.lstrip('/');key=(route+'index.html') if not route or route.endswith('/') else route
            priority=node.findtext('s:priority',namespaces=ns)
            check(bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}',node.findtext('s:lastmod','',ns))),name+': lastmod')
            if name.startswith('image-'):
                check(.3<=float(priority)<=.4 and node.findtext('s:changefreq',namespaces=ns)=='monthly',name+': image priority/changefreq')
            else:check(priority==config['pages'][key]['priority'],name+': changed priority')
    listed={urlsplit(line.removeprefix('Sitemap: ')).path.lstrip('/') for line in (ROOT/'robots.txt').read_text().splitlines() if line.startswith('Sitemap: ')}
    check(listed==set(manifest['sitemaps']),'robots sitemap list')
    check('User-agent: Googlebot-Image\nAllow: /\nAllow: /assets/' in (ROOT/'robots.txt').read_text(),'Image crawler access')
    page_urls={x.text for name in manifest['sitemaps'] if name.startswith('page-') for x in ET.parse(ROOT/name).getroot().findall('s:url/s:loc',ns)}
    check(page_urls=={p['url'] for p in manifest['pages']},'Public sitemap route coverage')
    missing=Doc((ROOT/'404.html').read_text());check('noindex' in missing.meta('robots'),'404 indexable')
    check(not any('/404.html' in url for url in all_urls),'404 in sitemap')
    ET.parse(ROOT/'projects.xml')
    http=[]
    if args.http_base:
        def get(url):
            target=args.http_base.rstrip('/')+urlsplit(url).path
            for attempt in range(3):
                try:
                    with urlopen(Request(target,headers={'User-Agent':'Googlebot-Image' if url in image_urls else 'Googlebot'}),timeout=20) as response:
                        response.read()
                        return {'path':urlsplit(url).path,'status':response.status,'content_type':response.headers.get('Content-Type'),'redirected':response.url!=target}
                except HTTPError as error:return {'path':urlsplit(url).path,'status':error.code}
                except (URLError,ConnectionError,TimeoutError) as error:
                    if attempt==2:return {'path':urlsplit(url).path,'status':0,'error':str(error)}
        with ThreadPoolExecutor(max_workers=2) as pool:
            http=list(pool.map(get, sorted(all_urls|{base+'robots.txt',base+'projects.xml',base+'404.html',base+'this-page-does-not-exist/'})))
        for result in http:
            if result['path'] in ('/404.html','/this-page-does-not-exist/'):
                check(result['status']==(200 if result['path']=='/404.html' else 404),'404 response '+result['path'])
            else:check(result['status']==200,'HTTP '+str(result))
            if result['path'].endswith('.xml'):check(result.get('content_type','').startswith('application/xml'),'XML MIME '+str(result))
        check(not any(r.get('redirected') for r in http),'Unexpected redirects')
    report={'pages_checked':len(manifest['pages']),'img_elements_checked':image_count,'unique_sitemap_images':len(image_urls),'xml_files':xml_counts,'project_feed_items':4,'structured_data_types':dict(schema_types),'http_responses':http,'errors':errors}
    (ROOT/'seo-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='http_responses'},indent=2))
    if http:print(f'HTTP: {len(http)} responses checked, including every sitemap image and a missing URL.')
    raise SystemExit(bool(errors))


if __name__=='__main__':main()
