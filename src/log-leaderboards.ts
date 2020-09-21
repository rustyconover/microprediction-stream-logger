// Download the contents of all of the leaderboards at Microprediction.org and
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

  const stream_boards: {
    [stream: string]: {
      [delay: string]: {
        [identity: string]: number;
      };
    };
  } = {};

  await async.eachLimit(Object.keys(streams), 25, async (stream) => {
    for (const delay of config.delays) {
      const board = await reader.get_leaderboard(stream, delay);
      if (stream_boards[stream] == null) {
        stream_boards[stream] = {};
      }
      stream_boards[stream][delay.toString(10)] = board;
    }
  });

  // Now that the doubles have been written, lets compress them.
  const c = zlib.gzipSync(
    Buffer.from(JSON.stringify([new Date().getTime(), stream_boards]))
  );

  const k = `leaderboards/${moment().format("YYYYMMDD-HHmmss")}`;

  console.log(`Uploading ${c.length} bytes`);
  await S3.putObject({
    Bucket: "predictionstreams",
    Key: k,
    Body: c,
    ContentEncoding: "gzip",
    ContentType: "application/octet-stream",
  }).promise();
}

export const handler: ScheduledHandler<any> = async (event) => {
  console.log("Fetching data");
  await getStreams();
};
