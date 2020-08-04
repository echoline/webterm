function ccpolyotk(cs, ds) {
	var otk = new Uint8Array(ChachaBsize);

	chacha_setblock(cs, new Uint32Array(2));
	chacha_encrypt(otk, ChachaBsize, cs);
	poly1305(null, 0, otk, 32, null, ds);
}

function ccpolypad(buf, nbuf, ds) {
	var zeros = new Uint8Array(16);
	var npad;

	if (nbuf == 0)
		return;
	poly1305(buf, nbuf, null, 0, null, ds);
	npad = nbuf % 16;
	if (npad == 0)
		return;
	poly1305(zeros, 16 - npad, null, 0, null, ds);
}

function ccpolylen(n, tag, ds) {
	var info = new Uint8Array(8);

	info[0] = (n >>>  0) & 0xFF;
	info[1] = (n >>>  8) & 0xFF;
	info[2] = (n >>> 16) & 0xFF;
	info[3] = (n >>> 24) & 0xFF;
	poly1305(info, 8, null, 0, tag, ds);
}

function ccpoly_decrypt(dat, ndat, aad, naad, tag, cs) {
	var ds = {};
	var tmp = new Uint8Array(16);
	var i;

	ds.len = 0;
	ds.state = new Uint32Array(16);
	ds.buf = new Uint8Array(256);
	ds.blen = 0;
	ds.seeded = 0;

	ccpolyotk(cs, ds);
	if (cs.ivwords == 2) {
		fatal("ccpoly_decrypt: ivwords == 2");
	} else {
		ccpolypad(aad, naad, ds);
		ccpolypad(dat, ndat, ds);
		ccpolylen(naad, null, ds);
		ccpolylen(ndat, tmp, ds);
	}
	for (i = 0; i < 16; i++)
		if (tag[i] != tmp[i])
			return -1;
	chacha_encrypt(dat, ndat, cs);
	return 0;
}

