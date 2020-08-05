const MPstatic = 0x01;
const MPnorm = 0x02;
const MPtimesafe = 0x04;
const MPfield = 0x08;

const Dbytes = 4;
const Dbits = Dbytes*8;
const MAXDIG = 1024 / Dbits;

const mpmindigits = 33;

const mppow10 = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000];

const mpdighi = new Uint32Array([1<<(Dbits-1)]);

function DIGITS(x) {
	return Math.floor((Dbits - 1 + (x))/Dbits);
}

function mpint() {
	return {sign:1, size:0, top:0, flags:0, p:new Uint32Array([0])};
}

const mptwo = {sign:1, size:1, top:1, flags:MPstatic|MPnorm, p:new Uint32Array([2])};
const mpone = {sign:1, size:1, top:1, flags:MPstatic|MPnorm, p:new Uint32Array([1])};
const mpzero = {sign:1, size:1, top:0, flags:MPstatic|MPnorm, p:new Uint32Array([0])};

function iseven(a) {
	return ((a.p[0] & 1) == 0);
}

function mpcopy(m) {
	var r = mpint();

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

function mptoui(b) {
	if (b.sign < 0)
		return 0;
	if (b.top > 1)
		return 0xFFFFFFFF;
	return b.p[0];
}

function mpbits(b, m) {
	var n = DIGITS(m);
	var i;
	var p;

	if (b.size >= n) {
		if (b.top >= n)
			return;
	} else {
		b.size = n;
		p = new Uint32Array(n > b.p.length? n: b.p.length);
		p.set(b.p, 0);
		b.p = p;
	}
	for (i = b.top; i < n; i++)
		b.p[i] = 0;
	b.top = n;
	b.flags &= ~MPnorm;
}

function mpassign(old, n) {
	if (!n || old === n)
		return;

	n.top = 0;
	mpbits(n, Dbits*old.top);
	n.sign = old.sign;
	n.top = old.top;
	n.flags &= ~MPnorm;
	n.flags |= old.flags & ~(MPstatic|MPfield);
	n.p = new Uint32Array(old.p.length > n.p.length? old.p.length: n.p.length);
	n.p.set(old.p, 0);
}

function mpright(b, shift, res) {
	var d, l, r, i;
	var t = new Uint32Array(2);

	res.sign = b.sign;
	if (b.top == 0) {
		res.top = 0;
		return;
	}

	if (shift < 0) {
		mpleft(b, -shift, res);
		return;
	}

	if (res !== b)
		mpbits(res, b.top*Dbits - shift);
	else if (shift == 0)
		return;

	d = Math.floor(shift/Dbits);
	r = shift - d*Dbits;
	l = Dbits - r;

	if (d >= b.top) {
		res.sign = 1;
		res.top = 0;
		return;
	}

	if (r == 0) {
		for (i = 0; i < b.top-d; i++)
			res.p[i] = b.p[i+d];
	} else {
		t[1] = b.p[d];
		for (i = 0; i < b.top-d-1; i++) {
			t[0] = b.p[i+d+1];
			res.p[i] = (t[0]<<l) | (t[1]>>>r);
			t[1] = t[0];
		}
		res.p[i++] = t[1]>>>r;
	}

	res.top = i;
	res.flags |= b.flags & MPtimesafe;
	mpnorm(res);
}

function mpleft(b, shift, res) {
	var d, l, r, i, otop;
	var t = new Uint32Array(2);

	res.sign = b.sign;
	if (b.top == 0) {
		res.top = 0;
		return;
	}

	if (shift <= 0){
		mpright(b, -shift, res);
		return;
	}

	otop = b.top;

	mpbits(res, otop*Dbits + shift);
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
			res.p[i+d+1] = (t[1]<<l) | (t[0]>>>r);
			t[1] = t[0];
		}
		res.p[d] = t[1]<<l;
	}
	for(i = 0; i < d; i++)
		res.p[i] = 0;

	res.flags |= b.flags & MPtimesafe;
	mpnorm(res);
}

function mpvectscmp(a, alen, b, blen) {
	var x = new Uint32Array(4);
	var m = new Int32Array(2);

	if (alen > blen) {
		x[3] = 0;
		while (alen > blen)
			x[3] |= a[--alen];
		m[0] = m[1] = (-x[3]^x[3]|x[3])>>Dbits-1;
	} else if (blen > alen) {
		x[3] = 0;
		while (blen > alen)
			x[3] |= b[--blen];
		m[0] = (-x[3]^x[3]|x[3])>>Dbits>>1;
		m[1] = m[0]^1;
	} else
		m[0] = m[1] = 0;
	while (alen-- > 0) {
		x[0] = a[alen];
		x[1] = b[alen];
		x[2] = x[0] - x[1];
		x[0] = ~x[0];
		x[3] = ((-x[2]^x[2]|x[2])>>>Dbits-1) & ~m[0];
		m[1] = ((~(x[0]&x[1]|x[0]&x[2]|x[1]&x[2])>>>Dbits-1) & x[3]) | (m[1] & ~x[3]);
		m[0] |= x[3];
	}
	return (m[1]-m[0]) | m[0];
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
	if (i & MPtimesafe)
		return mpvectscmp(b1.p, b1.top, b2.p, b2.top);
	if (i & MPnorm) {
		i = b1.top - b2.top;
		if (i)
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
}

function mpmagsub(b1, b2, diff) {
	var n, m, sign;
	var t;

	if (mpmagcmp(b1, b2) < 0) {
		if ((b1.flags | b1.flags | diff.flags) & MPtimesafe)
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
		mpassign(b1, diff);
		diff.sign = sign;
		return;
	}
	mpbits(diff, n*Dbits);

	mpvecsub(b1.p, n, b2.p, m, diff.p);
	diff.sign = sign;
	diff.top = n;
	mpnorm(diff);
}

function mpsub(b1, b2, diff) {
	var sign;

	if (b1.sign != b2.sign) {
		if ((b1.flags | b1.flags | diff.flags) & MPtimesafe)
			fatal("MPtimesafe in mpsub");
		sign = b1.sign;
		mpmagadd(b1, b2, diff);
		diff.sign = sign;
		return;
	}

	sign = b1.sign;
	mpmagsub(b1, b2, diff);
	if (diff.top != 0)
		diff.sign *= sign;
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
		mpassign(mpzero, sum);
		return;
	}
	if (m == 0){
		mpassign(b1, sum);
		sum.sign = 1;
		return;
	}
	mpbits(sum, (n+1)*Dbits);
	sum.top = n+1;

	mpvecadd(b1.p, n, b2.p, m, sum.p);
	sum.sign = 1;

	mpnorm(sum);
}

function mpadd(b1, b2, sum) {
	var sign;

	if(b1.sign != b2.sign) {
		if ((b1.flags | b2.flags | sum.flags) & MPtimesafe)
			fatal("MPtimesafe in mpadd");
		if (b1.sign < 0)
			mpmagsub(b2, b1, sum);
		else
			mpmagsub(b1, b2, sum);
	} else {
		sign = b1.sign;
		mpmagadd(b1, b2, sum);
		if (sum.top != 0)
			sum.sign = sign;
	}
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
		mpdigmul(b, i, m, 0, part);
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

	if (alen >= 32 && blen > 1) {
		fatal("mpvecmul: karatsubamin unimplemented");
	} else {
		for(i = 0; i < blen; i++){
			t = new Uint32Array(1);
			t[0] = b[i];
			if (t[0] != 0)
				mpvecdigmuladd(a, alen, t, p, i);
		}
	}
}

function mpvectsmul(a, alen, b, blen, p) {
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
	if (blen == 0)
		return;
	for (i = 0; i < blen; i++) {
		t = new Uint32Array(1);
		t[0] = b[i];
		mpvecdigmuladd(a, alen, t, p, i);
	}
}

function mpmul(b1, b2, prod) {
	var oprod = prod;

	if (b1 === prod || b2 === prod) {
		prod = mpnew(0);
		prod.flags = oprod.flags;
	}
	prod.flags |= (b1.flags | b2.flags) & MPtimesafe;

	prod.top = 0;
	mpbits(prod, (b1.top+b2.top+1)*Dbits);
	if (prod.flags & MPtimesafe)
		mpvectsmul(b1.p, b1.top, b2.p, b2.top, prod.p);
	else
		mpvecmul(b1.p, b1.top, b2.p, b2.top, prod.p);
	prod.top = b1.top + b2.top + 1;
	prod.sign = b1.sign * b2.sign;
	mpnorm(prod);

	if (oprod !== prod)
		mpassign(prod, oprod);
}

function mpdiv(dividend, divisor, quotient, remainder) {
	var j, s, vn, sign, qsign, rsign;
	var qd = new Uint32Array(1);
	var up, vp, qp;
	var u, v, t;
	var tmp;

	if (quotient === remainder)
		fatal("mpdiv: quotient === remainder");
	if (!(divisor.flags & MPnorm))
		fatal("mpdiv: divisor MPnorm");
	if (divisor.top == 0)
		fatal("mpdiv: division by 0");

	if (divisor.top == 1 && (divisor.p[0] & divisor.p[0]-1) == 0) {
		var r = mpnew(0);
		if (dividend.top > 0) {
			r.top = 1;
			r.p[0] = dividend.p[0] & divisor.p[0]-1;
			r.sign = dividend.sign;
		}
		if (quotient) {
			sign = divisor.sign;
			for (s = 0; ((divisor.p[0] >>> s) & 1) == 0; s++);
			mpright(dividend, s, quotient);
			if (sign < 0)
				quotient.sign ^= (-mpmagcmp(quotient, mpzero) >>> 31) << 1;
		}
		if (remainder) {
			mpassign(r, remainder);
			remainder.flags |= dividend.flags & MPtimesafe;
		}
		return;
	}
	if (dividend.flags & MPtimesafe)
		fatal("mpdiv: dividend has MPtimesafe flag");

	if(mpmagcmp(dividend, divisor) < 0) {
		if (remainder)
			mpassign(dividend, remainder);
		if (quotient)
			mpassign(mpzero, quotient);
		return;
	}

	qsign = divisor.sign * dividend.sign;
	rsign = dividend.sign;

	qd[0] = divisor.p[divisor.top-1];
	for (s = 0; (qd[0] & mpdighi[0]) == 0; s++)
		qd[0] <<= 1;
	u = mpnew((dividend.top+2)*Dbits + s);
	if (s == 0 && divisor !== quotient && divisor !== remainder) {
		mpassign(dividend, u);
		v = divisor;
	} else {
		mpleft(dividend, s, u);
		v = mpnew(divisor.top*Dbits);
		mpleft(divisor, s, v);
	}
	up = u.top-1;
	vp = v.top-1;
	vn = v.top;

	if (u.p[up] >= v.p[vp]) {
		u.p[++up] = 0;
		u.top++;
	}

	t = mpnew(4*Dbits);

	qp = null;
	if (quotient) {
		mpbits(quotient, (u.top - v.top)*Dbits);
		quotient.top = u.top - v.top;
		qp = quotient.top-1;
	}

	for (j = u.top; j > vn; j--) {
		mpdigdiv(u.p, up-1, v.p, vp, qd);

		if (vn > 1) for(;;) {
			t.p.set(new Uint32Array(3), 0);
			mpvecdigmuladd(v.p.slice(vp-1), 2, qd, t.p, 0);
			if (mpveccmp(t.p, 3, u.p.slice(up-2), 3))
				qd[0]--;
			else
				break;
		}

		sign = mpvecdigmulsub(v.p, vn, qd, u.p, up-vn);
		if (sign < 0) {
			tmp = new Uint32Array(vn+1);
			mpvecadd(u.p.slice(up-vn), vn+1, v.p, vn, tmp)
			u.p.set(tmp, up-vn);
			qd[0]--;
		}

		if (qp != null)
			quotient.p[qp--] = qd[0];

		u.top--;
		u.p[up--] = 0;
	}
	if (qp != null) {
		if (quotient.flags & MPtimesafe)
			fatal("mpdiv: quotient has MPtimesafe flag");
		mpnorm(quotient);
		if (quotient.top != 0)
			quotient.sign = qsign;
	}
	if (remainder) {
		if (remainder.flags & MPtimesafe)
			fatal("mpdiv: remainder has MPtimesafe flag");
		mpright(u, s, remainder);
		if (remainder.top != 0)
			remainder.sign = rsign;
	}
}

function mpmod(x, n, r) {
	var sign;
	var ns;

	sign = x.sign;
	ns = sign < 0 && n === r? mpcopy(n): n;
	if ((n.flags & MPfield) == 0 || n.f.reduce(n, x, r) != 0)
		mpdiv(x, n, null, r);
	if (sign < 0)
		mpmagsub(ns, r, r);
}

function modarg(a, m) {
	var i;

	if (a.size < m.top || a.sign < 0 || mpmagcmp(a, m) >= 0) {
		a = mpcopy(a);
		mpmod(a, m, a);
		mpbits(a, Dbits*(m.top+1));
		a.top = m.top;
	} else if (a.top < m.top) {
		for (i = a.top; i < m.top && i < a.p.length; i++)
			a.p[i] = 0;
	}
	return a;
}

function mpmodadd(b1, b2, m, sum) {
	var a = modarg(b1, m);
	var b = modarg(b2, m);
	var d = new Uint32Array(1);
	var i, j;
	var tmp = new Uint32Array(m.top+1);

	sum.flags |= (a.flags | b.flags) & MPtimesafe;
	mpbits(sum, Dbits*2*(m.top+1));

	mpvecadd(a.p, m.top, b.p, m.top, sum.p);
	mpvecsub(sum.p, m.top+1, m.p, m.top, tmp);
	sum.p.set(tmp, m.top+1);

	d[0] = sum.p[2*m.top+1];
	for(i = 0, j = m.top+1; i < m.top; i++, j++)
		sum.p[i] = (sum.p[i] & d[0]) | (sum.p[j] & ~d[0]);

	sum.top = m.top;
	sum.sign = 1;
	mpnorm(sum);
}

function mpmodsub(b1, b2, m, diff) {
	var a = modarg(b1, m);
	var b = modarg(b2, m);
	var d = new Uint32Array(1);
	var i, j;
	var tmp = new Uint32Array(m.top);

	diff.flags |= (a.flags | b.flags) & MPtimesafe;
	mpbits(diff, Dbits*2*(m.top+1));

	a.p[m.top] = 0;
	mpvecsub(a.p, m.top+1, b.p, m.top, diff.p);
	mpvecadd(diff.p, m.top, m.p, m.top, tmp);
	diff.p.set(tmp, m.top+1);

	d[0] = ~diff.p[m.top];
	for (i = 0, j = m.top+1; i < m.top; i++, j++)
		diff.p[i] = (diff.p[i] & d[0]) | (diff.p[j] & ~d[0]);

	diff.top = m.top;
	diff.sign = 1;
	mpnorm(diff);
}

function mpmodmul(b1, b2, m, prod) {
	var a = modarg(b1, m);
	var b = modarg(b2, m);

	mpmul(a, b, prod);
	mpmod(prod, m, prod);
}

function mpsel(s, b1, b2, res) {
	var d;
	var n, m, i;

	res.flags |= (b1.flags | b2.flags) & MPtimesafe;
	if ((res.flags & MPtimesafe) == 0) {
		mpassign(s ? b1 : b2, res);
		return;
	}
	res.flags &= ~MPnorm;

	n = b1.top;
	m = b2.top;
	mpbits(res, Dbits*(n >= m ? n : m));
	res.top = n >= m ? n : m;

	s = (-s^s|s)>>>31;
	res.sign = (b1.sign & s) | (b2.sign & ~s);

	d = new Uint32Array([-(s & 1)]);

	i = 0;
	while (i < n && i < m) {
		res.p[i] = (b1.p[i] & d[0]) | (b2.p[i] & ~d[0]);
		i++;
	}
	while (i < n) {
		res.p[i] = b1.p[i] & d[0];
		i++;
	}
	while (i < m) {
		res.p[i] = b2.p[i] & ~d[0];
		i++;
	}
}

function mprand(bits, gen, b) {
	var mask = new Uint32Array(1);
	var data;
	var i;
	var buf;

	if (!b)
		b = mpnew(bits);
	else
		mpbits(b, bits);

	b.sign = 1;
	b.top = DIGITS(bits);
	data = gen(b.top * Dbytes);
	buf = new Uint32Array(data.buffer);
	b.p.set(buf, 0);

	mask[0] = (1 << (bits%Dbits))-1;
	if (mask[0] != 0)
		b.p[b.top-1] &= mask[0];

	return mpnorm(b);
}

function mpnrand(n, gen, b) {
	var bits;

	bits = mpsignif(n);
	if (bits == 0)
		fatal("mpnrand: bits == 0");
	if (!b) {
		b = mpnew(bits);
	}
	do {
		mprand(bits, gen, b);
	} while(mpmagcmp(b, n) >= 0);

	return b;
}

function between(x, min, max) {
	return (((min-1-x) & (x-max-1))>>>8);
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
	var x = new Uint32Array(1);
	var i;
	var b = mpnew(0);

	i = 1<<s;
	for(p = 0; (dec16chr(a.charCodeAt(p)) & 255) < i; p++);
	
	mpbits(b, p*s);
	b.top = 0;
	next = p;

	while(p > 0){
		x[0] = 0;
		for(i = 0; i < Dbits; i += s){
			if (p <= 0)
				break;
			p--;
			x[0] |= dec16chr(a.charCodeAt(p))<<i;
		}
		b.p[b.top++] = x[0];
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
		mpmul(b, pow, b);
		mpadd(b, r, b);
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

function betomp(p, n, b) {
	var m, s, i;
	var x = new Uint32Array(1);

	if (!b)
		b = mpnew(0);
	mpbits(b, n*8);

	m = DIGITS(n*8);
	b.top = m--;
	b.sign = 1;

	s = ((n-1)*8)%Dbits;
	x[0] = 0;
	i = 0;
	for(; n > 0; n--){
		x[0] |= p[i++] << s;
		s -= 8;
		if (s < 0) {
			b.p[m--] = x[0];
			s = Dbits-8;
			x[0] = 0;
		}
	}
	return mpnorm(b);
}

function mptober(b, p, idx, n) {
	var i, j, m;
	var x = new Uint32Array(1);

	p.set(new Uint8Array(n), idx);

	idx += n;
	m = b.top*Dbytes;
	if (m < n)
		n = m;

	i = 0;
	while(n >= Dbytes) {
		n -= Dbytes;
		x[0] = b.p[i++];
		for (j = 0; j < Dbytes; j++) {
			p[--idx] = x[0] & 255;
			x[0] >>= 8;
		}
	}
	if(n > 0) {
		x[0] = b.p[i];
		for (j = 0; i < n; j++) {
			p[--idx] = x[0] & 255;
			x[0] >>= 8;
		}
	}
}

function mpexp(b, e, m, res) {
	var t = [0,0];
	var d = new Uint32Array(1);
	var bit = new Uint32Array(1);
	var i, j;

	if (m && (m.flags & MPnorm) == 0)
		fatal("m in mpexp");
	if (e.flags & MPtimesafe)
		fatal("e in mpexp");
	res.flags |= b.flags & MPtimesafe;

	i = mpcmp(e, mpzero);
	if (i == 0) {
		mpassign(mpone, res);
		return;
	}
	if (i < 0)
		fatal("mpexp: negative exponent");

	t[0] = mpcopy(b);
	t[1] = res;

	if (res === b)
		b = mpcopy(b);
	if (res === e)
		e = mpcopy(e);
	if (res === m)
		m = mpcopy(m);

	i = e.top-1;
	d[0] = e.p[i];
	for (bit[0] = mpdighi[0]; (bit[0] & d[0]) == 0; bit[0] >>>= 1);
	bit[0] >>>= 1;

	j = 0;
	for(;;) {
		for (; bit[0] != 0; bit[0] >>>= 1){
			if (m)
				mpmodmul(t[j], t[j], m, t[j^1]);
			else
				mpmul(t[j], t[j], t[j^1]);
			if (bit[0] & d[0]) {
				if (m)
					mpmodmul(t[j^1], b, m, t[j]);
				else
					mpmul(t[j^1], b, t[j]);
			} else
				j ^= 1;
		}
		if (--i < 0)
			break;
		bit[0] = mpdighi[0];
		d[0] = e.p[i];
	}
	if (t[j] !== res)
		mpassign(t[j], res);
}

function mpextendedgcd(a, b, v, x, y) {
	var u, A, B, C, D;
	var g;

	if (!v) {
		v = mpnew(0);
		mpextendedgcd(a, b, v, x, y);
		return;
	}
	if (x && (x.flags & MPtimesafe))
		fatal("mpextendedgcd: x has MPtimesafe flag");
	if (y && (y.flags & MPtimesafe))
		fatal("mpextendedgcd: y has MPtimesafe flag");
	if (!((a.flags&b.flags) & MPnorm))
		fatal("mpextendedgcd: MPnorm");
	if ((a.flags|b.flags|v.flags) & MPtimesafe)
		fatal("mpextendedgcd: MPtimesafe");

	if (a.sign < 0 || b.sign < 0) {
		mpassign(mpzero, v);
		mpassign(mpzero, y);
		mpassign(mpzero, x);
		return;
	}

	if (a.top == 0) {
		mpassign(b, v);
		mpassign(mpone, y);
		mpassign(mpzero, x);
		return;
	}
	if (b.top == 0) {
		mpassign(a, v);
		mpassign(mpone, x);
		mpassign(mpzero, y);
		return;
	}

	g = 0;
	a = mpcopy(a);
	b = mpcopy(b);

	while (iseven(a) && iseven(b)) {
		mpright(a, 1, a);
		mpright(b, 1, b);
		g++;
	}

	u = mpcopy(a);
	mpassign(b, v);
	A = mpcopy(mpone);
	B = mpcopy(mpzero);
	C = mpcopy(mpzero);
	D = mpcopy(mpone);

	for(;;) {
		while(iseven(u)) {
			mpright(u, 1, u);
			if (!iseven(A) || !iseven(B)) {
				mpadd(A, b, A);
				mpsub(B, a, B);
			}
			mpright(A, 1, A);
			mpright(B, 1, B);
		}
		while(iseven(v)) {
			mpright(v, 1, v);
			if (!iseven(C) || !iseven(D)) {
				mpadd(C, b, C);
				mpsub(D, a, D);
			}
			mpright(C, 1, C);
			mpright(D, 1, D);
		}

		if (mpcmp(u, v) >= 0) {
			mpsub(u, v, u);
			mpsub(A, C, A);
			mpsub(B, D, B);
		} else {
			mpsub(v, u, v);
			mpsub(C, A, C);
			mpsub(D, B, D);
		}

		if (u.top == 0)
			break;
	}

	mpassign(C, x);
	mpassign(D, y);
	mpleft(v, g, v);
}

function mpinvert(b, m, res) {
	var v = mpnew(0);

	mpextendedgcd(b, m, v, res, null);
	if (mpcmp(v, mpone) != 0)
		fatal("mpinvert");
	mpmod(res, m, res);
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

	if(a !== r)
		mpassign(a, r);

	d = g.f.m.top;
	mpbits(r, (d+1)*Dbits*2);
	for (i = d; i < (d+d*Dbytes); i++)
		t[i] = r.p[i];

	r.sign = 1;
	r.top = d;
	r.p[d] = 0;

	if (g.nsub > 0) {
		d0[0] = g.nsub;
		mpvecdigmuladd(g.f.m.p, d, d0, r.p, 0);
	}

	x = 0;
	for(i=0; i<g.nadd; i++){
		t[0] = 0;
		d0[0] = t[g.indx[x++]];
		for(j=1; j<d; j++)
			t[j] = t[g.indx[x++]];
		t[0] = d0[0];

		mpvecadd(r.p, d+1, t, d, r.p);
	}

	for(i=0; i<g.nsub; i++){
		t[0] = 0;
		d0[0] = t[g.indx[x++]];
		for(j=1; j<d; j++)
			t[j] = t[g.indx[x++]];
		t[0] = d0[0];

		mpvecsub(r.p, d+1, t, d, r.p);
	}

	d0[0] = r.p[d];
	mpvecdigmulsub(g.f.m.p, d, d0, r.p, 0);
	r.p[d] = 0;

	mpvecsub(r.p, d+1, g.f.m.p, d, t)
	r.p.set(t.slice(0, d+1), d+1);
	d0[0] = r.p[2*d+1];
	for (j = 0; j < d; j++)
		r.p[j] = (r.p[j] & d0[0]) | (r.p[j+d+1] & ~d0[0]);

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
	M = mpcopy(N);
	C = new Int32Array(d+1);
	X = new Int32Array(d*d);

	j = new Int32Array(1);
	for (i = 0; i <= d; i++) {
		if ((M.p[i]>>>8) != 0 && (~M.p[i]>>>8) != 0)
			return 0;
		j[0] = M.p[i];
		C[d - i] = -j[0];
		T = itomp(j[0]);
		mpleft(T, i*Dbits, T);
		mpsub(M, T, M);
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
	mpmul(N, N, g.m2);
	mpassign(N, g);
	g.f = {};
	g.f.reduce = gmreduce;
	g.f.m = g;
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

