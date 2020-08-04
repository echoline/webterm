const Ticketreq = ["i1:type","s28:authid","s48:authdom","b8:chal","s28:hostid","s28:uid"];
const AuthPAKS2C = Ticketreq.concat(["b56:YAs"]);
const AuthPAKC2A = AuthPAKS2C.concat(["b56:YAc"]);
const AuthPAKA2C = ["i1:type","b56:YBs","b56:YBc"];
const AuthOK = ["i1:type","b124:Kc","b124:Ks"];
const AuthenticatorC = ["b56:YBs","b124:Ks","b68:Kn"];
const AuthenticatorS = ["b68:Kn"];
const Ticket = ["i1:num","b8:chal","b28:cuid","b28:suid","b32:key"];

var username = "eli";
var password;
var authkey = {aes:zerobytes(AESKEYLEN)};
var authpriv = {isclient:1};
var state;
var cpubuf;
var oncpumsg;
var authdom;
var conn;
var cchal, schal;
var authstate;
var authbuf;
var onauthmsg;

function newWebSocket(url) {
	if(window.WebSocket != undefined)
		return new WebSocket(url);
	if(window.MozWebSocket != undefined)
		return new MozWebSocket(url);
	fatal("no websockets");
}

function startauth() {
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
		state = 0;
		oncpumsg = function() {
			var i, s, arr, arr2, y;

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
				authpak_hash(authkey, new TextEncoder("utf-8").encode(username));
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
				document.getElementById('terminal').firstChild.writeterminal('dom: ' + s.authdom + '\n');

				y = new Uint8Array(PAKYLEN);
				authpak_new(authpriv, authkey, y);
				s.YAc = arr2str(y);
				s = pack(s, AuthPAKC2A);

				authbuf = "";
				authconn = newWebSocket("wss://echoline.org:8443/auth");
				authconn.onmessage = function(evt) {
					var i, a;

					authbuf += atob(evt.data);

					switch(authstate) {
					case 0:
						i = 113;
						if (authbuf.length < i)
							return;
						a = authbuf.substring(0, i);
						authbuf = authbuf.substring(i);
						break;
					case 1:
						i = 249;
						if (authbuf.length < i)
							return;
						a = authbuf.substring(0, i);
						authbuf = authbuf.substring(i);
						break;
					default:
						return;
					}

					if(a.charCodeAt(0) != 4)
						fatal("AS protocol botch");

					switch(authstate) {
					case 0:
						authstate++;
						a = unpack(a, AuthPAKA2C);

						if (authpak_finish(authpriv, authkey, str2arr(a.YBc)))
							fatal("authpak_finish failed");

						a = {};
						a.type = 1;
						a.authid = authid;
						a.authdom = authdom;
						a.chal = schal;
						a.hostid = a.uid = username;
						a = pack(a, Ticketreq);
						authconn.send(btoa(a));
						break;
					case 1:
						authstate++;
						a = unpack(a, AuthOK);

						authconn.close();
						break;
					}
				}
				authconn.onopen = function() {
					authconn.send(btoa(s));
					authbuf = "";
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
