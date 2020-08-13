mkdir("/dev");
mkfile("/dev/cons", undefined, function(f, p) { term.readterminal(p.count, function(l) {respond(p, l);}, p.tag); }, function(f, p) { term.writeterminal(p.data); respond(p, -1); });
mkfile("/dev/consctl", undefined, invalidop, function(f, p) { if(p.data.substr(0, 5) == "rawon") rawmode = true; if(p.data.substr(0, 5) == "rawoff") rawmode = false; respond(p, -1); }, function(f) { rawmode = false; });
mkfile("/dev/cpunote", undefined, function(f, p) { term.onnote.push(function(l) { respond(p, l);}); });
mkfile("/dev/js", function(f, p){ f.text = ""; }, undefined, function(f, p) { f.text += p.data; respond(p, -1); }, function(f, p) { eval(f.text); });
var starttime;
mkfile("/dev/bintime", undefined, function(f, p) {
	var now = Date.now();
	var cycles = now - starttime;
	var buf = new Uint8Array(24);
	var b = itomp(now);
	var m = itomp(1000000);
	mpmul(b, m, b);
	mptober(b, buf, 0, 8);
	b = itomp(cycles);
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

