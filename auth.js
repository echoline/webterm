var cpubuf;
var oncpumsg;
var authdom;
var conn;
var state;
var password = "blah";
var username = "glenda";

var Ticketreq = ["i1:type","s28:authid","s48:authdom","b8:chal","s28:hostid","s28:uid"];
var AuthPAKS2C = Ticketreq.concat(["b56:YAs"]);
var AuthPAKC2A = AuthPAKS2C.concat(["b56:YAc"]);
var AuthPAKA2C = ["i1:type","b56:YBs","b56:YBc"];
var AuthenticatorC = ["b56:YBs","b256:Ks","b256:Kn"];
var AuthenticatorS = ["b256:Kn"];
var Ticket = ["i1:num","b8:chal","s28:hostid","s28:uid","b32:nonce"];

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
		cpubuf += window.atob(evt.data);
		if(oncpumsg)
			while(cpubuf != "" && oncpumsg() > 0)
				;
	}
	conn.onerror = fatal;
	conn.onopen = function(evt) {
		var cchal, schal, YBs, YBc, YAs, YAc;

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
			}
			switch(state){
			case 0:
				state++;
				arr = s.split(' ');
				if(arr[0] == 'v.2')
					fatal("p9any v.2 not supported");
				for(i = 0; i < arr.length; i++){
					arr2 = arr[i].split('@');
					if(arr2[0] == 'dp9ik'){
						conn.send(window.btoa(arr2[0] + ' ' + arr2[1] + '\0'));
						cchal = randomdata(8);
						conn.send(window.btoa(cchal));
						authdom = arr2[1];
						break;
					}
				}
				if(!authdom)
					fatal("dp9ik not available");
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
				YAc = s.YAc = randomdata(56);
				document.getElementById('terminal').firstChild.writeterminal('dom: ' + s.authdom + '\n');
				s = pack(s, AuthPAKC2A);

				authconn = newWebSocket("wss://echoline.org:8443/auth");
				authconn.onmessage = function(evt) {
					s += atob(evt.data);
					if(s.charCodeAt(0) != 4)
						fatal("AS protocol botch " + buf.charCodeAt(0));
					if(authstate == 0 && s.length == 113) {
						document.getElementById('terminal').firstChild.writeterminal('authstate: ' + authstate + '\n');

						authstate++;
						s = unpack(s, AuthPAKA2C);
						YBs = s.YBs;
						YBc = s.YBc;

						s = {};
						s.type = 1;
						s.authid = authid;
						s.authdom = authdom;
						s.chal = schal;
						s.hostid = s.uid = username;
						s = pack(s, Ticketreq);
						document.getElementById('terminal').firstChild.writeterminal('len: ' + s.length + ' type: ' + s.charCodeAt(0) + '\n');
						authconn.send(btoa(s));

						s = "";
					} else if(authstate == 1) {
						document.getElementById('terminal').firstChild.writeterminal('len: ' + s.length + '\n');
					}
				}
				authconn.onopen = function() {
					authconn.send(btoa(s));
					s = "";
				}
				authconn.onclose = function(evt) {
					authstate++;
					document.getElementById('terminal').firstChild.writeterminal('authconn closed: ' + evt.code + '\n');
				}
				authconn.onerror = fatal;
				break;
			}
			return 1;
		}
	}
}
