import React from 'react'

import Button from '../Button'
import ClientDropdown from './ClientDropdown'
import AdminDropdown from './AdminDropdown'
import {
  useAuthContext,
  openUserDropdown,
  signoutRedirect,
} from '../../state/auth-context'
import { useViewContext } from '../../state/view-context'
import { useAuthenticate } from '../../hooks/useAuthenticate'
import { isAdmin, isClient } from '../../helpers'

interface Props {}

const UserDropdown: React.FC<Props> = () => {
  const {
    authState: { authUser, userInfo },
    authDispatch,
  } = useAuthContext()
  const { signout } = useAuthenticate()
  const { viewMode } = useViewContext()

  return (
    <div className='page page--sidebar'>
      <div className='sidebar sidebar-show'>
        <div className='sidebar__section sidebar__section--profile'>
          <h3 className='header--center header--sidebar'>
            {authUser?.displayName}
          </h3>
          <h3 className='header--center header--sidebar'>{authUser?.email}</h3>
        </div>

        {/* Admin user */}
        {userInfo && isAdmin(userInfo?.role) && <AdminDropdown />}

        {/* Client user */}
        {userInfo &&
          (isClient(userInfo?.role) ||
            (isAdmin(userInfo?.role) && viewMode === 'client')) && (
            <ClientDropdown />
          )}

        {/* Logout */}
        <div className='sidebar__section'>
          <Button
            className='btn--sidebar-signout'
            onClick={() => {
              signout()
              authDispatch(signoutRedirect(true))
            }}
          >
            SIGN OUT
          </Button>
        </div>

        {/* Close sidebar */}
        <div className='sidebar__section'>
          <Button
            className='sidebar__close'
            onClick={() => authDispatch(openUserDropdown(false))}
          >
            &times;
          </Button>
        </div>
      </div>
    </div>
  )
}

export default UserDropdown
