// Exercise the real form handler without contacting the live enquiry workflow.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/noir.js'),'utf8');
function setup({ok=true,fail=false,endpoint=true,valid=true,page='landing_page',motion=false}={}){
 const handlers={},requests=[];
 const blankClass={add(){},remove(){},toggle(){}};
 const fields=Object.fromEntries(Object.entries({name:'Local QA',email:'qa@example.test',role:'',company:'',message:'Local-only test',budget:'5000'}).map(([name,value])=>[name,{name,value,min:'5000',max:'50000',attributes:{},setAttribute(key,value){this.attributes[key]=value;},dataset:{},addEventListener(type,fn){handlers[name+':'+type]=fn;},reportValidity(){return valid;},focus(){}}]));
 const trackClasses=new Set(),track={style:{values:{},setProperty(key,value){this.values[key]=value;}},classList:{toggle(key,on){on?trackClasses.add(key):trackClasses.delete(key);},remove(key){trackClasses.delete(key);},contains(key){return trackClasses.has(key);}}},fill={style:{}},thumb={style:{}};
 const status={textContent:'',classList:blankClass},submit={disabled:false,textContent:'Send Message'},output={textContent:'Not selected'};
 const chips=[6000,12000,30000,50000].map(value=>({dataset:{budget:String(value)},setAttribute(){},addEventListener(type,fn){handlers['chip:'+value]=fn;}}));
 const form={dataset:{source:page},querySelector(sel){if(sel==='[data-budget-track]')return track;if(sel==='[data-budget-fill]')return fill;if(sel==='[data-budget-thumb]')return thumb;if(sel==='[data-budget-value]')return output;if(sel==='.form-status')return status;if(sel==='[type=submit]')return submit;const match=sel.match(/^\[name=(\w+)\]$/);return match?fields[match[1]]:null;},querySelectorAll(sel){if(sel==='[data-budget]')return chips;if(sel==='[name=name],[name=message]')return[fields.name,fields.message];return[];},addEventListener(type,fn){handlers['form:'+type]=fn;},reportValidity(){return valid;},reset(){for(const [name,input]of Object.entries(fields))input.value=name==='budget'?'5000':'';}};
 const doc={documentElement:{dataset:{theme:'dark'}},querySelector(){return null;},querySelectorAll(sel){return sel==='.contact-form'?[form]:[];},addEventListener(){},body:{classList:blankClass}};
 const context={document:doc,window:{addEventListener(){},...(motion?{gsap:{}}:{})},gsap:{killTweensOf(){},to(){},set(){}},IntersectionObserver:class{observe(){}},matchMedia:()=>({matches:!motion,addEventListener(){}}),localStorage:{getItem(){return null;}},AbortSignal,setTimeout(){},clearInterval(){},setInterval(){},fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});if(fail)throw Error('offline');return{ok};},Date,console};
 if(endpoint)context.WEBHOOK_URL='https://example.test/local-only';
 vm.runInNewContext(source,context);
 return{handlers,requests,fields,status,submit,output,track,fill,thumb,send:()=>handlers['form:submit']({preventDefault(){}})};
}
(async()=>{
 let t=setup();await t.send();assert.equal(t.requests.length,1);assert.equal(t.requests[0].body.budget_value,null);assert.equal(t.requests[0].body.budget,'');assert.equal(t.requests[0].body.source,'landing_page');assert.equal(t.submit.disabled,true);assert.match(t.status.textContent,/received/);assert.deepEqual(Object.keys(t.requests[0].body).sort(),['name','email','role','company','message','budget','budget_value','source','submitted_at'].sort());
 t=setup({page:'about_page'});t.handlers['chip:30000']();await t.send();assert.equal(t.requests[0].body.budget_value,30000);assert.equal(t.requests[0].body.budget,'$30,000');assert.equal(t.requests[0].body.source,'about_page');assert.equal(t.output.textContent,'Not selected');
 t=setup();t.handlers['chip:50000']();assert.equal(t.output.textContent,'$50,000+');assert.equal(t.fields.budget.attributes['aria-valuetext'],'$50,000+');t.fields.budget.value='49000';t.handlers['budget:input']();assert.equal(t.output.textContent,'$49,000');assert.equal(t.fields.budget.attributes['aria-valuetext'],'$49,000');
 t=setup();t.handlers['chip:50000']();await t.send();assert.equal(t.requests[0].body.budget,'$50,000+');assert.equal(t.fields.budget.dataset.touched,undefined);assert.equal(t.fields.budget.attributes['aria-valuetext'],'Not selected');
 // Submit while the visible counter is still animating: serialize the chosen
 // input value, never the intermediate number used to paint the animation.
 t=setup({motion:true});t.handlers['chip:50000']();assert.equal(t.output.textContent,'Not selected');await t.send();assert.equal(t.requests[0].body.budget_value,50000);assert.equal(t.requests[0].body.budget,'$50,000+');
 // The requested charge starts strictly above $40k and reaches full at $50k.
 t=setup();
 for(const [value,boost,active] of [[40000,'0.0000',false],[41000,'0.1000',true],[45000,'0.5000',true],[50000,'1.0000',true],[39000,'0.0000',false]]){t.fields.budget.value=String(value);t.handlers['budget:input']();assert.equal(t.track.style.values['--budget-boost'],boost);assert.equal(t.track.classList.contains('is-boosting'),active);}
 t.handlers['chip:50000']();await t.send();assert.equal(t.track.style.values['--budget-boost'],'0.0000');assert.equal(t.track.classList.contains('is-boosting'),false);
 for(const field of ['name','message']){t=setup();t.fields[field].value='   ';await t.send();assert.equal(t.requests.length,0);}
 t=setup({valid:false});await t.send();assert.equal(t.requests.length,0);
 for(const options of [{ok:false},{fail:true},{endpoint:false}]){t=setup(options);await t.send();assert.equal(t.submit.disabled,false);assert.match(t.status.textContent,/could not be sent/);assert.doesNotMatch(t.status.textContent,/received/);}
 console.log('PASS: payload compatibility, both page sources, optional/selected budget, $40k/$41k/$45k/$50k charge thresholds, keyboard updates, submission during budget animation, required fields, success, HTTP/network/unconfigured failures. No network used.');
})().catch(error=>{console.error(error);process.exitCode=1;});
