const Clear   = 0;
const SinD    = 8;
const DinS    = 4;
const SoutD   = 2;
const DoutS   = 1;
const S = SinD|SoutD;
const SoverD  = SinD|SoutD|DoutS;
const SatopD  = SinD|DoutS;
const SxorD   = SoutD|DoutS;
const D = DinS|DoutS;
const DoverS  = DinS|DoutS|SoutD;
const DatopS  = DinS|SoutD;
const DxorS   = DoutS|SoutD;
const Ncomp = 12;

function rw(r) {
	return r[2] - r[0];
}

function rh(r) {
	return r[3] - r[1];
}

function min(a, b) {
	return (a > b) ? b : a;
}

function max(a, b) {
	return (a > b) ? a : b;
}

function intersect(r, s) {
	return [max(r[0], s[0]), max(r[1], s[1]), min(r[2], s[2]), min(r[3], s[3])];
}

function offset(r, p) {
	return [r[0] + p[0], r[1] + p[1], r[2] + p[0], r[3] + p[1]];
}

function allocimg(rect, fill, repl) {
	i = {r: rect, clipr: rect.concat([]), repl: repl};
	i.canvas = document.createElement("canvas");
	i.canvas.width = rw(i.r);
	i.canvas.height = rh(i.r);
	i.ctx = i.canvas.getContext("2d");
	i.ctx.beginPath();
	i.ctx.rect(0, 0, rw(i.r), rh(i.r));
	i.ctx.fillStyle = "rgb(" + fill[0] + "," + fill[1] + "," + fill[2] + ")";
	i.ctx.fill();
	return i;
}

const rgbcalc = [
	function (d, s, m) {
		return 0;
	},
	undefined,
	undefined,
	undefined,
	undefined,
	undefined,
	undefined,
	undefined,
	undefined,
	undefined,
	undefined,
	function (d, s, m) {
		var ms;

		ms = m / 255.0;

		return Math.round((s * ms + d * (1.0 - ms)));
	},
];

const alphacalc = [
	function (d, s, m) {
		return 0;
	},
	undefined,
	undefined,
	undefined,
	undefined,
	undefined,
	undefined,
	undefined,
	undefined,
	undefined,
	undefined,
	function (d, s, m) {
		return 0xFF;
	},
];

defmask = allocimg([0,0,1,1], [255,255,255,255], 1);

function memdraw(dst, r, src, sp, mask, mp, op) {
	var spr, dx, dy, sx, sy, mx, my, d, s, m, doff, soff, moff;

	spr = [sp[0] + r[0], sp[1] + r[1]];
	r = intersect(r, dst.r);
	r = intersect(r, offset(src.clipr, spr));
	if(src.repl == 0)
		r = intersect(r, offset(src.r, spr));
	if(mask){
		r = intersect(r, offset(mask.clipr, mp));
		if(mask.repl == 0)
			r = intersect(r, offset(mask.r, mp));
	}else{
		mask = defmask;
		mp = [0,0];
	}

	d = dst.ctx.getImageData(0, 0, dst.canvas.width, dst.canvas.height);
	s = src.ctx.getImageData(0, 0, src.canvas.width, src.canvas.height);
	m = mask.ctx.getImageData(0, 0, mask.canvas.width, mask.canvas.height);
	for(dy = r[1], sy = sp[1], my = mp[1]; dy < r[3]; dy++, sy++, my++){
		if(sy == src.canvas.height)
			sy -= src.canvas.height;
		if(my == mask.canvas.height)
			my -= mask.canvas.height;
		for(dx = r[0], sx = sp[0], mx = mp[0]; dx < r[2]; dx++, sx++, mx++){
			if(sx == src.canvas.width)
				sx -= src.canvas.width;
			if(mx == mask.canvas.width)
				mx -= mask.canvas.width;
			doff = (dy * dst.canvas.width + dx) * 4;
			soff = (sy * src.canvas.width + sx) * 4;
			moff = (my * mask.canvas.width + mx) * 4;
			d.data[doff++] = rgbcalc[op](d.data[doff], s.data[soff++], m.data[moff++]);
			d.data[doff++] = rgbcalc[op](d.data[doff], s.data[soff++], m.data[moff++]);
			d.data[doff++] = rgbcalc[op](d.data[doff], s.data[soff++], m.data[moff++]);
			d.data[doff++] = alphacalc[op](d.data[doff], s.data[soff++], m.data[moff++]);
		}
	}

	dst.ctx.putImageData(d, 0, 0);
}

