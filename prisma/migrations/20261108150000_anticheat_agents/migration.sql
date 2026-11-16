-- AlterTable : agregation des detections repetees
ALTER TABLE `AnticheatEvent`
    ADD COLUMN `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `occurrences` INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX `AnticheatEvent_detection_playerLicense_createdAt_idx` ON `AnticheatEvent`(`detection`, `playerLicense`, `createdAt`);

-- CreateTable
CREATE TABLE `AnticheatAgent` (
    `id` VARCHAR(191) NOT NULL,
    `serverId` VARCHAR(120) NOT NULL,
    `version` VARCHAR(40) NULL,
    `resourceName` VARCHAR(120) NULL,
    `queueSize` INTEGER NOT NULL DEFAULT 0,
    `playerCount` INTEGER NOT NULL DEFAULT 0,
    `detectionsTotal` INTEGER NOT NULL DEFAULT 0,
    `lastError` VARCHAR(255) NULL,
    `firstSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AnticheatAgent_serverId_key`(`serverId`),
    INDEX `AnticheatAgent_lastSeenAt_idx`(`lastSeenAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
