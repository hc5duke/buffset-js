module.exports.tallyize = (number) ->
  fives = (num, unit, one, five, ten) ->
    str = []
    c = num / unit
    if c == 9
      str.push one, ten
      num -= 9 * unit
    else if c >= 5
      str.push five
      num -= 5 * unit
    else if c == 4
      str.push one, five
      num -= 4 * unit
    c = Math.floor(num / unit)
    if c > 0
      ones = (one for i in [1..c])
      str.push ones.join ''
      num -= c * unit
    [str.join(''), num]

  romanize = (number) ->
    if number > 3999
      'Inf'
    else
      str = []
      num = number
      arr = fives(num, 1000, 'M', '?', '?')
      str.push arr[0]
      arr = fives(arr[1], 100, 'C', 'D', 'M')
      str.push arr[0]
      arr = fives(arr[1], 10, 'X', 'L', 'C')
      str.push arr[0]
      str.join('')

  if number > 0
    ones = number % 10
    str = [ romanize(number - ones), ' ' ]
    if ones >= 5
      five_tally = String.fromCharCode 822, 47, 822, 47, 822, 47, 822, 47
      str.push five_tally, ' '
      ones = ones - 5
    if ones > 0
      slashes = ('/' for i in [1..ones])
      str.push slashes.join('')
    str.join('').trim()
  else
    "0"

module.exports.endOfDay = (date) ->
  day_in_ms = 24 * 3600 * 1000
  new Date(Math.floor(date / day_in_ms) * day_in_ms)

module.exports.newService = (result) ->
  provider: 'google'
  uemail: result.email
  uid: result.claimedIdentifier
  uname: [result.firstname, result.lastname].join ' '

module.exports.newBuffset = (userId, buffsetType) ->
  created_at: new Date()
  user_id: userId
  type: buffsetType

module.exports.logIn = (user, session) ->
  session.userId = user._id

module.exports.logOut = (session) ->
  session.userId = null
