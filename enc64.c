#include <u.h>
#include <libc.h>

void
main(int argc, char **argv)
{
	char buf[8192];
	char *data;
	ulong len = 0;
	int r;

	fmtinstall('[', encodefmt);

	while ((r = read(0, buf, 8191)) > 0) {
		data = realloc(data, len + r);
		memcpy(data + len, buf, r);
		len += r;
	}

	print("%.*[\n", len, data);
}
