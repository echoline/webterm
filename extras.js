function youtube(id, url) {
	var re = /watch\?v=/;
	url = url.replace(re, 'embed/');
	url = url.split('&');
	url = url[0];
	win(id).bg.innerHTML='<iframe width="100%" height="100%" src="' + url + '" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
	oshow(id, false);
}

function image(id, url) {
	win(id).bg.innerHTML='';
	var d = c('img');
	d.style.width='100%';
	d.src = url;
	win(id).bg.appendChild(d);
	oshow(id, false);
}

function clock(id) {
	win(id).interval = setInterval(function() {
		win(id).terminal.value = new Date();
	}, 1000);
	image(id, 'https://i.imgur.com/4hhET9w.jpg');
	oshow(id, true);
	oset(id, 0.6);
}

function video(id, url) {
	win(id).bg.innerHTML='';
	var v = c('video');
	v.style.width='100%';
	v.src = url;
	win(id).bg.appendChild(v);
	oshow(id, false);
}

function bgset(color) {
	document.body.style.backgroundColor = color;
}

function embed(id, code) {
	win(id).bg.innerHTML = code;
	oshow(id, false);
}

function clear(id) {
	win(id).bg.innerHTML = '';
	oshow(id, true);
}
