const SHA2_256dlen = 32;

const K256 = new Uint32Array([
	0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,
	0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
	0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,
	0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
	0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,
	0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
	0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,
	0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
	0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,
	0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
	0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,
	0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
	0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,
	0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
	0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,
	0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);

function ROTR(x, n) {
	return (((x) >>> (n)) | ((x) << (32-(n))));
}

function sigma0(x) {
	return (ROTR((x),7) ^ ROTR((x),18) ^ ((x) >>> 3));
}

function sigma1(x) {
	return (ROTR((x),17) ^ ROTR((x),19) ^ ((x) >>> 10));
}

function SIGMA0(x) {
	return (ROTR((x),2) ^ ROTR((x),13) ^ ROTR((x),22));
}

function SIGMA1(x) {
	return (ROTR((x),6) ^ ROTR((x),11) ^ ROTR((x),25));
}

function Ch(x,y,z) {
	return ((z) ^ ((x) & ((y) ^ (z))));
}

function Maj(x,y,z) {
	return (((x) | (y)) & ((z) | ((x) & (y))));
}

function sha2block64(p, len, s) {
	var w = new Uint32Array(16);
	var a = new Uint32Array(8);
	var b = new Uint32Array(1);
	var c;
	var i, j;

	for (i = 0; i < len;){
		for (j = 0; j < 8; j++)
			a[j] = s[j];

		for (j = 0; j < 64; j++) {
			if (j < 16) {
				w[j] = p[i]<<24 | p[i+1]<<16 | p[i+2]<<8 | p[i+3];
				i += 4;
			} else {
				w[j&15] += sigma1(w[(j-2)&15]) + w[(j-7)&15] + sigma0(w[(j-15)&15]);
			}
			a[7] += SIGMA1(a[4]) + Ch(a[4],a[5],a[6]) + K256[j] + w[j&15];
			a[3] += a[7];
			a[7] += SIGMA0(a[0]) + Maj(a[0],a[1],a[2]);

			b[0] = a[7];
			c = new Uint32Array(8);
			c.set(b, 0);
			c.set(a.slice(0, 7), 1);
			a = c;
		}

		for (j = 0; j < 8; j++)
			s[j] += a[j];
	}
}

function encode32(output, offset, input, len) {
	var x = new Uint32Array(1);
	var e, i, end;

	for (e = offset, i = 0, end = offset + len; e < end; i++) {
		x[0] = input[i];
		output[e++] = (x[0] >> 24) & 0xFF;
		output[e++] = (x[0] >> 16) & 0xFF;
		output[e++] = (x[0] >> 8) & 0xFF;
		output[e++] = x[0] & 0xFF;
	}
}

function sha2_64(p, len, digest, s, dlen) {
	var i;
	var x = new Uint32Array(16);
	var buf = new Uint8Array(128);
	var e;
	var b = 0;

	if (s.blen) {
		i = 64 - s.blen;
		if (len < i)
			i = len;
		s.buf.set(p.slice(0, i), s.blen);
		len -= i;
		s.blen += i;
		b += i;
		if (s.blen == 64){
			sha2block64(s.buf, s.blen, s.state);
			s.len += s.blen;
			s.blen = 0;
		}
	}

	i = len & ~(64-1)
	if(i){
		p = p.slice(b);
		sha2block64(p, i, s.state);
		s.len += i;
		len -= i;
		b += i;
	}

	if (!digest) {
		if(len){
			s.buf.set(p.slice(b, b+len), 0);
			s.blen += len;
		}
		return s;
	}

	if (s.blen) {
		p = s.buf;
		len = s.blen;
	} else {
		buf.set(p.slice(b, b+len), 0);
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

	sha2block64(p, len+8, s.state);
	s.len += len+8;
	encode32(digest, 0, s.state, dlen);
	return null;
}

function sha2_256(p, len, digest, s) {
	if (!s) {
		s = {};
		s.len = 0;
		s.state = new Uint32Array(16);
		s.buf = new Uint8Array(256);
		s.blen = 0;
		s.malloced = 1;
		s.seeded = 0;
	}
	if (!s.seeded) {
		s.state[0] = 0x6a09e667;
		s.state[1] = 0xbb67ae85;
		s.state[2] = 0x3c6ef372;
		s.state[3] = 0xa54ff53a;
		s.state[4] = 0x510e527f;
		s.state[5] = 0x9b05688c;
		s.state[6] = 0x1f83d9ab;
		s.state[7] = 0x5be0cd19;
		s.seeded = 1;
	}
	return sha2_64(p, len, digest, s, SHA2_256dlen);
}
