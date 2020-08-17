function pbkdf2_x(p, plen, s, slen, rounds, d, dlen, x, xlen) {
	var block = new Uint8Array(256);
	var tmp = new Uint8Array(256);
	var i, j, k, n;
	var ds;
	var di = 0;

	if (xlen > 256)
		fatal("pbkdf2_x: xlen too long");

	for (i = 1; dlen > 0; i++, di += n, dlen -= n) {
		tmp[3] = (i >>>  0) & 0xFF;
		tmp[2] = (i >>>  8) & 0xFF;
		tmp[1] = (i >>> 16) & 0xFF;
		tmp[0] = (i >>> 24) & 0xFF;
		ds = x(s, slen, p, plen, null, null);
		x(tmp, 4, p, plen, block, ds);
		tmp.set(block.slice(0, xlen), 0);
		for (j = 1; j < rounds; j++) {
			x(tmp, xlen, p, plen, tmp, null);
			for (k = 0; k < xlen; k++)
				block[k] ^= tmp[k];
		}
		n = dlen > xlen? xlen: dlen;
		d.set(block.slice(0, n), di)
	}
}

