(function () {
  'use strict';

  angular
    .module('control-plane.view.metrics.dashboard.summary', [
    ])
    .config(registerRoute);

  registerRoute.$inject = [
    '$stateProvider'
  ];

  function registerRoute($stateProvider) {
    $stateProvider.state('cp.metrics.dashboard.summary', {
      url: '/summary',
      params: {
        guid: ''
      },
      templateUrl: 'plugins/control-plane/view/metrics/dashboard/summary/summary.html',
      controller: MetricsSummaryController,
      controllerAs: 'metricsSummaryCtrl',
      ncyBreadcrumb: {
        label: '{{metricsDashboardCtrl.endpoint.name}}',
        parent: 'cp.tiles'
      }
    });
  }

  MetricsSummaryController.$inject = [
    '$q',
    '$state',
    '$stateParams',
    'app.model.modelManager',
    'app.utils.utilsService',
    'control-plane.metrics.metrics-data-service'
  ];

  function MetricsSummaryController($q, $state, $stateParams, modelManager, utilsService, metricsDataService) {
    var that = this;

    this.guid = $stateParams.guid;

    this.showCardLayout = true;
    this.metricsModel = modelManager.retrieve('cloud-foundry.model.metrics');

    this.sortFilters = [
      {
        label: gettext('Hostname'),
        value: 'spec.hostname'
      },
      {
        label: gettext('Memory'),
        value: 'metric.memory_utilization'
      },
      {
        label: gettext('CPU'),
        value: 'metric.cpu_utilization'
      },
      {
        label: gettext('Availability Zone'),
        value: 'spec.zone'
      },
      {
        label: gettext('Data Transmitted Rate'),
        value: 'metric.dataTxRate'
      },
      {
        label: gettext('Data Received Rate'),
        value: 'metric.dataRxRate'
      }
    ];

    this.defaultFilter = {
      label: gettext('Hostname'),
      value: 'spec.hostname'
    };


    this.tableColumns = [
      {name: gettext('Node'), value: 'spec.hostname'},
      {name: gettext('Memory Usage'), value: 'metrics.memory_usage', noSort: true},
      {name: gettext('CPU Usage'), value: 'metrics.cpu_usage', descendingFirst: true},
      {name: gettext('Up Time'), value: 'metrics.upTime', descendingFirst: true},
      {name: gettext('Avail Zone'), value: 'metrics.availabilityZone', descendingFirst: true},
      {name: gettext('Data Tx'), value: 'metrics.dataTx', descendingFirst: true},
      {name: gettext('Data Rx'), value: 'metrics.dataRx', descendingFirst: true}
    ];

    function init() {

      metricsDataService.setSortFilters('nodes', that.sortFilters, that.defaultFilter);
      that.nodes = metricsDataService.getNodes(that.guid);

      return $q.resolve()
        .then(function () {
          // Enrich nodes information

          var allMetricPromises = [];
          _.each(that.nodes, function (node, key) {

            var metricPromises = [];
            // cpu
            metricPromises.push(that.metricsModel.getLatestMetricDataPoint('cpu_node_utilization_gauge',
              that.metricsModel.makeNodeNameFilter(node.spec.metricsNodeName)));
            // memory_usage
            metricPromises.push(that.metricsModel.getLatestMetricDataPoint('memory_node_utilization_gauge',
              that.metricsModel.makeNodeNameFilter(node.spec.metricsNodeName)));
            // uptime
            metricPromises.push(that.metricsModel.getNodeUptime(node.spec.metricsNodeName));
            // availabilityZone
            metricPromises.push($q.resolve(node.spec.zone));
            // dataTx
            metricPromises.push(that.metricsModel.getLatestMetricDataPoint('network_tx_rate_gauge',
              that.metricsModel.makeNodeNameFilter(node.spec.metricsNodeName)));
            // dataRx
            metricPromises.push(that.metricsModel.getLatestMetricDataPoint('network_rx_rate_gauge',
              that.metricsModel.makeNodeNameFilter(node.spec.metricsNodeName)));

            var promises = $q.all(metricPromises)
              .then(function (metrics) {
                that.nodes[key].metrics = {};
                that.nodes[key].metrics.cpu_usage = (metrics[0] * 100).toFixed(2) + ' %';
                that.nodes[key].metrics.memory_usage = (metrics[1] * 100).toFixed(2) + ' %';
                that.nodes[key].metrics.upTime = utilsService.getSensibleTime(metrics[2]);
                that.nodes[key].metrics.availabilityZone = metrics[3];
                that.nodes[key].metrics.dataTx = utilsService.bytesToHumanSize((metrics[4]).toFixed(2)) + '/s';
                that.nodes[key].metrics.dataRx = utilsService.bytesToHumanSize((metrics[5]).toFixed(2)) + '/s';
              });

            allMetricPromises.push(promises);

          });
          return allMetricPromises;
        });
    }

    utilsService.chainStateResolve('cp.metrics.dashboard.summary', $state, init);

  }

  angular.extend(MetricsSummaryController.prototype, {});

})();
