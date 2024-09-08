const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function push(data) {
    try {
        await client.connect();
        const database = client.db("stundenplan-scraper");
        const collection = database.collection("stundenplan");
        await collection.insertOne(data);
    } catch (error) {
        throw new Error(`Failed to push data to database: ${error}`);
    } finally {
        await client.close();
    }
}

module.exports = { push };
