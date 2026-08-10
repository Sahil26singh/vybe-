import mongoose from "mongoose";


const connectDB = async() => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("mongo db connected");
    } catch (error) {
        console.log(error);
        throw error; // let the caller (startServer) decide to exit instead of listening with a dead DB
    }
}
export default connectDB;