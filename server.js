var express = require('express'),
  stylus = require('stylus'),
  logger = require('morgan'),
  bodyParser = require('body-parser'),
  cookieParser = require('cookie-parser'),
  session = require('express-session'),    
  mongoose = require('mongoose'),
  crypto = require('crypto'),    
  passport = require('passport'),    
  LocalStrategy = require('passport-local').Strategy,
  crypto = require('crypto');

  
var env = process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var app = express();

function compile(str, path) {
  return stylus(str).set('filename', path);
}

app.set('views', __dirname + '/server/views');
app.set('view engine', 'jade');
app.use(logger('dev'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());
app.use(session({secret: 'multi vision unicorns',resave:false,saveUninitialized:false}));
app.use(passport.initialize());
app.use(passport.session());
app.use(stylus.middleware(
  {
    src: __dirname + '/public',
    compile: compile
  }
));
app.use(express.static(__dirname + '/public'));

//mongo stuff
mongoose.connect('mongodb://localhost/multivision');

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error...'));
db.once('open', function callback() {
  console.log('multivision db opened');
});

var userSchema = mongoose.Schema({
  firstName: {type:String, required:'{PATH} is required!'},
  lastName: {type:String, required:'{PATH} is required!'},
  username: {
    type: String,
    required: '{PATH} is required!',
    unique:true
  },
  salt: {type:String, required:'{PATH} is required!'},
  hashed_pwd: {type:String, required:'{PATH} is required!'},
  roles: [String]
});

userSchema.methods = {
  authenticate: function(passwordToMatch) {
    return hashPwd(this.salt, passwordToMatch) === this.hashed_pwd;
  },
  hasRole: function(role) {
    return this.roles.indexOf(role) > -1;
  }
}; 


 var User = mongoose.model('User', userSchema);


User.find({}).exec(function(err, collection) {
    if(collection.length === 0) {
    var salt, hash;
      
    salt = createSalt();
    hash = hashPwd(salt, 'apurv');
    User.create({firstName:'Apurv',lastName:'Deshpande',username:'apurv', salt: salt, hashed_pwd: hash, roles: ['admin']});
      
     salt = createSalt();
    hash = hashPwd(salt, 'jonathan');  
    User.create({firstName:'Jonathan',lastName:'Nolan',username:'johnathan', salt: salt, hashed_pwd: hash, roles: []});
      
     salt = createSalt();
      hash = hashPwd(salt, 'sudanshu');
      User.create({firstName:'Sudanshu',lastName:'Sharma',username:'sudanshu', salt: salt, hashed_pwd: hash});
      
    }
  })


function createSalt() {
  return crypto.randomBytes(128).toString('base64');
}

function hashPwd(salt, pwd) {
  var hmac = crypto.createHmac('sha1', salt);
  hmac.setEncoding('hex');
  hmac.write(pwd);
  hmac.end();
  return hmac.read();
}


var courseSchema = mongoose.Schema({
  title: {type:String, required:'{PATH} is required!'},
  featured: {type:Boolean, required:'{PATH} is required!'},
  published: {type:Date, required:'{PATH} is required!'},
  tags: [String]
});
var Course = mongoose.model('Course', courseSchema);


//passport

passport.use(new LocalStrategy(
    function(username, password, done) {
      User.findOne({username:username}).exec(function(err, user) {
        if(user && user.authenticate(password)) {
          return done(null, user);
        } else {
          return done(null, false);
        }
      })
    }
  ));

 passport.serializeUser(function(user, done) {
    if(user) {
      done(null, user._id);
    }
  });

  passport.deserializeUser(function(id, done) {
    User.findOne({_id:id}).exec(function(err, user) {
      if(user) {
        return done(null, user);
      } else {
        return done(null, false);
      }
    })
  })

//routes
  
  app.get('/api/users',function(req, res, next) {
    User.find({}).exec(function(err, collection) {
      res.send(collection);
    })
  })


  
  app.get('/partials/*', function(req, res) {
    res.render('../../public/app/' + req.params[0]);
});



app.post('/login', function(req, res, next) {
  var auth = passport.authenticate('local', function(err, user) {
    if(err) {return next(err);}
    if(!user) { res.send({success:false})}
    req.logIn(user, function(err) {
      if(err) {return next(err);}
      res.send({success:true, user: user});
    })
  })
  auth(req, res, next);
});

app.post('/logout', function(req, res) {
    req.logout();
    res.end();
  });


app.post('/api/users', function(req, res, next) {
  var userData = req.body;
  userData.username = userData.username.toLowerCase();
  userData.salt = createSalt();
  userData.hashed_pwd = hashPwd(userData.salt, userData.password);
  User.create(userData, function(err, user) {
    if(err) {
      if(err.toString().indexOf('E11000') > -1) {
        err = new Error('Duplicate Username');
      }
      res.status(400);
      return res.send({reason:err.toString()});
    }
    req.logIn(user, function(err) {
      if(err) {return next(err);}
      res.send(user);
    })
  })
});  


app.put('/api/users', function(req, res) {
  var userUpdates = req.body;

  if(req.user._id != userUpdates._id && !req.user.hasRole('admin')) {
    res.status(403);
    return res.end();
  }

  req.user.firstName = userUpdates.firstName;
  req.user.lastName = userUpdates.lastName;
  req.user.username = userUpdates.username;
  if(userUpdates.password && userUpdates.password.length > 0) {
    req.user.salt = encrypt.createSalt();
    req.user.hashed_pwd = encrypt.hashPwd(req.user.salt, userUpdates.password);
  }
  req.user.save(function(err) {
    if(err) { res.status(400); return res.send({reason:err.toString()});}
    res.send(req.user);
  });
});

app.get('/api/courses', function(req, res) {
   Course.find({}).exec(function(err, collection) {
    if(collection.length === 0) {
      Course.create({title: 'C# for Begineers', featured: true, published: new Date('10/6/2014'), tags: ['C#']});
      Course.create({title: 'C# for Advanced Users', featured: true, published: new Date('10/2/2014'), tags: ['C#']});
      Course.create({title: 'C# Best Practices', featured: false, published: new Date('10/3/2015'), tags: ['C#']});
      Course.create({title: 'Visual Basic for Developers', featured: false, published: new Date('7/12/2015'), tags: ['VB']});
      Course.create({title: 'Javascript for Begineers', featured: true, published: new Date('1/1/2015'), tags: ['JS']});
      Course.create({title: 'JavaScript for Advanced Users', featured: true, published: new Date('10/2/2015'), tags: ['JS']});
      Course.create({title: 'Java for Begineers', featured: true, published: new Date('3/1/2015'), tags: ['Java']});
      Course.create({title: 'Java for Advanced Users', featured: true, published: new Date('2/1/2015'), tags: ['Java']});
      Course.create({title: 'CV Best Practices ', featured: true, published: new Date('10/7/2014'), tags: ['Misc']});
      Course.create({title: 'Business Management Basics', featured: false, published: new Date('8/1/2013'), tags: ['Management']});
      Course.create({title: 'Interview Tricks and Best Practices', featured: false, published: new Date('11/1/2014'), tags: ['Misc']});
      Course.create({title: "Node JS for Beginners", featured: true, published: new Date('08/17/2015'), tags: ['JS']});
      Course.create({title: 'Angular JS For Begineers', featured: false, published: new Date('10/5/2013'), tags: ['JS']});
      Course.create({title: 'Cover Letter Basics', featured: true, published: new Date('2/15/2015'), tags: ['Misc']});
      Course.create({title: 'Android Development Complete Tutorial', featured: true, published: new Date('7/1/2014'), tags: ['Java', 'Android']});
    }
    res.send(collection);
  })
});

app.all('/api/*', function(req, res) {
    res.sendStatus(404);
  });

app.get('*', function(req, res) {
  res.render('index', {
      bootstrappedUser: req.user
    });
});

//port listening
var port = process.env.PORT || 3030;
app.listen(port);
console.log('Listening on port ' + port + '...');