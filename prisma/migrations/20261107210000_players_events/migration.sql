-- CreateTable
CREATE TABLE `Player` (
    `id` VARCHAR(191) NOT NULL,
    `license` VARCHAR(120) NOT NULL,
    `displayName` VARCHAR(120) NOT NULL,
    `discordId` VARCHAR(40) NULL,
    `steamHex` VARCHAR(60) NULL,
    `status` ENUM('ACTIVE', 'WATCHED', 'SUSPENDED', 'BANNED') NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `lastSeenAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Player_license_key`(`license`),
    INDEX `Player_status_idx`(`status`),
    INDEX `Player_displayName_idx`(`displayName`),
    INDEX `Player_lastSeenAt_idx`(`lastSeenAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlayerSanction` (
    `id` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL AUTO_INCREMENT,
    `playerId` VARCHAR(191) NOT NULL,
    `type` ENUM('WARNING', 'MUTE', 'KICK', 'TEMP_BAN', 'PERMANENT_BAN') NOT NULL,
    `reason` TEXT NOT NULL,
    `evidence` TEXT NULL,
    `durationHours` INTEGER NULL,
    `startsAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endsAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedReason` TEXT NULL,
    `revokedById` VARCHAR(191) NULL,
    `issuedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PlayerSanction_number_key`(`number`),
    INDEX `PlayerSanction_playerId_createdAt_idx`(`playerId`, `createdAt`),
    INDEX `PlayerSanction_type_idx`(`type`),
    INDEX `PlayerSanction_endsAt_idx`(`endsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServerEvent` (
    `id` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(160) NOT NULL,
    `description` TEXT NOT NULL,
    `category` VARCHAR(60) NOT NULL DEFAULT 'Communaute',
    `status` ENUM('DRAFT', 'PLANNED', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELED') NOT NULL DEFAULT 'PLANNED',
    `location` VARCHAR(120) NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `maxPlayers` INTEGER NULL,
    `reward` VARCHAR(160) NULL,
    `requirements` TEXT NULL,
    `organizerId` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `canceledAt` DATETIME(3) NULL,
    `cancelReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ServerEvent_number_key`(`number`),
    INDEX `ServerEvent_status_startsAt_idx`(`status`, `startsAt`),
    INDEX `ServerEvent_startsAt_idx`(`startsAt`),
    INDEX `ServerEvent_organizerId_idx`(`organizerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Player` ADD CONSTRAINT `Player_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlayerSanction` ADD CONSTRAINT `PlayerSanction_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlayerSanction` ADD CONSTRAINT `PlayerSanction_issuedById_fkey` FOREIGN KEY (`issuedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlayerSanction` ADD CONSTRAINT `PlayerSanction_revokedById_fkey` FOREIGN KEY (`revokedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServerEvent` ADD CONSTRAINT `ServerEvent_organizerId_fkey` FOREIGN KEY (`organizerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
