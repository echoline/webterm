#include <u.h>
#include <libc.h>
#include <thread.h>

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
threadmain(int argc, char **argv) {
	char *cmd = "/bin/rc";
	char buf[256];
	char winid[16];
	int pid;
	int fd;
	int r;
	Channel *cpid;

	rfork(RFNAMEG|RFFDG|RFENVG);
	cpid = chancreate(sizeof(ulong), 0);
	fd = open("/dev/hsys/new", OREAD);
	if (fd < 0)
		exits("open new");
	if ((r = read(fd, winid, 15)) <= 0)
		exits("read new");
	winid[r] = '\0';
	close(fd);
	snprint(buf, 255, "/dev/hsys/%s", winid);
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
	proccreate(noteproc, cpid, mainstacksize);
	procexec(cpid, cmd, argv);
	sysfatal("exec: %r");
}

