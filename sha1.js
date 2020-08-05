const SHA1dlen = 20;

function ROTL(x, n) {
	return (((x)<<n)|((x)>>>(32-n)));
}

const F = [
	function (x, y, z) {
		return (0x5a827999 + ((z) ^ ((x) & ((y) ^ (z)))));
	},
	function (x, y, z) {
		return (0x6ed9eba1 + ((x) ^ (y) ^ (z)));
	},
	function (x, y, z) {
		return (0x8f1bbcdc + (((x) & (y)) | (((x) | (y)) & (z))));
	},
	function (x, y, z) {
		return (0xca62c1d6 + ((x) ^ (y) ^ (z)));
	}
];

function sha1block(p, len, s) {
	var w = new Uint32Array(16);
	var a = new Uint32Array(5);
	var b;
	var i, j;
	var x = new Uint32Array(1);

	for (i = 0; i < len;) {
		a.set(s.slice(0, 5), 0);

		for (j = 0; j < 80; j++) {
			if (j < 16) {
				w[j] = p[i]<<24 | p[i+1]<<16 | p[i+2]<<8 | p[i+3];
				i += 4;
			} else {
				x[0] = w[(j-3)&15] ^ w[(j-8)&15] ^ w[(j-14)&15] ^ w[(j-16)&15];
				w[j&15] = ROTL(x[0], 1);
			}
			a[4] += ROTL(a[0], 5) + w[j&15] + F[Math.floor(j/20)](a[1], a[2], a[3]);
			a[1] = ROTL(a[1], 30);

			x[0] = a[4];
			b = new Uint32Array(5);
			b.set(x, 0)
			b.set(a.slice(0, 4), 1);
			a = b;
		}

		for (j = 0; j < 5; j++)
			s[j] += a[j];
	}
}

function sha1(p, len, digest, s) {
	var buf = new Uint8Array(128);
	var x = new Uint32Array(16);
	var i;
	var e;

	if (!s) {
		s = newDigestState();
	}

	if (!s.seeded) {
		s.state[0] = 0x67452301;
		s.state[1] = 0xefcdab89;
		s.state[2] = 0x98badcfe;
		s.state[3] = 0x10325476;
		s.state[4] = 0xc3d2e1f0;
		s.seeded = 1;
	}

	if (!p)
		p = new Uint8Array(len);

	if (s.blen) {
		i = 64 - s.blen;
		if (len < i)
			i = len;
		s.buf.set(p.slice(0, i), s.blen);
		len -= i;
		s.blen += i;
		p = p.slice(i);
		if (s.blen == 64) {
			sha1block(s.buf, s.blen, s.state);
			s.len += s.blen;
			s.blen = 0;
		}
	}

	i = len & ~0x3f;
	if (i) {
		sha1block(p, i, s.state);
		s.len += i;
		len -= i;
		p = p.slice(i);
	}

	if (!digest) {
		if (len) {
			s.buf.set(p.slice(0, len), 0);
			s.blen += len;
		}
		return s;
	}

	if (s.blen) {
		p = s.buf;
		len = s.blen;
	} else {
		buf.set(p.slice(0, len), 0);
		p = buf;
	}
	s.len += len;
	e = len;
	if (len < 56)
		i = 56 - len;
	else
		i = 120 - len;
	p.set(new Uint8Array(i), e);
	p[e] = 0x80;
	len += i;

	x[0] = s.len >> 29;
	x[1] = s.len << 3;
	encode32(p, len, x, 8);

	sha1block(p, len+8, s.state);
	s.len += len+8;

	encode32(digest, 0, s.state, SHA1dlen);
	return null;
}

