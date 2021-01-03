mkdir("/dev");
mkfile("/dev/cons", undefined, function(f, p) {
		if (term.unread != "") {
			respond(p, term.unread.substring(0, p.count));
			term.unread = term.unread.substring(p.count);
		} else {
			var l = term.online.length;
			onflush(p.tag, function() { term.online.splice(l, 1); });
			term.online.push(function() {
				respond(p, term.unread.substring(0, p.count));
				term.unread = term.unread.substring(p.count);
			});
		}
	}, function(f, p) {
		term.writeterminal(p.data);
		respond(p, -1);
	});
mkfile("/dev/consctl", undefined, invalidop, function(f, p) {
		if(p.data.substr(0, 5) == "rawon") term.rawmode = true;
		if(p.data.substr(0, 6) == "rawoff") term.rawmode = false;
		respond(p, -1);
	}, function(f) {
		term.rawmode = false;
	});
mkfile("/dev/js", function(f, p){ f.text = ""; }, undefined, function(f, p) { f.text += p.data; respond(p, -1); }, function(f, p) { try { eval(f.text); } catch (err) { console.log(''+err); } });
var starttime;
mkfile("/dev/snarf", function(f) { f.text = "" }, function(f, p) {
	navigator.clipboard.readText().then(function(text) { respond(p, text.substring(p.offset, p.offset+p.count)) }).catch(function(err) { error9p(p.tag, err.message) });
}, function(f, p) {
	f.text = f.text.replaceAt(p.offset, p.data);
	navigator.clipboard.writeText(f.text).then(function() { respond(p, -1); }).catch(function(err) { error9p(p.tag, err.message); });
});

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
			return err.toString();
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
	function(f) {
		if (f.buffer.length > 0) {
			f.context.decodeAudioData(str2arr(f.buffer).buffer).then(function(buffer) {
				if (!f.open)
					return;
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
var cursor = null;
const cursorfmt = ["i2:reserved","i2:img_type","i2:img_num","i1:width","i1:height","i1:colors","i1:reserved","i2:hotspot_x","i2:hotspot_y","i4:size","i4:offset","i4:bmp_header_size","i4:bmp_width","i4:bmp_height","i2:bmp_planes","i2:bmp_bpp","i4:bmp_comp","i4:bmp_size","i4:bmp_hres","i4:bmp_vres","i4:bmp_colors","i4:bmp_important","i4:col0","i4:col1","b64:xor","b64:and"];
mkfile("/dev/cursor", undefined, function(f, p) {
		if (cursor)
			readstr(p, cursor);
		else
			error9p(p.tag, "no cursor");
	}, function(f, p) {
		if (p.data.length < 72) {
			cursor = null;
			document.body.style.cursor = '';
		} else {
			cursor = p.data;
			var data = unpack(p.data, ["i4:x","i4:y","b32:clr","b32:set"]);
			var clr = str2arr(data.clr);
			var set = str2arr(data.set);
			var cur = {
				reserved: 0,
				img_type: 2,
				img_num: 1,
				width: 16,
				height: 16,
				colors: 2,
				reserved2: 0,
				hotspot_x: -data.x,
				hotspot_y: -data.y,
				size: 176,
				offset: 22,
				bmp_header_size: 40,
				bmp_width: 16,
				bmp_height: 32,
				bmp_planes: 1,
				bmp_bpp: 1,
				bmp_comp: 0,
				bmp_size: 32,
				bmp_hres: 0,
				bmp_vres: 0,
				bmp_colors: 2,
				bmp_important: 0,
				col0: 0x00000000,
				col1: 0xffffffff
			}
			var xor = new Uint8Array(64);
			var and = new Uint8Array(64);
			for (var i = 0; i < 16; i++) {
				xor[4*i] = ~set[30-2*i];
				xor[4*i+1] = ~set[31-2*i];
				and[4*i] = ~(clr[30-2*i] | set[30-2*i]);
				and[4*i+1] = ~(clr[31-2*i] | set[31-2*i]);
			}
			cur.xor = arr2str(xor);
			cur.and = arr2str(and);
			data = btoa(pack(cur, cursorfmt));
			document.body.style.cursor = 'url(data:image/x-icon;base64,' + data + '),auto';
		}
		respond(p, -1);
	});
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
			return toutf8(k);
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
		event.preventDefault();
	}

	file.onkeyup = function(event) {
		if (event.key == undefined) return;
		var m = keymap(event.key);
		if (m === null) return;
		if (event.ctrlKey && event.shiftKey) return;
		kbinput('R' + m + '\0');
		event.preventDefault();
	}

	div.oninput = function(event) {
		event.preventDefault();
	}

	div.onpaste = function(event) {
		var cd = event.clipboardData || event.originalEvent.clipboardData || window.clipboardData;
		var data = cd.getData('text');
		for (i = 0; i < data.length; i++) {
			var key = data.charAt(i);
			var m = keymap(key);
			if (m === null) continue;
			if (event.ctrlKey && event.shiftKey) continue;
			kbinput('r' + m + '\0');
			kbinput('R' + m + '\0');
		}
		event.preventDefault();
		return false;
	}
}
