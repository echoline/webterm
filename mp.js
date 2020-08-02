const MPstatic = 0x01;
const MPnorm = 0x02;
const MPtimesafe = 0x04;
const MPfield = 0x08;

const Dbytes = 4;
const Dbits = Dbytes*8;
const MAXDIG = 1024 / Dbits;

const mpmindigits = 33;

const mppow10 = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000];

function DIGITS(x) {
	return Math.floor((Dbits - 1 + (x))/Dbits);
}

function mpint() {
	return {sign:1, size:0, top:0, flags:0, p:new Uint32Array([0])};
}

function mptwo() {
	return {sign:1, size:1, top:1, flags:MPstatic|MPnorm, p:new Uint32Array([2])}
}

function mpone() {
	return {sign:1, size:1, top:1, flags:MPstatic|MPnorm, p:new Uint32Array([1])}
}

function mpzero() {
	return {sign:1, size:1, top:1, flags:MPstatic|MPnorm, p:new Uint32Array([0])}
}

function mpcopy(m) {
	var r = {};

	r.size = m.size;
	r.sign = m.sign;
	r.top = m.top;
	r.flags = m.flags;
	r.p = new Uint32Array(m.p.length);
	r.p.set(m.p, 0);

	return r;
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
	b.p = new Uint32Array(n);

	return b;
}

function mpnorm(b) {
	if (b.flags & MPtimesafe) {
		if (b.sign != 1)
			fatal("MPtimesafe in mpnorm");
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

function uitomp(i) {
	var b = mpnew(0);
	b.p[0] = i[0];
	b.top = 1;

	return mpnorm(b);
}

function mpbits(b, m) {
	var n = DIGITS(m);
	var i;
	var p;

	if (b.size >= n) {
		if (b.top >= n)
			return b;
	} else {
		b.size = n;
		p = new Uint32Array(n);
		p.set(b.p, 0);
		b.p = p;
	}
	b.top = n;
	b.flags &= ~MPnorm;

	return b;
}

function mpassign(old, n) {
	if (!n || !old)
		return 0;

	n.top = 0;
	n = mpbits(n, Dbits*old.top);
	n.sign = old.sign;
	n.top = old.top;
	n.flags &= ~MPnorm;
	n.flags |= old.flags & ~(MPstatic|MPfield);
	n.p = new Uint32Array(old.p);

	return n;
}

function mpright(b, shift, res) {
	var d, l, r, i;
	var t = new Uint32Array(2);

	res.sign = b.sign;
	if (b.top == 0) {
		res.top = 0;
		return res;
	}

	if (shift < 0) {
		res = mpleft(b, -shift, res);
		return res;
	}

	if (res !== b)
		res = mpbits(res, b.top*Dbits - shift);
	else if (shift == 0)
		return res;

	d = Math.floor(shift/Dbits);
	r = shift - d*Dbits;
	l = Dbits - r;

	if (d >= b.top) {
		res.sign = 1;
		res.top = 0;
		return res;
	}

	if (r == 0) {
		for (i = 0; i < b.top-d; i++)
			res.p[i] = b.p[i+d];
	} else {
		t[1] = b.p[d];
		for (i = 0; i < b.top-d-1; i++) {
			t[0] = b.p[i+d+1];
			res.p[i] = (t[0]<<l) | (t[1]>>r);
			t[1] = t[0];
		}
		res.p[i++] = t[1]>>r;
	}

	res.top = i;
	res.flags |= b.flags & MPtimesafe;
	return mpnorm(res);
}

function mpleft(b, shift, res) {
	var d, l, r, i, otop;
	var t = new Uint32Array(2);

	res.sign = b.sign;
	if (b.top == 0) {
		res.top = 0;
		return res;
	}

	if (shift <= 0){
		res = mpright(b, -shift, res);
		return res;
	}

	otop = b.top;

	res = mpbits(res, otop*Dbits + shift);
	res.top = DIGITS(otop*Dbits + shift);
	d = Math.floor(shift/Dbits)
	l = shift - d*Dbits;
	r = Dbits - l;

	if (l == 0) {
		for(i = otop-1; i >= 0; i--)
			res.p[i+d] = b.p[i];
	} else {
		t[1] = 0;
		for(i = otop-1; i >= 0; i--) {
			t[0] = b.p[i];
			res.p[i+d+1] = (t[1]<<l) | (t[0]>>r);
			t[1] = t[0];
		}
		res.p[d] = t[1]<<l;
	}
	for(i = 0; i < d; i++)
		res.p[i] = 0;

	res.flags |= b.flags & MPtimesafe;
	return mpnorm(res);
}

function mpveccmp(a, alen, b, blen) {
	var x = new Uint32Array(1);

	while (alen > blen)
		if (a[--alen] != 0)
			return 1;
	while (blen > alen)
		if (b[--blen] != 0)
			return -1;
	while (alen > 0) {
		alen--;
		x[0] = a[alen] - b[alen];
		if (x[0] == 0)
			continue;
		if (x[0] > a[alen])
			return -1;
		else
			return 1;
	}
	return 0;
}

function mpmagcmp(b1, b2) {
	var i = b1.flags | b2.flags;
	if (i & MPnorm) {
		i = b1.top - b2.top;
		if (i != 0)
			return i;
	}
	return mpveccmp(b1.p, b1.top, b2.p, b2.top);
}

function mpcmp(b1, b2) {
	var sign;

	sign = (b1.sign - b2.sign) >> 1;
	return sign | (sign&1)-1 & mpmagcmp(b1, b2)*b1.sign;
}

function mpvecsub(a, alen, b, blen, diff) {
	var i, borrow;
	var x = new Uint32Array(2);

	borrow = 0;
	for (i = 0; i < blen; i++) {
		x[0] = a[i];
		x[1] = b[i];
		x[1] += borrow;
		if (x[1] < borrow)
			borrow = 1;
		else
			borrow = 0;
		if (x[0] < x[1])
			borrow++;
		diff[i] = x[0] - x[1];
	}
	for(; i < alen; i++){
		x[0] = a[i];
		x[1] = x[0] - borrow;
		if (x[1] > x[0])
			borrow = 1;
		else
			borrow = 0;
		diff[i] = x[1];
	}

	return diff;
}

function mpmagsub(b1, b2, diff) {
	var n, m, sign;
	var t;

	if (mpmagcmp(b1, b2) < 0) {
		if (((b1.flags | b1.flags | diff.flags) & MPtimesafe) != 0)
			fatal("MPtimesafe in mpmagsub");
		sign = -1;
		t = b1;
		b1 = b2;
		b2 = t;
	} else {
		diff.flags |= (b1.flags | b2.flags) & MPtimesafe;
		sign = 1;
	}
	n = b1.top;
	m = b2.top;
	if (m == 0) {
		diff = mpassign(b1, diff);
		diff.sign = sign;
		return diff;
	}
	diff = mpbits(diff, n*Dbits);

	diff.p = mpvecsub(b1.p, n, b2.p, m, diff.p);
	diff.sign = sign;
	diff.top = n;
	return mpnorm(diff);
}

function mpsub(b1, b2, diff) {
	var sign;

	if (b1.sign != b2.sign) {
		if (((b1.flags | b1.flags | diff.flags) & MPtimesafe) != 0)
			fatal("MPtimesafe in mpsub");
		sign = b1.sign;
		diff = mpmagadd(b1, b2, diff);
		diff.sign = sign;
		return diff;
	}

	sign = b1.sign;
	diff = mpmagsub(b1, b2, diff);
	if (diff.top != 0)
		diff.sign *= sign;

	return diff;
}

function mpvecadd(a, alen, b, blen, sum) {
	var i, carry;
	var x = new Uint32Array(2);

	carry = 0;
	for(i = 0; i < blen; i++){
		x[0] = a[i];
		x[1] = b[i];
		x[0] += carry;
		if(x[0] < carry)
			carry = 1;
		else
			carry = 0;
		x[0] += x[1];
		if(x[0] < x[1])
			carry++;
		sum[i] = x[0];
	}
	for(; i < alen; i++){
		x[0] = a[i] + carry;
		if(x[0] < carry)
			carry = 1;
		else
			carry = 0;
		sum[i] = x[0];
	}
	sum[i] = carry;

	return sum;
}

function mpmagadd(b1, b2, sum) {
	var m, n;
	var t;

	sum.flags |= (b1.flags | b2.flags) & MPtimesafe;

	if(b2.top > b1.top){
		t = b1;
		b1 = b2;
		b2 = t;
	}
	n = b1.top;
	m = b2.top;
	if (n == 0){
		return mpzero();
	}
	if (m == 0){
		sum = mpassign(b1, sum);
		sum.sign = 1;
		return sum;
	}
	sum = mpbits(sum, (n+1)*Dbits);
	sum.top = n+1;

	sum.p = mpvecadd(b1.p, n, b2.p, m, sum.p);
	sum.sign = 1;

	return mpnorm(sum);
}

function mpadd(b1, b2, sum) {
	var sign;

	if(b1.sign != b2.sign) {
		if (((b1.flags | b2.flags | sum.flags) & MPtimesafe) != 0)
			fatal("MPtimesafe in mpadd");
		if (b1.sign < 0)
			sum = mpmagsub(b2, b1, sum);
		else
			sum = mpmagsub(b1, b2, sum);
	} else {
		sign = b1.sign;
		sum = mpmagadd(b1, b2, sum);
		if (sum.top != 0)
			sum.sign = sign;
	}

	return sum;
}

function LO(x) {
	return ((x) & ((1<<(Dbits/2))-1));
}

function HI(x) {
	return ((x) >>> (Dbits/2));
}

function mpdigmul(a, ai, b, bi, part)
{
	var ah, al, bh, bl;
	var carry = 0;
	var x = new Uint32Array(1);
	var p = new Uint32Array(4);

	ah = HI(a[ai]);
	al = LO(a[ai]);
	bh = HI(b[bi]);
	bl = LO(b[bi]);

	p[0] = ah*bl;
	p[1] = bh*al;
	p[2] = bl*al;
	p[3] = ah*bh;

	x[0] = p[0]<<(Dbits/2);
	p[2] += x[0];
	if (p[2] < x[0])
		carry++;
	x[0] = p[1]<<(Dbits/2);
	p[2] += x[0];
	if (p[2] < x[0])
		carry++;
	p[3] += carry + HI(p[0]) + HI(p[1]);
	part[0] = p[2];
	part[1] = p[3];

	return part;
}

function mpvecdigmulsub(b, n, m, p, j)
{
	var i;
	var borrow = 0;
	var part = new Uint32Array(2);
	var x = new Uint32Array(2);

	for(i = 0; i < n; i++){
		x[0] = p[j];
		x[1] = x[0] - borrow;
		if (x[1] > x[0])
			borrow = 1;
		else
			borrow = 0;
		x[0] = part[1];
		mpdigmul(b, i, m, 0, part);
		x[0] += part[0];
		if(x[0] < part[0])
			borrow++;
		x[0] = x[1] - x[0];
		if(x[0] > x[1])
			borrow++;
		p[j] = x[0];
		j++;
	}

	x[0] = p[j];
	x[1] = x[0] - borrow - part[1];
	p[j] = x[1];
	if (x[1] > x[0])
		return -1;
	return 1;
}

function mpvecdigmuladd(b, n, m, p, j)
{
	var i;
	var carry = 0;
	var part = new Uint32Array(2);
	var x = new Uint32Array(2);

	for(i = 0; i < n; i++){
		x[0] = part[1] + carry;
		if (x[0] < carry)
			carry = 1;
		else
			carry = 0;
		x[1] = p[j];
		part = mpdigmul(b, i, m, 0, part);
		x[0] += part[0];
		if (x[0] < part[0])
			carry++;
		x[0] += x[1];
		if (x[0] < x[1])
			carry++;
		p[j] = x[0];
		j++;
	}
	p[j] = part[1] + carry;

	return p;
}

function mpvecmul(a, alen, b, blen, p) {
	var i;
	var t;

	if (alen < blen) {
		i = alen;
		alen = blen;
		blen = i;
		t = a;
		a = b;
		b = t;
	}

	for(i = 0; i < blen; i++){
		t = new Uint32Array(1);
		t[0] = b[i];
		if (t[0] != 0)
			p = mpvecdigmuladd(a, alen, t, p, i);
	}

	return p;
}

function mpmul(b1, b2, p) {
	var prod = mpnew(0);

	if (b1 === p || b2 === p)
		prod.flags = p.flags;

	prod.flags |= (b1.flags | b2.flags) & MPtimesafe;
	prod.top = 0;
	prod = mpbits(prod, (b1.top+b2.top+1)*Dbits);
	prod.p = mpvecmul(b1.p, b1.top, b2.p, b2.top, prod.p);
	prod.top = b1.top + b2.top + 1;
	prod.sign = b1.sign * b2.sign;

	return mpnorm(prod);
}

function between(x, min, max) {
	return (((min-1-x) & (x-max-1))>>8);
}

function dec16chr(c) {
	var o;

	o  = between(c, 48, 57) & (1+(c-48));
	o |= between(c, 65, 70) & (1+10+(c-65)); 
	o |= between(c, 97, 102) & (1+10+(c-97)); 

	return o-1;
}

function frompow2(a, s) {
	var j, p, next;
	var x;
	var i;
	var b = mpnew(0);

	i = 1<<s;
	for(p = 0; (dec16chr(a.charCodeAt(p)) & 255) < i; p++);
	
	b = mpbits(b, p*s);
	b.top = 0;
	next = p;

	while(p > 0){
		x = 0;
		for(i = 0; i < Dbits; i += s){
			if (p <= 0)
				break;
			p--;
			x |= dec16chr(a.charCodeAt(p))<<i;
		}
		b.p[b.top++] = x;
	}

	return b;
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
		for (i = 0; i < 9 && j < str.length; i++){
			y = str.charCodeAt(j) - 48;
			if (y > 9 || y < 0)
				break;
			j++;
			x *= 10;
			x += y;
		}
		if (i == 0)
			break;

		pow = itomp(mppow10[i]);
		r = itomp(x);
		b = mpmul(b, pow, b);
		b = mpadd(b, r, b);
		if (i < 9)
			break;
	}

	return b;
}

function strtomp(str, base) {
	var b;
	var sign = 1;
	var i = 0;

	while(i < str.length && (str.charAt(i) == ' ' || str.charAt(i) == '\t'))
		i++;

	while(i < str.length && str.charAt(i) == '-')
		sign *= -1;

	if (i < str.length && base == 0) {
		base = 10;
		if (str.charAt(i) == '0') {
			if (str.charAt(i+1) == 'x' || str.charAt(i+1) == 'X') {
				base = 16;
				i= 2;
			} else if (str.charAt(i+1) == 'b' || str.charAt(i+1) == 'B') {
				base = 2;
				i= 2;
			} else if (str.charAt(i+1) >= '0' && str.charAt(i+1) <= '7') {
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

function mpsignif(n) {
	var i, j;
	var d = new Uint32Array(2);

	if (n.top == 0)
		return 0;
	for (i = n.top-1; i >= 0; i--) {
		d[0] = n.p[i];
		for (j = Dbits-1; j >= 0; j--) {
			d[1] = 1<<j;
			if (d[0] & d[1])
				return i*Dbits + j + 1;
		}
	}
	return 0;
}

function gmreduce(g, a, r) {
	var d0 = new Uint32Array(1);
	var t = new Uint32Array(MAXDIG);
	var i, j, d, x;

	if(mpmagcmp(a, g.m2) >= 0)
		return -1;

	if(a != r)
		r = mpassign(a, r);

	d = g.f.m.top;
	r = mpbits(r, (d+1)*Dbits*2);
	for (i = d; i < (d+d*Dbytes); i++)
		t[i] = r.p[i];

	r.sign = 1;
	r.top = d;
	r.p[d] = 0;

	if (g.nsub > 0) {
		d0[0] = g.nsub;
		r.p = mpvecdigmuladd(g.f.m.p, d, d0, r.p, 0);
	}

	x = 0;
	for(i=0; i<g.nadd; i++){
		t[0] = 0;
		d0[0] = t[g.indx[x++]];
		for(j=1; j<d; j++)
			t[j] = t[g.indx[x++]];
		t[0] = d0[0];

		r.p = mpvecadd(r.p, d+1, t, d, r.p);
	}

	for(i=0; i<g.nsub; i++){
		t[0] = 0;
		d0[0] = t[g.indx[x++]];
		for(j=1; j<d; j++)
			t[j] = t[g.indx[x++]];
		t[0] = d0[0];

		r.p = mpvecsub(r.p, d+1, t, d, r.p);
	}

	d0[0] = r.p[d];
	mpvecdigmulsub(g.f.m.p, d, d0, r.p, 0);
	r.p[d] = 0;

	t = mpvecsub(r.p, d+1, g.f.m.p, d, t)
	r.p.set(t.slice(0, d+1), d+1);
	d0[0] = r.p[2*d+1];
	for (j = 0; j < d; j++)
		r.p[j] = (r.p[j] & d0[0]) | (r.p[j+d+q] & ~d0[0]);

	mpnorm(r);

	return 0;
}

function gmfield(N) {
	var i, j, d, s, C, X, x, e;
	var M, T;
	var g;

	d = N.top;
	if(d <= 2 || d > MAXDIG/2 || (mpsignif(N) % Dbits) != 0)
		return 0;
	g = 0;
	T = mpnew(0);
	M = mpcopy(N);
	C = new Int32Array(d+1);
	X = new Int32Array(d*d);

	for (i = 0; i <= d; i++) {
		if ((M.p[i]>>8) != 0 && (~M.p[i]>>8) != 0)
			return 0;
		j = new Int32Array(1);
		j[0] = M.p[i];
		C[d-i] = -j[0];
		T = itomp(j[0]);
		T = mpleft(T, i*Dbits, T);
		M = mpsub(M, T, M);
	}
	for (j = 0; j < d; j++)
		X[j] = C[d-j];
	for (i = 1; i < d; i++) {
		X[d*i] = X[d*(i-1) + d-1]*C[d];
		for (j = 1; j < d; j++)
			X[d*i + j] = X[d*(i-1) + j-1] + X[d*(i-1) + d-1]*X[d-j];
	}
	g = mpnew(0);
	g.m2 = mpnew(d*2+1);
	g.m2 = mpmul(N, N, g.m2);
	g = mpassign(N, g);
	g.f = mpnew(0);
	g.f.reduce = gmreduce;
	g.f.g = g;
	g.f.m = mpnew(0);
	g.f.m.flags |= MPfield;
	g.indx = new Int32Array(256);
	g.nadd = 0;
	g.nsub = 0;

	s = 0;
	x = 0;
	e = 256 - d;
	for(g.nadd = 0; x <= e; x += d, g.nadd++) {
		s = 0;
		for(i = 0; i < d; i++) {
			for (j = 0; j < d; j++) {
				if (X[d*i+j] > 0 && g.indx[x+j] == 0){
					X[d*i+j]--;
					g.indx[x+j] = d+i;
					s = 1;
					break;
				}
			}
		}
		if (s == 0)
			break;
	}
	for(g.nsub = 0; x <= e; x += d, g.nsub++){
		s = 0;
		for(i = 0; i < d; i++) {
			for (j = 0; j < d; j++) {
				if (X[d*i+j] < 0 && g.indx[x+j] == 0){
					X[d*i+j]++;
					g.indx[x+j] = d+i;
					s = 1;
					break;
				}
			}
		}
		if (s == 0)
			break;
	}
	if (s != 0)
		return 0;

	return g;
}

function mpfield(N) {
	var f;

	if (!N || N.flags & (MPfield|MPstatic))
		return N;
	f = gmfield(N);
	if (f != 0)
		return f;
	return N;
}

