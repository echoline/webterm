const drawmsg = {
	A: {fmt: ["i4:id", "i4:imageid", "i4:fillid", "i1:public"], handler: drawallocscreen, size:13},
	b: {fmt: ["i4:id", "i4:screenid", "i1:refresh", "b4:chan", "i1:repl", "b16:r", "b16:clipr", "b4:color"], handler: drawallocate, size:50},
	d: {fmt: ["i4:dstid", "i4:srcid", "i4:maskid", "b16:dstr", "b8:srcp", "b8:maskp"], handler: drawdraw, size:44},
	E: {fmt: ["i4:dstid", "i4:srcid", "b8:c", "i4:a", "i4:b", "i4:thick", "b8:sp", "i4:alpha", "i4:phi"], handler: drawfillellipse, size: 44},
	F: {fmt: ["i4:id"], handler: drawscreenfree, size: 4},
	f: {fmt: ["i4:id"], handler: drawfree, size: 4},
	L: {fmt: ["i4:dstid", "b8:p0", "b8:p1", "i4:end0", "i4:end1", "i4:thick", "i4:srcid", "b8:sp"], handler: drawline, size: 44},
	n: {fmt: ["i4:id", "S1:n"], handler: drawname, size: 5},
	v: {fmt: [], handler: drawflush, size: 0},
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
			mkdrawfiles(winid);
			win(winid).bg.innerHTML = '';
			oshow(winid, true);
			win(winid).terminal.focus();
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
		if(draw.ctx == undefined){
			draw.canvas = document.createElement("canvas");
			draw.canvas.width = parseInt(win(draw.winid).bg.style.width.replace(/px$/, ''));
			draw.canvas.height = parseInt(win(draw.winid).bg.style.height.replace(/px$/, ''));
			draw.ctx = draw.canvas.getContext('2d');
			if(draw.ctx == undefined)
				return "no canvas";
			draw.disp.canvas = draw.canvas;
			draw.disp.ctx = draw.ctx;
		}
		draw.disp.r[2] = draw.canvas.width;
		draw.disp.r[3] = draw.canvas.height;
		draw.disp.clipr = [].concat(draw.disp.r);
		oshow(draw.winid, false);
		win(draw.winid).bg.innerHTML = '';
		win(draw.winid).bg.appendChild(draw.canvas);
		win(draw.winid).bg.focus();
		draw.nctl++;
		f.f = lookupfile("/dev/hsys/" + draw.winid + "/draw/" + newconn(draw).id + "/ctl", true);
	} catch(err) {
		oshow(draw.winid, true);
		return err.message;
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
	var err = "";

	i = 0;
	while (i < p.data.length) {
		t = p.data[i];
		if(drawmsg[t] == undefined)
			return error9p(p.tag, "unknown draw message " + t);
		i++;
		m = unpack(p.data.substring(i), drawmsg[t].fmt);
		s = drawmsg[t].handler(conns[f.f.parent.id], m);
		if(s != "" && s != undefined)
			return error9p(p.tag, s);

		i += drawmsg[t].size;
		switch(t) {
		case 'n':
			i += m.n.length;
			break;
		case 'y':
			i += m.buf.length;
			break;
		}
	}
	respond(p, -1);
}

function drawallocate(c, p) {
	var i;
	var draw = c.draw;

	if(c.imgs[p.id] != undefined) return "id " + p.id + " already in use";
	i = allocimg(runpack(p.r), [p.color.charCodeAt(3), p.color.charCodeAt(2), p.color.charCodeAt(1), p.color.charCodeAt(0)], p.repl);
	i.id = p.id;
	i.refresh = p.refresh;
	i.clipr = runpack(p.clipr);
	i.chan = p.chan;
	if(p.screenid != 0){
		i.screen = draw.screens[p.screenid];
		if(i.screen == undefined) return "id " + p.screenid + " not in use";
		i.screen.win.push(i);
	}
	c.imgs[p.id] = i;
}

function drawallocscreen(c, p) {
	if(c.draw.screens[p.id] != undefined) return "id " + p.id + " already in use";
	if(c.imgs[p.imageid] == undefined) return "id " + p.imageid + " not in use";
	if(c.imgs[p.fillid] == undefined) return "id " + p.fillid + " not in use";
	c.draw.screens[p.id] = {image: c.imgs[p.imageid], fill: c.imgs[p.fillid], public: p.public, win: []};
}

function drawfree(c, p) {
	c.imgs[p.id] = undefined;
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
	color = src.ctx.getImageData(0, 0, 1, 1).data;

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

function drawline(c, p) {
	var dst, src, p0, p1, color;

	dst = c.imgs[p.dstid];
	if(dst == undefined) return "id " + p.dstid + " not in use";
	src = c.imgs[p.srcid];
	if(src == undefined) return "id " + p.srcid + " not in use";

	p0 = punpack(p.p0);
	p1 = punpack(p.p1);
	color = src.ctx.getImageData(0, 0, 1, 1).data;

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
	d = im.ctx.getImageData(0, 0, im.canvas.width, im.canvas.height);
	k = 0;
	for(i = r[1]; i < r[3]; i++)
		for(j = r[0]; j < r[2]; j++)
			for(l = 0; l < 3; l++)
				d.data[4 * (d.data.width * i + j) + l] = p.buf[k++];

	im.ctx.putImageData(d, 0, 0);
}

function drawcload(c, p) {
	var im, d, r, bpl, cnt, offs, y;
	var line, end, u, depth, c, mem, memp, omemp, buf;

	im = c.imgs[p.id];
	if(im == undefined) return "id + " + p.id + " not in use";
	r = runpack(p.r);
	d = im.ctx.getImageData(0, 0, im.canvas.width, im.canvas.height);
	depth = 4;
	bpl = rw(r) * depth;
	line = 0;
	end = bpl;
	y = 0;
	u = 0;
	mem = new Uint8Array(1024);
	memp = 0;
	buf = str2arr(p.buf);
	for(;;) {
		if (line == end) {
			if (++y == r[3])
				break;
			line = (y * im.canvas.width + r[0]) * depth;
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
				d.data[line++] = buf[u];
				mem[memp++] = buf[u++];
				if (memp == 1024)
					memp = 0;
			}
		} else {
			if (u == buf.length)
				return "buffer too small";
			offs = buf[u++] + ((c&3)<<8)+1;
			if (memp < offs)
				omemp = memp+(1024-offs);
			else
				omemp = memp-offs;
			for (cnt = (c>>2)+3; cnt != 0; --cnt) {
				if (line == end)
					return "phase error";
				d.data[line++] = mem[omemp];
				mem[memp++] = mem[omemp++];
				if (omemp == 1024)
					omemp = 0;
				if (memp == 1024)
					memp = 0;
			}
		}
	}

	im.ctx.putImageData(d, 0, 0);
}

function drawname(c, p) {
	var pub = c.draw.pub;
	if(c.imgs[p.id] != undefined) return "id " + p.id + " already in use";
	if(pub[p.n] == undefined) return "no such image " + p.n;
	c.imgs[p.id] = pub[p.n];
}

function dstflush(dst) {
	var s;

	s = dst.screen;
	if(s != undefined){
		memdraw(s.image, s.image.r, s.fill, [0, 0], undefined, undefined, 11);
		for(x in s.win)
			memdraw(s.image, s.image.r, s.win[x], [0, 0], undefined, undefined, 11);
		dstflush(s.image);
	}
}

function drawdraw(c, p) {
	var dst, src;

	dst = c.imgs[p.dstid];
	if(dst == undefined)
		return "id " + p.dstid + " not in use";
	src = c.imgs[p.srcid];
	if(src == undefined)
		return "id " + p.srcid + " not in use";
	mask = c.imgs[p.maskid];
	memdraw(dst, runpack(p.dstr), src, punpack(p.srcp), mask, punpack(p.maskp), 11);
	dstflush(dst);
}

function drawflush(c, p) {
	dstflush(c.draw.disp);
}

function mousechange(k, e) {
	var c, n;

	c = document.getElementById('draw');
	mouse = [e.clientX - c.offsetLeft, e.clientY - c.offsetLeft, mouse[2], new Date().getTime() - starttime];
	switch(k){
	case 1: mouse[2] |= (1<<e.button); break;
	case 2: mouse[2] &= ~(1<<e.button); break;
	}
	n = onmouse.length;
	while(n--)
		onmouse.shift()();
}

function
mouseread(f, p)
{
	var s, i;

	if(f.mouse != f.f.draw.mouse) {
		s = f.mouse = f.f.draw.mouse;
		for(i in s){
			s[i] = String(s[i]).substring(0, 11);
			if(s[i].length < 11)
				s[i] = Array(12 - s[i].length).join(' ') + s[i];
		}
		s = 'm' + s.join(' ') + ' ';
		respond(p, s);
	} else {
		var l = f.f.draw.onmouse.length;
		onflush(p.tag, function() { f.f.draw.onmouse.splice(l, 1); });
		f.f.draw.onmouse.push(function() { mouseread(f, p); })
	}
}

function mkdrawfiles(id) {
	var draw = {};
	draw.disp = {id: 0, r: [0, 0, 0, 0], chan: "r8g8b8a8", repl: 0, refresh: 0};
	draw.disp.clipr = [].concat(draw.disp.r);
	draw.pub = {"noborder.screen.0": draw.disp};
	draw.ctx = undefined;
	draw.screens = {};
	draw.conns = [];
	draw.mouse = [0, 0, 0, 0];
	draw.starttime = new Date().getTime();
	draw.onmouse = [];
	draw.refresh = [0, 0, 0, 0, 0];
	draw.onrefresh = [];
	draw.winid = id;
	draw.nctl = 0;

	mkfile("/dev/hsys/" + id + "/winname", undefined, function(f, p) { readstr(p, "noborder.screen.0"); }, undefined);
	mkfile("/dev/hsys/" + id + "/cursor", undefined, function(){}, function(f, p) {respond(p, -1);});
	mkdir("/dev/hsys/" + id + "/draw").draw = draw;
	mkfile("/dev/hsys/" + id + "/draw/new", drawnewopen, drawctlread, invalidop).draw = draw;
	mkfile("/dev/hsys/" + id + "/mouse", undefined, mouseread, function(f, p) {respond(p, -1);}).draw = draw;
}

