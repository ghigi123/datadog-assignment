/*
 * This component makes http availability checks of the websites in config
 */

// IMPORTS
const request = require('request');
const _ = require('lodash');

const metric = require('./metric');
const display = require('./display');

// GLOBALS
const metricList = ["availability" , "response_time", "response_code"];

// this is my quite basic definition of availability of http requests

const statusCodeToAvailability = (code) => Number(code < 400);

/*
 * This class offers a routine to launch http requests and analyze their results
 * Nothing complicated here
 * 
 * parameters : 
 *  - checkDelay : how often the request will be launched
 */
class Checker {

    constructor({ url, config }, dataStore) {
        this.url = url;
        this.config = config;
        this.dataStore = dataStore;
    }

    addMetric(enabled, metricName) {
        if (enabled) {
            this.dataStore.set(this.url, metricName, new (metric.Metric)(metricName));
        }
    }

    pushValue(metricName, timestamp, value) {
        if (this.config.metrics[metricName]) {
            this.dataStore.get(this.url, metricName).push({
                timestamp,
                value: value
            });
        }
    }

    start() {
        this.checkInterval = setInterval(() => {
            const startTime = Date.now();
            request({
                url: this.url,
                time: true,
                method: 'GET'
            }, (err, response) => {
                if (err) {
                    // if there is any error (even if it is a user configuration problem)
                    // we consider availability to be wrong
                    this.pushValue("availability", startTime, 0);
                } else {
                    // I think it makes more sense to store the request time rather than
                    // the response time in this case.
                    //
                    // note that if requests happen in this order
                    // ----------TIME----------->
                    // req1 ---------------- res1
                    //      req2 -------- res2
                    // a push can happen in the time series with an older timestamp than
                    // the last element of the series

                    this.pushValue("availability", startTime, statusCodeToAvailability(response.statusCode));
                    this.pushValue("response_time", startTime, response.elapsedTime);
                    this.pushValue("response_code", startTime, response.statusCode);
                }
            });
        }, this.config.checkDelay);
    }

    stop() {
        clearInterval(this.checkInterval);
    }

}

/*
 * This service binds three events when ran
 * whenever a website or metric is created or deleted
 * a checker is launched or stopped
 */

class CheckService {
    constructor(config, dataStore) {
        this.checkers = {};
        this.config = config;
        this.dataStore = dataStore;
    }

    _setChecker({ url, value: config }) {
        if (this.checkers[url]) {
            this.checkers[url].stop();
        }
        this.checkers[url] = new Checker(config, this.dataStore);
        this.checkers[url].start();
    }

    _delChecker({ url }) {
        this.checkers[url].stop();
        delete this.checkers[url];
    }

    _setMetric({url, metricName, value}) {
        this.checkers[url].addMetric(value, metricName);
    }

    run() {
        this.config.on('website', 'set', this._setChecker.bind(this));
        this.config.on('website', 'del', this._delChecker.bind(this));
        this.config.on('metric', 'set', this._setMetric.bind(this));
    }
}

module.exports = {
    CheckService,
    metricList
};