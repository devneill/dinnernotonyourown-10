-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "cuisineType" TEXT NOT NULL,
    "priceLevel" INTEGER NOT NULL,
    "rating" REAL NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "photoUrl" TEXT,
    "mapsUrl" TEXT,
    "websiteUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DinnerGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restaurantId" TEXT NOT NULL,
    CONSTRAINT "DinnerGroup_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attendee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "dinnerGroupId" TEXT NOT NULL,
    CONSTRAINT "Attendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attendee_dinnerGroupId_fkey" FOREIGN KEY ("dinnerGroupId") REFERENCES "DinnerGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DinnerGroup_restaurantId_idx" ON "DinnerGroup"("restaurantId");

-- CreateIndex
CREATE INDEX "Attendee_userId_idx" ON "Attendee"("userId");

-- CreateIndex
CREATE INDEX "Attendee_dinnerGroupId_idx" ON "Attendee"("dinnerGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendee_userId_key" ON "Attendee"("userId");
