#include <u.h>
#include <libc.h>
#include <thread.h>
#include <fcall.h>
#include <9p.h>

char used = 0;

typedef struct {
	int *pipefds;
	Channel *cpid;
	ulong pid;
} ProcInfo;

static void
fsopen(Req *r)
{
	File *f = r->fid->file;

	if (strcmp(f->name, "audio") == 0) {
		if (used) {
			respond(r, "file in use");	
			return;
		}
		used = 1;
	}
	respond(r, nil);
}

static void
fsdestroyfid(Fid *fid)
{
	File *f = fid->file;

	if (fid->omode != -1 && f && strcmp(f->name, "audio") == 0)
		used = 0;
}

static void
fswrite(Req *r)
{
	File *f = r->fid->file;
	ProcInfo *pinfo;
	int *pipefds;
	char *p;
	char a;
	int c;
	char *path;
	int fd;

	if (strcmp(f->name, "audio") != 0 || !used) {
		respond(r, "no.");
		return;
	}

	pinfo = f->aux;
	pipefds = pinfo->pipefds;

	if (r->ifcall.count == 0) {
		path = smprint("/proc/%d/note", pinfo->pid);
		if (path == nil)
			sysfatal("no memory");
		fd = open(path, OWRITE);
		if (fd < 0)
			sysfatal("open: %r");
		free(path);
		if (write(fd, "kill", 4) != 4)
			sysfatal("write: %r");
		close(fd);
		r->ofcall.count = 0;
		respond(r, nil);
		return;
	}

	p = r->ifcall.data;
	c = (r->ifcall.count>>1) & ~1;
	while (c--) {
		a = *p++;
		p[-1] = *p;
		*p++ = a;
	}

	r->ofcall.count = write(pipefds[0], r->ifcall.data, r->ifcall.count);

	respond(r, nil);
}

Srv fs = {
	.open		= fsopen,
	.write		= fswrite,
	.destroyfid	= fsdestroyfid,
};

void
mp3encproc(void *arg)
{
	ProcInfo *pinfo = arg;
	int *pipefds = pinfo->pipefds;
	int mp3fd = open("/dev/mp3", OWRITE);
	char *argv[] = {"/bin/audio/mp3enc", "-r", nil};
	
	if (mp3fd < 0) {
		fprint(pipefds[1], "open /dev/mp3: %r");
		exits("open");
	}
	fprint(pipefds[1], "success");

	close(0);
	dup(pipefds[1], 0);
	close(pipefds[1]);
	close(1);
	dup(mp3fd, 1);
	close(mp3fd);

	procexec(pinfo->cpid, "/bin/audio/mp3enc", argv);
}

void
threadmain(int argc, char **argv)
{
	int pipefds[2];
	Waitmsg *waitmsg;
	Channel *waitchan;
	char buf[256];
	int r;
	ProcInfo pinfo;

	if (pipe(pipefds) < 0)
		sysfatal("pipe: %r");

	switch(fork()) {
	case -1:
		sysfatal("fork: %r");
	case 0:
		break;
	default:
		exits(nil);
	}

	pinfo.pipefds = pipefds;
	pinfo.cpid = chancreate(sizeof(ulong), 0);

	waitchan = threadwaitchan();
	
	proccreate(mp3encproc, &pinfo, mainstacksize);

	if ((r = read(pipefds[0], buf, 255)) < 0)
		sysfatal("read: %r");
	buf[r] = '\0';
	if (strcmp(buf, "success") != 0)
		sysfatal(buf);

	pinfo.pid = recvul(pinfo.cpid);

	fs.tree = alloctree(nil, nil, DMDIR|0777, nil);
	createfile(fs.tree->root, "audio", nil, 0222, &pinfo);
	threadpostmountsrv(&fs, "mp3encfs", "/dev", MBEFORE);

	waitmsg = recvp(waitchan);
	free(waitmsg);

	unmount("#s/mp3encfs", "/dev");
	remove("#s/mp3encfs");

	threadexitsall(nil);
}
