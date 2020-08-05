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

function ccpoly_encrypt(dat, ndat, aad, naad, tag, cs) {
	var ds = newDigestState();

	ccpolyotk(cs, ds);
	if (cs.ivwords == 2) {
		poly1305(aad, naad, null, 0, null, ds);
		ccpolylen(naad, null, ds);
		chacha_encrypt(dat, ndat, cs);
		poly1305(dat, ndat, null, 0, null, ds);
		ccpolylen(ndat, tag, ds);
	} else {
		ccpolypad(aad, naad, ds);
		chacha_encrypt(dat, ndat, cs);
		ccpolypad(dat, ndat, ds);
		ccpolylen(naad, null, ds);
		ccpolylen(ndat, tag, ds);
	}
}

function ccpoly_decrypt(dat, ndat, aad, naad, tag, cs) {
	var ds = newDigestState();
	var tmp = new Uint8Array(16);
	var i;

	ccpolyotk(cs, ds);
	if (cs.ivwords == 2) {
		fatal("ccpoly_decrypt: ivwords == 2");
	} else {
		ccpolypad(aad, naad, ds);
		ccpolypad(dat, ndat, ds);
		ccpolylen(naad, null, ds);
		ccpolylen(ndat, tmp, ds);
	}
	if (tsmemcmp(tag, tmp, 16) != 0)
		return -1;
	chacha_encrypt(dat, ndat, cs);
	return 0;
}

