function newTerminal() {
	var ta = document.createElement('textarea');

	ta.setAttribute('class', 'terminal');
	ta.setAttribute('spellcheck', 'false');
	ta.style.width='100%';
	ta.style.height='100%';

	ta.onkeydown = function(event) {
		if (event.which == 46) {
			this.note("interrupt");
			this.backlog += this.consbuf;
			this.consbuf = "";
			this.writeterminal("");
			return false;
		} else if (event.ctrlKey && (event.which|32) == 102) {
			try {
				var f = lookupfile("/dev/hsys/" + this.div.id + "/complete", 1);
				if (f.queue && f.queue.length > 0) {
					var i = this.backlog.lastIndexOf(' ');
					i++;
					if (i < this.backlog.length) {
						var j;
						var k = lookupfile("/kbdfs/" + this.div.id + "/kbd", 1);
						k.writestr("\uf017");
						k.sofar = this.backlog.length - i;
						var p = f.queue.shift();
						respond(p, this.backlog.substring(i, i+p.count));
					}
				}
			} catch(e) {
				console.log(e + "");
			}
			return false;
		}
		var f = lookupfile("/kbdfs/" + this.div.id + "/kbd", 1);
		f.onkeydown(event);
		return false;
	}

	ta.onkeyup = function(event) {
		var f = lookupfile("/kbdfs/" + this.div.id + "/kbd", 1);
		f.onkeyup(event);
		return false;
	}

	ta.consbuf = "";
	ta.unread = "";
	ta.backlog = "";
	ta.online = [];
	ta.onnote = [];
	ta.rawmode = false;
	ta.holdmode = false;
	ta.scrollmode = true;

	ta.writeterminal = function(msg) {
		this.backlog += msg;
		this.redraw();
	}

	ta.redraw = function() {
		this.value = fromutf8(this.backlog + this.consbuf) + "\u2588";
		if (this.scrollmode)
			this.scrollTop = this.scrollHeight;
	}

	ta.writecons = function(msg) {
		var i;
		var re = /(?![\x00-\x7F]|[\xC0-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}|[\xF0-\xF7][\x80-\xBF]{3}){1}/g
		msg = msg.replace(re, '');
		msg = fromutf8(msg);
		while ((i = msg.indexOf('\b')) >= 0) {
			if (i == 0) {
				var log = fromutf8(this.backlog);
				log = log.slice(0, log.length-1);
				this.backlog = toutf8(log);
				msg = msg.slice(1);
			} else {
				msg = msg.slice(0, i) + msg.slice(i+1);
			}
		}
		this.backlog += toutf8(msg);
		this.redraw();
	}

	ta.print = function(msg) {
		this.writeterminal(toutf8(msg));
	}

	ta.note = function(s){
		while(this.onnote.length > 0)
			this.onnote.shift()(s);
	}

	ta.flush = function() {
		if(this.holdmode && !this.rawmode){
			this.writeterminal("");
			return;
		}
		this.unread += this.consbuf;
		if(!this.rawmode)
			this.backlog += this.consbuf;
		this.consbuf = "";
		this.writeterminal("");
		if(this.online.length > 0)
			this.online.shift()(this.consbuf);
		while(this.unread != "" && this.online.length > 0)
			this.online.shift()(this.consbuf);
	}

	ta.addchar = function(c){
		if(c == 127){
			this.note("interrupt");
			this.backlog += this.consbuf;
			this.consbuf = "";
			this.writeterminal("");
			if (this.holdmode)
				c = 27;
			else
				return;
		}
		if(c == 8){
			this.consbuf = this.consbuf.substring(0, this.consbuf.length - 1);
			this.writeterminal("");
			return;
		}
		if(c == 23){
			this.consbuf = this.consbuf.substring(0, this.consbuf.lastIndexOf(' '));
			this.writeterminal("");
			return;
		}
		if(c == 21){
			this.consbuf = this.consbuf.substring(0, this.consbuf.lastIndexOf('\n'));
			this.writeterminal("");
			return;
		}
		if(c == 4){
			this.flush();
			return;
		}
		if(c == 6){
			if (this.div) {
				try {
					var f = lookupfile("/dev/hsys/" + this.div.id + "/complete", 1);
					if (f.queue && f.queue.length > 0 && this.consbuf.length > 0) {
						var i = this.consbuf.lastIndexOf(' ');
						i++;
						if (i < this.consbuf.length)
							respond(f.queue.shift(), this.consbuf.substring(i, p.count));
					}
				} catch(e) {
					console.log(e + "");
				}
			}
			return;
		}
		if(c == 13){
			this.consbuf += "\n";
			this.flush();
			return;
		}
		if(c == 27){
			this.holdmode = !this.holdmode;
			if(this.holdmode){
				this.style.backgroundColor = 'black';
				this.style.color = 'white';
			} else {
				this.style.backgroundColor = 'white';
				this.style.color = 'black';
				if(this.consbuf != "")
					this.flush();
			}
			return;
		}
		this.consbuf += toutf8(String.fromCharCode(c));
		if(this.rawmode)
			this.flush();
		else
			this.writeterminal("");
	}

	ta.readterminal = function(c, f, t){
		var ta = this;
		if(this.unread != ""){
			f(this.unread.substring(0, c));
			this.unread = this.unread.substring(c);
		} else {
			if(t != undefined)
				var l = this.online.length;
			onflush(t, function() { ta.online.splice(l, 1); });
		}
		this.online.push(function() { f(ta.unread.substring(0, c)); ta.unread = ta.unread.substring(c); })
	}

	return ta;
}


