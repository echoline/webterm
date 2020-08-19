#include <u.h>
#include <libc.h>
#include <thread.h>
#include <fcall.h>
#include <9p.h>

File *fwdir;
char *cwdir;
char rwdir = 0;

int winid;

void
fswrite(Req *r)
{
	File *f = r->fid->file;
	vlong offset = r->ifcall.offset;
	int count = r->ifcall.count;
	char *p, *b;

	r->ofcall.count = 0;

	if (count == 0) {
		respond(r, nil);
		return;
	}

	if (f == fwdir) {
		if (rwdir == 1) {
			respond(r, "no.");
			return;
		}

		p = (char*)r->ifcall.data;
		p[strcspn(p, "\n")] = '\0';

		if (strlen(p) != 0) {
			if (p[0] == '/')
				b = smprint("%.*s", count, p);
			else
				b = smprint("%s/%.*s", cwdir, count, p);

			if (b == nil) {
				respond(r, "no memory");
				return;
			}

			free(cwdir);
			cwdir = cleanname(b);
		}
	}
	else {
		respond(r, "wtf");
		return;
	}

	respond(r, nil);
}

void
fsread(Req *r)
{
	File *f = r->fid->file;
	vlong offset = r->ifcall.offset;
	int count = r->ifcall.count;
	int len;
	char *p;

	r->ofcall.count = 0;

	if (count == 0) {
		respond(r, nil);
		return;
	}

	if (f == fwdir) {
		rwdir = 1;
		len = strlen(cwdir);

		if (offset >= len) {
			rwdir = 0;
			respond(r, nil);
			return;
		}

		len -= offset;

		if (len < count)
			count = len;

		r->ofcall.count = count;
		p = (char*)r->ofcall.data;
		memmove(p, &cwdir[offset], count);
		rwdir = 0;
	}
	else {
		respond(r, "wtf");
		return;
	}

	respond(r, nil);
}

Srv fs = {
	.read=		fsread,
	.write=		fswrite,
};

int newfd;

void
noteproc(void *arg) {
	char buf[256];
	int out;
	int in;
	int r;
	int pid;

	pid = recvul((Channel*)arg);
	in = open("/dev/cpunote", OREAD);
	if (in < 0) {
		fprint(2, "error: open /dev/cpunote: %r\n");
		return;
	}
	snprint(buf, sizeof(buf), "/proc/%d/notepg", pid);
	out = open(buf, OWRITE);
	if (out < 0) {
		fprint(2, "error: open %s: %r\n", buf);
		close(in);
		return;
	}
	while((r = read(in, buf, sizeof(buf))) > 0) {
		if (write(out, buf, r) != r) {
			fprint(2, "error: write /dev/cpunote: %r\n");
			break;
		}
	}
	if (r < 0)
		fprint(2, "error: read /dev/cpunote: %r\n");
	write(out, "hangup", 6);
	close(in);
	close(out);
}

int
reducematch(char *ccomp)
{
	Dir *dir;
	int dfd;
	int ret = 0;
	int last = -1;
	char *matches;
	int i, j, l, m, n, r;
	char *b;
	char *p;
	
	if (strcmp(ccomp, ".") == 0 || strcmp(ccomp, "..") == 0 || strcmp(ccomp, "/") == 0) {
		return 0;
	}

	b = smprint("%s", ccomp);
	p = strrchr(b, '/');
	l = strlen(b);

	if (p) {
		if (p == b) {
			b = realloc(b, l+2);
			memmove(b+1, b, l+1);
			b[1] = '\0';
			p = b + 2;
		} else if ((p-b+1)<l) {
			*p++ = '\0';
		} else {
			*p = '\0';
			p = strrchr(b, '/');
			if (p)
				*p++ = '\0';
		}
	}	
	if (!p) {
		p = b;
		b = smprint("./%s", p);
		free(p);
		b[1] = '\0';
		p = b + 2;
	}

	if ((dir = dirstat(b)) != nil) {
		free(dir);

		dfd = open(b, OREAD);
		if ((n = dirreadall(dfd, &dir)) > 0) {
			matches = malloc(n);
			while (ret > last) {
				last = ret;
				memset(matches, 0, n);
				l = strlen(p);
				m = 0;
				for (i = 0; i < n; i++) {
					if (strncmp(p, dir[i].name, l) == 0) {
						matches[i] = 1;
						if (dir[i].name[l] != '\0')
							m = dir[i].name[l];
					}
				}
				r = 0;
				if (m) {
					r = 1;
					for (i = 0; i < n; i++) {
						if (matches[i] && (m != dir[i].name[l])) {
							r = 0;
							break;
						}
					}
				}
				if (r) {
					ret++;
					l = strlen(b) + strlen(p) + 1;
					b = realloc(b, l + 3);
					b[l] = m;
					b[l+1] = '\0';
				}
			}
			m = 0;
			l = strlen(p);
			for (i = 0; i < n; i++)
				if (strncmp(p, dir[i].name, l) == 0) {
					m++;
					if (m > 1) {
						ret = -1;
						break;
					}
				}
			b[strlen(b)] = '/';
			snprint(ccomp, 4095, "%s", cleanname(b));
			free(dir);
			free(matches);
		}
		close(dfd);
	}

	free(b);
	return ret;
}

void
completeproc(void *arg)
{
	char *buf = malloc(4096);
	int fd;
	int r;
	char *b;
	Dir *dir;
	
	fd = open("/dev/complete", ORDWR);
	if (fd < 0) {
		fprint(2, "error: open /dev/complete: %r\n");
		return;
	}
	while((r = read(fd, buf, 4095)) > 0) {
		chdir(cwdir);

		buf[r] = '\0';

		do {
			dir = dirstat(buf);
			if (dir != nil) {
				if (!reducematch(buf)) {
					if (dir->mode & DMDIR) {
						if (strcmp(buf, "/") == 0)
							b = smprint("/");
						else
							b = smprint("%s/", cleanname(buf));
					}
					else {
						b = smprint("%s ", cleanname(buf));
					}
					snprint(buf, 4095, "%s", b);
					free(b);
					free(dir);
					break;
				}
				free(dir);
			}
		} while(reducematch(buf) > 0);
		r = strlen(buf);

		if (write(fd, buf, r) != r) {
			fprint(2, "error: write /dev/complete: %r\n");
			break;
		}
	}
	if (r < 0)
		fprint(2, "error: read /dev/complete: %r\n");
	free(buf);
	close(fd);
}

void
waitproc(void *arg)
{
	Waitmsg *msg = recvp((Channel*)arg);
	free(msg);
	close(newfd);
	threadexitsall(nil);
}

void
kbdfsproc(void *arg)
{
	char buf[256];
	char *argv[] = {"/bin/aux/kbdfs", "-dq", "-m", buf, nil};

	snprint(buf, sizeof(buf), "/mnt/term/kbdfs/%d", winid);
	bind(buf, "/dev", MAFTER);

	close(0);
	if(open("/dev/cons", OREAD) < 0){
		sysfatal("open /dev/cons: %r");
	}
	close(1);
	if(open("/dev/cons", OWRITE) < 0){
		sysfatal("open /dev/cons: %r");
	}
	dup(1, 2);

	procexec(nil, "/bin/aux/kbdfs", argv);

	sysfatal("exec: %r");
}

void
threadmain(int argc, char **argv) {
	char *cmd = "/bin/rc";
	char buf[256];
	int pid;
	int r;
	Channel *cpid;
	Channel *waitchan;
	Waitmsg *waitmsg;
	char **args = argv;
	char *path;
	char *tok;
	char *name;
	Dir *dir;
	char *cmd2;

	if (argc > 1) {
		path = getenv("path");
		tok = strtok(path, " ");
		cmd = argv[1];
		args = &argv[1];
		do {
			name = smprint("%s/%s", tok, cmd);
			if ((dir = dirstat(name)) != nil) {
				free(dir);
				cmd = name;
				break;
			}
			free(name);
		} while(strtok(nil, " ") != nil);
		free(path);
	}

	r = rfork(RFNAMEG|RFFDG|RFENVG|RFPROC);
	if (r == -1)
		sysfatal("fork: %r");
	if (r != 0)
		exits(nil);
	cpid = chancreate(sizeof(ulong), 0);
	newfd = open("/dev/hsys/new", OREAD);
	if (newfd < 0)
		exits("open new");
	if ((r = readn(newfd, buf, 12)) != 12)
		exits("read new");
	buf[r] = '\0';
	winid = atoi(buf);

	snprint(buf, sizeof(buf), "/dev/hsys/%d", winid);
	bind(buf, "/dev", MBEFORE|MCREATE);

	waitchan = threadwaitchan();
	proccreate(kbdfsproc, nil, mainstacksize);
	waitmsg = recvp(waitchan);
	free(waitmsg);

	snprint(buf, sizeof(buf), "/mnt/term/kbdfs/%d", winid);
	bind(buf, "/dev", MBEFORE);

	close(0);
	if(open("/dev/cons", OREAD) < 0){
		sysfatal("open /dev/cons: %r");
	}
	close(1);
	if(open("/dev/cons", OWRITE) < 0){
		sysfatal("open /dev/cons: %r");
	}
	dup(1, 2);

	fs.tree = alloctree(nil, nil, DMDIR|0777, nil);
	fwdir = createfile(fs.tree->root, "wdir", nil, 0666, nil);
	cwdir = malloc(8192);
	getwd(cwdir, 8192);
	threadpostmountsrv(&fs, nil, "/dev", MBEFORE);

	proccreate(noteproc, cpid, mainstacksize);
	proccreate(waitproc, waitchan, mainstacksize);
	proccreate(completeproc, nil, mainstacksize);
	procexec(cpid, cmd, args);
	sysfatal("exec: %r");
}

