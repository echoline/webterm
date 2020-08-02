const PAKSLEN = 56;

var Pcs = 0;

function PAKcurve() {
	var r = {};

	r.P = mpint();
	r.A = mpint();
	r.D = mpint();
	r.X = mpint();
	r.Y = mpint();

	return r;
}

function authpak_curve() {
	if (Pcs == 0) {
		Pcs = PAKcurve();

		Pcs.P = mpnew(0);
		Pcs.A = mpnew(0);
		Pcs.D = mpnew(0);
		Pcs.X = mpnew(0);
		Pcs.Y = mpnew(0);

		Pcs = ed448_curve(Pcs);
		Pcs.P = mpfield(Pcs.P);
	}

	return Pcs;
}

function authpak_hash(k, u) {
	var info = "Plan 9 AuthPAK hash";
	var bp;
	var salt = new Uint8Array(SHA2_256dlen);
	var h = new Uint8Array(2 * PAKSLEN);
	var H, PX, PY, PZ, PT;
	var c;

	H = mpnew(0);
	PX = mpnew(0);
	PY = mpnew(0);
	PZ = mpnew(0);
	PT = mpnew(0);

	sha2_256(u, u.length, salt, null);

	hkdf_x(salt, SHA2_256dlen, info, info.length, key.aes, AESKEYLEN,
		h, 2 * PAKSLEN, hmac_sha2_256, SHA2_256dlen);

	c = authpak_curve();

	betomp(h.slice(0, PAKSLEN), PAKSLEN, H);
	spake2ee_h2P(c.P, c.A, c.D, H, PX, PY, PZ, PT);

	bp = 0;
	mptober(PX, k.pakhash, bp, PAKSLEN); bp += PAKSLEN;
	mptober(PY, k.pakhash, bp, PAKSLEN); bp += PAKSLEN;
	mptober(PZ, k.pakhash, bp, PAKSLEN); bp += PAKSLEN;
	mptober(PT, k.pakhash, bp, PAKSLEN); bp += PAKSLEN;

	betomp(h.slice(PAKSLEN, 2*PAKSLEN), PAKSLEN, H);
	spake2ee_h2P(c.P, c.A, c.D, H, PX, PY, PZ, PT);

	mptober(PX, k.pakhash, bp, PAKSLEN); bp += PAKSLEN;
	mptober(PY, k.pakhash, bp, PAKSLEN); bp += PAKSLEN;
	mptober(PZ, k.pakhash, bp, PAKSLEN); bp += PAKSLEN;
	mptober(PT, k.pakhash, bp, PAKSLEN);
}

