import React, { useState } from 'react'
import { useHistory } from 'react-router-dom'

import MyCartItem from '../components/cart/MyCartItem'
import Spinner from '../components/Spinner'
import Button from '../components/Button'
import AlertDialog from '../components/dialogs/AlertDialog'
import { useCartContext } from '../state/cart-context'
import { useDialog } from '../hooks/useDialog'
import { useManageCart } from '../hooks/useManageCart'
import { CartItem } from '../types'
import {
  calculateCartQuantity,
  calculateCartAmount,
  formatAmount,
} from '../helpers'

interface Props { }

const MyCart: React.FC<Props> = () => {
  const { cart } = useCartContext()
  const { openDialog, setOpenDialog } = useDialog()
  const { removeCartItem, loading, error } = useManageCart()

  const [cartItemToDelete, setCartItemToDelete] = useState<CartItem | null>(
    null
  )

  const history = useHistory()

  if (!cart) return <Spinner color='grey' height={50} width={50} />

  if (cart && cart.length === 0)
    return (
      <h2 className='header--center'>
        Your cart is empty, start{' '}
        <span
          className='header--orange header--link'
          onClick={() => history.push('/')}
        >
          shopping?
        </span>
      </h2>
    )

  return (
    <div className='page--my-cart'>
      <div className='cart'>
        <h2 className='header'>Shopping cart</h2>

        <div className='cart-detail'>
          {cart.map((item) => (
            <MyCartItem
              key={item.id}
              cartItem={item}
              openDialog={openDialog}
              setOpenDialog={setOpenDialog}
              setCartItemToDelete={setCartItemToDelete}
            />
          ))}
        </div>
      </div>

      <div className='cart-summary'>
        <h3 className='header'>Cart summary:</h3>

        <div>
          <p className='paragraph'>
            Quantity:{' '}
            <span className='paragraph paragraph--orange paragraph--focus'>
              {calculateCartQuantity(cart)}
            </span>
          </p>

          <p className='paragraph'>
            Amount:{' '}
            <span className='paragraph paragraph--orange paragraph--focus'>
              ${formatAmount(calculateCartAmount(cart))}
            </span>
          </p>
        </div>

        <Button
          width='100%'
          height='4rem'
          className='btn--orange'
          style={{ margin: '1rem 0' }}
          onClick={() => history.push('/buy/select-address')}
        >
          Proceed to checkout
        </Button>
      </div>

      {openDialog && cartItemToDelete && (
        <AlertDialog
          header='Please confirm'
          message={`Are you sure you want to delete the "${cartItemToDelete.item.title}" from your cart?`}
          onCancel={() => {
            setCartItemToDelete(null)
            setOpenDialog(false)
          }}
          onConfirm={async () => {
            if (cartItemToDelete) {
              const finished = await removeCartItem(
                cartItemToDelete.item.id,
                cartItemToDelete.user
              )

              if (finished) {
                setCartItemToDelete(null)
                setOpenDialog(false)
              }
            }
          }}
          loading={loading}
          error={error}
        />
      )}
    </div>
  )
}

export default MyCart
