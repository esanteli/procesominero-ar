#!/usr/bin/env python3
"""Extrae la geometría del Rajo desde el .ai de Emilio (es un PDF por dentro) → js/stations/rajo-geo.js

Uso:  pip install pymupdf opencv-python numpy
      python tools/extraer-rajo.py "ruta/rajo_animacion_procesominero_v2.ai"

Toma la mesa de trabajo 5 (rajo + rutas): las curvas del pozo, la ruta de bajada (roja) y la de subida (azul,
se trae desde la copia derecha), el círculo de maniobra y las líneas de Minerales oxidados/sulfurados.
Todo queda en puntos del .ai; REG pasa esos puntos a píxeles de assets/infografia.jpg (5497 × 1623).
REG se obtuvo ajustando las curvas del pozo sobre la infografía (error medio < 1 px).
"""
import sys, json
import numpy as np, cv2, pymupdf as fitz

SRC = sys.argv[1] if len(sys.argv) > 1 else "rajo_animacion_procesominero_v2.ai"
OUT = sys.argv[2] if len(sys.argv) > 2 else "js/stations/rajo-geo.js"
REG = dict(s=1.37310, tx=-11.284, ty=123.260)
RIGHT = (-970.184, 5.349)  # desplazamiento de la copia derecha de la mesa 5 → copia izquierda
PIT = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 99, 100, 101, 102, 103, 104, 105]  # trazos del pozo (copia izquierda)

dr = fitz.open(SRC)[4].get_drawings()
f2 = lambda v: f"{v:.2f}".rstrip("0").rstrip(".")

def path_d(d, off=(0, 0)):
    out, cur = [], None
    P = lambda p: f"{f2(p.x + off[0])} {f2(p.y + off[1])}"
    for it in d["items"]:
        if it[0] == "l":
            a, b = it[1], it[2]
            if cur is None or abs(cur - a) > 1e-3: out.append("M" + P(a))
            out.append("L" + P(b)); cur = b
        elif it[0] == "c":
            a, c1, c2, b = it[1:5]
            if cur is None or abs(cur - a) > 1e-3: out.append("M" + P(a))
            out.append(f"C{P(c1)} {P(c2)} {P(b)}"); cur = b
    if d.get("closePath"): out.append("Z")
    return "".join(out)

def sample(d, step=1.0, off=(0, 0)):
    pts = []
    for it in d["items"]:
        if it[0] == "l":
            a, b = it[1], it[2]; n = max(2, int(abs(b - a) / step))
            pts += [(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t) for t in np.linspace(0, 1, n)]
        elif it[0] == "c":
            a, c1, c2, b = it[1:5]; n = max(3, int((abs(c1 - a) + abs(c2 - c1) + abs(b - c2)) / step))
            for t in np.linspace(0, 1, n):
                u = 1 - t
                pts.append((u**3*a.x + 3*u*u*t*c1.x + 3*u*t*t*c2.x + t**3*b.x, u**3*a.y + 3*u*u*t*c1.y + 3*u*t*t*c2.y + t**3*b.y))
    out = []
    for p in pts:
        p = (p[0] + off[0], p[1] + off[1])
        if not out or np.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) > 0.05: out.append(p)
    return out

hexc = lambda c: "#%02x%02x%02x" % tuple(round(v * 255) for v in c)
lines = []
for i in PIT:
    d = dr[i]; dash = d.get("dashes") or ""
    dash = dash.split("]")[0].strip(" [") if dash and dash != "[] 0" else ""
    lines.append(dict(d=path_d(d), c=hexc(d["color"]), w=round(d["width"], 2), dash=dash))

# silueta del pozo (lámina blanca, como el video con alfa): las curvas engrosadas, cerradas y rellenas
K, X0, Y0 = 4, 130, 290
img = np.zeros((int((840 - Y0) * K), int((900 - X0) * K)), np.uint8)
for i in PIT:
    q = ((np.array(sample(dr[i], 0.5)) - [X0, Y0]) * K).astype(np.int32)
    cv2.polylines(img, [q], False, 255, thickness=2 * K)
img = cv2.morphologyEx(img, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (44 * K, 44 * K)))
c = max(cv2.findContours(img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0], key=cv2.contourArea)
fill = np.zeros_like(img); cv2.drawContours(fill, [c], -1, 255, -1)
fill = cv2.dilate(fill, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (6 * K, 6 * K)))
c = max(cv2.findContours(fill, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0], key=cv2.contourArea)
ap = cv2.approxPolyDP(c, 0.6 * K, True)[:, 0, :] / K + [X0, Y0]
sil = "M" + "L".join(f"{f2(x)} {f2(y)}" for x, y in ap) + "Z"
bbox = [float(ap[:, 0].min()), float(ap[:, 1].min()), float(ap[:, 0].max()), float(ap[:, 1].max())]

rd = lambda pts: [[round(x, 1), round(y, 1)] for x, y in pts]
down = sample(dr[770], 1.0)                  # bajada (roja), de la entrada a la pala
up = sample(dr[1550], 1.0, RIGHT)            # subida (azul), de la pala a la salida
loop_c = [1554.56 + RIGHT[0], 602.88 + RIGHT[1]]  # círculo de maniobra (azul, 774)

leaders = []
for i in (875, 876, 877, 878, 879, 880):     # Minerales sulfurados (amarillo) y oxidados (rojo)
    d = dr[i]
    leaders.append(dict(d=path_d(d, RIGHT), c=hexc(d.get("color") or d.get("fill")), fill=d["type"] == "f", w=round(d.get("width") or 0, 2)))

geo = dict(REG=REG, BBOX=[round(v, 1) for v in bbox], SIL=sil, LINES=lines, LEADERS=leaders,
           DOWN=rd(down), UP=rd(up), LOOP=dict(c=[round(v, 2) for v in loop_c], r=40))
with open(OUT, "w", encoding="utf-8") as f:
    f.write("// Generado por tools/extraer-rajo.py desde rajo_animacion_procesominero_v2.ai (mesa 5). No editar a mano.\n")
    f.write("// Coordenadas en puntos del .ai; REG las lleva a px de assets/infografia.jpg: x·s + tx, y·s + ty.\n")
    for k, v in geo.items():
        f.write(f"export const {k} = {json.dumps(v, separators=(',', ':'))};\n")
print("ok", OUT, len(lines), "trazos,", len(down), "+", len(up), "puntos de ruta")
