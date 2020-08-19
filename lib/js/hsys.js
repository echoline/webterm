function onmove(nx, ny) {
	if (window.dragging != false) {
		var x = parseInt(window.dragging.style.left.replace('px', ''));
		var y = parseInt(window.dragging.style.top.replace('px', ''));
		var d;

		d = (nx - window.dragging.x);
		x += d;
		window.dragging.x = nx;

		d = (ny - window.dragging.y);
		if ((y + d) < 0) {
			window.dragging = false;
			return;
		}
		y += d;
		window.dragging.y = ny;

		window.dragging.style.top = y + 'px';
		window.dragging.style.left = x + 'px';
	} else if (window.resizing != false) {
		var dx = nx - window.resizing.x;
		var dy = ny - window.resizing.y;

		window.resizing.resizeDiv.style.width = (parseInt(window.resizing.resizeDiv.style.width.replace(/px$/, '')) + dx) + 'px';
		window.resizing.resizeDiv.style.height = (parseInt(window.resizing.resizeDiv.style.height.replace(/px$/, '')) + dy) + 'px';

		window.resizing.x = nx;
		window.resizing.y = ny;
	}
}

function setCurrent(div) {
	var old = current;
	if (!old)
		old = div;
	current = div;
	if (old !== current) {
		while (old.onwctlread.length > 0)
			old.onwctlread.shift()();
		while (current.onwctlread.length > 0)
			current.onwctlread.shift()();
	}
	if (current.termhidden)
		current.bg.focus();
	else {
		var top = current.terminal.scrollTop;
		current.terminal.focus();
		current.terminal.scrollTop = top;
	}
}

var onnewwindow = undefined;
var mouseevent = {clientX:0, clientY:0, button:0};
var mouse = ['m', 0, 0, 0, 0];
var onmouse = [];

function mousechange(k, f) {
	var n;
	var e = f.mouseevent;

	if (f.div && f.div.offsetLeft && f.div.offsetTop)
		f.mouse = ['m', e.clientX - f.div.offsetLeft, e.clientY - (f.div.offsetTop + 30), f.mouse[3], Date.now() - starttime];
	else
		f.mouse = ['m', e.clientX, e.clientY, f.mouse[3], Date.now() - starttime];
	if (f.mouse[2] < 0)
		return;
	switch(k){
	case 1: f.mouse[3] |= (1<<e.button); break;
	case 2: f.mouse[3] &= ~(1<<e.button); break;
	}
	n = f.onmouse.length;
	while(n--)
		f.onmouse.shift()();
}

function startui() {
	window.dragging = false;
	window.resizing = false;
	window.windows = [];
	window.terminals = {};
	window.nwindows = 0;
	window.current = null;

	document.onmousemove = function(event) {
		onmove(event.screenX, event.screenY);
		mouseevent.clientX = event.clientX;
		mouseevent.clientY = event.clientY;
		mousechange(0, window);
	}

	document.ontouchmove = function(event) {
		onmove(event.touches[0].screenX, event.touches[0].screenY);
		mouseevent.clientX = event.clientX;
		mouseevent.clientY = event.clientY;
		mousechange(0, window);
	}

	document.onmousedown = function(event) {
		mouseevent.button = event.button;
		mousechange(1, window);
	}

	document.onmouseup = function(event) {
		mouseevent.button = event.button;
		mousechange(2, window);
	}

	document.ontouchstart = function(event) {
		mouseevent.button = 1;
		mousechange(1, window);
	}

	document.ontouchend = function(event) {
		mouseevent.button = 1;
		mousechange(2, window);
	}

	window.resizeTimer = undefined;
	window.onresize = function(event) {
		if (resizeTimer)
			clearTimeout(resizeTimer);
		resizeTimer = setTimeout(function() {
				mouse = ['r', window.innerWidth, window.innerHeight, mouse[3], Date.now() - starttime];
				while(onmouse.length != 0)
					onmouse.shift()();
			}, 250);
	}

	window.onselect = function(event) {
		if (window.dragging)
			return false;			
	}

	mkdir("/dev/hsys");
	mkfile("/dev/hsys/new", function(f) {
			var j;
			for (j = 0; win(j) != undefined; j++);
			f.window = newWindow(j, true);
			document.body.appendChild(f.window);
			setCurrent(f.window);
			if (onnewwindow) {
				onnewwindow();
				onnewwindow = undefined;
			}
			devdraw(j);
		},
		function(f, p) {
			var data = '';
			if (p.offset == 0) {
				data += f.window.id;
				data = Array(12 - data.length).join(' ') + data + ' ';
			}
			respond(p, data);
		}, undefined,
		function(f) {
			closeWindow(f.window.id);
		});
	mkfile("/dev/mouse", undefined, function(f, p) {
			var s, i;
			if (f.mouse != mouse) {
				f.mouse = mouse;
				s = f.mouse.slice(1);
				for (i in s) {
					s[i] = String(s[i]).substring(0, 11);
					if(s[i].length < 11)
						s[i] = Array(12 - s[i].length).join(' ') + s[i];
				}
				s = f.mouse[0] + s.join(' ') + ' ';
				respond(p, s);
			} else {
				var l = onmouse.length;
				onflush(p.tag, function() { onmouse.splice(l, 1); });
				onmouse.push(function() { f.f.read(f, p); });
			}
		}, function(f, p) {respond(p, -1);});
}

function raiseWindow(id){
	var div = win(id);
	for (var i = 0; i < window.windows.length; i++)
		if (window.windows[i].style.zIndex > div.style.zIndex)
			window.windows[i].style.zIndex--;

	div.style.zIndex = window.nwindows;
}

function lowerWindow(id){
	var div = win(id);
	for (var i = 0; i < window.windows.length; i++)
		if (window.windows[i].style.zIndex < div.style.zIndex)
			window.windows[i].style.zIndex++;

	div.style.zIndex = 0;
}

function dragStart(id, x, y) {
	var div = win(id);

	div.x = x;
	div.y = y;
	window.dragging = div;

	raiseWindow(id);
	setCurrent(div);
}

function resizeStart(id, x, y) {
	window.resizing = win(id);
	window.resizing.x = x;
	window.resizing.y = y;

	var rdiv = document.createElement('div');
	window.resizing.resizeDiv = rdiv;

	rdiv.div = window.resizing;
	rdiv.setAttribute('class', 'resizeBox');
	rdiv.style.zIndex = rdiv.div.style.zIndex + 1;
	rdiv.style.position = 'absolute';
	rdiv.style.width = window.resizing.style.width;
	rdiv.style.height = window.resizing.style.height;
	rdiv.style.top = window.resizing.style.top;
	rdiv.style.left = window.resizing.style.left;

	document.body.appendChild(rdiv);
}

function parsenewwctl(data) {
	var line = 'hwin';
	var end = String.fromCharCode(13);
	var args = data.split(/\s+/);
	var i;
	for (i = 0; i < args.length; i++) {
		if (args[i] == '-cd' && i < (args.length-1)) {
			line = 'cd ' + args[++i] + ';' + line;
			end = ';cd' + end;
		} else if (args[i].charAt(0) != '-') {
			line += ' ' + args.slice(i).join(' ');
			i = args.length-1;
		} else if (args[i] == '-r')
			i += 4;
		else if (args[i] == '-dx' || args[i] == '-dy' ||
				args[i] == '-minx' || args[i] == '-miny' ||
				args[i] == '-maxx' || args[i] == '-maxy')
			i++;
	}
	if (i != args.length)
		throw "missing or bad wctl parameter";
	line += end;
	return line;
}

function parsewctl(div, op, data) {
	var args = data.split(/\s+/);
	var i;
	var minx = parseInt(div.style.left.replace(/px$/,''));
	var miny = parseInt(div.style.top.replace(/px$/,''));
	var width = parseInt(div.style.width.replace(/px$/,''));
	var height = parseInt(div.style.height.replace(/px$/,''));
	var maxx = minx + width;
	var maxy = miny + height;

	for (i = 0; i < args.length; i++) {
		if (args[i] == '-minx') {
			if(i >= (args.length-1))
				throw "missing or bad wctl parameter";
			minx = parseInt(args[++i]);
		} else if (args[i] == '-miny') {
			if(i >= (args.length-1))
				throw "missing or bad wctl parameter";
			miny = parseInt(args[++i]);
		} else if (args[i] == '-maxx') {
			if(i >= (args.length-1))
				throw "missing or bad wctl parameter";
			maxx = parseInt(args[++i]);
		} else if (args[i] == '-maxy') {
			if(i >= (args.length-1))
				throw "missing or bad wctl parameter";
			maxy = parseInt(args[++i]);
		} else if (args[i] == '-r') {
			if(i >= (args.length-4))
				throw "missing or bad wctl parameter";
			minx = parseInt(args[++i]);
			miny = parseInt(args[++i]);
			maxx = parseInt(args[++i]);
			maxy = parseInt(args[++i]);
		} else if (args[i] == '-dx') {
			if(i >= (args.length-1))
				throw "missing or bad wctl parameter";
			maxx = minx + parseInt(args[++i]);
		} else if (args[i] == '-dy') {
			if(i >= (args.length-1))
				throw "missing or bad wctl parameter";
			maxy = miny + parseInt(args[++i]);
		} else if (op != "new") {
			throw "extraneous text in wctl message";
		} else {
			if (args[i] == '-noscroll')
				div.terminal.scrollmode = false;
			else if (args[i] == '-scroll')
				div.terminal.scrollmode = true;
			else if (args[i] == '-hide')
				hideWindow(div.id);
		}
	}
	if (op != "new" && i != args.length)
		throw "missing or bad wctl parameter";
	if (op == "move") {
	 	div.style.left = minx + "px";
	 	div.style.top = miny + "px";
	}
	else {
		width = maxx - minx;
		height = maxy - miny;
	 	div.style.left = minx + "px";
	 	div.style.top = miny + "px";
	 	div.style.width = width + "px";
		if (!div.winhidden) {
		 	div.style.height = height + "px";
		} else {
		 	div.style.height = "1.2em";
			div.oldheight = height + "px";
		}
		resizeCompute(div);
	}
}

function getDisplayMedia(options) {
	if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
		return navigator.mediaDevices.getDisplayMedia(options)
	}
	if (navigator.getDisplayMedia) {
		return navigator.getDisplayMedia(options)
	}
	if (navigator.webkitGetDisplayMedia) {
		return navigator.webkitGetDisplayMedia(options)
	}
	if (navigator.mozGetDisplayMedia) {
		return navigator.mozGetDisplayMedia(options)
	}
	throw new Error('getDisplayMedia is not defined')
}

function getUserMedia(options) {
	if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
		return navigator.mediaDevices.getUserMedia(options);
	}
	if (navigator.getUserMedia) {
		return navigator.getUserMedia(options);
	}
	if (navigator.webkitGetUserMedia) {
		return navigator.webkitGetUserMedia(options);
	}
	if (navigator.mozGetUserMedia) {
		return navigator.mozGetUserMedia(options);
	}
	throw 'getUserMedia is not defined';
}

async function getscreenshotstream() {
	const width = screen.width * (window.devicePixelRatio || 1);
	const height = screen.height * (window.devicePixelRatio || 1);

	var stream = await getDisplayMedia({
		audio: false,
		video: {
			width,
			height,
			frameRate: 1,
		},
	});

/*	stream = await getUserMedia({
		audio: false,
		video: {
			mandatory: {
				chromeMediaSource: 'desktop',
				minWidth: width,
				maxWidth: width,
				minHeight: height,
				maxHeight: height,
			},
		},
	});*/

	return stream;
}

var screenshotstream;

async function screenshot(x1, y1, x2, y2) {
	if (!screenshotstream)
		screenshotstream = await getscreenshotstream();

	if (!screenshotstream)
		throw "no screenshot stream";

	const video = document.createElement('video');
	const result = await new Promise((resolve, reject) => {
		video.onloadedmetadata = function() {
			video.play();
			video.pause();

			const canvas = document.createElement('canvas');
			canvas.width = x2 - x1;
			canvas.height = y2 - y1;
			const context = canvas.getContext('2d');
			context.drawImage(video, 0, 0, canvas.width, canvas.height);

			resolve(canvas);
		}
		video.srcObject = screenshotstream;
	});

	screenshotstream.getTracks().forEach(function (track) {
		track.stop()
	});

	return result;
}

function getstylesheets() {
	var css = "";
	var sheet, rule;
	var i, j;

	for (i = 0; i < document.styleSheets.length; i++) {
		sheet = document.styleSheets[i];
		for (j = 0; j < sheet.cssRules.length; j++) {
			rule = sheet.cssRules[j];
			css += rule.cssText + " ";
		}
	}

	return css;
}

function clonehtml(element) {
	var i, j, child, attr, value, height;
	var html = "";

	for (i = 0; i < element.children.length; i++) {
		child = element.children[i];
		if (child.style.display == 'none')
			continue;

		if (child.nodeName == 'BR' || child.nodeName == 'HR') {
			html += "<" + child.nodeName.toLowerCase() + "/>";
			continue;
		}

		if (child.nodeName == 'CANVAS') {
			html += "<img style=\"width:" + child.width + "px;height:" + child.height + "px;\" src=\"" + child.toDataURL() + "\"></img>";
			continue;
		}

		html += "<" + child.nodeName.toLowerCase() + " "
		for (j = 0; j < child.attributes.length; j++) {
			attr = child.attributes[j];
			html += attr.name + "=\"" + attr.value + "\" ";
		}
		html += ">";

		if (child.nodeName == 'TEXTAREA')
			html += child.value;
		else if (child.children.length > 0)
			html += clonehtml(child);
		else
			html += child.innerHTML;

		html += "</" + child.nodeName.toLowerCase() + ">";
	}

	return html;
}

function newWindow(id, canclose) {
	var i;
	var div = document.createElement('div');
	windows.push(div);
	nwindows++;

	div.id = id;
	div.onmousemove = function(event) {
		try {
			f = lookupfile("/dev/hsys/" + div.id + "/mouse", 1);
			f.mouseevent.clientX = event.clientX;
			f.mouseevent.clientY = event.clientY;
			mousechange(0, f);
		} catch(e) {
		}
	}

	div.onmousedown = function(event) {
		try {
			f = lookupfile("/dev/hsys/" + div.id + "/mouse", 1);
			f.mouseevent.button = event.button;
			mousechange(1, f);
		} catch(e) {
		}
		raiseWindow(id);
		setCurrent(div);
	}

	div.onmouseup = function(event) {
		try {
			f = lookupfile("/dev/hsys/" + div.id + "/mouse", 1);
			f.mouseevent.button = event.button;
			mousechange(2, f);
		} catch(e) {
		}
	}

	div.terminal = newTerminal();
	div.terminal.onmouseenter = function(event) {
		setCurrent(div);
	}

	terminals[id] = div.terminal;

	div.bg = document.createElement('div');
	div.bg.div = div;
	div.bg.setAttribute('class', 'bg');
	div.bg.setAttribute('tabindex', '-1');
	div.bg.onmouseenter = function(event) {
		setCurrent(div);
	}

	mkdir("/dev/hsys/" + id);
	mkfile("/dev/hsys/" + id + "/cons", undefined, function(f, p) {
			try {
				respond(p, "");
			} catch(err) {
				error9p(p.tag, err.toString());
			}
		},
		function(f, p) {
			try {
				div.terminal.writecons(p.data);
				respond(p, -1);
			} catch (err) {
				error9p(p.tag, err.toString());
			}
		});
	mkfile("/dev/hsys/" + id + "/consctl", undefined, invalidop, function(f, p) {
			try {
				if(p.data.substr(0, 5) == "rawon")
					div.terminal.rawmode = true;
				else if(p.data.substr(0, 6) == "rawoff")
					div.terminal.rawmode = false;
				respond(p, -1);
			} catch(err) {
				error9p(p.tag, err.toString());
			}
		},
		function(f) {
			try {
				div.terminal.rawmode = false;
			} catch(err) {
				console.log(err.toString());
			}
		});
	mkfile("/dev/hsys/" + id + "/cpunote", undefined, function(f, p) {
			terminals[id].onnote.push(function(l) {
				respond(p, l);
			});
		});
	mkfile("/dev/hsys/" + id + "/label", undefined, function(f, p) {
			try {
				data = toutf8(div.titleBar.getElementsByClassName('name')[0].innerHTML);
				respond(p, data.substring(p.offset, p.offset+p.count));
			} catch(err) {
				error9p(p.tag, err.toString());
			}
		},
		function(f, p) {
			try {
				div.titleBar.getElementsByClassName('name')[0].innerHTML = fromutf8(p.data);
				respond(p, -1);
			} catch (err) {
				error9p(p.tag, err.toString());
			}
		});
	mkfile("/dev/hsys/" + id + "/winid", undefined, function(f, p) {
			var data = id.toString();
			data = Array(12 - data.length).join(' ') + data + ' ';
			respond(p, data.substring(p.offset, p.offset+p.count));
		});
	mkfile("/dev/hsys/" + id + "/text", undefined, function(f, p) {
			try {
				readstr(p, toutf8(terminals[id].value.slice(0, terminals[id].value.length - 2)));
			} catch(err) {
				error9p(p.tag, err.toString());
			}
		});
	div.onwctlread = [];
	div.wctlopen = false;
	mkfile("/dev/hsys/" + id + "/wctl", function(f) {
			if (div.wctlopen)
				return "file in use";
			div.wctlopen = true;
		},
		function(f, p) {
			try {
				div.onwctlread.push(function() {
					var i;
					var a = [div.style.left.replace(/px$/,''),
						div.style.top.replace(/px$/,''),
						(parseInt(div.style.left.replace(/px$/,''))+parseInt(div.style.width.replace(/px$/,'')))+'',
						(parseInt(div.style.top.replace(/px$/,''))+parseInt(div.style.height.replace(/px$/,'')))+'',
						current === div ? "current" : "notcurrent",
						div.winhidden ? "hidden" : "visible"];
					for (i in a) {
						a[i] = String(a[i]).substring(0, 11);
						if (a[i].length < 11)
							a[i] = Array(12 - a[i].length).join(' ') + a[i];
					}
					a = a.join(' ')+' ';
					respond(p, a);
				});
				if (p.offset == 0)
					div.onwctlread.shift()();
			} catch(err) {
				error9p(p.tag, err.toString());
			}
		},
		function(f, p) {
			try {
				var nl = p.data.indexOf("\n");
				var data;
				if (nl != -1)
					data = p.data.substring(0, nl);
				if (data.substring(0, 8) == "opacity ")
					oset(id, data.substring(8));
				else if (data.substring(0, 6) == "unhide")
					showWindow(div.id);
				else if (data.substring(0, 4) == "hide")
					hideWindow(div.id);
				else if (data.substring(0, 6) == "scroll")
					div.terminal.scrollmode = true;
				else if (data.substring(0, 8) == "noscroll")
					div.terminal.scrollmode = false;
				else if (data.substring(0, 6) == "delete")
					closeWindow(div.id);
				else if (data.substring(0, 6) == "bottom")
					lowerWindow(div.id);
				else if (data.substring(0, 3) == "top")
					raiseWindow(div.id);
				else if (data.substring(0, 7) == "current")
					setCurrent(div);
				else if (data.substring(0, 6) == "resize") {
					if (data.charAt(6) == ' ' || data.charAt(6) == '	') {
						parsewctl(div, "resize", data.substring(7));
					} else if (data.length > 6) {
						throw "extraneous text in wctl message";
					}
				} else if (data.substring(0, 4) == "move") {
					if (data.charAt(4) == ' ' || data.charAt(4) == '	') {
						parsewctl(div, "move", data.substring(5));
					} else if (data.length > 4) {
						throw "extraneous text in wctl message";
					}
				} else if (data.substring(0, 3) == "new") {
					if (data.charAt(3) == ' ' || data.charAt(3) == '	') {
						var line = parsenewwctl(data.substring(4));
						var i;
						for (i = 0; i < line.length; i++)
							term.addchar(line.charCodeAt(i));
						onnewwindow = function() {
							parsewctl(current, "new", data.substring(4));
						}
					} else if (data.length > 3) {
						throw "extraneous text in wctl message";
					}
				} else
					throw "unrecognized wctl command";
				respond(p, -1);
			} catch(err) {
				error9p(p.tag, err.toString());
			}
		},
		function(f) {
			div.wctlopen = false;
			div.onwctlread = [];
		});
	mkfile("/dev/hsys/" + id + "/window", function(f) {
			f.data = "";
			f.ready = false;
			f.queue = [];
			try {
				var left = parseInt(div.style.left.replace(/px$/,''));
				var top = parseInt(div.style.top.replace(/px$/,''));
				var width = parseInt(div.style.width.replace(/px$/,''));
				var height = parseInt(div.style.height.replace(/px$/,''));
				var i, j;
				var a = ["x8r8g8b8", left, top, left+width, top+height];
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
				var html = clonehtml(div);
				var doc = document.implementation.createHTMLDocument('');
				doc.documentElement.setAttribute('xmlns', doc.documentElement.namespaceURI);
				doc.write("<style>" + css + "</style>");
				doc.write("<div class=\"window\" style=\"top:0;left:-3px;\">" + html + "</div>");
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
	mkdir("/dev/hsys/" + id + "/dom");
	mkfile("/dev/hsys/" + id + "/innerHTML", function(f) {
			try {
				f.text = toutf8(div.bg.innerHTML);
				if (f.mode & 0x10)
					f.text = "";
			} catch(err) {
				return err.toString();
			}
		},
		function(f, p) {
			try {
				respond(p, f.text.substring(p.offset, p.offset+p.count));
			} catch(err) {
				error9p(p.tag, err.toString());
			}
		},
		function(f, p) {
			try {
				f.text = f.text.replaceAt(p.offset, p.data);
				respond(p, p.data.length);
			} catch(err) {
				error9p(p.tag, err.toString());
			}
		},
		function(f) {
			try {
				if (f.mode & 1) {
					div.bg.innerHTML = fromutf8(f.text);
					oshow(div.id, f.text.length? false: true);
					mkdir("/dev/hsys/" + id + "/dom");
					for (i = 0; i < div.bg.children.length; i++) {
						mkdir("/dev/hsys/" + div.id + "/dom/" + i);
						mkdomchildren("/dev/hsys/" + div.id + "/dom/" + i, div.bg.children[i]);
					}
				}
			} catch(err) {
			}
		}, function(f) { return div.bg.innerHTML.length });
	var f = mkfile("/dev/hsys/" + id + "/mouse", undefined, function(f, p) {
			var s, i;
			if (f.mouse != f.f.mouse) {
				f.mouse = f.f.mouse;
				s = f.mouse.slice(1);
				for (i in s) {
					s[i] = String(s[i]).substring(0, 11);
					if(s[i].length < 11)
						s[i] = Array(12 - s[i].length).join(' ') + s[i];
				}
				s = f.mouse[0] + s.join(' ') + ' ';
				respond(p, s);
			} else {
				var l = f.f.onmouse.length;
				onflush(p.tag, function() { f.f.onmouse.splice(l, 1); });
				f.f.onmouse.push(function() { f.f.read(f, p); });
			}
		}, function(f, p) {respond(p, -1);});
	mkfile("/dev/hsys/" + id + "/complete", function(f) {
			if (f.f.used)
				return "file in use";
			f.f.used = true;
			f.f.queue = [];
		}, function(f, p) {
			f.f.queue.push(p);
		},
		function(f, p) {
			try {
				var k = lookupfile("/kbdfs/" + id + "/kbd", 1);
				k.writestr(toutf8(p.data.substring(k.sofar)));
				respond(p, -1);
			} catch (e) {
				error9p(p, e.toString());
			}
		},
		function(f) {
			f.f.used = false;
			f.f.queue = [];
		});
	f.mouseevent = {clientX:0, clientY:0, button:0};
	f.mouse = ['m', 0, 0, 0, 0];
	f.onmouse = [];
	f.div = div;

	//mkdrawfiles(div);
	mkkbd(div);

	div.terminal.div = div;
	div.terminal.style.display = 'block';
	div.termhidden = false;

	div.setAttribute('class', 'window');
	div.style.top = (id * 10 + 30) + 'px';
	div.style.left = (id * 10 + 30) + 'px';
	div.style.width = '640px';
	div.style.height = '510px';
	div.style.zIndex = nwindows;
	div.style.display = 'block';
	div.winhidden = false;

	div.titleBar = document.createElement('div');
	div.titleBar.div = div;
	div.titleBar.setAttribute('class', 'title');
	div.titleBar.setAttribute('tabIndex', '-1');
	div.titleBar.onkeydown = function(event) {
		if (event.which == 46) {
			div.terminal.note("interrupt");
		}
	}
	div.titleBar.innerHTML = '<span class="name" style="user-select:none;">' + unescape(div.id) + '</span>';

	div.titleBar.onmousedown = function(event) {
		setCurrent(div);
		if (div.buttonclicking)
			return;
		dragStart(id, event.screenX, event.screenY);
	}

	div.titleBar.ontouchstart = function(event) {
		setCurrent(div);
		if (div.buttonclicking)
			return;
		dragStart(id, event.touches[0].screenX, event.touches[0].screenY);
	}

	div.ontouchstart = function(event) {
		try {
			f = lookupfile("/dev/hsys/" + div.id + "/mouse", 1);
			f.mouseevent.button = 1;
			mousechange(1, f);
		} catch(e) {
		}
		raiseWindow(id);
		setCurrent(div);
	}

	div.ontouchmove = function(event) {
		try {
			f = lookupfile("/dev/hsys/" + div.id + "/mouse", 1);
			f.mouseevent.clientX = event.touches[0].screenX;
			f.mouseevent.clientY = event.touches[0].screenY;
			mousechange(0, f);
		} catch(e) {
		}
	}

	// avoid that trapping bug by using global not div.titleBar
	window.onmouseup = function(event) {
		if (current && current.buttonclicking)
			current.buttonclicking = false;

		if (window.dragging != false) {
			if (window.dragging.onwctlread.length > 0)
				window.dragging.onwctlread.shift()();
			window.dragging = false;
		}

		if (window.resizing != false) {
			window.resizing.style.width = window.resizing.resizeDiv.style.width;
			window.resizing.style.height = window.resizing.resizeDiv.style.height;
			document.body.removeChild(window.resizing.resizeDiv);
			resizeCompute(window.resizing);
			if (window.resizing.onwctlread.length > 0)
				window.resizing.onwctlread.shift()();
			window.resizing = false;
		}
	}

	window.ontouchend = window.onmouseup;

	window.onselect = function(event) {
		if (window.dragging) {
			event.preventDefault();
			return false;
		}
	}

	var link = document.createElement('a');
	link.ontouchstart = link.onmousedown = function(event) {
		div.buttonclicking = true;
	}
	link.href = 'javascript:hideWindow(\'' + escape(id) + '\');';
	link.id = div.id + 'vis';

	var span = document.createElement('span');
	span.setAttribute('class', 'button');
	span.style.float = 'right';
	span.innerHTML = '<strong>&darr;</strong>';

	link.appendChild(span);
	div.titleBar.appendChild(link);

	if (canclose) {
		link = document.createElement('a');
		link.ontouchstart = link.onmousedown = function(event) {
			div.buttonclicking = true;
		}
		link.href = 'javascript:closeWindow(\'' + escape(id) + '\');';

		span = document.createElement('span');
		span.setAttribute('class', 'button');
		span.style.float = 'right';
		span.innerHTML = '<strong>x</strong>';

		link.appendChild(span);
		div.titleBar.appendChild(link);
	}

	div.resizeHandle = document.createElement('div');
	div.resizeHandle.div = div;
	div.resizeHandle.setAttribute('class', 'resizer');
	div.resizeHandle.onmousedown = function(event) {
		resizeStart(id, event.screenX, event.screenY);

		event.preventDefault();
		return false;
	}
	div.resizeHandle.ontouchstart = function(event) {
		resizeStart(id, event.touches[0].screenX, event.touches[0].screenY);

		event.preventDefault();
		return false;
	}

	div.bottom = document.createElement('div');
	div.bottom.setAttribute('class', 'bottom');
	div.bottom.appendChild(div.resizeHandle);

	div.appendChild(div.terminal);
	div.appendChild(div.bg);
	div.appendChild(div.titleBar);
	div.appendChild(div.bottom);

	resizeCompute(div);

	return div;
}

function closeWindow(id) {
	var w = document.getElementById(id);

	if (w != null) {
		w.terminal.note("hangup");
		document.body.removeChild(w);
		nwindows--;
	}
}

function hideWindow(id) {
	var div = win(id);
	var button = win(id + 'vis');

	div.winhidden = true;
	div.oldheight = div.style.height;
	div.style.height = '1.2em';
	div.terminal.style.display = 'none';
	div.bg.style.display = 'none';
	div.bottom.style.display = 'none';
	div.resizeHandle.style.display = 'none';
	resizeCompute(div);
	button.getElementsByTagName('span')[0].innerHTML = '<strong>&uarr;</strong>';
	button.href = 'javascript:showWindow(\'' + escape(id) + '\');';
	if (div.onwctlread.length > 0)
		div.onwctlread.shift()();
}

function showWindow(id) {
	var div = win(id);
	var button = win(id + 'vis');

	div.winhidden = false;
	div.style.height = div.oldheight;
	if (div.termhidden == false)
		div.terminal.style.display='block';
	div.resizeHandle.style.display = 'block';
	div.bg.style.display = 'block';
	div.bottom.style.display = 'block';
	resizeCompute(div);
	button.getElementsByTagName('span')[0].innerHTML = '<strong>&darr;</strong>';
	button.href = 'javascript:hideWindow(\'' + escape(id) + '\');';
	if (div.onwctlread.length > 0)
		div.onwctlread.shift()();
}

function resizeCompute(div) {
	var width = parseInt(div.style.width.replace(/px$/, ''));
	var height = parseInt(div.style.height.replace(/px$/, '')) - 30;
	var f;

	div.titleBar.style.width = width + 'px';
	div.terminal.style.width = width + 'px';
	div.terminal.style.height = height + 'px';
	div.bg.style.width = width + 'px';
	div.bg.style.height = height + 'px';

	try {
		f = lookupfile("/dev/hsys/" + div.id + "/mouse", 1);
		f.mouse = ['r', width, height, mouse[3], Date.now() - starttime];
		while(f.onmouse.length > 0)
			f.onmouse.shift()();
		f = lookupfile("/dev/hsys/" + div.id + "/draw", 1);
		f.resize(width, height);
	} catch(e) {
	}
}

function mkdomchildren(path, element) {
	var i;

	mkfile(path + "/innerHTML", function(f) {
			try {
				f.text = toutf8(element.innerHTML);
				if (f.mode & 0x10)
					f.text = "";
			} catch(err) {
				return err.toString();
			}
		},
		function(f, p) {
			try {
				respond(p, f.text.substring(p.offset, p.offset+p.count));
			} catch(err) {
				error9p(p.tag, err.toString());
			}
		},
		function(f, p) {
			try {
				f.text = f.text.replaceAt(p.offset, p.data);
				respond(p, p.data.length);
			} catch(err) {
				error9p(p.tag, err.toString());
			}
		},
		function(f) {
			try {
				if (f.mode & 1) {
					element.innerHTML = fromutf8(f.text);
					mkdomchildren(path, element);
				}
			} catch(err) {
			}
		}, function(f) { return element.innerHTML.length });

	mkfile(path + "/value", function(f) {
			try {
				f.text = toutf8(element.value);
				if (f.mode & 0x10)
					f.text = "";
			} catch(err) {
				return err.toString();
			}
		},
		function(f, p) {
			try {
				respond(p, f.text.substring(p.offset, p.offset+p.count));
			} catch(err) {
				error9p(p.tag, err.toString());
			}
		},
		function(f, p) {
			try {
				f.text = f.text.replaceAt(p.offset, p.data);
				respond(p, p.data.length);
			} catch(err) {
				error9p(p.tag, err.toString());
			}
		},
		function(f) {
			try {
				if (f.mode & 1) {
					element.value = fromutf8(f.text);
				}
			} catch(err) {
			}
		}, function() { try { return element.value.length; } catch(e) { return 0; } });

	mkfile(path + "/type", undefined, function(f, p) {
		respond(p, element.nodeName.substring(p.offset, p.offset+p.count));
	});

	mkdir(path + "/attributes");
	for (i = 0; i < element.attributes.length; i++) {
		var name = element.attributes[i].name;
		var f = mkfile(path + "/attributes/" + name, function(f) {
			f.value = f.f.element.attributes[f.f.name].value;
			if (f.mode & 0x10)
				f.value = "";
		}, function(f, p) {
			respond(p, f.value.substring(p.offset, p.offset + p.count));
		}, function(f, p) {
			f.value = f.value.replaceAt(p.offset, p.data);
			respond(p, -1);
		}, function(f) {
			f.f.element.setAttribute(f.f.name, f.value);
		}, function(f) { try { return f.element.attributes[f.name].value.length } catch(e) { return 0; } });
		f.element = element;
	}

	mkdir(path + "/children");
	for (i = 0; i < element.children.length; i++) {
		mkdir(path + "/children/" + i);
		mkdomchildren(path + "/children/" + i, element.children[i]);
	}
}

