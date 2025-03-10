import { type LoaderFunctionArgs } from 'react-router'
import { z } from 'zod'
import { getNearbyRestaurants } from '#app/utils/providers/google-places.server'

const LocationSearchSchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius: z.coerce.number().optional().default(2000),
  minRating: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
})

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const result = LocationSearchSchema.safeParse(Object.fromEntries(url.searchParams))

  if (!result.success) {
    return {
      error: 'Invalid search parameters',
      restaurants: [],
    }
  }

  const { lat, lng, radius, minRating, maxPrice } = result.data

  try {
    const restaurants = await getNearbyRestaurants({
      userLocation: { lat, lng },
      radius,
      minPrice: maxPrice ? 1 : undefined, // if maxPrice is set, start from 1
      maxPrice,
    })

    // Filter by rating after fetching since Google Places API doesn't support minRating
    const filteredRestaurants = minRating
      ? restaurants.filter(r => (r.rating || 0) >= minRating)
      : restaurants

    return { restaurants: filteredRestaurants }
  } catch (error) {
    console.error('Failed to fetch restaurants:', error)
    return {
      error: 'Failed to fetch restaurants',
      restaurants: [],
    }
  }
} 