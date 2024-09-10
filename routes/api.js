var express = require("express");
const db = require("../db");
var router = express.Router();

/* GET home page. */
router.get("/:date?", async function (req, res, next) {
    let data = await db.get(req.params.date);
    if (!data) {
        res.status(404);
        return res.send(
            req.params.date
                ? `No entry on ${req.params.date}`
                : "No date specified. Please provide a date in url format /api/DD.MM.YYYY",
        );
    }
    res.status(200);
    res.send(data);
});

module.exports = router;
