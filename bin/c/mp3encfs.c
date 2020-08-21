#include <u.h>
#include <libc.h>
#include <thread.h>
#include <fcall.h>
#include <9p.h>

char used = 0;

typedef struct {
	int *pipefds;
	Channel *cpid;
	int pid;
	char *srv;
	Channel *waitchan;
	Channel *reqchan;
} ProcInfo;

void
writeproc(void *arg)
{
	ProcInfo *pinfo = arg;
	int *pipefds = pinfo->pipefds;
	Req *r;
	int n;
	int c;
	char *p;
	char a;

	threadsetname("writeproc");

	while((r = recvp(pinfo->reqchan)) != nil) {
		n = r->ifcall.count;
		c = n/2;
		p = r->ifcall.data;

		while(c--) {
			a = *p++;
			p[-1] = *p;
			*p++ = a;
		}

		r->ofcall.count = write(pipefds[0], r->ifcall.data, n);
		respond(r, nil);
	}
}

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

	if (strcmp(f->name, "audio") != 0 || !used) {
		respond(r, "no.");
		return;
	}

	if (r->ifcall.count == 0) {
		r->ofcall.count = 0;
		respond(r, nil);
		return;
	}

	pinfo = f->aux;

	sendp(pinfo->reqchan, r);
}

Srv fs = {
	.open		= fsopen,
	.write		= fswrite,
	.destroyfid	= fsdestroyfid,
};

void
mp3proc(void *p)
{
	char *args[] = {"/bin/audio/mp3enc", "-r", nil};
	ProcInfo *pinfo = p;
	int *pipefds = pinfo->pipefds;
	int mp3fd = open("/dev/mp3", OWRITE);
	if (mp3fd < 0)
		sysfatal("open /dev/mp3: %r");

	close(0);
	dup(pipefds[1], 0);
	close(pipefds[1]);
	close(1);
	dup(mp3fd, 1);
	close(mp3fd);

	procexec(pinfo->cpid, args[0], args);
	sysfatal("procexec: %r");
}

void
waitproc(void *p)
{
	ProcInfo *pinfo = p;
	Channel *waitchan = pinfo->waitchan;
	char *s = pinfo->srv;

	threadsetname("waitproc");
	
	Waitmsg *waitmsg = recvp(waitchan);
	free(waitmsg);

	unmount(s, "/dev");
	remove(s);

	threadexitsall(nil);
}

void
threadmain(int argc, char **argv)
{
	int pipefds[2];
	char s[256];
	ProcInfo pinfo;

	if (pipe(pipefds) < 0)
		sysfatal("pipe: %r");

	pinfo.waitchan = threadwaitchan();
	pinfo.pipefds = pipefds;
	pinfo.cpid = chancreate(sizeof(ulong), 0);
	pinfo.reqchan = chancreate(sizeof(Req*), 1);
	proccreate(mp3proc, &pinfo, mainstacksize);
	proccreate(writeproc, &pinfo, mainstacksize);
	pinfo.pid = recvul(pinfo.cpid);

	snprint(s, sizeof(s), "mp3enc.%s.%d", getuser(), pinfo.pid);
	fs.tree = alloctree(nil, nil, DMDIR|0777, nil);
	createfile(fs.tree->root, "audio", nil, 0222, &pinfo);
	threadpostmountsrv(&fs, s, "/dev", MBEFORE|MCREATE);

	memmove(s+3, s, sizeof(s)-3);
	memcpy(s, "#s/", 3);

	pinfo.srv = s;
	proccreate(waitproc, &pinfo, mainstacksize);

	threadexits(nil);
}
