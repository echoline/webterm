const ChachaBsize = 64;

const chachasigma = new TextEncoder("utf-8").encode("expand 32-byte k");
const chachatau = new TextEncoder("utf-8").encode("expand 16-byte k");

function ROTATE(v, c) {
	return ((v << c) | (v >>> (32 - c)));
}

function QUARTERROUND(x, ia, ib, ic, id) {
	var t = new Uint32Array(5);

	t[0] = x[ia]; t[1] = x[ib]; t[2] = x[ic]; t[3] = x[id];
	t[0] += t[1]; t[4] = t[3]^t[0]; t[3] = ROTATE(t[4], 16);
	t[2] += t[3]; t[4] = t[1]^t[2]; t[2] = ROTATE(t[4], 12);
	t[0] += t[1]; t[4] = t[3]^t[0]; t[3] = ROTATE(t[4], 8);
	t[2] += t[3]; t[4] = t[1]^t[2]; t[2] = ROTATE(t[4], 7);
	x[ia] = t[0]; x[ib] = t[1]; x[ic] = t[2]; x[id] = t[3];
}

function chachablock(x, rounds) {
	for(; rounds > 0; rounds -= 2) {
		QUARTERROUND(x, 0, 4, 8,12);
		QUARTERROUND(x, 1, 5, 9,13);
		QUARTERROUND(x, 2, 6,10,14);
		QUARTERROUND(x, 3, 7,11,15);

		QUARTERROUND(x, 0, 5,10,15);
		QUARTERROUND(x, 1, 6,11,12);
		QUARTERROUND(x, 2, 7, 8,13);
		QUARTERROUND(x, 3, 4, 9,14);
	}
}

function ENCRYPT(s, si, x, y, d, di) {
	var v = new Uint32Array(1);

	v[0] = s[si]|(s[si+1]<<8)|(s[si+2]<<16)|(s[si+3]<<24);
	v[0] ^= x+y;
	d[di+0] = (v[0] >>>  0) & 0xFF;
	d[di+1] = (v[0] >>>  8) & 0xFF;
	d[di+2] = (v[0] >>> 16) & 0xFF;
	d[di+3] = (v[0] >>> 24) & 0xFF;

}

function chachaload(d, o, s, nw) {
	var i;

	for (i = 0; i < nw; i++)
		d[o+i] = s[i*4]|(s[i*4+1]<<8)|(s[i*4+2]<<16)|(s[i*4+3]<<24);
}

function setupChachastate(s, key, keylen, iv, ivlen, rounds) {
	if (!s)
		s = {};
	if (!s.input)
		s.input = new Uint32Array(16);
	if (!s.xkey)
		s.xkey = new Uint32Array(8);

	if (keylen != 32 && keylen != 16)
		fatal("invalid chacha key length");
	if (ivlen != 8 && ivlen != 12 && ivlen != 16 && ivlen != 24)
		fatal("invalid chacha iv length");
	if (rounds == 0)
		rounds = 20;
	s.rounds = rounds;
	if (keylen == 32) {
		chachaload(s.input, 0, chachasigma, 4);
		chachaload(s.input, 4, key, 8);
	} else {
		chachaload(s.input, 0, chachatau, 4);
		chachaload(s.input, 4, key, 4);
		chachaload(s.input, 8, key, 4);
	}
	s.xkey[0] = s.input[4];
	s.xkey[1] = s.input[5];
	s.xkey[2] = s.input[6];
	s.xkey[3] = s.input[7];
	s.xkey[4] = s.input[8];
	s.xkey[5] = s.input[9];
	s.xkey[6] = s.input[10];
	s.xkey[7] = s.input[11];

	s.ivwords = ivlen/4;
	s.input[12] = 0;
	s.input[13] = 0;
	if (!iv) {
		s.input[14] = 0;
		s.input[15] = 0;
	} else
		chacha_setiv(s, iv);

	return s;
}

function chacha_setiv(s, iv) {
	if (s.ivwords == 6) {
		var counter = new Uint32Array(2);
		var h = new Uint8Array(32);

		s.input[4] = s.xkey[0];
		s.input[5] = s.xkey[1];
		s.input[6] = s.xkey[2];
		s.input[7] = s.xkey[3];
		s.input[8] = s.xkey[4];
		s.input[9] = s.xkey[5];
		s.input[10] = s.xkey[6];
		s.input[11] = s.xkey[7];

		counter[0] = s.input[12];
		counter[1] = s.input[13];

		chachaload(s.input, 12, iv, 4);

		hchachablock(h, s);
		chachaload(s.input, 4, h, 8);

		s.input[12] = counter[0];
		s.input[13] = counter[1];

		chachaload(s.input, 14, iv.slice(16), 2);
		return;
	}
	chachaload(s.input, 16 - s.ivwords, iv, s.ivwords);
}

function chacha_setblock(s, blockno) {
	s.input[12] = blockno[0];
	if (s.ivwords != 3)
		s.input[13] = blockno[1];
}

function encryptblock(s, src, srcidx, dst, dstidx) {
	var x = new Uint32Array(16);
	var i;

	for (i = 0; i < 16; i++)
		x[i] = s.input[i];
	chachablock(x, s.rounds);

	for (i = 0; i < 16; i++) {
		ENCRYPT(src, srcidx, x[i], s.input[i], dst, dstidx);
		srcidx += 4;
		dstidx += 4;
	}

	if (++s.input[12] == 0 && s.ivwords != 3)
		s.input[13]++;
}

function chacha_encrypt2(src, dst, bytes, s) {
	var tmp = new Uint8Array(ChachaBsize);
	var i;

	for(i = 0; bytes >= ChachaBsize; bytes -= ChachaBsize, i += ChachaBsize) {
		encryptblock(s, src, i, dst, i);
	}
	if (bytes > 0) {
		tmp.set(src.slice(i), 0);
		encryptblock(s, tmp, 0, tmp, 0);
		dst.set(tmp.slice(0, bytes), i);
	}
}

function chacha_encrypt(buf, bytes, s) {
	chacha_encrypt2(buf, buf, bytes, s);
}

