import React, { useState, useEffect, useRef } from 'react'
import { Redirect, useHistory } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { PaymentMethod, StripeCardElementChangeEvent } from '@stripe/stripe-js'
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useForm } from 'react-hook-form'

import Button from '../components/Button'
import Spinner from '../components/Spinner'
import AlertDialog from '../components/dialogs/AlertDialog'
import { useCartContext } from '../state/cart-context'
import { useAuthContext } from '../state/auth-context'
import { useCheckout } from '../hooks/useCheckout'
import { useFetchCards } from '../hooks/useFetchCards'
import { useDialog } from '../hooks/useDialog'
import { useRemoveCard } from '../hooks/useRemoveCard'
import {
  Address,
  CartItem,
  CreatePaymentIntentData,
  CreatePaymentMethod,
  UploadOrder,
} from '../types'
import { calculateCartAmount, calculateCartQuantity } from '../helpers'
import { address_key } from './../components/select-address/ShippingAddress'

interface Props { }

const Checkout: React.FC<Props> = () => {
  const [orderSummary, setOrderSummary] = useState<{
    quantity: number
    amount: number
    orderItems: CartItem[]
  }>()
  const [address, setAddress] = useState<Address | null>(null)
  const [loadAddress, setLoadAddress] = useState(true)

  const [useCard, setUseCard] = useState<
    { type: 'new' } | { type: 'saved'; payment_method: string }
  >({ type: 'new' })
  const [disabled, setDisabled] = useState(true)
  const [newCardError, setNewCardError] = useState('')
  const [openSetDefault, setOpenSetDefault] = useState(false)
  const [cardToDelete, setCardToDelete] = useState<PaymentMethod | null>(null)
  const [dialogType, setDialogType] = useState<
    'inform_payment' | 'remove_card' | null
  >(null)

  const { cart } = useCartContext()
  const {
    authState: { userInfo },
  } = useAuthContext()
  const {
    completePayment,
    createStripeCustomerId,
    loading,
    error,
  } = useCheckout()
  const {
    userCards,
    stripeCustomer,
    setUserCards,
    loading: fetchCardsLoading,
    error: fetchCardsError,
  } = useFetchCards(userInfo)
  const {
    removeCard,
    loading: removeCardLoading,
    error: removeCardError,
  } = useRemoveCard()
  const { openDialog, setOpenDialog } = useDialog()

  const elements = useElements()
  const stripe = useStripe()

  const history = useHistory()

  const btnRef = useRef<HTMLButtonElement>(null)

  const { register, errors, handleSubmit, reset } = useForm<{
    cardName: string
    save?: boolean
    setDefault?: boolean
  }>()

  useEffect(() => {
    const addressData = window.localStorage.getItem(address_key)

    if (!addressData) {
      setLoadAddress(false)
      return
    }

    const address = JSON.parse(addressData)
    setAddress(address)
    setLoadAddress(false)
  }, [setAddress, setLoadAddress])

  useEffect(() => {
    if (cart && cart.length > 0)
      setOrderSummary({
        quantity: calculateCartQuantity(cart),
        amount: calculateCartAmount(cart),
        orderItems: cart,
      })
  }, [cart])

  useEffect(() => {
    if (userCards?.data && userCards.data.length > 0) {
      setUseCard({
        type: 'saved',
        payment_method:
          stripeCustomer?.invoice_settings.default_payment_method ||
          userCards.data[0].id,
      })
      setDisabled(false)
      reset()
    } else {
      setUseCard({ type: 'new' })
      setDisabled(true)
      reset()
    }
  }, [userCards?.data, stripeCustomer, reset])

  const handleClickBtn = () => {
    if (btnRef && btnRef.current) btnRef.current.click()
  }

  const handleCardChange = (e: StripeCardElementChangeEvent) => {
    setDisabled(e.empty || !e.complete)
    setNewCardError(e.error ? e.error.message : '')

    if (e.complete) setNewCardError('')
  }

  const handleCompletePayment = handleSubmit(async (data) => {
    if (!elements || !orderSummary || !stripe || !userInfo || !address) return

    const { amount, quantity, orderItems } = orderSummary

    const newOrder: UploadOrder = {
      items: orderItems.map(({ quantity, user, item }) => ({
        quantity,
        user,
        item,
      })),
      amount,
      totalQuantity: quantity,
      shippingAddress: address,
      user: { id: userInfo.id, name: userInfo.username },
    }

    if (useCard.type === 'new') {
      // A. New Card
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) return

      if (typeof data.save === 'boolean') {
        // A.1 New card, not save
        // 1. Prepare a create payemnt intent data to get a client secret
        const createPaymentIntentData: CreatePaymentIntentData = {
          amount: orderSummary.amount,
        }

        // 2. Prepare a payment method to complete the payment
        const payment_method: CreatePaymentMethod = {
          card: cardElement,
          billing_details: { name: data.cardName },
        }

        if (data.save) {
          // A.2 New card, save
          if (!userInfo.stripeCustomerId) {
            // 1. User doesn't have a stripe customer id yet, create a new stripe customer.
            const stripeCustomerId = await createStripeCustomerId()

            createPaymentIntentData.customer = stripeCustomerId
          } else {
            // 2. User already has, use the existing one
            createPaymentIntentData.customer = userInfo.stripeCustomerId
          }
        }

        const finished = await completePayment(
          { createPaymentIntentData, stripe, payment_method },
          {
            save: data.save,
            setDefault: data.setDefault,
            customerId: createPaymentIntentData.customer,
          },
          newOrder,
          orderItems
        )

        if (finished) {
          setOpenDialog(true)
          setDialogType('inform_payment')
          reset()
        }
      }
    } else if (useCard.type === 'saved' && useCard.payment_method) {
      // B. Saved Card
      // 1. Prepare a create payemnt intent data to get a client secret
      const createPaymentIntentData: CreatePaymentIntentData = {
        amount: orderSummary.amount,
        customer: stripeCustomer?.id,
        payment_method: useCard.payment_method,
      }

      // 2. Prepare a payment method to complete the payment
      const payment_method: CreatePaymentMethod = useCard.payment_method

      const finished = await completePayment(
        { createPaymentIntentData, stripe, payment_method },
        {
          save: data.save,
          setDefault: data.setDefault,
          customerId: stripeCustomer?.id,
        },
        newOrder,
        orderItems
      )

      if (finished) {
        setOpenDialog(true)
        setDialogType('inform_payment')
        reset()
      }
    }
  })

  if (loadAddress) return <Spinner color='grey' height={50} width={50} />

  if (!address) return <Redirect to='/buy/select-address' />

  const { fullname, address1, address2, city, state, zipCode, phone } = address

  return (
    <div className='page--checkout'>
      <div className='payment'>
        <h2 className='header'>Select a payment card</h2>

        <form className='form' onSubmit={handleCompletePayment}>
          {/* Saved Cards */}
          {fetchCardsLoading ? (
            <Spinner color='grey' height={30} width={30} />
          ) : (
            userCards?.data &&
            userCards.data.length > 0 &&
            userCards.data.map((method) => (
              <label key={method.id} className='card' htmlFor={method.id}>
                <input
                  type='radio'
                  name='card'
                  value={method.id}
                  style={{ width: '10%' }}
                  checked={
                    useCard.type === 'saved' &&
                    useCard.payment_method === method.id
                  }
                  onChange={() => {
                    setUseCard({ type: 'saved', payment_method: method.id })
                    setDisabled(false)
                    reset()
                  }}
                />

                <p className='paragraph' style={{ width: '40%' }}>
                  **** **** **** {method.card?.last4}
                </p>

                <p className='paragraph' style={{ width: '10%' }}>
                  {method.card?.brand === 'visa' ? (
                    <FontAwesomeIcon
                      icon={['fab', 'cc-visa']}
                      size='2x'
                      color='#206CAB'
                    />
                  ) : method.card?.brand === 'mastercard' ? (
                    <FontAwesomeIcon
                      icon={['fab', 'cc-mastercard']}
                      size='2x'
                      color='#EB2230'
                    />
                  ) : method.card?.brand === 'amex' ? (
                    <FontAwesomeIcon
                      icon={['fab', 'cc-amex']}
                      size='2x'
                      color='#099DD9'
                    />
                  ) : (
                    method.card?.brand
                  )}
                </p>

                <div style={{ width: '30%' }}>
                  {method.id ===
                    stripeCustomer?.invoice_settings.default_payment_method ? (
                    <p className='paragraph--center paragraph--focus'>
                      Default
                    </p>
                  ) : useCard.type === 'saved' &&
                    useCard.payment_method === method.id ? (
                    <div>
                      <input type='checkbox' name='setDefault' ref={register} />
                      <label htmlFor='setDefault' className='set-default-card'>
                        Set as default
                      </label>
                    </div>
                  ) : undefined}
                </div>

                <p
                  className='paragraph'
                  style={{ width: '10%', cursor: 'pointer' }}
                  onClick={() => {
                    setCardToDelete(method)
                    setOpenDialog(true)
                    setDialogType('remove_card')
                  }}
                >
                  <FontAwesomeIcon
                    icon={['fas', 'trash-alt']}
                    size='1x'
                    color='red'
                  />
                </p>
              </label>
            ))
          )}

          {/* New Card */}
          <div className='form--new-card'>
            <label htmlFor='newCard' className='card card--new'>
              <input
                type='radio'
                name='card'
                checked={useCard.type === 'new'}
                style={{ width: '10%' }}
                onChange={() => {
                  setUseCard({ type: 'new' })
                  setDisabled(true)
                  reset()
                }}
              />

              <h4
                className='paragraph paragraph--bold paragraph--new-card'
                style={{ width: '40%' }}
              >
                Use new card
              </h4>

              <p className='paragraph' style={{ width: '10%' }}>
                {' '}
              </p>

              <div className='new-card__logo' style={{ width: '40%' }}>
                <FontAwesomeIcon
                  icon={['fab', 'cc-visa']}
                  size='lg'
                  style={{ margin: '0 0.5rem' }}
                  color='#206CAB'
                />
                <FontAwesomeIcon
                  icon={['fab', 'cc-mastercard']}
                  size='lg'
                  style={{ margin: '0 0.5rem' }}
                  color='#EB2230'
                />
                <FontAwesomeIcon
                  icon={['fab', 'cc-amex']}
                  size='lg'
                  style={{ margin: '0 0.5rem' }}
                  color='#099DD9'
                />
              </div>
            </label>

            {useCard.type === 'new' && (
              <div className='new-card__form'>
                <div className='form__input-container form__input-container--card'>
                  <input
                    type='text'
                    className='input input--card-name'
                    name='cardName'
                    placeholder='Name on card'
                    ref={register({ required: 'Card name is required.' })}
                  />

                  {errors.cardName && (
                    <p className='paragraph paragraph--small paragraph--error'>
                      {errors.cardName.message}
                    </p>
                  )}
                </div>

                <div className='form__input-container form__input-container--card'>
                  <CardElement
                    options={{
                      style: {
                        base: { color: 'blue', iconColor: 'blue', textAlign: 'center' },
                        invalid: { color: 'red', iconColor: 'red' },
                      },
                    }}
                    onChange={handleCardChange}
                  />

                  {newCardError && (
                    <p className='paragraph paragraph--error'>{newCardError}</p>
                  )}
                </div>

                <div className='form__set-new-card'>
                  <div className='form__input-container'>
                    <input
                      type='checkbox'
                      name='save'
                      ref={register}
                      onClick={() => setOpenSetDefault((prev) => !prev)}
                    />
                    <label htmlFor='saveCard' className='paragraph'>
                      Save this card
                    </label>
                  </div>

                  {openSetDefault && (
                    <div className='form__input-container'>
                      <input type='checkbox' name='setDefault' ref={register} />
                      <label htmlFor='setDefault' className='paragraph paragraph--set-default'>
                        Set as default
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Hidden Button */}
          <button
            ref={btnRef}
            style={{ display: 'none' }}
            disabled={!stripe || !useCard || disabled || loading}
          ></button>
        </form>

        {error && <p className='paragraph paragraph--error'>{error}</p>}

        {fetchCardsError && (
          <p className='paragraph paragraph--error'>{fetchCardsError}</p>
        )}
      </div>

      <div className='summary'>
        {/* Shipping Address */}
        <div className='summary__section'>
          <h3 className='header'>Delivery address</h3>

          <p className='paragraph paragraph--focus'>{fullname}:</p>
          <p className='paragraph paragraph--focus'>{address1}</p>
          {address2 && <p className='paragraph paragraph--focus'>{address2}</p>}
          <p className='paragraph paragraph--focus'>
            {city} {state}, {zipCode}
          </p>
          <p className='paragraph paragraph--focus'>Tel: {phone}</p>
        </div>

        {/* Order summary */}
        <div className='summary__section'>
          <h3 className='header'>Order summary</h3>

          <div className='order-summary'>
            <div>
              <p className='paragraph paragraph--focus'>Total quantity:</p>
              <p className='paragraph paragraph--focus'>Total amount:</p>
            </div>
            <div>
              <p className='paragraph paragraph--focus'>
                {orderSummary && orderSummary.quantity} pcs
              </p>
              <p className='paragraph paragraph--focus'>
                ${orderSummary && orderSummary.amount}
              </p>
            </div>
          </div>
        </div>

        <div className='summary__section'>
          <Button
            width='100%'
            height='4rem'
            className='btn--orange btn--payment'
            onClick={handleClickBtn}
            disabled={!stripe || !useCard || disabled || loading}
            loading={loading}
          >
            Complete payment
          </Button>
        </div>
      </div>

      {openDialog && dialogType === 'inform_payment' && (
        <AlertDialog
          header='Confirm Payment'
          message='You have successfully made the payment, you can click "Ok" below to view your order.'
          onConfirm={() => {
            setOpenDialog(false)
            setDialogType(null)
            history.replace('/orders/my-orders')
          }}
          confirmText='Ok'
        />
      )}

      {openDialog && dialogType === 'remove_card' && cardToDelete && (
        <AlertDialog
          header='Please confirm'
          message={`Are you sure you want to remove ${cardToDelete.card?.brand}: **** **** **** ${cardToDelete.card?.last4}?`}
          onCancel={() => {
            setCardToDelete(null)
            setOpenDialog(false)
            setDialogType(null)
          }}
          onConfirm={async () => {
            if (!cardToDelete) return

            const paymentMethod = await removeCard(cardToDelete.id)

            if (paymentMethod) {
              setCardToDelete(null)
              setOpenDialog(false)
              setDialogType(null)
              setUserCards((prev) =>
                prev
                  ? {
                    data: prev.data.filter(
                      (item) => item.id !== paymentMethod.id
                    ),
                  }
                  : prev
              )
            }
          }}
          loading={removeCardLoading}
          error={removeCardError}
        />
      )}
    </div>
  )
}

export default Checkout
