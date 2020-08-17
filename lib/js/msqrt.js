function legendresymbol(a, p, r) {
	var pm1 = mpnew(0);
	mpsub(p, mpone, pm1);
	mpright(pm1, 1, r);
	mpexp(a, r, p, r);
	if (mpcmp(r, pm1) == 0) {
		mpassign(mpone, r);
		r.sign = -1;
	}
}

function msqrt(a, p, r) {
	var gs = mpnew(0);
	var m = mpnew(0);
	var t = mpnew(0);
	var g = mpnew(0);
	var b = mpnew(0);
	var x = mpnew(0);
	var n = mpnew(0);
	var s = mpnew(0);
	var e = mpnew(0);
	var tmp1 = mpnew(0);
	var tmp2 = mpnew(0);
	var tmp3 = mpnew(0);
	var tmp4 = mpnew(0);
	var tmp5 = mpnew(0);
	var tmp6 = mpnew(0);

	legendresymbol(a, p, tmp1);
	if (mpcmp(tmp1, mpone) != 0) {
		mpassign(mpzero, r);
	} else {
		if (mpcmp(a, mpzero) == 0) {
			mpassign(mpzero, r);
		} else {
			if (mpcmp(p, mptwo) == 0) {
				mpassign(a, r);
			} else {
				tmp2 = itomp(4);
				mpmod(p, tmp2, tmp2);
				tmp3 = itomp(3);
				if (mpcmp(tmp2, tmp3) == 0) {
					mpadd(p, mpone, e);
					mpright(e, 2, e);
					mpexp(a, e, p, r);
				} else {
					mpsub(p, mpone, s);
					mpassign(mpzero, e);
					for(;;) {
						tmp4 = mpnew(0);
						mpmod(s, mptwo, tmp4);
						if (mpcmp(tmp4, mpzero) == 0) {
							mpright(s, 1, s);
							mpadd(e, mpone, e);
						} else
							break;
					}
					mpassign(mptwo, n);
					for(;;) {
						tmp5 = mpnew(0);
						legendresymbol(n, p, tmp5);
						tmp6 = mpnew(0);
						mpassign(mpone, tmp6);
						tmp6.sign = -1;
						if (mpcmp(tmp5, tmp6) != 0)
							mpadd(n, mpone, n);
						else
							break;
					}
					mpmodadd(s, mpone, p, x);
					mpright(x, 1, x);
					mpexp(a, x, p, x);
					mpexp(a, s, p, b);
					mpexp(n, s, p, g);
					for(;;) {
						mpassign(b, t);
						mpassign(mpzero, m);
						for(;;) {
							if (mpcmp(m, e) < 0) {
								if (mpcmp(t, mpone) == 0)
									break;
								mpmul(t, t, t);
								mpmod(t, p, t);
								mpadd(m, mpone, m);
							} else
								break;
						}
						if(mpcmp(m, mpzero) == 0){
							mpassign(x, r);
							break;
						}
						mpsub(e, m, t);
						mpsub(t, mpone, t);
						mpexp(mptwo, t, nil, t);
						mpexp(g, t, p, gs);
						mpmodmul(gs, gs, p, g);
						mpmodmul(x, gs, p, x);
						mpmodmul(b, g, p, b);
						mpassign(m, e);
					}
				}
			}
		}
	}
}

function misqrt(a, p, r) {
	var e = mpnew(0);
	var tmp1 = itomp(4);
	var tmp2 = itomp(3);

	mpmod(p, tmp1, tmp1);
	if (mpcmp(tmp1, tmp2) == 0) {
		e = itomp(3);
		mpsub(p, e, e);
		mpright(e, 2, e);
		mpexp(a, e, p, r);
	} else {
		msqrt(a, p, r);
		if (mpcmp(r, mpzero) != 0)
			mpinvert(r, p, r)
	}
}

