(function() {
  var fives, logIn, logOut, newBuffset, newService, newUser, romanize, tallyize;
  fives = function(num, unit, one, five, ten) {
    var c, i, ones, str;
    str = [];
    c = num / unit;
    if (c === 9) {
      str.push(one);
      str.push(ten);
      num -= 9 * unit;
    } else if (c >= 5) {
      str.push(five);
      num -= 5 * unit;
    } else if (c === 4) {
      str.push(one);
      str.push(five);
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
    var arr, num, s, str;
    if (number > 3999) {
      return 'Inf';
    } else {
      str = [];
      num = number;
      arr = fives(num, 1000, 'M', '?', '?');
      s = arr[0];
      num = arr[1];
      str.push(s);
      arr = fives(num, 100, 'C', 'D', 'M');
      s = arr[0];
      num = arr[1];
      str.push(s);
      arr = fives(num, 10, 'X', 'L', 'C');
      s = arr[0];
      num = arr[1];
      str.push(s);
      return str.join('');
    }
  };
  tallyize = function(number) {
    var i, ones, slashes, str;
    if (number > 0) {
      ones = number % 10;
      str = [romanize(number - ones), ' '];
      if (ones >= 5) {
        str.push(String.fromCharCode(822, 47, 822, 47, 822, 47, 822, 47));
        str.push(' ');
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
  newService = function(result) {
    return {
      provider: 'google',
      uemail: result.email,
      uid: result.claimedIdentifier,
      uname: [result.firstname, result.lastname].join(' ')
    };
  };
  newUser = function(result) {
    var email, handle, name, service, user;
    service = newService(result);
    name = [result.firstname, result.lastname];
    handle = (result.firstname[0] + result.lastname[0]).toUpperCase();
    email = result.email;
    service = newService(result);
    return user = {
      created_at: new Date(),
      active: false,
      admin: false,
      female: false,
      abuse: false,
      email: email,
      handle: handle,
      multiplier: 20,
      name: name.join(' '),
      buffsets: [],
      services: service
    };
  };
  newBuffset = function(userId, buffsetType) {
    return {
      created_at: new Date(),
      user_id: userId,
      type: buffsetType
    };
  };
  logIn = function(user, session) {
    return session.userId = user._id;
  };
  logOut = function(session) {
    return session.userId = null;
  };
  module.exports = {
    fives: fives,
    romanize: romanize,
    tallyize: tallyize,
    newService: newService,
    newUser: newUser,
    logIn: logIn,
    logOut: logOut,
    newBuffset: newBuffset
  };
}).call(this);
