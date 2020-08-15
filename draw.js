const drawmsg = {
	A: {fmt: ["i4:id", "i4:imageid", "i4:fillid", "i1:public"], handler: drawallocscreen, size:13},
	b: {fmt: ["i4:id", "i4:screenid", "i1:refresh", "b4:chan", "i1:repl", "b16:r", "b16:clipr", "b4:color"], handler: drawallocate, size:50},
	c: {fmt: ["i4:id", "i1:repl", "b16:clipr"], handler: drawreplclip, size: 21},
	d: {fmt: ["i4:dstid", "i4:srcid", "i4:maskid", "b16:dstr", "b8:srcp", "b8:maskp"], handler: drawdraw, size:44},
	E: {fmt: ["i4:dstid", "i4:srcid", "b8:c", "i4:a", "i4:b", "i4:thick", "b8:sp", "i4:alpha", "i4:phi"], handler: drawfillellipse, size: 44},
	e: {fmt: ["i4:dstid", "i4:srcid", "b8:c", "i4:a", "i4:b", "i4:thick", "b8:sp", "i4:alpha", "i4:phi"], handler: drawellipse, size: 44},
	F: {fmt: ["i4:id"], handler: drawscreenfree, size: 4},
	f: {fmt: ["i4:id"], handler: drawfree, size: 4},
	i: {fmt: ["i4:id","i4:n","i1:ascent"], handler: drawfontcache, size: 9},
	l: {fmt: ["i4:cacheid", "i4:srcid", "i2:index", "b16:r", "b8:sp", "i1:left", "i1:width"], handler: drawloadchar, size: 36},
	L: {fmt: ["i4:dstid", "b8:p0", "b8:p1", "i4:end0", "i4:end1", "i4:thick", "i4:srcid", "b8:sp"], handler: drawline, size: 44},
	N: {fmt: ["i4:id", "i1:in", "S1:n"], handler: drawsetname, size: 6},
	n: {fmt: ["i4:id", "S1:n"], handler: drawname, size: 5},
	O: {fmt: ["i1:op"], handler: drawsetop, size:1},
	v: {fmt: [], handler: drawflush, size: 0},
	s: {fmt: ["i4:dstid", "i4:srcid", "i4:fontid", "b8:dstp", "b16:clipr", "b8:srcp", "i2:ni"], handler: drawstring, size: 46},
	x: {fmt: ["i4:dstid", "i4:srcid", "i4:fontid", "b8:dstp", "b16:clipr", "b8:srcp", "i2:ni", "i4:bgid", "b8:bgpt"], handler: drawstring, size: 58},
	y: {fmt: ["i4:id", "b16:r", "R:buf"], handler: drawload, size: 20},
	Y: {fmt: ["i4:id", "b16:r", "R:buf"], handler: drawcload, size: 20},
};

function punpack(b) {
	var a;

	a = unpack(b, ["i4:x", "i4:y"]);
	return [a.x, a.y];
}

function runpack(b) {
	var a;

	a = unpack(b, ["j4:minx", "j4:miny", "j4:maxx", "j4:maxy"]);
	return [a.minx, a.miny, a.maxx, a.maxy];
}

function newconn(draw) {
	var i;
	var conns = draw.conns;
	var disp = draw.disp;
	var winid = draw.winid;

	for(x in conns)
		if(conns[x].used != true){
			conns[x].used = true;
			conns[x].img = disp;
			conns[x].imgs = {0: disp};
			return conns[x];
		}
	i = conns.length;
	conns.push({id: i, img: disp, used: true, imgs: {0: disp}, draw: draw});
	mkdir("/dev/hsys/" + winid + "/draw/" + i);
	lookupfile("/dev/hsys/" + winid + "/draw/" + i, true).id = i;
	mkfile("/dev/hsys/" + winid + "/draw/" + i + "/ctl", function(f, p) {
		draw.nctl++;
}, drawctlread, undefined, function(f) {
		draw.nctl--;
		if (draw.nctl == 0) {
			win(winid).bg.innerHTML = '';
			oshow(winid, true);
			win(winid).terminal.focus();
			draw.conns[f.f.parent.id].used = false;
		}
}).draw = draw;
	mkfile("/dev/hsys/" + winid + "/draw/" + i + "/data", undefined, invalidop, drawdatawrite).draw = draw;
	mkfile("/dev/hsys/" + winid + "/draw/" + i + "/colormap", undefined, undefined, undefined);
	mkfile("/dev/hsys/" + winid + "/draw/" + i + "/refresh", undefined, drawrefreshread, undefined).draw = draw;
	return conns[i];
}

function drawnewopen(f) {
	var draw = f.f.draw;
	try {
		if (draw.nctl == 0) {
			draw.canvas = document.createElement("canvas");
			draw.canvas.oncontextmenu = function(event) {
				return false;
			}
			draw.canvas.width = parseInt(win(draw.winid).bg.style.width.replace(/px$/, ''));
			draw.canvas.height = parseInt(win(draw.winid).bg.style.height.replace(/px$/, ''));
			draw.ctx = draw.canvas.getContext('2d');
			if(draw.ctx == undefined)
				return "no canvas";
			draw.disp.canvas = draw.canvas;
			draw.disp.ctx = draw.ctx;
			draw.disp.r[0] = 0; //parseInt(win(draw.winid).style.left.replace(/px$/,''));
			draw.disp.r[1] = 0; //parseInt(win(draw.winid).style.top.replace(/px$/,''))+30;
			draw.disp.r[2] = draw.canvas.width; //draw.disp.r[0] + draw.canvas.width;
			draw.disp.r[3] = draw.canvas.height; //draw.disp.r[1] + draw.canvas.height;
			draw.disp.clipr = draw.disp.r;
			draw.screens = {};
			draw.conns = [];
			draw.refresh = [0, 0, 0, 0, 0];
			draw.onrefresh = [];
			draw.pub = {"noborder.screen.0": draw.disp};
		}
		win(draw.winid).bg.innerHTML = '';
		win(draw.winid).bg.appendChild(draw.canvas);
		win(draw.winid).bg.focus();
		draw.nctl++;
		f.f = lookupfile("/dev/hsys/" + draw.winid + "/draw/" + newconn(draw).id + "/ctl", true);
		oshow(draw.winid, false);
	} catch(err) {
		console.log(err.toString());
		return err.toString();
	}
	return "";
}

function drawctlread(f, p) {
	var id, c, i;
	var draw = f.f.draw;
	var conns = draw.conns;

	id = f.f.parent.id;
	c = conns[id];
	i = c.img;
	a = [id, i.id, i.chan, i.repl].concat(i.r).concat(i.clipr);
	for(x in a){
		a[x] = String(a[x]).substring(0, 11);
		if(a[x].length < 11)
			a[x] = Array(12 - a[x].length).join(' ') + a[x];
	}
	readstr(p, a.join(' ')+' ');
}

function drawrefreshread(f, p) {
	var s, i;

	if(f.refresh != f.f.draw.refresh) {
		s = f.refresh = f.f.draw.refresh;
		for(i in s){
			s[i] = String(s[i]).substring(0, 11);
			if(s[i].length < 11)
				s[i] = Array(12 - s[i].length).join(' ') + s[i];
		}
		s = s.join(' ') + ' ';
		respond(p, s);
	} else {
		var l = f.f.draw.onrefresh.length;
		onflush(p.tag, function() { f.f.draw.onrefresh.splice(l, 1); });
		f.f.draw.onrefresh.push(function() { drawrefreshread(f, p); })
	}
}

function drawdatawrite(f, p) {
	var t, s, m, i;
	var conns = f.f.draw.conns;

	try {

	i = 0;
	while (i < p.data.length) {
		t = p.data[i];
		if(drawmsg[t] == undefined)
			throw "unknown draw message " + t;
		i++;
		m = unpack(p.data.substring(i), drawmsg[t].fmt);
		s = drawmsg[t].handler(conns[f.f.parent.id], m);
		if(s != "" && s != undefined)
			throw s;

		i += drawmsg[t].size;
		switch(t) {
		case 'n':
		case 'N':
			i += m.n.length;
			break;
		case 'y':
		case 'Y':
			i += m.buf.length;
			break;
		case 's':
		case 'x':
			i += m.ni * 2;
			break;
		}
	}
	respond(p, -1);

	} catch (e) {
		console.log(e.toString());
		error9p(p.tag, e.toString());
	}
}

function drawallocate(c, p) {
	var i, a;
	var draw = c.draw;

	if(c.imgs[p.id] != undefined) return "id " + p.id + " already in use";
	i = allocimg(runpack(p.r), [p.color.charCodeAt(3), p.color.charCodeAt(2), p.color.charCodeAt(1), p.color.charCodeAt(0)], p.repl);
//	document.body.appendChild(i.canvas);
	i.id = p.id;
	i.refresh = p.refresh;
	if (i.refresh != 0 && i.refresh != 1)
		throw "unknown refresh method";
	i.clipr = runpack(p.clipr);
	i.chan = p.chan;
	a = str2arr(p.chan);
	i.ichan = a[0] | (a[1] << 8) | (a[2] << 16) | (a[3] << 24);
	i.depth = chantodepth(i.ichan);
	if(p.screenid != 0){
		i.screen = draw.screens[p.screenid];
		if(i.screen == undefined) return "id " + p.screenid + " not in use";
		i.screen.win.push(i);
		if (i.refresh == 1) {
			i.layer = {delta:[0,0], screen:i.screen};
			i.layer.save = allocimg(runpack(p.r), [p.color.charCodeAt(3), p.color.charCodeAt(2), p.color.charCodeAt(1), p.color.charCodeAt(0)], p.repl);
		}
	}
	c.imgs[p.id] = i;
}

function drawallocscreen(c, p) {
	if(c.draw.screens[p.id] != undefined) return "id " + p.id + " already in use";
	if(c.imgs[p.imageid] == undefined) return "id " + p.imageid + " not in use";
	if(c.imgs[p.fillid] == undefined) return "id " + p.fillid + " not in use";
	c.draw.screens[p.id] = {image: c.imgs[p.imageid], fill: c.imgs[p.fillid], public: p.public, win: []};
}

function drawreplclip(c, p) {
	if(c.imgs[p.id] == undefined) return "id " + p.id + " not in use";
	c.imgs[p.id].repl = p.repl;
	c.imgs[p.id].clipr = runpack(p.clipr);
}

function drawfree(c, p) {
	var i, screen;
	var img = c.imgs[p.id];
	c.imgs[p.id] = undefined;
	if (img.screen) {
		screen = img.screen;
		for (i in screen.win)
			if (screen.win[i] === img)
				screen.win.splice(i, 1);
	}
}

function drawscreenfree(c, p) {
	c.draw.screens[p.id] = undefined;
}

function ellipse(c, p, fill) {
	var dst, src, center, color;

	dst = c.imgs[p.dstid];
	if(dst == undefined) return "id " + p.dstid + " not in use";
	src = c.imgs[p.srcid];
	if(src == undefined) return "id " + p.srcid + " not in use";

	center = punpack(p.c);
	color = src.ctx.getImageData(0, 0, 1, 1).data; // TODO

	dst.ctx.beginPath();
	dst.ctx.ellipse(center[0], center[1], p.a, p.b, 0, 0, 2 * Math.PI);
	if(fill){
		dst.ctx.fillStyle = 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')';
		dst.ctx.fill();
	}
	dst.ctx.strokeStyle = 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')';
	dst.ctx.stroke();

	dstflush(dst);
}

function drawfillellipse(c, p) {
	ellipse(c, p, 1);
}

function drawellipse(c, p) {
	ellipse(c, p, 0);
}

function drawline(c, p) {
	var dst, src, p0, p1, color;

	dst = c.imgs[p.dstid];
	if(dst == undefined) return "id " + p.dstid + " not in use";
	src = c.imgs[p.srcid];
	if(src == undefined) return "id " + p.srcid + " not in use";

	p0 = punpack(p.p0);
	p1 = punpack(p.p1);
	color = src.ctx.getImageData(0, 0, 1, 1).data; // TODO

	dst.ctx.beginPath();
	dst.ctx.moveTo(p0[0], p0[1]);
	dst.ctx.lineTo(p1[0], p1[1]);
	dst.ctx.lineWidth = 1 + 2 * p.thick;
	dst.ctx.strokeStyle = 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')';
	dst.ctx.stroke();

	dstflush(dst);
}

function drawload(c, p) {
	var im, d, i, j, k, l, r;

	im = c.imgs[p.id];
	if(im == undefined) return "id + " + p.id + " not in use";
	r = runpack(p.r);

	p.buf = p.buf.substring(0, (rw(r)*rh(r)*(im.depth/8)));

	memfillimage(im, r, str2arr(p.buf));
}

function drawcload(c, p) {
	var im, r, bpl, cnt, offs, y, data;
	var line, end, u, depth, c, mem, memp, omemp, buf;

	im = c.imgs[p.id];
	if(im == undefined) return "id + " + p.id + " not in use";
	r = runpack(p.r);
	y = 0;
	depth = im.depth / 8;
	line = Math.floor((y * rw(r)) * depth);
	bpl = Math.floor(depth * rw(r));
	end = line + bpl;
	data = new Uint8Array(bpl * rh(r));
	u = 0;
	mem = [];
	memp = 0;
	buf = str2arr(p.buf);
	for(;;) {
		if (line == end) {
			if (++y == rh(r))
				break;
			line = Math.floor((y * rw(r)) * depth);
			end = line + bpl;
		}
		if (u == buf.length)
			return "buffer too small";
		c = buf[u++];
		if (c >= 128) {
			for(cnt = c-128+1; cnt != 0; --cnt) {
				if (u == buf.length)
					return "buffer too small";
				if (line == end)
					return "phase error";
				data[line++] = buf[u];
				mem.push(buf[u++]);
				memp++;
			}
		} else {
			if (u == buf.length)
				return "buffer too small";
			offs = buf[u++] + ((c&3)<<8)+1;
			omemp = memp-offs;
			for (cnt = (c>>2)+3; cnt != 0; --cnt) {
				if (line == end)
					return "phase error";
				data[line++] = mem[omemp];
				mem.push(mem[omemp++]);
				memp++;
			}
		}
	}

	p.buf = p.buf.substring(0, u);

	memfillimage(im, r, data);
}

function drawloadchar(c, p) {
}

function drawfontcache(c, p) {
//	document.body.appendChild(c.imgs[p.id].canvas);
}

function drawstring(c, p) {
}

function drawname(c, p) {
	var pub = c.draw.pub;
	if(c.imgs[p.id] != undefined) return "id " + p.id + " already in use";
	if(pub[p.n] == undefined) return "no such image " + p.n;
	c.imgs[p.id] = pub[p.n];
}

function drawsetop(c, p) {
}

function drawsetname(c, p) {
	var pub = c.draw.pub;
	if(c.imgs[p.id] == undefined) return "id " + p.id + " not in use";
	pub[p.n] = c.imgs[p.id];
}

function drawdraw(c, p) {
	var dst, src, dstr = runpack(p.dstr);

	dst = c.imgs[p.dstid];
	if(dst == undefined)
		return "id " + p.dstid + " not in use";
	src = c.imgs[p.srcid];
	if(src == undefined)
		return "id " + p.srcid + " not in use";
	mask = c.imgs[p.maskid];
	memdraw(dst, dstr, src, punpack(p.srcp), mask, punpack(p.maskp), 11);

	dstflush(dst);
}

function screenflush(s) {
	memdraw(s.image, s.image.r, s.fill, [0, 0], undefined, undefined, 11);
	for(x in s.win)
		memdraw(s.image, s.image.r, s.win[x], [0, 0], undefined, undefined, 11);
	if (s.image.screen)
		screenflush(s.image.screen);
}

var flushrect = [-10000, -10000, 10000, 10000];

function dstflush(dst) {
	var l;
	var r = dst.r.concat([]);

	if (!dst || !(l = dst.layer))
		return;

	do {
		r = offset(r, l.delta);
		l = l.screen.image.layer;
	} while(l);

	flushrect = combine(flushrect, r);
}

function drawflush(c, p) {
	var id;

	if (flushrect[0] > flushrect[2])
		return;

	for (id in c.draw.screens) {
		var s = c.draw.screens[id];
		if (!s)
			continue;
		screenflush(s);
	}

	flushrect = [10000, 10000, -10000, -10000];
}

function mkdrawfiles(w) {
	var draw = {};
	var id = w.id;
	draw.window = w;
	draw.disp = {id: 0, r: [0, 0, 0, 0], chan: "r8g8b8a8", repl: 0, refresh: 0};
	draw.disp.clipr = draw.disp.r;
	draw.pub = {"noborder.screen.0": draw.disp};
	draw.ctx = undefined;
	draw.screens = {};
	draw.conns = [];
	draw.refresh = [0, 0, 0, 0, 0];
	draw.onrefresh = [];
	draw.winid = id;
	draw.nctl = 0;

	mkfile("/dev/hsys/" + id + "/winname", undefined, function(f, p) { readstr(p, "noborder.screen.0"); }, undefined);
	mkfile("/dev/hsys/" + id + "/cursor", undefined, function(){}, function(f, p) {respond(p, -1);});
	mkdir("/dev/hsys/" + id + "/draw").draw = draw;
	mkfile("/dev/hsys/" + id + "/draw/new", drawnewopen, drawctlread, invalidop).draw = draw;
}

