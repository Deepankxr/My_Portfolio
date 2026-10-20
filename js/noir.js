(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const html = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches, motionContext, wordTimer;
  $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

  const menu=$('#menu'), toggle=$('.menu-toggle');
  const lockMenu = () => {
    const open=!!menu?.open;
    document.body.classList.toggle('dialog-open',open);
    toggle?.setAttribute('aria-expanded',String(open));
  };
  toggle?.addEventListener('click',()=>{menu.showModal();lockMenu();});
  $('[data-close-menu]')?.addEventListener('click',()=>menu.close());
  menu?.addEventListener('close',()=>{lockMenu();toggle?.focus({preventScroll:true});});
  menu?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>menu.close()));
  // Header changes surface when the photograph leaves the top of the viewport.
  const nav=$('.header'),hero=$('.hero');
  if(hero)new IntersectionObserver(entries=>nav.classList.toggle('is-solid',!entries[0].isIntersecting),{rootMargin:'-80px 0px 0px 0px',threshold:0}).observe(hero);
  else nav?.classList.add('is-solid');

  const theme=$('[data-theme-toggle]');
  function themeLabel(){if(theme)theme.textContent=html.dataset.theme==='light'?'Dark theme':'Light theme';}
  theme?.addEventListener('click',()=>{
    html.dataset.theme=html.dataset.theme==='light'?'dark':'light';
    try{localStorage.setItem('theme',html.dataset.theme);}catch(_){}
    themeLabel();
  });themeLabel();

  const hover=$('.hover-label');
  if(hover&&matchMedia('(hover:hover) and (pointer:fine)').matches){
    $$('[data-hover]').forEach(el=>{
      el.addEventListener('pointerenter',event=>{if(paused)return;hover.textContent=el.dataset.hover;hover.style.left=event.clientX+'px';hover.style.top=event.clientY+'px';hover.classList.add('active');});
      el.addEventListener('pointermove',event=>{hover.style.left=event.clientX+'px';hover.style.top=event.clientY+'px';});
      ['pointerleave','click'].forEach(type=>el.addEventListener(type,()=>hover.classList.remove('active')));
    });
  }

  const word=$('.rotate-word'),words=['AI systems','AI agents','automations','products'];let wordIndex=0;
  function stopWords(){clearInterval(wordTimer);wordTimer=null;}
  function startWords(){
    stopWords();if(!word||paused||document.hidden)return;
    wordTimer=setInterval(()=>{
      const next=()=>{wordIndex=(wordIndex+1)%words.length;word.textContent=words[wordIndex];word.animate([{transform:'translateY(100%)',opacity:0},{transform:'translateY(0)',opacity:1}],{duration:650,easing:'cubic-bezier(.16,1,.3,1)',fill:'none'});};
      const out=word.animate([{transform:'translateY(0)',opacity:1},{transform:'translateY(-110%)',opacity:0}],{duration:300,easing:'ease-in'});out.onfinish=next;
    },3600);
  }
  function initMotion(){
    stopWords();motionContext?.revert();motionContext=null;
    html.dataset.motion=paused?'paused':'on';hover?.classList.remove('active');
    $$('[data-motion-toggle]').forEach(b=>{b.textContent=paused?'Play motion':'Pause motion';b.setAttribute('aria-pressed',String(paused));});
    word?.getAnimations().forEach(a=>a.cancel());if(word){word.textContent=words[0];wordIndex=0;}
    if(paused){$('.about-portrait')?.removeAttribute('style');return;}
    // Let the browser own wheel, trackpad and touch scrolling. GSAP observes
    // native scroll positions without intercepting input or writing scrollY.
    if(window.gsap&&window.ScrollTrigger){
      gsap.registerPlugin(ScrollTrigger);
      motionContext=gsap.context(()=>{
        if(hero)gsap.from('.hero-role,.hero-line>span,.portrait-pill,.hero-bottom',{y:30,opacity:0,duration:1.1,stagger:.08,ease:'expo.out',clearProps:'transform,opacity'});
        gsap.utils.toArray('.reveal').forEach(el=>gsap.from(el,{y:30,opacity:0,duration:1,ease:'expo.out',scrollTrigger:{trigger:el,start:'top 94%',once:true},clearProps:'transform,opacity'}));
        const portrait=$('.about-portrait');
        if(portrait){
          gsap.from('.about-name span',{x:i=>i?35:-35,opacity:0,duration:1.2,ease:'expo.out'});
          gsap.timeline({scrollTrigger:{trigger:'.about-hero',start:'top top',end:'bottom top',scrub:.65}})
            .to(portrait,{x:()=>innerWidth*(innerWidth<768?.08:.18),y:()=>innerHeight*.08,scale:.94,opacity:.08,duration:1,ease:'none'},0)
            .to('.portrait-blend',{opacity:.9,duration:1,ease:'none'},0)
            .to('.about-name',{opacity:0,y:-35,duration:.5,ease:'none'},0)
            .to('.about-caption,.about-summary,.about-story-link',{opacity:0,duration:.2,ease:'none'},0);
          gsap.to(portrait,{autoAlpha:0,ease:'none',scrollTrigger:{trigger:'#story',start:'top 20%',end:'top top',scrub:true}});
        }
        if($('.reading-progress'))gsap.to('.reading-progress>span',{scaleX:1,ease:'none',scrollTrigger:{trigger:'.post-body',start:'top 20%',end:'bottom 80%',scrub:true}});
      });
      document.fonts.ready.then(()=>ScrollTrigger.refresh());
    }else{
      // No animation dependency may make content inaccessible.
      const portrait=$('.about-portrait');if(portrait)portrait.style.position='absolute';
    }
    startWords();
  }
  $$('[data-motion-toggle]').forEach(b=>b.addEventListener('click',()=>{paused=!paused;initMotion();}));
  reduced.addEventListener('change',event=>{paused=event.matches;initMotion();});
  document.addEventListener('visibilitychange',()=>document.hidden?stopWords():startWords());
  window.addEventListener('pagehide',()=>{stopWords();motionContext?.revert();});
  initMotion();

  // Contact: keep the original field names, payload and page sources.
  const formatBudget=value=>Number(value)>=50000?'$50,000+':'$'+Number(value).toLocaleString('en-US');
  $$('.contact-form').forEach(form=>{
    const range=$('[name=budget]',form),output=$('[data-budget-value]',form),status=$('.form-status',form),submit=$('[type=submit]',form);
    function budget(value){range.value=value;range.dataset.touched='1';output.textContent=formatBudget(value);$$('[data-budget]',form).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.budget===String(value))));}
    range.addEventListener('input',()=>budget(range.value));
    $$('[data-budget]',form).forEach(button=>button.addEventListener('click',()=>budget(button.dataset.budget)));
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      for(const input of $$('[name=name],[name=message]',form)){if(!input.value.trim()){input.value='';input.reportValidity();input.focus();return;}}
      if(!form.reportValidity())return;
      submit.disabled=true;submit.textContent='Sending…';status.textContent='';status.classList.remove('error');
      const touched=range.dataset.touched==='1';
      const values=Object.fromEntries(['name','email','role','company','message'].map(key=>[key,$('[name='+key+']',form).value.trim()]));
      const data={...values,budget:touched?formatBudget(range.value):'',budget_value:touched?Number(range.value):null,source:form.dataset.source,submitted_at:new Date().toISOString()};
      try{
        if(typeof WEBHOOK_URL==='undefined'||!WEBHOOK_URL)throw new Error('No endpoint');
        const response=await fetch(WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(20000)});
        if(!response.ok)throw new Error('Submission failed');
        form.reset();delete range.dataset.touched;output.textContent='Not selected';$$('[data-budget]',form).forEach(b=>b.setAttribute('aria-pressed','false'));
        status.textContent='Your message was received. I’ll get back to you by email.';submit.textContent='Message sent ✓';
        // Prevent a second submission until the visitor edits the form again.
        form.addEventListener('input',()=>{submit.disabled=false;submit.textContent='Send Message ↗';},{once:true});
      }catch(_){status.textContent='Your message could not be sent. Please try again, or email sales@deepankar.xyz directly.';status.classList.add('error');submit.disabled=false;submit.textContent='Send Message ↗';}
    });
  });

  // Archive filters are shareable and restore correctly with browser history.
  const archive=$('[data-archive]');
  if(archive){
    const search=$('#essay-search'),rows=$$('[data-essay]',archive),buttons=$$('.topic-filters [data-topic]',archive),count=$('[data-result-count]',archive),empty=$('.archive-empty',archive),clear=$('[data-clear-search]');
    const categories=new Set(buttons.map(b=>b.dataset.topic));let topic='all';
    function render(update=true,push=false){
      const q=search.value.trim().toLocaleLowerCase(),query=q.normalize('NFD').replace(/[\u0300-\u036f]/g,'');let visible=0,minutes=0;
      rows.forEach(row=>{const text=row.textContent.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');const show=(topic==='all'||row.dataset.topic===topic)&&text.includes(query);row.hidden=!show;if(show){visible++;minutes+=Number(row.dataset.minutes);}});
      buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.topic===topic)));count.textContent=visible+' '+(visible===1?'essay':'essays')+' · '+minutes+' minutes of reading';empty.hidden=visible>0;clear.disabled=!q;
      if(update){const url=new URL(location.href);topic==='all'?url.searchParams.delete('topic'):url.searchParams.set('topic',topic);q?url.searchParams.set('q',search.value.trim()):url.searchParams.delete('q');history[push?'pushState':'replaceState'](null,'',url);}
      window.ScrollTrigger?.refresh();
    }
    function readUrl(){const params=new URLSearchParams(location.search);const t=params.get('topic')||'all';topic=categories.has(t)?t:'all';search.value=(params.get('q')||'').slice(0,80);render(false);}
    search.addEventListener('input',()=>render());buttons.forEach(b=>b.addEventListener('click',()=>{topic=b.dataset.topic;render(true,true);}));
    clear.addEventListener('click',()=>{search.value='';render();search.focus();});
    $('[data-reset-search]')?.addEventListener('click',()=>{topic='all';search.value='';render();search.focus();});
    window.addEventListener('popstate',readUrl);readUrl();
  }

  $$('[data-copy-link]').forEach(button=>button.addEventListener('click',async()=>{
    try{const url=$('link[rel=canonical]')?.href||location.href;await navigator.clipboard.writeText(url);button.textContent='Link copied ✓';const status=$('[data-copy-status]');if(status)status.textContent='Link copied to clipboard.';setTimeout(()=>button.textContent='Copy link ↗',2500);}catch(_){button.textContent='Copy the address from your browser';}
  }));
  const sections=$$('.post-body>h2'),tocLinks=$$('.post-rail a[href^="#"]');
  if(sections.length&&tocLinks.length){
    const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting);if(!visible.length)return;const id=visible[0].target.id;tocLinks.forEach(a=>{if(a.hash==='#'+id)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});},{rootMargin:'-100px 0px -65% 0px'});sections.forEach(h=>observer.observe(h));
  }
})();
