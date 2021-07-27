import React, { useState, useEffect } from 'react'

import Spinner from '../components/Spinner'
import Pagination from '../components/Pagination'
import User from '../components/manage-users/User'
import { useSearchContext } from '../state/search-context'
import { useFetchUsers } from '../hooks/useFetchUsers'
import { usePagination } from '../hooks/usePagination'
import { UserInfo } from '../types'

const usersPerPage = 10

interface Props {
  userInfo: UserInfo
}

const ManageUsers: React.FC<Props> = ({ userInfo }) => {
  const { users, userCounts, loading, error, queryMoreUsers } = useFetchUsers(
    userInfo
  )
  const { searchedItems } = useSearchContext()
  const { page, totalPages } = usePagination(
    userCounts,
    usersPerPage,
    undefined,
    searchedItems as UserInfo[]
  )

  const [usersByPage, setUsersByPage] = useState(users)
  const [paginatedSearchedItems, setPaginatedSearchedItems] = useState(
    searchedItems
  )

  useEffect(() => {
    const startIndex = usersPerPage * (page - 1)
    const endIndex = usersPerPage * page

    if (searchedItems) {
      setPaginatedSearchedItems(searchedItems.slice(startIndex, endIndex))
      setUsersByPage([])
    } else {
      if (!users) return

      // Check if we need to query more users
      if (users.length < userCounts && users.length < usersPerPage * page) {
        queryMoreUsers()
        return
      }

      setUsersByPage(users.slice(startIndex, endIndex))
      setPaginatedSearchedItems(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchedItems, users, page, userCounts])

  if (loading) return <Spinner color='grey' height={50} width={50} />

  if (error) return <h2 className='header--center'>{error}</h2>

  if (!users || users.length === 0)
    return <h2 className='header--center'>No users.</h2>

  return (
    <div className='page--manage-users'>
      <h2 className='header--center'>Manage users</h2>

      <div className='pagination-container'>
        <Pagination page={page} totalPages={totalPages} />
      </div>

      <table className='table table--manage-users'>
        <thead>
          <tr>
            {/* Header */}
            <th className='table-cell' style={{ width: '15%' }} rowSpan={2}>
              Name
            </th>
            <th className='table-cell' style={{ width: '20%' }} rowSpan={2}>
              Email
            </th>
            <th className='table-cell table-cell--hide' rowSpan={2}>
              Created At
            </th>

            <th className='table-cell' style={{ width: '30%' }} colSpan={3}>
              Role
            </th>

            <th className='table-cell' rowSpan={2}>
              Edit
            </th>
          </tr>

          {/* Sub header */}
          <tr>
            <th className='table-cell'>Client</th>
            <th className='table-cell'>Admin</th>
            <th className='table-cell'>Super</th>
          </tr>
        </thead>

        <tbody>
          {paginatedSearchedItems ? (
            <>
              {paginatedSearchedItems.length < 1 ? (
                <tr>
                  <td colSpan={6}>
                    <h2 className='header--center'>No users found.</h2>
                  </td>
                </tr>
              ) : (
                (paginatedSearchedItems as UserInfo[]).map((user) => (
                  <User key={user.id} user={user} admin={userInfo} />
                ))
              )}
            </>
          ) : (
            usersByPage &&
            usersByPage.map((user) => (
              <User key={user.id} user={user} admin={userInfo} />
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default ManageUsers
