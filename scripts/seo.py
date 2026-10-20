"""Build-time SEO for the existing static portfolio generator.

Only Pillow is needed for deterministic social cards; serving the site needs no runtime.
No environment file is loaded: deployment configuration must be passed explicitly.
"""
from datetime import date
from email.utils import format_datetime
from datetime import datetime, timezone
from html import escape
from html.parser import HTMLParser
from pathlib import Path
import json
import os
import re
import subprocess
from urllib.parse import urljoin, urlsplit, unquote
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SM = 'http://www.sitemaps.org/schemas/sitemap/0.9'
IM = 'http://www.google.com/schemas/sitemap-image/1.1'
ET.register_namespace('', SM)
ET.register_namespace('image', IM)
ROBOTS = 'index, follow, max-snippet:-1, max-video-preview:-1, max-image-preview:large'


def clean_route(path):
    return path[:-10] if path.endswith('index.html') else path


def image_size(path):
    with Image.open(path) as im:
        return im.size


def prepare_images(html, page):
    """Keep the same image boxes; add native format fallback and loading hints."""
    in_picture = False
    def replace(match):
        nonlocal in_picture
        tag = match[0]
        if tag.startswith('<picture'):
            in_picture = True
            return tag
        if tag.startswith('</picture'):
            in_picture = False
            return tag
        attrs = dict(re.findall(r'([\w-]+)="([^"]*)"', tag))
        if 'decoding=' not in tag:
            tag = tag[:-1] + ' decoding="async">'
        if 'loading=' not in tag:
            tag = tag[:-1] + (' loading="eager">' if 'fetchpriority=' in tag else ' loading="lazy">')
        src = attrs.get('src','')
        local = (ROOT/page).parent/src
        if src.endswith('.webp') and not in_picture and 'preview-photo' not in attrs.get('class',''):
            fallback = next((local.with_suffix(s) for s in ('.jpg','.png') if local.with_suffix(s).exists()),None)
            if fallback:
                fallback_src = src[:-5] + fallback.suffix
                return '<picture class="content-picture"><source type="image/webp" srcset="'+src+'">'+tag.replace('src="'+src+'"','src="'+fallback_src+'"')+'</picture>'
        return tag
    return re.sub(r'<picture\b[^>]*>|</picture>|<img\b[^>]*>',replace,html)


class ContentImages(HTMLParser):
    """Read real figures, responsive pictures, and per-page OGs, excluding icons.

    Pictures contribute their largest modern source once, rather than every
    responsive size/fallback. Template previews can expose otherwise hidden photos.
    """
    def __init__(self, html, page, root=None):
        super().__init__(convert_charrefs=True)
        self.page, self.root = page, (root or ROOT).resolve()
        self.images, self.figure, self.picture = {}, None, None
        self.caption, self.in_caption = [], False
        self.feed(html)

    def add(self, src, alt='', caption='', decorative=False):
        parsed = urlsplit(src)
        if parsed.scheme or parsed.netloc:
            local = self.root / unquote(parsed.path.lstrip('/'))
        else:
            local = (self.root / self.page).parent / unquote(parsed.path)
        local = local.resolve()
        if not local.is_relative_to(self.root) or not local.is_file():
            return
        if local.suffix.lower() not in ('.webp', '.avif', '.jpg', '.jpeg', '.png'):
            return
        rel = local.relative_to(self.root).as_posix()
        if '/logos/' in rel or 'favicon' in rel or decorative:
            return
        width, height = image_size(local)
        if min(width, height) < 200:
            return
        title = alt.strip() or re.sub(r'\b\d+\b', '', local.stem.replace('-', ' ')).strip().capitalize()
        item = self.images.setdefault(rel, {'path': rel, 'title': title})
        if alt.strip():
            item['title'] = alt.strip()
        if caption.strip():
            item['caption'] = caption.strip()
        if self.figure is not None:
            self.figure.append(rel)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'figure':
            self.figure, self.caption = [], []
        elif tag == 'figcaption':
            self.in_caption = True
        elif tag == 'picture':
            self.picture = []
        elif tag == 'source' and self.picture is not None and a.get('type') in ('image/webp', 'image/avif'):
            for part in a.get('srcset', '').split(','):
                bits = part.strip().split()
                if bits:
                    self.picture.append((int(bits[1][:-1]) if len(bits)>1 and bits[1].endswith('w') else 0, bits[0]))
        elif tag == 'img':
            src = max(self.picture)[1] if self.picture else a.get('src', '')
            self.add(src, a.get('alt', ''), decorative=(a.get('alt') == '' and 'preview-photo' not in a.get('class', '') and self.picture is None))
        elif tag == 'meta' and a.get('property') == 'og:image':
            self.add(a.get('content', ''))
        elif tag == 'meta' and a.get('property') == 'og:image:alt':
            # The OG image precedes its alt tag in our shared head.
            if self.images:
                list(self.images.values())[-1]['title'] = a.get('content', '')

    def handle_data(self, value):
        if self.in_caption:
            self.caption.append(value)

    def handle_endtag(self, tag):
        if tag == 'figcaption':
            self.in_caption = False
        elif tag == 'figure':
            caption = ' '.join(''.join(self.caption).split())
            for key in self.figure or []:
                if caption:
                    self.images[key]['caption'] = caption
            self.figure = None
        elif tag == 'picture':
            self.picture = None


class SEO:
    def __init__(self):
        self.config = json.loads((ROOT / 'content/seo.json').read_text())
        self.environment = os.environ.get('BUILD_ENV', 'production')
        if self.environment not in ('production', 'preview'):
            raise ValueError('BUILD_ENV must be production or preview')
        default = self.config['site_url'] if self.environment == 'production' else 'http://127.0.0.1:8767'
        self.base = os.environ.get('SITE_URL', default).rstrip('/') + '/'
        parsed = urlsplit(self.base)
        if (not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment
                or parsed.path != '/' or parsed.scheme not in ('http', 'https')):
            raise ValueError('SITE_URL must be an absolute http(s) origin without credentials or a path')
        if self.environment == 'production' and parsed.scheme != 'https':
            raise ValueError('Production SITE_URL must use HTTPS; use BUILD_ENV=preview for localhost')
        self.today = date.fromisoformat(os.environ.get('BUILD_DATE', date.today().isoformat())).isoformat()
        self.pages = []
        self.verification = os.environ.get('GOOGLE_SITE_VERIFICATION', '').strip()

    def url(self, path=''):
        return urljoin(self.base, clean_route(path))

    def lastmod(self, path):
        sources = [path, 'scripts/build-noir.py', 'scripts/seo.py', 'content/seo.json', 'css/noir.css', 'js/noir.js']
        if path.startswith('blog/'):
            sources.append('content/essays/' + Path(path).name)
        elif path == 'privacy.html':
            sources.append('content/privacy.html')
        else:
            sources.append('content/portfolio.json')
        try:
            dirty = subprocess.run(['git', 'status', '--porcelain', '--', *sources], cwd=ROOT, capture_output=True, text=True, check=True).stdout
            if dirty.strip():
                return self.today
            result = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', *sources], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
            return date.fromisoformat(result).isoformat() if result else self.today
        except (OSError, subprocess.CalledProcessError, ValueError):
            return self.today

    def card(self, path, title, category):
        """Render an original typographic card, not a modified photograph."""
        name = ('home' if path == 'index.html' else clean_route(path).strip('/').replace('/', '-').removesuffix('.html')) + '-social-card'
        output = ROOT / 'assets/og' / (name + '.jpg')
        output.parent.mkdir(exist_ok=True)
        font_path = str(ROOT / 'assets/fonts/archivo-variable.ttf')
        im = Image.new('RGB', (1200, 630), '#171717')
        d = ImageDraw.Draw(im)
        font = lambda size: ImageFont.truetype(font_path, size)
        ink, muted, coral = '#f1f0ec', '#aaa9a5', '#f48470'
        d.text((64, 46), 'Deepankar', font=font(30), fill=ink)
        d.text((64, 84), 'B H A D R A S E N', font=font(12), fill=muted)
        d.text((64, 156), category.upper(), font=font(17), fill=coral)
        # Shrink only when a long editorial title needs four lines.
        for size in (76, 68, 60, 54):
            face, lines, line = font(size), [], ''
            for word in title.replace('\xa0', ' ').split():
                candidate = (line + ' ' + word).strip()
                if d.textlength(candidate, font=face) > 1010 and line:
                    lines.append(line); line = word
                else:
                    line = candidate
            lines.append(line)
            if len(lines) * (size + 8) <= 300:
                break
        for i, line in enumerate(lines):
            d.text((60, 206 + i * (size + 8)), line, font=face, fill=ink)
        d.line((64, 554, 1136, 554), fill='#444440', width=1)
        d.text((64, 576), 'AI ENGINEERING  /  AUTOMATION  /  SYSTEMS', font=font(14), fill=muted)
        # Archivo's source font does not contain the diagonal-arrow glyph.
        d.line((1015, 596, 1038, 573), fill=coral, width=3)
        d.line((1018, 573, 1038, 573, 1038, 593), fill=coral, width=3)
        im.save(output, 'JPEG', quality=90, optimize=True)
        im.save(output.with_suffix('.webp'), 'WEBP', quality=90, method=6)
        return output.relative_to(ROOT).as_posix()

    def head(self, path, fallback_title, kind='', old_head=None):
        meta = self.config['pages'][path]
        title, description = meta['title'], meta['description']
        if len(title) >= 60 or not 140 <= len(description) <= 160:
            raise ValueError(f'{path}: invalid title/description lengths ({len(title)}/{len(description)})')
        canonical = self.url(path)
        indexed = path != '404.html' and self.environment == 'production'
        robots = ROBOTS if indexed else 'noindex, follow, max-image-preview:large'
        og = self.card(path, meta.get('card_title', fallback_title.split(' | ')[0]), meta.get('category', 'AI automation engineer'))
        og_alt = meta.get('og_alt', title + ' — Deepankar Bhadrasen')
        tags = [f'<meta name="description" content="{escape(description, quote=True)}">',
                '<meta name="author" content="Deepankar Bhadrasen">',
                f'<meta name="robots" content="{robots}">', f'<meta name="googlebot" content="{robots}">',
                f'<link rel="canonical" href="{canonical}">',
                '<link rel="alternate" type="application/rss+xml" title="Deepankar’s project write-ups" href="'+self.url('projects.xml')+'">']
        props = {'og:type': 'article' if kind == 'article-page' else 'website', 'og:site_name': 'Deepankar Bhadrasen',
                 'og:locale': 'en_IN', 'og:url': canonical, 'og:title': title, 'og:description': description,
                 'og:image': self.url(og), 'og:image:secure_url': self.url(og), 'og:image:type': 'image/jpeg',
                 'og:image:width': '1200', 'og:image:height': '630', 'og:image:alt': og_alt}
        tags += [f'<meta property="{k}" content="{escape(v, quote=True)}">' for k,v in props.items()]
        tags += [f'<meta name="{k}" content="{escape(v, quote=True)}">' for k,v in {'twitter:card':'summary_large_image', 'twitter:title':title, 'twitter:description':description, 'twitter:image':self.url(og), 'twitter:image:alt':og_alt}.items()]
        if self.verification:
            tags.append(f'<meta name="google-site-verification" content="{escape(self.verification, quote=True)}">')
        author = {'@type':'Person', '@id':self.url()+'#person', 'name':'Deepankar Bhadrasen', 'url':self.url('about/')}
        graph = []
        if path == 'index.html':
            graph += [dict(author, url=self.url(), jobTitle='AI Automation Engineer', image=self.url('assets/deepankar-portrait-540.webp'),
                           sameAs=self.config['social_profiles'], worksFor={'@type':'Organization','name':'TrueHorizon AI'}),
                      {'@type':'WebSite','@id':self.url()+'#website','name':'Deepankar Bhadrasen','url':self.url(),
                       'potentialAction':{'@type':'SearchAction','target':{'@type':'EntryPoint','urlTemplate':self.url('thoughts.html')+'?q={search_term_string}#essays'},'query-input':'required name=search_term_string'}}]
        elif path.startswith('work/') and path != 'work/index.html':
            case = next(x for x in self.config['projects'] if 'work/'+x['slug']+'.html' == path)
            work = {'@type':'SoftwareSourceCode' if case.get('code_repository') or case.get('programming_languages') else 'CreativeWork','name':case['name'],'description':description,'author':author,
                    'url':canonical,'image':self.url(og),'dateModified':self.lastmod(path),'keywords':case['stack']}
            # These client systems have no published repository or confirmed source languages.
            # Never manufacture codeRepository/programmingLanguage to satisfy a checklist.
            if case.get('code_repository'):
                work['codeRepository'] = case['code_repository']
            if case.get('programming_languages'):
                work['programmingLanguage'] = case['programming_languages']
            graph += [work, {'@type':'BreadcrumbList','itemListElement':[
                {'@type':'ListItem','position':1,'name':'Home','item':self.url()},
                {'@type':'ListItem','position':2,'name':'Selected work','item':self.url('work/')},
                {'@type':'ListItem','position':3,'name':case['name'],'item':canonical}]}]
        elif old_head:
            match = re.search(r'<script type="application/ld\+json">(.*?)</script>', old_head, re.S)
            original = json.loads(match[1]) if match else {}
            post = {'@type':'BlogPosting', 'headline':fallback_title.split(' | ')[0], 'description':description,
                    'author':author,'publisher':author,'mainEntityOfPage':canonical,'url':canonical,
                    'image':self.url(og),'dateModified':self.lastmod(path)}
            for key in ('datePublished', 'isBasedOn', 'keywords'):
                if key in original:
                    post[key] = original[key]
            graph.append(post)
        if graph:
            data = json.dumps({'@context':'https://schema.org','@graph':graph}, ensure_ascii=False).replace('<','\\u003c')
            tags.append('<script type="application/ld+json">'+data+'</script>')
        self.pages.append({'path':path,'url':canonical,'lastmod':self.lastmod(path), 'title':title, 'description':description, 'og':og, 'indexable':path!='404.html'})
        return title, '\n'.join(tags)

    def finish(self):
        pages = [p for p in self.pages if p['indexable']]
        for p in pages:
            p['images'] = list(ContentImages((ROOT/p['path']).read_text(), p['path']).images.values())
        def save(root, name):
            ET.indent(root, space='  ')
            ET.ElementTree(root).write(ROOT/name, encoding='utf-8', xml_declaration=True)
        def urlset(items, image_only=False):
            root = ET.Element(ET.QName(SM,'urlset'))
            for p in items:
                node = ET.SubElement(root, ET.QName(SM,'url'))
                for key,value in [('loc',p['url']),('lastmod',p['lastmod']),('changefreq','monthly' if image_only else self.config['pages'][p['path']]['changefreq']),('priority','0.3' if image_only else self.config['pages'][p['path']]['priority'])]:
                    ET.SubElement(node,ET.QName(SM,key)).text=value
                for im in p['images']:
                    child = ET.SubElement(node,ET.QName(IM,'image'))
                    for key,value in [('loc',self.url(im['path'])),('title',im['title']),('caption',im.get('caption'))]:
                        if value:
                            ET.SubElement(child,ET.QName(IM,key)).text=value
            return root
        # Both extensions obey the brief's stricter 1,000-images-per-file cap.
        def chunks(items, limit=1000):
            group, count = [], 0
            for p in items:
                # A future page with >1,000 images is continued under the same page URL.
                image_batches = [p['images'][i:i+limit] for i in range(0,len(p['images']),limit)] or [[]]
                for images in image_batches:
                    if group and count+len(images)>limit:
                        yield group; group,count=[],0
                    group.append(dict(p,images=images));count+=len(images)
            if group:
                yield group
        generated = []
        for prefix,items,image_only in [('page',pages,False),('image',[p for p in pages if p['images']],True)]:
            groups = list(chunks(items))
            for i,group in enumerate(groups):
                name=f'{prefix}-sitemap'+(f'-{i+1}' if len(groups)>1 else '')+'.xml'
                save(urlset(group,image_only),name);generated.append((name,max(p['lastmod'] for p in group)))
        index = ET.Element(ET.QName(SM,'sitemapindex'))
        for name,modified in generated:
            node=ET.SubElement(index,ET.QName(SM,'sitemap'))
            ET.SubElement(node,ET.QName(SM,'loc')).text=self.url(name)
            ET.SubElement(node,ET.QName(SM,'lastmod')).text=modified
        save(index,'sitemap.xml')
        # Remove only obsolete generated split files, never user-owned assets.
        for pattern in ('page-sitemap*.xml','image-sitemap*.xml'):
            for old in ROOT.glob(pattern):
                if old.name not in {name for name,_ in generated}:
                    old.unlink()
        robots = ['User-agent: *','Allow: /','','User-agent: Googlebot','Allow: /','Allow: /assets/','','User-agent: Googlebot-Image','Allow: /','Allow: /assets/','']
        robots += ['Sitemap: '+self.url(name) for name in ['sitemap.xml']+[name for name,_ in generated]]
        (ROOT/'robots.txt').write_text('\n'.join(robots)+'\n')
        rss=ET.Element('rss',version='2.0');channel=ET.SubElement(rss,'channel')
        for key,value in [('title','Deepankar Bhadrasen — Project write-ups'),('link',self.url('work/')),('description','Case studies in AI automation for sales, finance and operations.'),('language','en-in')]:
            ET.SubElement(channel,key).text=value
        for project in self.config['projects']:
            p=next(p for p in pages if p['path']=='work/'+project['slug']+'.html')
            item=ET.SubElement(channel,'item')
            for key,value in [('title',project['name']),('link',p['url']),('guid',p['url']),('description',p['description']),('pubDate',format_datetime(datetime.fromisoformat(p['lastmod']).replace(tzinfo=timezone.utc)))]:
                ET.SubElement(item,key).text=value
        save(rss,'projects.xml')
        filename=os.environ.get('GOOGLE_SITE_VERIFICATION_FILENAME','').strip()
        if filename:
            if not re.fullmatch(r'google[a-zA-Z0-9]+\.html',filename):
                raise ValueError('GOOGLE_SITE_VERIFICATION_FILENAME must be a Google-issued googleTOKEN.html basename')
            (ROOT/filename).write_text('google-site-verification: '+filename+'\n')
        report={'base_url':self.base,'environment':self.environment,'pages':pages,'sitemaps':['sitemap.xml']+[name for name,_ in generated], 'verification_meta_enabled':bool(self.verification),'verification_file_enabled':bool(filename)}
        (ROOT/'seo-build.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
        print(f'SEO: {len(pages)} public pages, {sum(len(p["images"]) for p in pages)} image associations; '+', '.join(report['sitemaps']))
