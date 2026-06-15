import Order from '@/models/Order'
import OrderCounter from '@/models/OrderCounter'

export const ORDER_NUMBER_START = 612345

async function ensureOrderCounter(storeId) {
  const existing = await OrderCounter.findOne({ storeId }).lean()
  if (existing) return existing

  const maxOrder = await Order.findOne({
    storeId,
    shortOrderNumber: { $gte: ORDER_NUMBER_START },
  })
    .sort({ shortOrderNumber: -1 })
    .select('shortOrderNumber')
    .lean()

  const initialSeq = Math.max(
    ORDER_NUMBER_START - 1,
    Number(maxOrder?.shortOrderNumber) || ORDER_NUMBER_START - 1,
  )

  try {
    await OrderCounter.create({ storeId, seq: initialSeq })
  } catch (error) {
    if (error?.code !== 11000) {
      throw error
    }
  }

  return OrderCounter.findOne({ storeId }).lean()
}

export async function syncOrderCounterFloor(storeId, shortOrderNumber) {
  const numeric = Number(shortOrderNumber)
  if (!Number.isFinite(numeric) || numeric < ORDER_NUMBER_START) {
    return
  }

  await ensureOrderCounter(storeId)

  await OrderCounter.findOneAndUpdate(
    { storeId, seq: { $lt: numeric } },
    { $set: { seq: numeric } },
  )
}

export async function allocateShortOrderNumber(storeId) {
  if (!storeId) {
    throw new Error('storeId is required to allocate an order number')
  }

  await ensureOrderCounter(storeId)

  const counter = await OrderCounter.findOneAndUpdate(
    { storeId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )

  if (!counter?.seq || counter.seq < ORDER_NUMBER_START) {
    await OrderCounter.findOneAndUpdate(
      { storeId },
      { $set: { seq: ORDER_NUMBER_START } },
      { upsert: true },
    )
    return ORDER_NUMBER_START
  }

  return counter.seq
}
