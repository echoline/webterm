.HTML "Webterm - An HTML5 Desktop
.TL
Webterm \(em An HTML5 Desktop Environment
.AU
Eli Cohen
echoline@gmail.com
.AB
.I Webterm
is an HTML5 remote desktop for use with Plan 9[1] which re-imagines drawterm[2] inside of a browser. The sourcecode is available at
.CW https://github.com/echoline/webterm
.AE
.NH
Introduction
.PP
.I Webterm
is an HTML5 remote desktop. Like drawterm, it is a remote desktop login to a Plan 9 CPU server. It tries to be backwards-compatible with the
.CW draw
device for graphics, so it can run most existing graphical Plan 9 programs. It also has a
.CW dom
device for HTML5 programs.
.NH
Drawterm
.PP
.I Drawterm
is a bit hard to explain without some experience with Plan 9. It's basically a lot of the functionality of a Plan 9 kernel implemented in portable C for non-Plan 9 systems. It's a remote desktop program, but it's also more. On Plan 9, the GUI is an integral part of the system, unlike on most Unix-like operating systems. Graphics are handled through the
.CW draw
device, at /dev/draw. Typically the kernel sets up a framebuffer and connecting to the draw device allows programs to draw graphics primitives to the framebuffer, instead of accessing the screen directly. For example, there is a specific message to the draw device for drawing an ellipse. Drawterm is a draw device and a few other components of a Plan 9 terminal used for logging into a Plan 9 CPU server from a different system. Drawterm differs from a Plan 9 terminal in that it cannot actually run Plan 9 programs, all of the programs run on the CPU server. For people familiar with SSH, drawterm does everything SSH does for a system where graphics, a mouse, and networking were always part of the design.
.NH
Webterm
.PP
.I Webterm
is a spinoff of drawterm for browsers. Webterm was an exploration in synthesizing Plan 9 ideas with a browser. Webterm cannot do everything drawterm does, for security reasons. For example, drawterm exposes the shell and storage of the host it runs on, obviously this cannot (and should not) be done from a webpage. Overall webterm can do much less than drawterm from a technical viewpoint, but it was easy to implement a filesystem around the Javascript Document Object Model[3], available at /dev/dom, and utilize features built into the browser. For example, alpha transparency was already available as simple CSS. Backwards compatibility with /dev/draw was harder, eventually I just followed aiju's lead with her jsdrawterm[4] and compiled the draw code to Javascript with emscripten.
.NH
Login
.PP
Plan9front introduced the
.CW dp9ik
authentication protocol and associated programs for logging into CPU servers. Before dp9ik, Plan 9-to-Plan 9 CPU and other-to-Plan 9 drawterm connections were authenticated with the older DES-based
.CW p9sk1
protocol. Webterm uses a Javascript implementation of dp9ik and the corresponding TLS encryption. The way logins are handled on Plan 9 is a simple and interesting method. On Plan 9, not only is everything a file, the 9P[5] filesystem protocol is a simple bytestream. The authentication is done, then after logging in, with dp9ik the client sends a small shell script. The script sets things up on the server to mount the network connection at
.CW /mnt/term,
with the client exporting a 9P namespace over the connection. In this way the filesystem of the client, in this case webterm, becomes available in the namespace of the login to the server at
.CW /mnt/term.
The code for all of this was entirely rewritten in Javascript, though not particularly well, which was very enlightening about Plan 9's minimal, well-designed, and unique login process.
.NH
9P
.PP
9P is a bytestream filesystem protocol. It can be transported over basically any link, even inside another 9P file. It's a simple protocol with messages for filesystem operations. A file in 9P is a generalized system object that can be opened, read from, written to, closed, etc. A file isn't necessarily data on a disk, it can represent other things. For example, writing raw PCM samples to /dev/audio causes them to come out of the speakers.
.PP
Plan 9 is simply a 9P multiplexer, hardware drivers, some Unix-like programs and sometimes the ability to run them, and not much else. This is where it gets a little foreign from a Unix viewpoint. Drawterm really is a Plan 9 kernel, but can't run programs. In some alternate universe where PC's never took off, a draw terminal is the logical completion of the idea of a dumb terminal. It just logs in and shares a screen, keyboard, mouse, and maybe some storage to a server over some kind of link. 9P is the filesystem protocol which allows everything not only to be a file, but to be transported easily across any medium. In this case the browser shares a Javascript 9P filesystem to the CPU which is transported over a websocket.
.NH
DOM Filesystem
.PP
Before completing devdraw backwards-compatibility support as mentioned above, I implemented a filesystem for the Javascript Document Object Model. Most people who know web shit are familiar with this, not to jump on the community bandwagon quite too much. XML documents are a tree, like a filesystem. Exposing the XML document of the webterm page through 9P was extremely easy. There is a /dev/dom directory, which is the top-level tag. The tags nest naturally, mapping very well to a hierarchical filesystem view. Writing to the files in /dev/dom can change the innerHTML or value, and attributes of tags.
.NH
Kludges for the Future
.PP
Plan 9 is in a unique position to exemplify good software engineering, even for modern applications. The Plan 9 community knows very well the history of grid computing and terminals, an almost-forgotten precursor to cloud computing and browsers. The browser was never really meant for any of the things we see today, and a real desktop inside of a modern browser is simply reaching too far.
.PP
The community viewpoint of the many drawbacks of browsers were made more abundantly obvious in creating webterm than ever. First of all it wasn't standardized very well at all. The first step was an innerHTML file to "draw" html to the window, and soon it became apparent textarea and input tags don't work that way. There are probably all sorts of other edge-cases which do not work but for which it would be very easy to add functionality.
.PP
Over long distances it doesn't work as quickly as drawterm over the same connection. Not only does it have the websocket overhead, TLS had to be implemented again entirely in Javascript. The 9P files local to the browser are all written in Javascript as well. It ends up very slow. One idea that could speed up browser technology in general is "bttp://," Bittorrent Transfer Protocol. There are a whole lot of details to work out for a thing like that, but if it were eventually done, the more users online at the same time, the faster it would be. Instead of getting slower under load it would get faster.
.PP
Cross-site scripting attacks are a huge concern with webterm. For a desktop in a browser, what can you do if you want to include things from other sites? I propose the <sframe/> tag, a secure iframe which is basically all the same functionality as a separate tab. It would be a container as much as possible, the same as a tab. It would ideally have absolutely no interaction with the page it was on, aside from being an opaque HTML element on it.
.NH
References
.PP
1.
.CW https://en.wikipedia.org/wiki/Plan_9_from_Bell_Labs
.PP
2.
.CW https://man.cat-v.org/plan_9/8/drawterm
.PP
3.
.CW https://www.w3schools.com/js/js_htmldom.asp
.PP
4.
.CW https://github.com/aiju/jsdrawterm
.PP
5.
.CW https://9p.cat-v.org
