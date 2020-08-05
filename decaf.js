function decaf_neg(p, n, r) {
	var m = mpnew(0);
	var tmp1 = mpnew(0);
	var s;

	mpmodsub(mpzero, r, p, m);
	mpsub(p, mpone, tmp1);
	mpright(tmp1, 1, tmp1);
	s = mpcmp(n, tmp1);
	mpsel(s <= 0? 0: -1, m, r, r);
}

function decaf_encode(p, a, d, X, Y, Z, T, s) {
	var u = mpnew(0);
	var r = mpnew(0);
	var tmp1 = mpnew(0);
	var tmp2 = mpnew(0);
	var tmp3 = mpnew(0);
	var tmp4 = mpnew(0);
	var tmp5 = mpnew(0);

	mpmodsub(a, d, p, tmp3);
	mpmodadd(Z, Y, p, tmp4);
	mpmodmul(tmp3, tmp4, p, tmp2);
	tmp4 = mpnew(0);
	mpmodsub(Z, Y, p, tmp4);
	mpmodmul(tmp2, tmp4, p, tmp1);
	misqrt(tmp1, p, r);
	tmp1 = mpnew(0);
	mpmodsub(a, d, p, tmp1);
	mpmodmul(tmp1, r, p, u);
	tmp1 = mpnew(0);
	tmp4 = mpnew(0);
	mpmodadd(u, u, p, tmp4);
	mpmodmul(tmp4, Z, p, tmp1);
	mpmodsub(mpzero, tmp1, p, tmp1);
	decaf_neg(p, tmp1, r);
	tmp1 = mpnew(0);
	tmp2 = mpnew(0);
	tmp3 = mpnew(0);
	tmp4 = mpnew(0);
	mpmodmul(a, Z, p, tmp3);
	mpmodmul(tmp3, X, p, tmp2);
	tmp3 = mpnew(0);
	mpmodmul(d, Y, p, tmp5);
	mpmodmul(tmp5, T, p, tmp3);
	mpmodsub(tmp2, tmp3, p, tmp2);
	mpmodmul(r, tmp2, p, tmp4);
	mpmodadd(tmp4, Y, p, tmp4);
	mpmodmul(u, tmp4, p, tmp1);
	tmp4 = mpnew(0);
	mpinvert(a, p, tmp4);
	mpmodmul(tmp1, tmp4, p, s);
	decaf_neg(p, s, s);
}

function decaf_decode(p, a, d, s, ok, X, Y, Z, T) {
	var w = mpnew(0);
	var v = mpnew(0);
	var u = mpnew(0);
	var ss = mpnew(0);
	var tmp1 = mpnew(0);
	var tmp2 = mpnew(0);
	var tmp3 = mpnew(0);
	var tmp4 = mpnew(0);
	var tmp5 = mpnew(0);
	var tmp6 = mpnew(0);

	mpsub(p, mpone, tmp1);
	mpright(tmp1, 1, tmp1);
	if (mpcmp(s, tmp1) > 0) {
		mpassign(mpzero, ok);
	} else {
		mpmodmul(s, s, p, ss);
		mpmodmul(a, ss, p, Z);
		mpmodadd(mpone, Z, p, Z);
		mpmodmul(Z, Z, p, u);
		tmp4 = itomp(4);
		mpmodmul(tmp4, d, p, tmp3);
		mpmodmul(tmp3, ss, p, tmp2);
		mpmodsub(u, tmp2, p, u);
		mpmodmul(u, ss, p, v);
		if(mpcmp(v, mpzero) == 0){
			mpassign(mpone, ok);
		} else {
			msqrt(v, p, ok);
			if (mpcmp(ok, mpzero) != 0) {
				mpinvert(ok, p, v);
				mpassign(mpone, ok);
			}
		}
		if (mpcmp(ok, mpzero) != 0) {
			mpmodmul(u, v, p, tmp5);
			decaf_neg(p, tmp5, v);
			tmp5 = mpnew(0);
			mpmodmul(v, s, p, tmp5);
			mpmodsub(mptwo, Z, p, tmp6);
			mpmodmul(tmp5, tmp6, p, w);
			if(mpcmp(s, mpzero) == 0){
				mpmodadd(w, mpone, p, w);
			}
			mpmodadd(s, s, p, X);
			mpmodmul(w, Z, p, Y);
			mpmodmul(w, X, p, T);
		}
	}
}

