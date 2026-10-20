"""Regression coverage for sitemap splitting, honest image data and environment handling."""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET
from PIL import Image
import seo


@contextmanager
def fixture():
    with TemporaryDirectory(prefix='noir-seo-') as folder:
        root=Path(folder).resolve();(root/'content').mkdir();(root/'assets').mkdir()
        page={'title':'Test portfolio','description':'A'*145,'priority':'1.0','changefreq':'weekly'}
        (root/'content/seo.json').write_text(json.dumps({'site_url':'https://example.test','social_profiles':['https://example.test/profile'],'pages':{'index.html':page},'projects':[]}))
        Image.new('RGB',(300,250)).save(root/'assets/content-photo.webp')
        Image.new('RGB',(1200,630)).save(root/'assets/card.jpg')
        with patch.object(seo,'ROOT',root),patch.dict(os.environ,{'BUILD_ENV':'production','SITE_URL':'https://example.test','GOOGLE_SITE_VERIFICATION':'','GOOGLE_SITE_VERIFICATION_FILENAME':''}):
            yield root


class BuildSEOTests(unittest.TestCase):
    def test_environment_and_verification(self):
        with fixture() as root:
            with patch.object(seo.SEO,'card',return_value='assets/card.jpg'):
                builder=seo.SEO();title,head=builder.head('index.html','Test')
                self.assertIn('https://example.test/',head)
                self.assertNotIn('google-site-verification',head)
                with patch.dict(os.environ,{'GOOGLE_SITE_VERIFICATION':'test"<&token'}):
                    _,head=seo.SEO().head('index.html','Test')
                    self.assertIn('test&quot;&lt;&amp;token',head)
                with patch.dict(os.environ,{'BUILD_ENV':'preview','SITE_URL':'http://127.0.0.1:8767'}):
                    _,head=seo.SEO().head('index.html','Test')
                    self.assertIn('noindex',head)
                    self.assertIn('<link rel="canonical" href="http://127.0.0.1:8767/">',head)
                with patch.dict(os.environ,{'SITE_URL':'http://example.test'}):
                    with self.assertRaises(ValueError):seo.SEO()
                for invalid in ('https://example.test/subpath','https://user:pass@example.test','https://example.test/?a=1'):
                    with patch.dict(os.environ,{'SITE_URL':invalid}):
                        with self.assertRaises(ValueError):seo.SEO()

    def test_verification_file_is_generated_only_when_configured(self):
        with fixture() as root:
            (root/'index.html').write_text('<h1>Portfolio</h1>')
            builder=seo.SEO();builder.pages=[{'path':'index.html','url':builder.url(),'lastmod':'2026-10-20','indexable':True}]
            builder.finish();self.assertFalse(list(root.glob('google*.html')))
            with patch.dict(os.environ,{'GOOGLE_SITE_VERIFICATION_FILENAME':'googledummytest.html'}):
                builder.finish()
                self.assertEqual((root/'googledummytest.html').read_text(),'google-site-verification: googledummytest.html\n')
            with patch.dict(os.environ,{'GOOGLE_SITE_VERIFICATION_FILENAME':'../arbitrary.html'}):
                with self.assertRaises(ValueError):builder.finish()

    def test_responsive_images_captions_and_exclusions(self):
        with fixture() as root:
            Image.new('RGB',(100,100)).save(root/'assets/tiny-icon.png')
            Image.new('RGB',(600,500)).save(root/'assets/content-photo-large.webp')
            html='''<meta property="og:image" content="https://example.test/assets/card.jpg"><meta property="og:image:alt" content="A real page card"><figure><picture><source type="image/webp" srcset="assets/content-photo.webp 300w, assets/content-photo-large.webp 600w"><img src="assets/content-photo.webp" alt="Builder at work"></picture><figcaption>An actual caption.</figcaption></figure><img src="assets/tiny-icon.png" alt="Tiny icon"><img src="assets/content-photo.webp" alt="">'''
            images=seo.ContentImages(html,'index.html',root).images
            self.assertEqual(set(images),{'assets/card.jpg','assets/content-photo-large.webp'})
            self.assertEqual(images['assets/content-photo-large.webp']['title'],'Builder at work')
            self.assertEqual(images['assets/content-photo-large.webp']['caption'],'An actual caption.')
            self.assertNotIn('caption',images['assets/card.jpg'])

    def test_splitting_and_obsolete_cleanup(self):
        with fixture() as root:
            image=(root/'assets/content-photo.webp').read_bytes()
            for n in range(1001):(root/f'assets/project-image-{n}.webp').write_bytes(image)
            (root/'index.html').write_text(''.join(f'<img src="assets/project-image-{n}.webp" alt="Project {n}">' for n in range(1001)))
            builder=seo.SEO()
            builder.pages=[{'path':'index.html','url':builder.url(),'lastmod':'2026-10-20','indexable':True}]
            builder.finish()
            ns={'s':seo.SM,'im':seo.IM}
            index=ET.parse(root/'sitemap.xml').getroot()
            files=[x.text.removeprefix(builder.base) for x in index.findall('s:sitemap/s:loc',ns)]
            self.assertEqual(set(files),{'page-sitemap-1.xml','page-sitemap-2.xml','image-sitemap-1.xml','image-sitemap-2.xml'})
            for file in files:
                self.assertLessEqual(len(ET.parse(root/file).getroot().findall('.//im:image',ns)),1000)
                self.assertIn('Sitemap: '+builder.url(file),(root/'robots.txt').read_text())
            (root/'index.html').write_text('<img src="assets/content-photo.webp" alt="Builder at work">')
            builder.finish()
            self.assertTrue((root/'page-sitemap.xml').is_file())
            self.assertTrue((root/'image-sitemap.xml').is_file())
            self.assertFalse((root/'image-sitemap-2.xml').exists())

    def test_git_date_and_build_date_fallback(self):
        with fixture() as root:
            builder=seo.SEO();self.assertEqual(builder.lastmod('index.html'),builder.today)
            subprocess.run(['git','init','-q'],cwd=root,check=True)
            (root/'index.html').write_text('<h1>Portfolio</h1>')
            subprocess.run(['git','add','.'],cwd=root,check=True)
            with patch.dict(os.environ,{'GIT_AUTHOR_DATE':'2020-03-04T12:00:00Z','GIT_COMMITTER_DATE':'2020-03-04T12:00:00Z'}):
                subprocess.run(['git','-c','user.name=Local SEO Test','-c','user.email=seo@example.test','-c','commit.gpgsign=false','commit','-qm','Fixture'],cwd=root,check=True)
            self.assertEqual(builder.lastmod('index.html'),'2020-03-04')
            (root/'index.html').write_text('<h1>Changed portfolio</h1>')
            self.assertEqual(builder.lastmod('index.html'),builder.today)


if __name__=='__main__':unittest.main(verbosity=2)
