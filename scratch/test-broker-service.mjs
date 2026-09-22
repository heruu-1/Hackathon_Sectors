import { getBrokerActivityService } from '../lib/server/services/broker-activity.ts'

async function run() {
  console.log('Testing getBrokerActivityService for YP...')
  const start = Date.now()
  const data = await getBrokerActivityService('YP')
  const duration = Date.now() - start
  console.log(`Finished in ${duration}ms`)
  if (!data) {
    console.error('Data is null!')
    return
  }
  const res = { success: true, data }
  if (res.data) {
    console.log('Broker Code:', res.data.brokerCode)
    console.log('Broker Name:', res.data.brokerName)
    console.log('Broker Type:', res.data.brokerType)
    console.log('Total Gross:', res.data.totalGrossValue)
    console.log('Total Net:', res.data.totalNetValue)
    console.log('Period:', res.data.periodStart, 'to', res.data.periodEnd)
    console.log('Top Net Buy count:', res.data.topNetBuy.length)
    if (res.data.topNetBuy.length > 0) {
      console.log('Top 3 Net Buy:', res.data.topNetBuy.slice(0, 3))
    }
    console.log('Top Net Sell count:', res.data.topNetSell.length)
    if (res.data.topNetSell.length > 0) {
      console.log('Top 3 Net Sell:', res.data.topNetSell.slice(0, 3))
    }
    console.log('Top Gross count:', res.data.topGross.length)
  }
}

run().catch(console.error)
