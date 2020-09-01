# Log Microprediction.org streams to S3

This module logs that streams at Microprediction.org to S3 periodically
such that streams that exhibit period behavior longer than the 1,000
data point buffer can be more accurately modelled.

## Implementation Details

There is a single Lambda function that is run as a scheduled
CloudWatch Event every 12 hours. This function
is created using webpack to amalgamate the various imported modules.
