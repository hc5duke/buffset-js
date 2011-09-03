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
        text: 'Total Pushups'
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
          Highcharts.dateFormat('%m/%d %H:%M', this.x) +': '+ this.y +' pushups (' + this.y/20 +' sets * 20)';
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
        text: 'Total Pushups'
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
          this.x +': '+ this.y +' pushups (' + this.y/20 +' sets * 20)<br/>' +
          '<b>Total</b><br/>' + this.total + ' pushups (' + this.percentage.toFixed(2) + '%)';
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

$('#enable_notifications').click(function(){
  checkStatus();
  return false;
});

$(function(){
  if (window.webkitNotifications) {
    function createNotificationInstance(options) {
      if (options.notificationType == 'simple') {
        return window.webkitNotifications.createNotification(options.image, options.title, options.content);
      } else if (options.notificationType == 'html') {
        return window.webkitNotifications.createHTMLNotification(options.url);
      }
    }

    var checkStatus = function(){
      if (window.webkitNotifications.checkPermission() == 0) { // notifications enabled
        $('#enable_notifications').hide();
        $.get('/users.json', {}, function(response){
          if (response.length != usersHash.length) {
            location.reload(true);
          }
          for (var u in response) {
            if (response[u].count != usersHash[u].count) {
              usersHash[u] = response[u];
              var five = String.fromCharCode(47, 822, 47, 822, 47, 822, 47, 822);
              var tally = response[u].tally.replace(/_V_/g, five);
              $('#user_' + u).find('.count').text(tally);
              notify(response[u].name, response[u].count);
            }
          }
          setTimeout(checkStatus, 15000);
        });
      } else if (window.webkitNotifications.checkPermission() == 2) { // notifications disabled
        $('#enable_notifications').hide();
      } else { // permission hasn't been asked yet
        window.webkitNotifications.requestPermission(checkStatus);
      }
    };

    var notify = function(name, count){
      var options = {
        notificationType: 'simple',
        image: 'https://s3.amazonaws.com/dev_tapjoy/buffsets/muscle.gif',
        title:  name + ' is now at ' + count + '!',
        content: encouragements[Math.floor(Math.random() * encouragements.length)]
      };
      var notification = createNotificationInstance(options);
      notification.ondisplay = function() {};
      notification.onclose = function() {};
      notification.show();
      setTimeout(function() {
        notification.cancel();
      },'15000');
    };

    var encouragements = [
    ];
    var discouragements = [
      'You are weak.',
      'You are a bitch.'
    ];

    checkStatus();
  } else {
    $('#enable_notifications').hide();
  }

});

var pusher = new Pusher('ee24436a8c23a9f95d03'); // Replace with your app key
var channel = pusher.subscribe('test_channel');
var bindPusher = function(){
  console.log('bind pusher');
  channel.bind('my_event', function(data) {
    console.log(data);
    $('user_' + data._id);
  });
};
