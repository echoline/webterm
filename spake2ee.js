function spake2ee_h2P(p, a, d, h, PX, PY, PZ, PT) {
	var n = mpnew(0);
	mpassign(mptwo, n);
	for(;;) {
		var tmp1 = mpnew(0);
		legendresymbol(n, p, tmp1);
		var tmp2 = mpnew(0);
		mpassign(mpone, tmp2);
		tmp2.sign = -1;
		if (mpcmp(tmp1, tmp2) == 0)
			break;
		mpadd(n, mpone, n);
	}
	var tmp3 = mpnew(0);
	mpmod(h, p, tmp3);
	elligator2(p, a, d, n, tmp3, PX, PY, PZ, PT);
}

function spake2ee_1(p, a, d, x, GX, GY, PX, PY, PZ, PT, y) {
	var T = mpnew(0);
	var Z = mpnew(0);
	var Y = mpnew(0);
	var X = mpnew(0);
	var tmp1 = mpnew(0);

	mpmodmul(GX, GY, p, tmp1);
	edwards_scale(p, a, d, x, GX, GY, mpone, tmp1, X, Y, Z, T);
	edwards_add(p, a, d, X, Y, Z, T, PX, PY, PZ, PT, X, Y, Z, T);
	decaf_encode(p, a, d, X, Y, Z, T, y);
}

function spake2ee_2(p, a, d, PX, PY, PZ, PT, x, y, ok, z) {
	var T = mpnew(0);
	var Z = mpnew(0);
	var Y = mpnew(0);
	var X = mpnew(0);

	decaf_decode(p, a, d, y, ok, X, Y, Z, T);
	if(mpcmp(ok, mpzero) != 0){
		var tmp1 = mpnew(0);
		mpmodsub(mpzero, PX, p, tmp1);
		var tmp2 = mpnew(0);
		mpmodsub(mpzero, PT, p, tmp2);
		edwards_add(p, a, d, X, Y, Z, T, tmp1, PY, PZ, tmp2, X, Y, Z, T);
		edwards_scale(p, a, d, x, X, Y, Z, T, X, Y, Z, T);
		decaf_encode(p, a, d, X, Y, Z, T, z);
	}
}

