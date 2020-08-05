function edwards_add(p, a, d, X1, Y1, Z1, T1, X2, Y2, Z2, T2, X3, Y3, Z3, T3) {
	var H = mpnew(0);
	var G = mpnew(0);
	var F = mpnew(0);
	var E = mpnew(0);
	var D = mpnew(0);
	var C = mpnew(0);
	var B = mpnew(0);
	var A = mpnew(0);
	var tmp1;
	var tmp2;

	mpmodmul(X1, X2, p, A);
	mpmodmul(Y1, Y2, p, B);
	tmp1 = mpnew(0);
	mpmodmul(d, T1, p, tmp1);
	mpmodmul(tmp1, T2, p, C);
	mpmodmul(Z1, Z2, p, D);
	tmp1 = mpnew(0);
	mpmodadd(X1, Y1, p, tmp1);
	tmp2 = mpnew(0);
	mpmodadd(X2, Y2, p, tmp2);
	mpmodmul(tmp1, tmp2, p, E);
	mpmodsub(E, A, p, E);
	mpmodsub(E, B, p, E);
	mpmodsub(D, C, p, F);
	mpmodadd(D, C, p, G);
	mpmodmul(a, A, p, H);
	mpmodsub(B, H, p, H);
	mpmodmul(E, F, p, X3);
	mpmodmul(G, H, p, Y3);
	mpmodmul(F, G, p, Z3);
	mpmodmul(E, H, p, T3);
}

function edwards_sel(s, X1, Y1, Z1, T1, X2, Y2, Z2, T2, X3, Y3, Z3, T3) {
	mpsel(mpcmp(s, mpzero), X1, X2, X3);
	mpsel(mpcmp(s, mpzero), Y1, Y2, Y3);
	mpsel(mpcmp(s, mpzero), Z1, Z2, Z3);
	mpsel(mpcmp(s, mpzero), T1, T2, T3);
}

function edwards_new(x, y, z, t, X, Y, Z, T) {
	mpassign(x, X);
	mpassign(y, Y);
	mpassign(z, Z);
	mpassign(t, T);
}

function edwards_scale(p, a, d, s, X1, Y1, Z1, T1, X3, Y3, Z3, T3) {
	var j = mpnew(0);
	var k = mpnew(0);
	var T4 = mpnew(0);
	var Z4 = mpnew(0);
	var Y4 = mpnew(0);
	var X4 = mpnew(0);
	var T2 = mpnew(0);
	var Z2 = mpnew(0);
	var Y2 = mpnew(0);
	var X2 = mpnew(0);
	var tmp1;
	var tmp2;

	edwards_new(X1, Y1, Z1, T1, X2, Y2, Z2, T2);
	edwards_new(mpzero, mpone, mpone, mpzero, X4, Y4, Z4, T4);
	tmp1 = mpnew(0);
	mpmod(s, mptwo, tmp1);
	edwards_sel(tmp1, X2, Y2, Z2, T2, X4, Y4, Z4, T4, X3, Y3, Z3, T3);
	mpright(s, 1, k);
	mpright(p, 1, j);
	for(;;) {
		if(mpcmp(j, mpzero) != 0){
			edwards_add(p, a, d, X2, Y2, Z2, T2, X2, Y2, Z2, T2, X2, Y2, Z2, T2);
			edwards_add(p, a, d, X2, Y2, Z2, T2, X3, Y3, Z3, T3, X4, Y4, Z4, T4);
			tmp2 = mpnew(0);
			mpmod(k, mptwo, tmp2);
			edwards_sel(tmp2, X4, Y4, Z4, T4, X3, Y3, Z3, T3, X3, Y3, Z3, T3);
			mpright(k, 1, k);
			mpright(j, 1, j);
		} else
			break;
	}
}

