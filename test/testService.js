/*
 * Provides a simple service for tests
 */

// IMPORTS
const { Config } = require('../config');
const DataStore = require('../dataStore');
const { CheckService } = require('../check');
const AggregationService = require('../aggregate');
const AlertService = require('../alert');

class TestService {
    constructor(configPath) {
        this.configPath = configPath;
    }

    async start() {
        this.config = new Config();
        this.dataStore = new DataStore();
        this.checkService = new CheckService(this.config, this.dataStore);
        this.aggregationService = new AggregationService(this.config, this.dataStore);
        this.alertService = new AlertService(this.config, this.dataStore);

        this.checkService.run();
        this.aggregationService.run();
        this.alertService.run();

        if(this.configPath) {
            await this.config.load(this.configPath);
        }
    }

    stop() {
        this.config.delWebsite('http://localhost:8080/');
    }
}

module.exports = TestService;