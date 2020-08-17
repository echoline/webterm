#include <u.h>
#include <libc.h>
#include <thread.h>
#include <fcall.h>
#include <9p.h>

File *fwdir;
char *cwdir;
char rwdir = 0;

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

	if (f == fwdir && rwdir == 0) {
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

		respond(r, nil);
		return;
	}

	respond(r, "no");
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
		respond(r, nil);
	}
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
	snprint(buf, 255, "/proc/%d/notepg", pid);
	out = open(buf, OWRITE);
	if (out < 0) {
		fprint(2, "error: open %s: %r\n", buf);
		close(in);
		return;
	}
	while((r = read(in, buf, 255)) > 0) {
		if (write(out, buf, r) != r) {
			fprint(2, "error: write note: %r\n");
			break;
		}
	}
	if (r < 0)
		fprint(2, "error: read /dev/cpunote: %r\n");
	close(in);
	close(out);
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
threadmain(int argc, char **argv) {
	char *cmd = "/bin/rc";
	char buf[256];
	char winid[16];
	int pid;
	int r;
	Channel *cpid;
	Channel *waitchan;
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
	if ((r = readn(newfd, winid, 12)) != 12)
		exits("read new");
	winid[r] = '\0';
	snprint(buf, 255, "/dev/hsys/%d", atoi(winid));
	bind(buf, "/dev", MBEFORE|MCREATE);
	close(0);
	if(open("/dev/cons", OREAD) < 0){
		fprint(2, "can't open /dev/cons: %r\n");
		exits("/dev/cons");
	}
	close(1);
	if(open("/dev/cons", OWRITE) < 0){
		fprint(2, "can't open /dev/cons: %r\n");
		exits("open");	/* BUG? was terminate() */
	}
	dup(1, 2);

	fs.tree = alloctree(nil, nil, DMDIR|0777, nil);
	fwdir = createfile(fs.tree->root, "wdir", nil, 0666, nil);
	cwdir = malloc(8192);
	getwd(cwdir, 8192);
	threadpostmountsrv(&fs, nil, "/dev", MBEFORE);

	waitchan = threadwaitchan();
	proccreate(noteproc, cpid, mainstacksize);
	proccreate(waitproc, waitchan, mainstacksize);
	procexec(cpid, cmd, args);
	sysfatal("exec: %r");
}

