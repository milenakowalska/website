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
let {PythonShell} = require('python-shell')

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

//////// Create a for german-article wordSchema and Word Model

const wordSchema = new mongoose.Schema({
    word: String,
    article: String,
    definitions: Array
});

const Word = new mongoose.model('Word', wordSchema);


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
                    let postContent = req.body.content
                    postContent = postContent.replace(/\n\r?/g, '<br />');
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

app.get('/comming-soon', function(req,res){
	res.render('comming-soon')
})


//////// DICTIONARY
app.route('/dictionary')
.get(function(req,res){
    res.render('dictionary', {errorStatement:null});
})
.post(function(req,res){
    const dictionaryName = req.body.dictionaryName;
    const languageFrom = req.body.languageFrom;
    const languageTo = req.body.languageTo;
    word = req.body.word;
    const words = [];
    const examples = []
    //// PYTHON words, examples = check_word(dictionary_name, language_from, language_to, word)
    var checkWord = __dirname + '/dictionary.py';
    var options = {args: ['check_word', dictionaryName, languageFrom, languageTo, word]};

    PythonShell.run(checkWord, options, function(err, results){
        if(err){
            console.log(err);
        } else {
            if (results == null) {
                let errorStatement = 'Word not found';
                res.render('dictionary', {errorStatement: errorStatement})
            } else {
                let converterResults = results[0].split('[Example');
            
                if (converterResults.length == 2) {
                    var definitionsFound = converterResults[0];
                    var examples = converterResults[1];
                } else {
                    var definitionsFound = converterResults[0];
                    var examples = null
                };
                definitionsFound = definitionsFound.split('Word(');
    
                definitionsFound.shift();
    
                for (var i = 0; i < definitionsFound.length; i++) {
                    definitionsFound[i] = definitionsFound[i].split(", ");
                    definitionsFound[i][0] = definitionsFound[i][0].replace("key=", "")
    
                    
                    var keys = 1;
                    while(definitionsFound[i][keys].slice(0,12) !== 'translations' && definitionsFound[i][1].slice(0,7) !== 'context') {
                        definitionsFound[i][keys] = definitionsFound[i][keys].replace("translations=", "")
                        definitionsFound[i][keys] = definitionsFound[i][keys].replace("context=", "")
                        definitionsFound[i][keys] = definitionsFound[i][keys].replace(/"/g, "");
                        definitionsFound[i][keys] = definitionsFound[i][keys].replace(/⇒/g, "");
                        definitionsFound[i][keys] = definitionsFound[i][keys].replace("translations=", "")
                        definitionsFound[i][keys] = definitionsFound[i][keys].split(String.fromCharCode(92) + 'xad').join('')
                        definitionsFound[i][keys] = definitionsFound[i][keys].split(String.fromCharCode(92) + 'xa0').join(' ')
                        definitionsFound[i][keys] = definitionsFound[i][keys].split(String.fromCharCode(92) + 'n').join('')
                        definitionsFound[i][keys] = definitionsFound[i][keys].split(String.fromCharCode(219)).join('')
                        definitionsFound[i][keys] = definitionsFound[i][keys].split(String.fromCharCode(221)).join('')
                        definitionsFound[i][keys] = definitionsFound[i][keys].split(String.fromCharCode(40)).join('')
                        definitionsFound[i][keys] = definitionsFound[i][keys].split(String.fromCharCode(41)).join('')
                        definitionsFound[i][0] = definitionsFound[i][0] + ', ' + definitionsFound[i][keys]
                        keys++;
                    };
                    
                        for(j = 0 ; j < (definitionsFound[i].length-1); j++) {
                        // definitionsFound[i][j] = definitionsFound[i][j].replace(/'/g, "");
                        definitionsFound[i][j] = definitionsFound[i][j].replace(/"/g, "");
                        definitionsFound[i][j] = definitionsFound[i][j].replace(/⇒/g, "");
                        definitionsFound[i][j] = definitionsFound[i][j].replace("translations=", "")
                        definitionsFound[i][j] = definitionsFound[i][j].split(String.fromCharCode(92) + 'xad').join('')
                        definitionsFound[i][j] = definitionsFound[i][j].split(String.fromCharCode(92) + 'xa0').join(' ')
                        definitionsFound[i][j] = definitionsFound[i][j].split(String.fromCharCode(92) + 'n').join('')
                        definitionsFound[i][j] = definitionsFound[i][j].split(String.fromCharCode(219)).join('')
                        definitionsFound[i][j] = definitionsFound[i][j].split(String.fromCharCode(221)).join('')
                        definitionsFound[i][j] = definitionsFound[i][j].split(String.fromCharCode(40)).join('')
                        definitionsFound[i][j] = definitionsFound[i][j].split(String.fromCharCode(41)).join('')
    
    
                        if (definitionsFound[i][j][0] === "'"){
                            definitionsFound[i][j] = definitionsFound[i][j].substring(1);
                        };
                        if (definitionsFound[i][j][definitionsFound[i][j].length -1] === "'"){
                            definitionsFound[i][j] = definitionsFound[i][j].slice(0,definitionsFound[i][j].length-1);
                        }
                    }
                }
    
                if (examples != null) {
                    examples = examples.split('Example(');
                    for (var i = 0; i < examples.length; i++) {
                        examples[i] = examples[i].split("translation_example=");
                        examples[i][0] = examples[i][0].replace("example=", "")
                        for (var j = 0; j < examples[i].length; j++){
                            examples[i][j] = examples[i][j].replace(/"/g, "");
                            examples[i][j] = examples[i][j].split(String.fromCharCode(92) + 'xad').join('')
                            examples[i][j] = examples[i][j].split(String.fromCharCode(92) + 'xa0').join('')
                            examples[i][j] = examples[i][j].split(String.fromCharCode(92) + 'n').join('')
                            examples[i][j] = examples[i][j].split(String.fromCharCode(219)).join('')
                            examples[i][j] = examples[i][j].split(String.fromCharCode(221)).join('')
                            examples[i][j] = examples[i][j].split(String.fromCharCode(40)).join('')
                            examples[i][j] = examples[i][j].split(String.fromCharCode(41)).join('')
    
                            while (examples[i][j][0] === "'"){
                                examples[i][j] = examples[i][j].substring(1);
                            };
                            while (examples[i][j][examples[i][j].length -1] === "'"){
                                examples[i][j] = examples[i][j].slice(0,examples[i][j].length-1);
                            }
                        }
                    }
                }
               
                let wordsFound = [];
                definitionsFound.forEach(function(definition){
                    
                    let translations = [];
                    let contextFound = [];
    
                    let key = definition[0];
                    if (key[0] === "'"){
                        key = key.substring(1);
                    };
                    if (key[key.length -1] === "'"){
                        key = key.slice(0,key.length-1);
                    }
                    for(let i = 0; i < (definition.length-1); i++) {
                        if (definition[i].slice(0,7) === 'context') {
                            break;
                        }
                        if (!key.includes(definition[i])) {
                            if (definition[i][0] === "'"){
                                definition[i] = definition[i].substring(1);
                            };
                            if (definition[i][definition[i].length -1] === "'"){
                                definition[i] = definition[i].slice(0,definition[i].length-1);
                            }
                            translations.push(definition[i])
                            
                        }
                    }
                    if (i < (definition.length)) {
                        definition.slice(i, definition.length -1).forEach(function(entry){
                            if (!translations.includes(entry)){
                                if (entry[0] === "'"){
                                    entry = entry.substring(1);
                                };
                                while (entry[entry.length -1] === "'" || entry[entry.length -1] === String.fromCharCode(93) || entry[entry.length -1] === '"'  ){
                                    entry = entry.slice(0,entry.length-1);
                                }
                                contextFound.push(entry.replace("context=", ""));
                            }
                        })
                        }
                    wordsFound.push({key:key, translations:translations, context:contextFound});
    
                });
    
                const examplesFound = [];
                examples.forEach(function(definition){
                    let example = definition[0].slice(0, definition[0].length - 2);
                    while (example[0] === "'"){
                        example = example.substring(1);
                    };
                    while (example[example.length -1] === "'" || example[example.length -1] === String.fromCharCode(93) || example[example.length -1] === '"'  ){
                        example = example.slice(0,example.length -1);
                    }
                    let translation_example = '';
                    if (definition.length > 1){
                        translation_example = definition[1].slice(0, definition[1].length - 2);
                        if (translation_example[0] === "'"){
                            translation_example = translation_example.substring(1);
                        };
                        if (translation_example[translation_example.length -1] === "'"){
                            translation_example = translation_example.slice(0,translation_example.length-1);
                        }
                    };
                    examplesFound.push({example:example, translation_example:translation_example});
                });
    
                if (wordsFound.length === 1 && wordsFound[0].key === 'Word not found!') {
                    let errorStatement = 'Word not found';
                    res.render('dictionary', {errorStatement: errorStatement})
                } else {
                    res.render('definition', {words:wordsFound, examples:examplesFound})
                }
            }

        }

    });
////////////////////////////////////////////////////////////////////////////           

});


///////// GERMAN ARTICLE

app.route('/german-article')
.get(function(req,res){
    res.render('german-article', {errorStatement: null})
})
.post(function(req,res){
    const word = req.body.word;
    let meanings = []

    let regex = new RegExp("^" + word + "$", "i")
    Word.find({word: regex}, function(err, foundWords){
        if(err){
            console.log(err);
        } else {
            if (foundWords.length > 0) {
                meanings = foundWords
                res.render('check', {meanings:foundWords, word:word})
            } else {

/////////////////////////////////////// python: meanings = find_article(word)
                var findArticle = __dirname + '/find_article.py';
                var options = {args: ['find_article', word]};

                PythonShell.run(findArticle, options, function(err, meanings){
                    if(err){
                        console.log('errors!!!');
                    } else {
                        meaningsFound = [];
                        let newMeanings = meanings[0].split(']], [');
                        let convertedMeanings = []
                        newMeanings.forEach(function(entry){
                            convertedMeanings.push([entry.split("', ")])
                        })
                        convertedMeanings.forEach(function(meaning){
                            for(var i = 0; i < meaning[0].length; i++) {
                                meaning[0][i] = meaning[0][i].replace(/'/g, "");
                                meaning[0][i] = meaning[0][i].split(String.fromCharCode(92) + 'xad').join('')
                                meaning[0][i] = meaning[0][i].split(String.fromCharCode(92) + 'xa0').join('')
                                meaning[0][i] = meaning[0][i].split(String.fromCharCode(92) + 'n').join('')
                                meaning[0][i] = meaning[0][i].split(String.fromCharCode(219)).join('')
                                meaning[0][i] = meaning[0][i].split(String.fromCharCode(221)).join('')

                                while (meaning[0][i][0] === '['){
                                    meaning[0][i] = meaning[0][i].substring(1);
                                };
                                while (meaning[0][i][meaning[0][i].length -1] === ']'){
                                    meaning[0][i] = meaning[0][i].slice(0,meaning[0][i].length -1);
                                }
                            }

                        })
                        convertedMeanings.forEach(function(meaning){
                            const begriff = meaning[0][0];
                            let article = meaning[0][1];
                            if (article === 'das oder der') {
                                article = 'der oder das';
                            } else if (article === 'das oder die') {
                                article = 'die oder das';
                            } else if (article === 'die oder der') {
                                article = 'der oder die';
                            };
                            let definitions = null;
                            if (meaning[0].length > 2) {
                                    definitions = meaning[0].slice(2, meaning[0].length )
                                };
                            
                            if (meanings.length !== 0) {
                                if (begriff && word){
                                    const newWord = Word({word:begriff, article:article, definitions:definitions});
                                    newWord.save();
                                    meaningsFound.push(newWord)
                                }
                                
                            };
                        });
                    }
                    if (meaningsFound.length > 0) {
                        res.render('check', {meanings:meaningsFound, word:word})
                    } else {
                        let errorStatement = 'Word not found';
                        res.render('german-article', {errorStatement:errorStatement});
                    } 
                })
///////////////////////////////////////////////////////////////////////////////////////////////////
        }};
     });
});

app.get('/words',function(req,res){
    Word.find({}).sort('article').exec(function(err,foundWords){
        if(err){
            console.log(err);
            res.redirect('/');
        } else {
            res.render('words', {words:foundWords});
        }
    });
})

app.post('/delete', function(req,res){
    const wordID = req.body.wordID;

    Word.findByIdAndRemove(wordID, function(err){
        if(err){
            console.log(err);
            res.redirect('/');
        } else {
            res.redirect('/words');
        }
    });
});


app.listen(3000, function() {
    console.log('Server started on port 3000.')
})


