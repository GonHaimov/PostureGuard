import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

router.post("/register", async (req,res) => {
  try{
    const { username, password } = req.body || {};
    if(!username || !password)
         return res.status(400).json({error:"username and password are required"});

    if(password.length < 6)
         return res.status(400).json({error:"password too short"});

    const exists = await User.findOne({ username: username.toLowerCase().trim() });
    if(exists)
         return res.status(409).json({error:"username already exists"});

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username: username.toLowerCase().trim(), passwordHash });

    return res.status(201).json({ id: user._id, username: user.username });
  } 

  catch(e) {
     return res.status(500).json({error:"server error"});
    }
});

router.post("/login", async (req,res) => {
  try{
    const { username, password } = req.body || {};
    if(!username || !password)
         return res.status(400).json({error:"username and password are required"});

    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if(!user)
         return res.status(401).json({error:"invalid credentials"});

    const ok = await bcrypt.compare(password, user.passwordHash);
    if(!ok)
         return res.status(401).json({error:"invalid credentials"});

    const token = jwt.sign({ uid: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.json({ token });
  }
  catch(e) {
     return res.status(500).json({error:"server error"});
    }
});

export default router;
