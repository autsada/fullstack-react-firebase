import React, { useState } from 'react'
import { Redirect } from 'react-router-dom'

import ShippingAddress from '../components/select-address/ShippingAddress'
import AddAndEditAddress from '../components/select-address/AddAndEditAddress'
import AlertDialog from '../components/dialogs/AlertDialog'
import Spinner from '../components/Spinner'
import { useAuthContext } from '../state/auth-context'
import { useCartContext } from '../state/cart-context'
import { useDialog } from '../hooks/useDialog'
import { useManageShippingAddress } from '../hooks/useManageShippingAddress'
import { Address } from '../types'

interface Props { }

const SelectAddress: React.FC<Props> = () => {
  const {
    authState: { userInfo },
  } = useAuthContext()
  const { cart } = useCartContext()
  const { openDialog, setOpenDialog } = useDialog()
  const { deleteAddress, loading, error } = useManageShippingAddress()

  const [addressToEdit, setAddressToEdit] = useState<Address | null>(null)
  const [addressToDelete, setAddressToDelete] = useState<Address | null>(null)

  if (!userInfo || !cart) return <Spinner color='grey' height={50} width={50} />

  if (cart && cart.length === 0) return <Redirect to='/' />

  return (
    <div className='page--select-address'>
      <h2 className='header'>Select a shipping address</h2>

      <div className='select-address'>
        <div className='select-address__existing'>
          {!userInfo?.shippingAddresses ||
            userInfo.shippingAddresses.length === 0 ? (
            <p className='paragraph'>No address, please add one.</p>
          ) : (
            userInfo.shippingAddresses.map((address, index) => (
              <ShippingAddress
                key={index}
                address={{ ...address, index }}
                setAddressToEdit={setAddressToEdit}
                setOpenDialog={setOpenDialog}
                setAddressToDelete={setAddressToDelete}
              />
            ))
          )}
        </div>

        <div className='select-address__add-new'>
          <h3 className='header'>Add a new address</h3>

          <AddAndEditAddress
            userInfo={userInfo}
            addressToEdit={addressToEdit}
            setAddressToEdit={setAddressToEdit}
          />
        </div>
      </div>

      {openDialog && addressToDelete && (
        <AlertDialog
          header='Please confirm'
          message='Are you sure you want to delete this address?'
          onCancel={() => {
            setAddressToDelete(null)
            setOpenDialog(false)
          }}
          onConfirm={async () => {
            if (!userInfo || addressToDelete?.index === undefined) return

            if (typeof addressToDelete.index !== 'number') return

            const finished = await deleteAddress(
              addressToDelete.index,
              userInfo
            )

            if (finished) {
              setAddressToDelete(null)
              setOpenDialog(false)
            }
          }}
          loading={loading}
          error={error}
        />
      )}
    </div>
  )
}

export default SelectAddress
