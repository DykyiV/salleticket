import QRCode from "qrcode";

/** Data-URL PNG QR code for a ticket verification payload. */
export async function qrCodeDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });
}

export async function qrCodePngBuffer(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });
}
