/*
 * This file offers a way to dynamically configure the running services
 */

// IMPORTS
const fs = require('fs');
const _ = require('lodash');

/*
 * This class stores website configuration :
 *  - websites
 *  - metrics (monitored by Checkers)
 *  - aggregators (defining what will be aggregated)
 *  - alerts (defining alerts)
 * 
 * It can load and write config to filesystem
 */

class Config {
    constructor() {
        this.websites = {};
        this.callbacks = {
            website: {
                del: [],
                set: []
            },
            metric: {
                set: [],
                del: [],
            },
            aggregator: {
                del: [],
                set: []
            },
            alert: {
                del: [],
                set: []
            }
        }
    }

    // this functions enables components to subscribe to events

    on(element, operation, callback) {
        if(this.callbacks[element]) {
            if(this.callbacks[element][operation]) {
                this.callbacks[element][operation].push(callback);
            } else {
                throw '`operation` must be `set` or `del`';
            }
        } else {
            throw '`element` must be `website`, `aggregator` or `metric`';
        }
    }

    // this internal functions enables to easily call every callbacks registered on
    // any given element and operation given
    _triggerCallbacks(element, operation, arg) {
        _.forEach(this.callbacks[element][operation], callback =>
            callback(arg));
    }

    // the few next setters and deleters stores elements in config
    // and calls the callbacks at the right moment
    // quite not interesting wiring stuff
    setWebsite(url, website) {
        this.websites[url] = {
            url,
            config: {
                checkDelay: website.config.checkDelay,
                metrics: {},
                aggregators: {},
                alerts: {}
            }
        };

        this._triggerCallbacks('website', 'set', {
            url: url,
            value: this.websites[url]
        });

        _.forEach(website.config.metrics, (enabled, metricName) => 
            this.setMetric(url, metricName, enabled));
        _.forEach(website.config.aggregators, (aggregatorSettings, aggregatorName) => 
            this.setAggregator(url, aggregatorName, aggregatorSettings));
        _.forEach(website.config.alerts, (alertSettings, alertName) =>
            this.setAlert(url, alertName, alertSettings));
    }

    delWebsite(url) {
        _.forEach(this.websites[url].config.aggregators, (aggregator, aggregatorName) => {
            this._triggerCallbacks('aggregator', 'del', {
                url, 
                aggregatorName, 
                value: aggregator
            });
        });

        _.forEach(this.websites[url].config.alerts, (alert, alertName) => {
            this._triggerCallbacks('alert', 'del', {
                url, 
                alertName, 
                value: alert
            });
        });

        this._triggerCallbacks('website', 'del', {
            url,
            value: this.websites[url]
        });

        delete this.websites[url];
    }

    setMetric(url, metricName, enabled) {
        this.websites[url].config.metrics[metricName] = enabled;

        this._triggerCallbacks('metric', 'set', {
            url,
            metricName,
            value: enabled
        });
    }

    setAggregator(url, aggregatorName, aggregatorSettings) {
        this.websites[url].config.aggregators[aggregatorName] = {
            timeframe: aggregatorSettings.timeframe,
            computeDelay: aggregatorSettings.computeDelay,
            display: aggregatorSettings.display,
            metrics: {}
        }
        _.forEach(aggregatorSettings.metrics, (aggregatorMetricsSettings, metricName) => 
            this.setAggregatorMetric(url, aggregatorName, metricName, aggregatorMetricsSettings));

        this._triggerCallbacks('aggregator', 'set', {
            url: url,
            aggregatorName: aggregatorName, 
            value: aggregatorSettings
        });
    }

    setAlert(url, alertName, alertSettings) {
        this.websites[url].config.alerts[alertName] = alertSettings;
        this._triggerCallbacks('alert', 'set', {
            url,
            alertName,
            value: alertSettings
        });
    }

    delAlert(url, alertName) {
        delete this.websites[url].config.alerts[alertName];
        this._triggerCallbacks('alert', 'del', {
            url,
            alertName
        });
    }

    delAggregator(url, name) {
        delete this.websites[url].config.aggregators[name];
        this._triggerCallbacks('aggregator', 'del', {
            url,
            aggregatorName: name
        });
    }

    setAggregatorMetric(url, aggregatorName, metricName, aggregatorMetricsSettings) {
        this.websites[url].config.aggregators[aggregatorName].metrics[metricName] = aggregatorMetricsSettings;
    }

    // those 2 functions enable to write the config on filesystem and load it

    async load(path) {
        return new Promise((resolve, reject) => {
            fs.readFile(path, (err, data) => {
                if (err) {
                    reject(err.message);
                } else {
                    const configJson = JSON.parse(data.toString());
                    if(configJson.websites) {
                        _.forEach(configJson.websites, (website, url) => {
                            this.setWebsite(url, website);
                        });
                    } else {
                        reject('No `websites` field in config');
                    }
                    resolve();
                }
            });
        });
    }

    async save(path) {
        return new Promise((resolve, reject) => {
            const toExport = {
                websites: this.websites
            };
            fs.writeFile(path, JSON.stringify(toExport, null, 4), (err) => {
                if (err) {
                    reject(err.message);
                } else {
                    resolve();
                }
            });
        });
    }
}

module.exports = {
    Config: Config
};