const express = require('express');
const app = express();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('./models/user');
const postModel = require('./models/post');
const cookieParser = require('cookie-parser');
const crypto=require('crypto');
const upload = require('./utils/multerconfig');
const { console } = require('inspector');


// Set EJS as templating engine
app.set('view engine', 'ejs');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'))); // for stylesheets & JS




// ROUTES

app.get('/', function (req, res) {
    res.render("index");
});

app.get('/profile/upload', function (req, res) {
    res.render("profileupload");
});

app.post('/upload',upload.single("image") ,function (req, res) {
    console.log(req.file)
});




app.get('/login', function (req, res) {
    res.render("login");
});

app.get('/profile', isLoggedIn, async function (req, res) {
    try {
        let user = await userModel.findOne({ email: req.user.email });
        await user.populate("posts");  // ✅ Must await populate
        res.render("profile", { user });
    } catch (err) {
        res.status(500).send("Error loading profile");
    }
});

app.get("/like/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findOne({ _id: req.params.id }).populate("user");

    if (post.likes.indexOf(req.user.userid) === -1) 
    {
        post.likes.push(req.user.userid);
    } else {
        post.likes.splice(post.likes.indexOf(req.user.userid), 1);
    }

    await post.save();
    res.redirect("/profile");
});


app.get("/edit/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findOne({ _id: req.params.id }).populate("user");
    res.render("edit",{post})
});



app.post('/update/:id', isLoggedIn, async (req, res) => {
    try {
        const postId = req.params.id;
        const updatedContent = req.body.content;

        // Find the post and update its content
        await postModel.findByIdAndUpdate(postId, { content: updatedContent });

        res.redirect('/profile');
    } catch (err) {
        console.error("Update error:", err);
        res.status(500).send("Error updating post");
    }
});


app.post('/post', isLoggedIn, async function (req, res) {
    try {
        let user = await userModel.findOne({ email: req.user.email });
        let { content } = req.body;

        // ✅ Wait for post to be
        let post = await postModel.create({
            user: user._id,
            content
        });

        user.posts.push(post._id);
        await user.save();
        res.redirect('/profile');
    } catch (err) {
        res.status(500).send("Post creation error");
    }
});

app.post('/register', async function (req, res) {
    let { name, password, username, email, age } = req.body;
    let existingUser = await userModel.findOne({ email });

    if (existingUser) return res.status(400).send("User already registered");

    bcrypt.genSalt(10, (err, salt) => {
        if (err) return res.status(500).send("Salt generation error");

        bcrypt.hash(password, salt, async (err, hash) => {
            if (err) return res.status(500).send("Hashing error");

            let user = await userModel.create({
                username,
                email,
                age,
                name,
                password: hash
            });

            let token = jwt.sign({ email: email, userid: user._id }, "shhhh");
            res.cookie("token", token);
            res.send("Registered");
        });
    });
});

app.post('/login', async function (req, res) {
    let { email, password } = req.body;
    let user = await userModel.findOne({ email });

    if (!user) return res.status(400).send("User not found");

    bcrypt.compare(password, user.password, function (err, result) {
        if (err) return res.status(500).send("Comparison error");

        if (result) {
            let token = jwt.sign({ email: user.email, userid: user._id }, "shhhh");
            res.cookie("token", token);
            return res.status(200).redirect("/profile");
        } else {
            return res.status(401).send("Incorrect password");
        }
    });
});

app.get('/logout', function (req, res) {
    res.cookie("token", "");
    res.redirect("/login");
});

function isLoggedIn(req, res, next) {
    if (!req.cookies.token || req.cookies.token === "") {
        return res.redirect('/login');
    } else {
        try {
            let data = jwt.verify(req.cookies.token, "shhhh");
            req.user = data;
            next();
        } catch (err) {
            return res.redirect('/login');
        }
    }
}

app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});
