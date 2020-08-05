function newTerminal() {
	var ta = document.createElement('textarea');

	ta.setAttribute('class', 'terminal');
	ta.setAttribute('spellcheck', 'false');
//	ta.setAttribute('readonly', 'readonly');
	ta.style.width='100%';
	ta.style.height='100%';
//	ta.onkeypress=function(event) {ta.addchar(event.which); event.preventDefault(); return false; };
	ta.onkeydown=function(event) {
		if(event.which == 46){
			ta.addchar(127);
			return false;
//		} else if(event.which >= 65 && event.which <= 91 && event.ctrlKey){
//			ta.addchar(event.which - 64);
//			return false;
//		} else if(event.which == 32 || event.which == 9 || event.which == 8 || event.which == 27) {
//			ta.addchar(event.which);
//			return false;
		}
	}
	ta.onpaste = function(event) {
		var s = event.clipboardData.getData('text/plain');
		for (var i = 0; i < s.length; i++)
			ta.addchar(s.charCodeAt(i));
		return false;
	}
	ta.oninput = function(event) {
		if (event.inputType == 'deleteContentBackward') {
			ta.addchar(8);
		} else if (event.inputType == 'insertText') {
			var s = event.data;
			for (var i = 0; i < s.length; i++)
				ta.addchar(s.charCodeAt(i));
		} else if (event.inputType == 'insertLineBreak') {
			ta.addchar(10);
		} else {
			alert(event.inputType);
		}
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
		ta.backlog += msg;
		ta.value = fromutf8(ta.backlog + ta.consbuf) + "\u2588";
		ta.scrollTop = ta.scrollHeight;
	}

	ta.print = function(msg) {
		ta.writeterminal(toutf8(msg));
	}

	ta.note = function(s){
		while(ta.onnote.length > 0)
			ta.onnote.shift()(s);
	}

	ta.flush = function() {
		if(ta.holdmode && !ta.rawmode){
			ta.writeterminal("");
			return;
		}
		ta.unread += ta.consbuf;
		if(!ta.rawmode)
			ta.backlog += ta.consbuf;
		ta.consbuf = "";
		ta.writeterminal("");
		if(ta.online.length > 0)
			ta.online.shift()(ta.consbuf);
		while(ta.unread != "" && ta.online.length > 0)
			ta.online.shift()(ta.consbuf);
	}

	ta.addchar = function(c){
		if(c == 127){
			ta.note("interrupt");
			return;
		}
		if(c == 8){
			ta.consbuf = ta.consbuf.substring(0, ta.consbuf.length - 1);
			ta.writeterminal("");
			return;
		}
		if(c == 23){
			ta.consbuf = ta.consbuf.substring(0, ta.consbuf.lastIndexOf(' '));
			ta.writeterminal("");
			return;
		}
		if(c == 21){
			ta.consbuf = ta.consbuf.substring(0, ta.consbuf.lastIndexOf('\n'));
			ta.writeterminal("");
			return;
		}
		if(c == 4){
			ta.flush();
			return;
		}
		if(c == 13){
			ta.consbuf += "\n";
			ta.flush();
			return;
		}
		if(c == 27){
			ta.holdmode = !ta.holdmode;
			if(ta.holdmode){
				ta.style.backgroundColor = 'black';
				ta.style.color = 'white';
			} else {
				ta.style.backgroundColor = 'white';
				ta.style.color = 'black';
				if(ta.consbuf != "")
					ta.flush();
			}
			return;
		}
		ta.consbuf += toutf8(String.fromCharCode(c));
		if(ta.rawmode)
			ta.flush();
		else
			ta.writeterminal("");
	}

	ta.readterminal = function(c, f, t){
		if(ta.unread != ""){
			f(ta.unread.substring(0, c));
			ta.unread = ta.unread.substring(c);
		} else {
			if(t != undefined)
				var l = ta.online.length;
			onflush(t, function() { ta.online.splice(l, 1); });
		}
		ta.online.push(function() { f(ta.unread.substring(0, c)); ta.unread = ta.unread.substring(c); })
	}

	return ta;
}


