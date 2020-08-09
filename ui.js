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

function startui() {
	window.dragging = false;
	window.resizing = false;
	window.windows = [];
	window.terminals = {};
	window.nwindows = 0;
	window.Nwindows = 0;

	document.onmousemove = function(event) {
		onmove(event.screenX, event.screenY);
	}

	document.ontouchmove = function(event) {
		onmove(event.touches[0].screenX, event.touches[0].screenY);
	}

	mkdir("/dev/hsys");
	mkfile("/dev/hsys/new", function(f, p) {
			var j;
			for (j = 0; win(j) != undefined; j++);
			f.window = newWindow(j, true);
			document.body.appendChild(f.window);
			f.window.terminal.focus();
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
}

function raiseWindow(id){
	for (var i = 0; i < window.windows.length; i++)
		if (window.windows[i].style.zIndex > win(id).style.zIndex)
			window.windows[i].style.zIndex--;

	win(id).style.zIndex = window.nwindows;
}

function dragStart(id, x, y) {
	var div = win(id);

	div.x = x;
	div.y = y;
	window.dragging = div;

	raiseWindow(id);
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

function newWindow(id, canclose) {
	var div = document.createElement('div');
	window.windows.push(div);
	window.nwindows++;
	window.Nwindows++;

	div.id = id;
	div.setAttribute('class', 'window');
	div.style.top = (window.nwindows * 10 + 10) + 'px';
	div.style.left = (window.nwindows * 10 + 10) + 'px';
	div.style.width = '640px';
	div.style.height = '480px';
	div.style.zIndex = window.nwindows;

	div.bg = document.createElement('div');
	div.bg.setAttribute('class', 'bg');

	div.titleBar = document.createElement('div');
	div.titleBar.div = div;
	div.titleBar.setAttribute('class', 'title');
	div.titleBar.innerHTML = '<span class="name">' + unescape(div.id) + '</span>';

	div.titleBar.onmousedown = function(event) {
		dragStart(id, event.screenX, event.screenY);
		
		event.preventDefault();
		return false;
	}

	div.titleBar.ontouchstart = function(event) {
		dragStart(id, event.touches[0].screenX, event.touches[0].screenY);

		event.preventDefault();
		return false;
	}

	div.onmousedown = function(event) {
		raiseWindow(id);
	}

	div.ontouchstart = function(event) {
		raiseWindow(id);
	}

	// avoid that trapping bug by using global not div.titleBar
	window.onmouseup = function(event) {
		window.dragging = false;

		if (window.resizing != false) {
			window.resizing.style.width = window.resizing.resizeDiv.style.width;
			window.resizing.style.height = window.resizing.resizeDiv.style.height;
			document.body.removeChild(window.resizing.resizeDiv);
			resizeCompute(window.resizing);
			window.resizing = false;
		}
	}

	window.ontouchend = window.onmouseup;

	var link = document.createElement('a');
	link.href = 'javascript:hideWindow(\'' + escape(id) + '\')';
	link.id = div.id + 'vis';

	var span = document.createElement('span');
	span.setAttribute('class', 'button');
	span.style.float = 'right';
	span.innerHTML = '<strong>&darr;</strong>';

	link.appendChild(span);
	div.titleBar.appendChild(link);

	if (canclose) {
		link = document.createElement('a');
		link.href = 'javascript:closeWindow(\'' + escape(id) + '\')';

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

	if (window.terminals[id] == undefined) {
		div.terminal = newTerminal();
		window.terminals[id] = div.terminal;

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
		mkfile("/dev/hsys/" + id + "/consctl", undefined, invalidop, function(f, p) {
				try {
					if(p.data.substr(0, 5) == "rawon")
						window.terminals[id].rawmode = true;
					else if(p.data.substr(0, 6) == "rawoff")
						window.terminals[id].rawmode = false;
					respond(p, -1);
				} catch(err) {
					error9p(p.tag, err.message);
				}
			},
			function(f) {
				try {
					window.terminals[i].rawmode = false;
				} catch(err) {
					error9p(p.tag, err.message);
				}
			});
		mkfile("/dev/hsys/" + id + "/cpunote", undefined, function(f, p) {
				window.terminals[id].onnote.push(function(l) {
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
i				} catch(err) {
					error9p(p.tag, err.message);
				}
			});
		mkfile("/dev/hsys/" + id + "/innerHTML", function(f) {
				try {
					f.text = win(id).bg.innerHTML;
					if (f.mode & 0x10)
						f.text = "";
				} catch(err) {
					return err.message;
				}
			},
			function(f, p) {
				try {
					var data = f.text;
					var runlen = f.text.length - p.offset;
					if (p.count > runlen) {
						p.count = runlen;
					}
					data = data.slice(p.offset, p.count);
					data = toutf8(data);
					respond(p, data);
				} catch(err) {
					error9p(p.tag, err.message);
				}
			},
			function(f, p) {
				try {
					var b = f.text.slice(0, p.offset);
					var a = f.text.slice(p.offset, f.text.length - 1);
					f.text = fromutf8(b + p.data + a);
					respond(p, p.data.length);
				} catch(err) {
					error9p(p.tag, err.message);
				}
			},
			function(f) {
				try {
					if (f.mode & 1) {
						win(id).bg.innerHTML = f.text;
					}
					oshow(id, f.text.length? false: true);
				} catch(err) {
				}
			});
		mkfile("/dev/hsys/" + id + "/opacity", undefined, undefined,
			function(f, p) {
				try {
					oset(id, p.data);
					respond(p, p.data.length);
				} catch(err) {
					error9p(p.tag, err.message);
				}
			});
	} else {
		div.terminal = window.terminals[id];
		div.terminal.value = "";
		div.terminal.consbuf = "";
		div.terminal.backlog = "";
		div.terminal.unread = "";
		div.terminal.online = [];
		div.terminal.onnote = [];
		div.terminal.rawmode = false;
		div.terminal.holdmode = false;
	}
	div.terminal.div = div;
	div.terminal.style.display = 'block';
	div.termhidden = false;

	div.appendChild(div.terminal);
	div.appendChild(div.bg);
	div.appendChild(div.titleBar);
	div.appendChild(div.bottom);

	resizeCompute(div);

	return div;
}

function closeWindow(id) {
	var win = document.getElementById(id);

	if (win != null) {
		win.terminal.note("hangup");
	//	rmfile("/dev/hsys/" + id + "/*");
	//	rmfile("/dev/hsys/" + id);
		document.body.removeChild(win);
		window.nwindows--;
	}
}

function hideWindow(id) {
	var div = win(id);
	var button = win(id + 'vis');

	div.oldheight = div.style.height;
	div.style.height = '1.2em';
	div.terminal.style.display = 'none';
	div.bg.style.display = 'none';
	div.bottom.style.display = 'none';
	div.resizeHandle.style.display = 'none';
	button.getElementsByTagName('span')[0].innerHTML = '<strong>&uarr;</strong>';
	button.href = 'javascript:showWindow(\'' + escape(id) + '\');';
}

function showWindow(id) {
	var div = win(id);
	var button = win(id + 'vis');

	div.style.height = div.oldheight;
	if (div.termhidden == false)
		div.terminal.style.display='block';
	div.resizeHandle.style.display = 'block';
	div.bg.style.display = 'block';
	div.bottom.style.display = 'block';
	button.getElementsByTagName('span')[0].innerHTML = '<strong>&darr;</strong>';
	button.href = 'javascript:hideWindow(\'' + escape(id) + '\');';
}

function resizeCompute(div) {
	var width = div.style.width.replace(/px$/, '');
	var height = div.style.height.replace(/px$/, '');

	div.titleBar.style.width = width + 'px';
	div.terminal.style.width = width + 'px';
	div.terminal.style.height = (height - 30) + 'px';
	div.bg.style.height = (height - 30) + 'px';
}
