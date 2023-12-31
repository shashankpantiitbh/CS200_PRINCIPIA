//jshint esversion:6
require("dotenv").config();//put at top
const express = require("express");
const ejs = require("ejs");
const _ = require("lodash");
const bodyParser = require("body-parser");
const app = express();
const mongoose = require("mongoose");
const session = require('express-session')
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose')
const findOrCreate = require('mongoose-findorcreate')
// var imgSchema = require('./model.js');
var fs = require('fs');
const nodemailer = require("nodemailer");
var path = require('path');
const Jimp = require("jimp");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const multer = require('multer');

const https = require("https");



const FacebookStrategy = require('passport-facebook');


const cron = require('node-cron');







// View Engine Setup

app.set("view engine", "ejs")
app.set("views", path.resolve("./views"))
app.use(express.json())
app.use(express.urlencoded({ extended: false }));






//const md5=require("md5");
//using becrypt as it is more safer and used in industry
// const bcrypt=require("bcrypt");
// const saltRounds=10;for using passwort .js
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: 'Our little secrets',
  resave: false,
  saveUninitialized: false,

}))//place before mongoose.connect
app.use(passport.initialize());//initialize passport
app.use(passport.session());

mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected successfully to the MongoDB server')
  });
//creating a schema for our collection

const userSchema = new mongoose.Schema({
  Username: String,
  password: String,

  googleId: String,

})
userSchema.plugin(passportLocalMongoose);//hash and salt our password and save users in mongoDB database
userSchema.plugin(findOrCreate);
const User = mongoose.model("user", userSchema);
const PeopleDetailSchema = new mongoose.Schema({
  Name: String,
 
  Email:String,

  ContactNo: Number,

  Domain: String,
  AadharNo: Number,
 
})
const Booking = mongoose.model("bookingdetail", PeopleDetailSchema);
//reading from google sheets

passport.use(User.createStrategy());

passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, {
      id: user.id,
      username: user.username,
      picture: user.picture
    });
  });
});//creates and store data inside cookies


passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});//destroys cookies and authenticate users


passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/callback",
 
},
  function (accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ username: profile.displayName, googleId: profile.id }, function (err, user) {
   
      return cb(err, user);
    });
  }));
//after completion of google authentication this callback fxn get triggered and we will log their profile 
//and try to create them as a user on our database if they does not exist
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: "http://localhost:3000/auth/facebook/intro"
},
  function (accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ username: profile.displayName, facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


  

  
app.get("/auth/google",

  passport.authenticate("google", { scope: ["profile"] }//use passport to authenticate user using google strategy and this line enable to get a pop up saying sign in with google 
  ))//initiates authentication on google servers asking them for user profile once the login process is successfull

app.get("/auth/google/callback"//authorized redirective uri from google cloud 
  , passport.authenticate('google', { failureRedirect: '/' }),//redirect to login page if authentication fails
  function (req, res) {
    // Successful authentication, redirect intro.
    res.redirect("/Booking");
  });//after login success if auth/google route google makes a get request to this route
//here er authenicate user locally and save their logged in session and once  they are authentictaed successfull tthen we redirect them to
//intro route
//At this stage google authenticateion step is completed and the callnback fxn gets  at line 57
app.get('/auth/facebook',
  passport.authenticate('facebook'));

app.get('/auth/facebook/intro',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect('/Booking');

  });

app.get("/", function (req, res) {
  const error = ""
  res.render("login", { errorMessage: error });
})

app.get("/booking", function (req, res) {
  res.render("booking");
})
app.get("/Form", function (req, res) {
  res.render("Form");
})
app.get("/Book_status", function (req, res) {
  if (req.isAuthenticated()) {
    // User is authenticated

    // Access the user's username from the session
    const username = req.user.username; // Assuming you've stored the username in the user session

    // Use the username to find the user's booking information
    Booking.findOne({ Email: username }) // Assuming 'Email' is the field that stores the user's email in the booking collection
      .then((booking) => {
        if (booking) {
          // User has booking information
          res.render("Book_status", {
            Name: booking.Name,
            Email: booking.Email,
            ContactNo: booking.ContactNo,
            Domain: booking.Domain,
            AadharNo: booking.AadharNo,
          });
        } else {
          // No booking found for the user
          res.render("Book_status", {
            Name: "No Booking Found",
            Email: "No Booking Found",
            ContactNo: "No Booking Found",
            Domain: "No Booking Found",
            AadharNo: "No Booking Found",
          });
        }
      })
      .catch((error) => {
        console.error("Error finding booking:", error);
        res.status(500).send("Internal Server Error");
      });
  } else {
    // User is not authenticated, redirect them to the login page or handle the case as needed
    res.redirect("/login"); // Replace with your login route
  }
});

app.post("/booking", function (req, res) {
  res.redirect("/Form");
})
app.post("/Form",function(req,res)
{
  const Entry = new Booking({
   Name: req.body.name,

    Email: req.body.email,
       
    ContactNo:req.body.contact,
    Domain:req.body.Domain,
    AadharNo:req.body.aadharNo

  });
  Entry.save()
  .then((result) => {
 

      var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: "shashankpant94115@gmail.com",
          pass: 'kizh zeyf ljig noqb'
        }
      });

      var mailOptions = {
        from: 'shashankpant94115@gmail.com',
        to: req.body.email,
        subject: 'Regarding Ticket Booking',
        html: '<html>' +
          '<body>' +
          '<h1 style="color: #336699;">Thank you, we have received your response!</h1>' +
          '<p style="color: #333;">With Regards,</p>' +
          '<p style="color: #333;">TickUp</p>' +
        
          '</body>' +
          '</html>'
      };

      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });

const name=req.body.name;
const email=req.body.email;
const contact=req.body.contact;
const domain=req.body.Domain;
const adhaar=req.body.aadharNo;
    res.render("Book_status",{Name:name, Email:email,   ContactNo:contact, Domain:domain,
      AadharNo:adhaar});
  })
})
app.post("/login", function (req, res, next) {
  if(req.body.action==='login'){
  const user = new User({
    username: req.body.username,
    password: req.body.password,

  });
  // req.session.username = req.user.username;
  passport.authenticate("local", function (err, user, info) {
    if (err) {
      console.log(err);
      return next(err);
    }

    if (!user) {
      // Authentication failed, display error message
      res.render("login", { errorMessage: "Invalid username or password." });
    } else {
      req.login(user, function (err) {
        if (err) {
          console.log(err);
          return next(err);
        }

        res.redirect("/Booking");
      });
    }
  })(req, res, next);
}


else {
  User.findOne({ username: req.body.username })
    .then((foundUser) => {
      if (foundUser) {

        res.render("login", { errorMessage: "User already exists." });
      } else {
        User.register(
          {
            username: req.body.username,
            active: false,

          },
          req.body.password,
          function (err, user) {
            if (err) {
              console.log(err);
              res.redirect("/");
            } else {
              passport.authenticate("local")(req, res, function () {
                res.redirect("/Booking");
              });
            }
          }
        );
      }
    })
}});



app.listen(3000, function () {
  console.log("server is running on port 3000");
})
