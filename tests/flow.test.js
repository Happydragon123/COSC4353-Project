import test from 'node:test';
import assert from 'node:assert/strict';

// Tiny DOM harness for the delegated UI actions. No external dependencies.
const memory=new Map();
globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,val)=>memory.set(key,val),removeItem:key=>memory.delete(key)};
const handlers={};
const elements={app:{innerHTML:'',addEventListener:(name,fn)=>{handlers[name]=fn}}};
globalThis.document={getElementById:id=>elements[id]??(elements[id]={textContent:'',innerHTML:'',setAttribute(){},focus(){}})};
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

test('seeded admin lands on the admin portal',()=>{
  const adminForm={elements:{email:{value:'admin@queuesmart.local'},password:{value:'admin1234'}}};
  handlers.submit({target:{id:'auth-form',...adminForm},preventDefault(){}});
  assert.match(app.innerHTML,/ADMIN PORTAL/);
  click('logout');
  assert.match(app.innerHTML,/Log in/);
});

test('admin can manage a service queue',() => {
    const adminForm = {
      elements: {
        email: {
          value: 'admin@queuesmart.local'
        },

        password: {
          value:'admin1234'
        }
      }
    };


    handlers.submit({
      target: {
        id: 'auth-form', ...adminForm
      },

      preventDefault() {}
    });


    click(
      '',
      {
        page: 'admin-queue'
      }
    );


    assert.match(
      app.innerHTML, /Queue Management/
    );


    assert.match(
      app.innerHTML, /Mock User 1/
    );


    click(
      '',
      {
        action: 'serve-next', serviceId: 'advising'
      }
    );


    assert.doesNotMatch(
      app.innerHTML, /mockuser1@example.com/
    );


    click(
      'logout'
    );


    assert.match(
      app.innerHTML, /Log in/
    );
  }
);

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

test('invalid service inputs remain visible and cancel leaves data unchanged', () => {
  loginAdmin();
  click('', {page:'admin-services'});
  click('', {action:'edit-service',serviceId:'advising'});
  const before = JSON.stringify(SERVICES);
  const values = {name:'  Changed name  ',description:'   ',expectedDuration:'-2',priority:'high'};
  submitServiceForm(values);
  assert.equal(JSON.stringify(SERVICES), before);
  assert.deepEqual(state.serviceForm.values, values);
  assert.match(app.innerHTML,/value="  Changed name  "/);
  assert.match(app.innerHTML,/Enter a description/);
  assert.match(app.innerHTML,/number of minutes greater than zero/);
  assert.match(app.innerHTML,/aria-invalid="true"/);
  click('', {action:'cancel-service-form'});
  assert.equal(state.serviceForm, null);
  assert.equal(JSON.stringify(SERVICES), before);
  click('logout');
});

test('create and edit services through delegated events and use new IDs in queue screens', () => {
  loginAdmin();
  click('', {page:'admin-services'});
  const before = JSON.stringify(SERVICES);
  const originalLength = SERVICES.length;
  const storedBefore = new Map(memory);
  const edited = SERVICES[0];
  const original = {...edited};
  try {
    click('', {action:'create-service'});
    assert.match(app.innerHTML,/type="submit">Save/);
    submitServiceForm(validService);
    const created = SERVICES.at(-1);
    assert.equal(SERVICES.length, originalLength + 1);
    assert.equal(new Set(SERVICES.map(s=>s.id)).size, SERVICES.length);
    assert.deepEqual({...created,id:undefined}, {id:undefined,name:'New Service',description:'Help with questions.',expectedDuration:12.5,priority:'high',icon:'▤',wait:0,length:0,open:true});
    assert.equal(state.serviceForm, null);
    assert.match(app.innerHTML,/New Service/);
    assert.equal(state.toast, 'Service created.');
    assert.deepEqual(memory, storedBefore); // Saving services does not persist anything.

    click('', {action:'create-service'});
    submitServiceForm({...validService,name:'Second service'});
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
    click('', {action:'edit-service',serviceId:edited.id});
    assert.match(app.innerHTML,/value="Academic Advising"/);
    submitServiceForm({...validService,name:' Updated Advising ',priority:'low'});
    assert.equal(SERVICES[0], edited);
    assert.deepEqual(edited, {...original,name:'Updated Advising',description:'Help with questions.',expectedDuration:12.5,priority:'low'});
    assert.equal(state.toast, 'Service updated.');
    assert.match(app.innerHTML,/Updated Advising/);

    click('logout');
    handlers.submit({target:{id:'auth-form',elements:{email:{value:'demo@example.com'},password:{value:'password123'}}},preventDefault(){}});
    click('', {quickjoin:created.id});
    assert.match(app.innerHTML,/New Service/);
    click('join-button');
    assert.match(app.innerHTML,/Your queue progress/);
    click('advance');
    assert.match(app.innerHTML,/Served/);
    assert.match(app.innerHTML,/New Service/);
  } finally {
    Object.assign(edited,original);
    SERVICES.splice(originalLength);
    state.toast = null;
    click('logout');
    assert.equal(JSON.stringify(SERVICES),before);
  }
});
