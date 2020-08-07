const ProtocolVersion = 0x0303;
const HHelloRequest = 0;
const HClientHello = 1;
const HServerHello = 2;
const HServerHelloDone = 14;
const HClientKeyExchange = 16;
const HFinished = 20;

var tlsbuf = "";

var sid;
var sec = {psk:new Uint8Array(256),psklen:256,
	sec:new Uint8Array(48),
	crandom:new Uint8Array(32),srandom:new Uint8Array(32)};
var hsha2_256;

function btoc(b) {
	return String.fromCharCode(b);
}

function put16(s) {
	return btoc((s >> 8) & 0xFF) + btoc(s & 0xFF);
}

function put24(s) {
	return btoc((s >> 16) & 0xFF) + btoc((s >> 8) & 0xFF) + btoc(s & 0xFF);
}

function ctob(s, c) {
	return s.charCodeAt(c);
}

function get16(s, i) {
	return ((ctob(s, i) << 8) | ctob(s, i+1));
}

function get24(s, i) {
	return ((ctob(s, i) << 16) | (ctob(s, i+1) << 8) | ctob(s, i+2));
}

String.prototype.replaceAt = function(index, replacement) {
	return this.substr(0, index) + replacement + this.substr(index + replacement.length);
}

function short() {
	fatal("short tls read");
}

class tlsConn {
	constructor(ws) {
		this.c = ws;

		ws.onmessage = function(evt) {
			cpubuf += atob(evt.data);

			if (oncpumsg)
				while(cpubuf != "" && oncpumsg() > 0);
		}
	}
}

tlsConn.prototype.send = function(s) {
	return this.c.send(s);
}

tlsConn.prototype.close = function() {
	return this.c.close();
}

function tlsrecrecv(s) {
	var rectype = ctob(s, 0);
	var version = get16(s, 1);
	var length = get16(s, 3);
	var n;
	var i, j;
	var a;
	var verify = new Uint8Array(12);

	if (version != ProtocolVersion)
		fatal("invalid tls version");

	if (length > (s.length - 5))
		return 0;

	s = s.substring(5);

	for (i = length; i > 0;) {
		switch(rectype) {
		case 0x15:
			if (length != 2)
				fatal ("invalid tls alert record length");
			term.print("tls alert: " + ctob(s, 0) + " " + ctob(s, 1) + "\n");
			i -= 2;
			break;
		case 0x16:
			var type = ctob(s, 0);
			n = get24(s, 1);

			msgHash(str2arr(s.substring(0, 4)), 4);

			s = s.substring(4);
			if (s.length < n)
				return 0;
			i -= 4;

			msgHash(str2arr(s.substring(0, n)), n);

			switch(type) {
			case HServerHello:
				if (tlsServerHello(s.substring(0, n)))
					fatal("invalid tls message length");
				break;
			case HServerHelloDone:
				setMasterSecret(new Uint8Array(sec.psklen));
				setSecrets();
				tlsClientKeyExchange();
				tlsChangeCipher();
				tlsSecFinished(verify, 1);
				tlsFinished(verify);
				tlsSecFinished(verify, 0);
				break;
			case HFinished:
				for (j = 0; j < n; j++)
					if (s.charCodeAt(j) != verify[n])
						fatal ("finished verification failed");
				break;
			default:
				fatal("invalid handshake message type: " + type);
			}
			break;
		default:
			fatal("invalid tls record type: " + type);
		}
		i -= n;
		s = s.substring(n);
	}
	return (length + 5);
}

function tlsrecsend(s) {
	var type = ctob(s, 0);

	switch(type) {
	case HClientHello:
	case HClientKeyExchange:
	case HFinished:
		s = btoc(0x16) + put16(ProtocolVersion) + put16(s.length) + s;
		break;
	default:
		fatal ("invalid tls message type: " + type);
	}

	conn.send(btoa(s));
}

function tlsClientHello() {
	var p;
	var sendp;
	var s;

	hsha2_256 = newDigestState();

	sendp = tlsbuf.length;
	p = 0;
	tlsbuf += btoc(HClientHello) + '\0\0\0';
	p += 4;

	// version
	tlsbuf += put16(ProtocolVersion);
	p += 2;

	// random data
	sec.crandom.set(gentest(32));
	tlsbuf += arr2str(sec.crandom);
	p += 32;

	// no sid
	tlsbuf += btoc(0);
	p++;

	// ciphers
	tlsbuf += put16(2);
	p += 2;
	tlsbuf += put16(0xCCAB);
	p += 2;

	// no compressors
	tlsbuf += btoc(0x01) + btoc(0x00);
	p += 2;

	// no extensions

	s = put24(p-4);
	tlsbuf = tlsbuf.replaceAt(sendp + 1, s);

	msgHash(str2arr(tlsbuf.substring(sendp, sendp+p)), p);

	tlsrecsend(tlsbuf);
	tlsbuf = "";
}

function tlsServerHello(s) {
	var p = 0;
	var n = s.length;
	var version;
	var cipher;
	var compressor;
	var extensions;
	var t;

	if (n < 2)
		short();
	version = get16(s, p);
	n -= 2;
	p += 2;

	if (version != ProtocolVersion)
		fatal("invalid tls version: " + version);

	if (n < 32)
		short();
	sec.srandom.set(str2arr(s.substring(p, p+32)));
	p += 32;
	n -= 32;

	if (n < 1)
		short();
	t = ctob(s, p);
	p++;
	n--;
	if (n < t)
		short();
	sid = s.substring(p, p+t);
	p += sid.length;
	n -= sid.length;

	if (n < 3)
		short();
	cipher = get16(s, p);
	compressor = ctob(s, p+2);
	p += 3;
	n -= 3;

	if (cipher != 0xCCAB)
		fatal("invalid cipher: " + cipher);
	if (compressor != 0)
		fatal("invalid compressor: " + compressor);

	if (n < 2)
		return n;
	t = get16(s, p);
	p += 2;
	n -= 2;
	if (n < t)
		short();
	extensions = s.substring(p, p+t);
	n -= t;
	p += t;
	return n;
}

function tlsClientKeyExchange() {
	var p;
	var sendp;
	var s;
	var pskid = "p9secret";

	sendp = tlsbuf.length;
	p = 0;
	tlsbuf += btoc(HClientKeyExchange) + '\0\0\0';
	p += 4;

	tlsbuf += put16(pskid.length);
	p += 2;
	tlsbuf += pskid;
	p += pskid.length;

	s = put24(p-4);
	tlsbuf = tlsbuf.replaceAt(sendp + 1, s);

	msgHash(str2arr(tlsbuf.substring(sendp, sendp+p)), p);

	tlsrecsend(tlsbuf);
	tlsbuf = "";
}

function tlsChangeCipher() {
	var s = btoc(0x14) + put16(ProtocolVersion) + put16(1) + btoc(1);

	conn.send(btoa(s));

	conn = new tlsConn(conn);
}

function p_sha256(buf, nbuf, key, nkey, label, nlabel, seed, nseed) {
	var ai = new Uint8Array(32);
	var tmp = new Uint8Array(32);
	var s;
	var n;
	var bp = 0;

	s = hmac_sha2_256(label, nlabel, key, nkey, null, null);
	hmac_sha2_256(seed, nseed, key, nkey, ai, s);

	while (nbuf > 0) {
		s = hmac_sha2_256(ai, SHA2_256dlen, key, nkey, null, null);
		s = hmac_sha2_256(label, nlabel, key, nkey, null, s);
		hmac_sha2_256(seed, nseed, key, nkey, tmp, s);
		n = 32;
		if (n > nbuf)
			n = nbuf;
		buf.set(tmp.slice(0, n), bp);
		bp += n;
		nbuf -= n;
		hmac_sha2_256(ai, SHA2_256dlen, key, nkey, tmp, null);
		ai.set(tmp, 0);
	}
}

function tlsSecFinished(finished, isclient) {
	var seed = new Uint8Array(32);
	var label = str2arr((isclient? "client": "server") + " finished");

	sha2_256(null, 0, seed, hsha2_256);

	p_sha256(finished, 12, sec.sec, 48, label, label.length, seed, 32);
}

function setSecrets() {
	var kd = new Uint8Array(160);
	var seed = new Uint8Array(64);

	seed.set(sec.crandom, 0);
	seed.set(sec.srandom, 32);
	p_sha256(kd, 2*(32+12), sec.sec, 48, str2arr("key expansion"), 13, seed, 64);

	sec.nsecret = (32+12)*2;
	sec.secrets = kd;
}

function setMasterSecret(pm) {
	var s;
	var seed = new Uint8Array(64);

	s = put16(pm.length) + arr2str(pm) + put16(sec.psklen) + arr2str(sec.psk);
	seed.set(sec.crandom, 0);
	seed.set(sec.srandom, 32);
	p_sha256(sec.sec, 48, str2arr(s), s.length, str2arr("master secret"), 13, seed, 64);
}

function tlsFinished(verify) {
	var p;
	var sendp;
	var s;

	sendp = tlsbuf.length;
	p = 0;
	tlsbuf += btoc(HFinished) + '\0\0\0';
	p += 4;

	tlsbuf += arr2str(verify);
	p += verify.length;

	s = put24(p-4);
	tlsbuf = tlsbuf.replaceAt(sendp + 1, s);

	msgHash(str2arr(tlsbuf.substring(sendp, sendp+p)), p);

	tlsrecsend(tlsbuf);
	tlsbuf = "";
}

function msgHash(p, n) {
	sha2_256(p, n, 0, hsha2_256);
}

function gottlsraw() {
	var n = tlsrecrecv(cpubuf);

	cpubuf = cpubuf.substring(n);

	return n;
}

