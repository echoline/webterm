ROOT=.

include ./Make.config

LIBS=\
	libc/libc.a\
	libmemdraw/libmemdraw.a\
	libmemlayer/libmemlayer.a\
	libdraw/libdraw.a\

default: $(TARG)
$(TARG): $(LIBS)
	$(CC) $(LDFLAGS) -o $(TARG) $(OFILES) $(LIBS) $(LDADD)

.PHONY: clean
clean:
	rm -f *.o */*.o */*.a *.a blob.js blob.wasm

.PHONY: libc/libc.a
libc/libc.a:
	(cd libc; $(MAKE))

.PHONY: libmemdraw/libmemdraw.a
libmemdraw/libmemdraw.a:
	(cd libmemdraw; $(MAKE))

.PHONY: libmemlayer/libmemlayer.a
libmemlayer/libmemlayer.a:
	(cd libmemlayer; $(MAKE))

.PHONY: libdraw/libdraw.a
libdraw/libdraw.a:
	(cd libdraw; $(MAKE))
