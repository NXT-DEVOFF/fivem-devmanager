-- Bibliotheque de snippets partagee
CREATE TABLE `Snippet` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `description` TEXT NULL,
    `language` VARCHAR(40) NOT NULL DEFAULT 'lua',
    `code` LONGTEXT NOT NULL,
    `tags` JSON NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Snippet_authorId_idx`(`authorId`),
    INDEX `Snippet_language_idx`(`language`),
    INDEX `Snippet_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Snippet` ADD CONSTRAINT `Snippet_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
