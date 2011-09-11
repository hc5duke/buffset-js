Highcharts.setOptions({
  global: {
    useUTC: false
  }
});

var createChart = function(series) {
  var chart = new Highcharts.Chart({
    chart: {
      renderTo: 'container',
      defaultSeriesType: 'line',
      zoomType: 'x',
      marginRight: 130,
      marginBottom: 25
    },
    title: {
      text: 'Buffness Progress Indicator',
      x: -20
    },
    subtitle: {
      text: 'Source: Buff people',
      x: -20
    },
    xAxis: {
      type: 'datetime',
      maxZoom: 24 * 3600000, // 1 day
      dateTimeLabelFormats: {
        day: '%m/%d',
        week: '%m/%d',
        month: '%y/%m',
        year: '%Y'
      }
    },
    yAxis: {
      title: {
        text: 'Total Buffsets'
      },
      min: 0,
      plotLines: [{
        value: 0,
        width: 1,
        color: '#808080'
      }]
    },
    plotOptions: {
      series: {
        marker: {
          symbol: 'circle',
          fillColor: '#ffffff',
          lineColor: null,
          lineWidth: 2,
          radius: 3,
        }
      }
    },
    tooltip: {
      formatter: function() {
        return '<b>'+ this.series.name +'</b><br/>'+
          Highcharts.dateFormat('%m/%d %H:%M', this.x) +': '+ this.y +' buffsets';
      }
    },
    legend: {
      layout: 'vertical',
      align: 'right',
      verticalAlign: 'top',
      x: -10,
      y: 100,
      borderWidth: 0
    },
    series: series
  });
};

var createStackedChart = function(categories, series) {
  var chart = new Highcharts.Chart({
    chart: {
      renderTo: 'container',
      defaultSeriesType: 'area',
      zoomType: 'x',
    },
    title: {
      text: 'Buffness Progress Indicator',
    },
    subtitle: {
      text: 'Source: Buff people',
    },
    xAxis: {
      categories: categories,
      tickmarkPlacement: 'on',
      title: {
        enabled: false
      }
    },
    yAxis: {
      title: {
        text: 'Total Buffsets'
      },
      labels: {
        formatter: function() {
          return this.value;
        }
      },
      min: 0
    },
    plotOptions: {
      area: {
        stacking: 'normal',
        lineColor: '#666666',
        lineWidth: 1,
        marker: {
          lineWidth: 1,
          lineColor: '#666666'
        }
      }
    },
    tooltip: {
      formatter: function() {
        return '<b>' + this.series.name +'</b><br/>'+
          this.x +': '+ this.y +' buffsets<br/>' +
          '<b>Total</b><br/>' + this.total + ' buffsets (' + this.percentage.toFixed(2) + '%)';
      }
    },
    legend: {
      layout: 'vertical',
      align: 'right',
      verticalAlign: 'top',
      x: -10,
      y: 100,
      borderWidth: 0
    },
    series: series
  });
};

$('li.menu').click(function(e){
  if (e.srcElement.className) {
    $(this).children('ul.menu-dropdown').toggle();
    return false;
  }
});
$('.close').click(function(){
  $(this).parent().slideUp();
  return false;
});

$('#edit_current_user').click(function(){
  $('#edit_current_user').hide();
  $('#edit_current_user_form').show();
  return false;
});

$('#cancel_edit').click(function(){
  $('#edit_current_user').show();
  $('#edit_current_user_form').hide();
  return false;
});

var update = $.noop;

if (window.webkitNotifications) {
  function createNotificationInstance(options) {
    if (options.notificationType == 'simple') {
      return window.webkitNotifications.createNotification(options.image, options.title, options.content);
    } else if (options.notificationType == 'html') {
      return window.webkitNotifications.createHTMLNotification(options.url);
    }
  }

  update = function(data){
    if (window.webkitNotifications.checkPermission() == 0) { // notifications enabled
      $('#enable_notifications').hide();
      if (data) {
        notify(data);
      }
    } else if (window.webkitNotifications.checkPermission() == 2) { // notifications disabled
      $('#enable_notifications').hide();
    } else { // permission hasn't been asked yet
      window.webkitNotifications.requestPermission(update);
    }
  };

  var notify = function(data){
    var name = data.name;
    var count = data.count;
    var tally = data.tally;
    var content;
    if (data.abuse) {
      var index = Math.floor(Math.random() * discouragements.length);
      content = discouragements[index];
    } else {
      var index = Math.floor(Math.random() * encouragements.length);
      content = encouragements[index];
    }
    var options = {
      notificationType: 'simple',
      image: 'https://s3.amazonaws.com/dev_tapjoy/buffsets/muscle.gif',
      title:  name + ' is now at ' + count + '!',
      content: content.replace('__name__', data.name)
    };
    var notification = createNotificationInstance(options);
    notification.ondisplay = $.noop;
    notification.onclose = $.noop;
    notification.show();
    setTimeout(function() {
      notification.cancel();
    }, 15000);
  };

  var encouragements = [
    'You should be doing buffsets.',
    'Get up and go grab a pushup bar.'
  ];
  var discouragements = [
    'You are weak.',
    'You are __name__\'s bitch.'
  ];

  $('#enable_notifications').click(function(){
    update();
    return false;
  });
  update();

} else {
  $('#enable_notifications').hide();
}

var pusher = new Pusher('ee24436a8c23a9f95d03');
var channel = pusher.subscribe('test_channel');
channel.bind('my_event', function(data) {
  var domain = location.href.split(/\/+/)[1];
  if (domain == data._source) {
    var find = '#user_' + data.id + ' .count';
    $(find).text(data.tally);
    update(data);
  }
});
