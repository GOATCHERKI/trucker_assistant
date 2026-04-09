const express = require("express");
const { getRoadsByBbox } = require("../controllers/osmController");

const router = express.Router();

router.get("/roads", getRoadsByBbox);

module.exports = router;
