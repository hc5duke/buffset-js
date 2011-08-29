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
        image: '/images/muscle.gif',
        title:  name + ' is now at ' + count + '!',
        content: encouragement[Math.floor(Math.random() * encouragement.length)]
      };
      var notification = createNotificationInstance(options);
      notification.ondisplay = function() {};
      notification.onclose = function() {};
      notification.show();
      setTimeout(function() {
        notification.cancel();
      },'15000');
    };

    var encouragement = [
      'You are weak.',
      'You are a bitch.'
    ];

    checkStatus();
  } else {
    $('#enable_notifications').hide();
  }

  var pusher = new Pusher('ee24436a8c23a9f95d03'); // Replace with your app key
  var channel = pusher.subscribe('test_channel');
  channel.bind('my_event', function(data) {
    alert(data);
  });
});
