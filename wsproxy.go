package main

import (
	"golang.org/x/net/websocket"
	"encoding/base64"
	"flag"
	"io"
	"log"
	"net"
	"fmt"
	"net/http"
)

var authsrv = flag.String("a", "cloud9.echoline.org:567", "auth server to proxy to")
var rcpusrv = flag.String("c", "cloud9.echoline.org:17019", "rcpu server to proxy to")

var listen = flag.String("l", ":8443", "websocket server bind address")

func main() {
	flag.Parse()

	http.Handle("/auth", websocket.Handler(func(ws *websocket.Conn) { wsHandler(ws, *authsrv) }))
	http.Handle("/rcpu", websocket.Handler(func(ws *websocket.Conn) { wsHandler(ws, *rcpusrv) }))
	if err := http.ListenAndServeTLS(*listen, "server.crt", "server.key", nil); err != nil {
		log.Fatal(err)
	}
}

func wsHandler(ws *websocket.Conn, addr string) {
	var buf [2048]byte
	var ebuf [4096]byte

	defer ws.Close()
	fmt.Print("Dialing ", addr, "... ")
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		fmt.Println("error.")
		return
	}
	fmt.Println("success.")
	defer conn.Close()
	go func() {
		io.Copy(conn, base64.NewDecoder(base64.StdEncoding, ws))
		conn.Close()
		ws.Close()
	}()
	for {
		n, err := conn.Read(buf[:])
		if err != nil {
			conn.Close()
			ws.Close()
			return
		}
		base64.StdEncoding.Encode(ebuf[:], buf[:n])
		ws.Write(ebuf[:base64.StdEncoding.EncodedLen(n)])
	}
}
