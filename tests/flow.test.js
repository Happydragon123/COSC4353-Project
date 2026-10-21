import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../src/backend/http.js';

const memory=new Map();
globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,val)=>memory.set(key,val),removeItem:key=>memory.delete(key)};
globalThis.fetch = async (url, options = {}) => {
  const pathname = new URL(url, 'http://localhost').pathname;
  const result = handleApi({
    method: options.method || 'GET',
    pathname,
    headers: options.headers || {},
    body: options.body ? JSON.parse(options.body) : null
  });
  return {
    ok: result.status >= 200 && result.status < 300,
    status: result.status,
    json: async () => result.body ?? {}
  };
};
const handlers={};
const elements={app:{innerHTML:'',addEventListener:(name,fn)=>{handlers[name]=fn}}};
globalThis.document={getElementById:id=>elements[id]??(elements[id]={textContent:'',innerHTML:'',setAttribute(){},focus(){}})};
globalThis.window={scrollTo(){}};
await import('../src/app.js');
const app=elements.app;
const click=(id,dataset={})=>handlers.click({target:{closest:()=>({id,dataset})}});
const form={elements:{name:{value:'Demo Student'},email:{value:'demo@example.com'},password:{value:'password123'},confirm:{value:'password123'}}};

test('register, join, receive join notification, leave, and review history', async ()=>{
  click('',{auth:'register'});
  await handlers.submit({target:{id:'auth-form',...form},preventDefault(){}});
  assert.match(app.innerHTML,/Available services/);
  click('',{page:'join'});
  assert.match(app.innerHTML,/Join this queue/);
  click('join-button');
  assert.match(app.innerHTML,/Your queue progress/);
  click('bell');
  assert.match(app.innerHTML,/You joined the/);
  click('leave');
  click('confirm-leave');
  assert.match(app.innerHTML,/Left queue/);
  await click('logout');
  assert.match(app.innerHTML,/Log in/);
});

test('seeded admin lands on the admin portal', async ()=>{
  const adminForm={elements:{email:{value:'admin@queuesmart.local'},password:{value:'admin1234'}}};
  await handlers.submit({target:{id:'auth-form',...adminForm},preventDefault(){}});
  assert.match(app.innerHTML,/ADMIN PORTAL/);
  await click('logout');
  assert.match(app.innerHTML,/Log in/);
});

test('admin can manage a service queue', async () => {
  const adminForm = {elements: {email: {value: 'admin@queuesmart.local'}, password: {value:'admin1234'}}};
  await handlers.submit({target: {id: 'auth-form', ...adminForm}, preventDefault() {}});
  click('', {page: 'admin-queue'});
  assert.match(app.innerHTML, /Queue Management/);
  assert.match(app.innerHTML, /Mock User 1/);
  click('', {action: 'serve-next', serviceId: 'advising'});
  assert.doesNotMatch(app.innerHTML, /mockuser1@example.com/);
  await click('logout');
  assert.match(app.innerHTML, /Log in/);
});

const {SERVICES} = await import('../src/data/services.js');
const {state} = await import('../src/shared/state.js');
const {validateService} = await import('../src/features/admin/service-actions.js');
const {adminQueue} = await import('../src/data/store.js');
const {serveNextUser, removeQueueUser, moveQueueUser} = await import('../src/features/admin/queue-actions.js');
const validService = {name:' New Service ', description:' Help with questions. ', expectedDuration:'12.5', priority:'high'};
const serviceForm = values => ({id:'service-form', elements:Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{value}]))});
const submitServiceForm = values => handlers.submit({target:serviceForm(values),preventDefault(){}});
const loginAdmin = () => handlers.submit({target:{id:'auth-form',elements:{email:{value:'admin@queuesmart.local'},password:{value:'admin1234'}}},preventDefault(){}});

test('service validation handles blanks, name limits, durations, and priority', () => {
  assert.deepEqual(validateService(validService), {
    values:{name:'New Service',description:'Help with questions.',expectedDuration:12.5,priority:'high'}, errors:{}
  });
  for (const name of ['', '   ', 'x'.repeat(101)]) {
    assert.ok(validateService({...validService,name}).errors.name);
  }
  assert.deepEqual(validateService({...validService,name:'x'.repeat(100)}).errors, {});
  for (const description of ['', '   ']) {
    assert.ok(validateService({...validService,description}).errors.description);
  }
  for (const expectedDuration of ['', '  ', '0', '-1', 'NaN', 'Infinity', '1e999', 'abc']) {
    assert.ok(validateService({...validService,expectedDuration}).errors.expectedDuration);
  }
  for (const priority of ['low','medium','high']) {
    assert.deepEqual(validateService({...validService,priority}).errors, {});
  }
  for (const priority of ['', 'urgent', 'HIGH']) {
    assert.ok(validateService({...validService,priority}).errors.priority);
  }
});

test('invalid service inputs remain visible and cancel leaves data unchanged', async () => {
  await loginAdmin();
  click('', {page:'admin-services'});
  click('', {action:'edit-service',serviceId:'advising'});
  const before = JSON.stringify(SERVICES);
  const values = {name:'  Changed name  ',description:'   ',expectedDuration:'-2',priority:'high'};
  await submitServiceForm(values);
  assert.equal(JSON.stringify(SERVICES), before);
  assert.deepEqual(state.serviceForm.values, values);
  assert.match(app.innerHTML,/value="  Changed name  "/);
  assert.match(app.innerHTML,/Enter a description/);
  assert.match(app.innerHTML,/number of minutes greater than zero/);
  assert.match(app.innerHTML,/aria-invalid="true"/);
  click('', {action:'cancel-service-form'});
  assert.equal(state.serviceForm, null);
  assert.equal(JSON.stringify(SERVICES), before);
  await click('logout');
});

test('create and edit services through delegated events and use new IDs in queue screens', async () => {
  await loginAdmin();
  click('', {page:'admin-services'});
  const originalLength = SERVICES.length;
  const storedBefore = new Map(memory);
  const editedId = SERVICES[0].id;
  click('', {action:'create-service'});
  assert.match(app.innerHTML,/type="submit">Save/);
  await submitServiceForm(validService);
  const created = SERVICES.at(-1);
  assert.equal(SERVICES.length, originalLength + 1);
  assert.equal(new Set(SERVICES.map(s=>s.id)).size, SERVICES.length);
  assert.deepEqual({...created,id:undefined}, {id:undefined,name:'New Service',description:'Help with questions.',expectedDuration:12.5,priority:'high',icon:'▤',wait:0,length:0,open:true});
  assert.equal(state.serviceForm, null);
  assert.match(app.innerHTML,/New Service/);
  assert.equal(state.toast, 'Service created.');
  assert.deepEqual(memory, storedBefore);

  click('', {action:'create-service'});
  await submitServiceForm({...validService,name:'Second service'});
  assert.notEqual(SERVICES.at(-1).id, created.id);
  click('', {page:'admin-dashboard'});
  assert.match(app.innerHTML,/New Service/);
  click('', {page:'admin-queue'});
  click('', {adminService:created.id});
  assert.match(app.innerHTML,/No one is waiting/);
  assert.deepEqual(adminQueue(created.id), []);
  assert.equal(serveNextUser(created.id), null);
  assert.equal(removeQueueUser(created.id,'missing'), null);
  assert.equal(moveQueueUser(created.id,'missing','up'), null);

  click('', {page:'admin-services'});
  click('', {action:'edit-service',serviceId:editedId});
  assert.match(app.innerHTML,/value="Academic Advising"/);
  await submitServiceForm({...validService,name:' Updated Advising ',priority:'low'});
  const updated = SERVICES.find(service => service.id === editedId);
  assert.equal(updated.name, 'Updated Advising');
  assert.equal(updated.priority, 'low');
  assert.equal(state.toast, 'Service updated.');
  assert.match(app.innerHTML,/Updated Advising/);

  await click('logout');
  await handlers.submit({target:{id:'auth-form',elements:{email:{value:'demo@example.com'},password:{value:'password123'}}},preventDefault(){}});
  click('', {quickjoin:created.id});
  assert.match(app.innerHTML,/New Service/);
  click('join-button');
  assert.match(app.innerHTML,/Your queue progress/);
  click('advance');
  assert.match(app.innerHTML,/Served/);
  assert.match(app.innerHTML,/New Service/);
  await click('logout');
});

test('existing queue simulation still advances, notifies, and records served history', async () => {
  for (let index = 0; index < 3; index++) {
    const registered = handleApi({
      method: 'POST',
      pathname: '/api/auth/register',
      body: {
        name: `Waiting Student ${index}`,
        email: `waiting${index}@example.com`,
        password: 'password123',
        confirm: 'password123'
      }
    });
    assert.equal(registered.status, 201);
    const joined = handleApi({
      method: 'POST',
      pathname: '/api/queues/advising',
      headers: {authorization: `Bearer ${registered.body.token}`},
      body: {}
    });
    assert.equal(joined.status, 201);
  }

  await handlers.submit({
    target: {
      id: 'auth-form',
      elements: {
        email: {value: 'demo@example.com'},
        password: {value: 'password123'}
      }
    },
    preventDefault() {}
  });

  const {currentData} = await import('../src/data/store.js');
  click('', {quickjoin: 'advising'});
  click('join-button');
  assert.equal(currentData().queue.position, 4);

  click('advance');
  assert.equal(currentData().queue.position, 3);
  assert.match(currentData().notifications[0].text, /Queue update/);

  click('advance');
  assert.equal(currentData().queue.position, 2);
  assert.match(currentData().notifications[0].text, /Almost ready/);

  click('advance');
  click('advance');
  assert.equal(currentData().queue, null);
  assert.equal(currentData().history[0].outcome, 'Served');
  assert.match(app.innerHTML, /Served/);
  await click('logout');
});
