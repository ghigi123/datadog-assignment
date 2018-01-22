/*
 * This file creates a really simple stupid shell to
 * send events to the main service.
 */

// IMPORTS
const readline = require('readline');
const _ = require('lodash');
const io = require('socket.io-client');

const launchPrompt = async () => {
    const socket = io('http://localhost:3456/');

    socket.on('err', data => {
        console.error(data);
        rl.prompt();
    });

    socket.on('log', data => {
        console.log(data);
        rl.prompt();
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on('line', line => {
        if (line === 'exit' || line === 'quit' || line === 'q') {
            rl.close();
        }
        socket.emit('line', line);
    });

    rl.on('close', async () => {
        process.exit(0);
    });

    rl.setPrompt('>');
    rl.prompt();
}

launchPrompt();