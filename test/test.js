/*
 * Tests entry point
 */

const _ = require('lodash');
const assert = require('assert');

const { Metric } = require('../metric');
const { Config } = require('../config');
const DataStore = require('../dataStore');
const AlertService = require('../alert');
const AggregationService = require('../aggregate');

const display = require('../display');
display.enable(false);

describe('Unit', function () {

    describe('Aggregate', function () {
        describe('Pipeline', function () {

            let dataStore;
            let config;
            let metric;
            let aggregationService;

            before(function () {
                dataStore = new DataStore();
                config = new Config();
                config.setWebsite('test', { config: { checkDelay: 50 } });

                metric = new Metric('test_metric');
                // we dont want the `test` url to be checked so we manually register the metric
                dataStore.set('test', 'test_metric', metric);

                aggregationService = new AggregationService(config, dataStore);
                aggregationService.run();
            });

            it('registers aggregator', function() {
                config.setAggregator(
                    'test',
                    '1_minute', 
                    {
                        timeframe: 120000,
                        computeDelay: 10000,
                        display: false,
                        metrics: {
                            "test_metric": [
                                "SUM"
                            ]
                        }
                });
                assert.notEqual(aggregationService.aggregators['test_1_minute'].aggregatorInterval, undefined);
            });

            it('unregisters aggregator', function() {
                config.delAggregator('test', '1_minute');
                assert.equal(aggregationService.aggregators['test_1_minute'], undefined);
            });
        });

        describe('Aggregate values', function () {
            let metric;

            before(function () {
                metric = new Metric('test_metric');
                metric.push({ timestamp: 0, value: 0 });
                metric.push({ timestamp: 1, value: 2 });
                metric.push({ timestamp: 3, value: 1 });
            });

            it('can sum', function () {
                assert.equal(metric.aggregate('SUM', 4, 3), 3);
            });
            it('can maximize', function () {
                assert.equal(metric.aggregate('MAX', 4, 3), 2);
            });
            it('can minimize', function () {
                assert.equal(metric.aggregate('MIN', 4, 3), 0);
            });
            it('can average', function () {
                assert.equal(metric.aggregate('AVG', 4, 3), 1);
            });
            it('can average over time', function () {
                assert.equal(metric.aggregate('AVG_TIME', 4, 3), 4 / 3);
            });
            it('can count', function () {
                assert.deepEqual(metric.aggregate('COUNT', 4, 3), { "0": 1, "1": 1, "2": 1 });
            });
        });

        describe('Aggregate objects', function () {
            let metric;

            before(function () {
                metric = new Metric('test_metric');
                metric.push({ timestamp: 0, value: { "a": 0, "b": 1 } });
                metric.push({ timestamp: 1, value: { "a": 2, "b": 2 } });
                metric.push({ timestamp: 3, value: { "a": 1, "b": 3 } });
            });

            it('can sum', function () {
                assert.deepEqual(metric.aggregate('SUM', 4, 3), { "a": 3, "b": 6 });
            });
            it('can maximize', function () {
                assert.deepEqual(metric.aggregate('MAX', 4, 3), { "a": 2, "b": 3 });
            });
            it('can minimize', function () {
                assert.deepEqual(metric.aggregate('MIN', 4, 3), { "a": 0, "b": 1 });
            });
            it('can average', function () {
                assert.deepEqual(metric.aggregate('AVG', 4, 3), { "a": 1, "b": 2 });
            });
            it('can average over time', function () {
                assert.deepEqual(metric.aggregate('AVG_TIME', 4, 3), { "a": 4 / 3, "b": 5 / 3 });
            });
            it('can count', function () {
                assert.deepEqual(
                    metric.aggregate('COUNT', 4, 3),
                    {
                        "a": { "0": 1, "1": 1, "2": 1 },
                        "b": { "1": 1, "2": 1, "3": 1 }
                    }
                );
            });
        });
    });

    describe('Alert', function () {
        let dataStore;
        let config;
        let metric;
        let alertService;

        before(function () {
            dataStore = new DataStore();
            config = new Config();
            config.setWebsite('test', { config: { checkDelay: 50 } });

            metric = new Metric('test_metric');
            dataStore.set('test', 'test_metric', metric);

            alertService = new AlertService(config, dataStore);
            alertService.run();
        });

        describe('Pipeline', function () {
            it('registers correctly alerts', function () {
                config.setAlert('test', 'test_metric', {
                    'min': 0.5
                });

                assert.equal(_.size(dataStore.get('test', 'test_metric').pushCallbacks), 1);
            });

            it('unregisters correctly alerts', function () {
                config.delAlert('test', 'test_metric');

                assert.equal(_.size(dataStore.get('test', 'test_metric').pushCallbacks), 0);
            });
        });


        describe('Low threshold alert', function () {
            before(function () {
                config.setAlert('test', 'test_metric', {
                    'min': 0.5
                });
            });

            after(function () {
                config.delAlert('test', 'test_metric');
            });

            it('can trigger', function () {
                metric.push({ timestamp: 0, value: 0 });
                assert.equal(alertService.triggeredAlerts['test_test_metric'], true);
            });

            it('can recover', function () {
                metric.push({ timestamp: 1, value: 1 });
                assert.equal(alertService.triggeredAlerts['test_test_metric'], false);
            });
        });

        describe('High threshold alert', function () {
            before(function () {
                config.setAlert('test', 'test_metric', {
                    'max': 0.5
                });
            });

            after(function () {
                config.delAlert('test', 'test_metric');
            });

            it('can trigger', function () {
                metric.push({ timestamp: 0, value: 1 });
                assert.equal(alertService.triggeredAlerts['test_test_metric'], true);

            });

            it('can recover', function () {
                metric.push({ timestamp: 0, value: 0 });
                assert.equal(alertService.triggeredAlerts['test_test_metric'], false);
            });
        });
    });
});

describe('Integration', function () {
    let testServer;
    let testService;

    before(function () {
        testService = new (require('./testService'))('./test/testConfig.json');
        testServer = new (require('./testServer'))();
    });

    describe('Alert', function () {
        beforeEach(async function () {
            await testService.start();
            await testServer.start();
        });

        afterEach(async function () {
            testService.stop();
            await testServer.stop();
        });

        it('alerts when a website is down', (done) => {
            // the website should be considered down when running for 150ms (as described in config)
            setTimeout(function () {
                const lastAlert = _.last(testService.alertService.alerts);
                const match = lastAlert && lastAlert.match(/Website .* is down\./g);
                assert.ok(match);
                done();
            }, 500);
        });

        it('alerts when a website is recovered', (done) => {
            // the website should be considered down when running for 150ms (as described in config)
            setTimeout(function () {
                const lastAlert = _.last(testService.alertService.alerts);
                const match = lastAlert && lastAlert.match(/\[Recovered\] Website .* is up\./g);
                assert.ok(match);
                done();
            }, 1000);
        });
    });

});
