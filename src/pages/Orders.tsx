import React from 'react'

import Spinner from '../components/Spinner'
import OrderItem from '../components/OrderItem'
import { useOrdersContext } from '../state/orders-context'

interface Props {}

const Orders: React.FC<Props> = () => {
  const {
    ordersState: { orders, loading, error },
  } = useOrdersContext()

  if (loading) return <Spinner color='grey' height={50} width={50} />

  if (error) return <h2 className='header--center'>{error}</h2>

  if (!orders || orders.length === 0)
    return <h2 className='header--center'>Your have no orders.</h2>

  return (
    <div className='page--orders'>
      <div className='orders-header'>
        <h2 className='header header--orders'>Your orders</h2>

        <div className='orders-tabs'></div>
      </div>

      <div className='orders-details'>
        <div className='orders-content'>
          <div className='orders-column'>
            <h3 className='header--center'>Purchased date</h3>
          </div>
          <div className='orders-column'>
            <h3 className='header--center'>Quantity</h3>
          </div>
          <div className='orders-column'>
            <h3 className='header--center'>Amount ($)</h3>
          </div>
          <div className='orders-column'>
            <h3 className='header--center'>Shipment status</h3>
          </div>
        </div>

        {/* Order */}
        {orders.map((order) => (
          <OrderItem key={order.id} order={order} />
        ))}
      </div>
    </div>
  )
}

export default Orders
