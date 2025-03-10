import { type ActionFunctionArgs } from 'react-router'
import { z } from 'zod'
import { createDinnerGroup } from '#app/utils/restaurants.server'
import { requireUserId } from '#app/utils/auth.server'

const JoinSchema = z.object({
  restaurantId: z.string(),
  notes: z.string().optional(),
})

export async function action({ request }: ActionFunctionArgs) {
  try {
    const userId = await requireUserId(request)
    const formData = await request.formData()
    const result = JoinSchema.safeParse(Object.fromEntries(formData))

    if (!result.success) {
      return { 
        error: 'Invalid join parameters',
        status: 400 
      }
    }

    const dinnerGroup = await createDinnerGroup({
      userId,
      ...result.data,
    })

    return { dinnerGroup }
  } catch (error) {
    console.error('Failed to join dinner group:', error)
    const status = error instanceof Error && error.message.includes('unauthorized')
      ? 401
      : 500
    return {
      error: error instanceof Error ? error.message : 'Failed to join dinner group',
      status
    }
  }
} 