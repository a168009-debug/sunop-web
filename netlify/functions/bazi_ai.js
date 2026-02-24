const https = require("https");

const QUICK = { model: "gpt-4o-mini", tokens: 300, timeout: 8000 };
const DEEP = { model: "gpt-4o", tokens: 800, timeout: 15000 };

function calcBazi(y, m, d, h) {
  var tg = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
  var dz = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
  var wuxing = {"子":"水","亥":"水","寅":"木","卯":"木","巳":"火","午":"火","申":"金","酉":"金","丑":"土","辰":"土","未":"土","戌":"土"};
  
  var nz = tg[(y-4)%10] + dz[(y-4)%12];
  var ygi = tg.indexOf(nz[0]);
  var qishi = [2,4,6,8,0][Math.floor(ygi/2)] || 0;
  var yz = tg[(qishi+m-1)%10] + dz[m-1];
  
  var base = new Date(1900, 1, 15);
  var diff = Math.floor((new Date(y,m-1,d) - base) / 86400000);
  var rz = tg[(diff%10+10)%10] + dz[(diff%12+12)%12];
  var rgi = tg.indexOf(rz[0]);
  var sz = tg[([0,2,4,6,8][Math.floor(rgi/2)]||0)+dz.indexOf(h)%10] + h;
  
  var all = nz + yz + rz + sz;
  var ws = {木:0,火:0,土:0,金:0,水:0};
  for(var i=0;i<all.length;i++){ var e=wuxing[all[i]]; if(e) ws[e]++; }
  
  var rzWx = wuxing[rz[1]];
  var strength = ws[rzWx]>=3?"強":ws[rzWx]>=2?"中等":"弱";
  var yongshen = [];
  if(strength==="弱"){
    yongshen.push({w:{"木":"水","火":"木","土":"火","金":"土","水":"金"}[rzWx],r:rzWx+"弱需生扶"});
  }else{
    yongshen.push({w:{"木":"金","火":"水","土":"木","金":"火","水":"土"}[rzWx],r:rzWx+"旺需剋洩"});
  }
  
  return {
    name:"",birth:{year:y,month:m,day:d,hourBranch:h},
    pillars:{year:{stem:nz[0],branch:nz[1]},month:{stem:yz[0],branch:yz[1]},{stem:rz[0],branch:rz[1]}},
    dayMaster:{stem:rz[0],element:rzWx},
    strength:strength,
    fiveElements:ws,
    usefulGod:{candidates:yongshen.map(function(x){return x.w}),reason:yongshen.map(function(x){return x.r}).join("、")}
  };
}

exports.handler = async function(event) {
  var cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Content-Type":"application/json"};
  var res = function(s,obj){return{statusCode:s,headers:cors,body:JSON.stringify(obj)}};
  
  if(event.httpMethod==="OPTIONS")return res(200,{ok:true});
  if(event.httpMethod!=="POST")return res(405,{error:"Method Not Allowed"});
  
  try{
    var body = JSON.parse(event.body||"{}");
    var name = body.name;
    var year = body.year;
    var month = body.month;
    var day = body.day;
    var hourBranch = body.hourBranch || body.hour;
    var mode = body.mode || "quick";
    var question = body.question || "";
    
    if(!year||!month||!day||!hourBranch) return res(400,{error:"missing_input"});
    
    var profile = calcBazi(year,month,day,hourBranch);
    profile.name = name || "訪客";
    
    var apiKey = process.env.OPENAI_API_KEY;
    if(!apiKey) return res(500,{error:"missing_server_key"});
    
    var cfg = mode==="deep"?DEEP:QUICK;
    var sys = mode==="deep"?"你是專業八字命理顧問。請給出結構化分析：sections/action_plan/next_questions":"你是專業八字命理顧問。請簡短回覆：opening/highlights/risk_flags/suggested_questions";
    var usr = "八字："+JSON.stringify(profile)+(question?"\n問題："+question:"");
    
    var reply = await callAI(apiKey,cfg.model,[{role:"system",content:sys},{role:"user",content:usr}],cfg.tokens,cfg.timeout);
    
    return res(200,{ok:true,mode:mode,baziProfile:profile,result:reply});
  }catch(e){
    var msg = e.message||String(e);
    console.error("Error:",msg);
    if(msg==="timeout") return res(200,{fallback:true,summary:"目前能量場顯示近期壓力偏高，建議先從作息與情緒穩定開始調整。",suggestions:["最近是否睡眠品質下降？","是否工作決策壓力增加？","是否有家庭責任壓力？"]});
    return res(500,{error:msg.indexOf("quota")>-1?"quota_exceeded":"server_exception",message:msg});
  }
};

function callAI(key,model,messages,maxTokens,timeout){
  return new Promise(function(resolve,reject){
    var data = JSON.stringify({model:model,messages:messages,max_tokens:maxTokens,temperature:0.6});
    var opts = {hostname:"api.openai.com",path:"/v1/chat/completions",method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key,"Content-Length":Buffer.byteLength(data)},timeout:timeout};
    var req = https.request(opts,function(r){
      var b = "";
      r.on("data",function(c){b+=c;});
      r.on("end",function(){
        try{
          var j = JSON.parse(b);
          if(j.error)reject(new Error(j.error.message));
          if(r.statusCode>=400)reject(new Error("HTTP"+r.statusCode));
          var c = j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content;
          if(!c)reject(new Error("空回應"));
          try{resolve(JSON.parse(c));}catch(e){resolve({opening:c});}
        }catch(e){reject(new Error("解析失敗"));}
      });
    });
    req.on("error",function(e){reject(new Error("網路錯誤"));}
    req.setTimeout(timeout,function(){req.destroy();reject(new Error("timeout"));});
    req.write(data);
    req.end();
  });
}
