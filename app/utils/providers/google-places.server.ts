import { cachified } from '@epic-web/cachified'
import { lruCache } from '#app/utils/cache.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { invariant } from '@epic-web/invariant'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours
const SWR_TTL = 1000 * 60 * 60 // 1 hour

// Predefined cuisine type mapping
const cuisineTypeMap: Record<string, string> = {
  'restaurant': 'Other',
  'cafe': 'Cafe',
  'bar': 'Bar',
  'meal_takeaway': 'Takeaway',
  'meal_delivery': 'Delivery',
  'bakery': 'Bakery',
  'food': 'Other',
  'japanese_restaurant': 'Japanese',
  'chinese_restaurant': 'Chinese',
  'italian_restaurant': 'Italian',
  'mexican_restaurant': 'Mexican',
  'thai_restaurant': 'Thai',
  'indian_restaurant': 'Indian',
  'vietnamese_restaurant': 'Vietnamese',
  'korean_restaurant': 'Korean',
  'french_restaurant': 'French',
  'american_restaurant': 'American',
  'steakhouse': 'Steakhouse',
  'seafood_restaurant': 'Seafood',
  'sushi_restaurant': 'Sushi',
  'pizza_restaurant': 'Pizza',
  'fast_food_restaurant': 'Fast Food',
  'vegetarian_restaurant': 'Vegetarian',
  'vegan_restaurant': 'Vegan',
}

interface NearbySearchParams {
  radius?: number
  type?: string
  minPrice?: number
  maxPrice?: number
  keyword?: string
  userLocation?: {
    lat: number
    lng: number
  }
}

interface PlaceDetails {
  website?: string
  url?: string
}

interface GooglePlacesResponse {
  status: string
  results?: Array<{
    place_id: string
    name: string
    vicinity: string
    types: string[]
    price_level?: number
    rating?: number
    geometry: {
      location: {
        lat: number
        lng: number
      }
    }
    photos?: Array<{
      photo_reference: string
    }>
  }>
}

interface GooglePlaceDetailsResponse {
  status: string
  result?: {
    website?: string
    url?: string
  }
}

export async function getNearbyRestaurants({
  radius = 2000,
  type = 'restaurant',
  minPrice,
  maxPrice,
  keyword,
  userLocation,
}: NearbySearchParams) {
  invariant(GOOGLE_PLACES_API_KEY, 'GOOGLE_PLACES_API_KEY is required')
  invariant(userLocation, 'userLocation is required')

  const cacheKey = `nearby-restaurants:${JSON.stringify({
    radius,
    type,
    minPrice,
    maxPrice,
    keyword,
    userLocation,
  })}`

  return cachified({
    key: cacheKey,
    ttl: CACHE_TTL,
    staleWhileRevalidate: SWR_TTL,
    cache: lruCache,
    async getFreshValue() {
      return fetchAndStoreRestaurants({
        radius,
        type,
        minPrice,
        maxPrice,
        keyword,
        userLocation,
      })
    },
  })
}

async function fetchAndStoreRestaurants(params: NearbySearchParams) {
  const { radius, type, minPrice, maxPrice, keyword, userLocation } = params
  invariant(userLocation, 'userLocation is required')
  invariant(radius, 'radius is required')

  const searchParams = new URLSearchParams()
  searchParams.append('location', `${userLocation.lat},${userLocation.lng}`)
  searchParams.append('radius', radius.toString())
  if (type) searchParams.append('type', type)
  searchParams.append('key', GOOGLE_PLACES_API_KEY)

  if (minPrice !== undefined) searchParams.append('minprice', minPrice.toString())
  if (maxPrice !== undefined) searchParams.append('maxprice', maxPrice.toString())
  if (keyword) searchParams.append('keyword', keyword)

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${searchParams}`,
  )

  if (!response.ok) {
    throw new Error(`Google Places API error: ${response.statusText}`)
  }

  const data = (await response.json()) as GooglePlacesResponse
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places API error: ${data.status}`)
  }

  const restaurants = await Promise.all(
    (data.results || []).map(async place => {
      const details = await getPlaceDetails(place.place_id)
      const restaurant = {
        id: place.place_id,
        name: place.name,
        address: place.vicinity,
        cuisineType: extractCuisineType(place.types),
        priceLevel: place.price_level || 0,
        rating: place.rating || 0,
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        photoUrl: place.photos?.[0]
          ? getPhotoUrl(place.photos[0].photo_reference)
          : null,
        mapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
        websiteUrl: details.website || null,
      }

      // Upsert to database
      await prisma.restaurant.upsert({
        where: { id: restaurant.id },
        update: restaurant,
        create: restaurant,
      })

      return restaurant
    }),
  )

  return restaurants
}

async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const cacheKey = `place-details:${placeId}`

  return cachified({
    key: cacheKey,
    ttl: 1000 * 60 * 60 * 24 * 7, // 7 days
    cache: lruCache,
    async getFreshValue() {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?` +
          new URLSearchParams({
            place_id: placeId,
            fields: 'website,url',
            key: GOOGLE_PLACES_API_KEY || '', // Add empty string as fallback
          }),
      )

      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.statusText}`)
      }

      const data = (await response.json()) as GooglePlaceDetailsResponse
      if (data.status !== 'OK') {
        throw new Error(`Google Places API error: ${data.status}`)
      }

      return {
        website: data.result?.website,
        url: data.result?.url,
      }
    },
  })
}

function getPhotoUrl(photoReference: string): string {
  invariant(GOOGLE_PLACES_API_KEY, 'GOOGLE_PLACES_API_KEY is required')
  
  const params = {
    maxwidth: '400',
    photo_reference: photoReference,
    key: GOOGLE_PLACES_API_KEY,
  } as const

  return (
    'https://maps.googleapis.com/maps/api/place/photo?' +
    new URLSearchParams(params)
  )
}

function extractCuisineType(types: string[]): string {
  for (const type of types) {
    if (type in cuisineTypeMap) {
      return cuisineTypeMap[type]
    }
  }
  return 'Other'
} 