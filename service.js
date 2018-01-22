/*
 * This file provides the main program
 * The different components are put together here :
 *  - config.js offers an event based configuration
 *  - check.js offers a service checking website availability over time 
 *             and storing the metrics
 *  - aggregate.js regularly aggregates metrics and stores those
 *                 aggregations as new metrics
 *  - alert.js monitors a metric (aggregated or not) and triggers an alert
 *             when its value is under or over a given threshold
 *  - dataStore.js is a data storage abstraction, storing timeseries
 */

// IMPORTS
const _ = require('lodash');

const configModule = require('./config');
const DataStore = require('./dataStore');
const { CheckService, metricList } = require('./check');
const AggregationService = require('./aggregate');
const AlertService = require('./alert');

// GLOBALS
const confPath = './config.json';

// create config, dataStore, and bind components to them
const config = new (configModule.Config)();
const dataStore = new DataStore();
const checkService = new CheckService(config, dataStore);
const aggregationService = new AggregationService(config, dataStore);
const alertService = new AlertService(config, dataStore);

// run components
checkService.run();
aggregationService.run();
alertService.run();

/*
 * Everywhat is next is not really interesting
 * It:
 *  - opens a websocket to receive events from the CLI
 *    note: i have chosen a websocket because of its ease of use, there is
 *          anyway no real sense behind developing a CLI instead of a
 *          richer UI except the time I spent working on it
 *  - parse messages from the CLI and dispatches events to the components
 *    through the config to start or stop some watches
 *    note: the parse tries to handle most of the errors in the user input
 *          but i did not spent too much time to make sure everything is
 *          right. My goal was simply to show that this really is a service
 *          dynamically adapting to the configuration.
 */

 // this functions opens the websocket and listen for events
 // also saves configuration on quit
const listen = async () => {

    const server = require('http').createServer();
    const io = require('socket.io')(server);

    io.on('connection', socket => {
        console.log('Client connected');

        socket.on('line', line => {
            handleCommand(socket, line);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected');
        })
    });

    server.listen(3456);
    console.log('Http server listening port 3456');

    const closeServer = async () => new Promise(resolve => server.close(() => resolve()));

    process.on('SIGINT', async () => {
        console.log('');
        try {
            console.log('Saving configuration ...');
            await config.save(confPath);
            console.log('Closing server ...');
            await closeServer();
            console.log('Exiting ...');
            process.exit(0);
        } catch (message) {
            console.error("Unable to save configuration :" + message);
            process.exit(1);
        }
    });
}

// those two functions parse line for the CLI
// a richer interface such as http requests could make sense, but I wanted to keep it simple
// alerts are not handled in here for time reasons but they can easily be added
const handleConfig = (socket, element, operation, args) => {
    const url = args[0];

    switch (element) {
        case 'website':
            if(url) {
                if (operation === 'get') {
                    const res = JSON.stringify(config.websites[args[0]], null, 4);
                    if (res) {
                        socket.emit('log', res);
                    } else {
                        socket.emit('err', 'website `' + args[0] + '` does not exist in configuration');
                    }
                } else if (operation === 'set') {
                    if (args.length >= 2) {
                        const url = args[0];
                        const checkDelay = parseInt(args[1]);
                        if (checkDelay > 0) {
                            config.setWebsite(url, {
                                url,
                                config: {
                                    checkDelay: checkDelay
                                }
                            });
                            socket.emit('log', 'website registered');
                        } else {
                            socket.emit('err', 'invalid URL or checkDelay');
                        }
                    } else {
                        socket.emit('err', 'expected arguments url and check delay');
                    }
                } else if (operation === 'del') {
                    config.delWebsite(url);
                    socket.emit('log', 'removed website ' + url);
                }
            } else {
                socket.emit('err', 'expected argument url');
            }
            break;
        case 'metric':
            if(url && config.websites[url]) {
                const name = args[1];
                if(name && _.indexOf(metricList, name) !== -1) {
                    if(operation === 'get') {
                        socket.emit('log', true === config.websites[url].config.metrics[name]);
                    } else if (operation === 'set') {
                        const val = 1 === parseInt(args[2]);
                        config.setMetric(url, name, val);
                        socket.emit('log', `metric ${name} set to ${val}`);
                    } else if (operation === 'del') {
                        socket.emit('err', 'del not available on metric');
                    }
                } else {
                    socket.emit('err', 'expected argument metricName among `' + _.join(metricList, '`, `') + '`');
                }
            } else {
                socket.emit('err', 'website `' + args[0] + '` does not exist in configuration');
            }
            break;
        case 'aggregator': 
            if(url && config.websites[url]) {
                const name = args[1];
                if(name) {
                    if(operation === 'get') {
                        socket.emit('log', JSON.stringify(
                            config.websites[url].config.aggregators[name],
                            null,
                            4));
                    } else if (operation === 'set') {
                        // <url> <aggregatorName> <timeframe> <computeDelay> <display> <metricName> <aggregationType>` : Sets an aggregator'
                        const timeframe = parseInt(args[2]);
                        const computeDelay = parseInt(args[3]);
                        const display = parseInt(args[4]) === 1;
                        const metricName = args[5];
                        const aggregationType = args[6];

                        if(timeframe > 0 && computeDelay > 0 && metricName && aggregationType) {
                            const base_aggregator = _.cloneDeep(config.websites[url].config.aggregators[name]) || {};
                            _.assign(base_aggregator, {
                                timeframe, 
                                computeDelay,
                                display,
                                metrics: base_aggregator.metrics || {}
                            });
                            base_aggregator.metrics[metricName] = base_aggregator.metrics[metricName] || [];
                            if(_.indexOf(base_aggregator.metrics[metricName], aggregationType) === -1) {
                                base_aggregator.metrics[metricName].push(aggregationType);
                            }
                            if(!dataStore.get(url, metricName)) {
                                socket.emit('err', 'no aggregator or metric with name `' + metricName + '` found');
                            } else {
                                config.setAggregator(url, name, base_aggregator);
                                socket.emit('log', 'aggregator registered');
                            }
                        }
                        else {
                            socket.emit('err', 'invalid params');
                        }
                    } else if (operation === 'del') {
                        config.delAggregator(url, name);
                        socket.emit('log', 'aggregator removed')
                    }
                } else {
                    socket.emit('err', 'name expected');
                }
            } else {
                socket.emit('err', 'valid url expected');
            }

        default:
            break;
    }
}

const handleCommand = (socket, line) => {
    const tokens = _.split(line, ' ');
    switch (tokens[0]) {
        case 'set':
        case 'get':
        case 'del':
            if (_.indexOf(['website', 'aggregator', 'metric'], tokens[1]) !== -1) {
                handleConfig(socket, tokens[1], tokens[0], _.slice(tokens, 2));
            } else {
                socket.emit('err', 'first parameter of this command must be `website`, `aggregator` or `metric`');
            }
            break;
        case 'list':
            const res =
                _.join(
                    _.map(config.websites, website => ` - ${website.url} delay ${website.config.checkDelay}`),
                    '\n'
                );
            socket.emit('log', res);
            break;
        case 'help':
        default:
            const metricNames = '[' + _.join(metricList, '|') +']';
            const aggregationTypes = '[MIN|MAX|AVG|AVG_TIME|COUNT]';
            socket.emit('log',
                'Available commands :\n' +
                ' - `help` : Shows this help\n' +
                ' - `get website <url>` : Get info about a registered website \n' +
                ' - `set website <url> <checkDelay>` : Register new website \n' +
                ' - `del website <url>` : Removes a website \n' +
                ' - `get metric <url> ' + metricNames + '` : Displays whether metric is enabled\n' +
                ' - `set metric <url> ' + metricNames + ' [0|1]` : Enable or disable a metric\n' +
                ' - `get aggregator <url> <aggregatorName>` : Displays an aggregator information\n' + 
                ' - `set aggregator <url> <aggregatorName> <timeframe> <computeDelay> <display:[1|0]> \n   ' + metricNames + ' ' + aggregationTypes + '` : Sets an aggregator\n' +
                ' - `del aggregator <url> <aggregatorName>` : Removes an aggregator'
            );
    }
}

// this loads config and then gives hand to the socket listening
const main = async () => {
    try {
        await config.load(confPath);
        console.log(`Loaded configuration from ${confPath}`);
        // note that once you're here the system is working fine from config, what happens
        // next is just to show dynamic behavior of the system
    } catch (message) {
        console.log('Using default configuration');
    } finally {
        listen();
    }
}

main();