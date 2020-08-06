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

var form1counter = new Uint32Array(1);

function form1check(ap, n) {
	if (n < 8)
		return -1;

	for(i = form1sig.length-1; i >= 0; i--)
		if (arr2str(ap.slice(0, 8)) == form1sig[i][1])
			return form1sig[i][0];

	return -1;
}

function form1B2M(ap, n, key) {
	var s;
	var p;
	var i;
	var tag = new Uint8Array(16);

	for (i = form1sig.length-1; i >= 0; i--)
		if (form1sig[i][0] == ap[0])
			break;
	if (i < 0)
		fatal("invalid form1 signature");

	p = new Uint8Array(n-1);
	p.set(ap.slice(1, n), 0);
	n--;

	ap.set(str2arr(form1sig[i][1]), 0);
	i = new Uint32Array(1);
	i[0] = form1counter[0]++;
	ap[8] = i[0] & 0xFF;
	ap[9] = (i[0] >> 8) & 0xFF
	ap[10] = (i[0] >> 16) & 0xFF
	ap[11] = (i[0] >>> 24) & 0xFF

	s = setupChachastate(null, key, 32, ap, 12, 20);
	ccpoly_encrypt(p, n, null, 0, tag, s);
	ap.set(p.slice(0, n), 12);
	ap.set(tag, 12+n);

	return 12+16+n;
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
	s = setupChachastate(null, key, 32, ap, 12, 20);
	if (ccpoly_decrypt(p, n, null, 0, p.slice(n), s))
		return -1;

	ap[0] = num;
	ap.set(p.slice(0, n), 1);
	return n+1;
}

