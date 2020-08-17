function elligator2(p, a, d, n, r0, X, Y, Z, T) {
	var t = mpnew(0);
	var s = mpnew(0);
	var e = mpnew(0);
	var c = mpnew(0);
	var ND = mpnew(0);
	var N = mpnew(0);
	var D = mpnew(0);
	var r = mpnew(0);
	var tmp1 = mpnew(0);
	var tmp2 = mpnew(0);
	var tmp3 = mpnew(0);
	var tmp4 = mpnew(0);
	var tmp5 = mpnew(0);
	var tmp6 = mpnew(0);

	mpmodmul(n, r0, p, tmp1);
	mpmodmul(tmp1, r0, p, r);
	tmp1 = mpnew(0);
	mpmodmul(d, r, p, tmp1);
	mpmodadd(tmp1, a, p, tmp1);
	mpmodsub(tmp1, d, p, tmp1);
	mpmodmul(d, r, p, tmp2);
	mpmodmul(a, r, p, tmp3);
	mpmodsub(tmp2, tmp3, p, tmp2);
	mpmodsub(tmp2, d, p, tmp2);
	mpmodmul(tmp1, tmp2, p, D);
	tmp2 = mpnew(0);
	mpmodadd(r, mpone, p, tmp2);
	tmp1 = mpnew(0);
	mpmodadd(d, d, p, tmp1);
	mpmodsub(a, tmp1, p, tmp1);
	mpmodmul(tmp2, tmp1, p, N);
	mpmodmul(N, D, p, ND);
	if (mpcmp(ND, mpzero) == 0) {
		mpassign(mpone, c);
		mpassign(mpzero, e);
	} else {
		msqrt(ND, p, e);
		if (mpcmp(e, mpzero) != 0){
			mpassign(mpone, c);
			mpinvert(e, p, e);
		} else {
			mpmodsub(mpzero, mpone, p, c);
			mpmodmul(n, r0, p, tmp4);
			mpmodmul(n, ND, p, tmp6);
			misqrt(tmp6, p, tmp5);
			mpmodmul(tmp4, tmp5, p, e);
		}
	}
	tmp1 = mpnew(0);
	mpmodmul(c, N, p, tmp1);
	mpmodmul(tmp1, e, p, s);
	tmp1 = mpnew(0);
	tmp2 = mpnew(0);
	mpmodmul(c, N, p, tmp2);
	tmp3 = mpnew(0);
	mpmodsub(r, mpone, p, tmp3);
	mpmodmul(tmp2, tmp3, p, tmp1);
	tmp3 = mpnew(0);
	tmp2 = mpnew(0);
	mpmodadd(d, d, p, tmp2);
	mpmodsub(a, tmp2, p, tmp2);
	mpmodmul(tmp2, e, p, tmp3);
	mpmodmul(tmp3, tmp3, p, tmp3);
	mpmodmul(tmp1, tmp3, p, t);
	mpmodsub(mpzero, t, p, t);
	mpmodsub(t, mpone, p, t);
	tmp3 = mpnew(0);
	mpmodadd(s, s, p, tmp3);
	mpmodmul(tmp3, t, p, X);
	tmp3 = mpnew(0);
	tmp1 = mpnew(0);
	mpmodmul(a, s, p, tmp1);
	mpmodmul(tmp1, s, p, tmp3);
	mpmodsub(mpone, tmp3, p, tmp3);
	tmp1 = mpnew(0);
	tmp2 = mpnew(0);
	mpmodmul(a, s, p, tmp2);
	mpmodmul(tmp2, s, p, tmp1);
	mpmodadd(mpone, tmp1, p, tmp1);
	mpmodmul(tmp3, tmp1, p, Y);
	tmp1 = mpnew(0);
	tmp3 = mpnew(0);
	mpmodmul(a, s, p, tmp3);
	mpmodmul(tmp3, s, p, tmp1);
	mpmodadd(mpone, tmp1, p, tmp1);
	mpmodmul(tmp1, t, p, Z);
	tmp1 = mpnew(0);
	mpmodadd(s, s, p, tmp1);
	tmp3 = mpnew(0);
	tmp2 = mpnew(0);
	mpmodmul(a, s, p, tmp2);
	mpmodmul(tmp2, s, p, tmp3);
	mpmodsub(mpone, tmp3, p, tmp3);
	mpmodmul(tmp1, tmp3, p, T);
}

