// Identifies an uploaded file by its actual bytes ("magic numbers"), never by the client-supplied
// filename or Content-Type — both are attacker-controlled. Upload call sites used to trust
// `file.mimetype` and derive the stored extension from `originalname`, which let anyone upload
// `evil.html` labelled `image/png` and have it served back as text/html from the API origin
// (stored XSS). The stored extension and content-type now come from what this returns, and only
// these formats are recognised at all.

export interface SniffedType {
  mime: string;
  ext: string;
  isImage: boolean;
}

const JPEG: SniffedType = { mime: 'image/jpeg', ext: '.jpg', isImage: true };
const PNG: SniffedType = { mime: 'image/png', ext: '.png', isImage: true };
const WEBP: SniffedType = { mime: 'image/webp', ext: '.webp', isImage: true };
const PDF: SniffedType = { mime: 'application/pdf', ext: '.pdf', isImage: false };
const ZIP: SniffedType = { mime: 'application/zip', ext: '.zip', isImage: false };

export function sniffFileType(buf: Buffer): SniffedType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return JPEG;
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return PNG;
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return WEBP;
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return PDF;
  // Local-file-header signature only; an empty archive (PK\x05\x06) is deliberately not accepted.
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return ZIP;
  return null;
}
