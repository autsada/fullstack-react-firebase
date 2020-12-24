import {
  Role,
  ProductCategory,
  CartItem,
  PurchasedItem,
  ShipmentStatus,
} from '../types'

export const isAdmin = (role: Role | null) =>
  role === 'ADMIN' || role === 'SUPER_ADMIN'

export const isClient = (role: Role | null) => role === 'CLIENT'

export const categories: ProductCategory[] = [
  'Clothing',
  'Shoes',
  'Watches',
  'Accessories',
]

export const shipmentStatuses: ShipmentStatus[] = [
  'New',
  'Preparing',
  'Shipped',
  'Delivered',
  'Canceled',
]

export const formatAmount = (amount: number) =>
  amount.toLocaleString('en', { minimumFractionDigits: 2 })

export const calculateCartQuantity = (cart: (CartItem | PurchasedItem)[]) =>
  cart.reduce((qty, item) => qty + item.quantity, 0)

export const calculateCartAmount = (cart: (CartItem | PurchasedItem)[]) =>
  cart.reduce(
    (amount, cartItem) => amount + cartItem.quantity * cartItem.item.price,
    0
  )
