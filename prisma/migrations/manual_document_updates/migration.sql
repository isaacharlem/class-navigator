-- Step 1: Create a new table with the desired schema
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "url" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "courseId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Step 2: Copy the data from the old table to the new table
INSERT INTO "new_Document" ("id", "title", "type", "content", "url", "courseId", "createdAt", "updatedAt")
SELECT "id", "name" AS "title", "type", "content", "url", "courseId", "createdAt", "updatedAt"
FROM "Document";

-- Step 3: Drop the old table
DROP TABLE "Document";

-- Step 4: Rename the new table to the old table name
ALTER TABLE "new_Document" RENAME TO "Document"; 