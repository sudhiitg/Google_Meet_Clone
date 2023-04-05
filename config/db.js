const mongoose = require("mongoose");
const dotenv = require('dotenv');
dotenv.config({ path: './config/config.env' });
const Room = require("../models/room")

const connectDB = async () => {
    try {

        
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDb Atlas connected: ${conn.connection.host}`.cyan.bold);
    } catch (err) {
        console.log(`Error: ${err.message}`.red);
        process.exit(1);
    }
}
module.exports = connectDB;

