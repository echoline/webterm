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
		try {
			f.buffer += p.data;
			if (f.buffer.length > 65535) {
				f.context.decodeAudioData(str2arr(f.buffer).buffer, function(buffer) {
					var source = new AudioBufferSourceNode(f.context);
					source.buffer = buffer;
					source.connect(f.context.destination);
					source.onended = function() {
						f.queue.shift();
						if (f.queue.length == 0)
							return;
						f.queue[0].start();
					}
					f.queue.push(source);
					if (f.queue.length == 1)
						f.queue[0].start();
				});
				f.buffer = "";
			}
			respond(p, -1);
		} catch(err) {
			error9p(p.tag, err.message);
		}
	},
	function(f, p) {
		if (f.buffer.length > 0) {
			f.context.decodeAudioData(str2arr(f.buffer).buffer, function(buffer) {
				var source = new AudioBufferSourceNode(f.context);
				source.buffer = buffer;
				source.connect(f.context.destination);
				f.queue.push(source);
				if (f.queue.length == 1)
					f.queue[0].start();
			});
		}
		if (f.queue.length > 0)
			f.queue[f.queue.length-1].onended = function() {
				f.context.close();
			}
		else
			f.context.close();
	});
