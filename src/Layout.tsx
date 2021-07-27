import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import MainNav from './components/nav/MainNav'
import UserDropdown from './components/nav/UserDropdown'
import { useAuthContext, openUserDropdown } from './state/auth-context'
import { useModalContext } from './state/modal-context'
import ViewContextProvider from './state/view-context'

interface Props { }

const Layout: React.FC<Props> = ({ children }) => {
  const {
    authState: { isUserDropdownOpen },
    authDispatch,
  } = useAuthContext()
  const { modal } = useModalContext()

  const location = useLocation()

  useEffect(() => {
    if (isUserDropdownOpen) authDispatch(openUserDropdown(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  return (
    <div>
      <ViewContextProvider>
        <MainNav />
        {isUserDropdownOpen && <UserDropdown />}
      </ViewContextProvider>

      <div id='page' className='page'>{children}</div>

      {modal && modal}
    </div>
  )
}

export default Layout
