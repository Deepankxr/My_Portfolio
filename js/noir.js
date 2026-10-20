(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const html = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches, motionContext, wordTimer, portraitExit, previewController;
  const budgetControllers=[];
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
      if(el.hasAttribute('data-preview'))return;
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
  function syncMotion(){
    if(paused||!motionContext||!window.ScrollTrigger)return;
    ScrollTrigger.refresh();
    // Hash navigation and browser history may restore a position after setup.
    // Resolve the scrub immediately, so no stale hidden state survives a restore.
    if(portraitExit){
      portraitExit.scrollTrigger.update();
      portraitExit.scrollTrigger.getTween()?.progress(1);
      portraitExit.progress(portraitExit.scrollTrigger.progress);
    }
  }
  function initMotion(){
    stopWords();motionContext?.revert();motionContext=null;portraitExit=null;
    html.dataset.motion=paused?'paused':'on';hover?.classList.remove('active');
    previewController?.hide(true);budgetControllers.forEach(control=>control.settle());
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
          // One owner per property. Explicit starting values remain reversible
          // even when this document first opens far below the hero at #speaking.
          // A translated feathered veil supplies the dissolve using only
          // transforms and opacity; neither scroll input nor image scale grows.
          portraitExit=gsap.timeline({
            defaults:{ease:'none'},
            scrollTrigger:{id:'about-portrait-exit',trigger:'.about-hero',start:'top top',end:'bottom 18%',scrub:.35,invalidateOnRefresh:true}
          })
            .fromTo(portrait,{y:0,scale:1,autoAlpha:1},{y:-28,scale:.96,autoAlpha:0,duration:1,ease:'power1.inOut'},0)
            .fromTo('.portrait-dissolve',{y:0,yPercent:52},{yPercent:-52,duration:.9,ease:'power1.inOut'},.04)
            .fromTo('.portrait-blend',{opacity:.12},{opacity:1,duration:.8},.08)
            .fromTo('.about-name span',{x:0,opacity:1},{x:i=>i?22:-22,opacity:0,duration:.6},.04)
            .fromTo('.about-caption,.about-summary,.about-story-link',{y:0,opacity:1},{y:-12,opacity:0,duration:.14,ease:'power1.out'},0);
        }
        if($('.reading-progress'))gsap.to('.reading-progress>span',{scaleX:1,ease:'none',scrollTrigger:{trigger:'.post-body',start:'top 20%',end:'bottom 80%',scrub:true}});
      });
      document.fonts.ready.then(syncMotion);
    }else{
      // No animation dependency may make content inaccessible.
      const portrait=$('.about-portrait');if(portrait)portrait.style.position='absolute';
    }
    startWords();
  }
  $$('[data-motion-toggle]').forEach(b=>b.addEventListener('click',()=>{paused=!paused;initMotion();}));
  reduced.addEventListener('change',event=>{paused=event.matches;initMotion();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopWords();previewController?.hide(true);}else startWords();});
  window.addEventListener('load',syncMotion);
  window.addEventListener('hashchange',syncMotion);
  window.addEventListener('pagehide',()=>{stopWords();previewController?.hide(true);budgetControllers.forEach(control=>control.settle());motionContext?.revert();motionContext=null;portraitExit=null;});
  window.addEventListener('pageshow',event=>{if(event.persisted)initMotion();syncMotion();});
  initMotion();

  // One shared preview follows the pointer across relevant editorial lists.
  // Each preview uses this portfolio's own media or architecture illustrations.
  const preview=$('.list-preview'),previewRows=$$('[data-preview]');
  const finePointer=matchMedia('(hover:hover) and (pointer:fine)');
  if(preview&&previewRows.length&&window.gsap){
    const frame=$('.list-preview-frame',preview),panels=$('.list-preview-panels',preview),caption=$('.list-preview-caption',preview),action=$('.list-preview-action',preview);
    let current=null,lastX=0,keyboardRow=null;
    const moveX=gsap.quickTo(preview,'x',{duration:.42,ease:'power3.out'});
    const moveY=gsap.quickTo(preview,'y',{duration:.42,ease:'power3.out'});
    const tilt=gsap.quickTo(frame,'rotation',{duration:.55,ease:'power3.out'});
    const allowed=()=>!paused&&finePointer.matches;
    function position(event,instant=false){
      const w=preview.offsetWidth,h=preview.offsetHeight;
      const x=Math.max(18,Math.min(innerWidth-w-18,event.clientX-w*.48));
      const y=Math.max(92,Math.min(innerHeight-h-22,event.clientY-h*.52));
      if(instant){moveX(x,x);moveY(y,y);moveX.tween.progress(1);moveY.tween.progress(1);lastX=event.clientX;}
      else{moveX(x);moveY(y);tilt(gsap.utils.clamp(-5,5,(event.clientX-lastX)*.12));lastX=event.clientX;}
    }
    function hide(immediate=false){
      if(!immediate&&!current)return;
      current?.classList.remove('is-previewed');current=null;keyboardRow=null;preview.classList.remove('is-active');
      gsap.to(frame,{autoAlpha:0,scale:.94,rotation:0,duration:immediate?0:.24,overwrite:true,ease:'power2.out'});
      gsap.to(caption,{opacity:0,duration:immediate?0:.18,overwrite:true});
      if(immediate){gsap.killTweensOf([...panels.children]);panels.replaceChildren();}
    }
    function show(row,event){
      if(!allowed())return;
      const template=$('template[data-preview-content]',row);if(!template)return;
      // Adjacent rows share the same moving frame; do not teleport it when a
      // pointerleave and pointerenter arrive together during a fast row change.
      const entering=Number(gsap.getProperty(frame,'opacity'))<.02;
      if(current!==row){
        current?.classList.remove('is-previewed');current=row;row.classList.add('is-previewed');
        const panel=document.createElement('div');panel.className='list-preview-panel';panel.append(template.content.cloneNode(true));
        const previous=[...panels.children],old=previous.slice(-1);
        previous.slice(0,-1).forEach(node=>{gsap.killTweensOf(node);node.remove();});panels.append(panel);
        if(old.length)gsap.to(old,{yPercent:-12,opacity:0,duration:.3,overwrite:true,onComplete:()=>old.forEach(node=>node.remove())});
        gsap.fromTo(panel,{yPercent:18,scale:1.06,opacity:0},{yPercent:0,scale:1,opacity:1,duration:.55,ease:'expo.out'});
        caption.textContent=row.dataset.previewTitle||'';action.textContent=row.dataset.previewAction||'View project ↗';
      }
      position(event,entering);preview.classList.add('is-active');hover?.classList.remove('active');
      gsap.to(frame,{autoAlpha:1,scale:1,duration:.45,ease:'expo.out',overwrite:'auto'});
      gsap.to(caption,{opacity:1,duration:.3,overwrite:true});
    }
    previewRows.forEach(row=>{
      row.addEventListener('pointerenter',event=>{if(!keyboardRow)show(row,event);});
      row.addEventListener('pointermove',event=>{if(!allowed()||(keyboardRow&&!event.movementX&&!event.movementY))return;keyboardRow=null;if(current!==row)show(row,event);else position(event);});
      row.addEventListener('pointerleave',()=>{if(current===row&&keyboardRow!==row)hide();});
      row.addEventListener('click',()=>hide(true));
      row.addEventListener('focusin',()=>{if(!allowed())return;keyboardRow=row;const rect=row.getBoundingClientRect();show(row,{clientX:innerWidth*.74,clientY:rect.top+rect.height/2});});
      row.addEventListener('focusout',()=>hide());
    });
    const warmPreviews=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(!entry.isIntersecting)return;
      if(finePointer.matches)$('template[data-preview-content]',entry.target)?.content.querySelectorAll('img').forEach(source=>{const image=new Image();image.src=source.src;});
      warmPreviews.unobserve(entry.target);
    }),{rootMargin:'250px'});
    previewRows.forEach(row=>warmPreviews.observe(row));
    window.addEventListener('scroll',()=>{
      if(keyboardRow&&document.activeElement===keyboardRow){const rect=keyboardRow.getBoundingClientRect();position({clientX:innerWidth*.74,clientY:rect.top+rect.height/2});}
      else hide();
    },{passive:true});
    window.addEventListener('resize',()=>hide(true));
    window.addEventListener('blur',()=>hide(true));
    document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
    finePointer.addEventListener('change',()=>hide(true));
    previewController={hide};hide(true);
  }

  // Contact: keep the original field names, payload and page sources.
  const formatBudget=value=>Number(value)>=50000?'$50,000+':'$'+Number(value).toLocaleString('en-US');
  $$('.contact-form').forEach(form=>{
    const range=$('[name=budget]',form),output=$('[data-budget-value]',form),status=$('.form-status',form),submit=$('[type=submit]',form);
    const track=$('[data-budget-track]',form),fill=$('[data-budget-fill]',form),thumb=$('[data-budget-thumb]',form),chips=$$('[data-budget]',form);
    const shown={value:Number(range.value)},min=Number(range.min),max=Number(range.max);
    function paintBudget(){
      const touched=range.dataset.touched==='1',position=Math.max(0,Math.min(1,(shown.value-min)/(max-min)));
      const boost=touched?Math.max(0,Math.min(1,(shown.value-40000)/10000)):0;
      output.textContent=touched?formatBudget(Math.round(shown.value)):'Not selected';
      if(fill)fill.style.transform='scaleX('+position+')';if(thumb)thumb.style.left=position*100+'%';
      track?.classList.toggle('is-set',touched);
      track?.classList.toggle('is-boosting',boost>0);
      track?.style.setProperty('--budget-boost',boost.toFixed(4));
    }
    function budget(value,animate=false){
      range.value=value;range.dataset.touched='1';range.setAttribute('aria-valuetext',formatBudget(value));
      track?.classList.toggle('is-max',Number(value)===max);
      chips.forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.budget)===Number(value))));
      if(window.gsap)gsap.killTweensOf(shown);
      if(window.gsap&&!paused&&animate)gsap.to(shown,{value:Number(value),duration:.65,ease:'power3.out',onUpdate:paintBudget});
      else{shown.value=Number(value);paintBudget();}
    }
    function settleBudget(){
      if(window.gsap){gsap.killTweensOf(shown);if(track){gsap.killTweensOf(track);gsap.set(track,{clearProps:'transform'});}}
      shown.value=Number(range.value);paintBudget();
    }
    function resetBudget(){delete range.dataset.touched;range.setAttribute('aria-valuetext','Not selected');track?.classList.remove('is-max');chips.forEach(b=>b.setAttribute('aria-pressed','false'));settleBudget();}
    budgetControllers.push({settle:settleBudget});paintBudget();
    if(track)new IntersectionObserver(entries=>track.classList.toggle('is-in-view',entries[0].isIntersecting)).observe(track);
    range.addEventListener('input',()=>budget(range.value));
    chips.forEach(button=>button.addEventListener('click',()=>budget(button.dataset.budget,true)));
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
        form.reset();resetBudget();
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
