import { type ActionFunctionArgs } from 'react-router'
import { leaveDinnerGroup } from '#app/utils/restaurants.server'
import { requireUserId } from '#app/utils/auth.server'

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request)

  try {
    await leaveDinnerGroup(userId)
    return { success: true }
  } catch (error) {
    console.error('Failed to leave dinner group:', error)
    return {
      error: error instanceof Error ? error.message : 'Failed to leave dinner group',
    }
  }
} 