var express = require("express");
const db = require("../db");
var router = express.Router();

/* GET home page. */
router.get("/", async function (req, res, next) {
    res.send(await db.get()); // TODO
});

module.exports = router;
