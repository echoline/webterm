function hkdf_x(salt, nsalt, info, ninfo, key, nkey, d, dlen, x, xlen) {
	var prk = new Uint8Array(256);
	var tmp = new Uint8Array(256);
	var cnt = new Uint8Array(1);
	var ds;
	var offset = 0;

	if (xlen > 256)
		fatal("hkdf_x xlen too long");

	if (!nsalt) {
		salt = tmp;
		nsalt = xlen;
	}
	x(key, nkey, salt, nsalt, prk, null);
	ds = null;
	for(cnt[0] = 1;; cnt[0]++) {
		if (ninfo > 0)
			ds = x(info, ninfo, prk, xlen, null, ds);
		x(cnt, 1, prk, xlen, tmp, ds);
		if (dlen < xlen) {
			d.set(tmp.slice(0, dlen), offset);
			break;
		}
		d.set(tmp.slice(0, xlen), offset);
		dlen -= xlen;
		offset += xlen;
		ds = x(tmp, xlen, prk, xlen, null, null);
	}
}

