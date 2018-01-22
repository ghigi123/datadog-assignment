/*
 * This component makes aggregations of metrics and store them in other metrics
 */

// IMPORTS
const _ = require('lodash');

const metric = require('./metric');
const display = require('./display');

/*
 * This class offers a routine, repeatedly aggregating data from existing metrics
 * and storing result in another metric.
 * 
 * parameters:
 *  - name:         Name
 *  - timeframe:    On what timeframe will be aggregated data
 *  - computeDelay: How often we will compute the aggregation
 *  - metrics:      Which metrics are computed
 *  - display:      Do we display the aggregated results after computation
 * 
 * note: i have chosen to display the information required in the subject in this class
 *       for simplicity reasons. We could easily imagine another service, just regularly
 *       displaying metrics or aggregations from the data store, to decouple this feature
 */

class Aggregator {
    constructor(url, aggregatorName, aggregator, dataStore) {
        this.url = url;
        this.name = aggregatorName;
        this.timeframe = aggregator.timeframe;
        this.computeDelay = aggregator.computeDelay;
        this.metrics = aggregator.metrics;
        this.dataStore = dataStore;
        this.display = aggregator.display;

        _.forEach(this.metrics, (metricSettings, metricName) => {
            _.forEach(metricSettings, aggregationType => {
                this.dataStore.set(
                    this.url,
                    // this naming convention enables to reuse easily the aggregated data in
                    // another aggregation
                    metricName + '_' + this.name + '_' + aggregationType,
                    new metric.Metric(this.aggregatorName + '_' + aggregationType)
                );
            });
        });
    }

    // this function is used to display the aggregation data in logs
    toString() {
        let res = '';
        res += `--- Results for '${this.url}' in the last ${this.name}\n`;
        _.forEach(this.metrics, (metricSettings, metricName) => {
            res += ` - ${metricName} :`
            _.forEach(metricSettings, aggregationType => {
                const entries = this.dataStore.get(
                    this.url,
                    metricName + '_' + this.name + '_' + aggregationType
                ).timeSeries.entries;
                let value = _.last(entries).value;
                if(typeof(value) === 'object') {
                    value = _.join(_.map(value, (k, v) => `${v}:${k}`), ',');
                }
                res += ` ${aggregationType}=${value}`;
            });
            res += `\n`;
        });

        return res;
    }

    start() {
        this.aggregatorInterval = setInterval(
            () => {
                _.forEach(this.metrics, (metricSettings, metricName) => {
                    _.forEach(metricSettings, aggregationType => {
                        const now = Date.now();

                        // here the aggrecation calculus is made
                        // all math is made in metrics.js
                        const aggregationValue =
                            this.dataStore
                                .get(this.url, metricName)
                                .aggregate(aggregationType, this.timeframe, now);

                        this.dataStore
                            .get(
                                this.url,
                                metricName + '_' + this.name + '_' + aggregationType
                            )
                            .push({
                                timestamp: now,
                                value: aggregationValue
                            });
                    });
                });
                if(this.display) {
                    display.log(this.toString());
                }
            },
            this.computeDelay);
    }

    stop() {
        clearInterval(this.aggregatorInterval);
    }
}

/*
 * This service binds to events from config, so that
 * whenever an aggregator is added or removed, the corresponding
 * routine is started or stopped
 */

class AggregationService {
    constructor(config, dataStore) {
        this.aggregators = {};
        this.config = config;
        this.dataStore = dataStore;
    }

    _setAggregator({ url, aggregatorName, value: aggregator }) {
        if (this.aggregators[url + '_' + aggregatorName]) {
            this.aggregators[url + '_' + aggregatorName].stop();
        }
        this.aggregators[url + '_' + aggregatorName] = new Aggregator(url, aggregatorName, aggregator, this.dataStore);
        this.aggregators[url + '_' + aggregatorName].start();
    }

    _delAggregator({ url, aggregatorName }) {
        this.aggregators[url + '_' + aggregatorName].stop();
        delete this.aggregators[url + '_' + aggregatorName];
    }

    run() {
        this.config.on('aggregator', 'set', this._setAggregator.bind(this));
        this.config.on('aggregator', 'del', this._delAggregator.bind(this));
    }
}

module.exports = AggregationService;