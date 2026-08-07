// @ts-nocheck
'use strict';

const { Router } = require('express');

const router = Router();

router.use('/files', require('./files.routes'));
router.use('/tasks', require('./tasks.routes'));
router.use('/questions', require('./questions.routes'));
router.use('/banks', require('./banks.routes'));
router.use('/categories', require('./categories.routes'));

router.get('/ping', (req, res) => {
  res.json({ message: 'pong' });
});

module.exports = router;
