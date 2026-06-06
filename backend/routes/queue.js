const express = require('express');
const { createClient } = require('redis');
const QueueToken = require('../models/QueueToken');
const auth = require('../middleware/auth');

const router = express.Router();

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().catch(console.error);

const AVG_SERVICE_TIME = 15; // 15 mins

// Add to Queue
router.post('/join', auth, async (req, res) => {
  try {
    const { department, urgency, issues, isEmergency } = req.body;
    
    // Create token in DB
    const token = new QueueToken({
      userId: req.user.userId,
      department,
      urgency,
      issues,
      isEmergency
    });
    
    await token.save();
    
    // Add to Redis Queue
    const queueKey = `queue:${department}`;
    
    // If emergency, prioritize by adding to front (LPUSH), else back (RPUSH)
    if (isEmergency) {
      await redisClient.lPush(queueKey, token._id.toString());
    } else {
      await redisClient.rPush(queueKey, token._id.toString());
    }
    
    // Get Position
    const elements = await redisClient.lRange(queueKey, 0, -1);
    const positionIndex = elements.indexOf(token._id.toString());
    
    token.position = positionIndex + 1;
    token.estimatedWaitTime = token.position * AVG_SERVICE_TIME;
    await token.save();
    
    req.io.emit('queueUpdate', { department });
    
    if (token.position <= 2) {
      req.io.to(token.userId.toString()).emit('notification', { message: 'Leave Now! Your turn is approaching.' });
    }
    
    res.status(201).json(token);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Track position
router.get('/status/:tokenId', auth, async (req, res) => {
  try {
    const token = await QueueToken.findById(req.params.tokenId);
    if (!token) return res.status(404).json({ message: 'Token not found' });
    
    if (token.status === 'completed' || token.status === 'cancelled') {
        return res.json(token);
    }
    
    const queueKey = `queue:${token.department}`;
    const elements = await redisClient.lRange(queueKey, 0, -1);
    const positionIndex = elements.indexOf(token._id.toString());
    
    if (positionIndex === -1 && token.status !== 'serving') {
        // Just fallback
    } else if (positionIndex !== -1) {
      token.position = positionIndex + 1; // 1-based index
      token.estimatedWaitTime = token.position * AVG_SERVICE_TIME;
    }
    
    res.json(token);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Admin Remove user (dequeue)
router.post('/serve/:department', auth, async (req, res) => {
  try {
    // Allow admin and service_providers
    if (req.user.role === 'user') {
      return res.status(403).json({ message: 'Staff only' });
    }

    const { department } = req.params;
    const queueKey = `queue:${department}`;
    
    // Pop from left (front of queue)
    const tokenId = await redisClient.lPop(queueKey);
    
    if (!tokenId) {
      return res.status(404).json({ message: 'Queue is empty' });
    }
    
    const token = await QueueToken.findById(tokenId);
    token.status = 'serving';
    token.servedAt = new Date();
    token.position = 0;
    token.estimatedWaitTime = 0;
    await token.save();
    
    req.io.emit('queueUpdate', { department });
    req.io.to(token.userId.toString()).emit('notification', { message: 'It is your turn now!' });
    
    res.json({ message: 'User serving now', token });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Admin Get all queues
router.get('/all', auth, async (req, res) => {
  try {
    if (req.user.role === 'user') return res.status(403).json({ message: 'Staff only' });
    const tokens = await QueueToken.find({ status: { $in: ['waiting', 'serving'] } })
      .populate('userId', 'name email')
      .sort('createdAt');
      
    res.json(tokens);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get my active queue
router.get('/my-active', auth, async (req, res) => {
  try {
    const token = await QueueToken.findOne({ userId: req.user.userId, status: { $in: ['waiting', 'serving'] } });
    if (!token) return res.status(404).json({ message: 'No active queue' });
    
    if (token.status === 'serving') {
       token.position = 0;
       token.estimatedWaitTime = 0;
    } else {
       const queueKey = `queue:${token.department}`;
       const elements = await redisClient.lRange(queueKey, 0, -1);
       const positionIndex = elements.indexOf(token._id.toString());
       if (positionIndex !== -1) {
         token.position = positionIndex + 1;
         token.estimatedWaitTime = token.position * AVG_SERVICE_TIME;
       }
    }
    res.json(token);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin mark complete
router.post('/complete/:tokenId', auth, async (req, res) => {
  try {
    if (req.user.role === 'user') return res.status(403).json({ message: 'Staff only' });
    
    const token = await QueueToken.findById(req.params.tokenId);
    if (!token) return res.status(404).json({ message: 'Token not found' });
    
    token.status = 'completed';
    token.completedAt = new Date();
    await token.save();
    
    req.io.emit('queueUpdate', { department: token.department });
    res.json({ message: 'Token completed', token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin reassign token 
router.post('/reassign/:tokenId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    
    const { department } = req.body;
    const token = await QueueToken.findById(req.params.tokenId);
    if (!token) return res.status(404).json({ message: 'Token not found' });
    
    // remove from old redis list
    const oldKey = `queue:${token.department}`;
    await redisClient.lRem(oldKey, 0, token._id.toString());
    const oldDept = token.department;
    
    // add to new redis list
    token.department = department;
    const newKey = `queue:${department}`;
    if (token.isEmergency) {
      await redisClient.lPush(newKey, token._id.toString());
    } else {
      await redisClient.rPush(newKey, token._id.toString());
    }
    
    await token.save();
    req.io.emit('queueUpdate', { department });
    req.io.emit('queueUpdate', { department: oldDept });
    
    res.json({ message: 'Reassigned successfully', token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
