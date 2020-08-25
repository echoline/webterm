#include <u.h>
#include <libc.h>

#define BUFSIZE 4096

char *pid;

void
load(char *filename)
{
	char *js = "hedit%slog = '';\n"
		"hedit%ssent = 0;\n"
		"hedit%sread = [];\n"
		"mkfile('/hedit%s', function(f, p) {\n"
		"	if (f.f.used)\n"
		"		return 'file in use';\n"
		"	f.f.used = true;\n"
		"}, function(f, p) {\n"
		"	hedit%sread.push(p);\n"
		"}, undefined, function(f) {\n"
		"	f.f.used = false;\n"
		"});\n"
		"hedit%s = function(s) {\n"
		"	hedit%slog += s + '\\n'\n"
		"	while (hedit%sread.length > 0 && hedit%ssent < hedit%slog.length) {\n"
		"		var p = hedit%sread.shift();\n"
		"		var buf = hedit%slog.substring(p.offset, p.offset+p.count);\n"
		"		respond(p, buf);\n"
		"		hedit%ssent += buf.length;\n"
		"	}\n"
		"}\n";

	char *html = "<table style=\"width:100%%; height:100%%;\"><tbody><tr><td>filename:</td><td width=\"100%%\">\n"
		"<input style=\"width:98%%\" type=\"text\" value=\"%s\" spellcheck=\"false\" id=\"filename%s\"/></td>\n"
		"<td><input type=\"button\" value=\"open\" onclick=\"javascript:hedit%s('open');\"/></td>\n"
		"<td><input type=\"button\" value=\"save\" onclick=\"javascript:hedit%s('save');\"/></td>\n"
		"<td><input type=\"button\" value=\"quit\" onclick=\"javascript:hedit%s('quit');\"/></td></tr>\n"
		"<tr style=\"height:100%%\"><td colspan=\"5\" style=\"height:100%%\">\n"
		"<textarea style=\"width:99%%;height:100%%;display:block;white-space:nowrap;overflow:auto;\" spellcheck=\"false\" onkeydown=\"javascript:if(event.which == 9) { var pos = this.selectionStart; this.value = this.value.substring(0, this.selectionStart) + String.fromCharCode(event.which) + this.value.substring(this.selectionEnd); this.selectionStart = this.selectionEnd = pos + 1; event.preventDefault(); return false; }\"></textarea>\n"
		"<div style=\"display:none;\"></div>\n"
		"</td></tr></tbody></table>\n";

	int fd = open("/dev/js", OWRITE|OTRUNC);
	if (fd < 0)
		sysfatal("open /dev/js: %r");
	if (fprint(fd, js, pid, pid, pid, pid, pid, pid, pid, pid, pid, pid, pid, pid, pid) < 0)
		sysfatal("write /dev/js: %r");
	close(fd);

	fd = open("/dev/innerHTML", OWRITE|OTRUNC);
	if (fd < 0)
		sysfatal("open /dev/innerHTML: %r");
	if (fprint(fd, html, filename, pid, pid, pid, pid) < 0)
		sysfatal("write /dev/innerHTML: %r");
	close(fd);
}

void
cleanup(void)
{
	int fd, fd2;
	char buf[16];

	fd = open("/dev/js", OWRITE|OTRUNC);
	if (fd < 0)
		sysfatal("open /dev/js: %r");

	fprint(fd, "hedit%slog = undefined;\n"
		"hedit%ssent = undefined;\n"
		"hedit%sread = undefined;\n"
		"hedit%s = undefined;\n"
		"rmfile('/hedit%s');\n", pid, pid, pid, pid, pid);

	close(fd);

	fd = open("/dev/innerHTML", OWRITE|OTRUNC);
	if (fd < 0)
		sysfatal("open /dev/innerHTML: %r");

	fprint(fd, "");
	close(fd);

	fd = open("/dev/label", OWRITE|OTRUNC);
	if (fd > 0) {
		fd2 = open("/dev/winid", OREAD);
		if (fd2 > 0) {
			if (read(fd2, buf, 16) > 0) {
				fprint(fd, "%d", atoi(buf));
			}
			close(fd2);
		}
		close(fd);
	}
}

int
atnotifycb(void *v, char *s)
{
	cleanup();
	return 1;
}

void
readfilename(char *filename)
{
	int r, len;
	int fd = open("/dev/dom/0/children/0/children/0/children/1/children/0/value", OREAD);
	if (fd < 0)
		sysfatal("open filename: %r");

	len = 0;
	while (len < BUFSIZE-1 && (r = read(fd, filename+len, BUFSIZE-1-len)) > 0)
		len += r;

	if (r < 0)
		sysfatal("read filename: %r");

	filename[len] = '\0';

	close(fd);
}

void
setlabel(char *s, char *filename)
{
	char *label = smprint("%s: %s", filename, s);
	if (label == nil)
		sysfatal("smprint label: %r");
	int labelfd = open("/dev/label", OWRITE|OTRUNC);
	if (labelfd > 0) {
		write(labelfd, label, strlen(label));
		close(labelfd);
	}
	free(label);
}

void
savefile(char *filename)
{
	int in, out;
	char *info;
	int r;
	char buf[BUFSIZE];

	readfilename(filename);

	in = open("/dev/dom/0/children/0/children/1/children/0/children/0/value", OREAD);
	if (in < 0)
		sysfatal("open textarea: %r");

	out = create(filename, OWRITE|OTRUNC, 0664);
	if (out < 0)
		info = smprint("save: %r");
	else {
		while((r = read(in, buf, BUFSIZE)) > 0) {
			if ((r = write(out, buf, r)) < 0)
				break;
		}
		if (r < 0)
			info = smprint("save: %r");
		else
			info = smprint("saved");

		close(out);
	}

	close(in);
	setlabel(filename, info);
	free(info);
}

void
openfile(char *filename)
{
	int in, out, style;
	char *info;
	int r, i, l, k;
	char buf[BUFSIZE];
	Dir *dir;
	char *s;
	char m;
	int *sorted;
	char *link;

	readfilename(filename);

	dir = dirstat(filename);
	if (dir != nil) {
		if (dir->mode & DMDIR) {
			free(dir);

			style = open("/dev/dom/0/children/0/children/1/children/0/children/0/attributes/style", OWRITE|OTRUNC);
			if (style < 0)
				sysfatal("open style attribute: %r");
			fprint(style, "display:none;");
			close(style);

			style = open("/dev/dom/0/children/0/children/1/children/0/children/1/attributes/style", OWRITE|OTRUNC);
			if (style < 0)
				sysfatal("open style attribute: %r");
			fprint(style, "width:99%%;height:100%%;display:block;border:solid 1px black;font-family:monospace;overflow:scroll;");
			close(style);

			out = open("/dev/dom/0/children/0/children/1/children/0/children/1/innerHTML", OWRITE|OTRUNC);
			if (out < 0)
				sysfatal("open directory div: %r");

			in = open(filename, OREAD);
			if (in < 0) {
				close(out);
				info = smprint("open directory: %r");
				setlabel(filename, info);
				free(info);
				return;
			}
			k = strlen(filename);
			if (k > 0)
				k--;
			if (filename[k] == '/')
				filename[k] = '\0';
			snprint(buf, BUFSIZE-1, "%s", filename);
			s = strrchr(buf, '/');
			if (s)
				*s = '\0';
			if (strlen(buf) == 0)
				snprint(buf, 2, "/");
			s = smprint("<a href=\"javascript:document.getElementById('filename%s').value='%s';hedit%s('open');\">../</a><br/>\n", pid, buf, pid);
			if (s == nil)
					sysfatal("calloc: %r");
			if((r = dirreadall(in, &dir)) > 0) {
				sorted = calloc(r, sizeof(int));
				if (sorted == nil)
					sysfatal("calloc: %r");
				for (i = 0; i < r; i++)
					sorted[i] = i;
				for (i = 0; i < r; i++) {
					for (k = i + 1; k < r; k++) {
						if (strcmp(dir[sorted[i]].name, dir[sorted[k]].name) > 0) {
							l = sorted[i];
							sorted[i] = sorted[k];
							sorted[k] = l;
						}
					}
				}
				for (i = 0; i < r; i++) {
					l = strlen(s);
					m = ' ';
					if (dir[sorted[i]].mode & DMDIR) {
						m = '/';
					} else if (dir[sorted[i]].mode & DMEXEC) {
						m = '*';
					}
					link = smprint("<a href=\"javascript:document.getElementById('filename%s').value='%s/%s';hedit%s('open');\">%s%c</a><br/>\n", pid, filename, dir[sorted[i]].name, pid, dir[sorted[i]].name, m);

					k = strlen(link);
					s = realloc(s, l+k+1);
					if (s == nil)
						sysfatal("realloc: %r");
					snprint(s + l, k, "%s", link);
					free(link);
				}
				free(sorted);
				free(dir);
			}
			fprint(out, "%s", s);
			free(s);
			close(in);
			close(out);

			if (filename[0] == '\0')
				sprint(filename, "/");
			info = smprint("directory contents");
			setlabel(filename, info);
			free(info);

			return;
		} else
			free(dir);
	}

	style = open("/dev/dom/0/children/0/children/1/children/0/children/1/attributes/style", OWRITE|OTRUNC);
	if (style < 0)
		sysfatal("open style attribute: %r");
	fprint(style, "display:none;");
	close(style);

	style = open("/dev/dom/0/children/0/children/1/children/0/children/0/attributes/style", OWRITE|OTRUNC);
	if (style < 0)
		sysfatal("open style attribute: %r");
	fprint(style, "width:99%%;height:100%%;display:block;white-space:nowrap;overflow:auto;");
	close(style);

	out = open("/dev/dom/0/children/0/children/1/children/0/children/0/value", OWRITE|OTRUNC);
	if (out < 0)
		sysfatal("open textarea: %r");

	in = open(filename, OREAD);
	if (in < 0)
		info = smprint("open: %r");
	else {
		while((r = read(in, buf, BUFSIZE)) > 0) {
			if ((r = write(out, buf, r)) < 0)
				break;
		}
		if (r < 0)
			info = smprint("open: %r");
		else
			info = smprint("opened");

		close(in);
	}

	close(out);
	setlabel(filename, info);
	free(info);
}

void
main(int argc, char **argv)
{
	char filename[BUFSIZE];
	int running = 1;
	char ctlfilename[128];
	int ctlfd;
	char cmd[16];

	memset(cmd, 0, 16);
	memset(filename, 0, sizeof(filename));
	getwd(filename, BUFSIZE);
	if (argc > 1 && argv[1][0] != '\0')
		strncpy(filename, argv[1], BUFSIZE-1);

	pid = getenv("pid");
	atexit(&cleanup);
	atnotify(&atnotifycb, 1);

	load(filename);
	openfile(filename);

	snprint(ctlfilename, 128-1, "/mnt/term/hedit%s", pid);
	ctlfd = open(ctlfilename, OREAD);
	if (ctlfd < 0)
		sysfatal("open ctl file: %r");

	while(readn(ctlfd, cmd, 5) > 0) {
		if (strncmp(cmd, "quit\n", 5) == 0)
			exits(nil);
		else if (strncmp(cmd, "save\n", 5) == 0)
			savefile(filename);
		else if (strncmp(cmd, "open\n", 5) == 0)
			openfile(filename);
	}
}
