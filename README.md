# HTTP Server From Scratch

An HTTP/1.1 web server built from scratch in TypeScript on raw TCP sockets, without frameworks or Node's built-in `http` module.

> 🚧 **Work in progress.** I'm building this step by step. See the [roadmap](#roadmap) for what's done and what's next.

## Why

I build full-stack apps with React, React Native, and TypeScript, and frameworks like Express handle most of the networking for me. I started this project to learn what happens underneath: how bytes on a TCP connection become an HTTP request, how a response is streamed back, and how a connection is upgraded to a WebSocket.

## Roadmap

- [ ] TCP server using Node's `net` module
- [ ] Promise-based wrapper around socket reads and writes
- [ ] Parsing HTTP/1.1 requests (request line, headers, body)
- [ ] Routing and generating responses
- [ ] Keep-alive connections
- [ ] Dynamic content with chunked transfer encoding
- [ ] Serving static files
- [ ] Range requests (partial content)
- [ ] HTTP caching headers (`ETag`, `Last-Modified`)
- [ ] Response compression (gzip)
- [ ] WebSockets
- [ ] **My own addition:** _TBD (rate limiting, or a benchmark against Express)_

## Getting Started

**Requirements:** Node.js 18+

```bash
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>
npm install
npm run build
npm start
```

Then, in another terminal:

```bash
curl -v http://localhost:<port>/
```

## Project Structure

_To be filled in as the project grows._

## What I Learned

_Notes on the trickiest parts: bugs I hit, design decisions, and how this changed the way I think about web frameworks._

## Credits

Built following [*Build Your Own Web Server From Scratch In Node.JS*](https://build-your-own.org/webserver/) by James Smith ([build-your-own.org](https://build-your-own.org/)). The architecture and much of the core code follow the book; anything beyond it is my own work.

Found through [codecrafters-io/build-your-own-x](https://github.com/codecrafters-io/build-your-own-x).

## Author

**Juras Makselis**, Computing Science student at Simon Fraser University
[jurasmakselis.com](https://jurasmakselis.com)
