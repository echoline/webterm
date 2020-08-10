mkfile("/dev/mp3", function(f, p) {
		try {
			f.context = new (window.AudioContext || window.webkitAudioContext)();
			f.queue = [];
			f.buffer = "";
		} catch(err) {
			return err.message;
		}
	}, undefined,
	function(f, p) {
		f.buffer += p.data;
		var l = f.buffer.length;
		if (l < 0x10000)
			l = 0;
		while (l > 0) {
			l = f.buffer.substring(0, l).lastIndexOf(String.fromCharCode(0xFF));
			if (l == -1 || (f.buffer.length > (l+1) && (f.buffer.charCodeAt(l+1) & 0xE0) == 0xE0))
				break;
		}
		if (l > 0) {
			f.context.decodeAudioData(str2arr(f.buffer.substring(0, l)).buffer, function(buffer) {
				var source = new AudioBufferSourceNode(f.context);
				source.buffer = buffer;
				source.connect(f.context.destination);
				source.prestart = function() {
					respond(p, -1);
				}
				source.onended = function() {
					f.queue.shift();
					if (f.queue.length == 0)
						return;
					f.queue[0].prestart();
					f.queue[0].start();
				}
				f.queue.push(source);
				if (f.queue.length == 1) {
					f.queue[0].prestart();
					f.queue[0].start();
				}
			}).catch(function(error) {
				error9p(p.tag, error);
			});
			f.buffer = f.buffer.substring(l);
		} else if (l <= 0 && f.buffer.length > 0xFFFF)
			error9p(p.tag, "not valid mp3 data");
		else 
			respond(p, -1);
	},
	function(f, p) {
		if (f.buffer.length > 0) {
			f.context.decodeAudioData(str2arr(f.buffer).buffer, function(buffer) {
				var source = new AudioBufferSourceNode(f.context);
				source.buffer = buffer;
				source.connect(f.context.destination);
				source.prestart = function() { }
				source.onended = function() {
					f.context.close();
				}
				f.queue.push(source);
				if (f.queue.length == 1)
					f.queue[0].start();
			}).catch(function(error) {
				term.writeterminal(error + "\n");
			});
		}
		if (f.queue.length == 0)
			f.context.close();
	});

