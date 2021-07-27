import React, { useEffect } from 'react'

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

interface Props { }

const UserDropdown: React.FC<Props> = () => {
  const {
    authState: { authUser, userInfo },
    authDispatch,
  } = useAuthContext()
  const { signout } = useAuthenticate()
  const { viewMode } = useViewContext()

  useEffect(() => {
    // Disable body scroll when the component is mounted
    const body = document.getElementsByTagName('body')[0]
    const pageSidebar = document.querySelector<HTMLElement>('.page--sidebar')
    const sidebar = document.querySelector<HTMLElement>('.sidebar')

    body.style.overflow = 'hidden'
    body.style.position = 'relative'

    // Set height to full height of the view port
    const vh = window.innerHeight
    if (pageSidebar) {
      pageSidebar.style.height = `${vh}px`
    }

    if (sidebar) {
      sidebar.style.height = `${vh}px`
    }

    return () => {
      // Enable body scroll when the component is unmounted
      const body = document.getElementsByTagName('body')[0]

      body.style.overflow = 'auto'
      body.style.position = 'static'
    }
  }, [])

  return (
    <div className='page page--sidebar'>
      <div className='sidebar sidebar-show'>
        <div className='sidebar__section'>
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
