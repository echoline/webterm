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

