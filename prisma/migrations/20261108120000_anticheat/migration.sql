-- CreateTable
CREATE TABLE `AnticheatEvent` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(120) NOT NULL,
    `detection` VARCHAR(80) NOT NULL,
    `category` VARCHAR(40) NOT NULL DEFAULT 'custom',
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE') NOT NULL DEFAULT 'OPEN',
    `playerLicense` VARCHAR(120) NULL,
    `playerName` VARCHAR(120) NULL,
    `playerNetId` INTEGER NULL,
    `playerSource` INTEGER NULL,
    `identifiers` JSON NULL,
    `details` JSON NULL,
    `serverId` VARCHAR(120) NULL,
    `resource` VARCHAR(120) NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acknowledgedAt` DATETIME(3) NULL,
    `acknowledgedById` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `resolvedById` VARCHAR(191) NULL,
    `resolution` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AnticheatEvent_eventId_key`(`eventId`),
    INDEX `AnticheatEvent_createdAt_idx`(`createdAt`),
    INDEX `AnticheatEvent_severity_status_idx`(`severity`, `status`),
    INDEX `AnticheatEvent_playerLicense_createdAt_idx`(`playerLicense`, `createdAt`),
    INDEX `AnticheatEvent_detection_createdAt_idx`(`detection`, `createdAt`),
    INDEX `AnticheatEvent_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AnticheatEvent` ADD CONSTRAINT `AnticheatEvent_acknowledgedById_fkey` FOREIGN KEY (`acknowledgedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnticheatEvent` ADD CONSTRAINT `AnticheatEvent_resolvedById_fkey` FOREIGN KEY (`resolvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
