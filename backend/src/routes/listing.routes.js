const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { applyListing, getMyListings, getListingStatus, getListingPackages } = require('../controllers/listing.controller');

// Public
router.get('/packages', getListingPackages);

// Protected
router.use(authenticate);
router.post('/apply',    applyListing);
router.get('/my',        getMyListings);
router.get('/:id',       getListingStatus);

module.exports = router;
