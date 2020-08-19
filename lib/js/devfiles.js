mkdir("/dev");
mkfile("/dev/cons", undefined, function(f, p) { term.readterminal(p.count, function(l) {respond(p, l);}, p.tag); }, function(f, p) { term.writeterminal(p.data); respond(p, -1); });
mkfile("/dev/consctl", undefined, invalidop, function(f, p) {
		if(p.data.substr(0, 5) == "rawon") term.rawmode = true;
		if(p.data.substr(0, 6) == "rawoff") term.rawmode = false;
		respond(p, -1);
	}, function(f) {
		term.rawmode = false;
	});
mkfile("/dev/cpunote", undefined, function(f, p) { term.onnote.push(function(l) { respond(p, l);}); });
mkfile("/dev/js", function(f, p){ f.text = ""; }, undefined, function(f, p) { f.text += p.data; respond(p, -1); }, function(f, p) { try { eval(f.text); } catch (err) { console.log(''+err); } });
var starttime;
mkfile("/dev/bintime", undefined, function(f, p) {
	var now = Date.now();
	var cycles = now - starttime;
	var buf = new Uint8Array(24);
	var b = ltomp(now);
	var m = itomp(1000000);
	mpmul(b, m, b);
	mptober(b, buf, 0, 8);
	b = ltomp(cycles);
	mptober(b, buf, 8, 8);
	b = itomp(1000);
	mptober(b, buf, 16, 8);
	respond(p, arr2str(buf.slice(p.offset, p.offset + p.count)));
}, invalidop, undefined, function(f) { return 24; });
mkfile("/dev/time", undefined, function(f, p) {
	var now = Date.now();
	var cycles = "" + (now - starttime);
	var sec = "" + Math.floor(now / 1000);
	var nsec = now + "000000";
	var buf = "";
	var i;
	for (i = 11; i > sec.length; i--)
		buf += " ";
	buf += sec + " ";
	for (i = 21; i > nsec.length; i--)
		buf += " ";
	buf += nsec + " ";
	for (i = 21; i > cycles.length; i--)
		buf += " ";
	buf += cycles + " ";
	buf += "                 1000 ";
	respond(p, buf.substring(p.offset, p.offset + p.count));
}, invalidop, undefined, function(f) { return 78; });
mkfile("/dev/random", undefined, function(f, p) { respond(p, arr2str(chachabytes(p.count))) });
mkfile("/dev/zero", undefined, function(f, p) { respond(p, arr2str(new Uint8Array(p.count))) });
mkfile("/dev/null", undefined, function(f, p) { respond(p, "") }, function(f, p) { respond(p, -1) });
mkfile("/dev/user", undefined, function(f, p) { respond(p, username.substring(p.offset, p.offset+p.count)) });
mkfile("/dev/snarf", function(f) { f.text = "" }, function(f, p) {
	navigator.clipboard.readText().then(function(text) { respond(p, text.substring(p.offset, p.offset+p.count)) }).catch(function(err) { error9p(p.tag, err.message) });
}, function(f, p) {
	f.text = f.text.replaceAt(p.offset, p.data);
	navigator.clipboard.writeText(f.text).then(function() { respond(p, -1); }).catch(function(err) { error9p(p.tag, err.message); });
});
mkfile("/dev/osversion", undefined, function(f, p) { var ver = "2000"; respond(p, ver.substring(p.offset, p.offset+p.count)) });

mkfile("/dev/download", function(f, p) {
	f.data = "";
}, undefined, function(f, p) {
	f.data = f.data.replaceAt(p.offset, p.data);
	respond(p, -1);
}, function(f) {
	var sep = f.data.indexOf("\n");
	if (sep == -1)
		return;
	var name = f.data.substring(0, sep);
	sep++;
	var data = f.data.substring(sep);
	var blob = new Blob([str2arr(data)], {type: "octet/stream"});
	var url = window.URL.createObjectURL(blob);
	var a = document.createElement("a");
	document.body.appendChild(a);
	a.href = url;
	a.download = name;
	a.click();
	window.URL.revokeObjectURL(url);
	document.body.removeChild(a);
});

mkfile("/dev/mp3", function(f, p) {
		try {
			f.context = new (window.AudioContext || window.webkitAudioContext)();
			f.queue = [];
			f.buffer = "";
		} catch(err) {
			return err.message;
		}
	}, undefined,
	function(f, p) {
		f.buffer += p.data;
		var l = f.buffer.length;
		if (l < 0x20000)
			l = 0;
		while (l > 0) {
			l = f.buffer.substring(0, l).lastIndexOf(String.fromCharCode(0xFF));
			if (l == -1 || (f.buffer.length > (l+1) && (f.buffer.charCodeAt(l+1) & 0xE0) == 0xE0))
				break;
		}
		if (l > 0) {
			f.context.decodeAudioData(str2arr(f.buffer.substring(0, l)).buffer).then(function(buffer) {
				var source = new AudioBufferSourceNode(f.context);
				source.buffer = buffer;
				source.connect(f.context.destination);
				source.prestart = function() {
					if (f.open)
						respond(p, -1);
					else if (f.queue.length == 1)
						source.onended = function() {
							f.context.close();
						}
				}
				source.onended = function() {
					f.queue.shift();
					if (f.queue.length == 0)
						return;
					f.queue[0].prestart();
					f.queue[0].start();
				}
				f.queue.push(source);
				if (f.queue.length == 1) {
					f.queue[0].prestart();
					f.queue[0].start();
				}
				f.buffer = f.buffer.substring(l);
			}).catch(function(err) {
				if (f.open)
					error9p(p.tag, err.message);
				f.buffer = "";
			});
		} else if (f.buffer.length >= 0x20000) {
			if (f.open)
				error9p(p.tag, "not valid mp3 data");
			f.buffer = "";
		} else if (f.open)
			respond(p, -1);
	},
	function(f, p) {
		if (f.buffer.length > 0) {
			f.context.decodeAudioData(str2arr(f.buffer).buffer).then(function(buffer) {
				var source = new AudioBufferSourceNode(f.context);
				source.buffer = buffer;
				source.connect(f.context.destination);
				source.prestart = function() { }
				source.onended = function() {
					f.context.close();
				}
				f.queue.push(source);
				if (f.queue.length == 1)
					f.queue[0].start();
			}).catch(function(err) {
				term.print(err + "\n");
			});
		}
		if (f.queue.length == 0)
			f.context.close();
	});
mkfile("/dev/screen", function(f) {
		f.data = "";
		f.ready = false;
		f.queue = [];
		try {
			var width = window.innerWidth;
			var height = window.innerHeight;
			var i, j;
			var a = ["x8r8g8b8", 0, 0, width, height];
			for (i in a) {
				a[i] = String(a[i]).substring(0, 11);
				if (a[i].length < 11)
					a[i] = Array(12 - a[i].length).join(' ') + a[i];
			}
			f.data = a.join(' ')+' ';
		} catch(e) {
			f.ready = true;
		}
		try {
			var css = getstylesheets();
			var html = clonehtml(document.body);
			var doc = document.implementation.createHTMLDocument('');
			doc.documentElement.setAttribute('xmlns', doc.documentElement.namespaceURI);
			doc.write("<style>" + css + "</style>");
			doc.write("<div style='position:absolute;left:0;top:0;width:100%;height:100%;" + document.body.attributes["style"].value + "'><div style='margin:10px;'>" + html + "</div></div>");
			var xml = (new XMLSerializer).serializeToString(doc.body);
			xml = xml.replace(/\#/g, "%23");
			var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">';
			svg += '<foreignObject width="100%" height="100%">' + xml + '</foreignObject>';
			svg += '</svg>';
			var img = document.createElement('img');
			img.onerror = function(e) {
				console.log(e.toString());
				f.ready = true;
				while(f.queue.length > 0)
					readstr(f.queue.shift(), f.data);
			}
			img.onload = function () {
				var canvas = document.createElement("canvas");
				canvas.width = width;
				canvas.height = height;
				var ctx = canvas.getContext("2d");
				ctx.drawImage(img, 0, 0);
				var d = ctx.getImageData(0, 0, width, height).data;
				var b = zerobytes(width * 4);
				for (i = 0; i < height; i++) {
					for (j = 0; j < width; j++) {
						b[j * 4 + 0] = d[(i * width + j) * 4 + 2];
						b[j * 4 + 1] = d[(i * width + j) * 4 + 1];
						b[j * 4 + 2] = d[(i * width + j) * 4 + 0];
						b[j * 4 + 3] = d[(i * width + j) * 4 + 3];
					}
					f.data += arr2str(b);
				}
				f.ready = true;
				while(f.queue.length > 0)
					readstr(f.queue.shift(), f.data);
			}
			img.src = 'data:image/svg+xml;charset=utf-8,' + svg;
		} catch(e) {
			console.log(e.toString());
			f.ready = true;
			while(f.queue.length > 0)
				readstr(f.queue.shift(), f.data);
		}
	},
	function(f, p) {
		if (f.ready == false)
			f.queue.push(p);
		else
			readstr(p, f.data);
	});
mkfile("/dev/cursor", undefined, invalidop, function(f, p) { respond(p, -1); });
const kbmap = {
	Enter: '\n',
	Alt: '\uf015',
	Shift: '\uf016',
	Control: '\uf017',
	End: '\uf018',
	Home: '\uf00d',
	ArrowUp: '\uf00e',
	ArrowDown: '\uf800',
	ArrowLeft: '\uf011',
	ArrowRight: '\uf012',
	PageDown: '\uf013',
	Insert: '\uf014',
	Delete: '\u007f',
	PageUp: '\uf00f',
	Backspace: '\b',
	Tab: '\t',
	Escape: '\u001b',
	Minus: '-',
	Equal: '=',
	BracketLeft: '[',
	BracketRight: ']',
	Semicolon: ';',
	Quote: '\'',
	Backquote: '`',
	Backslash: '\\',
	Comma: ',',
	Period: '.',
	Slash: '/',
};

mkdir("/kbdfs");
function mkkbd(div) {
	var kbqueue = [];
	var kbreaders = [];

	mkdir("/kbdfs/" + div.id);
	var file = mkfile("/kbdfs/" + div.id + "/kbd", undefined, function(f, p) {
			if (kbqueue.length == 0)
				kbreaders.push(function() { respond(p, kbqueue.shift().substring(0, p.count)); });
			else
				respond(p, kbqueue.shift().substring(0, p.count));
		});

	file.writestr = function(s) {
		var i, m;
		for (i = 0; i < s.length; i++) {
			m = toutf8(s.substring(i, i+1));
			kbinput('r' + m + '\0');
			kbinput('R' + m + '\0');
		}
	}

	function kbinput(s) {
		kbqueue.push(s);
		if(kbreaders.length > 0)
			kbreaders.shift()();
	}

	file.kbinput = kbinput;

	function keymap(k){
		if(k.length == 1)
			return k;
		else if(k in kbmap)
			return toutf8(kbmap[k]);
		else
			return null;
	}

	file.onkeydown = function(event) {
		if (event.key == undefined) return;
		var m = keymap(event.key);
		if (m === null) return;
		if (event.ctrlKey && event.shiftKey) return;
		kbinput('r' + m + '\0');
//		event.preventDefault();
	}

	file.onkeyup = function(event) {
		if (event.key == undefined) return;
		var m = keymap(event.key);
		if (m === null) return;
		if (event.ctrlKey && event.shiftKey) return;
		kbinput('R' + m + '\0');
//		event.preventDefault();
	}

	div.oninput = function(event) {
		event.preventDefault();
	}
}
