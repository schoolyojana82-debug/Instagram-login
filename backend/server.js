require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// connect
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=>console.log('mongo connected'))
  .catch(err=>console.error(err));

// user model
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  passwordHash: String,
}, { timestamps: true });
const User = mongoose.model('User', UserSchema);

// register
app.post('/auth/register', async (req, res) => {
  try{
    const { username, email, password } = req.body;
    if(!username || !email || !password) return res.status(400).json({message:'Missing fields'});
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, passwordHash: hash });
    res.json({ id: user._id, username: user.username });
  }catch(err){
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// login
app.post('/auth/login', async (req, res) => {
  try{
    const { identifier, password } = req.body;
    const bcrypt = require('bcrypt');
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    });
    if(!user) return res.status(401).json({ message: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.passwordHash);
    if(!match) return res.status(401).json({ message: 'Invalid credentials' });

    // sign JWT
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // set httpOnly cookie (optional)
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7*24*60*60*1000 });
    res.json({ message: 'ok', user: { id: user._id, username: user.username } });
  }catch(err){
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// protected example
app.get('/me', async (req,res) => {
  try{
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if(!token) return res.status(401).json({message:'Not authenticated'});
    const jwt = require('jsonwebtoken');
    const data = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(data.id).select('-passwordHash');
    res.json({ user });
  }catch(err){
    res.status(401).json({ message: 'Invalid token' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=>console.log('Server on '+PORT));
