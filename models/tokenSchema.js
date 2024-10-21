import mongoose from 'mongoose';




const tokenSchema = new mongoose.Schema({
    name: { type: String, unique: true, required: true },
    mintAddress: { type: String, required: true }
});



const Token = mongoose.model('Token', tokenSchema);

export default Token;