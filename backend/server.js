const dotenv=require("dotenv").config();
const express= require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors=require("cors");


const userRoute= require("./routes/userRoute");
const errorHandler= require("./middleWare/errorMiddleware");
const cookieParser= require("cookie-parser");

const app=express();


//Middlewares

app.use(express.json()); //handle json data
app.use(cookieParser());
app.use(express.urlencoded({extended: false})); //handle data from url
app.use(bodyParser.json());//frontend to backend
app.use(cors());
//routes middleware
app.use("/api/users", userRoute);

//Routes
app.get("/",(req,res)=>{
    res.send("Home Page");
});

// error middleware
app.use(errorHandler);
//connect to DB and start server

const PORT= process.env.PORT || 8000;
mongoose
    .connect(process.env.MONGO_URI)
    .then(()=>{
        app.listen(PORT, ()=>{
            console.log(`server running on port ${PORT}`)
        })
    })
    .catch((err) => console.log(err))