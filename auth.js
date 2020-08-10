const Ticketreq = ["i1:type","s28:authid","s48:authdom","b8:chal","s28:hostid","s28:uid"];
const AuthPAKS2C = ["i1:type","s28:authid","s48:authdom","b8:chal","s28:hostid","s28:uid","b56:YAs"];
const AuthPAKC2A = ["i1:type","s28:authid","s48:authdom","b8:chal","s28:hostid","s28:uid","b56:YAs","b56:YAc"];
const AuthPAKA2C = ["i1:type","b56:YBs","b56:YBc"];
const AuthOK = ["i1:type","b124:Kc","b124:Ks"];
const Authenticator = ["b8:chal","b32:nonce"];
const Ticket = ["i1:num","b8:chal","b28:cuid","b28:suid","b32:key"];

const AESKEYLEN = 16;

var username;
var password;
var conn;
var cpubuf;
var oncpumsg;

function newWebSocket(url) {
	if(window.WebSocket != undefined)
		return new WebSocket(url);
	if(window.MozWebSocket != undefined)
		return new MozWebSocket(url);
	fatal("no websockets");
}

function passtokey(key, pw) {
	var salt = str2arr("Plan 9 key derivation");

	key.aes = new Uint8Array(AESKEYLEN);
	pbkdf2_x(pw, pw.length, salt, salt.length, 9001, key.aes, AESKEYLEN, hmac_sha1, SHA1dlen);
}

function getlogin() {
	var termoninput = term.oninput;

	username = "";
	password = "";

	term.writeterminal("username: ");
	term.oninput = function(event) {
		if (event.inputType == 'insertText') {
			username += event.data;
			termoninput(event);
		}
		else if (event.inputType == 'deleteContentBackward') {
			username = username.substring(0, username.length-1);
			termoninput(event);
		}
		else if (event.inputType == 'insertLineBreak') {
			term.consbuf = "";
			term.writeterminal(username);
			if (username == "") {
				term.writeterminal("\n");
				username = "guest";
				password = "gratisse";
				term.oninput = termoninput;
				startauth();
				return false;
			}
			term.writeterminal("\npassword: ");
			term.oninput = function(event) {
				var i;
				if (event.inputType == 'insertText') {
					password += event.data;
					termoninput(event);
					for (i = 0; i < event.data.length; i++)
						term.addchar(8);
				}
				else if (event.inputType == 'deleteContentBackward') {
					password = password.substring(0, password.length-1);
					term.addchar(8);
				}
				else if (event.inputType == 'insertLineBreak') {
					term.writeterminal("\n");
					term.oninput = termoninput;
					startauth();
				}
				return false;
			}
			return false;
		}
		return false;
	}
}

function startauth() {
	starttime = Date.now();

	var authkey = {};

	passtokey(authkey, str2arr(password));
	password = null;

	var authinfo = {}
	cpubuf = "";

	conn = newWebSocket("wss://echoline.org:8443/rcpu");
	conn.onmessage = function(event) {
		cpubuf += atob(event.data);
		if(oncpumsg)
			while(cpubuf != "" && oncpumsg() > 0)
				;
	}
	conn.onerror = fatal;
	conn.onclose = function(event) {
		document.getElementById("terminal").style.display = 'block';
		document.getElementById("buttons").innerHTML = '';
		getlogin();
	}
	conn.onopen = function(event) {
		var crand = arr2str(chachabytes(32));
		var state = 0;
		var authdom;
		var authpriv = {};
		var nonce;
		var cchal, schal;
		var y;

		oncpumsg = function() {
			var i, s;

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
				i = 68;
				if(cpubuf.length < i)
					return -1;
				s = cpubuf.substring(0, i);
				cpubuf = cpubuf.substring(i);
				break;
			default:
				s = cpubuf;
				cpubuf = "";
				break;
			}

			switch(state){
			case 0:
				state++;
				var arr = s.split(' ');
				if(arr[0] == 'v.2')
					fatal("p9any v.2 unimplemented");
				for(i = 0; i < arr.length; i++){
					var arr2 = arr[i].split('@');
					if(arr2[0] == 'dp9ik'){
						cchal = arr2str(chachabytes(8));
						conn.send(btoa(arr2[0] + ' ' + arr2[1] + '\0' + cchal));
						authdom = arr2[1];
						break;
					}
				}
				if(!authdom)
					fatal("dp9ik not available");
				authpak_hash(authkey, str2arr(username));
				authkey.aes = null;
				break;
			case 1:
				state++;
				var authstate = 0;
				var authbuf = "";

				s = unpack(s, AuthPAKS2C);
				s.type = 19;
				s.hostid = username;
				s.uid = username;
				schal = s.chal;
				authid = s.authid;

				y = new Uint8Array(PAKYLEN);
				authpak_new(authpriv, authkey, y);
				s.YAc = arr2str(y);
				s = pack(s, AuthPAKC2A);

				authconn = newWebSocket("wss://echoline.org:8443/auth");
				authconn.onmessage = function(event) {
					var i, a;

					authbuf += atob(event.data);

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

						authpriv = null;
						y = a.YBs;

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
						authconn.close();

						authstate++;
						a = unpack(a, AuthOK);
						var aKc = str2arr(a.Kc);
						var Ks = a.Ks;
						var authok = true;

						if (form1M2B(aKc, aKc.length, authkey.pakkey) < 0)
							authok = false;
						authkey = null;
						if (authok) {
							a = unpack(arr2str(aKc), Ticket);
							aKc = null;
							if (a.chal != schal)
								fatal("invalid challenge from auth server");

							if (a.num != AuthTc)
								authok = false;
							else {
								nonce = a.key;
								authinfo.suid = a.suid;
								authinfo.cuid = a.cuid;
							}
						}
						if (!authok) {
							term.writeterminal("password incorrect\n")

							conn.close();
						} else {
							conn.send(btoa(y));
							y = null;
							conn.send(btoa(Ks));
							Ks = null;

							a = {};
							a.chal = schal;
							schal = null;
							a.nonce = crand;
							a = str2arr(pack(a, Authenticator));
							var b = new Uint8Array(68);
							b[0] = AuthAc;
							b.set(a, 1);
							form1B2M(b, 41, str2arr(nonce));
							conn.send(btoa(arr2str(b)));
						}
						break;
					}
				}
				authconn.onopen = function() {
					authconn.send(btoa(s));
					authbuf = "";
				}
				authconn.onclose = function(event) {
				}
				authconn.onerror = fatal;
				break;
			case 2:
				state++;
				s = str2arr(s);
				if (form1M2B(s, 68, str2arr(nonce)) < 0 || s[0] != AuthAs) {
					term.writeterminal('incorrect password\n');
					conn.close();
					break;
				}

				s = unpack(arr2str(s.slice(1)), Authenticator);
				if (s.chal != cchal)
					fatal("invalid challenge from server");
				cchal = null;
				crand += s.nonce;

				authinfo.nsecret = 256;
				authinfo.secret = new Uint8Array(256);

				var info = str2arr("Plan 9 session secret");
				hkdf_x(str2arr(crand), 64, info, info.length,
					str2arr(nonce), 32,
					authinfo.secret, authinfo.nsecret,
					hmac_sha2_256, SHA2_256dlen);

				nonce = null;
				crand = null;

				oncpumsg = gottlsraw;
				sec.psklen = authinfo.nsecret;
				sec.psk.set(authinfo.secret, 0);
				authinfo = null;
				tlsClientHello();
				break;
			default:
				term.writeterminal(s);
				break;
			}

			return 1;
		}
	}
}
