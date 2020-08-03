function fatal(msg) {
	throw msg;
}

function randomstring(n) {
	return String.fromCharCode.apply(null, randombytes(n));
}

function randombytes(n) {
	var s, i;

	s = new Uint8Array(n);
	for(i = 0; i < n; i++)
		s[i] = Math.floor(Math.random() * 256);
	return s;
}

