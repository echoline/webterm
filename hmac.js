const Hmacblksz = 64;

function hmac_x(p, len, key, klen, digest, s, x, xlen) {
	var i;
	var pad = new Uint8Array(Hmacblksz+1);
	var innerdigest = new Uint8Array(256);

	if (xlen > innerdigest.length)
		return null;
	if (klen > Hmacblksz) {
		if (xlen > Hmacblksz)
			return null;
		x(key, klen, innerdigest, null);
		key = innerdigest;
		klen = xlen;
	}

	if (!s || !s.seeded) {
		for (i = 0; i < Hmacblksz; i++)
			pad[i] = 0x36;
		pad[Hmacblksz] = 0;
		for (i = 0; i < klen; i++)
			pad[i] ^= key[i];
		s = x(pad, Hmacblksz, null, s);
		if (!s)
			return null;
	}

	s = x(p, len, null, s);
	if (!digest)
		return s;

	for (i = 0; i < Hmacblksz; i++)
		pad[i] = 0x5c;
	pad[Hmacblksz] = 0;
	for (i = 0; i < klen; i++)
		pad[i] ^= key[i];
	x(null, 0, innerdigest, s);
	s = x(pad, Hmacblksz, null, null);
	x(innerdigest, xlen, digest, s);
	return null;
}

function hmac_sha2_256(p, len, key, klen, digest, s)
{
	return hmac_x(p, len, key, klen, digest, s, sha2_256, SHA2_256dlen);
}

