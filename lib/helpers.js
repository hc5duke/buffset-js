(function() {
  module.exports.tallyize = function(number) {
    var five_tally, fives, i, ones, romanize, slashes, str;
    fives = function(num, unit, one, five, ten) {
      var c, i, ones, str;
      str = [];
      c = num / unit;
      if (c === 9) {
        str.push(one, ten);
        num -= 9 * unit;
      } else if (c >= 5) {
        str.push(five);
        num -= 5 * unit;
      } else if (c === 4) {
        str.push(one, five);
        num -= 4 * unit;
      }
      c = Math.floor(num / unit);
      if (c > 0) {
        ones = (function() {
          var _results;
          _results = [];
          for (i = 1; 1 <= c ? i <= c : i >= c; 1 <= c ? i++ : i--) {
            _results.push(one);
          }
          return _results;
        })();
        str.push(ones.join(''));
        num -= c * unit;
      }
      return [str.join(''), num];
    };
    romanize = function(number) {
      var arr, num, str;
      if (number > 3999) {
        return 'Inf';
      } else {
        str = [];
        num = number;
        arr = fives(num, 1000, 'M', '?', '?');
        str.push(arr[0]);
        arr = fives(arr[1], 100, 'C', 'D', 'M');
        str.push(arr[0]);
        arr = fives(arr[1], 10, 'X', 'L', 'C');
        str.push(arr[0]);
        return str.join('');
      }
    };
    if (number > 0) {
      ones = number % 10;
      str = [romanize(number - ones), ' '];
      if (ones >= 5) {
        five_tally = String.fromCharCode(822, 47, 822, 47, 822, 47, 822, 47);
        str.push(five_tally, ' ');
        ones = ones - 5;
      }
      if (ones > 0) {
        slashes = (function() {
          var _results;
          _results = [];
          for (i = 1; 1 <= ones ? i <= ones : i >= ones; 1 <= ones ? i++ : i--) {
            _results.push('/');
          }
          return _results;
        })();
        str.push(slashes.join(''));
      }
      return str.join('').trim();
    } else {
      return "0";
    }
  };
  module.exports.endOfDay = function(date) {
    var day_in_ms;
    day_in_ms = 24 * 3600 * 1000;
    return new Date(Math.floor(date / day_in_ms) * day_in_ms);
  };
  module.exports.newService = function(result) {
    return {
      provider: 'google',
      uemail: result.email,
      uid: result.claimedIdentifier,
      uname: [result.firstname, result.lastname].join(' ')
    };
  };
  module.exports.newUser = function(result) {
    var email, handle, is_tapjoy, name, service, user;
    service = newService(result);
    name = [result.firstname, result.lastname];
    handle = (result.firstname[0] + result.lastname[0]).toUpperCase();
    email = result.email;
    is_tapjoy = email.match(/@tapjoy\.com$/ != null ? /@tapjoy\.com$/ : {
      "true": false
    });
    service = newService(result);
    return user = {
      created_at: new Date(),
      active: is_tapjoy,
      admin: false,
      female: false,
      abuse: false,
      email: email,
      handle: handle,
      name: name.join(' '),
      buffsets: [],
      services: service
    };
  };
  module.exports.newBuffset = function(userId, buffsetType) {
    return {
      created_at: new Date(),
      user_id: userId,
      type: buffsetType
    };
  };
  module.exports.logIn = function(user, session) {
    return session.userId = user._id;
  };
  module.exports.logOut = function(session) {
    return session.userId = null;
  };
}).call(this);
