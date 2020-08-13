function htmlentities(input) {
	return input.replace(/\&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function c(tagName) {
	return document.createElement(tagName);
}

function win(N) {
	return document.getElementById(N);
}

function n(e) {
	document.body.appendChild(e);
}

function oset(id, trans) {
	win(id).style.opacity = trans;
}

function oshow(id, boo) {
	win(id).termhidden = !boo;
	win(id).terminal.style.display = boo? 'block': 'none';
}

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
	var old = null;
	if (div === current)
		return;
	if (current && current.onwctlread.length > 0)
		old = current;
	current = div;
	if (old) {
		old.onwctlread.shift()();
	}
	if (current && current.onwctlread.length > 0)
		current.onwctlread.shift()();
	if (current.termhidden)
		current.bg.focus();
	else
		current.terminal.focus();
}

var onnewwindow = undefined;
var mouseevent = {clientX:0, clientY:0, button:0};
var mouse = ['m', 0, 0, 0, 0];
var onmouse = [];

function mousechange(k, e) {
	var n;

	mouse = ['m', e.clientX, e.clientY, mouse[3], Date.now() - starttime];
	switch(k){
	case 1: mouse[3] |= (1<<e.button); break;
	case 2: mouse[3] &= ~(1<<e.button); break;
	}
	n = onmouse.length;
	while(n--)
		onmouse.shift()();
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
		mousechange(0, mouseevent);
	}

	document.ontouchmove = function(event) {
		onmove(event.touches[0].screenX, event.touches[0].screenY);
		mouseevent.clientX = event.clientX;
		mouseevent.clientY = event.clientY;
		mousechange(0, mouseevent);
	}

	document.onmousedown = function(event) {
		mouseevent.button = event.button;
		mousechange(1, mouseevent);
	}

	document.onmouseup = function(event) {
		mouseevent.button = event.button;
		mousechange(2, mouseevent);
	}

	mkdir("/dev/hsys");
	mkfile("/dev/hsys/new", function(f, p) {
			var j;
			for (j = 0; win(j) != undefined; j++);
			f.window = newWindow(j, true);
			document.body.appendChild(f.window);
			setCurrent(f.window);
			if (onnewwindow) {
				onnewwindow();
				onnewwindow = undefined;
			}
		},
		function(f, p) {
			var data = '';
			p.count = 0;
			if (p.offset == 0) {
				data = fromutf8(f.window.id);
				p.count = data.length;
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
			break;
		} else if (args[i] == '-r')
			i += 4;
		else
			i++;
	}
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

	for (i = 0; i < args.length-1; i++) {
		if (args[i] == '-minx')
			minx = parseInt(args[++i]);
		else if (args[i] == '-miny')
			miny = parseInt(args[++i]);
		else if (args[i] == '-maxx')
			maxx = parseInt(args[++i]);
		else if (args[i] == '-maxy')
			maxy = parseInt(args[++i]);
		else if (args[i] == '-r') {
			if(i >= (args.length-4))
				throw "missing or bad wctl parameter";
			minx = parseInt(args[++i]);
			miny = parseInt(args[++i]);
			maxx = parseInt(args[++i]);
			maxy = parseInt(args[++i]);
		}
		else if (args[i] == '-dx')
			maxx = minx + parseInt(args[++i]);
		else if (args[i] == '-dy')
			maxy = miny + parseInt(args[++i]);
		else if (op != "new")
			throw "extraneous text in wctl message";
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
	 	div.style.height = height + "px";
		resizeCompute(div);
	}
}

function newWindow(id, canclose) {
	var i;
	var div = document.createElement('div');
	windows.push(div);
	nwindows++;

	div.id = id;
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
	div.bg.onkeydown = function(event) {
		if (event.which == 46)
			div.terminal.onkeydown(event);
	}

	mkdir("/dev/hsys/" + id);
	mkfile("/dev/hsys/" + id + "/cons", undefined, function(f, p) {
			try {
				window.terminals[id].readterminal(p.count, function(l) {
					respond(p, l);
				}, p.tag);
			} catch(err) {
				error9p(p.tag, err.message);
			}
		},
		function(f, p) {
			try {
				window.terminals[id].writeterminal(p.data); respond(p, -1);
			} catch (err) {
				error9p(p.tag, err.message);
			}
		});
	mkfile("/dev/hsys/" + id + "/consctl", undefined, undefined, function(f, p) {
			try {
				if(p.data.substr(0, 5) == "rawon")
					terminals[id].rawmode = true;
				else if(p.data.substr(0, 6) == "rawoff")
					terminals[id].rawmode = false;
				respond(p, -1);
			} catch(err) {
				error9p(p.tag, err.message);
			}
		},
		function(f) {
			try {
				terminals[i].rawmode = false;
			} catch(err) {
				error9p(p.tag, err.message);
			}
		});
	mkfile("/dev/hsys/" + id + "/cpunote", undefined, function(f, p) {
			terminals[id].onnote.push(function(l) {
				respond(p, l);
			});
		});
	mkfile("/dev/hsys/" + id + "/label", undefined, function(f, p) {
			try {
				var data = '';
				p.count = 0;
				if (p.offset == 0) {
					data = win(id).titleBar.getElementsByClassName('name')[0].innerHTML;
					p.count = data.length;
				}
				respond(p, data);
			} catch(err) {
				error9p(p.tag, err.message);
			}
		},
		function(f, p) {
			try {
				win(id).titleBar.getElementsByClassName('name')[0].innerHTML = fromutf8(p.data);
				respond(p, -1);
			} catch (err) {
				error9p(p.tag, err.message);
			}
		});
	mkfile("/dev/hsys/" + id + "/winid", undefined, function(f, p) {
			var data = '';
			p.count = 0;
			if (p.offset == 0) {
				data += id;
				p.count = data.length;
			}
			respond(p, data);
		});
	mkfile("/dev/hsys/" + id + "/text", function(f, p) {
			try {
				f.text = window.terminals[id].value.slice(0, window.terminals[id].value.length - 2);
			} catch(err) {
				return err.message;
			}
		},
		function(f, p) {
			try {
				var data = f.text;
				var runlen = f.text.length - p.offset;
				if (p.count > runlen)
					p.count = runlen;
				data = data.slice(p.offset, p.count);
				data = toutf8(data);
				respond(p, data);
i			} catch(err) {
				error9p(p.tag, err.message);
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
				error9p(p.tag, err.message);
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
				error9p(p.tag, err + "");
			}
		},
		function(f) {
			div.wctlopen = false;
			div.onwctlread = [];
		});
	mkdir("/dev/hsys/" + id + "/dom");
	mkfile("/dev/hsys/" + id + "/innerHTML", function(f) {
			try {
				f.text = div.bg.innerHTML;
				if (f.mode & 0x10)
					f.text = "";
			} catch(err) {
				return err.message;
			}
		},
		function(f, p) {
			try {
				respond(p, f.text.substring(p.offset, p.offset+p.count));
			} catch(err) {
				error9p(p.tag, err.message);
			}
		},
		function(f, p) {
			try {
				f.text = f.text.replaceAt(p.offset, p.data);
				respond(p, p.data.length);
			} catch(err) {
				error9p(p.tag, err.message);
			}
		},
		function(f) {
			try {
				if (f.mode & 1) {
					div.bg.innerHTML = f.text;
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
	div.titleBar.innerHTML = '<span class="name" style="user-select:none;">' + unescape(div.id) + '</span>';

	div.titleBar.onkeydown = function(event) {
		if (event.which == 46)
			div.terminal.addchar(127);
	}

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

	div.onmousedown = function(event) {
		raiseWindow(id);
		setCurrent(div);
	}

	div.ontouchstart = function(event) {
		raiseWindow(id);
		setCurrent(div);
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
	button.getElementsByTagName('span')[0].innerHTML = '<strong>&darr;</strong>';
	button.href = 'javascript:hideWindow(\'' + escape(id) + '\');';
	if (div.onwctlread.length > 0)
		div.onwctlread.shift()();
}

function resizeCompute(div) {
	var width = div.style.width.replace(/px$/, '');
	var height = div.style.height.replace(/px$/, '') - 30;
	var f, n;

	div.titleBar.style.width = width + 'px';
	div.terminal.style.width = width + 'px';
	div.terminal.style.height = height + 'px';
	div.bg.style.width = width + 'px';
	div.bg.style.height = height + 'px';

	try {
		f = lookupfile("/dev/hsys/" + div.id + "/draw/new", 1);
		if (f.draw.nctl > 0) {
			f.draw.canvas.height = height;
			f.draw.canvas.width = width;
			f.draw.disp.r[2] = width;
			f.draw.disp.r[3] = height;
			f.draw.disp.clipr = f.draw.disp.r;
			f.draw.mouse = ['r', width, height, 0, new Date().getTime() - f.draw.starttime];
			while(f.draw.onmouse.length != 0)
				f.draw.onmouse.shift()();
		}
	} catch(e) {
	}
}

function mkdomchildren(path, element) {
	var i;

	mkfile(path + "/innerHTML", function(f) {
			try {
				f.text = element.innerHTML;
				if (f.mode & 0x10)
					f.text = "";
			} catch(err) {
				return err.message;
			}
		},
		function(f, p) {
			try {
				respond(p, f.text.substring(p.offset, p.offset+p.count));
			} catch(err) {
				error9p(p.tag, err.message);
			}
		},
		function(f, p) {
			try {
				f.text = f.text.replaceAt(p.offset, p.data);
				respond(p, p.data.length);
			} catch(err) {
				error9p(p.tag, err.message);
			}
		},
		function(f) {
			try {
				if (f.mode & 1) {
					element.innerHTML = f.text;
					mkdomchildren(path, element);
				}
			} catch(err) {
			}
		}, function(f) { return element.innerHTML.length });

	mkfile(path + "/value", function(f) {
			try {
				f.text = element.value;
				if (f.mode & 0x10)
					f.text = "";
			} catch(err) {
				return err.message;
			}
		},
		function(f, p) {
			try {
				respond(p, f.text.substring(p.offset, p.offset+p.count));
			} catch(err) {
				error9p(p.tag, err.message);
			}
		},
		function(f, p) {
			try {
				f.text = f.text.replaceAt(p.offset, p.data);
				respond(p, p.data.length);
			} catch(err) {
				error9p(p.tag, err.message);
			}
		},
		function(f) {
			try {
				if (f.mode & 1) {
					element.value = f.text;
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

