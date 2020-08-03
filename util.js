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

