const express = require("express");
const { getSafeRoute } = require("../controllers/routingController");

const router = express.Router();

router.post("/safety-check", getSafeRoute);

module.exports = router;
