const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Token = require("../models/tokenModel");

const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");



const generateToken = (id) =>{
    return jwt.sign({id},process.env.JWT_SECRET,{expiresIn: "1d"});
};

//REGISTER USER

const registerUser = asyncHandler( async(req, res) =>{
    const{name, email,password}=req.body


    if(!name || !email || !password){
        req.statusCode(400)
        throw new Error("Please fill in all required fields")
    }
    if (password.length < 6) {
        res.status(400);
        throw new Error("Password must be up to 6 characters");
      }

      //check if user email already exists
      const userExists= await User.findOne({email})

      if(userExists)
      {
        res.status(400);
        throw new Error("Email has already been registered");
      
      }

      //creating new user
      const user = await User.create({
        name,
        email,
        password,
      });

      //Generate Token
      const token=generateToken(user._id)

      //send http-only cookie
      res.cookie("token", token, {
        path: "/",
        httpOnly: true,
        expires: new Date(Date.now()+1000 * 86400),
        sameSites:"none",
        secure: true

      })



      if(user){
        const {_id,name,email,photo,phone,bio}= user
        res.status(201).json({
            _id,
            name,
            email,
            photo,
            phone, 
            bio,
            token, 
        });
      }
        else {
        res.status(400);
        throw new Error("Invalid user data");
      }
});


//Login User

const loginUser= asyncHandler(async(req,res)=>{
    const {email, password} = req.body

    //validates request
    if(!email || !password){
        res.status(400);
        throw new Error("Please add email and password");
    }

    //check if user exists
    const user= await User.findOne({email})

    if(!user)
    {
        res.status(400);
        throw new Error("User not found, please sign up");
    }


    //user exists, now check if the passsword is correct

    const passwordIsCorrect =  await bcrypt.compare(password, user.password)

    //Generate Token
    const token=generateToken(user._id)

    //send http-only cookie
    res.cookie("token", token, {
      path: "/",
      httpOnly: true,
      expires: new Date(Date.now()+1000 * 86400),
      sameSites:"none",
      secure: true

    });


    if(user && passwordIsCorrect){
        const {_id,name,email,photo,phone,bio}= user
        res.status(200).json({
            _id,
            name,
            email,
            photo,
            phone, 
            bio,
            token,
        });
    }
    else{
        res.status(400);
        throw new Error("Invalid Email or Password");
    }
});
  

//Logout user

const logout = asyncHandler(async(req,res)=>{
    res.cookie("token", "", {
        path: "/",
        httpOnly: true,
        expires: new Date(0), //exprire that cookie
        sameSites:"none",
        secure: true
      });
      return res.status(200).json({message: "Successfully logged out"})
});


//get user data

const getUser= asyncHandler(async(req,res)=>{
    const user = await User.findById(req.user._id)


    if(user){
        const {_id,name,email,photo,phone,bio}= user
        res.status(200).json({
            _id,
            name,
            email,
            photo,
            phone, 
            bio,
        });
    }
    else{
        res.status(400);
        throw new Error("User not found");
    }
});

//get login status

const loginStatus = asyncHandler(async(req,res)=>{
    const token= req.cookies.token;

    if(!token)
    {
        return res.json(false);
    }

     //verify token

     const verified = jwt.verify(token, process.env.JWT_SECRET);

     if(verified){
        return res.json(true);
     }
     else
     return res.json(false);

});


//update user

const updateUser = asyncHandler(async(req, res)=>{
    const user=  await User.findById(req.user._id)

    if(user){
        const {name,email,photo,phone,bio}= user;
        user.email = email;
        user.name= req.body.name || name;
        user.photo= req.body.photo|| photo;
        user.phone= req.body.phone || phone;
        user.bio= req.body.bio || bio;



        const updatedUser = await user.save();

        res.status(200).json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            photo: updatedUser.photo,
            phone: updatedUser.phone, 
            bio: updatedUser.bio,
        })
    }
    else{
        res.status(404)
        throw new Error("User not found");
    }
});


//change password


const changePassword = asyncHandler(async(req, res)=>{
    const user=  await User.findById(req.user._id);

    const {oldPassword, password} = req.body

    //validate


    if(!user){
        res.status(400);
        throw new Error("User not found, please signup");
    }

    if(!oldPassword || !password){
        res.status(400);
        throw new Error("Please add old and new Password");
    }

    //check if old password is correct i.e matches db password

    const passwordIsCorrect = await bcrypt.compare(oldPassword, user.password)

    //save new password

    if(user && passwordIsCorrect){
        user.password = password;

        await user.save()

        res.status(200).send("Password changed successful");
    }
    else{
        res.status(400);
        throw new Error("Old passsword is incorrect");
    }

});


const forgotPassword = asyncHandler(async(req, res)=>{
    const {email} = req.body
    const user = await User.findOne({email})

    if(!user){
        res.status(404)
        throw new Error("User doesnot exist")
    }



    //create reset token

    let resetToken = crypto.randomBytes(32).toString("hex") + user._id


    //hash token before saving to db

    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex")

    //save token to DB
    await new Token({
        userid: user._id,
        token: hashedToken,
        createAt: Date.now(),
        expiresAt: Date.now()+30*(60*1000) //30 minutes
    }).save()


    //construct reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`


    //Reset Email

    const message = `
    <h2> Hello ${user.name}</h2>
    <p> Please use the url below to reset your password </p>
    <p> This reset link is valid for only 30 minutes</p>
    <a href=${resetUrl} clicktracking=off>${resetUrl} </a>


    <p> Regards... </p>
    <p> Goutam Goyal </p>
    `;

    const subject = "Password reset Request"
    const send_to = user.email
    const sent_from = process.env.EMAIL_USER


    try{
        await sendEmail(subject, message, send_to, sent_from)
        res.status(200).json({success: true, message:"Reset Email Sent"});        
    }
    catch(err){
        res.status(500);
        throw new Error("Email not sent, please try again");
    }
});


module.exports={
    registerUser,
    loginUser,
    logout,
    getUser,
    loginStatus,
    updateUser,
    changePassword,
    forgotPassword,
};