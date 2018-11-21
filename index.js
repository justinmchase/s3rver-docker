const path = require('path')
const S3rver = require('s3rver')
const request = require('request')
const debug = require('debug')
const { map } = require('async')

const log = debug('s3rver')

const port = parseInt(process.env.PORT || 4569)
const hostname = '0.0.0.0'
const silent = process.env.SILENT === 'true' || false
const directory = process.cwd() + '/.data'
const subscriptions = getSubscriptions()
log('subscriptions:', subscriptions)

const params = {
  port,
  silent,
  hostname,
  directory
}
log('params:', params)

const server = new S3rver(params)
const instance = server.run(function (err, host, port) {
  if (err) {
    console.error(err)
  } else {
    console.log('now listening on host %s and port %d', host, port);
  }
});

instance.s3Event.subscribe(function (event) {
  // Example structure:
  // https://docs.aws.amazon.com/AmazonS3/latest/dev/notification-content-structure.html
  const { Records: records = [] } = event
  map(records, processRecord, (err, results) => {
    if (err) return console.error(err)
    log('subscriptions processed.')
    const res = results
      .reduce((arr, item) => [...arr, ...item], [])
      .filter(i => i)
    log(JSON.stringify(res, null, 2))
  })
})

function processSubscription (subscription, callback) {
  const { event, action, record } = this
  const { event: subevent, action: subaction, url } = subscription
  if (event === subevent && (action === subaction || subaction === '*')) {
    const options = {
      method: 'POST',
      url,
      json: true,
      body: {
        Records: [record]
      }
    }
    log('sending event:', { event, action, url })
    request(options, (err, res) => {
      if (err) return callback(err)
      const { statusCode, body } = res
      callback(null, { url, event, action, statusCode, body })
    })
  } else {
    // No action, skip
    callback()
  }
}

function processRecord (record, callback) {
  const { eventName } = record
  const [event, action] = eventName.split(':')
  const context = {
    event,
    action,
    record
  }
  log('processing event:', { event, action })
  map(subscriptions, processSubscription.bind(context), callback)
}

function getSubscriptions () {
  // e.g. SUBSCRIBE=ObjectCreated:*(http://example.com/bar),ObjectCreated:Put(http://example.com/foo)
  if (process.env.SUBSCRIBE) {
    return process.env.SUBSCRIBE.split(',').map(e => e.match(/^(\w+):(\w+|[*])\((.+)\)$/)).filter(e => e).map(([e, event, action, url]) => ({ event, action, url }))
  }
  return []
}
