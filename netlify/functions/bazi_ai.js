const https = require("https");
const Q = {m:"gpt-4o-mini",t:300,x:8000};
const D = {m:"gpt-4o",t:800,x:15000};

exports.handler = async function(e) {
  var h = {"Access-Control-Allow-Origin":"*","Content-Type":"application/json"};
  var r = function(s,o){return{statusCode:s,headers:h,body:JSON.stringify(o)}};
  if(e.httpMethod==="OPTIONS")return r(200,{ok:true});
  if(e.httpMethod!=="POST")return r(405,{e:"Method Not Allowed"});
  try{
    var b = JSON.parse(e.body||"{}");
    var n = b.name, y=b.year, mo=b.month, d=b.day, hb=b.hourBranch||b.hour;
    if(!y||!mo||!d||!hb)return r(400,{e:"missing_input"});
    var p = calc(y,mo,d,hb); p.name=n||"訪客";
    if(b.dryRun)return r(200,{ok:true,baziProfile:p});
    var k = process.env.OPENAI_API_KEY;
    if(!k)return r(500,{e:"no_key"});
    var c = b.mode==="deep"?D:Q;
    var sys = b.mode==="deep"?"你是專業八字命理顧問":"你是專業八字命理顧問";
    var usr = "資料:"+JSON.stringify(p);
    var res = await ai(k,c.m,[{role:"system",content:sys},{role:"user",content:usr}],c.t,c.x);
    return r(200,{ok:true,mode:b.mode||"quick",baziProfile:p,result:res});
  }catch(err){
    var m = err.message||String(err);
    console.error("E:",m);
    if(m==="timeout")return r(200,{fallback:true,sum:"近期壓力偏高",sug:["睡","工作"]});
    return r(500,{e:m.indexOf("quota")>-1?"quota":"error",msg:m});
  }
};

function calc(y,m,d,h){
  var tg="甲乙丙丁戊己庚辛壬癸".split("");
  var dz="子丑寅卯辰巳午未申酉戌亥".split("");
  var wx={子:"水",亥:"水",寅:"木",卯:"木",巳:"火",午:"火",申:"金",酉:"金",丑:"土",辰:"土",未:"土",戌:"土"};
  var nz=tg[(y-4)%10]+dz[(y-4)%12];
  var q=[2,4,6,8,0][Math.floor(tg.indexOf(nz[0])/2)]||0;
  var yz=tg[(q+m-1)%10]+dz[m-1];
  var base=new Date(1900,1,15);
  var days=Math.floor((new Date(y,m-1,d)-base)/86400000);
  var rz=tg[(days%10+10)%10]+dz[(days%12+12)%12];
  var ri=tg.indexOf(rz[0]);
  var sz=tg[([0,2,4,6,8][Math.floor(ri/2)]||0)+dz.indexOf(h)%10]+h;
  var all=nz+yz+rz+sz;
  var ws={木:0,火:0,土:0,金:0,水:0};
  for(var i=0;i<all.length;i++){
    var e=wx[all[i]];
    if(e)ws[e]++;
  }
  var rzwx=wx[rz[1]];
  var str=ws[rzwx]>=3?"強":ws[rzwx]>=2?"中等":"弱";
  return{name:"",birth:{year:y,month:m,day:d,hourBranch:h},pillars:{year:{stem:nz[0],branch:nz[1]},month:{stem:yz[0],branch:yz[1]},day:{stem:rz[0],branch:rz[1]}},dayMaster:{stem:rz[0],element:rzwx},strength:str,fiveElements:ws};
}

function ai(key,model,msgs,tokens,timeout){
  return new Promise(function(resolve,reject){
    var data=JSON.stringify({model:model,messages:msgs,max_tokens:tokens,temperature:0.6});
    var opts={hostname:"api.openai.com",path:"/v1/chat/completions",method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key,"Content-Length":Buffer.byteLength(data)},timeout:timeout};
    var req=https.request(opts,function(resp){
      var body="";
      resp.on("data",function(c){body+=c});
      resp.on("end",function(){
        try{
          var j=JSON.parse(body);
          if(j.error)reject(new Error(j.error.message));
          if(resp.statusCode>=400)reject(new Error("HTTP"+resp.statusCode));
          var c=j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content;
          if(!c)reject(new Error("空"));
          try{resolve(JSON.parse(c));}catch(e){resolve({opening:c});}
        }catch(e){reject(new Error("解析失敗"));}
      });
    });
    req.on("error",function(e){reject(new Error("網路"))});
    req.setTimeout(timeout,function(){req.destroy();reject(new Error("timeout"))});
    req.write(data);
    req.end();
  });
}
