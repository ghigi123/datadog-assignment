/*
 * This class is an abstraction for a possibly smarter way to store data
 * for now when the program is quit, all data is thrown
 * we could imagine to store time series somewhere here
 */

// IMPORTS
const _ = require('lodash');

class DataStore {
    constructor() {
        this.metrics = {};
    }

    get(url, name) {
        return this.metrics[url][name];
    }

    set(url, name, metric) {
        if (!this.metrics[url]) {
            this.metrics[url] = {};
        }
        this.metrics[url][name] = metric;
    }

    toString() {
        let res = "";
        _.forEach(this.metrics, (metrics, url) => {
            res += `--- ${url} ---\n`;
            _.forEach(metrics, (metric, metricName) => {
                const values = _.takeRight(_.map(metric.timeSeries.entries, e => Math.round(e.value)), 10);
                const valuesStr =
                    (metric.timeSeries.entries.length > 10 ? '... ' : '') +
                    _.join(values, ' ');
                res += ` - ${metricName} : ${valuesStr}\n`;
            });
        });
        return res;
    }
}

module.exports = DataStore;