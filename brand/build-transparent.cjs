const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const root = __dirname;
const out = path.join(root, 'transparent');
fs.mkdirSync(out, {recursive:true});
const tile = fs.readFileSync(path.join(root,'source/app-icon.svg'),'utf8');
const symbol = tile.replace(/<rect[^>]*fill="#FFFFFF"[^>]*\/>/g,'');
const logo = fs.readFileSync(path.join(root,'source/logo-variation-a.svg'),'utf8');
fs.writeFileSync(path.join(out,'symbol.svg'),symbol);
fs.writeFileSync(path.join(out,'logo-variation-a.svg'),logo);
const sizes = [16,20,24,32,40,48,64,128,180,192,256,512,1024];
(async()=>{
 const images = new Map();
 for(const size of sizes){
  const png = await sharp(Buffer.from(symbol)).resize(size,size).png().toBuffer();
  const {data,info} = await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(const i of [0,size-1,size*(size-1),size*size-1]) if(data[i*4+3]!==0) throw Error(`Opaque corner: ${size}`);
  if(info.width!==size||info.height!==size) throw Error('Wrong dimensions');
  images.set(size,png);
  fs.writeFileSync(path.join(out,`icon-${size}.png`),png);
 }
 await sharp(Buffer.from(logo)).resize({width:2200}).png().toFile(path.join(out,'logo-variation-a.png'));
 for(const [name,icoSizes] of [['LattesEditor.ico',[16,20,24,32,40,48,64,128,256]],['favicon.ico',[16,32,48]]]){
  const header=Buffer.alloc(6+16*icoSizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(icoSizes.length,4);let offset=header.length;
  const chunks=icoSizes.map((n,i)=>{const data=images.get(n),j=6+i*16;header[j]=header[j+1]=n===256?0:n;header.writeUInt16LE(1,j+4);header.writeUInt16LE(32,j+6);header.writeUInt32LE(data.length,j+8);header.writeUInt32LE(offset,j+12);offset+=data.length;return data;});
  fs.writeFileSync(path.join(out,name),Buffer.concat([header,...chunks]));
 }
 const chunks=[['icp4',16],['ic11',32],['icp5',32],['ic12',64],['ic07',128],['ic13',256],['ic08',256],['ic14',512],['ic09',512],['ic10',1024]].map(([tag,n])=>{const data=images.get(n),head=Buffer.alloc(8);head.write(tag);head.writeUInt32BE(data.length+8,4);return Buffer.concat([head,data]);});
 const payload=Buffer.concat(chunks),head=Buffer.alloc(8);head.write('icns');head.writeUInt32BE(payload.length+8,4);fs.writeFileSync(path.join(out,'LattesEditor.icns'),Buffer.concat([head,payload]));
 // Checkerboard exists only in this preview, never in exported artwork.
 const checker='<svg width="840" height="360"><defs><pattern id="c" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#fff"/><path d="M0 0H16V16H0Z M16 16H32V32H16Z" fill="#e8e8e8"/></pattern></defs><rect width="840" height="360" fill="url(#c)"/></svg>';
 await sharp(Buffer.from(checker)).composite([{input:await sharp(Buffer.from(symbol)).resize(280,280).png().toBuffer(),left:40,top:40},{input:await sharp(Buffer.from(logo)).resize({width:310,height:310,fit:'inside'}).png().toBuffer(),left:470,top:25}]).png().toFile(path.join(out,'preview.png'));
 console.log('Transparent SVG, wordmark, 13 PNG sizes, ICO and ICNS generated; dimensions and alpha verified.');
})();
