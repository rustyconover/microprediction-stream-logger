// Download the contents of all of the streams at Microprediction.org and
// save them to a S3 bucket.
//
// Author: Rusty Conover (rusty@conover.me)
//
import { MicroReaderConfig, MicroReader } from "microprediction";
import * as _ from "lodash";
import * as AWS from "aws-sdk";
import * as zlib from "zlib";
import * as crypto from "crypto";
import * as async from "async";
import moment from "moment";
import { ScheduledHandler } from "aws-lambda";

async function getStreams() {
  let config = await MicroReaderConfig.create({});
  const reader = new MicroReader(config);

  const streams = await reader.get_streams();

  const S3 = new AWS.S3({ region: "us-east-1" });

  await async.eachLimit(Object.keys(streams), 25, async (stream) => {
    console.log(`Doing ${stream}`);
    const values = await reader.get_lagged(stream);

    // Since the stream name can be long, lets hash it down to
    // something more reasonable.
    const hash = crypto.createHash("sha256");
    hash.update(stream);
    const d = hash.digest("base64").replace(/\//g, "_");

    const k = `${d}/${moment().format("YYYYMMDD-HHmmss")}`;

    // Since the stream is comprised of doubles, lets store
    // them in binary to save on space.
    const result = Buffer.alloc(16 * values.length);

    values.forEach((v, idx) => {
      const start = 16 * idx;
      result.writeDoubleBE(v[0], start);
      result.writeDoubleBE(v[1], start + 8);
    });

    // Now that the doubles have been written, lets compress them.
    const c = zlib.gzipSync(result);

    await S3.putObject({
      Bucket: "predictionstreams",
      Key: k,
      Body: c,
      ContentEncoding: "gzip",
      ContentType: "application/octet-stream",
    }).promise();
  });
}

export const handler: ScheduledHandler<any> = async (event) => {
  console.log("Fetching data");
  await getStreams();
};
