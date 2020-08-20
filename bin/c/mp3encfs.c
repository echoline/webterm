#include <u.h>
#include <libc.h>
#include <thread.h>
#include <fcall.h>
#include <9p.h>

char used = 0;

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
	int *pipefds;
	char *p;
	char a;
	int c;

	if (strcmp(f->name, "audio") != 0 || !used) {
		respond(r, "no.");
		return;
	}

	pipefds = f->aux;

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
	int *pipefds = arg;
	int mp3fd = open("/dev/mp3", OWRITE);
	char *argv[] = {"/bin/audio/mp3enc", "-r", nil};
	
	if (mp3fd < 0)
		sysfatal("open /dev/mp3: %r");

	close(0);
	dup(pipefds[1], 0);
	close(pipefds[1]);
	close(1);
	dup(mp3fd, 1);
	close(mp3fd);

	procexec(nil, "/bin/audio/mp3enc", argv);
}

void
threadmain(int argc, char **argv)
{
	int pipefds[2];
	Waitmsg *waitmsg;
	Channel *waitchan;

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

	waitchan = threadwaitchan();
	
	proccreate(mp3encproc, pipefds, mainstacksize);

	fs.tree = alloctree(nil, nil, DMDIR|0777, nil);
	createfile(fs.tree->root, "audio", nil, 0222, pipefds);
	threadpostmountsrv(&fs, nil, "/dev", MBEFORE);

	waitmsg = recvp(waitchan);
	free(waitmsg);

	threadexitsall(nil);
}
