/*
 * Alerting component, monitoring a timeserie, and whenever its value is smaller
 * or bigger than another, triggers an alert.
 */

const _ = require('lodash');

const display = require('./display');

class AlertService {

    constructor(config, dataStore) {
        this.config = config;
        this.dataStore = dataStore;
        // this holds already triggered alerts to enable recovery
        this.triggeredAlerts = {};
        // this holds an allert log
        this.alerts = [];
    }

    toString() {
        return _.join(this.alerts, '\n');
    }

    pushAlert(str) {
        this.alerts.push(str);
        display.alert(this.alerts);
    }

    trigger(url, alertName, obj) {
        this.pushAlert(`Website ${url} is down. ${alertName}=${obj.value}, time=${obj.timestamp}`);
        this.triggeredAlerts[url + '_' + alertName] = true;
    }

    recover(url, alertName, obj) {
        this.pushAlert(`[Recovered] Website ${url} is up. ${alertName}=${obj.value}, time=${obj.timestamp}`);
        this.triggeredAlerts[url + '_' + alertName] = false;
    }


    // here is the core alerting stuff, describing when thresholds are crossed
    _newValue(url, alertName, settings, obj) {
        _.forEach(settings, (threshold, type) => {
            switch(type) {
                case 'min':
                    if(obj.value < threshold && !this.triggeredAlerts[url + '_' + alertName]) {
                        this.trigger(url, alertName, obj);
                    } else if (obj.value >= threshold && this.triggeredAlerts[url + '_' + alertName]) {
                        this.recover(url, alertName, obj);
                    }
                    break;
                case 'max' :
                    if(obj.value > threshold && !this.triggeredAlerts[url + '_' + alertName]) {
                        this.trigger(url, alertName, obj);
                    } else if (obj.value <= threshold && this.triggeredAlerts[url + '_' + alertName]) {
                        this.recover(url, alertName, obj);
                    }
                    break;
            }
        });
    }

    _alertSet({url, alertName, value: settings}) {
        this.triggeredAlerts[url + '_' + alertName] = false;
        const metric = this.dataStore.get(url, alertName);

        metric.on('push', 'alert_' + alertName, obj => this._newValue(url, alertName, settings, obj));
    }

    _alertDel({url, alertName}) {
        const metric = this.dataStore.get(url, alertName);
        metric.deleteCallback('push',  'alert_' + alertName);
    }

    run() {
        this.config.on('alert', 'set', this._alertSet.bind(this));
        this.config.on('alert', 'del', this._alertDel.bind(this));
    }

}

module.exports = AlertService;