# Datadog Project

Ghislain JEANNEAU

## Requirements

[Node.js](https://nodejs.org/) v8.7.0+

## Usage

To install the dependencies

```npm install```

To run the program

```npm start```

To run the shell

```npm run shell```

To run the tests

```npm test```

## Project structure and features

The main service is made of several components :
 - [config.js](./config.js) offers an event based configuration
 - [check.js](./check.js) offers a service checking website availability over time 
            and storing the metrics
 - [aggregate.js](./aggregate.js) regularly aggregates metrics and stores those
                aggregations as new metrics
 - [alert.js](./alert.js) monitors a metric (aggregated or not) and triggers an alert
            when its value is under or over a given threshold
 - [dataStore.js](./dataStore.js) is a data storage abstraction, storing timeseries

We can or configure this service by changing the [config.json](./config.json) file or using a provided CLI. The reason why has been developed is simply to show how the configuration can dynamically be changed.

Among the features I have chosen to focus on are:
 - Dynamic changes of configuration
 - Capures the following metrics :
    - availability
    - response code
    - response time
 - Aggregation types available on timeseries:
    - SUM : sum
    - AVG : average
    - AVG_TIME : time weighted average
    - MIN : minimum
    - MAX : maximum
    - COUNT : count entries
 - Aggregates values and objects
## Command line usage

Available commands :
 - `help` : Shows the help
 - `get website <url>` : Get info about a registered website
 - `set website <url> <checkDelay>` : Register new website
 - `del website <url>` : Removes a website
 - `get metric <url> [availability|response_time|response_code]` : Displays whether metric is enabled
 - `set metric <url> [availability|response_time|response_code] [0|1]` : Enable or disable a metric
 - `get aggregator <url> <aggregatorName>` : Displays an aggregator information
 - `set aggregator <url> <aggregatorName> <timeframe> <computeDelay> <display:[1|0]> [availability|response_time|response_code] [SUM|MIN|MAX|AVG|AVG_TIME|COUNT]` : Sets an aggregator
 - `del aggregator <url> <aggregatorName>` : Removes an aggregator

 Simple example of what can be done with command line:
 ```
set website http://www.google.com/ 100
set metric http://www.google.com/ availability 1
set aggregator http://www.google.com/ 2_min 1000 1000 1 availability AVG_TIME
 ```

 ## Made choices and possible improvements

 ### Time series / metrics
Time series are implemented using arrays kept sorted, as data is generally inputed in timestamp order. A binary search algorithm is used to insert data in the case where data is not inputed in timestamp order. More information in [metric.js](./metric.js)

We could use a richer data type, enabling for instance fast aggregation over different time resolutions. We could imagine some kind of B-Trees whose leaves are arrays, this way insertion could be kept fast in most cases, and aggregation could be made more efficient.

I have chosen not to implement such a data structure, because the Aggregator class I have developed enables to aggregate an already aggregated metric (such as shown in the aggregator `1_hour` in [config.json](./config.json)). Time resolution can thus be simulated this way. The base array (which could be considered as our B tree leaf) is just never cut.

As described in [metric.js](./metric.js), we could also add some dependencies in between timeseries, and probably throw data once it is no more useful.

A lot of new metrics could be monitored, and not necessarily about webchecking. The aggregation code as is just requires time series data to do aggregation, and is not specific to web checking.

### Aggregation

Aggregated data are currently pushed in timeseries, but we could easily consider not to store them.

Aggregator is the class responsible for the display in the console, but this layer can also easily be separated, to really separate the aggregation events from the display events.

The metric class can aggregate object instead of values.

### Project structure

For now the project is built arround several components (check, aggregation, alert) that I wanted the most independant possible.

That's why a common `config` and `dataStore` appeared to abstract something more subtle which could come later such as : Separing components into distinct micro services which could be scaled, and communicate with each other using for instance either a reactive database such as firebase, or a message broker.

### User interface

I made the choice not to spend too much time on this, even if I really like UI/UX.

To always be able to see the alerts on screen, I chose to just print all the alerts whenever something new appears on screen. This is ugly, but if the service was backend it would just push logs somewhere in a given order, and would not have a presentation layer in the console.

To be able to change the configuration at run time, I included a small shell, with really simple parse mechanism, running in another node process, and sending message to the backend through a websocket.

There is not real point behind the websocket, except it is really simple to use, and simple to remove later to include a more senseful interface such as an http API.

Those part of the code (end of [service.js](./service.js) and [shell.js](./shell.js)) are not really interesting to read.

I think that for such a service, a web front end would make much more sense. I did not implement it for time purposes.

### Website checking

My heuristic to check if a website is available or not is quite simple : whenever there is an error in the request or the response code is greater or equal than 400, I consider the website to be down.

There is a lot of improvements to do here, such as checking what is responsible for the error (connectivity issue, dns resolve, user input ...)

### Tests

I used the mocha js framework.

I implemented a few unit tests, to check the math of aggregations and alerts, and whether or not events hook up properly (this is what I meant by "pipeline").

I then implemented two integration tests, running all the components alltogether on a fake http server, simulating availability changes.