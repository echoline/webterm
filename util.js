function fatal(msg) {
	throw msg;
}

function randomdata(n) {
	var s, i;

	s = "";
	for(i = 0; i < n; i++)
		s += String.fromCharCode(Math.floor(Math.random() * 256));
	return s;
}

