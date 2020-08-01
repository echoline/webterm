var MPstatic = 0x01;
var MPnorm = 0x02;
var MPtimesafe = 0x04;
var MPfield = 0x08;

var Dbytes = 4;
var Dbits = Dbytes*8;

var mpmindigits = 33;

var mppow10 = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000];

function DIGITS(x) {
	return ((Dbits - 1 + (x))/Dbits);
}

function mpint() {
	var b = {};

	b.sign = 1;
	b.size = 0;
	b.top = 0;
	b.flags = 0;
	b.p = [];

	return b;
}

function mpnew(n) {
	var b = mpint();

	if (n < 0)
		fatal("mpnew has negative n");

	n = DIGITS(n);
	if (n < mpmindigits)
		n = mpmindigits;
	b.sign = 1;
	b.size = n;
	b.flags = MPnorm;
	for (i = 0; i < n; i++)
		b.p = b.p.concat([0]);

	return b;
}

function mpnorm(b) {
	if (b.flags & MPtimesafe) {
		if (b.sign != 1)
			fatal("MPtimesafe with negative sign");
		b.flags &= ~MPnorm;
		return b;
	}
	for (i = b.top-1; i >= 0; i--)
		if (b.p[i] != 0)
			break;
	b.top = i+1;
	if (b.top == 0)
		b.sign = 1;
	b.flags |= MPnorm;
	return b;
}

function itomp(i) {
	var b = mpnew(0);
	if (i < 0)
		b.sign = -1;
	i *= b.sign;
	b.p[0] = i;
	b.top = 1;

	return mpnorm(b);
}

function mpbits(b, m) {
	var n = DIGITS(m);
	var i;

	if (b.size >= n) {
		if (b.top >= n)
			return b;
	} else {
		for (i = b.top; i <= n; i++)
			b.p = b.p.concat([0]);
		b.size = n;
	}
	b.top = n;
	b.flags &= ~MPnorm;

	return b;
}

function mpmul(b1, b2) {
	var prod = mpnew(0);

	prod.flags |= (b1.flags | b2.flags) & MPtimesafe;
	prod.top = 0;
	prod = mpbits(prod, (b1.top+b2.top+1)*Dbits);
	prod.p = mpvecmul(b1.p, b1.top, b2.p, b2.top, prod.p);
	prod.top = b1.top + b2.top + 1;
	prod.sign = b1.sign * b2.sign;

	return mpnorm(prod);
}

function from10(str) {
	var x, y, i, j;
	var b = mpnew(0);
	var pow = mpnew(0);
	var r = mpnew(0);

	b.top = 0;
	j = 0;
	for(;;) {
		x = 0;
		for (i = 0; i < 9; i++){
			y = str.charCodeAt(j) - '0';
			if (y > 9)
				break;
			j++;
			x *= 10;
			x += y;
		}
		if (i == 0)
			break;

		pow = itomp(mppow10[i]);
		r = itomp(x);
		b = mpmul(x, pow);
		b = mpadd(b, r);
		if (i < 9)
			break;
	}

	return b;
}

function strtomp(str, base) {
	var b;
	var sign = 1;
	var i = 0;

	while(i < str.length && (str.charCodeAt(i) == ' ' || str.charCodeAt(i) == '\t'))
		i++;

	while(i < str.length && str.charCodeAt(i) == '-')
		sign *= -1;

	if (i < str.length && base == 0) {
		base = 10;
		if (str.charCodeAt(i) == '0') {
			if (str.charCodeAt(i+1) == 'x' || str.charCodeAt(i+1) == 'X') {
				base = 16;
				i += 2;
			} else if (str.charCodeAt(i+1) == 'b' || str.charCodeAt(i+1) == 'B') {
				base = 2;
				i += 2;
			} else if (str.charCodeAt(i+1) >= '0' && str.charCodeAt(i+1) <= '7') {
				base = 8;
				i++;
			}
		}
	}

	if (i < str.length) {
		switch(base) {
		case 2:
			b = frompow2(str.substring(i), 1);
			break;
		case 4:
			b = frompow2(str.substring(i), 2);
			break;
		case 8:
			b = frompow2(str.substring(i), 3);
			break;
		case 10:
			b = from10(str.substring(i));
			break;
		case 16:
			b = frompow2(str.substring(i), 4);
			break;
		default:
			fatal("unknown base: " + base);
		}
	} else
		return 0;

	b.sign = sign;
	return mpnorm(b);
}


