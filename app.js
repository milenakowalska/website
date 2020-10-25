//jshint esversion:6

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const getDate = require(__dirname + '/getDate.js');
const _ = require('lodash');
const fs = require("fs");
const multer = require('multer');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const e = require('express');

const upload = multer({ dest: '/tmp' });
const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(__dirname + "/public"));

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}))

app.use(passport.initialize());
app.use(passport.session());

// Set Mongo DB connection
mongoose.connect('mongodb://localhost:27017/blogDB', { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set('useCreateIndex', true);

////// Create a adminSchema and Admin Model
const adminSchema = new mongoose.Schema({
    adminName: String,
    password: String
});

adminSchema.plugin(passportLocalMongoose);

const Admin = new mongoose.model('Admin', adminSchema);

passport.use(Admin.createStrategy());
passport.serializeUser(function(user, done) {
    done(null, user);
  });
  
  passport.deserializeUser(function(user, done) {
    done(null, user);
  });
//////// Create a postSchema and Post Model
const today = String(getDate.getDate());

const postSchema = new mongoose.Schema({
    title: {type: String, required: true},
    content: String,
    data_published: {type:String, default: today },
    image: String
});
const Post = mongoose.model('Post', postSchema);

//////// Create a languageSchema and Language Model
const languageSchema = new mongoose.Schema({
    title: {type: String,required: true},
    description: String,
    image_path: String,
    language: String,
    url: String
});
const Language = mongoose.model('Language', languageSchema);

/////////// ADMIN ROUTE
app.route('/admin')
.get(function(req,res){
    res.render('admin-login')
})
.post(function(req,res){
    const admin = new Admin ({
        adminName:req.body.username,
        password:req.body.password
    })
    req.login(admin, function(err){
        if(err){
            console.log(err);
            console.log()
            res.redirect('/');
        } else {
            passport.authenticate('local')(req,res, function(){
                res.redirect('/admin-panel')
            })
        }
    }) 
});

app.route('/admin-panel')
.get(function(req,res){
    if(req.isAuthenticated()){
        res.render('admin-panel');
    } else {
        res.redirect('/')
    }
})
.post(function(req,res){
    const title = req.body.postTitle;
    if(req.body.section === 'language') {
        res.redirect(`/lang/update/${title}`)
    } else {
        res.redirect(`/update/${title}`)
    }
});


app.get('/logout', function(req,res){
    req.logout();
    res.redirect('/');
})

///////// HOME ROUTE
app.get('/', function(req, res){
    res.render('home')
})

app.get('/about', function(req, res){
    res.render('about')
})

///////// BLOG ROUTES

app.get('/blog', function(req, res){
    Post.find({}, function(err, foundPosts){
        if(err){
            console.log(err);
        } else {
            res.render('blog', {posts: foundPosts});
        }
    });
});

app.get('/blog/:blogTitle', function(req,res){
    const blogTitle = req.params.blogTitle;
    
    Post.findOne({title:blogTitle}, function(err, post){
        res.render('post', {post: post})
    })
})

// Update a post
app.get('/update/:blogTitle', function(req,res){
    if(req.isAuthenticated()) {
        const blogTitle = req.params.blogTitle;
    
        Post.findOne({title:blogTitle}, function(err, post){
            if(err){
                console.log(err);
            } else {
                res.render('update-post', {post: post})
            }
        })
    } else {
        res.redirect('/')
    }

});

app.post('/update', function(req,res){
    if(req.isAuthenticated()) {
        const id = req.body.id;
        const section = req.body.section;
    
        if (section === 'blog') {
            Post.findOne({_id: id}, function(err, post){
                if(err){
                    console.log(err);
                } else {
                    const title = req.body.title
                    console.log(title);
                    let postContent = req.body.content
                    postContent = postContent.replace(/\n\r?/g, '<br />');
                    console.log(postContent);
                    Post.updateOne(
                        {_id: id},
                        {$set: {title: title, content: postContent}},
                        function(err){
                            if (!err){
                                res.redirect('blog');
                            } else{
                                console.log(err);
                            }
                        }
                    )
                }
            })
        } else {
            Language.findOne({_id: id}, function(err, post){
                if(err){
                    console.log(err);
                } else {
                    const title = req.body.title
                    let postContent = req.body.content
                    postContent = postContent.replace(/\n\r?/g, '<br />');
                    const url = req.body.url;
                    Language.updateOne(
                        {_id: id},
                        {$set: {title: title, description: postContent, url: url}},
                        function(err){
                            if (!err){
                                res.redirect('blog');
                            } else{
                                console.log(err);
                            }
                        }
                    )
                }
            })        
        }
    } else {
        res.redirect('/')
    }


    
});

// Create a new post
app.route('/compose-blog')

.get(function(req,res){
    if(req.isAuthenticated()) {
        res.render('compose');
    } else {
        res.redirect('/')
    }

    
})
.post(upload.single("file"), function (req, res) {
    var file = __dirname + "/public/img/" + req.file.originalname;
    fs.readFile( req.file.path, function (err, data) {
        fs.writeFile(file, data, function (err) {
            if( err ){
                console.error( err );
             } else {
                 console.log('File uploaded successfully')
            }})
        })

    let postContent = req.body.content
    postContent = postContent.replace(/\n\r?/g, '<br />');
    let filePath = file.split('/public/')[1]

    if (req.body.section === 'blog') {
        const newPost = new Post({title: req.body.title, content: postContent, image: filePath});
        newPost.save();
    } else {
        const newLanguageSection = new Language({title: req.body.title, description: postContent, image_path: filePath, language: req.body.section});
        newLanguageSection.save();
    }


        res.redirect('blog')
    });

////////// LANGUAGE SECTIONS
 
app.get('/languages/:language', function(req, res){
    const language = req.params.language;

    Language.find({language:language}, function(err, foundSections){
        if (err){
            console.log(err);
        } else {
            res.render('languages', {language:language, sections: foundSections})
        }
    });
});

app.get('/lang/update/:langTitle', function(req,res){
    if(req.isAuthenticated()) {
        const langTitle = req.params.langTitle;
    
    Language.findOne({title:langTitle}, function(err, post){
        if(err){
            console.log(err);
        } else {
            res.render('update-post', {post: post})
        }
    })
    } else {
        res.redirect('/')
    }
    
});




app.listen(3000, function() {
    console.log('Server started on port 3000.')
})


