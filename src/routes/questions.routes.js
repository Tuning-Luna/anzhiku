// @ts-nocheck
'use strict';

const { Router } = require('express');
const controller = require('../controllers/question.controller');
const { asyncHandler } = require('../utils/asyncHandler');

const router = Router();

router.get('/', asyncHandler(controller.listQuestions));
router.get('/:id', asyncHandler(controller.getQuestion));
router.patch('/:id', asyncHandler(controller.updateQuestion));
router.delete('/:id', asyncHandler(controller.deleteQuestion));

module.exports = router;
