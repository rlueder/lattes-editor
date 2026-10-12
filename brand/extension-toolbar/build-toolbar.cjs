const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=__dirname;
const original=fs.readFileSync(path.join(root,'../source/symbol-original.svg'),'utf8');
let shape=original.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'').replace(/<title>.*?<\/title>/,'');
// Remove a moldura fina e as três linhas pequenas. Duas linhas espessas mantêm a ideia de documento.
shape=shape.replace(/<path fill="#463C6D" d="M181\.41909790039062 230\.89703369140625[^>]*\/>/,'').replace(/<rect[^>]*\/>/g,'');
shape+='<path fill="#463C6D" d="M230 345H530V417H230Z M230 495H450V567H230Z"/>';
function svg(color,small=false){
 let s=shape.replaceAll('#463C6D',color).replaceAll('#9EF2E2',color);
 if(small)s=s.replace('H395.823486328125V696.4424743652344L278.81744384765625 813.4485168457031','H372.499363716832V696.4424743652344L255.4933212363633 813.4485168457031');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><title>LattesEditor · ícone de barra</title><g transform="translate(179.4258 37.6353) scale(1.09)">${s}</g></svg>`;
}
function write(file,data){const p=path.join(root,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,data);}
(async()=>{
const layers=[];
for(const [variant,color,bg] of [['dark-toolbar','#FFFFFF','#383838'],['light-toolbar','#202124','#F3F3F3']]){
 write(variant+'/icon.svg',svg(color));
 for(const size of [16,20,24,32,48,64,128]){
  const data=await sharp(Buffer.from(svg(color,size<=24))).resize(size,size).png().toBuffer();write(variant+`/icon-${size}.png`,data);
  const {data:raw,info}=await sharp(data).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(raw[3]!==0 || raw[(info.width*info.height-1)*4+3]!==0)throw Error('Background not transparent');
 }
 const top=variant==='dark-toolbar'?0:220;
 layers.push({input:Buffer.from(`<svg width="960" height="220"><rect width="960" height="220" fill="${bg}"/><text x="28" y="36" fill="${color}" font-family="sans-serif" font-size="18">${variant==='dark-toolbar'?'Barra escura · branco':'Barra clara · grafite'}</text></svg>`),left:0,top});
 for(let i=0;i<4;i++){
  const size=[16,20,24,32][i];
  layers.push({input:fs.readFileSync(path.join(root,variant,`icon-${size}.png`)),left:44+i*112,top:top+96-Math.floor(size/2)});
  layers.push({input:Buffer.from(`<svg width="90" height="30"><text x="0" y="20" fill="${color}" font-family="sans-serif" font-size="14">${size} px</text></svg>`),left:36+i*112,top:top+126});
 }
 layers.push({input:await sharp(Buffer.from(svg(color,true))).resize(96,96).png().toBuffer(),left:750,top:top+60});
 layers.push({input:Buffer.from(`<svg width="140" height="30"><text x="0" y="20" fill="${color}" font-family="sans-serif" font-size="14">Detalhe ampliado</text></svg>`),left:735,top:top+168});
 write(variant+'/action-icons.json',JSON.stringify({action:{default_icon:Object.fromEntries([16,20,24,32].map(n=>[n,`icons/toolbar/${variant}/icon-${n}.png`]))}},null,2));
}
await sharp({create:{width:960,height:440,channels:4,background:'#FFFFFF'}}).composite(layers).png().toFile(path.join(root,'preview.png'));
console.log('Transparent high-contrast icons generated and alpha checked.');
})();
