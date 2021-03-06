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

  useEffect(() => {
    if (modal) {
      // Disable body scroll when the component is mounted
      const body = document.getElementsByTagName('body')[0]
      const vh = window.innerHeight

      body.style.overflow = 'hidden'
      body.style.position = 'relative'
      body.style.height = `${vh}px`
    } else {
      // Enable body scroll when the component is unmounted
      const body = document.getElementsByTagName('body')[0]

      body.style.overflow = 'auto'
      body.style.position = 'static'
      body.style.height = `auto`
    }
  }, [modal])

  return (
    <div className='main-page'>
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
