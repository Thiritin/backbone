// RFC 1321 MD5 over the UTF-8 bytes of a string, as MySQL's MD5() returns it: 32 lowercase hex digits.
const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

export function md5(text: string): string {
  const bytes = [...new TextEncoder().encode(text)], bits = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 0; i < 8; i++) bytes.push(i < 4 ? (bits >>> (8 * i)) & 0xff : 0);
  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  for (let at = 0; at < bytes.length; at += 64) {
    const m = Array.from({ length: 16 }, (_, i) => bytes[at + i * 4] | (bytes[at + i * 4 + 1] << 8) | (bytes[at + i * 4 + 2] << 16) | (bytes[at + i * 4 + 3] << 24));
    let [a, b, c, d] = h;
    for (let i = 0; i < 64; i++) {
      const r = i >> 4;
      const f = r === 0 ? (b & c) | (~b & d) : r === 1 ? (d & b) | (~d & c) : r === 2 ? b ^ c ^ d : c ^ (b | ~d);
      const g = r === 0 ? i : r === 1 ? (5 * i + 1) % 16 : r === 2 ? (3 * i + 5) % 16 : (7 * i) % 16;
      const x = (a + f + K[i] + m[g]) | 0, s = S[r * 4 + (i % 4)];
      [a, d, c] = [d, c, b];
      b = (b + ((x << s) | (x >>> (32 - s)))) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
  }
  return h.map((v) => Array.from({ length: 4 }, (_, i) => ((v >>> (8 * i)) & 0xff).toString(16).padStart(2, "0")).join("")).join("");
}
