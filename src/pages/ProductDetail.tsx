import React, { useEffect, useState } from 'react'
import { useParams, useHistory } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import Button from '../components/Button'
import Spinner from '../components/Spinner'
import ConfirmAddToCartDialog from '../components/dialogs/ConfirmAddToCartDialog'
import PageNotFound from './PageNotFound'
import { useAuthContext } from '../state/auth-context'
import { useModalContext } from '../state/modal-context'
import { useProductsContext } from '../state/products-context'
import { useCartContext } from '../state/cart-context'
import { useManageCart } from '../hooks/useManageCart'
import { useDialog } from '../hooks/useDialog'
import { Product } from '../types'
import { formatAmount, isAdmin, isClient } from '../helpers'

interface Props { }

const ProductDetail: React.FC<Props> = () => {
  const {
    productsState: { products, loading, error },
  } = useProductsContext()
  const {
    authState: { authUser, userInfo },
  } = useAuthContext()
  const { setModalType } = useModalContext()
  const {
    addToCart,
    loading: addToCartLoading,
    error: addToCartError,
  } = useManageCart()
  const { openDialog, setOpenDialog } = useDialog()
  const { cart } = useCartContext()

  const [quantity, setQuantity] = useState(1)
  const [addedCartItem, setAddedCartItem] = useState<{
    product: Product
    quantity: number
  } | null>(null)

  const params = useParams() as { productId: string }
  const history = useHistory()

  const [product, setProduct] = useState<Product | undefined>()

  useEffect(() => {
    const prod = products.All.find((item) => item.id === params.productId)

    if (prod) setProduct(prod)
    else setProduct(undefined)
  }, [params, products.All])

  if (loading) return <Spinner color='grey' width={50} height={50} />

  if (!loading && error) return <h2 className='header'>{error}</h2>

  if (!product) return <PageNotFound />

  return (
    <div className='page--product-detail'>
      <div className='product-detail__section'>
        <img
          src={product.imageUrl}
          alt={product.title}
          className='product-image'
        />
      </div>

      <div className='product-detail__section'>
        <div className='product-detail__sub-section'>
          <h3 className='header'>{product.title}</h3>
          <p className='paragraph'>{product.description}</p>
        </div>
        <div className='product-detail__sub-section'>
          <p className='paragraph'>
            Price:{' '}
            <span className='paragraph--orange'>
              ${formatAmount(product.price)}
            </span>
          </p>
        </div>
        <div className='product-detail__sub-section product-detail__sub-section--stock'>
          <p className='paragraph'>
            Availability:{' '}
            <span
              className={`paragraph--success ${product.inventory === 0 ? 'paragraph--error' : undefined
                }`}
            >
              {product.inventory} pcs
            </span>
          </p>
        </div>

        {product.inventory === 0 ? (
          <p className='paragraph--error'>Out of stock</p>
        ) : (
          <div className='product-detail__sub-section quantity-control'>
            <div
              className='qty-action'
              style={{ cursor: quantity === 1 ? 'not-allowed' : undefined }}
              onClick={() =>
                setQuantity((prev) => {
                  if (prev < 2) return prev

                  return prev - 1
                })
              }
            >
              <FontAwesomeIcon icon={['fas', 'minus']} size='xs' color='grey' />
            </div>

            <div className='qty-action qty-action--qty'>
              <p className='paragraph'>{quantity}</p>
            </div>

            <div
              className='qty-action'
              style={{
                cursor:
                  quantity === product.inventory ? 'not-allowed' : undefined,
              }}
              onClick={() =>
                setQuantity((prev) => {
                  if (prev === product.inventory) return prev

                  return prev + 1
                })
              }
            >
              <FontAwesomeIcon icon={['fas', 'plus']} size='xs' color='grey' />
            </div>
          </div>
        )}

        <Button
          disabled={product.inventory === 0 || addToCartLoading}
          loading={addToCartLoading}
          onClick={async () => {
            if (!authUser) {
              setModalType('signin')
              return
            } else if (authUser && userInfo && isAdmin(userInfo.role)) {
              alert('You are an admin user, you cannot proceed "Add To Cart".')
              return
            } else if (authUser && userInfo && isClient(userInfo.role)) {
              // Check if this item is already in the existing cart, and if it is, check it's cart quantity vs it's inventory

              const foundItem = cart
                ? cart.find((item) => item.product === product.id)
                : undefined

              if (
                foundItem &&
                foundItem.quantity + quantity > product.inventory
              ) {
                const allowedQty = product.inventory - foundItem.quantity
                setQuantity(allowedQty === 0 ? 1 : allowedQty)
                alert(
                  `You already have "${foundItem.quantity} pcs" of this item in your cart, so maximum quantity allowed for this item is "${allowedQty} pcs".`
                )
                return
              }

              // Add The Product To Cart
              const finished = await addToCart(
                product.id,
                quantity,
                authUser.uid,
                product.inventory
              )

              if (finished) {
                setOpenDialog(true)
                setAddedCartItem({ product, quantity })
                setQuantity(1)
              }
            }
          }}
        >
          Add to Cart
        </Button>

        {addToCartError && <p className='paragraph--error'>{addToCartError}</p>}
      </div>

      {openDialog && addedCartItem && (
        <ConfirmAddToCartDialog
          header='Added to cart'
          cartItemData={addedCartItem}
          goToCart={() => {
            setOpenDialog(false)
            history.push('/buy/my-cart')
          }}
          continueShopping={() => {
            setOpenDialog(false)
            history.push('/')
          }}
        />
      )}
    </div>
  )
}

export default ProductDetail
