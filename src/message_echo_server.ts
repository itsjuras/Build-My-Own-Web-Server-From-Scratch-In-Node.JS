import * as net from "net";

// promised based API for TCP sockets.
type TCPConn = {
    // JS socket object
    socket: net.Socket;

    // from the 'error' event
    err: null|Error;

    // EOF, from the 'end' event
    ended: boolean;

    // the callbacks of the promise of the current read
    reader: null|{
        resolve: (value: Buffer) => void,
        reject: (reason: Error) => void,
    };
};

type TCPListener = {
    server: net.Server;
    err: null | Error;
    queue: TCPConn[]; // connections accepted before anyone asked
    waiter: null | { // the pending soAccept() call, if any
        resolve: (conn: TCPConn) => void; 
        reject: (err: Error) => void; 
    };
};

// A dynamic-sized buffer
type DynBuf = {
    data: Buffer,
    length: number,
    begin: number,
};

// append data to DynBuf
function bufPush(buf: DynBuf, data: Buffer): void {
    const newLen = buf.length + data.length;
    if (buf.data.length < buf.begin + newLen) {
        // grow the capacity by the power of two
        let cap = Math.max(buf.data.length, 32);
        while (cap < newLen) {
            cap *= 2;
        }
        const grown = Buffer.alloc(cap);
        // only the live data is copied, and it lands at the front
        buf.data.copy(grown, 0, buf.begin, buf.begin + buf.length);
        buf.data = grown;
        buf.begin = 0;
    }
    data.copy(buf.data, buf.begin + buf.length, 0);
    buf.length = newLen;
}

function bufData(buf: DynBuf): Buffer {
    return buf.data.subarray(buf.begin, buf.begin + buf.length);
}

function cutMessage(buf: DynBuf): null|Buffer {
    // messages are separated by '\n'
    const idx = bufData(buf).indexOf('\n');
    if (idx < 0) {
        return null; // not complete
    }
    // make a copy of the message and remove it from the buffer
    const msg = Buffer.from(bufData(buf).subarray(0 , idx + 1));
    bufPop(buf, idx + 1);
    return msg;
}

// remove data from the front
function bufPop(buf: DynBuf, len: number): void {
    // just skip over the consumed bytes; nothing moves
    buf.begin += len;
    buf.length -= len;


    // once half the capacity is wasted, move the live data back to the front
    if (buf.begin >= buf.data.length / 2) {
        buf.data.copyWithin(0, buf.begin, buf.begin + buf.length);
        buf.begin = 0;
    }
}

function soInit(socket: net.Socket): TCPConn {
    const conn: TCPConn = {
        socket: socket, err: null, ended: false, reader: null,
    };

    socket.on('data', (data: Buffer) => {
        console.assert(conn.reader);
        // pause the 'data' event until the next read.
        conn.socket.pause()

        // fulfill the promise of the current read.
        conn.reader!.resolve(data);
        conn.reader = null;
    });

    socket.on('end', () => {
        // also fulfills the current read.
        conn.ended = true;
        if (conn.reader) {
            conn.reader.resolve(Buffer.from('')); // EOF
            conn.reader = null;
        }
    });

    socket.on('error', (err: Error) => {
        // errors are also delivered to current read.
        conn.err = err;
        if (conn.reader) {
            conn.reader.reject(err);
            conn.reader = null;
        }
    });

    return conn;
}

function soRead(conn: TCPConn): Promise<Buffer> {
    console.assert(!conn.reader); // prevent concurrent calls
    return new Promise((resolve, reject) => {
        // if connection is not readable, complete the promise now
        if (conn.err) {
            reject(conn.err);
            return;
        }
        if (conn.ended) {
            resolve(Buffer.from('')); // EOF
            return;
        }

        // save promise callbacks
        conn.reader = {resolve: resolve, reject: reject};

        // resume the 'data' event to fulfill the promise later
        conn.socket.resume();
    });
}
function soWrite(conn: TCPConn, data: Buffer): Promise<void> {
    console.assert(data.length > 0);
    return new Promise((resolve, reject) => {
        if (conn.err) {
            reject(conn.err);
            return;
        }

        conn.socket.write(data, (err?: Error | null) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function soListen(host: string, port: number): TCPListener {
    const server = net.createServer({ pauseOnConnect: true });
    const listener: TCPListener = { server, err: null, queue: [], waiter: null };

    server.on('connection', (socket: net.Socket) => {
        const conn = soInit(socket); // attach handlers now so no events are missed
        if (listener.waiter) {
            listener.waiter.resolve(conn);
            listener.waiter = null;
        } else {
            listener.queue.push(conn);
        }
    });

    server.on('error', (err: Error) => {
        listener.err = err;
        if (listener.waiter) {
            listener.waiter.reject(err);
            listener.waiter = null;
        }
    });
    
    server.listen({ host, port })
    return listener;
}

function soAccept(listener: TCPListener): Promise<TCPConn> {
    console.assert(!listener.waiter); // no concurrent calls
    return new Promise((resolve, reject) => {
        if (listener.err) {
            reject(listener.err);
            return;
        }

        const conn = listener.queue.shift();
        if (conn) {
            resolve(conn);
            return;
        }

        listener.waiter = { resolve, reject };
    });
}

async function serveClient(conn: TCPConn): Promise<void> {
    const buf: DynBuf = {data: Buffer.alloc(0), length: 0, begin: 0};
    while (true) {
        // try to get 1 message from the buffer
        const msg: null|Buffer = cutMessage(buf);
        if (!msg) {
            const data: Buffer = await soRead(conn);
            bufPush(buf, data);

            if (data.length === 0) {
                console.log('end connection');
                break;
            }

            continue;
        }

        // process the message and send the response
        if (msg.equals(Buffer.from('quit\n'))) {
            await soWrite(conn, Buffer.from('Bye.\n'));
            console.log('end connection');
            return;
        } else {
            const reply = Buffer.concat([Buffer.from('Echo: '), msg]);
            await soWrite(conn, reply);
        }
    }
}

async function newConn(conn: TCPConn): Promise<void> {
    console.log('new connection', conn.socket.remoteAddress, conn.socket.remotePort);
    try {
        await serveClient(conn);
    } catch (exc) {
        console.error('exception:', exc);
    } finally {
        conn.socket.destroy();
    }
}

async function main(): Promise<void> {
    const listener = soListen('127.0.0.1', 1234);
    while (true) {
        const conn = await soAccept(listener);
        newConn(conn); // no await: serve clients concurrently
    }
}

main().catch((err) => console.error('listener failed:', err));