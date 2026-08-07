// @ts-nocheck
'use strict';

const { Router } = require('express');
const controller = require('../controllers/task.controller');
const { asyncHandler } = require('../utils/asyncHandler');

const router = Router();

router.get('/', asyncHandler(controller.listTasks));
router.get('/:id', asyncHandler(controller.getTask));
router.post('/:id/retry', asyncHandler(controller.retryTask));

module.exports = router;
