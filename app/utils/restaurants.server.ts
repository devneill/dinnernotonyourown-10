import { prisma } from './db.server'
import type { Prisma, Restaurant } from '@prisma/client'

export async function getRestaurantById(id: string) {
  return prisma.restaurant.findUnique({
    where: { id },
    include: {
      dinnerGroups: {
        include: {
          attendees: true,
        },
      },
    },
  })
}

export async function getRestaurantsByLocation({
  lat,
  lng,
  radius = 2000,
  minRating,
  maxPrice,
}: {
  lat: number
  lng: number
  radius?: number
  minRating?: number
  maxPrice?: number
}) {
  // Convert radius from meters to degrees (approximate)
  const latDegrees = radius / 111000 // 1 degree = ~111km
  const lngDegrees = radius / (111000 * Math.cos((lat * Math.PI) / 180))

  const conditions: Prisma.RestaurantWhereInput[] = [
    {
      lat: {
        gte: lat - latDegrees,
        lte: lat + latDegrees,
      },
    },
    {
      lng: {
        gte: lng - lngDegrees,
        lte: lng + lngDegrees,
      },
    },
  ]

  if (minRating !== undefined) {
    conditions.push({
      rating: {
        gte: minRating,
      },
    })
  }

  if (maxPrice !== undefined) {
    conditions.push({
      priceLevel: {
        lte: maxPrice,
      },
    })
  }

  return prisma.restaurant.findMany({
    where: {
      AND: conditions,
    },
    include: {
      dinnerGroups: {
        include: {
          attendees: true,
        },
      },
    },
  })
}

export async function getDinnerGroupsByRestaurantId(restaurantId: string) {
  return prisma.dinnerGroup.findMany({
    where: { restaurantId },
    include: {
      attendees: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              image: true,
            },
          },
        },
      },
    },
  })
}

export async function createDinnerGroup({
  restaurantId,
  userId,
  notes,
}: {
  restaurantId: string
  userId: string
  notes?: string | null
}) {
  return prisma.$transaction(async tx => {
    // Check if user is already in a dinner group
    const existingAttendee = await tx.attendee.findUnique({
      where: { userId },
    })

    if (existingAttendee) {
      throw new Error('User is already in a dinner group')
    }

    // Create dinner group and add user as attendee
    const dinnerGroup = await tx.dinnerGroup.create({
      data: {
        restaurantId,
        notes,
        attendees: {
          create: {
            userId,
          },
        },
      },
      include: {
        attendees: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    })

    return dinnerGroup
  })
}

export async function leaveDinnerGroup(userId: string) {
  return prisma.$transaction(async tx => {
    // Find and delete the attendee
    const attendee = await tx.attendee.delete({
      where: { userId },
      include: {
        dinnerGroup: {
          include: {
            attendees: true,
          },
        },
      },
    })

    // If this was the last attendee, delete the dinner group
    if (attendee.dinnerGroup.attendees.length === 1) {
      await tx.dinnerGroup.delete({
        where: { id: attendee.dinnerGroupId },
      })
    }

    return attendee
  })
} 