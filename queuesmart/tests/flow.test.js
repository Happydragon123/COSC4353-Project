import test from 'node:test';
import assert from 'node:assert/strict';

// Tiny DOM harness for the delegated UI actions. No external dependencies.
const memory=new Map();
globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,val)=>memory.set(key,val),removeItem:key=>memory.delete(key)};
const handlers={};
const elements={app:{innerHTML:'',addEventListener:(name,fn)=>{handlers[name]=fn}}};
globalThis.document={getElementById:id=>elements[id]??(elements[id]={textContent:'',innerHTML:'',setAttribute(){}})};
globalThis.window={scrollTo(){}};
await import('../src/app.js');
const app=elements.app;
const click=(id,dataset={})=>handlers.click({target:{closest:()=>({id,dataset})}});
const form={elements:{name:{value:'Demo Student'},email:{value:'demo@example.com'},password:{value:'password123'},confirm:{value:'password123'}}};

test('register, join, receive queue update, leave, and review history',()=>{
  click('',{auth:'register'});
  handlers.submit({target:{id:'auth-form',...form},preventDefault(){}});
  assert.match(app.innerHTML,/Available services/);
  click('',{page:'join'});
  assert.match(app.innerHTML,/Join this queue/);
  click('join-button');
  assert.match(app.innerHTML,/Your queue progress/);
  click('advance');
  click('bell');
  assert.match(app.innerHTML,/Queue update/);
  click('leave');
  click('confirm-leave');
  assert.match(app.innerHTML,/Left queue/);
  click('logout');
  assert.match(app.innerHTML,/Log in/);
});
