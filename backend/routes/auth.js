const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const { getDB } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const { sendWelcomeEmail } = require('../utils/mailer');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Validation rules
const signupValidation = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-50 characters, letters, numbers, underscores only'),
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
    .withMessage('Password must be 8+ characters with letters and numbers')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

// Signup
router.post('/signup', signupValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { username, email, password } = req.body;
    const db = getDB();

    // ✅ Fixed operator precedence with parentheses
    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE email = ? OR username = ? AND is_deleted = 0',
      [email, username]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Default profile_pic is NULL
    const [result] = await db.execute(
      'INSERT INTO users (username, first_name, email, password, user_type, profile_pic) VALUES (?, ?, ?, ?, ?, ?)',
      [username, username, email, hashedPassword, 'local', null]
    );

    const token = jwt.sign(
      { id: result.insertId, username, email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // await sendWelcomeEmail(email, username);

    res.status(201).json({
      token,
      id: result.insertId,
      username,
      firstName: username,
      email,
      mode: 'light',
      picture: null, // 👈 Always null at signup
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Login
router.post('/login', loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { email, password } = req.body;
    const db = getDB();

    const [users] = await db.execute(
      'SELECT id, username, email, password, display_mode, profile_pic FROM users WHERE email = ? AND is_deleted = 0',
      [email]
    );

    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
// await sendWelcomeEmail(user.email, user.first_name);

    res.json({
      token,
      id: user.id,
      username: user.username,
      firstName: user.username,
      email: user.email,
      mode: user.display_mode,
      picture: user.profile_pic ? user.profile_pic : null, // 👈 Return picture if exists
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Google OAuth
router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;
    console.log("Token:", token);

    const db = getDB();

    // Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload; // 👈 added picture

    console.log("Payload:", payload);
    console.log("Google ID:", googleId);
    console.log("Email:", email);
    console.log("Name:", name);
    console.log("Picture:", picture);

    // Check if user exists (fixed SQL precedence)
    const [users] = await db.execute(
      'SELECT id, username, first_name, email, display_mode, profile_pic FROM users WHERE (google_id = ? OR email = ?) AND is_deleted = 0',
      [googleId, email]
    );

    let user;
    if (users.length === 0) {
      const username = email.split('@')[0] + Math.random().toString(36).substr(2, 4);

      const [result] = await db.execute(
        'INSERT INTO users (username, first_name, email, google_id, user_type, profile_pic) VALUES (?, ?, ?, ?, ?, ?)',
        [username, name, email, googleId, 'google', picture]
      );

      user = {
        id: result.insertId,
        username,
        first_name: name,
        email,
        display_mode: 'light',
        profile_pic: picture
      };
      //  await sendWelcomeEmail(user.email, user.first_name);
    } else {
      user = users[0];
    }

    // Generate JWT
    const jwtToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
   

    // ✅ Send JSON response with profile picture
    res.json({
      token: jwtToken,
      id: user.id,
      username: user.username,
      firstName: user.first_name,
      email: user.email,
      mode: user.display_mode,
      picture: user.profile_pic,
      message: 'Google login successful'
    });

  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ message: 'Google authentication failed', error: error.message });
  }
});



// Check email
router.get('/check-email', async (req, res) => {
  console.log("checkemail working");
  
  try {
    const { email } = req.query;
    const db = getDB();
    
    const [users] = await db.execute(
      'SELECT COUNT(*) as count FROM users WHERE email = ? AND is_deleted = 0',
      [email]
    );
    
    res.json(users[0].count === 0);
  } catch (error) {
    logger.error('Check email error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update theme
router.put('/theme', authenticateToken, async (req, res) => {
  try {
    const { theme } = req.body;
    const userId = req.user.id;
    const db = getDB();

    if (!['light', 'dark', 'system'].includes(theme)) {
      return res.status(400).json({ message: 'Invalid theme' });
    }

    await db.execute(
      'UPDATE users SET display_mode = ? WHERE id = ?',
      [theme, userId]
    );

    res.json({ message: 'Theme updated successfully', theme });
  } catch (error) {
    logger.error('Theme update error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
