const fs = require('fs')
const os = require('os')
const S3rver = require('s3rver') // require('s3rver') // todo: return this after #346 is merged
const request = require('request')
const debug = require('debug')
const { map } = require('async')

const log = debug('s3rver')

const port = parseInt(process.env.PORT || 4569)
const hostname = '0.0.0.0'
const silent = process.env.SILENT === 'true' || false
const directory = process.cwd() + '/.data'
const subscriptions = getSubscriptions()
const cors = fs.readFileSync(`${__dirname}/cors.xml`).toString('utf8')
log('subscriptions:', subscriptions)

const params = {
  port,
  silent,
  hostname,
  directory,
  cors
}
log('params:', params)

const server = new S3rver(params)
const instance = server.run(function (err, host, port) {
  if (err) {
    console.error(err)
  } else {
    console.log('now listening on host %s and port %d', os.hostname(), port);
  }
})

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
    log('results:', JSON.stringify(res, null, 2))
  })
})

function processSubscription (subscription, callback) {
  const { bucket, event, action, record } = this
  const { bucket: subbucket, event: subevent, action: subaction, url } = subscription
  if ((bucket === subbucket || subbucket === '*') &&
    (event === subevent || subevent === '*') && 
    (action === subaction || subaction === '*')) {
    const options = {
      method: 'POST',
      url,
      json: true,
      body: {
        Records: [record]
      }
    }
    log('sending event:', { bucket, event, action, url })
    request(options, (err, res) => {
      if (err) return callback(err)
      const { statusCode, body } = res
      callback(null, { url, bucket, event, action, statusCode, body })
    })
  } else {
    // No action, skip

    log('no event for:', { bucket, event, action, url })
    callback()
  }
}

function processRecord (record, callback) {
  const { eventName, s3: { bucket: { name } } } = record
  const [event, action] = eventName.split(':')
  const context = {
    bucket: name,
    event,
    action,
    record
  }
  log('processing event:', { bucket: name, event, action })
  map(subscriptions, processSubscription.bind(context), callback)
}

function getSubscriptions () {
  // e.g. SUBSCRIBE=bucket:ObjectCreated:*(http://example.com/bar),ObjectCreated:Put(http://example.com/foo)
  if (process.env.SUBSCRIBE) {
    return process.env.SUBSCRIBE
      .split(',')
      .map(e => e.match(/^((\w|-)+):(\w+|[*]):(\w+|[*])\((.+)\)$/))
      .filter(e => e)
      .map(([g0, bucket, g2, event, action, url]) => ({ bucket, event, action, url }))
  }
  return []
}

function term (err) {
  if (err) console.error(err)
  instance.close()
  process.exit()
}

process.on('SIGTERM', () => term())
process.on('uncaughtException', err => term(err))
