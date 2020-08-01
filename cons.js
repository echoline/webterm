function fromutf8(s) {
	return decodeURIComponent(escape(s));
}

function toutf8(s) {
	return unescape(encodeURIComponent(s));
}

function newTerminal() {
	var ta = document.createElement('textarea');

	ta.setAttribute('class', 'terminal');
	ta.setAttribute('spellcheck', 'false');
	//ta.setAttribute('readonly', 'readonly');
	ta.style.width='100%';
	ta.style.height='100%';
	ta.onkeypress=function(event) {this.addchar(event.which); event.preventDefault(); return false; };
	ta.onkeydown=function(event) {
		if(event.which == 46){
			this.addchar(127);
			return false;
		} else if(event.which >= 65 && event.which <= 91 && event.ctrlKey){
			this.addchar(event.which - 64);
			return false;
		} else if(event.which == 32 || event.which == 9 || event.which == 8 || event.which == 27) {
			this.addchar(event.which);
			return false;
		}
	}
	ta.onpaste = function(event) {
		var s = event.clipboardData.getData('text/plain');
		for (var i = 0; i < s.length; i++)
			this.addchar(s.charCodeAt(i));
		return false;
	}
	ta.oninput = function(event) {
		var s = event.data;
		for (var i = 0; i < s.length; i++)
			this.addchar(s.charCodeAt(i));
		return false;
	}


	ta.consbuf = "";
	ta.unread = "";
	ta.backlog = "";
	ta.online = [];
	ta.onnote = [];
	ta.rawmode = false;
	ta.holdmode = false;

	ta.writeterminal = function(msg) {
		this.backlog += msg;
		this.value = fromutf8(this.backlog + this.consbuf) + "\u2588";
		this.scrollTop = this.scrollHeight;
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


