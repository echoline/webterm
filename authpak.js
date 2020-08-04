const PAKKEYLEN = 32;
const PAKSLEN = Math.floor((448+7)/8);
const PAKPLEN = 4*PAKSLEN;
const PAKHASHLEN = 2*PAKPLEN;
const PAKXLEN = PAKSLEN;
const PAKYLEN = PAKSLEN;

var pointcurve = 0;

function authpak_curve() {
	if (pointcurve == 0) {
		pointcurve = {};

		pointcurve.P = mpnew(0);
		pointcurve.A = mpnew(0);
		pointcurve.D = mpnew(0);
		pointcurve.X = mpnew(0);
		pointcurve.Y = mpnew(0);
		ed448_curve(pointcurve.P, pointcurve.A, pointcurve.D, pointcurve.X, pointcurve.Y);
		pointcurve.P = mpfield(pointcurve.P);
	}

	return pointcurve;
}

function authpak_hash(k, u) {
	var info = new TextEncoder("utf-8").encode("Plan 9 AuthPAK hash");
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

	hkdf_x(salt, SHA2_256dlen, info, info.length, k.aes, AESKEYLEN,
		h, 2 * PAKSLEN, hmac_sha2_256, SHA2_256dlen);

	c = authpak_curve();

	betomp(h.slice(0, PAKSLEN), PAKSLEN, H);
	spake2ee_h2P(c.P, c.A, c.D, H, PX, PY, PZ, PT);

	if (!k.pakhash)
		k.pakhash = new Uint8Array(PAKHASHLEN);

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

function authpak_new(p, k, y) {
	var PX, PY, PZ, PT, X, Y;
	var c;
	var bp;
	var buf = new Uint8Array(PAKSLEN*2);

	p.x = new Uint8Array(PAKXLEN);
	p.y = new Uint8Array(PAKYLEN);

	X = mpnew(0);
	Y = mpnew(0);

	PX = mpnew(0);
	PY = mpnew(0);
	PZ = mpnew(0);
	PT = mpnew(0);

	PX.flags |= MPtimesafe;
	PY.flags |= MPtimesafe;
	PZ.flags |= MPtimesafe;
	PT.flags |= MPtimesafe;

	bp = PAKPLEN * (p.isclient == 0);
	betomp(k.pakhash.slice(bp, bp + PAKSLEN), PAKSLEN, PX); bp += PAKSLEN;
	betomp(k.pakhash.slice(bp, bp + PAKSLEN), PAKSLEN, PY); bp += PAKSLEN;
	betomp(k.pakhash.slice(bp, bp + PAKSLEN), PAKSLEN, PZ); bp += PAKSLEN;
	betomp(k.pakhash.slice(bp, bp + PAKSLEN), PAKSLEN, PT);

	c = authpak_curve();

	X.flags |= MPtimesafe;
	mpnrand(c.P, randombytes, X)

	spake2ee_1(c.P,c.A,c.D, X, c.X,c.Y, PX,PY,PZ,PT, Y);

	mptober(X, p.x, 0, PAKXLEN);
	mptober(Y, p.y, 0, PAKYLEN);

	y.set(p.y, 0);
}

function authpak_finish(p, k, y) {
	var info = new TextEncoder("utf-8").encode("Plan 9 AuthPAK key");
	var bp;
	var z = new Uint8Array(PAKSLEN);
	var salt = new Uint8Array(SHA2_256dlen);
	var PX, PY, PZ, PT, X, Y, Z, ok;
	var s;
	var c;
	var ret;

	X = mpnew(0);
	Y = mpnew(0);
	Z = mpnew(0);
	ok = mpnew(0);

	PX = mpnew(0);
	PY = mpnew(0);
	PZ = mpnew(0);
	PT = mpnew(0);

	PX.flags |= MPtimesafe;
	PY.flags |= MPtimesafe;
	PZ.flags |= MPtimesafe;
	PT.flags |= MPtimesafe;

	bp = PAKPLEN * (p.isclient != 0);
	betomp(k.pakhash.slice(bp, bp + PAKSLEN), PAKSLEN, PX); bp += PAKSLEN;
	betomp(k.pakhash.slice(bp, bp + PAKSLEN), PAKSLEN, PY); bp += PAKSLEN;
	betomp(k.pakhash.slice(bp, bp + PAKSLEN), PAKSLEN, PZ); bp += PAKSLEN;
	betomp(k.pakhash.slice(bp, bp + PAKSLEN), PAKSLEN, PT);

	Z.flags |= MPtimesafe;
	X.flags |= MPtimesafe;
	betomp(p.x, PAKXLEN, X);

	betomp(y, PAKYLEN, Y);

	c = authpak_curve();
	spake2ee_2(c.P,c.A,c.D, PX,PY,PZ,PT, X, Y, ok, Z);

	if (mpcmp(ok, mpzero) != 0) {
		mptober(Z, z, 0, PAKSLEN);

		s = sha2_256(p.y, PAKYLEN, null, null);
		sha2_256(y, PAKYLEN, salt, s);

		k.pakkey = new Uint8Array(PAKKEYLEN);
		hkdf_x(salt, SHA2_256dlen, info, info.length,
			z, z.length, k.pakkey, PAKKEYLEN,
			hmac_sha2_256, SHA2_256dlen);

		ret = 0;
	} else
		ret = -1;

	z = null;
	p.x = null;
	p.y = null;

	return ret;
}
