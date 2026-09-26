export const SERVICES = [
  {id:'advising', name:'Academic Advising', description:'Course planning, degree checks, and academic questions.', icon:'▤', wait:18, length:4, open:true},
  {id:'financial', name:'Financial Aid', description:'Get help with funding, awards, and account questions.', icon:'$', wait:32, length:7, open:true},
  {id:'tech', name:'IT Help Desk', description:'Account access, devices, software, and campus Wi-Fi.', icon:'⌘', wait:12, length:3, open:true},
  {id:'records', name:'Student Records', description:'Transcripts, enrollment verification, and records.', icon:'▦', wait:0, length:0, open:false}
];
export const serviceById = id => SERVICES.find(s=>s.id===id);
