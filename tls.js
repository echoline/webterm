const ProtocolVersion = 0x0303;
const HHelloRequest = 0;
const HClientHello = 1;
const HServerHello = 2;
const HServerHelloDone = 14;
const HClientKeyExchange = 16;
const HFinished = 20;
const MaxRecLen = 1<<14;
const MaxCipherRecLen = MaxRecLen + 2048;

var tlsbuf = "";
var verify = new Uint8Array(12);

var sid;
var sec = {psk:new Uint8Array(256),psklen:256,
	sec:new Uint8Array(48),
	crandom:new Uint8Array(32),srandom:new Uint8Array(32)};
var hsha2_256;
var ninepbuf = "";

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
		this.c.tls = this;
		this.outseq = new Uint32Array(2);
		this.inseq = new Uint32Array(2);
		this.outkey = sec.secrets.slice(0, 32);
		this.inkey = sec.secrets.slice(32, 64);
		this.outiv = sec.secrets.slice(64, 64+12);
		this.iniv = sec.secrets.slice(64+12, 64+24);
		this.outenc = setupChachastate(null, this.outkey, 32, this.outiv, 12, 20);
		this.inenc = setupChachastate(null, this.inkey, 32, this.iniv, 12, 20);

		ws.onmessage = function(evt) {
			var s = atob(evt.data);
			cpubuf += s;
			var ndata = s.length;
			if (ndata < 5)
				return;
			s = cpubuf;
			cpubuf = "";
			ndata = s.length;
			while (ndata > 0) {
				var type = ctob(s, 0);
				var ver = get16(s, 1);
				var len = get16(s, 3);
				var b = str2arr(s.substring(5, 5+len));
				var iv = new Uint8Array(12);
				var tag;
				var i;

				if (ver != ProtocolVersion)
					fatal("incorrect protocol version in tls read");
				if (len > MaxCipherRecLen || len < 0)
					fatal("tls record length invalid");

				if (type == 0x14 || (type == 0x15 && len == 2)) {
					cpubuf += s.substring(0, 5+len);
					s = s.substring(5+len);
					ndata -= len + 5;
					continue;
				} else if (type != 0x15 && type != 0x16 && type != 0x17) {
					fatal("invalid tls record type");
				}

				if (len < 16)
					fatal("tls record length invalid");
				len -= 16;

				var rec = s.substring(0, 3) + put16(len);
				var aad = str2arr(put16((this.tls.inseq[0] >>> 16) & 0xFFFF) + put16(this.tls.inseq[0] & 0xFFFF) + put16((this.tls.inseq[1] >>> 16) & 0xFFFF) + put16(this.tls.inseq[1] & 0xFFFF) + s.substring(0, 3) + put16(len));
				this.tls.inseq[1]++;
				if (this.tls.inseq[1] == 0)
					this.tls.inseq[0]++;

				tag = b.slice(len, len+16);
				iv.set(this.tls.iniv, 0);
				for (i = 0; i < 8; i++)
					iv[i+4] ^= aad[i];
				chacha_setiv(this.tls.inenc, iv);
				if (ccpoly_decrypt(b, len, aad, 13, tag, this.tls.inenc) != 0)
					fatal("tls decrypt error");
				rec += arr2str(b.slice(0, len));

				cpubuf += rec;
				ndata -= 5 + len + 16;
				s = s.substring(5 + len + 16);
			}

			if (oncpumsg)
				while(cpubuf != "" && oncpumsg() > 0);
		}
	}
}

tlsConn.prototype.send = function(s) {
	var aadlen = 13;
	var aad;
	var len = get16(s, 3);
	var type = ctob(s, 0);
	var maclen = 16;
	var tag = new Uint8Array(16);
	var i;
	var iv = new Uint8Array(12);
	var b = str2arr(s.substring(5, 5+len));

	if (len > MaxCipherRecLen || len < 0)
		fatal("tls record length invalid");

	aad = str2arr(put16((this.outseq[0] >>> 16) & 0xFFFF) +
		put16(this.outseq[0] & 0xFFFF) +
		put16((this.outseq[1] >>> 16) & 0xFFFF) +
		put16(this.outseq[1] & 0xFFFF) + s.substring(0, 5));
	this.outseq[1]++;
	if (this.outseq[1] == 0)
		this.outseq[0]++;

	iv.set(this.outiv, 0);
	for (i = 0; i < 8; i++)
		iv[i+4] ^= aad[i];
	chacha_setiv(this.outenc, iv);
	ccpoly_encrypt(b, len, aad, aadlen, tag, this.outenc);

	var ret = s.substring(0, 3) + put16(len+16) + arr2str(b) + arr2str(tag);

	return this.c.send(btoa(ret));
}

tlsConn.prototype.close = function() {
	return this.c.close();
}

function tlsrecsend(s, type) {
	var out = btoc(type);
	out += put16(ProtocolVersion);
	out += put16(s.length);
	out += s;

	conn.send(out);
}

function tlswrite(s) {
	tlsrecsend(s, 0x17);
}

function tlsrecrecv(s) {
	var rectype = ctob(s, 0);
	var version = get16(s, 1);
	var length = get16(s, 3);
	var n = 0;
	var i, j;
	var a;

	if (version != ProtocolVersion)
		fatal("invalid tls version");

	if (length > (s.length - 5))
		return 0;

	s = s.substring(5);

	for (i = length; i > 0;) {
		switch(rectype) {
		case 0x14:
			if (length != 1 || s.charCodeAt(0) != 0x01)
				fatal("invalid server change cipher spec");
			n = 1;
			s = s.substring(n);
			break;
		case 0x15:
			if (ctob(s, 0) != 1 && ctob(s, 1) != 0)
				term.print("tls alert: " + ctob(s, 0) + " " + ctob(s, 1) + "\n");
			n = length;
			s = s.substring(n);
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
					if (s.charCodeAt(j) != verify[j])
						fatal ("finished verification failed");
				ninepbuf = "";
var script =
"syscall fversion 0 65536 buf 256 >/dev/null >[2=1]\n" +
"mount -nc /fd/0 /mnt/term || exit\n" +
"bind -q /mnt/term/dev/cons /dev/cons\n" +
"if(test -r /mnt/term/dev/kbd){\n" +
"       </dev/cons >/dev/cons >[2=1] aux/kbdfs -dq -m /mnt/term/dev\n" +
"       bind -q /mnt/term/dev/cons /dev/cons\n" +
"}\n" +
"</dev/cons >/dev/cons >[2=1] service=cpu rc -li\n" +
//"echo -n $status >/mnt/term/env/rstatus >[2]/dev/null\n" +
"echo -n hangup >/proc/$pid/notepg\n"
				tlswrite("0000" + script.length + "\n" + script);
				document.getElementById('terminal').style.display = 'none';
				document.getElementById('buttons').innerHTML = '<input type="button" value="New Window" onclick="javascript:var line = \'hwin\'; var i; for (i = 0; i < line.length; i++) term.addchar(line.charCodeAt(i)); term.addchar(13);"><input type="button" style="float:right;" value="Log Out" onclick="javascript:term.backlog = \'\'; term.consbuf = \'\'; term.unread = \'\'; for (i = 0; i < windows.length; i++) closeWindow(\'\' + escape(windows[i].id)); nwindows = 0; Nwindows = 0; terminals = {}; windows = []; conn.close();">';
				break;
			default:
				fatal("invalid handshake message type: " + type);
			}
			s = s.substring(n);
			break;
		case 0x17:
			n = i;
			ninepbuf += s.substring(0, n);
			s = s.substring(n);
			while(ninepbuf.length > 0) {
				j = got9praw(ninepbuf);
				if (j < 0)
					break;
				ninepbuf = ninepbuf.substring(j);
			}
			break;
		default:
			fatal("invalid tls record type: " + rectype);
		}
		i -= n;
	}
	return (length + 5);
}

function tlshandshakesend(s) {
	var type = ctob(s, 0);

	switch(type) {
	case HClientHello:
	case HClientKeyExchange:
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
	sec.crandom.set(chachabytes(32));
	tlsbuf += arr2str(sec.crandom);
	p += 32;

	// no sid
	tlsbuf += btoc(0);
	p++;

	// ciphers
	tlsbuf += put16(6);
	p += 2;
	tlsbuf += put16(0xCCAB);
	tlsbuf += put16(0x00AE);
	tlsbuf += put16(0x008C);
	p += 6;

	// no compressors
	tlsbuf += btoc(0x01) + btoc(0x00);
	p += 2;

	// no extensions

	s = put24(p-4);
	tlsbuf = tlsbuf.replaceAt(sendp + 1, s);

	msgHash(str2arr(tlsbuf.substring(sendp, sendp+p)), p);

	tlshandshakesend(tlsbuf);
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

	tlshandshakesend(tlsbuf);
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
	var hsh = newDigestState();

	hsh.len = hsha2_256.len;
	hsh.blen = hsha2_256.blen;
	hsh.buf.set(hsha2_256.buf, 0);
	hsh.state.set(hsha2_256.state, 0);
	hsh.seeded = 1;

	sha2_256(null, 0, seed, hsh);

	p_sha256(finished, 12, sec.sec, 48, label, label.length, seed, 32);
}

function setSecrets() {
	var kd = new Uint8Array((32+12)*2);
	var seed = new Uint8Array(64);

	seed.set(sec.srandom, 0);
	seed.set(sec.crandom, 32);
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
	var s;
	var buf;

	p = 0;
	buf = btoc(HFinished) + '\0\0\0';
	p += 4;

	buf += arr2str(verify);
	p += verify.length;

	s = put24(p-4);
	buf = buf.replaceAt(1, s);

	msgHash(str2arr(buf), p);

	tlsrecsend(buf, 0x16);
}

function msgHash(p, n) {
	sha2_256(p, n, 0, hsha2_256);
}

function gottlsraw() {
	var n = tlsrecrecv(cpubuf);

	cpubuf = cpubuf.substring(n);

	return n;
}

