</$objtype/mkfile

hwin: hwin.$O
	$O^l -o hwin hwin.$O

hwin.$O: hwin.c
	$O^c hwin.c

install: hwin
	cp hwin /$objtype/bin/hwin

clean:
	rm -f hwin.[685qv] hwin
