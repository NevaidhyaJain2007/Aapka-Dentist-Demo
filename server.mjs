import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.dirname(fileURLToPath(import.meta.url)), DATA=path.join(ROOT,'data','store.json');
const PORT=Number(process.env.PORT||4173), TZ=process.env.CLINIC_TIMEZONE||'Asia/Kolkata';
const services=[
 ['General Dental Consultation','A first visit or routine conversation about your oral health.',30,'◉'],
 ['Teeth Cleaning and Scaling','A professional cleaning consultation.',45,'✦'],
 ['Dental Fillings','Consultation about a tooth that may need a filling.',45,'◇'],
 ['Root Canal Consultation','Discuss symptoms and possible next steps with a dentist.',45,'⌁'],
 ['Tooth Extraction Consultation','Assessment and discussion with a dental professional.',30,'＋'],
 ['Cosmetic Dentistry Consultation','Talk through cosmetic dentistry options with the clinic.',45,'✧'],
 ['Orthodontic Consultation','An initial conversation about alignment options.',30,'⌖'],
 ['Dental Emergency Assessment','Request an urgent professional assessment.',30,'!']
].map(([name,description,duration,icon],i)=>({id:'S'+(i+1),name,description,duration,icon}));
const clinic={name:process.env.CLINIC_NAME||'Aapka Dentist',timezone:TZ,email:process.env.CLINIC_EMAIL||'Demo contact to be configured',phone:process.env.CLINIC_PHONE||'Demo contact to be configured',address:process.env.CLINIC_ADDRESS||'Demo address to be configured',hours:'Monday–Saturday, 9:00 AM–6:00 PM (demo schedule)',cancellation:'Please contact the clinic to reschedule or cancel.'};
let store;
async function load(){try{store=JSON.parse(await readFile(DATA,'utf8'))}catch{store={patients:[],appointments:[],emails:[],activity:[],conversations:[]}; await save()}}
async function save(){await mkdir(path.dirname(DATA),{recursive:true});await writeFile(DATA,JSON.stringify(store,null,2))}
function log(type,description,related=null){store.activity.unshift({id:randomUUID(),type,description,related,createdAt:new Date().toISOString()})}
function dateAtOffset(n){const d=new Date(Date.now()+n*86400000);return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
function clockMinutes(t){const [h,m]=t.split(':').map(Number);return h*60+m}
function slots(date,serviceId){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<dateAtOffset(0))return [];
 const day=new Date(date+'T12:00:00Z').getUTCDay();if(day===0)return [];
 const duration=services.find(s=>s.id===serviceId)?.duration||30, out=[];
 for(let m=9*60;m+duration<=18*60;m+=30){const time=String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');if(date===dateAtOffset(0)){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const nowM=Number(parts.find(x=>x.type==='hour').value)*60+Number(parts.find(x=>x.type==='minute').value);if(m<=nowM)continue;}
 const end=m+duration, busy=store.appointments.some(a=>a.date===date&&a.status==='confirmed'&&m<clockMinutes(a.endTime)&&end>clockMinutes(a.startTime));if(!busy)out.push(time)}
 return out
}
function json(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'same-origin'});res.end(JSON.stringify(data))}
async function body(req){let s='';for await(const c of req)s+=c;if(s.length>20000)throw Error('Request too large');return s?JSON.parse(s):{}}
const emailRe=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function route(req,res){
 const u=new URL(req.url,'http://localhost'), p=u.pathname;
 if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'});return res.end()}
 if(req.method==='GET'&&p==='/api/clinic')return json(res,200,{clinic,mode:'DEMO'});
 if(req.method==='GET'&&p==='/api/services')return json(res,200,{services});
 if(req.method==='GET'&&p==='/api/availability'){const date=u.searchParams.get('date'),serviceId=u.searchParams.get('serviceId');return json(res,200,{date,slots:slots(date,serviceId)})}
 if(req.method==='POST'&&p==='/api/appointments'){
  const b=await body(req), service=services.find(s=>s.id===b.serviceId);
  if(!b.name?.trim()||b.name.length>100||!emailRe.test(b.email||'')||!service||!b.date||!b.time||b.confirmed!==true)return json(res,400,{error:'Please provide valid details and confirm the appointment.'});
  if(!slots(b.date,b.serviceId).includes(b.time))return json(res,409,{error:'That time is no longer available. Please choose another slot.'});
  let patient=store.patients.find(x=>x.email.toLowerCase()===b.email.toLowerCase());if(!patient){patient={id:randomUUID(),name:b.name.trim(),email:b.email.trim(),phone:String(b.phone||'').slice(0,30),createdAt:new Date().toISOString()};store.patients.push(patient)}
  const duration=service.duration,end=clockMinutes(b.time)+duration,endTime=String(Math.floor(end/60)).padStart(2,'0')+':'+String(end%60).padStart(2,'0');
  const a={id:randomUUID(),reference:'AD-'+randomBytes(3).toString('hex').toUpperCase(),patientId:patient.id,serviceId:service.id,service:service.name,date:b.date,startTime:b.time,endTime,status:'confirmed',createdAt:new Date().toISOString()};
  store.appointments.push(a);store.emails.unshift({id:randomUUID(),appointmentId:a.id,type:'booking',recipient:patient.email,status:'simulated',createdAt:new Date().toISOString()});log('appointment_created','Appointment '+a.reference+' booked (demo email simulated).',a.id);await save();return json(res,201,{appointment:a,emailStatus:'simulated',patientName:patient.name})
 }
 if(req.method==='POST'&&p==='/api/cancel/lookup'){
  const b=await body(req),a=store.appointments.find(x=>x.reference.toLowerCase()===String(b.reference||'').trim().toLowerCase()),patient=a&&store.patients.find(x=>x.id===a.patientId);
  if(!a||!patient||patient.email.toLowerCase()!==String(b.email||'').trim().toLowerCase())return json(res,404,{error:'We could not match that reference and email. Please check both details.'});
  if(a.status!=='confirmed')return json(res,409,{error:'This appointment is already cancelled.'});
  return json(res,200,{appointment:a,patientName:patient.name,service:a.service,verification:'Demo ownership check: reference plus booking email (not production identity verification).'})
 }
 if(req.method==='POST'&&p==='/api/cancel'){
  const b=await body(req),a=store.appointments.find(x=>x.reference===b.reference),patient=a&&store.patients.find(x=>x.id===a.patientId);
  if(!a||!patient||patient.email.toLowerCase()!==String(b.email||'').trim().toLowerCase())return json(res,404,{error:'Appointment verification failed.'});
  if(b.confirmed!==true)return json(res,400,{error:'Cancellation needs your confirmation.'});
  if(a.status!=='confirmed')return json(res,409,{error:'This appointment is already cancelled.'});
  a.status='cancelled';a.updatedAt=new Date().toISOString();store.emails.unshift({id:randomUUID(),appointmentId:a.id,type:'cancellation',recipient:patient.email,status:'simulated',createdAt:new Date().toISOString()});log('appointment_cancelled','Appointment '+a.reference+' cancelled (demo email simulated).',a.id);await save();return json(res,200,{appointment:a,emailStatus:'simulated'})
 }
 if(req.method==='GET'&&p==='/api/admin'){
  return json(res,200,{demoAuth:true,appointments:store.appointments.map(a=>({...a,patient:store.patients.find(x=>x.id===a.patientId)})).sort((a,b)=>(a.date+a.startTime).localeCompare(b.date+b.startTime)),patients:store.patients,emails:store.emails,activity:store.activity,counts:{today:store.appointments.filter(a=>a.date===dateAtOffset(0)&&a.status==='confirmed').length,upcoming:store.appointments.filter(a=>a.date>=dateAtOffset(0)&&a.status==='confirmed').length,cancelled:store.appointments.filter(a=>a.status==='cancelled').length,patients:store.patients.length}})
 }
 if(req.method==='POST'&&p==='/api/admin/reset'){
  store={patients:[],appointments:[],emails:[],activity:[],conversations:[]};await save();return json(res,200,{ok:true})
 }
 if(req.method==='POST'&&p==='/api/chat'){
  const b=await body(req),text=String(b.message||'').slice(0,1000),lower=text.toLowerCase();let reply;
  if(/\b(urgent|emergency|swelling|bleeding|can't breathe|cannot breathe|difficulty swallowing)\b/.test(lower))reply='I’m sorry you’re dealing with this. If you have facial swelling affecting breathing or swallowing, uncontrolled bleeding, or rapidly worsening symptoms, seek urgent professional medical or dental care now. I can also help request human assistance.';
  else if(/diagnos|what is wrong|should i take|medicine|medication/.test(lower))reply='I can’t diagnose symptoms or recommend medication. A dental professional can assess this safely. Would you like to request an appointment or speak with the clinic team?';
  else if(/human|person|receptionist|staff/.test(lower)){log('human_assistance_requested','A visitor requested human assistance.');await save();reply='I’ve noted your request for the clinic team. Contact details are currently demo placeholders; please configure the clinic contact information before a live launch.'}
  else if(/hour|open|timing/.test(lower))reply='Our demo schedule is Monday–Saturday, 9:00 AM–6:00 PM ('+TZ+'). Clinic hours are configurable.';
  else if(/service|treatment|clean|filling|root canal|cosmetic|orthodont|extraction/.test(lower))reply='We can help with: '+services.map(x=>x.name).join(', ')+'. Which consultation would you like?';
  else if(/cancel/.test(lower))reply='I can help cancel a booking. Choose “Cancel an appointment” below and provide the appointment reference and booking email. The demo checks both details; this is not production identity verification.';
  else if(/book|appointment|available|slot/.test(lower))reply='I can help book. Choose “Book an appointment” below and I’ll check actual available times before asking for your details.';
  else reply='I’m the Aapka Dentist demo receptionist. I can share clinic hours and services, or help you book or cancel an appointment. What would you like to do?';
  return json(res,200,{reply,mode:'DEMO',conversationId:b.conversationId||randomUUID()})
 }
 if(req.method==='GET'&&p.startsWith('/api/'))return json(res,404,{error:'Not found'});
 const publicPath=p==='/'?'/index.html':p;
 try{const file=await readFile(path.join(ROOT,'public',path.basename(publicPath)));const ext=path.extname(publicPath);res.writeHead(200,{'content-type':ext==='.css'?'text/css':ext==='.js'?'text/javascript':'text/html'});res.end(file)}catch{res.writeHead(404);res.end('Not found')}
}
await load();
const server=http.createServer((req,res)=>route(req,res).catch(e=>{console.error(e);json(res,500,{error:'Something went wrong. Please try again.'})}));
server.listen(PORT,()=>console.log('Aapka Dentist demo running at http://localhost:'+PORT+' (AI and email simulation; persistent JSON store)'));
