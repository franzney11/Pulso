"""Genera el icono de Pulso (cuentarrevoluciones con zona roja) en PNG e ICO.

Uso: npm run icons   (necesita Python 3 + Pillow: pip install pillow)
"""
import math
import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), "..")
SS = 4            # supersampling para bordes suaves
SIZE = 256 * SS

BG = (18, 22, 28, 255)         # grafito
TRACK = (58, 68, 82, 255)      # tramo "de fábrica" apagado
AMBER = (255, 176, 46, 255)    # aguja y zona de boost
RED = (255, 77, 61, 255)       # línea roja = overclock


def build() -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=int(SIZE * 0.22), fill=BG)

    c = SIZE / 2
    r = SIZE * 0.34
    w = int(SIZE * 0.085)
    box = (c - r, c - r, c + r, c + r)
    # Ángulos de PIL: 0° = 3 en punto, sentido horario. El arco va de 135° a 405°.
    d.arc(box, 135, 275, fill=TRACK, width=w)
    d.arc(box, 275, 340, fill=AMBER, width=w)
    d.arc(box, 340, 405, fill=RED, width=w)

    # Aguja apuntando a la zona de boost
    a = math.radians(318)
    tip = (c + math.cos(a) * r * 0.9, c + math.sin(a) * r * 0.9)
    d.line((c, c, *tip), fill=AMBER, width=int(SIZE * 0.045))
    hub = SIZE * 0.065
    d.ellipse((c - hub, c - hub, c + hub, c + hub), fill=AMBER)
    d.ellipse((c - hub * 0.45, c - hub * 0.45, c + hub * 0.45, c + hub * 0.45), fill=BG)
    return img.resize((256, 256), Image.LANCZOS)


def main() -> None:
    icon = build()
    build_dir = os.path.join(ROOT, "build")
    assets_dir = os.path.join(ROOT, "src", "renderer", "assets")
    os.makedirs(build_dir, exist_ok=True)
    os.makedirs(assets_dir, exist_ok=True)
    icon.save(os.path.join(build_dir, "icon.png"))
    icon.save(os.path.join(assets_dir, "icon.png"))
    icon.save(
        os.path.join(build_dir, "icon.ico"),
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print("Iconos generados en build/ y src/renderer/assets/")


if __name__ == "__main__":
    main()
