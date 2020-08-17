function unpack(data, fmt) {
	var x,s,t,n,i,l,r,p,v;

	i = 0;
	r = {};
	for(x in fmt){
		s = fmt[x].split(':', 2);
		t = s[0];
		n = s[1];
		l = parseInt(t.substring(1))
		t = t.substring(0, 1);
		if(t == "R"){
			r[n] = data.substring(i);
			break;
		}
		s = data.substring(i, i+l);
		i += l;
		switch(t){
		case "i":
			v = 0;
			for(p = s.length - 1; p >= 0; p--){
				v *= 256;
				v += s.charCodeAt(p);
			}
			r[n] = v;
			break;
		case "j":
			v = 0;
			for(p = s.length - 1; p >= 0; p--){
				v *= 256;
				v += s.charCodeAt(p);
			}
			p = 1 << (s.length * 8 - 1);
			if((v & p) != 0){
				v &= ~p;
				v = - 1 - v;
			}
			r[n] = v;
			break;
		case "s":
			v = s.indexOf(String.fromCharCode(0));
			if(v < 0)
				r[n] = s;
			else
				r[n] = s.substring(0, v);
			break;
		case "S":
			v = 0;
			for(p = s.length - 1; p >= 0; p--){
				v *= 256;
				v += s.charCodeAt(p);
			}
			r[n] = data.substr(i, v);
			i += v;
			break;
		case "b":
			r[n] = s;
			break;
		case "B":
			r[n] = Array(l);
			for(p = 0; p < l; p++)
				r[n][p] = s.charCodeAt(p);
			break;
		default:
			throw "unknown type " + t + " used with unpack";
		}
	}
	return r;
}

function pack(data, fmt) {
	var r,s,t,n,l,v;

	r = "";
	for(x in fmt){
		s = fmt[x].split(':', 2);
		t = s[0];
		n = s[1];
		l = parseInt(t.substring(1))
		t = t.substring(0, 1);
		s = data[n];
		if(s == undefined)
			throw "undefined field " + n + " in pack";
		switch(t){
		case "i":
			for(p = 0; p < l; p++){
				r += String.fromCharCode(s & 0xFF);
				s >>>= 8;
			}
			break;
		case "s":
		case "b":
			if(s.length > l)
				r += s.substring(0, l);
			else{
				r += s;
				if(s.length < l)
					r += Array(l - s.length + 1).join("\0");
			}
			break;
		case "S":
			v = s.length;
			for(p = 0; p < l; p++){
				r += String.fromCharCode(v & 0xFF);
				v >>>= 8;
			}
			r += s;
			break;
		case "R":
			r += s;
			break;
		default:
			throw "unknown type " + t + " used with pack";
		}
	}
	return r;
}

