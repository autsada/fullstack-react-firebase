import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import Stripe from 'stripe'
import algoliasearch from 'algoliasearch'
import axios from 'axios'

admin.initializeApp()

const env = functions.config()
const productsCollection = 'products'
const productCountsCollection = 'product-counts'
const productCountsDocument = 'counts'
const ordersCollection = 'orders'
const orderCountsCollection = 'order-counts'
const orderCountsDocument = 'counts'
const usersCollection = 'users'
const userCountsCollection = 'user-counts'
const userCountsDocument = 'counts'

const stripe = new Stripe(env.stripe.secret_key, {
  apiVersion: '2020-08-27',
  typescript: true,
})

const algoliaClient = algoliasearch(
  env.algolia.app_id,
  env.algolia.admin_api_key
)

// Create the indices on Algolia
const usersIndex = algoliaClient.initIndex('users')
const productsIndex = algoliaClient.initIndex('products')
const ordersIndex = algoliaClient.initIndex('orders')

type ProductCategory = 'Clothing' | 'Shoes' | 'Watches' | 'Accessories'
type Counts = {
  [key in 'All' | ProductCategory]: number
}
type Product = {
  id: string
  title: string
  description: string
  imageUrl: string
  imageRef: string
  imageFileName: string
  price: number
  category: ProductCategory
  inventory: number
  creator: string
  createdAt: any
  updatedAt?: any
}

type CartItem = {
  id: string
  product: string // Change from Product to string
  quantity: number
  user: string
  item: Product
}

type PaymentStatus = 'Success' | 'Refund' | 'Processing'
type ShipmentStatus = 'New' | 'Preparing' | 'Shipped' | 'Delivered' | 'Cancel'
type Address = {
  index?: number
  fullname: string
  address1: string
  address2?: string
  city: string
  state?: string
  zipCode: string
  phone: string
}
type Order = {
  id: string
  items: CartItem[]
  amount: number
  totalQuantity: number
  shippingAddress: Address
  user: { id: string; name: string, email: string }
  paymentStatus?: PaymentStatus
  paymentType?: 'ONETIME' | 'SUBSCRIPTION'
  subscriptionId?: string
  shipmentStatus?: ShipmentStatus
}
type Role = 'SUPER_ADMIN' | 'CLIENT' | 'ADMIN'

// Helper array
const subscriptions: ('day' | 'week' | 'month')[] = ['day', 'week', 'month']

// const subscriptions: {
//   quantity: 10 | 14 | 20
//   interval: 'week' | 'month'
// }[] = [
//   { quantity: 10, interval: 'week' },
//   { quantity: 14, interval: 'week' },
//   { quantity: 20, interval: 'week' },
//   { quantity: 10, interval: 'month' },
//   { quantity: 14, interval: 'month' },
//   { quantity: 20, interval: 'month' },
// ]

export const onSignup = functions.https.onCall(async (data, context) => {
  try {
    const { username } = data as { username: string }

    if (!context.auth?.uid) return

    // 1. Create a role on the user in the firebase authentication
    await admin.auth().setCustomUserClaims(context.auth.uid, {
      role:
        context.auth.token.email === env.admin.super_admin
          ? 'SUPER_ADMIN'
          : 'CLIENT',
    })

    // 2. Create a new user document in the users collection in firestore
    const result = await admin
      .firestore()
      .collection('users')
      .doc(context.auth?.uid)
      .set({
        username,
        email: context.auth.token.email,
        role:
          context.auth.token.email === env.admin.super_admin
            ? 'SUPER_ADMIN'
            : 'CLIENT',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

    if (!result) return

    return { message: 'User has been created on firestore.' }
  } catch (error) {
    throw error
  }
})

export const updateUserRole = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) throw new Error('Not authenticated')

    const { userId, newRole } = data as { userId: string; newRole: Role }

    // Check authorization
    const adminUser = await admin.auth().getUser(context.auth.uid)

    const { role } = adminUser.customClaims as { role: Role }

    if (role !== 'SUPER_ADMIN') throw new Error('No authorization')

    // Update the auth user (Authentication)
    await admin.auth().setCustomUserClaims(userId, { role: newRole })

    // Update the user in the users collection (firestore)
    return admin.firestore().collection(usersCollection).doc(userId).set(
      {
        role: newRole,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  } catch (error) {
    throw error
  }
})

export const onUserCreated = functions.firestore
  .document(`${usersCollection}/{userId}`)
  .onCreate(async (snapshot, context) => {
    const user = snapshot.data()

    // Query the user-counts/counts from firestore
    const countsData = await admin
      .firestore()
      .collection(userCountsCollection)
      .doc(userCountsDocument)
      .get()

    if (!countsData.exists) {
      // The first user has been created
      await admin
        .firestore()
        .collection(userCountsCollection)
        .doc(userCountsDocument)
        .set({ userCounts: 1 })
    } else {
      const { userCounts } = countsData.data() as { userCounts: number }

      await admin
        .firestore()
        .collection(userCountsCollection)
        .doc(userCountsDocument)
        .set({ userCounts: userCounts + 1 })
    }

    // Create a new user object in Algolia
    return usersIndex.saveObject({
      objectID: snapshot.id,
      ...user,
    })
  })

export const onUserUpdated = functions.firestore
  .document(`${usersCollection}/{userId}`)
  .onUpdate(async (snapshot, context) => {
    const user = snapshot.after.data()

    return usersIndex.saveObject({
      objectID: snapshot.after.id,
      ...user,
    })
  })

export const onUserDeleted = functions.firestore
  .document(`${usersCollection}/{userId}`)
  .onDelete(async (snapshot, context) => {
    // Query the user-counts/counts from firestore
    const countsData = await admin
      .firestore()
      .collection(userCountsCollection)
      .doc(userCountsDocument)
      .get()

    if (!countsData.exists) {
      // The first user has been created
      return
    } else {
      const { userCounts } = countsData.data() as { userCounts: number }

      await admin
        .firestore()
        .collection(userCountsCollection)
        .doc(userCountsDocument)
        .set({ userCounts: userCounts >= 1 ? userCounts - 1 : 0 })
    }

    return usersIndex.deleteObject(snapshot.id)
  })

export const onProductCreated = functions.firestore
  .document(`${productsCollection}/{productId}`)
  .onCreate(async (snapshot, context) => {
    const product = snapshot.data() as Product

    let counts: Counts

    // Query the product-counts collection
    const countsData = await admin
      .firestore()
      .collection(productCountsCollection)
      .doc(productCountsDocument)
      .get()

    if (!countsData.exists) {
      // First product item

      // Construct the counts object
      counts = {
        All: 1,
        Clothing: product.category === 'Clothing' ? 1 : 0,
        Shoes: product.category === 'Shoes' ? 1 : 0,
        Watches: product.category === 'Watches' ? 1 : 0,
        Accessories: product.category === 'Accessories' ? 1 : 0,
      }
    } else {
      const { All, Clothing, Shoes, Watches, Accessories } =
        countsData.data() as Counts

      counts = {
        All: All + 1,
        Clothing:
          product.category === 'Clothing' ? Clothing + 1 : Clothing,
        Shoes: product.category === 'Shoes' ? Shoes + 1 : Shoes,
        Watches: product.category === 'Watches' ? Watches + 1 : Watches,
        Accessories:
          product.category === 'Accessories'
            ? Accessories + 1
            : Accessories,
      }
    }

    // Update the counts document in the product-counts collection
    await admin
      .firestore()
      .collection(productCountsCollection)
      .doc(productCountsDocument)
      .set(counts)

    // Save product on Algolia
    await productsIndex.saveObject({
      objectID: snapshot.id,
      ...product,
    })

    const prod = await stripe.products.create({
      name: product.title,
      type: 'good',
      url: product.imageUrl,
    })
    return Promise.all(
      subscriptions.map(async (sub) => {
        // Create a Stripe price for each interval
        const price = await stripe.prices.create({
          currency: 'usd',
          product: prod.id, // Stripe product id
          unit_amount: product.price * 100,
          recurring: {
            interval: sub,
            interval_count: 1,
            usage_type: 'licensed',
          },
        })
        // Save the price id on the product in Firestore
        return admin
          .firestore()
          .collection(productsCollection)
          .doc(snapshot.id)
          .set({ subscription: { [sub]: price.id } }, { merge: true })
      })
    )

    // // 1. Create a Stripe product
    // const prod = await stripe.products.create({
    //   name: product.title,
    //   type: 'good',
    //   url: product.imageUrl,
    // })

    // return Promise.all(
    //   subscriptions.map(async (sub) => {
    //     // 2. Create a Stripe price for each interval
    //     const price = await stripe.prices.create({
    //       currency: 'usd',
    //       product: prod.id, // Stripe product id
    //       unit_amount: product.price * 100, // amount in cent // If you choose option b, you can apply a differrent unit price here
    //       recurring: {
    //         interval: sub,
    //         interval_count: 1,
    //         usage_type: 'licensed',
    //       },
    //     })

    //     // 3. Save the price id on the product in Firestore
    //     return admin
    //       .firestore()
    //       .collection(productsCollection)
    //       .doc(snapshot.id)
    //       .set({ subscription: { [sub]: price.id } }, { merge: true })
    //   })
    // )
  })

// export const onProductCreated = functions.firestore
//   .document(`${productsCollection}/{productId}`)
//   .onCreate(async (snapshot, context) => {
//     const product = snapshot.data()

//     let counts

//     // Query the product-counts collection
//     const countsData = await admin
//       .firestore()
//       .collection(productCountsCollection)
//       .doc(productCountsDocument)
//       .get()

//     if (!countsData.exists) {
//       // First product item

//       // Construct the counts object
//       counts = {
//         All: 1,
//         Clothing: product.category === 'Clothing' ? 1 : 0,
//         Shoes: product.category === 'Shoes' ? 1 : 0,
//         Watches: product.category === 'Watches' ? 1 : 0,
//         Accessories: product.category === 'Accessories' ? 1 : 0,
//       }
//     } else {
//       const { All, Clothing, Shoes, Watches, Accessories } =
//         countsData.data() as Counts

//       counts = {
//         All: All + 1,
//         Clothing: product.category === 'Clothing' ? Clothing + 1 : Clothing,
//         Shoes: product.category === 'Shoes' ? Shoes + 1 : Shoes,
//         Watches: product.category === 'Watches' ? Watches + 1 : Watches,
//         Accessories:
//           product.category === 'Accessories' ? Accessories + 1 : Accessories,
//       }
//     }

//     // Update the counts document in the product-counts collection
//     await admin
//       .firestore()
//       .collection(productCountsCollection)
//       .doc(productCountsDocument)
//       .set(counts)

//     // Uploading the product in Algolia
//     await productsIndex.saveObject({
//       objectID: snapshot.id,
//       ...product,
//     })

//     // Create product and price on Stripe (Subscription)

//     // Create a Stripe product
//     const prod = await stripe.products.create({
//       name: product.title,
//       type: 'good',
//       url: product.imageUrl,
//     })

//     return Promise.all(
//       subscriptions.map(async (sub) => {
//         // Create a Stripe price for each interval
//         const price = await stripe.prices.create({
//           currency: 'usd',
//           product: prod.id, // Stripe product id
//           unit_amount: product.price * 100,
//           recurring: {
//             interval: sub,
//             interval_count: 1,
//             usage_type: 'licensed',
//           },
//         })

//         // Save the price id on the product in Firestore
//         return admin
//           .firestore()
//           .collection(productsCollection)
//           .doc(snapshot.id)
//           .set({ subscription: { [sub]: price.id } }, { merge: true })
//       })
//     )
//   })

export const onProductUpdated = functions.firestore
  .document(`${productsCollection}/{productId}`)
  .onUpdate(async (snapshot, context) => {
    const beforeProd = snapshot.before.data() as Product
    const afterProd = snapshot.after.data() as Product

    // Check if the category has been changed
    if (beforeProd.category !== afterProd.category) {
      // B. The category is changed
      const countsData = await admin
        .firestore()
        .collection(productCountsCollection)
        .doc(productCountsDocument)
        .get()

      if (!countsData.exists) return

      const counts = countsData.data() as Counts

      // Update the counts object
      counts[beforeProd.category] = counts[beforeProd.category] - 1
      counts[afterProd.category] = counts[afterProd.category] + 1

      await admin
        .firestore()
        .collection(productCountsCollection)
        .doc(productCountsDocument)
        .set(counts)
    }

    return productsIndex.saveObject({
      objectID: snapshot.after.id,
      ...afterProd,
    })
  })

export const onProductDeleted = functions.firestore
  .document(`${productsCollection}/{productId}`)
  .onDelete(async (snapshot, context) => {
    const product = snapshot.data() as Product

    // Query the product-counts/counts from firestore
    const countsData = await admin
      .firestore()
      .collection(productCountsCollection)
      .doc(productCountsDocument)
      .get()

    if (!countsData.exists) return

    const counts = countsData.data() as Counts

    // Update the counts object
    counts.All = counts.All - 1
    counts[product.category] = counts[product.category] - 1

    await admin
      .firestore()
      .collection(productCountsCollection)
      .doc(productCountsDocument)
      .set(counts)

    return productsIndex.deleteObject(snapshot.id)
  })

export const onOrderCreated = functions.firestore
  .document(`${ordersCollection}/{orderId}`)
  .onCreate(async (snapshot, context) => {
    const order = snapshot.data() as Omit<Order, 'id'>

    // Update the products inventory only if the paymentStatus = "Success"
    if (order.paymentStatus === 'Success') {
      // 1. Update the products inventory
      order.items.forEach((cartItem) =>
        admin
          .firestore()
          .collection(productsCollection)
          .doc(cartItem.item.id)
          .get()
          .then((doc) => {
            if (!doc.exists) return

            const product = doc.data() as Product

            return admin
              .firestore()
              .collection(productsCollection)
              .doc(cartItem.item.id)
              .set(
                {
                  inventory:
                    product.inventory >= cartItem.quantity
                      ? product.inventory -
                      cartItem.quantity
                      : 0,
                },
                { merge: true }
              )
          })
      )

      // Create new order on Shipstation
      const secret = Buffer.from(`${env.shipstation.api_key}:${env.shipstation.api_secret}`).toString('base64')

      await axios({
        method: 'POST',
        url: 'https://ssapi.shipstation.com/orders/createorder',
        headers: {
          Authorization: `Basic ${secret}`
        },
        data: {
          orderNumber: snapshot.id,
          orderKey: snapshot.id,
          orderDate: new Date().toISOString(),
          paymentDate: new Date().toISOString(),
          orderStatus: 'awaiting_shipment',
          customerUsername: order.user.name,
          customerEmail: order.user.email,
          billTo: {
            name: 'The President',
          },
          shipTo: {
            name: order.shippingAddress.fullname,
            street1: order.shippingAddress.address1,
            street2: order.shippingAddress.address2 ? order.shippingAddress.address2 : null,
            street3: null,
            city: order.shippingAddress.city,
            state: order.shippingAddress.state,
            postalCode: order.shippingAddress.zipCode,
            country: 'US',
            phone: order.shippingAddress.phone,
            residential: true,
          },
          items: order.items.map((item => {
            return {
              sku: item.item.id,
              name: item.item.title,
              imageUrl: item.item.imageUrl,
              quantity: item.quantity,
              unitPrice: item.item.price
            }
          })),
          amountPaid: order.amount,
        }
      })
    }

    // 2. Create/Update the order-counts/counts
    const countsData = await admin
      .firestore()
      .collection(orderCountsCollection)
      .doc(orderCountsDocument)
      .get()

    if (!countsData.exists) {
      // The first order, create a new counts document

      await admin
        .firestore()
        .collection(orderCountsCollection)
        .doc(orderCountsDocument)
        .set({ orderCounts: 1 })
    } else {
      // Found the counts document, update it
      const counts = countsData.data() as { orderCounts: number }

      await admin
        .firestore()
        .collection(orderCountsCollection)
        .doc(orderCountsDocument)
        .set({ orderCounts: counts.orderCounts + 1 })
    }

    return ordersIndex.saveObject({
      objectID: snapshot.id,
      ...order,
    })
  })

export const onOrderUpdated = functions.firestore
  .document(`${ordersCollection}/{orderId}`)
  .onUpdate(async (snapshot, context) => {
    const oldOrder = snapshot.before.data() as Omit<Order, 'id'>
    const updatedOrder = snapshot.after.data() as Omit<Order, 'id'>

    // Update the product inventory if the orderStatus changed from "Processing" to 'Success'
    if (
      oldOrder.paymentStatus === 'Processing' &&
      updatedOrder.paymentStatus === 'Success'
    ) {
      // 1. Update the products inventory
      updatedOrder.items.forEach((cartItem) =>
        admin
          .firestore()
          .collection(productsCollection)
          .doc(cartItem.item.id)
          .get()
          .then((doc) => {
            if (!doc.exists) return

            const product = doc.data() as Product

            return admin
              .firestore()
              .collection(productsCollection)
              .doc(cartItem.item.id)
              .set(
                {
                  inventory:
                    product.inventory >= cartItem.quantity
                      ? product.inventory -
                      cartItem.quantity
                      : 0,
                },
                { merge: true }
              )
          })
      )

      // Create new order on Shipstation
      const secret = Buffer.from(`${env.shipstation.api_key}:${env.shipstation.api_secret}`).toString('base64')

      await axios({
        method: 'POST',
        url: 'https://ssapi.shipstation.com/orders/createorder',
        headers: {
          Authorization: `Basic ${secret}`
        },
        data: {
          orderNumber: snapshot.after.id,
          orderKey: snapshot.after.id,
          orderDate: new Date().toISOString(),
          paymentDate: new Date().toISOString(),
          orderStatus: 'awaiting_shipment',
          customerUsername: updatedOrder.user.name,
          customerEmail: updatedOrder.user.email,
          billTo: {
            name: 'The President',
          },
          shipTo: {
            name: updatedOrder.shippingAddress.fullname,
            street1: updatedOrder.shippingAddress.address1,
            street2: updatedOrder.shippingAddress.address2 ? updatedOrder.shippingAddress.address2 : null,
            street3: null,
            city: updatedOrder.shippingAddress.city,
            state: updatedOrder.shippingAddress.state,
            postalCode: updatedOrder.shippingAddress.zipCode,
            country: 'US',
            phone: updatedOrder.shippingAddress.phone,
            residential: true,
          },
          items: updatedOrder.items.map((item => {
            return {
              sku: item.item.id,
              name: item.item.title,
              imageUrl: item.item.imageUrl,
              quantity: item.quantity,
              unitPrice: item.item.price
            }
          })),
          amountPaid: updatedOrder.amount,
        }
      })
    }

    return ordersIndex.saveObject({
      objectID: snapshot.after.id,
      ...updatedOrder,
    })
  })

export const onOrderDeleted = functions.firestore
  .document(`${ordersCollection}/{orderId}`)
  .onDelete(async (snapshot, context) => {
    // Update the order-counts/counts
    const countsData = await admin
      .firestore()
      .collection(orderCountsCollection)
      .doc(orderCountsDocument)
      .get()

    if (!countsData.exists) {
      return
    } else {
      // Found the counts document, update it
      const counts = countsData.data() as { orderCounts: number }

      await admin
        .firestore()
        .collection(orderCountsCollection)
        .doc(orderCountsDocument)
        .set({
          orderCounts:
            counts.orderCounts >= 1 ? counts.orderCounts - 1 : 0,
        })

      // Delete order on Shipstation
      const secret = Buffer.from(`${env.shipstation.api_key}:${env.shipstation.api_secret}`).toString('base64')

      await axios({
        method: 'DELETE',
        url: `https://ssapi.shipstation.com/orders/${snapshot.id}`,
        headers: {
          Authorization: `Basic ${secret}`
        },
      })
    }

    return ordersIndex.deleteObject(snapshot.id)
  })

export const createPaymentIntents = functions.https.onCall(
  async (data, context) => {
    try {
      if (!context.auth) throw new Error('Not authenticated.')

      const { amount, customer, payment_method } = data as {
        amount: number
        customer?: string
        payment_method?: string
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100,
        currency: 'usd',
        customer,
        payment_method,
      })

      return { clientSecret: paymentIntent.client_secret }
    } catch (error) {
      throw error
    }
  }
)

export const createStripeCustomer = functions.https.onCall(
  async (_, context) => {
    try {
      if (!context.auth) throw new Error('Not authenticated.')

      const customer = await stripe.customers.create({
        email: context.auth.token.email,
      })

      // Update the user document in the users collection in firestore
      await admin
        .firestore()
        .collection('users')
        .doc(context.auth.uid)
        .set({ stripeCustomerId: customer.id }, { merge: true })

      return { customerId: customer.id }
    } catch (error) {
      throw error
    }
  }
)

export const setDefaultCard = functions.https.onCall((data, context) => {
  try {
    if (!context.auth) throw new Error('Not authenticated.')

    const { customerId, payment_method } = data as {
      customerId: string
      payment_method: string
    }

    return stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: payment_method },
    })
  } catch (error) {
    throw error
  }
})

export const listPaymentMethods = functions.https.onCall(
  async (data, context) => {
    try {
      if (!context.auth) throw new Error('Not authenticated.')

      const { customerId } = data as { customerId: string }

      // 1. Query all payment methods of the given customer
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      })

      // 2. Query stripe customer object of the given customer
      const customer = await stripe.customers.retrieve(customerId)

      return { paymentMethods, customer }
    } catch (error) {
      throw error
    }
  }
)

export const detachPaymentMethod = functions.https.onCall(
  async (data, context) => {
    try {
      if (!context.auth) throw new Error('Not authenticated.')

      const { payment_method } = data as { payment_method: string }

      const paymentMethod = await stripe.paymentMethods.detach(
        payment_method
      )

      if (!paymentMethod) throw new Error('Sorry, something went wrong.')

      return { paymentMethod }
    } catch (error) {
      throw error
    }
  }
)

// Create subscription
export const createSubscription = functions.https.onCall(
  async (data, context) => {
    try {
      if (!context.auth) throw new Error('Not authenticated.')

      // Receive the coupon id
      const { stripeId, priceId, couponId, quantity } = data as {
        stripeId: string
        priceId: string
        couponId: string
        quantity: number
      }

      // Create a subscription
      // Use the coupon id here
      const subscription = await stripe.subscriptions.create({
        customer: stripeId,
        items: [{ price: priceId, quantity }],
        coupon: couponId,
        payment_behavior: 'allow_incomplete',
        expand: ['latest_invoice.payment_intent'],
      })

      const invoice = subscription.latest_invoice as Stripe.Invoice
      const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent

      return {
        subscription,
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
      }
    } catch (error) {
      throw error
    }
  }
)

// Update subscription that listen to the payment succeeded event, in order for this function
// to be called we need to set a webhook on Stripe dashboard
export const updateSubscription = functions.https.onRequest(
  async (req, res) => {
    try {
      const signature = req.headers['stripe-signature']

      if (!signature) {
        throw new Error('Webhooks signature verification failed.')
      }

      const event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        env.stripe.signing_key
      )

      // Extract the object from the event.
      const dataObject = event.data.object as any

      if (event.type === 'invoice.payment_succeeded') {
        // The subscription automatically activates after the first payment is successful
        // Set the payment method used to pay the first invoice as the default payment method for that subscription
        const subscription_id = dataObject['subscription']
        const payment_intent_id = dataObject['payment_intent']

        // Retrieve the payment intent used to pay the subscription
        const payment_intent = await stripe.paymentIntents.retrieve(
          payment_intent_id
        )

        if (!payment_intent.payment_method) {
          throw new Error('Cannot find the payment intent.')
        }

        // Update the subscription to set the payment method to charge customer
        const currentSubscription = await stripe.subscriptions.update(
          subscription_id,
          {
            default_payment_method:
              payment_intent.payment_method as string,
            coupon: undefined, // Set the coupon back to undefined
          }
        )

        // Update the status of the current order in Firestore and
        // create a new order for the next interval
        // 1. Find the current order from Firestore by the subscription id
        const currentOrderSnapshot = await admin
          .firestore()
          .collection(ordersCollection)
          .where('subscriptionId', '==', subscription_id)
          .get()

        if (!currentOrderSnapshot.empty) {
          currentOrderSnapshot.forEach(async (doc) => {
            const currentOderData = doc.data() as Omit<Order, 'id'>
            currentOderData.items

            if (currentOderData.shipmentStatus === 'New') {
              // Update the payment status and shipment status of this order
              await admin
                .firestore()
                .collection(ordersCollection)
                .doc(doc.id)
                .set(
                  {
                    // The actual charged amount
                    amount: payment_intent.amount_received / 100,
                    paymentStatus: 'Success',
                    shipmentStatus: 'Preparing',
                    subscriptionStartDate:
                      currentSubscription.current_period_start,
                    updatedAt:
                      admin.firestore.FieldValue.serverTimestamp(),
                  },
                  { merge: true }
                )

              // Create a new order for the next interval
              await admin
                .firestore()
                .collection(ordersCollection)
                .add({
                  items: currentOderData.items,
                  amount: currentOderData.amount,
                  totalQuantity:
                    currentOderData.totalQuantity,
                  shippingAddress:
                    currentOderData.shippingAddress,
                  user: currentOderData.user,
                  paymentStatus: 'Processing',
                  paymentType: currentOderData.paymentType,
                  subscriptionId:
                    currentOderData.subscriptionId,
                  shipmentStatus: 'New',
                  createdAt:
                    admin.firestore.FieldValue.serverTimestamp(),
                  subscriptionStartDate:
                    currentSubscription.current_period_end,
                })
            }
          })
        }
      }

      res.status(200).end()
    } catch (error) {
      res.status(400).end()
    }
  }
)

// Delete subscription
export const cancelSubscription = functions.https.onCall(
  async (data, context) => {
    try {
      if (!context.auth) throw new Error('Not authenticated.')

      const { subscriptionId } = data as {
        subscriptionId: string
      }

      const deletedSubscription = await stripe.subscriptions.del(
        subscriptionId
      )

      return { subscription: deletedSubscription }
    } catch (error) {
      throw error
    }
  }
)

// Pause subscription
export const pauseSubscription = functions.https.onCall(
  async (data, context) => {
    try {
      if (!context.auth) throw new Error('Not authenticated.')

      const { subscriptionId } = data as {
        subscriptionId: string
      }

      // Find the subscription
      const subscription = await stripe.subscriptions.retrieve(
        subscriptionId
      )

      // Calculate resume at date
      const resumeAt = subscription.current_period_end

      const updatedSubscription = await stripe.subscriptions.update(
        subscriptionId,
        {
          pause_collection: {
            behavior: 'keep_as_draft',
            resumes_at: resumeAt + 1,
          },
        }
      )

      return { subscription: updatedSubscription }
    } catch (error) {
      throw error
    }
  }
)

// This function is listening to webhook from Shipstation when and order has been shipped.
export const updateShipmentStatus = functions.https.onRequest(
  async (req, res) => {
    try {
      const body = req.body

      // If the webhook type is ship notify
      if (body.resource_type === 'SHIP_NOTIFY') {
        // Use resource_url from the body to get the details of the order
        const secret = Buffer.from(`${env.shipstation.api_key}:${env.shipstation.api_secret}`).toString('base64')

        const response = await axios({
          method: 'GET',
          url: body.resource_url,
          headers: {
            Authorization: `Basic ${secret}`
          }
        })

        const orderDetail = response.data

        // Update shipmentStatus of the order in Firestore
        // 1. Query the order from Firestore
        const orderData = await admin
          .firestore()
          .collection(ordersCollection)
          .doc(orderDetail.orderKey)
          .get()

        if (orderData.exists) {
          // 2. Update shipmentStatus to shipped
          await admin
            .firestore()
            .collection(ordersCollection)
            .doc(orderDetail.orderKey)
            .set({
              shipmentStatus: 'Shipped',
              // shipDate: orderDetail.shipDate,
              // shipmentCost: orderDetail.shipmentCost
            },
              { merge: true }
            )
        }
      }

      res.status(200).end()
    } catch (error) {
      res.status(400).end()
    }
  }
)

