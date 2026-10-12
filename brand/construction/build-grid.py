from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from math import sqrt
import json
out=Path(__file__).parent
fontfile=out/'fonts'/'ibm-plex-sans-var-latin1.woff2'
fonts={w:instantiateVariableFont(TTFont(fontfile),{'wght':w},inplace=False) for w in [400,500,600,700]}
glyphs={w:f.getGlyphSet() for w,f in fonts.items()}

def outline(parts):
 p=SVGPathPen(None);bounds=BoundsPen(None);adv=0
 for text,w in parts:
  gs=glyphs[w];p.glyphSet=gs;bounds.glyphSet=gs
  for c in text:
   g=gs[fonts[w].getBestCmap()[ord(c)]]
   g.draw(TransformPen(p,(1,0,0,-1,adv,0)));g.draw(TransformPen(bounds,(1,0,0,-1,adv,0)));adv+=g.width
 return p.getCommands(),bounds.bounds

def text(s,x,y,size=20,w=400,color='#50495B'):
 d,_=outline([(s,w)])
 return f'<path fill="{color}" d="{d}" transform="translate({x} {y}) scale({size/1000})"/>'

# Medidas reais do L em IBM Plex Sans 600 (1000 unidades por em).
p=SVGPathPen(glyphs[600]);glyphs[600]['L'].draw(p)
xmin=81.7197265625;xmax=488.80535888671875;stem_right=213.660888671875
u=stem_right-xmin;h=698;foot=117.00604248046875
r=.875*u;hole=.375*u;cy=r;baseline=h+r;ftop=baseline-foot
cx=u/2;rx=4.125*u;ry=baseline-foot/2
cut=3*u;gap=u/4;shift=gap*sqrt(2)
V='#463C6D';M='#9EF2E2'
# Corte de 45 graus; a distância perpendicular entre cortes é x/4.
clip=f'<defs><clipPath id="l-cut"><path d="M-200 {cy+hole}H{cut}V{ftop}L{cut-foot} {baseline}H-200Z"/></clipPath></defs>'
l=f'<g clip-path="url(#l-cut)"><path fill="{V}" d="{p.getCommands()}" transform="translate({-xmin} {baseline}) scale(1 -1)"/></g>'
def ring(x,y,color):
 return f'<path fill="{color}" fill-rule="evenodd" d="M{x+r} {y}a{r} {r} 0 1 0 {-2*r} 0a{r} {r} 0 1 0 {2*r} 0M{x+hole} {y}a{hole} {hole} 0 1 0 {-2*hole} 0a{hole} {hole} 0 1 0 {2*hole} 0"/>'
connector=f'<path fill="{M}" d="M{cut+shift} {ftop}H{rx-hole-1}V{baseline}H{cut-foot+shift}Z"/>'
# Documento assentado na subgrade de x/4; altura e espaçamento do texto derivados de x.
x0=1.75*u;yt=1.75*u;xf=3.375*u;xr=4.125*u;fold=.75*u;t=.25*u;bottom=4.5*u
top_left=1.375*u
page=f'<path fill="{V}" d="M{top_left} {yt}H{xf}L{xr} {yt+fold}V{bottom}H{xr-t}V{yt+fold}H{xf}V{yt+t}H{top_left}Z"/>'
lines=''
for y,width in [(3*u,1.75*u),(3.625*u,1.375*u),(4.25*u,u)]:
 lines+=f'<rect x="{x0}" y="{y}" width="{width}" height="{t}" fill="{V}"/>'
symbol=clip+l+ring(cx,cy,V)+connector+ring(rx,ry,M)+page+lines
left=cx-r;right=rx+r;center=(left+right)/2;symbolbottom=ry+r
wp,wb=outline([('Lattes',700),('Editor',400)])
wordscale=7*u/(wb[2]-wb[0]);wordx=center-3.5*u-wb[0]*wordscale
wordtop=symbolbottom+.5*u;wordy=wordtop-wb[1]*wordscale
word=f'<path fill="{V}" d="{wp}" transform="translate({wordx} {wordy}) scale({wordscale})"/>'
lockup=symbol+word

def svg(w,h,body,title,view=None):
 return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{view or f"0 0 {w} {h}"}" role="img"><title>{title}</title>{body}</svg>'
minx=center-4*u;maxy=wordy+wb[3]*wordscale+.5*u
view=f'{minx} {-u/2} {8*u} {maxy+u/2}'
(out/'logo.svg').write_text(svg(1100,1250,lockup,'LattesEditor · construção modular',view))
(out/'symbol.svg').write_text(svg(800,950,symbol,'LattesEditor · símbolo modular',f'{left-u/2} {-u/2} {right-left+u} {symbolbottom+u}'))
(out/'clean-preview.svg').write_text(svg(1100,1250,f'<rect x="{minx}" y="{-u/2}" width="{8*u}" height="{maxy+u/2}" fill="white"/>'+lockup,'LattesEditor · marca ajustada',view))
# Prancha de construção; a malha fina é x/8, subdivisão necessária ao ritmo das linhas.
O=300;Y=200;S=1.08
body='<rect width="1800" height="1580" fill="#FFFFFF"/>'
body+=text('LattesEditor',70,78,38,700,V)+text('Grade de construção · base real IBM Plex Sans',70,119,23)
body+=text('x = largura da haste do L  /  malha fina = x/8',70,152,18)
step=u/8
for i in range(-12,57):
 x=O+i*step*S
 if 85<=x<=1190:
  major=i%8==0
  body+=f'<line x1="{x}" y1="180" x2="{x}" y2="1450" stroke="{ "#CEDCE4" if major else "#EDF2F5"}" stroke-width="{1.25 if major else .7}"/>'
for i in range(0,73):
 y=Y+i*step*S
 if y<=1450:
  major=i%8==0
  body+=f'<line x1="85" y1="{y}" x2="1190" y2="{y}" stroke="{ "#CEDCE4" if major else "#EDF2F5"}" stroke-width="{1.25 if major else .7}"/>'
body+=f'<g transform="translate({O} {Y}) scale({S})">{lockup}</g>'
# Linhas estruturais sobre a marca, distinguíveis da malha.
G='#D4774D'
for yy in [cy,baseline,ftop,ry,yt,bottom,wordtop]:
 sy=Y+yy*S
 body+=f'<line x1="120" y1="{sy}" x2="1145" y2="{sy}" stroke="{G}" stroke-width="1" stroke-dasharray="7 7" opacity=".65"/>'
for xx in [0,u,x0,rx,center]:
 sx=O+xx*S
 body+=f'<line x1="{sx}" y1="180" x2="{sx}" y2="1430" stroke="{G}" stroke-width="1" stroke-dasharray="7 7" opacity=".65"/>'
for xx,yy in [(cx,cy),(rx,ry)]:
 sx=O+xx*S;sy=Y+yy*S
 for rr in [r,hole]:body+=f'<circle cx="{sx}" cy="{sy}" r="{rr*S}" fill="none" stroke="{G}" stroke-width="1.4"/>'
 body+=f'<path d="M{sx-12} {sy}h24M{sx} {sy-12}v24" stroke="{G}" stroke-width="1.4"/>'
# Cota da unidade x, em um trecho livre da haste.
dy=Y+2.75*u*S;xa=O;xb=O+u*S
body+=f'<path d="M{xa} {dy-8}v16M{xa} {dy}H{xb}M{xb} {dy-8}v16" fill="none" stroke="#FFFFFF" stroke-width="2"/>'
body+=text('x',(xa+xb)/2-5,dy-14,20,500,'#FFFFFF')
# Cota vertical original do L.
dx=160;y1=Y+cy*S;y2=Y+baseline*S
body+=f'<path d="M{dx-8} {y1}h16M{dx} {y1}V{y2}M{dx-8} {y2}h16" fill="none" stroke="{G}" stroke-width="1.5"/>'
body+=f'<g transform="translate(143 {(y1+y2)/2+70}) rotate(-90)">'+text('H = 5,290x',0,0,18,500,G)+'</g>'
# Coluna de especificações com valores derivados, não arredondados para deformar a fonte.
notes=[('UNIDADE E FONTE',['x = haste do Plex L 600','x = 131,941 unidades da fonte','Altura do L: 698 = 5,290x','Pé do L: 117,006 = 0,887x']),('CÍRCULOS IGUAIS',['Diâmetro externo: 1,75x','Diâmetro interno: 0,75x','Anel: 0,50x']),('DOCUMENTO',['Traço e linhas: 0,25x','Dobra a 45°: 0,75x','Recuo superior: 0,375x','Recuo do texto: 0,75x','Entrelinhas: 0,625x','Comprimentos: 1,75 / 1,375 / 1x']),('CONEXÃO',['Cortes paralelos a 45°','Vão perpendicular: 0,25x','Espessura = pé original do L']),('ASSINATURA A',['IBM Plex Sans 700 / 400','Largura visível: 7x','Distância do símbolo: 0,50x','Centralização pelo contorno'])]
y=245
for title,rows in notes:
 body+=text(title,1260,y,20,600,V);y+=35
 for row in rows:body+=text(row,1260,y,18);y+=29
 y+=40
body+=text('Violeta e menta: marca  ·  azul: malha  ·  cobre: eixos e cotas',85,1516,18)
body+=text('Os elementos auxiliares seguem a malha; a proporção original do L permanece preservada.',85,1548,18)
(out/'construction-grid.svg').write_text(svg(1800,1580,body,'Grade de construção do logo LattesEditor com elementos aplicados'))
(out/'proportions.json').write_text(json.dumps({'module_font_units':u,'subgrid':'x/8','L_weight':600,'L_height_x':h/u,'L_foot_x':foot/u,'circle_outer_diameter_x':1.75,'circle_inner_diameter_x':.75,'document_stroke_x':.25,'fold_x':.75,'text_line_pitch_x':.625,'diagonal_gap_perpendicular_x':.25,'document_top_inset_after_stem_x':.375,'wordmark_weights':[700,400],'wordmark_ink_width_x':7,'wordmark_gap_x':.5},indent=2))
print('Construction sheet and normalized logo generated.')
