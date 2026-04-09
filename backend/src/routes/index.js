const express = require("express");
const osmRoutes = require("./osmRoutes");
const routingRoutes = require("./routingRoutes");

const router = express.Router();

router.use("/osm", osmRoutes);
router.use("/route", routingRoutes);

module.exports = router;
