/*
 * This workaround is a simple way to adress the project requirement :
 *  `Make sure all messages showing when alerting thresholds 
 *   are crossed remain visible on the page for historical reasons`
 * The alert log is always visible on screen with this
 * 
 * I have chosen not to focus on the display in the console program
 * because it is not the way I would make a front end normally
 * 
 * A typical console program would log alerts and aggregations simply
 * and a web front end for instance could aggregate those two flows 
 * on one only beautiful page
 */

const _ = require('lodash');

let alerts = [];
let enabled = true;

function displayAlerts() {
    if(alerts.length > 0) {
        console.log('--- Alerts log');
        _.forEach(alerts, a => console.log(' - ' + a));
        console.log();
    }
}

function alert(alts) {
    alerts = alts;
    if(enabled) {
        displayAlerts();
    }
}

function enable(bool) {
    enabled = bool;
}

function log(value) {
    if(enabled) {
        console.log(value);
        displayAlerts();
    }
}

module.exports = {alert, log, enable};