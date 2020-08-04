const AuthPass	= 3;
const AuthTs	= 64;
const AuthTc	= 65;
const AuthAs	= 66;
const AuthAc	= 67;
const AuthTp	= 68;
const AuthHr	= 69;

const form1sig = [
	[AuthPass,	"form1 PR"],
	[AuthTs,	"form1 Ts"],
	[AuthTc,	"form1 Tc"],
	[AuthAs,	"form1 As"],
	[AuthAc,	"form1 Ac"],
	[AuthTp,	"form1 Tp"],
	[AuthHr,	"form1 Hr"],
];

var counter = new Uint32Array(1);

function form1check(ap, n) {
{
	if (n < 8)
		return -1;

	for(i = form1sig.length-1; i >= 0; i--)
		if (arr2str(ap.slice(0, 8)) == form1sig[i][1])
			return form1sign[i].num;

	return -1;
}

function form1B2M(ap, n, key) {
	fatal("form1B2M unimplemented");
}

function form1M2B(ap, n, key) {
	var s, p, num;

	num = form1check(ap, n);
	if (num < 0)
		return -1;
	n -= 12+16;
	if (n <= 0)
		return -1;

	p = ap.slice(12);
	s = setupChachastate(key, 32, ap, 12, 20);
	if (ccpoly_decrypt(p, n, null, 0, n, s)
		return -1;

	ap[0] = num;
	ap.set(p, 1);
	return n+1;
}

