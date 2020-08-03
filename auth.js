const Ticketreq = ["i1:type","s28:authid","s48:authdom","b8:chal","s28:hostid","s28:uid"];
const AuthPAKS2C = Ticketreq.concat(["b56:YAs"]);
const AuthPAKC2A = AuthPAKS2C.concat(["b56:YAc"]);
const AuthPAKA2C = ["i1:type","b56:YBs","b56:YBc"];
const AuthOK = ["i1:type","b124:Kc","b124:Ks"];
const AuthenticatorC = ["b56:YBs","b124:Ks","b68:Kn"];
const AuthenticatorS = ["b68:Kn"];
const Ticket = ["i1:num","b8:chal","b28:cuid","b28:suid","b32:key"];

var username = "blah";
var password = "blah";
var authkey = {aes:new Uint8Array(AESKEYLEN)};
var authpriv = {isclient:1};

function newWebSocket(url) {
	if(window.WebSocket != undefined)
		return new WebSocket(url);
	if(window.MozWebSocket != undefined)
		return new MozWebSocket(url);
	fatal("no websockets");
}

function startauth() {
	var state;
	var cpubuf;
	var oncpumsg;
	var authdom;
	var conn;

//	username = prompt("username", "");
//	password = prompt("password", "");

	cpubuf = "";
	conn = newWebSocket("wss://echoline.org:8443/rcpu");
	conn.onmessage = function(evt) {
		cpubuf += atob(evt.data);
		if(oncpumsg)
			while(cpubuf != "" && oncpumsg() > 0)
				;
	}
	conn.onerror = fatal;
	conn.onclose = function(evt) {
		document.getElementById('terminal').firstChild.writeterminal('conn closed: ' + evt.code + '\n');
	}
	conn.onopen = function(evt) {
		var cchal, schal, YBs, YBc, YAs, YAc, Ks, Kc;
		var y;

		state = 0;
		oncpumsg = function() {
			var i, s, arr, arr2;

			document.getElementById('terminal').firstChild.writeterminal('state: ' + state + '\n');

			switch(state){
			case 0:
				i = cpubuf.indexOf(String.fromCharCode(0));
				if(i < 0)
					return -1;
				s = cpubuf.substring(0, i);
				cpubuf = cpubuf.substring(i+1);
				break;
			case 1:
				i = 197;
				if(cpubuf.length < i)
					return -1;
				s = cpubuf.substring(0, i);
				cpubuf = cpubuf.substring(i);
				break;
			case 2:
				s = cpubuf;
				cpubuf = "";
				break;
			}
			switch(state){
			case 0:
				state++;
				arr = s.split(' ');
				if(arr[0] == 'v.2')
					fatal("p9any v.2 unimplemented");
				for(i = 0; i < arr.length; i++){
					arr2 = arr[i].split('@');
					if(arr2[0] == 'dp9ik'){
						cchal = randomstring(8);
						conn.send(btoa(arr2[0] + ' ' + arr2[1] + '\0' + cchal));
						authdom = arr2[1];
						break;
					}
				}
				if(!authdom)
					fatal("dp9ik not available");
				//authpak_hash(authkey, new TextEncoder("utf-8").encode(username));
				break;
			case 1:
				state++;
				authstate = 0;

				s = unpack(s, AuthPAKS2C);
				s.type = 19;
				s.hostid = username;
				s.uid = username;
				schal = s.chal;
				authid = s.authid;
				YAs = s.YAs;
				y = new Uint8Array(PAKYLEN);
				//authpak_new(authpriv, authkey, y, 1);
				YAc = s.YAc = String.fromCharCode.apply(null, y);
				document.getElementById('terminal').firstChild.writeterminal('dom: ' + s.authdom + '\n');
				s = pack(s, AuthPAKC2A);

				authconn = newWebSocket("wss://echoline.org:8443/auth");
				authconn.onmessage = function(evt) {
					s += atob(evt.data);
					if(s.charCodeAt(0) != 4)
						fatal("AS protocol botch " + buf.charCodeAt(0));
					if(authstate == 0 && s.length == 113) {

						authstate++;
						s = unpack(s, AuthPAKA2C);
						YBs = s.YBs;
						YBc = s.YBc;
						document.getElementById('terminal').firstChild.writeterminal('authpak: ' + s.type + '\n');

						s = {};
						s.type = 1;
						s.authid = authid;
						s.authdom = authdom;
						s.chal = schal;
						s.hostid = s.uid = username;
						s = pack(s, Ticketreq);
						authconn.send(btoa(s));

						s = "";
					} else if(authstate == 1 && s.length == 249) {
						authstate++;
						s = unpack(s, AuthOK);
						Ks = s.Ks;
						Kc = s.Kc;
						document.getElementById('terminal').firstChild.writeterminal('auth: ' + s.type + '\n');
						authconn.close();

						s.YBs = YBs;
						s.Ks = Ks;
						s.Kn = "form1 Ac" + randomstring(60);
						s = pack(s, AuthenticatorC);
						conn.send(btoa(s));
					}
				}
				authconn.onopen = function() {
					authconn.send(btoa(s));
					s = "";
				}
				authconn.onclose = function(evt) {
					document.getElementById('terminal').firstChild.writeterminal('authconn closed: ' + evt.code + '\n');
				}
				authconn.onerror = fatal;
				break;
			case 2:
				state++;
				if (s.substring(0, 8) == 'form1 As') {
					s = unpack(s, AuthenticatorS);
					document.getElementById('terminal').firstChild.writeterminal('authenticated\n');
				} else {
					document.getElementById('terminal').firstChild.writeterminal('?' + s + '\n');
				}
				oncpumsg = got9praw;
				break;
			}
			return 1;
		}
	}
}
