// @ts-nocheck
'use strict';

const { Router } = require('express');
const upload = require('../middlewares/upload.middleware');
const controller = require('../controllers/file.controller');
const { asyncHandler } = require('../utils/asyncHandler');

const router = Router();

router.post('/', upload.single('file'), asyncHandler(controller.uploadFile));
router.post('/from-url', asyncHandler(controller.importFromUrl));
router.get('/', asyncHandler(controller.listFiles));
router.get('/:id', asyncHandler(controller.getFile));
router.get('/:id/download', asyncHandler(controller.downloadFile));
router.delete('/:id', asyncHandler(controller.deleteFile));

module.exports = router;
