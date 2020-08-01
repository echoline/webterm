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
