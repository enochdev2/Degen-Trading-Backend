import mongoose from "mongoose";

export const connectDB = async () => {
	try {
		const conn = await mongoose.connect(process.env.MONGO_URI);
		console.log(`MongoDB connected: ${conn.connection.host}`);
	} catch (error) {
		console.log("Error connecting to MONGODB", error.message);
		process.exit(1);
	}
};











// // MongoDB setup
// const { MongoClient } = require('mongodb');
// const mongoUri = "mongodb://localhost:27017"; // Use your actual MongoDB URI
// const client = new MongoClient(mongoUri);
// let tokensCollection;




// async function connectToDatabase() {
//     try {
//         await client.connect();
//         const database = client.db('solana_dex');
//         tokensCollection = database.collection('tokens');
//         console.log('Connected to MongoDB');
//     } catch (err) {
//         console.error('Database connection error:', err);
//     }
// }

// connectToDatabase();