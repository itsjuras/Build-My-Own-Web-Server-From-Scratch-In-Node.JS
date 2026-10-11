import * as net from "net";

// create accept primitive for accepting new connections
function newConn(socket: net.Socket): void {
    console.log('new connection', socket.remoteAddress, socket.remotePort);
    
    socket.on('end', () => {
        // FIN received. The connection will be closed
        console.log('EOF.');
    });

    socket.on('data', (data: Buffer) => {
        console.log('data:', data);
        // echo back the data
        socket.write(data);

        // close the connection if data contains 'q'
        if (data.includes('q')) {
            console.log('closing.');
            // send FIN and close the connection
            socket.end();
        }
    });
}

// create a listening socket
let server = net.createServer();
server.on('connection', newConn);
server.on('error', (err: Error) => { throw err; });

server.listen({
    host: '127.0.0.1', 
    port: 1234
});