</$objtype/mkfile

ui: ui.$O
	$O^l -o ui ui.$O

ui.$O: ui.c
	$O^c ui.c

clean:
	rm -f ui.[685qv] ui
