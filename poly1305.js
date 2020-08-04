function U8TO32(p, i) {
	return (p[i+0] | (p[i+1] << 8) | (p[i+2] << 16) | (p[i+3] << 24));
}

function U32TO8(p, i, v) {
	p[i+0] = (v >>>  0) & 0xFF;
	p[i+1] = (v >>>  8) & 0xFF;
	p[i+2] = (v >>> 16) & 0xFF;
	p[i+3] = (v >>> 24) & 0xFF;
}

function poly1305(m, len, key, klen, digest, s) {
	var rs = new Uint32Array(10);
	var h = new Uint32Array(5);
	var g = new Uint32Array(5);
	var d = [0, 0, 0, 0, 0];
	var f; 
	var hibit = new Uint32Array(1);
	var mask = new Uint32Array(1);
	var c = new Uint32Array(1);
	var i;

	if (!s) {
		s = {};
		s.len = 0;
		s.state = new Uint32Array(16);
		s.buf = new Uint8Array(256);
		s.blen = 0;
		s.seeded = 0;
	}

	if (s.seeded == 0) {
		if (klen != 32)
			fatal("poly1305: klen != 32");

		s.state[0] = (U8TO32(key,  0) >>> 0) & 0x3ffffff;
		s.state[1] = (U8TO32(key,  3) >>> 2) & 0x3ffff03;
		s.state[2] = (U8TO32(key,  6) >>> 4) & 0x3ffc0ff;
		s.state[3] = (U8TO32(key,  9) >>> 6) & 0x3f03fff;
		s.state[4] = (U8TO32(key, 12) >>> 8) & 0x00fffff;

		s.state[5] = 0;
		s.state[6] = 0;
		s.state[7] = 0;
		s.state[8] = 0;
		s.state[9] = 0;

		s.state[10] = U8TO32(key, 16);
		s.state[11] = U8TO32(key, 20);
		s.state[12] = U8TO32(key, 24);
		s.state[13] = U8TO32(key, 28);

		s.seeded = 1;
	}

	if (s.blen) {
		c[0] = 16 - s.blen;
		if (c[0] > len)
			c[0] = len;
		s.buf.set(m.slice(0, c[0]), s.blen);
		len -= c[0];
		m = m.slice(c[0]);
		s.blen += c[0];
		if (s.blen == 16) {
			s.blen = 0;
			poly1305(s.buf, 16, key, klen, null, s);
		} else if (len == 0) {
			m = s.buf;
			len = s.blen;
			s.blen = 0;
		}
	}

	for (i = 0; i < 5; i++) {
		rs[i] = s.state[i];
		h[i] = s.state[i+5];
		rs[i+5] = rs[i] * 5;
	}

	hibit[0] = 1<<24;

	do {
		while(len >= 16) {
			for (i = 0; i < 4; i++)
				h[i] += (U8TO32(m, i*3) >>> i*2) & 0x3ffffff;
			h[4] += (U8TO32(m, 12) >>> 8) | hibit[0];

			for (i = 0; i < 5; i++) {
				d[i] = (BigInt(h[0]) * BigInt(rs[i])) + 
					(BigInt(h[1]) * BigInt(rs[(i+9)%10])) +
					(BigInt(h[2]) * BigInt(rs[(i+8)%10])) +
					(BigInt(h[3]) * BigInt(rs[(i+7)%10])) +
					(BigInt(h[4]) * BigInt(rs[(i+6)%10]));
			}

			c[0] = 0;
			for (i = 0; i < 5; i++) {
				d[i] += BigInt(c[0]);
				c[0] = Number(BigInt.asUintN(32, d[i] >> 26n)) >>> 0;
				h[i] = (Number(BigInt.asUintN(32, d[i])) >>> 0) & 0x3ffffff;
			}
			h[0] += c[0] * 5;
			c[0] = h[0] >>> 26;
			h[0] &= 0x3ffffff;
			h[1] += c[0];

			len -= 16;
			m = m.slice(16);
		}

		if (len) {
			s.blen = len;
			s.buf.set(m, len);
		}

		if (!digest) {
			for (i = 0; i < 5; i++)
				s.state[i+5] = h[i];
			return s;
		}

		if (len) {
			m = s.buf;
			m[len++] = 1;
			while (len < 16)
				m[len++] = 0;
			hibit[0] = 0;
		}
	} while(len);

	c[0] = 0;
	for (i = 0; i < 5; i++) {
		h[(i+1)%5] += c[0] * (i == 4? 5: 1);
		c[0] = h[(i+1)%5] >>> 26;
		h[(i+1)%5] = h[(i+1)%5] & 0x3ffffff;
	}
	h[1] += c[0];

	c[0] = 5;
	for (i = 0; i < 4; i++) {
		g[i] = h[i] + c[0];
		c[0] = g[i] >>> 26;
		g[i] &= 0x3ffffff;
	}
	g[4] = h[4] + c[0] - (1 << 26);

	mask[0] = (g[4] >>> 31) - 1;
	for (i = 0; i < 5; i++)
		g[i] &= mask[0];
	mask[0] = ~mask[0];
	for (i = 0; i < 5; i++)
		h[i] = (h[i] & mask[0]) | g[i];

	for (i = 0; i < 4; i++)
		h[i] = (h[i] >>> (i*6)) | (h[i+1] << (26 - i*6));

	f = 0n;
	for (i = 0; i < 4; i++) {
		f = BigInt(h[i]) + BigInt(s.state[i+10]) + (f >> 32n);
		h[i] = Number(BigInt.asUintN(32, f)) >>> 0;
	}

	for (i = 0; i < 4; i++)
		U32TO8(digest, i*4, h[i]);

	return null;
}

