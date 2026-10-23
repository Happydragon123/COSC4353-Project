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
  await click('',{auth:'register'});
  await handlers.submit({target:{id:'auth-form',...form},preventDefault(){}});
  assert.match(app.innerHTML,/Available services/);
  await click('',{page:'join'});
  assert.match(app.innerHTML,/Join this queue/);
  await click('join-button');
  assert.match(app.innerHTML,/Your queue progress/);
  await click('bell');
  assert.match(app.innerHTML,/You joined the/);
  await click('leave');
  await click('confirm-leave');
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
  await click('', {page: 'admin-queue'});
  assert.match(app.innerHTML, /Queue Management/);
  const registered = handleApi({method:'POST',pathname:'/api/auth/register',body:{name:'Queue Visitor',email:'visitor@example.com',password:'password123',confirm:'password123'}});
  handleApi({method:'POST',pathname:'/api/queues/advising',headers:{authorization:`Bearer ${registered.body.token}`},body:{}});
  await click('', {page:'admin-queue'});
  assert.match(app.innerHTML, /Queue Visitor/);
  await click('', {action: 'serve-next', serviceId: 'advising'});
  assert.doesNotMatch(app.innerHTML, /visitor@example.com/);
  await click('logout');
  assert.match(app.innerHTML, /Log in/);
});

const {SERVICES} = await import('../src/data/services.js');
const {state} = await import('../src/shared/state.js');
const {validateService} = await import('../src/features/admin/service-actions.js');
const {adminQueue} = await import('../src/data/store.js');
const {serveNextUser} = await import('../src/features/admin/queue-actions.js');
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
  await click('', {page:'admin-services'});
  await click('', {action:'edit-service',serviceId:'advising'});
  const before = JSON.stringify(SERVICES);
  const values = {name:'  Changed name  ',description:'   ',expectedDuration:'-2',priority:'high'};
  await submitServiceForm(values);
  assert.equal(JSON.stringify(SERVICES), before);
  assert.deepEqual(state.serviceForm.values, values);
  assert.match(app.innerHTML,/value="  Changed name  "/);
  assert.match(app.innerHTML,/Enter a description/);
  assert.match(app.innerHTML,/number of minutes greater than zero/);
  assert.match(app.innerHTML,/aria-invalid="true"/);
  await click('', {action:'cancel-service-form'});
  assert.equal(state.serviceForm, null);
  assert.equal(JSON.stringify(SERVICES), before);
  await click('logout');
});

test('create and edit services through delegated events and use new IDs in queue screens', async () => {
  await loginAdmin();
  await click('', {page:'admin-services'});
  const originalLength = SERVICES.length;
  const storedBefore = new Map(memory);
  const editedId = SERVICES[0].id;
  await click('', {action:'create-service'});
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

  await click('', {action:'create-service'});
  await submitServiceForm({...validService,name:'Second service'});
  assert.notEqual(SERVICES.at(-1).id, created.id);
  await click('', {page:'admin-dashboard'});
  assert.match(app.innerHTML,/New Service/);
  await click('', {page:'admin-queue'});
  await click('', {adminService:created.id});
  assert.match(app.innerHTML,/No one is waiting/);
  assert.deepEqual(adminQueue(created.id), []);
  await assert.rejects(serveNextUser(created.id), {status:409});

  await click('', {page:'admin-services'});
  await click('', {action:'edit-service',serviceId:editedId});
  assert.match(app.innerHTML,/value="Academic Advising"/);
  await submitServiceForm({...validService,name:' Updated Advising ',priority:'low'});
  const updated = SERVICES.find(service => service.id === editedId);
  assert.equal(updated.name, 'Updated Advising');
  assert.equal(updated.priority, 'low');
  assert.equal(state.toast, 'Service updated.');
  assert.match(app.innerHTML,/Updated Advising/);

  await click('logout');
  await handlers.submit({target:{id:'auth-form',elements:{email:{value:'demo@example.com'},password:{value:'password123'}}},preventDefault(){}});
  await click('', {quickjoin:created.id});
  assert.match(app.innerHTML,/New Service/);
  await click('join-button');
  assert.match(app.innerHTML,/Your queue progress/);
  const staff = handleApi({method:'POST',pathname:'/api/auth/login',body:{email:'admin@queuesmart.local',password:'admin1234'}}).body.token;
  handleApi({method:'POST',pathname:`/api/queues/${created.id}/serve`,headers:{authorization:`Bearer ${staff}`}});
  await click('', {page:'history'});
  assert.match(app.innerHTML,/Served/);
  assert.match(app.innerHTML,/New Service/);
  await click('logout');
});

test('server queue movement refreshes notifications and served history', async () => {
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
  await click('', {quickjoin: 'advising'});
  await click('join-button');
  assert.equal(currentData().queue.position, 4);

  const staff = handleApi({method:'POST',pathname:'/api/auth/login',body:{email:'admin@queuesmart.local',password:'admin1234'}}).body.token;
  const serve = () => handleApi({method:'POST',pathname:'/api/queues/advising/serve',headers:{authorization:`Bearer ${staff}`}});
  serve();
  await click('refresh-queue');
  assert.equal(currentData().queue.position, 3);
  serve();
  await click('refresh-queue');
  assert.equal(currentData().queue.position, 2);
  assert.match(currentData().notifications[0].text, /Almost ready/);
  await click('mark-read');
  assert.ok(currentData().notifications.every(n => n.read));
  serve();
  serve();
  await click('', {page:'history'});
  assert.equal(currentData().queue, null);
  assert.equal(currentData().history[0].outcome, 'Served');
  assert.match(app.innerHTML, /Served/);
  await click('logout');
});
