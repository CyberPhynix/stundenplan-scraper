if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}
const puppeteer = require("puppeteer");
const schedule = require("node-schedule");

const db = require("./db");

const setupScraper = async () => {
    // Initial Start
    await scrapeSchedule();

    // Interval
    schedule.scheduleJob("0 */2 * * *", scrapeSchedule);
};

const scrapeSchedule = async () => {
    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: "/opt/render/.cache/puppeteer/chrome/linux-128.0.6613.119/chrome-linux64/chrome",
        });
        const page = await browser.newPage();

        await login(page);

        try {
            await page.goto("https://login.schulmanager-online.de/#/modules/schedules/view//");
            await page.waitForSelector("table.calendar-table td", { timeout: 10000 });
        } catch (error) {
            if (error.name === "TimeoutError") throw new Error("Stundenplan wurde nicht geladen.");
            throw error;
        }

        const data = await getScheduleData(page);

        await db.push(data);
    } catch (error) {
        console.error(error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};

const login = async (page) => {
    await page.goto("https://login.schulmanager-online.de/#/login");

    await page.waitForSelector("#emailOrUsername", { timeout: 10000 });
    await page.type("#emailOrUsername", process.env.EMAIL);
    await page.type("#password", process.env.PSW);

    await page.click("span > button.btn.btn-primary.float-right");

    try {
        await page.waitForSelector("h1.d-none.d-md-block", { timeout: 10000 });
    } catch (error) {
        const loginError = await page.evaluate(() => {
            const errorElement = document.querySelector(".alert.alert-danger");
            return errorElement ? errorElement.innerText.trim() : null;
        });

        if (loginError) {
            throw new Error(`Login failed: ${loginError}`);
        } else {
            throw new Error("Login failed: Unknown error");
        }
    }
};

const getScheduleData = async (page) => {
    const { headerData, bodyData } = await page.evaluate(
        (headerFuncStr, bodyFuncStr) => {
            const scrapeHeaderData = new Function("return " + headerFuncStr)();
            const scrapeBodyData = new Function("return " + bodyFuncStr)();

            const headerData = scrapeHeaderData(document);
            const bodyData = scrapeBodyData(document);

            return { headerData, bodyData };
        },
        scrapeHeaderData.toString(),
        scrapeBodyData.toString(),
    );

    return {
        datetime: new Date().toISOString(),
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        header: headerData,
        body: bodyData,
    };
};

const scrapeHeaderData = (document) => {
    const headers = [];
    const headerElements = document.querySelectorAll("thead th");

    headerElements.forEach((header) => {
        const day = header.querySelector(".d-none.d-md-inline")?.innerText.trim() || "";
        const date = header.querySelector("span > span")?.innerText.trim() || "";
        headers.push({ day, date });
    });

    headers.shift();
    return headers;
};

const scrapeBodyData = (document) => {
    const columns = [];
    const headers = document.querySelectorAll("thead th");
    const numOfColumns = headers.length - 1;

    for (let i = 0; i < numOfColumns; i++) {
        columns.push([]);
    }

    const rows = document.querySelectorAll("tbody tr");
    rows.forEach((row) => {
        const cells = row.querySelectorAll("td");

        cells.forEach((cell, colIndex) => {
            if (colIndex < numOfColumns) {
                const lessonCells = cell.querySelectorAll(".lesson-cell");
                const lessons = [];

                lessonCells.forEach((lessonCell) => {
                    const isCancelled = lessonCell.classList.contains("cancelled");
                    const isNew = lessonCell.classList.contains("is-new");

                    const subject = lessonCell.querySelector(".timetable-left")?.innerText.trim() || "";
                    const teacher = lessonCell.querySelector(".timetable-right")?.innerText.trim() || "";
                    const room = lessonCell.querySelector(".timetable-bottom")?.innerText.trim() || "";

                    lessons.push({
                        subject,
                        teacher,
                        room,
                        cancelled: isCancelled,
                        new: isNew,
                    });
                });

                columns[colIndex].push(lessons);
            }
        });
    });

    return columns;
};

module.exports = setupScraper;
