// @ts-nocheck
'use strict';

const { Router } = require('express');
const controller = require('../controllers/bank.controller');
const { asyncHandler } = require('../utils/asyncHandler');

const router = Router();

router.get('/', asyncHandler(controller.listBanks));
router.delete('/:id', asyncHandler(controller.deleteBank));

module.exports = router;
