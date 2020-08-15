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
		"mkfile('/hedit%s', undefined,function(f, p) {\n"
		"	hedit%sread.push(p);\n"
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
		"<input style=\"width:98%%\" type=\"text\" value=\"%s\" spellcheck=\"false\"/></td>\n"
		"<td><input type=\"button\" value=\"open\" onclick=\"javascript:hedit%s('open');\"/></td>\n"
		"<td><input type=\"button\" value=\"save\" onclick=\"javascript:hedit%s('save');\"/></td>\n"
		"<td><input type=\"button\" value=\"quit\" onclick=\"javascript:hedit%s('quit');\"/></td></tr>\n"
		"<tr style=\"height:100%%\"><td colspan=\"5\" style=\"height:100%%\">\n"
		"<textarea style=\"width:99%%; height:100%%;\" spellcheck=\"false\" onkeydown=\"javascript:if(event.which == 9) { var pos = this.selectionStart; this.value = this.value.substring(0, this.selectionStart) + String.fromCharCode(9) + this.value.substring(this.selectionEnd); this.selectionStart = this.selectionEnd = pos + 1; return false; }\"/>\n"
		"</textarea></td></tr></tbody></table>\n";

	int fd = open("/dev/js", OWRITE|OTRUNC);
	if (fd < 0)
		sysfatal("open /dev/js: %r");
	if (fprint(fd, js, pid, pid, pid, pid, pid, pid, pid, pid, pid, pid, pid, pid, pid) < 0)
		sysfatal("write /dev/js: %r");
	close(fd);

	fd = open("/dev/innerHTML", OWRITE|OTRUNC);
	if (fd < 0)
		sysfatal("open /dev/innerHTML: %r");
	if (fprint(fd, html, filename, pid, pid, pid) < 0)
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
		info = smprint("open: %r");
	else {
		while((r = read(in, buf, BUFSIZE)) > 0) {
			if ((r = write(out, buf, r)) < 0)
				break;
		}
		if (r < 0)
			info = smprint("write: %r");
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
	int in, out;
	char *info;
	int r, i;
	char buf[BUFSIZE];
	Dir *dir;

	readfilename(filename);

	out = open("/dev/dom/0/children/0/children/1/children/0/children/0/value", OWRITE|OTRUNC);
	if (out < 0)
		sysfatal("open textarea: %r");

	dir = dirstat(filename);
	if (dir != nil) {
		if (dir->mode & DMDIR) {
			free(dir);
			in = open(filename, OREAD);
			if (in < 0) {
				close(out);
				info = smprint("open directory: %r");
				setlabel(filename, info);
				free(info);
				return;
			}
			if((r = dirreadall(in, &dir)) > 0) {
				for (i = 0; i < r; i++) {
					fprint(out, "%s", dir[i].name);
					if (dir[i].mode & DMDIR)
						fprint(out, "/");
					else if(dir[i].mode & DMEXEC)
						fprint(out, "*");
					fprint(out, "\n");
				}
				free(dir);
			}
			close(in);
			close(out);

			info = smprint("directory contents");
			setlabel(filename, info);
			free(info);

			return;
		} else
			free(dir);
	}

	in = open(filename, OREAD);
	if (in < 0)
		info = smprint("open: %r");
	else {
		while((r = read(in, buf, BUFSIZE)) > 0) {
			write(out, buf, r);
		}
		if (r < 0)
			info = smprint("read: %r");
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
	int labelfd;
	char cmd[16];

	memset(cmd, 0, 16);
	memset(filename, 0, sizeof(filename));
	if (argc > 1)
		strncpy(filename, argv[1], BUFSIZE-1);

	pid = getenv("pid");
	atexit(&cleanup);
	atnotify(&atnotifycb, 1);
	load(filename);

	labelfd = open("/dev/label", OWRITE|OTRUNC);
	if (labelfd > 0) {
		fprint(labelfd, "hedit");
		close(labelfd);
	}

	if (strlen(filename) > 0)
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
