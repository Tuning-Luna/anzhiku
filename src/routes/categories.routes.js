// @ts-nocheck
'use strict';

const { Router } = require('express');
const controller = require('../controllers/category.controller');
const { asyncHandler } = require('../utils/asyncHandler');

const router = Router();

router.get('/', asyncHandler(controller.getCategoryTree));

module.exports = router;
