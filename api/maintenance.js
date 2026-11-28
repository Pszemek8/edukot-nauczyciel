const send=(res,n,d)=>res.status(n).json(d);
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return send(res,405,{error:'Niedozwolona metoda'});
  try{
    const u=process.env.UPSTASH_REDIS_REST_URL,t=process.env.UPSTASH_REDIS_REST_TOKEN;
    if(!u||!t)return send(res,503,{enabled:false});
    const r=await fetch(u,{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify(['GET','edukot:maintenance'])});
    const j=await r.json();
    if(!r.ok||j.error)return send(res,502,{enabled:false});
    if(!j.result)return send(res,200,{enabled:false,message:''});
    const state=JSON.parse(j.result);
    return send(res,200,{enabled:!!state.enabled,message:String(state.message||'')});
  }catch{return send(res,500,{enabled:false})}
}
