"use strict";
/* ================= 常量与数据 ================= */
const TILE=32, MW=200, MH=160;               // 地图 200x160 格，无缝开放世界
const T={GRASS:0,WATER:1,SAND:2,SNOW:3,ROCK:4,PATH:5,SOIL:6,TILLED:7,WATERED:8,WOOD:9,ICE:10,CAVE:11};
const WALKABLE=t=>!(t===T.WATER||t===T.ROCK);
const SEASONS=[{n:"春",ic:"🌸"},{n:"夏",ic:"☀️"},{n:"秋",ic:"🍁"},{n:"冬",ic:"⛄"}];
const DAYS_PER_SEASON=7;

const PUPS={
  chase:{name:"阿奇",cn:"警察狗",color:"#2e6fd8",skill:"追踪",ic:"🔍",tip:"追踪：显示任务目标方向"},
  marshall:{name:"毛毛",cn:"消防狗",color:"#e74c3c",skill:"灭火",ic:"🔥",tip:"灭火：扑灭身边的火焰"},
  skye:{name:"天天",cn:"飞行狗",color:"#e87fb8",skill:"飞行",ic:"🪽",tip:"飞行：短暂飞越水面与障碍"},
  rubble:{name:"小砾",cn:"工程狗",color:"#f1c40f",skill:"碎石",ic:"🪨",tip:"碎石：击碎面前的岩石"},
  zuma:{name:"路马",cn:"水上狗",color:"#e67e22",skill:"游泳",ic:"🌊",tip:"游泳：可以在水中自由移动"},
  rocky:{name:"灰灰",cn:"环保狗",color:"#27ae60",skill:"回收",ic:"♻️",tip:"回收：把垃圾变成材料"},
  everest:{name:"珠珠",cn:"雪山狗",color:"#16b3c4",skill:"滑雪",ic:"❄️",tip:"滑雪：雪地冰面上飞驰"},
};
const PUP_KEYS=Object.keys(PUPS);

const ITEMS={
  hoe:{n:"锄头",ic:"⚒️",tool:1},  can:{n:"水壶",ic:"🚿",tool:1},  rod:{n:"鱼竿",ic:"🎣",tool:1},
  carrotSeed:{n:"萝卜种子",ic:"🌱",price:30}, strawSeed:{n:"草莓种子",ic:"🍀",price:50},
  cornSeed:{n:"玉米种子",ic:"🌾",price:80},  pumpSeed:{n:"南瓜种子",ic:"🫘",price:120},
  carrot:{n:"萝卜",ic:"🥕",sell:80,crop:1}, strawberry:{n:"草莓",ic:"🍓",sell:150,crop:1},
  corn:{n:"玉米",ic:"🌽",sell:260,crop:1}, pumpkin:{n:"南瓜",ic:"🎃",sell:420,crop:1},
  berry:{n:"森林浆果",ic:"🫐",sell:40}, treat:{n:"骨头饼干",ic:"🦴",price:60,gift:1},
  stone:{n:"石头",ic:"🪨",sell:10}, copper:{n:"铜矿石",ic:"🟠",sell:60,ore:1},
  iron:{n:"铁矿石",ic:"⚪",sell:120,ore:1}, gold:{n:"金矿石",ic:"🟡",sell:280,ore:1},
  diamond:{n:"钻石",ic:"💎",sell:800,ore:1},
  carp:{n:"鲤鱼",ic:"🐟",sell:60,fish:1}, bass:{n:"鲈鱼",ic:"🐠",sell:90,fish:1},
  trout:{n:"虹鳟鱼",ic:"🎏",sell:130,fish:1}, bream:{n:"海鲷",ic:"🐡",sell:110,fish:1},
  octopus:{n:"章鱼",ic:"🐙",sell:200,fish:1}, koi:{n:"金色锦鲤",ic:"✨",sell:1000,fish:1},
  junk:{n:"垃圾",ic:"🗑️",sell:1}, material:{n:"回收材料",ic:"🔩",sell:35},
  gem:{n:"宝石",ic:"🔮",sell:300},
};
const CROPS={
  carrotSeed:{grow:4,yield:"carrot"}, strawSeed:{grow:6,yield:"strawberry"},
  cornSeed:{grow:8,yield:"corn"}, pumpSeed:{grow:10,yield:"pumpkin"},
};
const SHOP=[["carrotSeed",30],["strawSeed",50],["cornSeed",80],["pumpSeed",120],["treat",60]];
const COLLECT_GROUPS=[
  {t:"🐟 鱼类图鉴",ids:["carp","bass","trout","bream","octopus","koi"]},
  {t:"⛏️ 矿石图鉴",ids:["copper","iron","gold","diamond"]},
  {t:"🌾 作物图鉴",ids:["carrot","strawberry","corn","pumpkin","berry"]},
];

/* ================= 全局状态 ================= */
const S={
  started:false, day:1, season:0, min:6*60, weather:"sunny",
  coins:500, pts:0, xp:0, level:1,
  curPup:"chase", pupXP:{}, flying:0,
  px:37*TILE, py:80*TILE, dir:2, moving:false, animT:0,
  inv:[{id:"hoe",c:1},{id:"can",c:1},{id:"rod",c:1},{id:"carrotSeed",c:6},{id:"treat",c:3},null,null,null,null],
  sel:0, crops:{}, friendship:{}, collections:{}, openedChests:{},
  missions:[], missionSeq:0, bearFed:0, bearCalmed:false, junkGot:0, fireworksSeen:false,
};
PUP_KEYS.forEach(k=>S.pupXP[k]=0);
const pupLv=k=>Math.min(20,1+Math.floor(Math.sqrt(S.pupXP[k]/20)));

/* ================= 世界生成（固定种子，无缝大地图） ================= */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
let map=new Uint8Array(MW*MH);
const gi=(x,y)=>y*MW+x;
const tileAt=(x,y)=>(x<0||y<0||x>=MW||y>=MH)?T.ROCK:map[gi(x,y)];
const objs={};   // "x,y" -> {t:'tree'|'rock'|'bush'|'cactus'|'chest'|'fire'|'junk'|'kitten'|'bear'|'flower', ...}
const okey=(x,y)=>x+","+y;
let buildings=[], npcs=[];

function genWorld(){
  const R=mulberry32(20260704);
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    let t=T.GRASS;
    if(y<12) t=T.ROCK;                                        // 北部山脉
    else if(y<34) t=T.SNOW;                                   // 雪山地带
    if(y>=138) t=T.WATER;                                     // 南部海洋
    else if(y>=130) t=T.SAND;                                 // 海滩
    if(x>=150&&x<198&&y>=100&&y<130) t=T.SAND;                // 东南沙漠
    map[gi(x,y)]=t;
  }
  // 矿洞（山体内部）
  for(let y=3;y<12;y++)for(let x=88;x<124;x++) map[gi(x,y)]=T.CAVE;
  for(let y=12;y<15;y++) map[gi(105,y)]=map[gi(106,y)]=T.CAVE; // 洞口通道
  // 河流：自北向南入海
  for(let y=14;y<138;y++){ const rx=100+Math.round(6*Math.sin(y*0.09));
    for(let dx=-2;dx<=2;dx++) map[gi(rx+dx,y)]=T.WATER; }
  // 桥
  [[68],[100],[124]].forEach(([by])=>{ for(let x=90;x<114;x++) if(map[gi(x,by)]===T.WATER){map[gi(x,by)]=T.WOOD;map[gi(x,by+1)]=T.WOOD;} });
  // 农场耕地
  for(let y=68;y<96;y++)for(let x=20;x<52;x++) if(map[gi(x,y)]===T.GRASS) map[gi(x,y)]=T.SOIL;
  // 主城道路
  for(let x=60;x<170;x++) map[gi(x,80)]=map[gi(x,81)]=T.PATH;
  for(let y=40;y<130;y++) map[gi(130,y)]===T.GRASS&&(map[gi(130,y)]=T.PATH), map[gi(131,y)]===T.GRASS&&(map[gi(131,y)]=T.PATH);
  for(let y=15;y<80;y++) if(map[gi(105,y)]!==T.WATER&&map[gi(105,y)]!==T.CAVE) map[gi(105,y)]=T.PATH;
  // 码头
  for(let y=130;y<146;y++) map[gi(160,y)]=map[gi(161,y)]=T.WOOD;
  // 建筑
  buildings=[
    {x:112,y:44,w:9,h:7,name:"救援总部",ic:"🚨",col:"#e74c3c",type:"hq"},
    {x:138,y:60,w:6,h:5,name:"波特杂货店",ic:"🛒",col:"#e67e22",type:"shop"},
    {x:150,y:60,w:6,h:5,name:"市政厅",ic:"🏛️",col:"#3498db",type:"house"},
    {x:138,y:88,w:5,h:5,name:"甜甜面包坊",ic:"🥐",col:"#d4913a",type:"house"},
    {x:148,y:88,w:5,h:5,name:"陈医生诊所",ic:"🏥",col:"#ecf0f1",type:"house"},
    {x:158,y:88,w:6,h:5,name:"冒险学校",ic:"🏫",col:"#9b59b6",type:"house"},
    {x:26,y:60,w:6,h:5,name:"狗狗小屋(家)",ic:"🏠",col:"#c0793a",type:"home"},
    {x:54,y:70,w:4,h:4,name:"出货箱",ic:"📦",col:"#8b5a2b",type:"bin"},
    {x:174,y:124,w:4,h:6,name:"老灯塔",ic:"🗼",col:"#e8e8e8",type:"house"},
    {x:64,y:120,w:5,h:4,name:"海叔渔屋",ic:"🎣",col:"#5b8bb5",type:"house"},
  ];
  buildings.forEach(b=>{for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++)map[gi(x,y)]=T.PATH;});
  // 森林树木（东北大森林 + 零散）
  const tree=(x,y)=>{ if(map[gi(x,y)]===T.GRASS&&!objs[okey(x,y)]) objs[okey(x,y)]={t:"tree",v:R()<.3?1:0}; };
  for(let i=0;i<900;i++){ const x=134+Math.floor(R()*62), y=36+Math.floor(R()*22); tree(x,y); }
  for(let i=0;i<500;i++){ const x=168+Math.floor(R()*30), y=58+Math.floor(R()*40); tree(x,y); }
  for(let i=0;i<260;i++) tree(4+Math.floor(R()*80),36+Math.floor(R()*22));
  for(let i=0;i<200;i++) tree(4+Math.floor(R()*190),100+Math.floor(R()*28));
  // 浆果丛
  for(let i=0;i<60;i++){ const x=134+Math.floor(R()*60),y=36+Math.floor(R()*20),k=okey(x,y);
    if(map[gi(x,y)]===T.GRASS&&!objs[k]) objs[k]={t:"bush",ready:1}; }
  // 花
  for(let i=0;i<160;i++){ const x=Math.floor(R()*MW),y=36+Math.floor(R()*90),k=okey(x,y);
    if(map[gi(x,y)]===T.GRASS&&!objs[k]) objs[k]={t:"flower",v:Math.floor(R()*3)}; }
  // 岩石：雪山与矿洞（矿洞含矿石）
  for(let i=0;i<180;i++){ const x=4+Math.floor(R()*190),y=14+Math.floor(R()*18),k=okey(x,y);
    if(map[gi(x,y)]===T.SNOW&&!objs[k]) objs[k]={t:"rock",ore:R()<.15?"copper":null}; }
  for(let i=0;i<120;i++){ const x=89+Math.floor(R()*34),y=3+Math.floor(R()*9),k=okey(x,y);
    if(map[gi(x,y)]===T.CAVE&&!objs[k]){ const r=R();
      objs[k]={t:"rock",ore:r<.18?"copper":r<.3?"iron":r<.37?"gold":r<.4?"diamond":null}; } }
  // 沙漠仙人掌
  for(let i=0;i<80;i++){ const x=152+Math.floor(R()*44),y=102+Math.floor(R()*26),k=okey(x,y);
    if(map[gi(x,y)]===T.SAND&&!objs[k]) objs[k]={t:"cactus"}; }
  // 海滩垃圾（灰灰回收）
  for(let i=0;i<40;i++){ const x=8+Math.floor(R()*185),y=131+Math.floor(R()*6),k=okey(x,y);
    if(map[gi(x,y)]===T.SAND&&!objs[k]) objs[k]={t:"junk"}; }
  // 隐藏宝箱 ×16
  const chestSpots=[[8,16],[190,17],[92,5],[121,10],[140,38],[192,36],[172,96],[195,128],
    [155,108],[10,134],[100,132],[186,132],[6,60],[70,44],[178,66],[40,110]];
  chestSpots.forEach((p,i)=>{ const k=okey(p[0],p[1]);
    if(WALKABLE(tileAt(p[0],p[1]))) objs[k]={t:"chest",id:i}; else objs[okey(p[0]+1,p[1]+1)]={t:"chest",id:i}; });
  // 森林巨熊 Boss（隐藏剧情：喂3块骨头饼干安抚它）
  objs[okey(182,44)]={t:"bear"};
  // NPC
  npcs=[
    {name:"古德威市长",ic:"🎩",col:"#34495e",x:152,y:66,r:6,like:"pumpkin",
     d:["欢迎来到冒险湾！这里的安全就拜托汪汪队啦。","听说雪山上有闪闪发光的宝箱哦。","丰收节那天全镇都会来广场庆祝！"]},
    {name:"波特老板",ic:"🧑‍🌾",col:"#c0793a",x:140,y:66,r:3,like:"corn",
     d:["种子要吗？春天种萝卜最划算啦！","把作物放进农场旁的出货箱，隔天就能收到钱。","南瓜能卖大价钱，就是长得慢。"]},
    {name:"农夫老麦",ic:"👨‍🌾",col:"#7a9c4f",x:36,y:64,r:6,like:"carrot",
     d:["浇了水的庄稼才会长哦。","下雨天不用浇水，老天爷帮忙啦！","锄头翻地→播种→浇水，就这么简单。"]},
    {name:"渔夫海叔",ic:"🧔",col:"#2c6f9c",x:66,y:118,r:5,like:"octopus",
     d:["拿上鱼竿，站在水边按E试试！","传说河里有一条金色锦鲤……","海里的章鱼最值钱，嘿嘿。"]},
    {name:"灯塔爷爷",ic:"👴",col:"#95a5a6",x:175,y:122,r:3,like:"bream",
     d:["老灯塔守了五十年喽。","起雾的日子，船最容易迷路。","神秘岛？涨潮时它就藏进海里啦。"]},
    {name:"陈医生",ic:"👩‍⚕️",col:"#e8eef1",x:150,y:86,r:4,like:"strawberry",
     d:["多吃蔬菜身体棒！","救援时自己也要注意安全哦。","草莓有维生素，我最喜欢了。"]},
    {name:"林老师",ic:"👩‍🏫",col:"#9b59b6",x:160,y:86,r:4,like:"berry",
     d:["图鉴收集全了可是很了不起的！","知识就是力量，探索就是课堂。","孩子们最崇拜汪汪队了。"]},
    {name:"小美",ic:"👧",col:"#f5b7c9",x:144,y:78,r:8,like:"strawberry",
     d:["哇！是汪汪队！可以摸摸天天吗？","我的小猫咪总是乱跑……","长大我也要当救援队员！"]},
    {name:"壮壮",ic:"👦",col:"#f0c27a",x:156,y:78,r:8,like:"treat",
     d:["毛毛的消防车最酷了！","我在沙漠边捡到过一块亮亮的石头！","嘘——森林深处好像住着一只大熊。"]},
    {name:"邮递员飞飞",ic:"📮",col:"#3498db",x:132,y:70,r:12,like:"corn",
     d:["今天的信件特别多！","跑遍全镇就靠这双腿。","救援总部每天都有新任务贴出来。"]},
    {name:"面包师甜甜",ic:"👩‍🍳",col:"#e8a13a",x:140,y:86,r:3,like:"pumpkin",
     d:["刚出炉的面包香喷喷！","南瓜派需要上好的南瓜。","闻到香味了吗？那就是幸福的味道。"]},
    {name:"矿工石头叔",ic:"⛏️",col:"#7f8c8d",x:106,y:20,r:5,like:"gold",
     d:["山肚子里的矿洞里全是宝贝。","让小砾把岩石敲开看看！","钻石！我这辈子就见过一次钻石！"]},
    {name:"护林员绿绿",ic:"🌲",col:"#27ae60",x:150,y:50,r:8,like:"berry",
     d:["森林火灾最可怕，多亏有毛毛。","浆果丛过几天又会结果的。","别去打扰大熊，除非你带着礼物。"]},
    {name:"甜品店奶奶",ic:"👵",col:"#c39bd3",x:120,y:86,r:3,like:"treat",
     d:["小狗狗们要吃小饼干吗？","慢慢来，日子长着呢。","看到你们，就想起我年轻的时候。"]},
  ];
  npcs.forEach(n=>{n.hx=n.x;n.hy=n.y;n.mt=0;S.friendship[n.name]=S.friendship[n.name]||0;});
}
/* ================= 工具函数 ================= */
const $=id=>document.getElementById(id);
function toast(msg){ const d=document.createElement("div"); d.className="toastMsg"; d.textContent=msg;
  $("toast").appendChild(d); setTimeout(()=>d.remove(),2600); }
function addItem(id,c=1){ const it=ITEMS[id]; if(!it)return;
  for(const s of S.inv) if(s&&s.id===id&&!it.tool){ s.c+=c; afterGain(id); UI.hotbar(); return true; }
  for(let i=0;i<S.inv.length;i++) if(!S.inv[i]){ S.inv[i]={id,c}; afterGain(id); UI.hotbar(); return true; }
  toast("背包满啦！"); return false; }
function afterGain(id){ const it=ITEMS[id];
  if((it.fish||it.ore||it.crop||id==="berry")&&!S.collections[id]){ S.collections[id]=1; toast("📖 图鉴收录："+it.n+"！"); addXP(15);} }
function removeItem(i){ const s=S.inv[i]; if(!s)return; s.c--; if(s.c<=0)S.inv[i]=null; UI.hotbar(); }
function countItem(id){ return S.inv.reduce((a,s)=>a+(s&&s.id===id?s.c:0),0); }
function takeItem(id,c){ for(const s of S.inv){ if(s&&s.id===id){ const k=Math.min(s.c,c); s.c-=k; c-=k; } }
  S.inv.forEach((s,i)=>{if(s&&s.c<=0)S.inv[i]=null}); UI.hotbar(); }
function addXP(n){ S.xp+=n; S.pupXP[S.curPup]+=n;
  const need=S.level*100; if(S.xp>=need){ S.xp-=need; S.level=Math.min(20,S.level+1);
    toast("🎉 升级！等级 "+S.level+"（移动更快了）"); } UI.top(); }
function addCoins(n){ S.coins+=n; UI.top(); }
const dist=(x1,y1,x2,y2)=>Math.hypot(x1-x2,y1-y2);
const ptx=()=>Math.floor((S.px+TILE/2)/TILE), pty=()=>Math.floor((S.py+TILE/2)/TILE);
function facingTile(){ const d=[[0,-1],[1,0],[0,1],[-1,0]][S.dir]; return [ptx()+d[0],pty()+d[1]]; }

/* ================= 时间 · 天气 · 季节 ================= */
function rollWeather(){ const r=Math.random(), s=S.season;
  if(s===3) S.weather=r<.45?"snow":r<.6?"blizzard":"sunny";
  else if(s===2) S.weather=r<.25?"rain":r<.4?"fog":"sunny";
  else S.weather=r<.28?"rain":r<.36?"storm":"sunny"; }
const WICON={sunny:"☀️ 晴",rain:"🌧️ 雨",storm:"⛈️ 雷暴",snow:"🌨️ 雪",blizzard:"❄️ 暴风雪",fog:"🌫️ 大雾"};

function newDay(){
  S.day++; S.min=6*60;
  if(S.day>DAYS_PER_SEASON){ S.day=1; S.season=(S.season+1)%4; toast(SEASONS[S.season].ic+" "+SEASONS[S.season].n+"天来啦！"); }
  rollWeather();
  // 作物生长
  for(const k in S.crops){ const c=S.crops[k];
    if(c.watered||["rain","storm"].includes(S.weather)){ c.stage++; }
    c.watered=["rain","storm","snow","blizzard"].includes(S.weather);
    const [x,y]=k.split(",").map(Number);
    map[gi(x,y)]=c.watered?T.WATERED:T.TILLED; }
  // 浆果重新结果
  for(const k in objs) if(objs[k].t==="bush"&&Math.random()<.4) objs[k].ready=1;
  // 出货箱结算
  if(S.shipped){ addCoins(S.shipped); toast("📦 出货收入 +"+S.shipped+" 金币！"); S.shipped=0; }
  maybeSpawnMission();
  if(S.day===DAYS_PER_SEASON) toast("🎆 今晚是"+["运动会·烟花节","海洋节","丰收节","雪地嘉年华"][S.season]+"！晚上主城见！");
  save(); UI.top(); UI.missions();
}
function sleep(){ $("nightfade").style.opacity=1;
  setTimeout(()=>{ newDay(); toast("☀️ 新的一天开始了！"); $("nightfade").style.opacity=0; },1300); }

/* ================= 农场系统 ================= */
function useTool(){
  const [fx,fy]=facingTile(), k=okey(fx,fy), t=tileAt(fx,fy), sel=S.inv[S.sel];
  if(!sel) return false;
  if(sel.id==="hoe"&&t===T.SOIL&&!objs[k]){ map[gi(fx,fy)]=T.TILLED; addXP(2); return true; }
  if(sel.id==="can"){ if(t===T.TILLED){ map[gi(fx,fy)]=T.WATERED; if(S.crops[k])S.crops[k].watered=true; addXP(1); return true; }
    if(S.crops[k]){S.crops[k].watered=true; map[gi(fx,fy)]=T.WATERED; return true;} return false; }
  if(CROPS[sel.id]&&(t===T.TILLED||t===T.WATERED)&&!S.crops[k]){
    S.crops[k]={seed:sel.id,stage:0,watered:t===T.WATERED}; removeItem(S.sel); addXP(3); return true; }
  if(sel.id==="rod") return startFishing(fx,fy);
  return false;
}
function harvest(k){ const c=S.crops[k],cd=CROPS[c.seed];
  if(c.stage>=cd.grow){ delete S.crops[k]; const [x,y]=k.split(",").map(Number); map[gi(x,y)]=T.SOIL;
    addItem(cd.yield); addXP(10); toast("🌾 收获了 "+ITEMS[cd.yield].n+"！"); return true; }
  return false; }

/* ================= 钓鱼小游戏 ================= */
let fishing=null;
function startFishing(fx,fy){ if(tileAt(fx,fy)!==T.WATER){ toast("要面向水面才能钓鱼哦"); return false; }
  const sea=fy>=136; fishing={t:0,pos:.5,zone:Math.random()*.6+.1,sea,hooked:false};
  toast("🎣 抛竿！等鱼上钩后按空格收线！");
  setTimeout(()=>{ if(fishing){fishing.hooked=true; toast("❗ 上钩了！快按空格！");} },1200+Math.random()*2500);
  return true; }
function endFishing(hit){ const sea=fishing.sea; fishing=null;
  if(!hit){ toast("💨 鱼跑掉了……"); return; }
  const r=Math.random(); let f;
  if(r<.02) f="koi"; else if(sea) f=r<.5?"bream":r<.85?"bass":"octopus";
  else f=r<.5?"carp":r<.85?"bass":"trout";
  addItem(f); addXP(12); toast("🎣 钓到了 "+ITEMS[f].n+"！"); }

/* ================= 救援任务系统 ================= */
const MTYPES=[
  {id:"fire",   pup:"marshall",desc:"森林火灾！",  how:"切换毛毛，靠近火焰按空格灭火",   spot:()=>[140+(Math.random()*50|0),38+(Math.random()*16|0)], n:3, reward:[220,25]},
  {id:"kitten", pup:"chase",   desc:"小猫走失了！",how:"切换阿奇，按空格追踪，找到小猫按E", spot:()=>[Math.random()<.5?20+(Math.random()*60|0):150+(Math.random()*40|0), 40+(Math.random()*80|0)], n:1, reward:[180,20]},
  {id:"swim",   pup:"zuma",    desc:"有人落水了！",how:"切换路马，游到落水者身边按E",    spot:()=>[30+(Math.random()*150|0),141+(Math.random()*12|0)], n:1, reward:[240,28]},
  {id:"snow",   pup:"everest", desc:"雪山有人被困！",how:"切换珠珠，赶到雪山按E救援",    spot:()=>[20+(Math.random()*160|0),16+(Math.random()*14|0)], n:1, reward:[240,28]},
  {id:"slide",  pup:"rubble",  desc:"山体滑坡堵路！",how:"切换小砾，按空格击碎路上的落石", spot:()=>[100+(Math.random()*40|0),80], n:3, reward:[200,22]},
  {id:"drop",   pup:"skye",    desc:"空投救援物资！",how:"切换天天，飞到目标点按E空投",   spot:()=>[60+(Math.random()*100|0),18+(Math.random()*12|0)], n:1, reward:[220,25]},
  {id:"clean",  pup:"rocky",   desc:"海滩垃圾告急！",how:"切换灰灰，在垃圾旁按空格回收5件", spot:()=>[100,133], n:5, reward:[180,20]},
];
function maybeSpawnMission(){ if(S.missions.length>=2) return;
  let pool=MTYPES.slice(); if(S.weather==="storm") pool=pool.concat([MTYPES[0],MTYPES[0]]);
  const mt=pool[Math.random()*pool.length|0]; spawnMission(mt); }
function spawnMission(mt){
  const m={uid:++S.missionSeq,type:mt.id,pup:mt.pup,desc:mt.desc,how:mt.how,need:mt.n,got:0,reward:mt.reward,targets:[]};
  for(let i=0;i<mt.n;i++){ let [x,y]=mt.spot(); let tries=0;
    while(tries++<40&&(!WALKABLE(tileAt(x,y))&&mt.id!=="swim"||objs[okey(x,y)])){ [x,y]=mt.spot(); }
    m.targets.push({x,y,done:false});
    if(mt.id==="fire") objs[okey(x,y)]={t:"fire",uid:m.uid};
    if(mt.id==="slide") objs[okey(x,y)]={t:"rock",slide:m.uid};
    if(mt.id==="kitten") objs[okey(x,y)]={t:"kitten",uid:m.uid}; }
  S.missions.push(m);
  toast("🚨 救援警报："+m.desc+"（需要 "+PUPS[m.pup].name+"）"); UI.missions(); }
function missionProgress(m){ m.got++;
  if(m.got>=m.need){ S.missions=S.missions.filter(x=>x!==m);
    addCoins(m.reward[0]); S.pts+=m.reward[1]; addXP(30);
    toast("✅ 救援成功！+"+m.reward[0]+"金币 +"+m.reward[1]+"⭐救援积分"); }
  UI.missions(); UI.top(); }
function activeMissionFor(pupOrType){ return S.missions.find(m=>m.pup===pupOrType||m.type===pupOrType); }

/* ================= 技能（空格） ================= */
function useSkill(){
  const p=S.curPup, [fx,fy]=facingTile(), pk=okey(fx,fy), here=okey(ptx(),pty());
  if(p==="marshall"){ for(const k of around()){ const o=objs[k];
      if(o&&o.t==="fire"){ delete objs[k]; splash(fx,fy,"#7ec8e3");
        const m=S.missions.find(m=>m.uid===o.uid); m&&missionProgress(m); addXP(8); toast("🔥→💧 火扑灭了！"); return; } }
    toast("附近没有火焰"); }
  else if(p==="rubble"){ for(const k of around()){ const o=objs[k];
      if(o&&o.t==="rock"){ const [x,y]=k.split(",").map(Number); delete objs[k]; splash(x,y,"#b8a48a");
        if(o.slide){ const m=S.missions.find(m=>m.uid===o.slide); m&&missionProgress(m); }
        addItem(o.ore||"stone"); addXP(6); return; } }
    toast("面前没有岩石"); }
  else if(p==="rocky"){ for(const k of around()){ const o=objs[k];
      if(o&&o.t==="junk"){ delete objs[k]; addItem("material"); addXP(5); S.junkGot++;
        const m=activeMissionFor("clean"); m&&missionProgress(m); toast("♻️ 垃圾变材料！"); return; } }
    toast("附近没有垃圾"); }
  else if(p==="skye"){ if(!S.flying){ S.flying=3.2; toast("🪽 天天起飞！（3秒内可飞越一切）"); } }
  else if(p==="chase"){ const m=S.missions.find(m=>m.pup==="chase")||S.missions[0];
    if(m){ const t=m.targets.find(t=>!t.done)||m.targets[0]; S.trackTo={x:t.x,y:t.y,ttl:6}; toast("🔍 阿奇锁定了目标方向！"); }
    else toast("现在没有需要追踪的任务"); }
  else if(p==="zuma") toast("🌊 路马本来就会游泳！直接下水吧！");
  else if(p==="everest") toast("❄️ 珠珠在雪地/冰面上会自动加速！");
  function around(){ return [pk,here,okey(fx+1,fy),okey(fx-1,fy),okey(fx,fy+1),okey(fx,fy-1),okey(ptx()+1,pty()),okey(ptx()-1,pty()),okey(ptx(),pty()+1),okey(ptx(),pty()-1)]; }
}

/* ================= 互动（E键） ================= */
function interact(){
  if(dlg.open){ dlg.next(); return; }
  const [fx,fy]=facingTile(), k=okey(fx,fy), here=okey(ptx(),pty());
  // NPC
  const n=npcs.find(n=>dist(n.x,n.y,ptx(),pty())<2.2);
  if(n){ dlg.show(n.name+" "+n.ic, n.d[Math.random()*n.d.length|0], n); return; }
  // 建筑
  for(const b of buildings){ if(ptx()>=b.x-1&&ptx()<=b.x+b.w&&pty()>=b.y-1&&pty()<=b.y+b.h+1){
    if(b.type==="shop"){ UI.shop(); return; }
    if(b.type==="hq"){ UI.hq(); return; }
    if(b.type==="bin"){ shipSell(); return; }
    if(b.type==="home"){ sleep(); return; } } }
  // 对象
  for(const kk of [k,here]){ const o=objs[kk];
    if(!o) continue;
    if(o.t==="bush"&&o.ready){ o.ready=0; addItem("berry"); addXP(4); toast("🫐 采到了森林浆果！"); return; }
    if(o.t==="chest"&&!S.openedChests[o.id]){ S.openedChests[o.id]=1;
      const loot=[["coins",300],["gem",1],["diamond",1],["treat",2],["gold",2],["coins",500]][Math.random()*6|0];
      if(loot[0]==="coins"){addCoins(loot[1]); toast("🎁 宝箱！+"+loot[1]+"金币！");}
      else{addItem(loot[0],loot[1]); toast("🎁 宝箱！获得 "+ITEMS[loot[0]].n+"×"+loot[1]+"！");}
      addXP(20); delete objs[kk]; return; }
    if(o.t==="kitten"){ const m=S.missions.find(m=>m.uid===o.uid); delete objs[kk];
      m&&missionProgress(m); toast("🐱 找到小猫啦！"); return; }
    if(o.t==="bear"){ if(S.bearCalmed){ dlg.show("森林巨熊 🐻","呼噜噜……（它现在是你的朋友了）"); return; }
      if(countItem("treat")>0){ takeItem("treat",1); S.bearFed++;
        if(S.bearFed>=3){ S.bearCalmed=true; addCoins(1000); S.pts+=50; addItem("diamond");
          toast("🐻💛 巨熊被安抚了！+1000金币 +50⭐ +钻石！"); UI.top(); }
        else toast("🦴 巨熊吃了饼干（"+S.bearFed+"/3），眼神温柔了一些…");
      } else dlg.show("森林巨熊 🐻","吼——！（它看起来又饿又生气，也许骨头饼干能安抚它？商店有卖）");
      return; } }
  // 任务点（落水/雪山/空投）
  for(const m of S.missions){ for(const t of m.targets){ if(t.done) continue;
    if(dist(t.x,t.y,ptx(),pty())<2.5&&["swim","snow","drop"].includes(m.type)){
      if(S.curPup!==m.pup){ toast("需要 "+PUPS[m.pup].name+" 才能完成！按Q切换"); return; }
      t.done=true; missionProgress(m); return; } } }
  // 收获
  if(S.crops[k]&&harvest(k)) return;
  if(S.crops[here]&&harvest(here)) return;
  // 工具
  useTool();
}
function shipSell(){ let total=0;
  S.inv.forEach((s,i)=>{ if(s&&ITEMS[s.id].sell){ total+=ITEMS[s.id].sell*s.c; S.inv[i]=null; } });
  if(total>0){ S.shipped=(S.shipped||0)+total; UI.hotbar(); toast("📦 已放入出货箱，明早结算 "+total+" 金币"); }
  else toast("背包里没有可以出售的东西"); }

/* ================= 对话框 ================= */
const dlg={open:false,npc:null,
  show(who,txt,npc){ this.open=true; this.npc=npc||null; $("dialog").style.display="block";
    $("dialog").querySelector(".who").textContent=who; $("dialog").querySelector(".txt").textContent=txt; },
  next(){ this.open=false; this.npc=null; $("dialog").style.display="none"; },
  gift(){ if(!this.npc) return; const s=S.inv[S.sel];
    if(!s||ITEMS[s.id].tool){ toast("先在物品栏选中要送的礼物（1-9）"); return; }
    const n=this.npc, liked=n.like===s.id;
    S.friendship[n.name]=Math.min(10,(S.friendship[n.name]||0)+(liked?2:1));
    toast((liked?"💖 ":"💛 ")+n.name+(liked?"超喜欢":"收下了")+" "+ITEMS[s.id].n+"！好感 "+S.friendship[n.name]+"/10");
    removeItem(S.sel); addXP(8); this.next(); } };

/* ================= 存档 ================= */
function save(){ try{ const d={...S}; d.cropsSaved=S.crops;
    localStorage.setItem("pawAdventureSave",JSON.stringify(d)); }catch(e){} }
function load(){ try{ const d=JSON.parse(localStorage.getItem("pawAdventureSave"));
    if(!d) return false; Object.assign(S,d); S.missions=S.missions||[]; S.flying=0; fishing=null;
    // 重放世界差异：作物地块
    for(const k in S.crops){ const [x,y]=k.split(",").map(Number); map[gi(x,y)]=S.crops[k].watered?T.WATERED:T.TILLED; }
    for(const id in S.openedChests){ for(const k in objs) if(objs[k].t==="chest"&&objs[k].id==id) delete objs[k]; }
    // 重放进行中的任务对象
    for(const m of S.missions) for(const t of m.targets){ if(t.done) continue;
      if(m.type==="fire") objs[okey(t.x,t.y)]={t:"fire",uid:m.uid};
      if(m.type==="slide") objs[okey(t.x,t.y)]={t:"rock",slide:m.uid};
      if(m.type==="kitten") objs[okey(t.x,t.y)]={t:"kitten",uid:m.uid}; }
    return true; }catch(e){ return false; } }
const hasSave=()=>{ try{ return !!localStorage.getItem("pawAdventureSave"); }catch(e){ return false; } };
/* ================= UI ================= */
const UI={
  top(){ const h=Math.floor(S.min/60),m=S.min%60;
    $("clock").textContent="🕐 "+h+":"+String(m).padStart(2,"0");
    $("dateTxt").textContent=SEASONS[S.season].ic+" "+SEASONS[S.season].n+" 第"+S.day+"天";
    $("weatherTxt").textContent=WICON[S.weather];
    $("money").textContent=S.coins; $("rescuePts").textContent=S.pts; $("lvTxt").textContent=S.level; },
  hotbar(){ const hb=$("hotbar"); hb.innerHTML="";
    S.inv.forEach((s,i)=>{ const d=document.createElement("div"); d.className="slot"+(i===S.sel?" sel":"");
      d.innerHTML='<span class="key">'+(i+1)+'</span>'+(s?ITEMS[s.id].ic+(s.c>1?'<span class="cnt">'+s.c+'</span>':""):"");
      if(s) d.title=ITEMS[s.id].n; d.onclick=()=>{S.sel=i;UI.hotbar();}; hb.appendChild(d); }); },
  pupbar(){ const pb=$("pupbar"); pb.innerHTML="";
    PUP_KEYS.forEach(k=>{ const p=PUPS[k],d=document.createElement("div");
      d.className="pupbtn"+(k===S.curPup?" active":"");
      d.innerHTML='<div class="dot" style="background:'+p.color+'"></div>'+p.name+" "+p.ic;
      d.title=p.tip+"（Lv."+pupLv(k)+"）"; d.onclick=()=>{S.curPup=k;UI.pupbar();toast(p.name+"出动！"+p.tip);};
      pb.appendChild(d); }); },
  missions(){ const el=$("missionList");
    if(!S.missions.length){ el.innerHTML="暂无任务。<br><small>去救援总部🚨接任务，或等待警报！</small>"; return; }
    el.innerHTML=S.missions.map(m=>'<div class="mrow">🚨 <b>'+m.desc+'</b>（'+m.got+"/"+m.need+"）<br><small>"+m.how+"</small></div>").join(""); },
  openWin(title,html){ $("winTitle").textContent=title; $("winBody").innerHTML=html; $("bigwin").style.display="block"; },
  closeWin(){ $("bigwin").style.display="none"; },
  shop(){ let h=SHOP.map(([id,p],i)=>{ const it=ITEMS[id];
      return '<div class="shoprow"><span style="font-size:24px">'+it.ic+'</span><span class="nm">'+it.n+
        (CROPS[id]?"（"+CROPS[id].grow+"天成熟 → "+ITEMS[CROPS[id].yield].n+" 卖"+ITEMS[CROPS[id].yield].sell+"金）":"")+
        '</span><b style="color:#e67e22">🪙'+p+'</b><button onclick="buyItem('+i+')" '+(S.coins<p?"disabled":"")+'>购买</button></div>'; }).join("");
    h+='<div class="shoprow"><span style="font-size:24px">💰</span><span class="nm">把背包里能卖的东西全部卖掉</span><button onclick="sellAll()">一键出售</button></div>';
    this.openWin("🛒 波特杂货店",h); },
  hq(){ const canMission=S.missions.length<2;
    let h='<div class="statrow">⭐ 救援积分：<b style="color:#e67e22">'+S.pts+'</b>　🎖️ 速度徽章：'+(S.badges||0)+'/5</div>';
    h+='<div class="shoprow"><span style="font-size:24px">📋</span><span class="nm">领取一个新的救援任务</span><button onclick="hqMission()" '+(canMission?"":"disabled")+'>'+(canMission?"领取":"已满")+'</button></div>';
    h+='<div class="shoprow"><span style="font-size:24px">🪙</span><span class="nm">10⭐ 兑换 200 金币</span><button onclick="hqExchange()" '+(S.pts>=10?"":"disabled")+'>兑换</button></div>';
    h+='<div class="shoprow"><span style="font-size:24px">🎖️</span><span class="nm">30⭐ 购买速度徽章（永久跑得更快）</span><button onclick="hqBadge()" '+(S.pts>=30&&(S.badges||0)<5?"":"disabled")+'>购买</button></div>';
    h+='<div class="statrow" style="margin-top:10px">🐶 队员等级：</div><div class="collgrid" style="grid-template-columns:repeat(4,1fr)">';
    PUP_KEYS.forEach(k=>{h+='<div class="collitem"><div class="ic">'+PUPS[k].ic+'</div>'+PUPS[k].name+'<br>Lv.'+pupLv(k)+'</div>';});
    h+='</div><div style="font-size:13px;color:#b08850;margin-top:8px">提示：多用某只狗狗执行任务，它就会升级、能力更强！在这里或回家(农场小屋)按 E 也可以睡觉进入第二天。</div>';
    this.openWin("🚨 汪汪队救援总部",h); },
  bag(){ let h='<div class="statrow">🏅 冒险等级 Lv.'+S.level+'<div class="xpbar"><i style="width:'+Math.min(100,S.xp/(S.level*100)*100)+'%"></i></div></div>';
    h+='<div class="statrow">🪙 '+S.coins+'　⭐ '+S.pts+'　🎁 已开宝箱 '+Object.keys(S.openedChests).length+'/16　🐻 巨熊：'+(S.bearCalmed?"已成为朋友💛":"尚未安抚")+'</div>';
    COLLECT_GROUPS.forEach(g=>{ h+='<div class="statrow">'+g.t+'（'+g.ids.filter(i=>S.collections[i]).length+'/'+g.ids.length+'）</div><div class="collgrid">';
      g.ids.forEach(id=>{ const got=S.collections[id];
        h+='<div class="collitem'+(got?"":" locked")+'"><div class="ic">'+ITEMS[id].ic+'</div>'+(got?ITEMS[id].n:"???")+'</div>'; });
      h+='</div>'; });
    h+='<div class="statrow">💛 好感度：</div><div class="collgrid" style="grid-template-columns:repeat(2,1fr)">';
    npcs.forEach(n=>{h+='<div class="collitem" style="text-align:left;padding-left:10px">'+n.ic+" "+n.name+"　"+"❤️".repeat(Math.min(10,S.friendship[n.name]||0))+'</div>';});
    h+='</div>'; this.openWin("🎒 冒险手册",h); },
};
function buyItem(i){ const [id,p]=SHOP[i]; if(S.coins<p)return;
  if(addItem(id)){ S.coins-=p; UI.top(); UI.shop(); toast("购买了 "+ITEMS[id].n); } }
function sellAll(){ let t=0; S.inv.forEach((s,i)=>{ if(s&&ITEMS[s.id].sell){t+=ITEMS[s.id].sell*s.c;S.inv[i]=null;} });
  if(t>0){ addCoins(t); UI.hotbar(); UI.shop(); toast("💰 卖出 +"+t+" 金币！"); } else toast("没有可出售的物品"); }
function hqMission(){ maybeSpawnMission(); UI.hq(); }
function hqExchange(){ if(S.pts>=10){ S.pts-=10; addCoins(200); UI.top(); UI.hq(); toast("兑换成功 +200金币"); } }
function hqBadge(){ if(S.pts>=30&&(S.badges||0)<5){ S.pts-=30; S.badges=(S.badges||0)+1; UI.top(); UI.hq(); toast("🎖️ 速度徽章 +1！跑得更快了！"); } }

/* ================= 渲染 ================= */
const cv=$("game"), cx=cv.getContext("2d");
function resize(){ cv.width=innerWidth; cv.height=innerHeight; cx.imageSmoothingEnabled=false; }
addEventListener("resize",resize); resize();
let cam={x:0,y:0}, particles=[], gameT=0;
function splash(tx,ty,col){ for(let i=0;i<10;i++) particles.push({x:tx*TILE+16,y:ty*TILE+16,
  vx:(Math.random()-.5)*120,vy:-Math.random()*120,life:.6,col}); }
const TCOL={[T.GRASS]:["#7cbf5e","#74b757"],[T.WATER]:["#4a9fd8","#4497ce"],[T.SAND]:["#e8d49a","#e2cd90"],
  [T.SNOW]:["#eef4f8","#e5edf3"],[T.ROCK]:["#8d8d95","#84848c"],[T.PATH]:["#d9b98a","#d3b282"],
  [T.SOIL]:["#b58c5f","#ae8558"],[T.TILLED]:["#8a6742","#82603c"],[T.WATERED]:["#6b4e30","#64482b"],
  [T.WOOD]:["#c09055","#b8884d"],[T.ICE]:["#cfe8f5","#c5e2f1"],[T.CAVE]:["#5c5560","#544d58"]};
function drawTile(x,y,t){ const sx=x*TILE-cam.x, sy=y*TILE-cam.y;
  cx.fillStyle=TCOL[t][(x+y)%2]; cx.fillRect(sx,sy,TILE,TILE);
  if(t===T.WATER){ cx.fillStyle="rgba(255,255,255,.25)";
    if((x*7+y*13+Math.floor(gameT*2))%9===0) cx.fillRect(sx+6,sy+12,12,3); }
  if(t===T.GRASS&&(x*31+y*17)%23===0){ cx.fillStyle="#68a94e"; cx.fillRect(sx+8,sy+8,3,6); cx.fillRect(sx+20,sy+16,3,6); }
  if(t===T.WATERED){} }
function emoji(e,tx,ty,size=24,dy=0){ cx.font=size+"px serif"; cx.textAlign="center"; cx.textBaseline="middle";
  cx.fillText(e,tx*TILE-cam.x+16,ty*TILE-cam.y+14+dy); }
function drawPlayer(){
  const x=S.px-cam.x, y=S.py-cam.y, p=PUPS[S.curPup];
  const bob=S.moving?Math.sin(S.animT*12)*2:0, fly=S.flying>0?-10+Math.sin(gameT*10)*2:0;
  cx.save(); cx.translate(x+16,y+16+bob+fly);
  if(S.flying>0){ cx.fillStyle="rgba(0,0,0,.2)"; cx.beginPath(); cx.ellipse(0,26,10,4,0,0,7); cx.fill(); }
  // 尾巴
  cx.fillStyle="#e8d5b5"; cx.save(); cx.rotate(Math.sin(gameT*8)*.4); cx.fillRect(S.dir===3?8:-14,2,7,4); cx.restore();
  // 身体（白狗+制服）
  cx.fillStyle="#f7f1e3"; cx.fillRect(-10,-6,20,16);
  cx.fillStyle=p.color; cx.fillRect(-10,2,20,8);           // 制服
  // 头
  cx.fillStyle="#f7f1e3"; cx.fillRect(-8,-18,16,14);
  cx.fillStyle="#caa876"; cx.fillRect(-9,-18,5,8); cx.fillRect(4,-18,5,8);   // 耳朵
  // 脸
  cx.fillStyle="#3a2a18";
  if(S.dir===2||S.dir===0){ cx.fillRect(-5,-13,3,3); cx.fillRect(2,-13,3,3); cx.fillRect(-1.5,-9,3,2); }
  else { const o=S.dir===1?3:-3; cx.fillRect(o-1,-13,3,3); cx.fillRect(o*1.8-1,-9,3,2); }
  // 帽子
  cx.fillStyle=p.color; cx.fillRect(-8,-22,16,5);
  if(S.curPup==="skye"&&S.flying>0){ cx.fillStyle="rgba(255,255,255,.85)";
    const w=Math.sin(gameT*20)*4; cx.fillRect(-20,-4+w,9,3); cx.fillRect(11,-4-w,9,3); }
  // 腿
  cx.fillStyle="#f7f1e3"; const st=S.moving?Math.sin(S.animT*12)*3:0;
  cx.fillRect(-8,10,4,6+st); cx.fillRect(4,10,4,6-st);
  cx.restore();
  cx.font="700 12px sans-serif"; cx.textAlign="center"; cx.fillStyle="#fff";
  cx.strokeStyle="rgba(0,0,0,.5)"; cx.lineWidth=3;
  cx.strokeText(p.name,x+16,y-16+fly); cx.fillText(p.name,x+16,y-16+fly); }
function render(){
  const vw=cv.width,vh=cv.height;
  cam.x=Math.max(0,Math.min(MW*TILE-vw,S.px-vw/2)); cam.y=Math.max(0,Math.min(MH*TILE-vh,S.py-vh/2));
  const x0=Math.floor(cam.x/TILE),y0=Math.floor(cam.y/TILE),x1=Math.min(MW,x0+vw/TILE+2),y1=Math.min(MH,y0+vh/TILE+2);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++) drawTile(x,y,map[gi(x,y)]);
  // 冬季地面覆霜
  if(S.season===3){ cx.fillStyle="rgba(255,255,255,.28)"; cx.fillRect(0,0,vw,vh); }
  // 作物
  for(const k in S.crops){ const [x,y]=k.split(",").map(Number);
    if(x<x0||x>x1||y<y0||y>y1)continue; const c=S.crops[k],g=CROPS[c.seed],r=c.stage/g.grow;
    if(r>=1) emoji(ITEMS[g.yield].ic,x,y,24);
    else if(r>=.5) emoji("🌿",x,y,20);
    else emoji("🌱",x,y,14,4); }
  // 建筑
  for(const b of buildings){ const sx=b.x*TILE-cam.x,sy=b.y*TILE-cam.y,w=b.w*TILE,h=b.h*TILE;
    if(sx>vw||sy>vh||sx+w<0||sy+h<0)continue;
    cx.fillStyle=b.col; cx.fillRect(sx,sy+h*.28,w,h*.72);
    cx.fillStyle="#a8442c"; cx.beginPath(); cx.moveTo(sx-6,sy+h*.32); cx.lineTo(sx+w/2,sy-h*.15); cx.lineTo(sx+w+6,sy+h*.32); cx.fill();
    cx.fillStyle="#5b3a1a"; cx.fillRect(sx+w/2-12,sy+h-26,24,26);
    cx.fillStyle="#ffe9b0"; cx.fillRect(sx+10,sy+h*.45,16,14); cx.fillRect(sx+w-26,sy+h*.45,16,14);
    cx.font="20px serif"; cx.textAlign="center"; cx.fillText(b.ic,sx+w/2,sy+h*.2);
    cx.font="700 13px sans-serif"; cx.fillStyle="#fff"; cx.strokeStyle="rgba(0,0,0,.45)"; cx.lineWidth=3;
    cx.strokeText(b.name,sx+w/2,sy-10); cx.fillText(b.name,sx+w/2,sy-10); }
  // 对象
  for(const k in objs){ const [x,y]=k.split(",").map(Number);
    if(x<x0-1||x>x1||y<y0-1||y>y1)continue; const o=objs[k];
    if(o.t==="tree") emoji(S.season===3?"🌲":(o.v?"🌳":"🌲"),x,y,30,-6);
    else if(o.t==="bush") emoji(o.ready?"🫐":"🌿",x,y,22);
    else if(o.t==="flower") emoji(["🌸","🌼","🌻"][o.v],x,y,S.season===3?0:16);
    else if(o.t==="rock"){ emoji("🪨",x,y,24); if(o.ore){ cx.fillStyle={copper:"#e67e22",iron:"#bdc3c7",gold:"#f1c40f",diamond:"#5dade2"}[o.ore];
      cx.fillRect(x*TILE-cam.x+12,y*TILE-cam.y+10,8,8); } }
    else if(o.t==="cactus") emoji("🌵",x,y,26,-2);
    else if(o.t==="chest") emoji("🎁",x,y,22);
    else if(o.t==="fire") emoji("🔥",x,y,22+Math.sin(gameT*8+x)*5);
    else if(o.t==="junk") emoji("🗑️",x,y,18);
    else if(o.t==="kitten") emoji("🐱",x,y,20);
    else if(o.t==="bear") emoji(S.bearCalmed?"🐻💛":"🐻",x,y,40,-8); }
  // 任务点标记
  for(const m of S.missions) for(const t of m.targets){ if(t.done)continue;
    const bx=t.x*TILE-cam.x+16, by=t.y*TILE-cam.y-8+Math.sin(gameT*4)*4;
    if(bx<-40||bx>vw+40||by<-40||by>vh+40)continue;
    cx.font="26px serif"; cx.textAlign="center"; cx.fillText(["swim"].includes(m.type)?"🆘":"📍",bx,by);
    if(m.type==="swim") emoji("🙋",t.x,t.y,22);
    if(m.type==="snow") emoji("🧍",t.x,t.y,22);
    if(m.type==="drop") emoji("🎯",t.x,t.y,22); }
  // NPC
  for(const n of npcs){ const sx=n.x*TILE-cam.x+16, sy=n.y*TILE-cam.y+8;
    if(sx<-40||sx>vw+40||sy<-40||sy>vh+40)continue;
    cx.font="26px serif"; cx.textAlign="center"; cx.fillText(n.ic,sx,sy);
    cx.font="700 11px sans-serif"; cx.fillStyle="#fff"; cx.strokeStyle="rgba(0,0,0,.45)"; cx.lineWidth=3;
    cx.strokeText(n.name,sx,sy-20); cx.fillText(n.name,sx,sy-20);
    if((S.friendship[n.name]||0)>=8){ cx.font="12px serif"; cx.fillText("💛",sx+20,sy-20); } }
  drawPlayer();
  // 追踪箭头
  if(S.trackTo&&S.trackTo.ttl>0){ const a=Math.atan2(S.trackTo.y*TILE-S.py,S.trackTo.x*TILE-S.px);
    cx.save(); cx.translate(S.px-cam.x+16,S.py-cam.y-30); cx.rotate(a);
    cx.fillStyle="#f1c40f"; cx.beginPath(); cx.moveTo(24,0); cx.lineTo(6,-9); cx.lineTo(6,9); cx.fill(); cx.restore(); }
  // 粒子
  particles.forEach(p=>{ cx.globalAlpha=Math.max(0,p.life/.6); cx.fillStyle=p.col;
    cx.fillRect(p.x-cam.x,p.y-cam.y,4,4); cx.globalAlpha=1; });
  // 天气
  if(["rain","storm"].includes(S.weather)){ cx.strokeStyle="rgba(140,180,230,.55)"; cx.lineWidth=1.5; cx.beginPath();
    for(let i=0;i<70;i++){ const rx=(i*137+gameT*520)%vw, ry=(i*211+gameT*820)%vh; cx.moveTo(rx,ry); cx.lineTo(rx-3,ry+12); } cx.stroke();
    if(S.weather==="storm"&&Math.random()<.006){ cx.fillStyle="rgba(255,255,255,.7)"; cx.fillRect(0,0,vw,vh); } }
  if(["snow","blizzard"].includes(S.weather)){ cx.fillStyle="rgba(255,255,255,.9)";
    const n=S.weather==="blizzard"?120:50, sp=S.weather==="blizzard"?300:80;
    for(let i=0;i<n;i++){ const rx=(i*97+gameT*sp+Math.sin(gameT+i)*30)%vw, ry=(i*173+gameT*120)%vh;
      cx.beginPath(); cx.arc(rx,ry,2,0,7); cx.fill(); } }
  if(S.weather==="fog"){ cx.fillStyle="rgba(220,225,230,.45)"; cx.fillRect(0,0,vw,vh); }
  // 昼夜光影
  const hh=S.min/60; let dark=0;
  if(hh>=19) dark=Math.min(.62,(hh-19)*.18); else if(hh<7) dark=.4;
  const inCave=tileAt(ptx(),pty())===T.CAVE;
  if(inCave) dark=Math.max(dark,.55);
  if(dark>0){ cx.fillStyle="rgba(10,15,45,"+dark+")"; cx.fillRect(0,0,vw,vh);
    const g=cx.createRadialGradient(S.px-cam.x+16,S.py-cam.y+16,20,S.px-cam.x+16,S.py-cam.y+16,150);
    g.addColorStop(0,"rgba(255,235,170,"+dark*.55+")"); g.addColorStop(1,"rgba(0,0,0,0)");
    cx.fillStyle=g; cx.fillRect(0,0,vw,vh); }
  // 节日烟花（每季第7天晚上）
  if(S.day===DAYS_PER_SEASON&&hh>=19&&Math.random()<.08){ const fx=Math.random()*vw, fy=Math.random()*vh*.4;
    const col=["#ff6b6b","#ffd93d","#6bcB77","#4d96ff","#e87fb8"][Math.random()*5|0];
    for(let i=0;i<24;i++){ const a=i/24*Math.PI*2; particles.push({x:fx+cam.x,y:fy+cam.y,vx:Math.cos(a)*90,vy:Math.sin(a)*90,life:.6,col}); } }
  // 钓鱼条
  if(fishing){ const bw=360,bx=vw/2-bw/2,by=vh-140;
    cx.fillStyle="rgba(60,40,20,.85)"; cx.fillRect(bx-8,by-8,bw+16,44);
    cx.fillStyle="#2c3e50"; cx.fillRect(bx,by,bw,28);
    cx.fillStyle="#27ae60"; cx.fillRect(bx+fishing.zone*bw,by,bw*.22,28);
    cx.font="20px serif"; cx.fillText("🐟",bx+fishing.pos*bw,by+14);
    cx.font="700 14px sans-serif"; cx.fillStyle="#ffe9b0"; cx.textAlign="center";
    cx.fillText(fishing.hooked?"❗上钩了！鱼在绿区时按空格！":"等待鱼儿上钩……",vw/2,by-16); }
}

/* ================= 输入 · 移动 · 主循环 ================= */
const keys={};
addEventListener("keydown",e=>{
  if(!S.started) return;
  keys[e.key.toLowerCase()]=true;
  const k=e.key.toLowerCase();
  if(k>="1"&&k<="9"){ S.sel=+k-1; UI.hotbar(); }
  if(k==="q"){ const i=PUP_KEYS.indexOf(S.curPup); S.curPup=PUP_KEYS[(i+1)%PUP_KEYS.length];
    UI.pupbar(); toast(PUPS[S.curPup].name+"出动！"+PUPS[S.curPup].tip); }
  if(k==="e") interact();
  if(k==="g") dlg.open&&dlg.gift();
  if(k==="b"){ $("bigwin").style.display==="block"?UI.closeWin():UI.bag(); }
  if(k==="escape") UI.closeWin();
  if(k===" "){ e.preventDefault();
    if(fishing){ if(fishing.hooked){ const inZone=Math.abs(fishing.pos-(fishing.zone+.11))<.13; endFishing(inZone); }
      return; }
    useSkill(); }
  if(k==="enter"){ // 总部或家旁睡觉
    for(const b of buildings) if((b.type==="hq"||b.type==="home")&&ptx()>=b.x-2&&ptx()<=b.x+b.w+1&&pty()>=b.y-2&&pty()<=b.y+b.h+2){ sleep(); return; }
    toast("要回到总部🚨或农场小屋🏠旁边才能睡觉哦"); }
});
addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);

function blocked(tx,ty){
  if(tx<0||ty<0||tx>=MW||ty>=MH) return true;
  if(S.flying>0) return false;
  const t=tileAt(tx,ty);
  if(t===T.ROCK) return true;
  if(t===T.WATER&&S.curPup!=="zuma") return true;
  const o=objs[okey(tx,ty)];
  if(o&&["tree","rock","cactus","bear","chest"].includes(o.t)) return true;
  for(const b of buildings) if(tx>=b.x&&tx<b.x+b.w&&ty>=b.y&&ty<b.y+b.h) return true;
  return false; }
function tryMove(dx,dy,dt){
  let sp=150*(1+.02*(S.level-1)+.08*(S.badges||0));
  const t=tileAt(ptx(),pty());
  if(S.curPup==="everest"&&(t===T.SNOW||t===T.ICE)) sp*=1.7;
  if(S.curPup==="zuma"&&t===T.WATER) sp*=1.3;
  if(t===T.SAND&&S.curPup!=="zuma") sp*=.9;
  if(S.weather==="blizzard"&&t===T.SNOW&&S.curPup!=="everest") sp*=.6;
  const nx=S.px+dx*sp*dt, ny=S.py+dy*sp*dt, m=8;
  if(dx&&!blocked(Math.floor((nx+(dx>0?TILE-m:m))/TILE),Math.floor((S.py+TILE/2)/TILE))) S.px=nx;
  if(dy&&!blocked(Math.floor((S.px+TILE/2)/TILE),Math.floor((ny+(dy>0?TILE-m:m))/TILE))) S.py=ny;
  S.px=Math.max(0,Math.min(MW*TILE-TILE,S.px)); S.py=Math.max(0,Math.min(MH*TILE-TILE,S.py)); }

let last=0, minAcc=0;
function loop(ts){
  requestAnimationFrame(loop);
  const dt=Math.min(.05,(ts-last)/1000)||0; last=ts; if(!S.started) return;
  gameT+=dt; S.animT+=dt;
  // 移动
  let dx=0,dy=0;
  if(keys.w||keys.arrowup){dy=-1;S.dir=0;} if(keys.s||keys.arrowdown){dy=1;S.dir=2;}
  if(keys.a||keys.arrowleft){dx=-1;S.dir=3;} if(keys.d||keys.arrowright){dx=1;S.dir=1;}
  S.moving=!!(dx||dy);
  if(S.moving&&!dlg.open&&$("bigwin").style.display!=="block"){ if(dx&&dy){dx*=.707;dy*=.707;} tryMove(dx,dy,dt); }
  if(S.flying>0){ S.flying-=dt; if(S.flying<=0){ // 落地防卡水
      let tx=ptx(),ty=pty();
      if(blocked(tx,ty)&&S.curPup!=="zuma"){ outer: for(let r=1;r<8;r++) for(let ax=-r;ax<=r;ax++) for(let ay=-r;ay<=r;ay++)
        if(!blocked(tx+ax,ty+ay)){ S.px=(tx+ax)*TILE; S.py=(ty+ay)*TILE; break outer; } }
      // 空投任务判定
      } }
  if(S.trackTo){ S.trackTo.ttl-=dt; if(S.trackTo.ttl<=0) S.trackTo=null; }
  // 钓鱼
  if(fishing){ fishing.t+=dt; fishing.pos=.5+.42*Math.sin(fishing.t*(fishing.hooked?4:1.5));
    if(fishing.t>14){ endFishing(false); } }
  // 时间流逝：1现实秒 = 2游戏分钟
  minAcc+=dt*2; if(minAcc>=1){ S.min+=Math.floor(minAcc); minAcc%=1;
    if(S.min>=24*60){ toast("🌙 太晚啦，狗狗们睡着了……"); sleep(); }
    UI.top(); }
  // 随机任务警报
  if(Math.random()<dt*.005&&S.min<20*60) maybeSpawnMission();
  // NPC 走动
  for(const n of npcs){ n.mt-=dt;
    if(n.mt<=0){ n.mt=2+Math.random()*3;
      const nx=n.hx+((Math.random()*n.r*2)|0)-n.r, ny=n.hy+((Math.random()*n.r*2)|0)-n.r;
      if(WALKABLE(tileAt(nx,ny))&&!objs[okey(nx,ny)]){ n.tx=nx; n.ty=ny; } }
    if(n.tx!==undefined){ const spd=1.4*dt;
      n.x+=Math.max(-spd,Math.min(spd,n.tx-n.x)); n.y+=Math.max(-spd,Math.min(spd,n.ty-n.y)); } }
  // 粒子
  particles=particles.filter(p=>{ p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=200*dt; return p.life>0; });
  render();
}

/* ================= 启动 ================= */
function startGame(fresh){
  genWorld();
  if(!fresh&&hasSave()) load();
  else { rollWeather(); }
  $("title").style.display="none"; S.started=true;
  UI.top(); UI.hotbar(); UI.pupbar(); UI.missions();
  toast("🐾 欢迎来到冒险湾！先去找农夫老麦学种地吧（农场在西边）");
  setTimeout(()=>{ if(S.missions.length===0&&S.day===1&&S.season===0) spawnMission(MTYPES[1]); },30000);
}
$("btnNew").onclick=()=>{ try{localStorage.removeItem("pawAdventureSave");}catch(e){} startGame(true); };
$("btnLoad").onclick=()=>startGame(false);
if(hasSave()) $("btnLoad").style.display="inline-block";
requestAnimationFrame(loop);
