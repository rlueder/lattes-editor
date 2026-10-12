const fs=require('fs');const path=require('path');
const sharp=require('sharp');
const root=__dirname;
const original=fs.readFileSync(path.join(root,'source/symbol-original.svg'),'utf8');
let body=original.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'').replace(/<title>.*?<\/title>/,'').replace(/<path[^>]*visibility="hidden"\/>/g,'');
function write(name,data){const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,data);}
function svg(content){return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><title>LattesEditor</title>${content}</svg>`;}
function artwork({mac=false,mask=false,mono=false,small=false,dev=false}={}){
 let b=body;
 if(mono)b=b.replaceAll('#9EF2E2','#463C6D');
 // Usa o símbolo aprovado, incluindo o vão diagonal de x/4 e as duas barras espessas.
 const scale=mask?.65:mac?.76:.91;
 const cx=305.1139373779297;const cy=435.19700622558594;
 const tx=512-cx*scale; const ty=512-cy*scale;
 const tile=mask?'<rect width="1024" height="1024" fill="#FFFFFF"/>':mac?'<rect x="52" y="52" width="920" height="920" rx="205" fill="#FFFFFF"/>':'<rect width="1024" height="1024" rx="205" fill="#FFFFFF"/>';
 return svg(tile+`<g transform="translate(${tx} ${ty}) scale(${scale})">${b}</g>`+(dev?devBadge(mac):''));
}
// Selo DEV no canto inferior direito, para distinguir o app de desenvolvimento
// (pnpm desktop:dev) do instalado. Cobre a argola menta; cor de cobre da grade.
function devBadge(mac){
 const label=fs.readFileSync(path.join(root,'construction/dev-label.svg'),'utf8');
 const view=label.match(/viewBox="([^"]+)"/)[1];const [,,lw,lh]=view.split(' ').map(Number);
 const edge=mac?988:1012;const W=520,H=236,x=edge-W,y=edge-H;
 const th=112,tw=lw*th/lh;
 const inner=label.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'').replace(/<title>.*?<\/title>/,'');
 return `<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="${H/2}" fill="#D4774D"/><svg x="${x+(W-tw)/2}" y="${y+(H-th)/2}" width="${tw}" height="${th}" viewBox="${view}">${inner}</svg>`;
}
function icns(dir,out){
 const icnsEntries=[['icp4','16x16'],['ic11','16x16@2x'],['icp5','32x32'],['ic12','32x32@2x'],['ic07','128x128'],['ic13','128x128@2x'],['ic08','256x256'],['ic14','256x256@2x'],['ic09','512x512'],['ic10','512x512@2x']];
 const chunks=icnsEntries.map(([tag,name])=>{const data=fs.readFileSync(path.join(root,dir+'/icon_'+name+'.png'));const header=Buffer.alloc(8);header.write(tag);header.writeUInt32BE(data.length+8,4);return Buffer.concat([header,data]);});
 const payload=Buffer.concat(chunks);const header=Buffer.alloc(8);header.write('icns');header.writeUInt32BE(payload.length+8,4);write(out,Buffer.concat([header,payload]));
}
async function png(name,source,size){write(name,await sharp(Buffer.from(source)).resize(size,size).png().toBuffer());}
async function ico(name,sizes,opts={}){const buffers=[];for(const n of sizes){buffers.push(await sharp(Buffer.from(artwork({small:n<=32,...opts}))).resize(n,n).png().toBuffer());}
 const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length;
 sizes.forEach((n,i)=>{const j=6+i*16;header[j]=n===256?0:n;header[j+1]=n===256?0:n;header.writeUInt16LE(1,j+4);header.writeUInt16LE(32,j+6);header.writeUInt32LE(buffers[i].length,j+8);header.writeUInt32LE(offset,j+12);offset+=buffers[i].length;});write(name,Buffer.concat([header,...buffers]));}
(async()=>{
 write('source/symbol-original.svg',original);write('source/app-icon.svg',artwork());write('source/macos-icon.svg',artwork({mac:true}));write('source/maskable-icon.svg',artwork({mask:true}));
 await png('source/app-icon-1024.png',artwork(),1024);
 await png('macos/app-icon-1024.png',artwork({mac:true}),1024);
 await png('windows/app-icon-256.png',artwork(),256);


 for(const n of [16,32,128,256,512]){await png(`macos/LattesEditor.iconset/icon_${n}x${n}.png`,artwork({mac:true,small:n<=32}),n);await png(`macos/LattesEditor.iconset/icon_${n}x${n}@2x.png`,artwork({mac:true,small:n<=16}),n*2);}
 await ico('windows/LattesEditor.ico',[16,20,24,32,40,48,64,128,256]);
 for(const n of [16,24,32,48,64,128,256,512])await png(`linux/hicolor/${n}x${n}/apps/latteseditor.png`,artwork({small:n<=32}),n);
 write('linux/hicolor/scalable/apps/latteseditor.svg',artwork());
 await ico('browser/favicon.ico',[16,32,48]);write('browser/favicon.svg',artwork({small:true}));
 for(const n of [16,32,48])await png(`browser/favicon-${n}x${n}.png`,artwork({small:true}),n);
 await png('browser/apple-touch-icon.png',artwork({mask:true}),180);
 for(const n of [192,512]){await png(`browser/icon-${n}.png`,artwork(),n);await png(`browser/icon-maskable-${n}.png`,artwork({mask:true}),n);}
 write('browser/safari-pinned-tab.svg',svg(`<g transform="translate(234.346316986084 115.9707243347168) scale(.91)">${body.replaceAll('#463C6D','#000000').replaceAll('#9EF2E2','#000000')}</g>`));
 write('browser/site.webmanifest',JSON.stringify({name:'LattesEditor',short_name:'LattesEditor',id:'./',start_url:'./',scope:'./',display:'standalone',theme_color:'#FFFFFF',background_color:'#FFFFFF',icons:[{src:'icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:'icon-maskable-192.png',sizes:'192x192',type:'image/png',purpose:'maskable'},{src:'icon-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]},null,2));
 write('browser/head-snippet.html',`<!-- Copie os arquivos da pasta browser para a raiz pública do app. Ajuste os caminhos se usar uma subpasta. -->
<link rel="icon" href="./favicon.ico" sizes="any">
<link rel="icon" href="./favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="./apple-touch-icon.png" sizes="180x180">
<link rel="mask-icon" href="./safari-pinned-tab.svg" color="#463C6D">
<link rel="manifest" href="./site.webmanifest">
<meta name="theme-color" content="#FFFFFF">
`);
 const samples=[['macOS',artwork({mac:true})],['Windows / Linux',artwork()],['Browser',artwork({small:true})],['Maskable / touch',artwork({mask:true})]];
 const composites=[];
 for(let i=0;i<samples.length;i++){const [label,art]=samples[i];composites.push({input:await sharp(Buffer.from(art)).resize(180,180).png().toBuffer(),left:55+i*250,top:65});composites.push({input:Buffer.from(`<svg width="240" height="50"><text x="120" y="30" font-family="sans-serif" font-size="18" text-anchor="middle" fill="#463C6D">${label}</text></svg>`),left:25+i*250,top:260});}
 for(let i=0;i<4;i++){const n=[16,24,32,48][i];composites.push({input:await sharp(Buffer.from(artwork({small:true}))).resize(n,n).png().toBuffer(),left:400+i*60,top:340});}
 await sharp({create:{width:1040,height:420,channels:4,background:'#f6f4f1'}}).composite(composites).png().toFile(path.join(root,'preview.png'));
 icns('macos/LattesEditor.iconset','macos/LattesEditor.icns');
 // Ícones do app de desenvolvimento, com o selo DEV (src-tauri/tauri.dev.conf.json).
 for(const n of [16,32,128,256,512]){await png(`dev/LattesEditor.iconset/icon_${n}x${n}.png`,artwork({mac:true,small:n<=32,dev:true}),n);await png(`dev/LattesEditor.iconset/icon_${n}x${n}@2x.png`,artwork({mac:true,small:n<=16,dev:true}),n*2);}
 icns('dev/LattesEditor.iconset','dev/LattesEditor.icns');
 await ico('dev/LattesEditor.ico',[16,20,24,32,40,48,64,128,256],{dev:true});
 for(const n of [32,128,256,512])await png(`dev/app-icon-${n}.png`,artwork({small:n<=32,dev:true}),n);
 console.log('Desktop and browser assets generated.');
})();