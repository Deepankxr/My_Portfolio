"""Build the static Noir portfolio from the retained content and shared templates.
Run with Python 3; no packages or network are required.
"""
from pathlib import Path
from html import escape
import json
import re
from hashlib import sha256
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / 'content/portfolio.json').read_text())
POSTS = DATA['posts']
CASES = DATA['cases']
SLUGS = ['automated-sales-pipeline','call-grading-system','invoice-parsing-system','finance-document-agent']
SHORT = ['sales','calls','invoices','finance']
NAMES = {'n8n':'n8n','openai':'OpenAI','salesforce':'Salesforce','supabase':'Supabase','mongodb':'MongoDB','pinecone':'Pinecone','gemini':'Gemini','claude-code':'Claude Code','codex':'Codex','claude':'Claude','snowflake':'Snowflake','jira':'Jira','atlassian':'Atlassian','google':'Google','microsoft':'Microsoft 365','mcp':'MCP'}
DESCS = ['From a new lead to a qualified, synced CRM record.','Call recordings become consistent coaching signals.','Invoice data, extracted, validated and written to the database.','Unstructured financial documents become a loan application.']
FLOWS = [[('n8n','New lead'),('openai','Qualify'),('n8n','Follow up'),('salesforce','CRM sync')],[('n8n','Call arrives'),('openai','Score rubric'),('supabase','Store scores'),('n8n','Coach team')],[('n8n','Invoice'),('openai','Extract fields'),('mongodb','Validate'),('mongodb','Write record')],[('gemini','Read files'),('pinecone','Retrieve'),('openai','Reason'),('supabase','Application')]]

def e(s): return escape(str(s), quote=True)
def slug(s): return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
def write(path,text):
    target=ROOT/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(text)
def link(path,p): return p+path
def asset_url(path,p=''):
    version=sha256((ROOT/path).read_bytes()).hexdigest()[:10]
    return f'{p}{path}?v={version}'

def header(p='',active='',home=False):
    return f'''<a class="skip" href="#main">Skip to content</a>
<header class="header {'on-photo' if home else ''}" id="nav"><a class="wordmark" href="{p}index.html" aria-label="Deepankar Bhadrasen, home">Deepankar<span>Bhadrasen</span></a>
<nav aria-label="Main navigation"><a href="{p}index.html#work" {'aria-current="page"' if active=='work' else ''}>Work</a><a href="{p}about/" {'aria-current="page"' if active=='about' else ''}>About</a><a href="{p}thoughts.html" {'aria-current="page"' if active=='thoughts' else ''}>Thoughts</a><a href="{('#contact' if active=='about' or home else p+'index.html#contact')}" class="nav-contact">Work with Me <span aria-hidden="true">↗</span></a></nav>
<button class="menu-toggle" aria-controls="menu" aria-expanded="false" aria-haspopup="dialog">Menu <span aria-hidden="true">＋</span></button></header>'''

def footer(p=''):
    return f'''<footer class="footer wrap" id="footer"><a class="footer-name" href="{p}index.html">Deepankar Bhadrasen</a><div><a href="https://www.linkedin.com/in/deepankarbhadrasen/" target="_blank" rel="noopener">LinkedIn ↗</a><a href="mailto:sales@deepankar.xyz">Email ↗</a><a href="{p}privacy.html">Privacy</a><button data-theme-toggle>Light theme</button><button data-motion-toggle aria-pressed="false">Pause motion</button><a href="#main" class="back-top" aria-label="Back to top">↑</a></div><span class="copyright">© <span data-year>2026</span></span></footer>
<dialog class="mobile-menu" id="menu" aria-label="Navigation"><button class="close-dialog" data-close-menu>Close ×</button><p class="menu-caption">Deepankar Bhadrasen</p><nav aria-label="Mobile navigation"><a href="{p}index.html#work">Work</a><a href="{p}about/">About</a><a href="{p}thoughts.html">Thoughts</a><a href="{p}index.html#contact">Work with Me ↗</a></nav><a class="menu-email" href="mailto:sales@deepankar.xyz">sales@deepankar.xyz</a></dialog><div class="hover-label" aria-hidden="true"></div>'''

def page(path,title,description,body,p='',active='',kind='',home=False,old_head=None):
    canonical='https://deepankar.xyz/'+('' if path=='index.html' else path.replace('index.html',''))
    head = f'''<meta name="description" content="{e(description)}"><meta name="author" content="Deepankar Bhadrasen"><link rel="canonical" href="{canonical}">
<meta property="og:type" content="{'article' if kind=='article-page' else 'website'}"><meta property="og:url" content="{canonical}"><meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(description)}"><meta property="og:image" content="https://deepankar.xyz/assets/og-image.jpg"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="https://deepankar.xyz/assets/og-image.jpg">'''
    if old_head:
        # Preserve each article's canonical metadata, authorship and JSON-LD.
        keep=[]
        for tag in re.findall(r'<meta\b[^>]*>|<link\b[^>]*>|<script type="application/ld\+json">.*?</script>',old_head,re.S):
            if ('description' in tag or 'author' in tag or 'canonical' in tag or 'og:' in tag or 'twitter:' in tag or 'application/ld+json' in tag):keep.append(tag)
        head='\n'.join(keep)
    if home:
        head+='''<script type="application/ld+json">{"@context":"https://schema.org","@type":"Person","name":"Deepankar Bhadrasen","url":"https://deepankar.xyz/","jobTitle":"AI Automation Engineer","worksFor":{"@type":"Organization","name":"TrueHorizon AI"},"address":{"@type":"PostalAddress","addressLocality":"Bhopal","addressCountry":"IN"},"email":"sales@deepankar.xyz","sameAs":["https://www.linkedin.com/in/deepankarbhadrasen/"],"knowsAbout":["AI Automation","n8n","Document Intelligence","Sales Pipeline Automation","AI Agents","Full-Stack Development"]}</script>'''
    result=f'''<!doctype html>
<html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#171717"><title>{e(title)}</title>{head}
<link rel="icon" type="image/svg+xml" href="{p}favicon.svg"><link rel="preload" href="{p}assets/fonts/archivo-variable.ttf" as="font" type="font/ttf" crossorigin><script src="{p}js/noir-theme.js"></script><link rel="stylesheet" href="{asset_url('css/noir.css',p)}">
<script defer src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" integrity="sha384-g4NTh/Iv5PPU4xPyhEWqPcwtNXOvdaDI8LLnyYfyNZOjKJeYQyjzQ9X5275eBjpt" crossorigin="anonymous"></script><script defer src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js" integrity="sha384-Z3REaz79l2IaAZqJsSABtTbhjgOUYyV3p90XNnAPCSHg3EMTz1fouunq9WZRtj3d" crossorigin="anonymous"></script><script defer src="{p}js/config.js"></script><script defer src="{asset_url('js/noir.js',p)}"></script></head>
<body class="{kind}">{header(p,active,home)}<main id="main">{body}</main>{footer(p)}</body></html>'''
    write(path,result)

def photo(src,alt,width,height,cls='',eager=False):
    return f'<img src="{src}" width="{width}" height="{height}" alt="{e(alt)}" class="{cls}" {"fetchpriority=high" if eager else "loading=lazy"} decoding="async">'

def flow(i,p='',cover=False):
    steps=''.join(f'<li><img src="{p}assets/logos/{logo}.svg" alt="" width="30" height="30" loading="lazy"><span>{e(label)}</span></li>' for logo,label in FLOWS[i])
    return f'<div class="flow-illustration flow-{i}" aria-label="Illustrated architecture: {e(CASES[i]["title"])}"><p class="flow-title">{["A lead. A conversation.<br>A real connection.","Better calls.<br>Better coaching.","From a pile of files<br>to useful data.","Read. Retrieve.<br>Reason. Prepare."][i]}</p><ol class="flow-steps">{steps}</ol><p class="flow-caption">{e(CASES[i]["category"])}<span aria-hidden="true">↗</span></p></div>'

def project(i,p=''):
    c=CASES[i]
    return f'''<a class="project reveal" href="{p}work/{SLUGS[i]}.html" data-hover="View project" id="{c['id']}">{flow(i,p,True)}<div class="project-meta"><div><span class="project-category">{e(c['category'])}</span><h3 id="{c['id']}-title">{e(c['title'])}</h3></div><span class="project-arrow" aria-hidden="true">↗</span></div><p class="project-description">{DESCS[i]}</p></a>'''

def essays(items,p=''):
    return ''.join(f'''<a href="{p}blog/{post['slug']}.html" class="essay"><span>{e(post['category'])}<small>{post['minutes']} min read</small></span><h3>{e(post['title'])}</h3><span aria-hidden="true">↗</span></a>''' for post in items)

def contact(p='',about=False):
    prefix='about-' if about else ''
    form_id='about-contact-form' if about else 'contact-form'
    source='about_page' if about else 'landing_page'
    fields=''
    for name,label,kind,placeholder,req in [('name','Name','text','Your name',True),('email','Email','email','your@email.com',True),('role','Your role','text','Head of Operations',False),('company','Company','text','Company name',False)]:
        fields+=f'<div class="form-group"><label for="{prefix}{name}">{label}{"" if req else " <span>(optional)</span>"}</label><input type="{kind}" name="{name}" id="{prefix}{name}" placeholder="{placeholder}" autocomplete="{dict(name="name",email="email",role="organization-title",company="organization")[name]}" {"required" if req else ""}></div>'
    return f'''<section class="contact wrap section" id="contact"><h2 class="reveal">Let's put AI<br>to <span class="accent">work.</span></h2><div class="contact-layout"><div class="contact-intro"><p>I'm available for projects, consulting engagements and speaking opportunities. Tell me what you're working on.</p><a class="email" href="mailto:sales@deepankar.xyz">sales@deepankar.xyz <span aria-hidden="true">↗</span></a><p class="contact-location">Bhopal, India · Available globally</p><a class="text-link" href="https://www.linkedin.com/in/deepankarbhadrasen/" target="_blank" rel="noopener">LinkedIn <span aria-hidden="true">↗</span></a></div>
<form class="contact-form" id="{form_id}" data-source="{source}"><div class="form-fields">{fields}</div><div class="form-group budget-group"><label for="{prefix}budget">Project budget <span>(optional)</span><output for="{prefix}budget" data-budget-value>Not selected</output></label><input type="range" class="budget-range" name="budget" id="{prefix}budget" min="5000" max="50000" step="1000" value="12000" aria-label="Project budget in US dollars"><div class="budget-limits"><span>$5,000</span><span>$50,000+</span></div><div class="budget-chips">{''.join(f'<button type="button" data-budget="{v}" aria-pressed="false">{label}</button>' for v,label in [(6000,'Under $10k'),(12000,'$10k to $20k'),(30000,'$20k to $40k'),(50000,'$50,000+')])}</div></div><div class="form-group"><label for="{prefix}message">Message</label><textarea id="{prefix}message" name="message" rows="4" placeholder="Tell me about your project…" required></textarea></div><p class="form-status" id="{'about-form-status' if about else 'contact-form-status'}" role="status" aria-live="polite"></p><button type="submit" class="submit-button">Send Message <span aria-hidden="true">↗</span></button><p class="form-consent">By sending this, you agree I may use these details to reply to your enquiry. See the <a href="{p}privacy.html">privacy policy</a>.</p></form></div></section>'''

def tools(p=''):
    keys=['n8n','claude-code','codex','claude','openai','gemini','supabase','mongodb','snowflake','pinecone','salesforce','jira','atlassian','google','microsoft','mcp']
    return '<ul class="tool-grid" aria-label="Tools and platforms">'+''.join(f'<li><img src="{p}assets/logos/{k}.svg" width="28" height="28" alt="" loading="lazy"><span>{NAMES[k]}</span></li>' for k in keys)+'</ul>'

hero='''<section class="hero" id="hero" aria-labelledby="hero-title"><div class="hero-media" aria-hidden="true"><picture><source type="image/webp" srcset="assets/hcmc/speaking-960.webp 960w, assets/hcmc/speaking-1600.webp 1600w" sizes="100vw"><img src="assets/hcmc/speaking-1600.jpg" width="1600" height="1067" fetchpriority="high" alt=""></picture></div><div class="hero-shade" aria-hidden="true"></div><div class="hero-content wrap"><span id="hero-name" class="anchor-alias"></span><p class="hero-role">AI automation engineer &amp; founding engineer</p><h1 id="hero-title" aria-label="I build AI systems that do the work."><span class="hero-line"><span>I build <span class="rotate" aria-hidden="true"><span class="rotate-word">AI systems</span></span></span></span><span class="hero-line hero-line-bottom"><a class="portrait-pill" href="about/" data-hover="About me" aria-label="About me: meet Deepankar"><img src="assets/avatar-540.webp" width="540" height="720" alt="Deepankar Bhadrasen"><span class="pill-focus">About me ↗</span></a><span>that do the work<span class="accent">.</span></span></span></h1><div class="hero-bottom"><p>From the first workflow to the product around it.<br>Built for real teams. Built to run.</p><a class="text-link" href="#work">View work <span aria-hidden="true">↘</span></a></div></div></section>'''
intro='''<section class="intro wrap section" id="about-intro"><h2 class="statement reveal">I turn the slow, manual parts of a business into systems that <span class="muted-word">take care of themselves.</span></h2><div class="intro-notes"><p>Most of my work is for Fortune 500 teams: AI agents and end-to-end automation wired into the tools those teams already use.</p><p>As Founding Engineer at <a href="https://truehorizon.ai/" target="_blank" rel="noopener">TrueHorizon AI ↗</a>, I build the infrastructure, the client systems and the product around them.</p></div><div class="proof"><div class="reveal"><strong>20<span>+</span></strong><p>AI agents in production</p></div><div class="reveal"><strong>10<span>+</span></strong><p>End-to-end systems deployed</p></div><div class="reveal"><strong>$2.5<span>M</span></strong><p>ARR at TrueHorizon AI<small>Helped scale it as Founding Engineer</small></p></div></div></section>'''
work='<section class="work wrap section" id="work"><div class="section-heading"><h2 class="reveal" id="work-title">Selected work<span class="accent">.</span></h2><p class="section-copy">Four systems from my work in sales, finance and operations.</p></div><div class="project-grid">'+''.join(project(i)for i in range(4))+'</div><p class="media-note">Illustrated system architectures. No client data is shown.</p></section>'
experience='<section class="experience wrap section" id="experience"><h2 class="reveal" id="experience-title">What I’ve been<br>building<span class="accent">.</span></h2><div class="experience-list">'
for i,x in enumerate(DATA['experience']):
    experience+=f'''<details class="experience-row" {'open' if i==0 else ''}><summary><span class="experience-when">{e(x['when'])}</span><span><strong>{e(x['role'])}</strong><span class="experience-org">{e(x['org'])}</span></span><span class="details-sign" aria-hidden="true">＋</span></summary><div class="experience-details"><p>{e(x['description'])}</p><p class="experience-scope">{e(x['scope'])}</p><p class="experience-outcome">{e(x['outcome'])}</p></div></details>'''
experience+='</div></section>'
speaking=f'''<section class="speaking section" id="speaking"><div class="wrap section-heading"><h2 class="reveal">And sometimes,<br>I build with a room<span class="accent">.</span></h2></div><a href="about/#speaking" class="speaking-image" data-hover="The story">{photo('assets/hcmc/speaking-1600.webp','Deepankar demonstrating a live workflow at the n8n Builders Challenge',1600,1067)}</a><div class="speaking-caption wrap"><p>n8n Builders Challenge<br><span>Ho Chi Minh City · 19 September 2026</span></p><a href="about/#speaking" class="text-link">Read the story <span aria-hidden="true">↗</span></a></div><div class="speaking-details wrap"><p>Live workflow demos on the big screen, followed by hands-on build hours with the teams.</p><p>I’ve also been a guest consultant at a Fortune 500 off-site, helping GTM leaders put AI into practice.</p></div></section>'''
services='''<section class="services wrap section"><h2 class="reveal">Where I can help<span class="accent">.</span></h2><div class="service-list"><a href="work/automated-sales-pipeline.html"><h3>Revenue automation</h3><p>Lead qualification, outreach and CRM integrations that keep sales moving.</p><span aria-hidden="true">↗</span></a><a href="work/invoice-parsing-system.html"><h3>Document intelligence</h3><p>Financial documents and invoices turned into useful, structured data.</p><span aria-hidden="true">↗</span></a><a href="work/call-grading-system.html"><h3>Process &amp; content systems</h3><p>Call grading, content pipelines and workflows built to run in production.</p><span aria-hidden="true">↗</span></a></div></section>'''
about_teaser=f'''<section class="about-teaser wrap section">{photo('assets/hcmc/focus-900.webp','Deepankar working through a build at his laptop',900,1053,'reveal')}<div><h2 class="reveal">Curious first.<br>A builder,<br>ever since<span class="accent">.</span></h2><p>I started building for clients while I was still in college. Today, I build AI systems, develop products and share what I learn.</p><a href="about/" class="text-link">About me <span aria-hidden="true">↗</span></a></div></section>'''
writing='<section class="writing wrap section" id="writing"><span id="thoughts" class="anchor-alias"></span><div class="section-heading"><h2 class="reveal">Thinking out loud<span class="accent">.</span></h2><p class="section-copy">What holds up in production, and what I learn along the way.</p></div>'+essays(POSTS[:3])+'<a href="thoughts.html" class="text-link">All thoughts <span aria-hidden="true">↗</span></a></section>'
page('index.html','Deepankar Bhadrasen | AI Automation Engineer','AI automation engineer and Founding Engineer at TrueHorizon AI. 20+ AI agents and 10+ end-to-end systems in production.',hero+intro+work+experience+speaking+services+about_teaser+writing+contact(),home=True)

# About: preserve the personal story and use only the original photographs.
def about_copy(title):
    item=next(x for x in DATA['about'] if x['title']==title)
    return ''.join('<p>'+e(t)+'</p>' for t in item['paragraphs'])
about=f'''<section class="about-hero" aria-labelledby="about-title"><p class="about-caption">The person behind the systems</p><h1 class="about-name" id="about-title" aria-label="Deepankar"><span>DEEP</span><span>ANKAR</span></h1><div class="about-portrait">{photo('../assets/hcmc/focus-900.webp','Deepankar concentrating on a build at the n8n Builders Challenge',900,1053,eager=True)}<div class="portrait-blend" aria-hidden="true"></div></div><p class="about-summary">An engineer by curiosity.<br>A builder by doing.</p><a href="#story" class="about-story-link text-link">Here’s my story <span aria-hidden="true">↘</span></a></section>
<section class="story-intro wrap section" id="story"><h2 class="statement reveal">It started with a question.<br><span class="muted-word">Could I build something<br>that does this for me?</span></h2><div class="story-prose full-story">{about_copy('How I Got Here')}</div><div class="origin-photos"><figure class="reveal">{photo('../assets/graduation-900.webp','Deepankar graduating from Symbiosis Centre for Management Studies, Pune',900,1200)}<figcaption>Graduating from Symbiosis, Pune.</figcaption></figure><figure class="reveal">{photo('../assets/hcmc/room-1400.webp','Builders working together in Ho Chi Minh City',1400,933)}<figcaption>Learning by building, together.</figcaption></figure></div></section>
<section class="career wrap section"><div class="career-heading"><h2 class="reveal">From client work<br>to a founding team<span class="accent">.</span></h2></div><div class="career-copy">{about_copy('TrueHorizon AI')}<dl class="career-facts"><div><dt>My work</dt><dd>AI agents, automation &amp; product development</dd></div><div><dt>Where it runs</dt><dd>Sales, finance &amp; enterprise operations</dd></div><div><dt>How I build</dt><dd>n8n, Claude Code, Codex, Vue, Node &amp; MongoDB</dd></div></dl></div></section>
<figure class="team-photo wrap reveal">{photo('../assets/whoiam-900.webp','Deepankar with attendees at an enterprise event',900,675)}<figcaption>Sharing a practical approach to AI with enterprise teams.</figcaption></figure>
<section class="who-story wrap section"><h2 class="reveal">What I do<br>every day<span class="accent">.</span></h2><div class="career-copy">{about_copy('Who I Am')}</div></section><figure class="enterprise-photo wrap reveal">{photo('../assets/speaking-1000.webp','Deepankar presenting a practical approach to AI at an enterprise event',1000,750)}<figcaption>Putting AI into practice with enterprise teams.</figcaption></figure>
<section class="story-speaking section" id="speaking"><span id="speaking-story" class="anchor-alias"></span><div class="wrap section-heading"><h2 class="reveal">From my laptop<br>to a room of builders<span class="accent">.</span></h2></div><figure class="wide-story-image">{photo('../assets/hcmc/speaking-1600.webp','Deepankar demonstrating a workflow to the n8n Builders Challenge audience',1600,1067)}</figure><div class="speaking-story-copy wrap"><p class="story-date">Ho Chi Minh City<br>19 September 2026</p><div><p>On 19 September 2026 I spoke at the n8n Builders Challenge in Ho Chi Minh City, Vietnam. I presented live n8n workflows on the big screen to a room of builders, then stayed on the floor through the build hours, working hands-on with the teams on what they were building.</p><p>Alongside client work, I've been invited to speak at enterprise events. I served as a guest consultant at an off-site event hosted by a Fortune 500 company, where I demonstrated how GTM leaders can implement AI practically and accelerate adoption across their teams.</p></div></div><div class="photo-pair wrap"><figure class="reveal">{photo('../assets/hcmc/pitch-800.webp','Deepankar explaining an n8n workflow on screen',800,533)}<figcaption>Walking through the workflow.</figcaption></figure><figure class="reveal">{photo('../assets/hcmc/demo-800.webp','Deepankar demonstrating a workflow at the challenge',800,533)}<figcaption>Working through the build.</figcaption></figure></div></section>
<section class="people wrap section"><div class="section-heading"><h2 class="reveal">Building is better<br>with people<span class="accent">.</span></h2></div><div class="people-grid"><figure class="reveal">{photo('../assets/hcmc/stage-1400.webp','Deepankar with his brother Anshul Namdev at the n8n Builders Challenge',1400,933)}<figcaption>With Anshul at the n8n Builders Challenge.</figcaption></figure><div class="people-copy">{about_copy('Family, Inspiration and Ventures')}<a class="text-link" href="https://qixazow.com/" target="_blank" rel="noopener">Explore Qixazow <span aria-hidden="true">↗</span></a><a class="text-link" href="https://www.linkedin.com/in/anshul-namdev-b149b5329/" target="_blank" rel="noopener">Meet Anshul <span aria-hidden="true">↗</span></a></div></div></section>
<section class="toolkit wrap section"><h2 class="reveal">The tools behind<br>the work<span class="accent">.</span></h2><p class="section-copy">Workflow orchestration, AI models and the platforms teams already use. I build full stack when the system needs a product around it.</p>{tools('../')}<p class="media-note">Plus Fireflies, Apify, and a list that keeps growing.</p></section>{contact('../',True)}'''
page('about/index.html','About | Deepankar Bhadrasen','The story of Deepankar Bhadrasen: from building for clients in college to AI automation, TrueHorizon AI and the n8n community.',about,'../','about','about-page')

# All four projects have full pages, and the index remains a useful destination.
page('work/index.html','Selected Work | Deepankar Bhadrasen','AI agents and automation systems for sales, finance and enterprise operations. Four case studies by Deepankar Bhadrasen.','<section class="page-intro wrap"><p class="page-kicker">Selected work</p><h1>Systems, from<br>input to <span class="accent">outcome.</span></h1><p class="page-lede">Four examples from 10+ end-to-end systems and 20+ AI agents deployed in production, mostly for Fortune 500 clients.</p></section><section class="wrap section work-index"><div class="project-grid">'+''.join(project(i,'../')for i in range(4))+'</div><p class="media-note">Illustrated architectures. No client data is shown.</p></section><section class="venture wrap section"><h2>Beyond client work<span class="accent">.</span></h2><div><h3>THAI UI / TrueHorizon AI</h3><p>I’m building the agents, skills, workflow automation and the product around them, from the Vue interface to Node and MongoDB services.</p><h3>Qixazow</h3><p>A co-founded publication and consultancy on n8n, Claude and bringing AI into real businesses.</p><a class="text-link" href="https://qixazow.com/" target="_blank" rel="noopener">Explore Qixazow <span aria-hidden="true">↗</span></a></div></section><section class="wrap section work-contact"><h2>Have a system in mind<span class="accent">?</span></h2><a class="text-link" href="../index.html#contact">Work with Me <span aria-hidden="true">↗</span></a></section>','../','work','work-page')
for i,c in enumerate(CASES):
    nxt=(i+1)%4
    stacks=''.join(f'<li><img src="../assets/logos/{k}.svg" alt="" width="26" height="26"><span>{NAMES[k]}</span></li>'for k in c['stack'])
    sections=''.join(f'<section class="case-text"><h2>{e(label)}</h2><p>{e(text)}</p></section>' for label,text in c['fields'].items())
    body=f'''<section class="case-hero wrap"><a href="index.html" class="text-link back-link">← Selected work</a><p class="page-kicker">{e(c['category'])}</p><h1>{e(c['title'])}<span class="accent">.</span></h1><div class="case-metadata"><p>{e(c['client'])}</p><p>Architecture · Automation · Implementation</p></div></section><section class="case-cover wrap">{flow(i,'../')}</section><div class="case-content wrap"><aside><p class="case-aside-label">Built with</p><ul class="case-tools">{stacks}</ul><a href="../index.html#contact" class="text-link">Work with Me <span aria-hidden="true">↗</span></a></aside><div>{sections}<section class="case-text"><h2>How the system runs</h2><ol class="case-steps">{''.join(f'<li><span>{n+1:02}</span><div><h3>{e(label)}</h3><p>{e(NAMES[logo])}</p></div></li>'for n,(logo,label)in enumerate(FLOWS[i]))}</ol><p class="media-note">Architecture illustration based on the original portfolio. No client data is shown.</p></section></div></div><section class="next-project wrap section"><p>Next project</p><a href="{SLUGS[nxt]}.html" data-hover="View project"><h2>{e(CASES[nxt]['title'])}</h2><span aria-hidden="true">↗</span></a></section>'''
    page(f'work/{SLUGS[i]}.html',c['title']+' | Deepankar Bhadrasen',DESCS[i],body,'../','work','case-page')

# Searchable archive. Every essay is also present without JavaScript.
categories=list(dict.fromkeys(x['category']for x in POSTS))
archive='''<section class="page-intro writing-intro wrap"><p class="page-kicker">Writing</p><h1>Thinking<br><span class="accent">out loud.</span></h1><p class="page-lede">Notes on agents, automation and what it takes to put AI to work inside a real company. First published on the TrueHorizon AI blog.</p></section>'''
latest=POSTS[0]
archive+=f'''<section class="featured-essay wrap"><a href="blog/{latest['slug']}.html" data-hover="Read essay"><span class="featured-label">Latest essay</span><h2>{e(latest['title'])}</h2><p>{e(latest['excerpt'])}</p><span class="featured-bottom">{e(latest['category'])} · {latest['minutes']} min read <b aria-hidden="true">↗</b></span></a></section><section class="archive wrap section" id="essays" data-archive><div class="archive-controls"><div class="search-field"><label for="essay-search">Find an essay</label><div><input id="essay-search" type="search" placeholder="Search titles, ideas, topics…" maxlength="80" autocomplete="off"><button type="button" data-clear-search aria-label="Clear search">Clear</button></div></div><div class="topic-filters" role="group" aria-label="Filter essays by topic"><button data-topic="all" aria-pressed="true">All <span>{len(POSTS)}</span></button>{''.join(f'<button data-topic="{slug(cat)}" aria-pressed="false">{e(cat)} <span>{sum(x["category"]==cat for x in POSTS)}</span></button>'for cat in categories)}</div></div><div class="archive-count"><h2>All essays</h2><p role="status" aria-live="polite" data-result-count>{len(POSTS)} essays · {sum(x['minutes']for x in POSTS)} minutes of reading</p></div><div class="essay-list">'''
for n,post in enumerate(POSTS):
    archive+=f'''<article class="archive-item" data-essay data-topic="{slug(post['category'])}" data-minutes="{post['minutes']}"><a href="blog/{post['slug']}.html"><span class="essay-number">{n+1:02}</span><div><p class="archive-meta">{e(post['category'])} · {post['minutes']} min read</p><h3>{e(post['title'])}</h3><p class="archive-excerpt">{e(post['excerpt'])}</p></div><span class="archive-arrow" aria-hidden="true">↗</span></a></article>'''
archive+='</div><div class="archive-empty" hidden><h3>No essays found.</h3><p>Try a different phrase or browse all topics.</p><button type="button" data-reset-search>Reset filters ↗</button></div></section>'
page('thoughts.html','Thoughts | Deepankar Bhadrasen','Essays on AI automation, agents and enterprise AI: what holds up in production, what quietly breaks, and how to build systems a business can depend on.',archive,active='thoughts',kind='thoughts-page')

for i,post in enumerate(POSTS):
    article=(ROOT/'content/essays'/f"{post['slug']}.html").read_text()
    heads=[];used=set()
    def heading(match):
        label=re.sub('<[^>]+>','',match.group(2));key=slug(re.sub(r'^\d+[.)]\s*','',label)) or 'section'
        if key in used:key+='-'+str(len(used))
        used.add(key);heads.append((key,label));return f'<h2 id="{key}">{match.group(2)}</h2>'
    article=re.sub(r'<h2([^>]*)>(.*?)</h2>',heading,article,flags=re.S)
    toc=''.join(f'<li><a href="#{key}">{label}</a></li>'for key,label in heads)
    pager=''
    for idx,label,rel in [(i-1,'Previous essay','prev'),(i+1,'Next essay','next')]:
        if 0<=idx<len(POSTS):
            other=POSTS[idx];pager+=f'<a href="{other["slug"]}.html" rel="{rel}"><span>{label}</span><h3>{e(other["title"])}</h3><p>{e(other["category"])} · {other["minutes"]} min read</p></a>'
        else:pager+='<a href="../thoughts.html"><span>The archive</span><h3>All thoughts</h3><p>Browse all 17 essays ↗</p></a>'
    picks=[x for x in POSTS if x['category']==post['category'] and x['slug']!=post['slug']][:3]
    if not picks:picks=[x for x in POSTS if x['slug']!=post['slug']][:2]
    body=f'''<div class="reading-progress" aria-hidden="true"><span></span></div><section class="post-hero wrap"><a href="../thoughts.html" class="text-link back-link">← All thoughts</a><p class="post-meta"><a href="../thoughts.html?topic={slug(post['category'])}#essays">{e(post['category'])}</a><span>{post['minutes']} min read</span><time datetime="{post['date']}">{post['date']}</time></p><h1 class="post-title">{e(post['title'])}</h1><div class="post-byline"><img src="../assets/avatar-540.webp" width="44" height="44" alt=""><p>Deepankar Bhadrasen<span>AI automation engineer &amp; founding engineer</span></p><button type="button" data-copy-link>Copy link ↗</button></div></section><div class="post-layout wrap"><aside class="post-rail"><nav aria-label="On this page"><p>On this page</p><ol>{toc}</ol></nav><a href="#main" class="text-link">Back to top ↑</a></aside><div class="article-column"><details class="mobile-toc"><summary>On this page</summary><ol>{toc}</ol></details><article class="post-body" id="essay">{article}</article><div class="article-share"><p>Found this useful?</p><button type="button" data-copy-link>Copy link ↗</button><span data-copy-status role="status" aria-live="polite"></span></div></div></div><section class="keep-reading wrap section"><h2>Keep reading<span class="accent">.</span></h2><nav class="post-pager" aria-label="Previous and next essay">{pager}</nav><h3 class="related-heading">More to think about</h3>{essays(picks,'../')}</section>'''
    page(f"blog/{post['slug']}.html",post['title']+' | Deepankar Bhadrasen',post['excerpt'],body,'../','thoughts','article-page',old_head=post['head'])

privacy=(ROOT/'content/privacy.html').read_text()
body=f'<section class="post-hero wrap"><a class="text-link back-link" href="index.html">← Back to home</a><p class="post-meta">Legal · Effective 18 August 2026 · Last updated 24 September 2026</p><h1 class="post-title">Privacy Policy<span class="accent">.</span></h1></section><div class="legal-layout wrap"><article class="post-body">{privacy}</article></div>'
page('privacy.html','Privacy Policy | Deepankar Bhadrasen','How Deepankar Bhadrasen handles the personal information you choose to submit through this website.',body,kind='legal-page')

# Keep all original URLs; add the work index and case studies to the sitemap.
ET.register_namespace('', 'http://www.sitemaps.org/schemas/sitemap/0.9')
ns='{http://www.sitemaps.org/schemas/sitemap/0.9}'
tree=ET.parse(ROOT/'sitemap.xml');urls=tree.getroot();existing={x.text for x in urls.findall(f'{ns}url/{ns}loc')}
for path in ['work/']+[f'work/{x}.html'for x in SLUGS]:
    url='https://deepankar.xyz/'+path
    if url not in existing:
        item=ET.SubElement(urls,ns+'url');ET.SubElement(item,ns+'loc').text=url;ET.SubElement(item,ns+'lastmod').text='2026-10-18';ET.SubElement(item,ns+'priority').text='0.8'
for item in urls.findall(ns+'url'):
    url=item.find(ns+'loc').text
    if '/blog/' not in url and not url.endswith('privacy.html'):
        last=item.find(ns+'lastmod')
        if last is not None:last.text='2026-10-18'
ET.indent(tree,space='  ');tree.write(ROOT/'sitemap.xml',encoding='utf-8',xml_declaration=True)
print(f'Built {4+len(POSTS)+5} pages. Retained all {len(POSTS)} essays and original routes.')
