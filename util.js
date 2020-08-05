function fatal(msg) {
	throw msg;
}

function zerobytes(n) {
	return new Uint8Array(n);
}

function randombytes(n) {
	var s, i;

	s = zerobytes(n);
	for(i = 0; i < n; i++)
		s[i] = Math.floor(Math.random() * 256);
	return s;
}

var chachabytesstate = 0;
function chachabytes(n) {
	var c, p;
	var cs;

	if (chachabytesstate == 0) {
		var seed = randombytes(44);
		chachabytesstate = setupChachastate(null, seed, 32, seed.slice(8), 12, 20);
	}

	cs = chachabytesstate;

	c = {input:new Uint32Array(cs.input),
		xkey:new Uint32Array(cs.xkey),
		rounds:cs.rounds,
		ivwords:cs.ivwords};

	p = new Uint8Array(cs.input.slice(4, 12).buffer);
	chacha_encrypt(p, 32, c);
	cs.input.set(new Uint32Array(p.buffer), 4);
	if (++cs.input[13] == 0)
		if (++cs.input[14] == 0)
			++cs.input[15];

	p = new Uint8Array(n);
	chacha_encrypt(p, n, c);

	return p;
}

function randomstring(n) {
	return arr2str(randombytes(n));
}

function arr2str(a) {
	return String.fromCharCode.apply(null, a);
}

function str2arr(s) {
	var a = zerobytes(s.length);
	var i;

	for (i = 0; i < s.length; i++)
		a[i] = s.charCodeAt(i);

	return a;
}

function fromutf8(s) {
	return decodeURIComponent(escape(s));
}

function toutf8(s) {
	return unescape(encodeURIComponent(s));
}

function tsmemcmp(a1, a2, n) {
	var lt, gt, c1, c2, r, m;
	var i;

	r = m = 0;
	i = 0;

	while (n--) {
		c1 = a1[i];
		c2 = a2[i];
		i++;
		lt = (c1 - c2) >> 8;
		gt = (c2 - c1) >> 8;
		r |= (lt - gt) & ~m;
		m |= lt | gt;
	}
	return r;
}
