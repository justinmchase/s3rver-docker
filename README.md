# s3rver-docker
Run an s3rver instance configured to run in a Docker container specifically

## docker-compose
Here is an example of how to run this via docker-compose
```yml
version: "3"
services:
  s3rver:
    image: justinmchase/s3rver
    volumes:
      - $PWD/.data:/app/.data
    ports:
      - "4569:4569"
```

## aws cli
Here is an example of using the aws-cli to copy files into s3rver
```sh
# Start the server
docker-compose up -d

# Make a bucket
aws s3 mb example --endpoint-url http://localhost:4569

# Copy a local file into your new bucket
aws s3 cp ./hello.txt s3://example/hello.txt --endpoint-url http://localhost:4569
```

## aws-sdk
Here is an example of how to configure the `aws-sdk` to use the local endpoint
```js
import { S3 } from 'aws-sdk'
const s3 = new S3({
  endpoint: 'http://localhost:4569',
  s3BucketEndpoint: true,
  s3ForcePathStyle: true
})
```

## Subscribing to events
You can optionally subscribe to events using a simple subscription syntax into the `SUBSCRIBE` environment variable.

Here is an example of how to configure subscriptions using `docker-compose`
```yml
version: "3"
services:
  # This is an example service that is subscribed to receive s3 events
  subscriber:
    build: .
    ports:
      - "3000:3000"

  # This is your s3 server
  s3rver:
    image: justinmchase/s3rver
    ports:
      - "4569:4569"
    links:
      - subscriber
    environment:
      SUBSCRIBE: "example:ObjectCreated:Put(http://subscriber:3000)"
```

The syntax is:
```ml
Subscriptions = Subscription(,Subscription)*
Subscription = Bucket:Event:Action\(Url\)
Bucket = /(\w|-)+/
Event  = 'ObjectCreated' |
         'ObjectRemoved' |
         '*'
Action = 'Put' |
         'Post' |
         'Copy' |
         'CompleteMultipartUpload' |
         'Delete' |
         'DeleteMarkerCreated' |
         '*'
Url = http://Domain/Path
Domain = /\w+(.\w+)+/
Path = /\w+(/\w+)*/
```

### AWS Documentation Details
* [AWS.S3](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html)
* [Supported Notification Event Types](https://docs.aws.amazon.com/AmazonS3/latest/dev/NotificationHowTo.html#supported-notification-event-types)
* [Notification Content Structure](https://docs.aws.amazon.com/AmazonS3/latest/dev/notification-content-structure.html)