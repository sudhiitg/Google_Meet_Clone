const mongoose = require("mongoose")


const roomSchema = new mongoose.Schema({
    roomId: String,
    currentusers: Number,
    users: [{
        peerid: String,
        id: String,
        name: String,
        photo: String
    }]
})
// console.log("schema")
module.exports = mongoose.model("Room", roomSchema);
