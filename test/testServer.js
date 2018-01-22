/*
 * Provides a simple server for tests
 */

var http = require('http');

class TestServer {
    async start() {
        return new Promise(resolve => {
            this.available = false;
            this.interval = setInterval(() => 
                this.available = !this.available
            , 500);
            
            this.server = http.createServer((req, res) => {
                if(this.available) {
                    res.writeHead(200);
                    res.write('Hello World!');
                    res.end();
                } else {
                    res.writeHead(500);
                    res.write('This is an error!');
                    res.end();
                }
            }).listen(8080, () => resolve());
        });
    };

    async stop () {
        return new Promise(resolve => {
            clearInterval(this.interval);
            this.server.close(() => resolve());
        });
    };
}

module.exports = TestServer;