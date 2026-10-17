// Exercise the real form handler without contacting the live enquiry workflow.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/noir.js'),'utf8');
function setup({ok=true,fail=false,endpoint=true,valid=true,page='landing_page'}={}){
 const handlers={},requests=[];
 const blankClass={add(){},remove(){},toggle(){}};
 const fields=Object.fromEntries(Object.entries({name:'Local QA',email:'qa@example.test',role:'',company:'',message:'Local-only test',budget:'12000'}).map(([name,value])=>[name,{name,value,dataset:{},addEventListener(type,fn){handlers[name+':'+type]=fn;},reportValidity(){return valid;},focus(){}}]));
 const status={textContent:'',classList:blankClass},submit={disabled:false,textContent:'Send Message'},output={textContent:'Not selected'};
 const chips=[6000,12000,30000,50000].map(value=>({dataset:{budget:String(value)},setAttribute(){},addEventListener(type,fn){handlers['chip:'+value]=fn;}}));
 const form={dataset:{source:page},querySelector(sel){if(sel==='[data-budget-value]')return output;if(sel==='.form-status')return status;if(sel==='[type=submit]')return submit;const match=sel.match(/^\[name=(\w+)\]$/);return match?fields[match[1]]:null;},querySelectorAll(sel){if(sel==='[data-budget]')return chips;if(sel==='[name=name],[name=message]')return[fields.name,fields.message];return[];},addEventListener(type,fn){handlers['form:'+type]=fn;},reportValidity(){return valid;},reset(){for(const [name,input]of Object.entries(fields))input.value=name==='budget'?'12000':'';}};
 const doc={documentElement:{dataset:{theme:'dark'}},querySelector(){return null;},querySelectorAll(sel){return sel==='.contact-form'?[form]:[];},addEventListener(){},body:{classList:blankClass}};
 const context={document:doc,window:{addEventListener(){}},matchMedia:()=>({matches:true,addEventListener(){}}),localStorage:{getItem(){return null;}},AbortSignal,setTimeout(){},clearInterval(){},setInterval(){},fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});if(fail)throw Error('offline');return{ok};},Date,console};
 if(endpoint)context.WEBHOOK_URL='https://example.test/local-only';
 vm.runInNewContext(source,context);
 return{handlers,requests,fields,status,submit,output,send:()=>handlers['form:submit']({preventDefault(){}})};
}
(async()=>{
 let t=setup();await t.send();assert.equal(t.requests.length,1);assert.equal(t.requests[0].body.budget_value,null);assert.equal(t.requests[0].body.budget,'');assert.equal(t.requests[0].body.source,'landing_page');assert.equal(t.submit.disabled,true);assert.match(t.status.textContent,/received/);assert.deepEqual(Object.keys(t.requests[0].body).sort(),['name','email','role','company','message','budget','budget_value','source','submitted_at'].sort());
 t=setup({page:'about_page'});t.handlers['chip:30000']();await t.send();assert.equal(t.requests[0].body.budget_value,30000);assert.equal(t.requests[0].body.budget,'$30,000');assert.equal(t.requests[0].body.source,'about_page');assert.equal(t.output.textContent,'Not selected');
 t=setup();t.handlers['chip:50000']();await t.send();assert.equal(t.requests[0].body.budget,'$50,000+');
 for(const field of ['name','message']){t=setup();t.fields[field].value='   ';await t.send();assert.equal(t.requests.length,0);}
 t=setup({valid:false});await t.send();assert.equal(t.requests.length,0);
 for(const options of [{ok:false},{fail:true},{endpoint:false}]){t=setup(options);await t.send();assert.equal(t.submit.disabled,false);assert.match(t.status.textContent,/could not be sent/);assert.doesNotMatch(t.status.textContent,/received/);}
 console.log('PASS: payload compatibility, both page sources, optional/selected budget, required fields, success, HTTP/network/unconfigured failures. No network used.');
})().catch(error=>{console.error(error);process.exitCode=1;});
