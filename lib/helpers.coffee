fives = (num, unit, one, five, ten) ->
  str = []
  c = num / unit
  if c == 9
    str.push one
    str.push ten
    num -= 9 * unit
  else if c >= 5
    str.push five
    num -= 5 * unit
  else if c == 4
    str.push one
    str.push five
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
    s = arr[0]
    num = arr[1]
    str.push s
    arr = fives(num, 100, 'C', 'D', 'M')
    s = arr[0]
    num = arr[1]
    str.push s
    arr = fives(num, 10, 'X', 'L', 'C')
    s = arr[0]
    num = arr[1]
    str.push s
    str.join('')
tallyize = (number) ->
  if number > 0
    ones = number % 10
    str = [ romanize(number - ones), ' ' ]
    if ones >= 5
      str.push String.fromCharCode 822, 47, 822, 47, 822, 47, 822, 47
      str.push ' '
      ones = ones - 5
    if ones > 0
      slashes = ('/' for i in [1..ones])
      str.push slashes.join('')
    str.join('').trim()
  else
    "0"
newService = (result) ->
  provider: 'google'
  uemail: result.email
  uid: result.claimedIdentifier
  uname: [result.firstname, result.lastname].join ' '

newUser = (result) ->
  service = newService result
  name = [result.firstname, result.lastname]
  handle = name.join('').slice 0, 5
  email = result.email
  service = newService result
  user =
    active: false
    admin: false
    email: email
    handle: handle
    multiplier: 20
    name: name.join ' '
    pushup_set_count: 0
    services:
      service

logIn = (user, session) ->
  session.userId = user._id

logOut = (session) ->
  session.userId = null

module.exports =
  fives: fives
  romanize: romanize
  tallyize: tallyize
  newService: newService
  newUser: newUser
  logIn: logIn
  logOut: logOut
