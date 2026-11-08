// Cuts source-images/unloading.png into the layers in public/assets/parts.
// Pass a file path to also write a preview of the result.
const sharp=require('sharp'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const SRC=ROOT+'/source-images/unloading.png', OUT=ROOT+'/public/assets/parts';
fs.mkdirSync(OUT,{recursive:true});

// ---- value noise for grime
function mkNoise(seed){let s=seed;const r=()=>(s=(s*16807)%2147483647)/2147483647;const G=256,t=new Float32Array(G*G);for(let i=0;i<G*G;i++)t[i]=r();
 const sm=x=>x*x*(3-2*x);
 return(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),fx=sm(x-xi),fy=sm(y-yi),a=(xi&255),b=(yi&255),c=((xi+1)&255),d=((yi+1)&255);
  const A=t[a+b*G],B=t[c+b*G],C=t[a+d*G],D=t[c+d*G];return A+(B-A)*fx+(C-A)*fy+(A-B-C+D)*fx*fy;}}
const n=mkNoise(4242);
const fbm=(x,y)=>(n(x,y)*.5+n(x*2.1+7,y*2.1+3)*.27+n(x*4.3+1,y*4.3+9)*.15+n(x*9.1,y*9.1)*.08);

const poly=p=>p.map(a=>a.join(',')).join(' ');
const PARTS={
 chassis:`<polygon points="${poly([[90,340],[520,340],[520,631],[1080,631],[1148,642],[1148,818],[1100,818],[1100,782],[690,782],[487,782],[487,822],[470,822],[470,776],[90,776]])}"/>
  <circle cx="364" cy="761" r="102"/><circle cx="796.5" cy="761" r="102"/><circle cx="1027" cy="761" r="104"/>
  <circle cx="773" cy="760" r="100"/><circle cx="996" cy="760" r="100"/><circle cx="376" cy="760" r="100"/>`,
 wheel1:'<circle cx="362.5" cy="762" r="101"/>',
 wheel2:'<circle cx="798" cy="762" r="101"/>',
 wheel3:'<circle cx="1028" cy="762" r="101"/>',
 bed:`<polygon points="${poly([[640,8],[720,8],[1320,290],[1352,312],[1352,345],[1322,352],[1297,362],[1306,392],[1361,512],[1306,696],[1186,654],[1186,706],[1148,706],[1148,640],[1100,626],[1060,604],[780,474],[700,434],[596,386],[586,405],[566,405],[552,372],[520,340],[520,290]])}"/>`,
 gate:`<polygon points="${poly([[1297,362],[1322,352],[1352,345],[1352,325],[1430,370],[1450,392],[1600,650],[1600,668],[1440,706],[1424,700],[1361,512],[1306,392]])}"/>`,
};

(async()=>{
 const {data,info}=await sharp(SRC).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const W=info.width,H=info.height,N=W*H,px=Buffer.from(data);
 // flood background from the border
 const bg=new Uint8Array(N),q=new Int32Array(N);let h=0,t=0;
 const white=i=>Math.min(data[i*4],data[i*4+1],data[i*4+2])>=232;
 const push=i=>{if(!bg[i]&&white(i)){bg[i]=1;q[t++]=i}};
 for(let x=0;x<W;x++){push(x);push(x+(H-1)*W)} for(let y=0;y<H;y++){push(y*W);push(W-1+y*W)}
 // enclosed pockets between the tyres and under the frame
 function push2(i){if(!bg[i]){bg[i]=1;q[t++]=i}}
 for(let y=690;y<820;y++)for(let x=470;x<1150;x++){const i=x+y*W;if(Math.min(data[i*4],data[i*4+1],data[i*4+2])>=205)push2(i)}
 while(h<t){const i=q[h++],x=i%W;if(x>0)push(i-1);if(x<W-1)push(i+1);if(i>=W)push(i-W);if(i<N-W)push(i+W)}
 // feather two rings and pull colour in from the solid side to kill the white halo
 const dist=new Uint8Array(N);
 const near=(i,mark)=>{const x=i%W;return (x>0&&mark[i-1])||(x<W-1&&mark[i+1])||(i>=W&&mark[i-W])||(i<N-W&&mark[i+W])};
 const ring1=[];for(let i=0;i<N;i++)if(!bg[i]&&near(i,bg)){dist[i]=1;ring1.push(i)}
 const mark1=new Uint8Array(N);ring1.forEach(i=>mark1[i]=1);
 const ring2=[];for(let i=0;i<N;i++)if(!bg[i]&&!dist[i]&&near(i,mark1)){dist[i]=2;ring2.push(i)}
 const mark2=new Uint8Array(N);ring2.forEach(i=>mark2[i]=1);
 const ring3=[];for(let i=0;i<N;i++)if(!bg[i]&&!dist[i]&&near(i,mark2)){dist[i]=3;ring3.push(i)}
 // grime + grade
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(x+y*W)*4;
  let r=data[i],g=data[i+1],b=data[i+2];
  const L=.3*r+.59*g+.11*b, sat=.78;
  r=L+(r-L)*sat;g=L+(g-L)*sat;b=L+(b-L)*sat;
  const f=fbm(x/90,y/90), fine=fbm(x/9,y/14), streak=fbm(x/14,y/140);
  let m=.66+.5*f; m*=.86+.22*fine; m*=.86+.26*streak; if(m>1.02)m=1.02;
  r*=m*.97;g*=m*.95;b*=m*.88;
  // rust/dirt blooms on the paint
  const paint=Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])>70;
  if(paint){const big=fbm(x/13+40,y/30+11),small=fbm(x/4+3,y/5+77);
   const rust=Math.max(0,big*.55+small*.45-.63)*7;
   if(rust>0){const k=Math.min(.5,rust);r+=(88-r)*k;g+=(62-g)*k;b+=(40-b)*k}}
  px[i]=Math.min(255,r);px[i+1]=Math.min(255,g);px[i+2]=Math.min(255,b);
 }
 const copyIn=(rings,mark)=>{for(const i of rings){const x=i%W;for(const j of [i-1,i+1,i-W,i+W]){if(j<0||j>=N)continue;if(Math.abs((j%W)-x)>1)continue;if(mark[j]){px[i*4]=px[j*4];px[i*4+1]=px[j*4+1];px[i*4+2]=px[j*4+2];break}}}};
 const solid2=new Uint8Array(N);for(let i=0;i<N;i++)if(!bg[i]&&dist[i]!==1&&dist[i]!==2)solid2[i]=1;
 copyIn(ring2,solid2);ring2.forEach(i=>solid2[i]=1);copyIn(ring1,solid2);
 for(let i=0;i<N;i++){px[i*4+3]=bg[i]?0:dist[i]===1?70:dist[i]===2?200:255}

 // stencil the company name on the door
 const door=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g font-family="Impact,Arial Black,sans-serif" fill="#2a1d08" opacity=".82"><text x="212" y="579" font-size="27" letter-spacing="1.5">ETUKWARUU</text><text x="213" y="598" font-size="12.5" letter-spacing="1.3">WASTE DISPOSAL CO.</text></g></svg>`);
 const painted=await sharp(px,{raw:{width:W,height:H,channels:4}}).composite([{input:door,blend:'over'}]).raw().toBuffer();
 // the text overlay must not add alpha outside the truck
 for(let i=0;i<N;i++)painted[i*4+3]=px[i*4+3];

 const man={};
 for(const [name,shape] of Object.entries(PARTS)){
  const mask=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g fill="#fff">${shape}</g></svg>`)).ensureAlpha().extractChannel(3).raw().toBuffer();
  const out=Buffer.from(painted);let x0=W,y0=H,x1=0,y1=0;
  for(let i=0;i<N;i++){const a=Math.round(out[i*4+3]*mask[i]/255);out[i*4+3]=a;if(a>8){const x=i%W,y=(i-x)/W;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
  const box={left:x0,top:y0,width:x1-x0+1,height:y1-y0+1};
  await sharp(out,{raw:{width:W,height:H,channels:4}}).extract(box).webp({quality:88,alphaQuality:95,effort:5}).toFile(`${OUT}/${name}.webp`);
  man[name]={x:x0,y:y0,w:box.width,h:box.height};
 }
 fs.writeFileSync(OUT+'/manifest.json',JSON.stringify(man,null,1));
 console.log(man);
 if(!process.argv[2])return;
 // preview on a dark background
 const bgp=await sharp({create:{width:W,height:H,channels:4,background:'#3b4a58'}}).png().toBuffer();
 const comp=[];for(const k of ['bed','gate','chassis','wheel1','wheel2','wheel3'])comp.push({input:await sharp(`${OUT}/${k}.webp`).png().toBuffer(),left:man[k].x,top:man[k].y});
 await sharp(bgp).composite(comp).png().toFile(process.argv[2]);
})();
