import mongoose from "mongoose";

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("mongo db connected");

        // Self-heal legacy messages without readAt so they aren't falsely counted as unread
        mongoose.connection.collection("messages").updateMany(
            { readAt: { $exists: false } },
            { $set: { readAt: new Date() } }
        ).catch((err) => {
            console.error("Backfill legacy messages readAt error:", err);
        });
    } catch (error) {
        console.log(error);
        throw error; 
    }
};

export default connectDB;
