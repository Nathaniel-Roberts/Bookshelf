import io

import barcode
from barcode.writer import SVGWriter
import qrcode
import qrcode.constants


def generate_code128_svg(data: str) -> bytes:
    code128 = barcode.get("code128", data, writer=SVGWriter())
    buf = io.BytesIO()
    code128.write(buf)
    return buf.getvalue()


def generate_qr_png(data: str) -> bytes:
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
